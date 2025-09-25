/**
 * NetworkSwitcher Component
 * Prominent UI toggle for switching between BSC testnet and mainnet
 * Includes safety warnings and visual indicators
 */

import React, { useState, useEffect } from 'react';
import { useNetworkStore } from '../store/network';
import { ConfirmDialog } from './Dialogs/ConfirmDialog';
import type { NetworkConfig } from '../types';
import './NetworkSwitcher.css';

interface NetworkSwitcherProps {
  compact?: boolean;
  showDetails?: boolean;
  className?: string;
}

export const NetworkSwitcher: React.FC<NetworkSwitcherProps> = ({
  compact = false,
  showDetails = true,
  className = '',
}) => {
  // Store state
  const {
    currentNetwork,
    availableNetworks,
    isConnected,
    isConnecting,
    blockNumber,
    gasPrice,
    error,
    switchNetwork,
    updateNetworkStats,
    isMainnet,
    validateNetworkSwitch,
  } = useNetworkStore();

  // Local state
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingNetwork, setPendingNetwork] = useState<NetworkConfig | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);

  // Update last update time when network stats change
  useEffect(() => {
    if (blockNumber) {
      setLastUpdateTime(new Date());
    }
  }, [blockNumber, gasPrice]);

  // Handle network switch with confirmation for mainnet
  const handleNetworkSwitch = (networkId: string) => {
    const targetNetwork = availableNetworks.find(n => n.id === networkId);
    if (!targetNetwork || targetNetwork.id === currentNetwork.id) {
      return;
    }

    // Validate the switch and check for warnings
    const warnings = validateNetworkSwitch(networkId);
    const hasMainnetWarnings = warnings.some(w => w.includes('MAINNET') || w.includes('DANGER'));

    if (hasMainnetWarnings) {
      // Show confirmation dialog for mainnet switches
      setPendingNetwork(targetNetwork);
      setShowConfirmDialog(true);
    } else {
      // Direct switch for safe operations
      performNetworkSwitch(targetNetwork);
    }
  };

  // Perform the actual network switch
  const performNetworkSwitch = async (network: NetworkConfig) => {
    try {
      await switchNetwork(network.id);
      console.log(`Successfully switched to ${network.displayName}`);
    } catch (error) {
      console.error('Failed to switch network:', error);
      alert(`Failed to switch to ${network.displayName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setShowConfirmDialog(false);
      setPendingNetwork(null);
    }
  };

  // Handle confirmation dialog
  const handleConfirmSwitch = () => {
    if (pendingNetwork) {
      performNetworkSwitch(pendingNetwork);
    }
  };

  const handleCancelSwitch = () => {
    setShowConfirmDialog(false);
    setPendingNetwork(null);
  };

  // Refresh network status
  const handleRefresh = async () => {
    try {
      await updateNetworkStats();
    } catch (error) {
      console.error('Failed to refresh network status:', error);
    }
  };

  // Format gas price for display
  const formatGasPrice = (gasPrice: string): string => {
    try {
      const gwei = parseFloat(gasPrice) / 1e9;
      return `${gwei.toFixed(1)} gwei`;
    } catch {
      return 'Unknown';
    }
  };

  // Get status indicator class
  const getStatusClass = (): string => {
    if (isConnecting) return 'connecting';
    if (!isConnected) return 'disconnected';
    if (error) return 'error';
    return 'connected';
  };

  // Get network warning message
  const getNetworkWarning = (): string | null => {
    if (isMainnet()) {
      return '⚠️ MAINNET ACTIVE - Real funds at risk!';
    }
    return null;
  };

  if (compact) {
    return (
      <div className={`network-switcher compact ${className}`}>
        <div className={`network-indicator ${currentNetwork.type}`}>
          <div 
            className={`network-status ${getStatusClass()}`}
            style={{ backgroundColor: currentNetwork.iconColor }}
          />
          <span className="network-name">{currentNetwork.displayName}</span>
          {isMainnet() && <span className="mainnet-warning">⚠️</span>}
        </div>
        
        <select
          value={currentNetwork.id}
          onChange={(e) => handleNetworkSwitch(e.target.value)}
          disabled={isConnecting}
          className="network-select"
        >
          {availableNetworks.map((network) => (
            <option key={network.id} value={network.id}>
              {network.displayName}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className={`network-switcher ${className}`}>
      {/* Main Network Status Card */}
      <div className={`network-status-card ${currentNetwork.type}`}>
        {/* Header */}
        <div className="network-header">
          <div className="network-info">
            <div 
              className={`network-indicator ${getStatusClass()}`}
              style={{ backgroundColor: currentNetwork.iconColor }}
            />
            <div className="network-details">
              <h3 className="network-name">{currentNetwork.displayName}</h3>
              <span className="network-type">Chain ID: {currentNetwork.chainId}</span>
            </div>
          </div>
          
          <div className="network-actions">
            <button
              onClick={handleRefresh}
              disabled={isConnecting}
              className="refresh-btn"
              title="Refresh network status"
            >
              🔄
            </button>
          </div>
        </div>

        {/* Network Warning */}
        {getNetworkWarning() && (
          <div className="network-warning mainnet">
            {getNetworkWarning()}
          </div>
        )}

        {/* Connection Status */}
        <div className="connection-status">
          <div className={`status-indicator ${getStatusClass()}`}>
            {isConnecting && 'Connecting...'}
            {!isConnecting && isConnected && 'Connected'}
            {!isConnecting && !isConnected && 'Disconnected'}
            {error && `Error: ${error}`}
          </div>
          
          {lastUpdateTime && isConnected && (
            <div className="last-update">
              Last updated: {lastUpdateTime.toLocaleTimeString()}
            </div>
          )}
        </div>

        {/* Network Statistics */}
        {showDetails && isConnected && (
          <div className="network-stats">
            <div className="stat-item">
              <span className="stat-label">Block Number:</span>
              <span className="stat-value">{blockNumber?.toLocaleString() || 'Loading...'}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Gas Price:</span>
              <span className="stat-value">
                {gasPrice ? formatGasPrice(gasPrice) : 'Loading...'}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Explorer:</span>
              <a 
                href={currentNetwork.blockExplorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="explorer-link"
              >
                View on {currentNetwork.blockExplorerUrl.includes('testnet') ? 'TestNet' : ''} BSCScan
              </a>
            </div>
          </div>
        )}

        {/* Network Switcher */}
        <div className="network-switcher-controls">
          <label className="switch-label">Switch Network:</label>
          <div className="network-options">
            {availableNetworks.map((network) => (
              <button
                key={network.id}
                onClick={() => handleNetworkSwitch(network.id)}
                disabled={isConnecting || network.id === currentNetwork.id}
                className={`network-option ${network.type} ${
                  network.id === currentNetwork.id ? 'active' : ''
                }`}
                style={{
                  borderColor: network.iconColor,
                  ...(network.id === currentNetwork.id && {
                    backgroundColor: network.iconColor + '20',
                  })
                }}
              >
                <div 
                  className="network-option-indicator"
                  style={{ backgroundColor: network.iconColor }}
                />
                <div className="network-option-details">
                  <span className="network-option-name">{network.displayName}</span>
                  <span className="network-option-type">
                    {network.isTestnet ? 'Testnet' : 'Mainnet'} • Chain {network.chainId}
                  </span>
                </div>
                {network.type === 'mainnet' && (
                  <span className="mainnet-badge">⚠️ REAL FUNDS</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Confirmation Dialog for Mainnet Switch */}
      {showConfirmDialog && pendingNetwork && (
        <ConfirmDialog
          isOpen={showConfirmDialog}
          title="⚠️ CRITICAL WARNING: Switch to Mainnet"
          message={`You are about to switch to BSC MAINNET where REAL FUNDS are at risk! This will use real BNB for all transactions. Are you absolutely sure you want to proceed with switching to ${pendingNetwork.displayName}?`}
          onConfirm={handleConfirmSwitch}
          onCancel={handleCancelSwitch}
          isDangerous={true}
          confirmText="YES, SWITCH TO MAINNET"
          cancelText="Cancel (Recommended)"
        >
          <div className="mainnet-warning-content">
            <div className="warning-details">
              <p>🔴 <strong>REAL BNB will be used for all transactions</strong></p>
              <p>🔴 <strong>All wallet operations will affect real balances</strong></p>
              <p>🔴 <strong>Failed transactions will consume real gas fees</strong></p>
              <p>🔴 <strong>This is NOT a test environment</strong></p>
            </div>
            <div className="network-switch-details">
              <p>From: <span className="from-network">{currentNetwork.displayName}</span></p>
              <p>To: <span className="to-network">{pendingNetwork.displayName}</span></p>
            </div>
          </div>
        </ConfirmDialog>
      )}
    </div>
  );
};

export default NetworkSwitcher;