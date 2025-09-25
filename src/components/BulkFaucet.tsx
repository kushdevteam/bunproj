/**
 * BulkFaucet Component
 * Bulk faucet operations for requesting test BNB for multiple wallets
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useFaucetStore } from '../store/faucet';
import { useWalletStore } from '../store/wallets';
import { useNetworkStore } from '../store/network';
import { useSessionStore } from '../store/session';
import type { BulkFaucetResult } from '../services/faucet-manager';

interface BulkFaucetProps {
  onComplete?: (result: BulkFaucetResult) => void;
  onError?: (error: string) => void;
  className?: string;
}

interface BulkSettings {
  targetWallets: 'all' | 'selected' | 'low-balance' | 'custom';
  customAddresses: string[];
  amount: number;
  maxConcurrent: number;
  strategy: string;
  minimumBalance: number; // For low-balance filter
}

export const BulkFaucet: React.FC<BulkFaucetProps> = ({
  onComplete,
  onError,
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [settings, setSettings] = useState<BulkSettings>({
    targetWallets: 'all',
    customAddresses: [],
    amount: 0.1,
    maxConcurrent: 3,
    strategy: 'fast-and-reliable',
    minimumBalance: 0.01,
  });

  const [customAddressInput, setCustomAddressInput] = useState('');
  const [isValidatingAddresses, setIsValidatingAddresses] = useState(false);

  const {
    isEnabled,
    isBulkOperationInProgress,
    bulkOperations,
    currentStrategy,
    bulkRequestBNB,
    setStrategy,
    hasAvailableFaucets,
    estimateSuccessProbability,
    refreshFaucetData,
  } = useFaucetStore();

  const { wallets, selectedWallets } = useWalletStore();
  const { isUnlocked } = useSessionStore();
  const { isMainnet, currentNetwork } = useNetworkStore();

  // Get the latest bulk operation
  const latestOperation = useMemo(() => {
    return bulkOperations.length > 0 ? bulkOperations[0] : null;
  }, [bulkOperations]);

  // Calculate target addresses based on settings
  const targetAddresses = useMemo(() => {
    switch (settings.targetWallets) {
      case 'all':
        return wallets.map(w => w.address);
      
      case 'selected':
        return wallets.filter(w => selectedWallets.includes(w.id)).map(w => w.address);
      
      case 'low-balance':
        return wallets.filter(w => w.balance < settings.minimumBalance).map(w => w.address);
      
      case 'custom':
        return settings.customAddresses.filter(addr => /^0x[a-fA-F0-9]{40}$/.test(addr));
      
      default:
        return [];
    }
  }, [settings, wallets, selectedWallets]);

  // Filter addresses that can actually request from faucets
  const availableAddresses = useMemo(() => {
    return targetAddresses.filter(address => hasAvailableFaucets(address));
  }, [targetAddresses, hasAvailableFaucets]);

  // Calculate operation statistics
  const operationStats = useMemo(() => {
    const totalAddresses = targetAddresses.length;
    const availableCount = availableAddresses.length;
    const avgSuccessProbability = availableAddresses.length > 0
      ? availableAddresses.reduce((sum, addr) => sum + estimateSuccessProbability(addr), 0) / availableAddresses.length
      : 0;
    
    const estimatedAmount = availableCount * settings.amount * avgSuccessProbability;
    const estimatedDuration = Math.ceil(availableCount / settings.maxConcurrent) * 30; // ~30s per batch

    return {
      totalAddresses,
      availableCount,
      avgSuccessProbability,
      estimatedAmount,
      estimatedDuration,
    };
  }, [targetAddresses, availableAddresses, estimateSuccessProbability, settings]);

  // Update strategy when settings change
  useEffect(() => {
    if (settings.strategy !== currentStrategy) {
      setStrategy(settings.strategy);
    }
  }, [settings.strategy, currentStrategy, setStrategy]);

  // Refresh faucet data on mount
  useEffect(() => {
    refreshFaucetData();
  }, [refreshFaucetData]);

  const handleBulkRequest = useCallback(async () => {
    if (!isUnlocked || !isEnabled || isBulkOperationInProgress || availableAddresses.length === 0) {
      return;
    }

    try {
      console.log(`🚰 Starting bulk faucet operation for ${availableAddresses.length} wallets`);
      
      const result = await bulkRequestBNB(
        availableAddresses,
        settings.amount,
        settings.maxConcurrent
      );

      console.log(`✅ Bulk operation completed: ${result.successfulWallets.length}/${availableAddresses.length} successful`);
      
      onComplete?.(result);

      // Refresh wallet balances after successful requests
      if (result.success && result.successfulWallets.length > 0) {
        // Trigger balance refresh with a small delay to allow blockchain confirmation
        setTimeout(() => {
          useWalletStore.getState().updateAllBalances();
        }, 3000);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Bulk operation failed';
      console.error('Bulk faucet operation failed:', error);
      onError?.(errorMessage);
    }
  }, [isUnlocked, isEnabled, isBulkOperationInProgress, availableAddresses, bulkRequestBNB, settings, onComplete, onError]);

  const handleAddCustomAddress = useCallback(() => {
    const address = customAddressInput.trim();
    if (!address) return;

    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      alert('Invalid Ethereum address format');
      return;
    }

    if (settings.customAddresses.includes(address)) {
      alert('Address already added');
      return;
    }

    setSettings(prev => ({
      ...prev,
      customAddresses: [...prev.customAddresses, address],
    }));
    setCustomAddressInput('');
  }, [customAddressInput, settings.customAddresses]);

  const handleRemoveCustomAddress = useCallback((address: string) => {
    setSettings(prev => ({
      ...prev,
      customAddresses: prev.customAddresses.filter(addr => addr !== address),
    }));
  }, []);

  const isOperationDisabled = useCallback(() => {
    return (
      !isUnlocked ||
      !isEnabled ||
      isMainnet ||
      currentNetwork.chainId !== 97 ||
      isBulkOperationInProgress ||
      availableAddresses.length === 0
    );
  }, [isUnlocked, isEnabled, isMainnet, currentNetwork.chainId, isBulkOperationInProgress, availableAddresses.length]);

  const getTooltipText = useCallback(() => {
    if (!isUnlocked) return 'Unlock session to perform bulk operations';
    if (!isEnabled || isMainnet() || currentNetwork.chainId !== 97) return 'Bulk faucet only available on BSC Testnet';
    if (isBulkOperationInProgress) return 'Bulk operation in progress...';
    if (availableAddresses.length === 0) return 'No wallets available for faucet requests';
    
    return `Request test BNB for ${availableAddresses.length} wallet(s) - Est. ${operationStats.estimatedAmount.toFixed(4)} BNB`;
  }, [isUnlocked, isEnabled, isMainnet, currentNetwork.chainId, isBulkOperationInProgress, availableAddresses.length, operationStats.estimatedAmount]);

  return (
    <div className={`bulk-faucet ${className}`}>
      <div className="bulk-faucet-header">
        <button
          className="bulk-faucet-toggle"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <span className="toggle-icon">{isExpanded ? '▼' : '▶'}</span>
          <span className="toggle-text">Bulk Faucet Operations</span>
          <span className="status-badge">
            {isBulkOperationInProgress ? 'Running' : `${availableAddresses.length} Available`}
          </span>
        </button>
      </div>

      {isExpanded && (
        <div className="bulk-faucet-content">
          {/* Target Wallet Selection */}
          <div className="setting-group">
            <label className="setting-label">Target Wallets</label>
            <div className="wallet-target-options">
              <label className="radio-option">
                <input
                  type="radio"
                  value="all"
                  checked={settings.targetWallets === 'all'}
                  onChange={(e) => setSettings(prev => ({ ...prev, targetWallets: e.target.value as any }))}
                />
                <span>All Wallets ({wallets.length})</span>
              </label>

              <label className="radio-option">
                <input
                  type="radio"
                  value="selected"
                  checked={settings.targetWallets === 'selected'}
                  onChange={(e) => setSettings(prev => ({ ...prev, targetWallets: e.target.value as any }))}
                />
                <span>Selected Wallets ({selectedWallets.length})</span>
              </label>

              <label className="radio-option">
                <input
                  type="radio"
                  value="low-balance"
                  checked={settings.targetWallets === 'low-balance'}
                  onChange={(e) => setSettings(prev => ({ ...prev, targetWallets: e.target.value as any }))}
                />
                <span>Low Balance (&lt; {settings.minimumBalance} BNB)</span>
              </label>

              <label className="radio-option">
                <input
                  type="radio"
                  value="custom"
                  checked={settings.targetWallets === 'custom'}
                  onChange={(e) => setSettings(prev => ({ ...prev, targetWallets: e.target.value as any }))}
                />
                <span>Custom Addresses ({settings.customAddresses.length})</span>
              </label>
            </div>

            {settings.targetWallets === 'low-balance' && (
              <div className="balance-threshold">
                <label>
                  Minimum Balance Threshold:
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    max="1"
                    value={settings.minimumBalance}
                    onChange={(e) => setSettings(prev => ({ ...prev, minimumBalance: parseFloat(e.target.value) || 0 }))}
                  />
                  BNB
                </label>
              </div>
            )}

            {settings.targetWallets === 'custom' && (
              <div className="custom-addresses">
                <div className="address-input">
                  <input
                    type="text"
                    placeholder="Enter wallet address (0x...)"
                    value={customAddressInput}
                    onChange={(e) => setCustomAddressInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddCustomAddress()}
                  />
                  <button onClick={handleAddCustomAddress} disabled={!customAddressInput.trim()}>
                    Add
                  </button>
                </div>

                {settings.customAddresses.length > 0 && (
                  <div className="address-list">
                    {settings.customAddresses.map(address => (
                      <div key={address} className="address-item">
                        <span className="address">{address}</span>
                        <button
                          className="remove-btn"
                          onClick={() => handleRemoveCustomAddress(address)}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Operation Settings */}
          <div className="settings-grid">
            <div className="setting-group">
              <label className="setting-label">Amount per Wallet</label>
              <div className="amount-input">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="1"
                  value={settings.amount}
                  onChange={(e) => setSettings(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0.1 }))}
                />
                <span className="currency">BNB</span>
              </div>
            </div>

            <div className="setting-group">
              <label className="setting-label">Max Concurrent</label>
              <select
                value={settings.maxConcurrent}
                onChange={(e) => setSettings(prev => ({ ...prev, maxConcurrent: parseInt(e.target.value) }))}
              >
                <option value={1}>1 (Sequential)</option>
                <option value={2}>2 (Conservative)</option>
                <option value={3}>3 (Recommended)</option>
                <option value={5}>5 (Aggressive)</option>
              </select>
            </div>

            <div className="setting-group">
              <label className="setting-label">Strategy</label>
              <select
                value={settings.strategy}
                onChange={(e) => setSettings(prev => ({ ...prev, strategy: e.target.value }))}
              >
                <option value="fast-and-reliable">Fast & Reliable</option>
                <option value="maximum-attempts">Maximum Attempts</option>
                <option value="conservative">Conservative</option>
                <option value="aggressive">Aggressive</option>
              </select>
            </div>
          </div>

          {/* Operation Statistics */}
          <div className="operation-stats">
            <div className="stat-item">
              <span className="stat-label">Target Addresses:</span>
              <span className="stat-value">{operationStats.totalAddresses}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Available for Faucet:</span>
              <span className="stat-value">{operationStats.availableCount}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Success Probability:</span>
              <span className="stat-value">{(operationStats.avgSuccessProbability * 100).toFixed(1)}%</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Estimated BNB:</span>
              <span className="stat-value">{operationStats.estimatedAmount.toFixed(4)}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Est. Duration:</span>
              <span className="stat-value">{Math.ceil(operationStats.estimatedDuration / 60)}m</span>
            </div>
          </div>

          {/* Current Operation Status */}
          {latestOperation && (
            <div className="current-operation">
              <h4>Current Operation</h4>
              <div className="operation-info">
                <div className="operation-progress">
                  <div className="progress-bar">
                    <div 
                      className="progress-fill"
                      style={{ 
                        width: `${(latestOperation.progress.completed / latestOperation.progress.total) * 100}%` 
                      }}
                    />
                  </div>
                  <span className="progress-text">
                    {latestOperation.progress.completed}/{latestOperation.progress.total} 
                    ({latestOperation.progress.successful} successful, {latestOperation.progress.failed} failed)
                  </span>
                </div>
                <div className="operation-status">
                  Status: <span className={`status ${latestOperation.status}`}>{latestOperation.status}</span>
                </div>
              </div>
            </div>
          )}

          {/* Action Button */}
          <div className="bulk-action">
            <button
              className={`bulk-request-btn ${isBulkOperationInProgress ? 'requesting' : ''}`}
              onClick={handleBulkRequest}
              disabled={isOperationDisabled() as boolean}
              title={getTooltipText()}
            >
              {isBulkOperationInProgress ? (
                <>
                  <span className="btn-icon">⏳</span>
                  <span className="btn-text">Requesting BNB...</span>
                </>
              ) : (
                <>
                  <span className="btn-icon">🚰</span>
                  <span className="btn-text">Request BNB for {availableAddresses.length} Wallet(s)</span>
                </>
              )}
            </button>
          </div>

          {!isEnabled && (
            <div className="bulk-warning">
              <span className="warning-icon">⚠️</span>
              <span className="warning-text">Bulk faucet operations only available on BSC Testnet</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// CSS styles would be added to the appropriate CSS file
export const bulkFaucetStyles = `
.bulk-faucet {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #ffffff;
  margin: 16px 0;
}

.bulk-faucet-header {
  padding: 16px;
  border-bottom: 1px solid #e2e8f0;
}

.bulk-faucet-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  background: none;
  border: none;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  color: #2d3748;
}

.toggle-icon {
  color: #4299e1;
  font-weight: bold;
}

.status-badge {
  margin-left: auto;
  padding: 4px 8px;
  background: #e2e8f0;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  color: #4a5568;
}

.bulk-faucet-content {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.setting-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.setting-label {
  font-weight: 600;
  color: #2d3748;
  font-size: 14px;
}

.wallet-target-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.radio-option {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.balance-threshold {
  margin-top: 8px;
  padding: 8px;
  background: #f7fafc;
  border-radius: 6px;
}

.custom-addresses {
  margin-top: 8px;
}

.address-input {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.address-input input {
  flex: 1;
  padding: 8px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
}

.address-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 150px;
  overflow-y: auto;
}

.address-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px;
  background: #f7fafc;
  border-radius: 6px;
  font-family: monospace;
  font-size: 12px;
}

.remove-btn {
  background: #fed7d7;
  border: none;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  cursor: pointer;
  color: #c53030;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.amount-input {
  display: flex;
  align-items: center;
  gap: 8px;
}

.amount-input input {
  flex: 1;
  padding: 8px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
}

.currency {
  font-weight: 600;
  color: #4a5568;
}

.operation-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
  padding: 12px;
  background: #f7fafc;
  border-radius: 8px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-align: center;
}

.stat-label {
  font-size: 12px;
  color: #718096;
  font-weight: 500;
}

.stat-value {
  font-size: 16px;
  font-weight: 600;
  color: #2d3748;
}

.current-operation {
  padding: 12px;
  background: #fff5f5;
  border: 1px solid #fed7d7;
  border-radius: 8px;
}

.operation-progress {
  margin: 8px 0;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: #e2e8f0;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #4facfe, #00f2fe);
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 12px;
  color: #4a5568;
  margin-top: 4px;
}

.bulk-action {
  display: flex;
  justify-content: center;
}

.bulk-request-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 200px;
  justify-content: center;
}

.bulk-request-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(79, 172, 254, 0.3);
}

.bulk-request-btn:disabled {
  background: #cbd5e0;
  color: #a0aec0;
  cursor: not-allowed;
  opacity: 0.6;
}

.bulk-request-btn.requesting {
  background: linear-gradient(135deg, #ffeaa7 0%, #fab1a0 100%);
  animation: pulse 2s infinite;
}

.bulk-warning {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: #fffaf0;
  border: 1px solid #fbd38d;
  border-radius: 6px;
  color: #c05621;
  font-size: 14px;
}

.status.running {
  color: #3182ce;
}

.status.completed {
  color: #38a169;
}

.status.cancelled {
  color: #e53e3e;
}
`;

export default BulkFaucet;