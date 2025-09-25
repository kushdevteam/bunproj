/**
 * StealthFunding Component
 * UI component for configuring and executing stealth wallet funding operations
 * Provides comprehensive controls for stealth distribution with real-time progress tracking
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useWalletFundingStore } from '../store/wallet-funding';
import { useWalletStore } from '../store/wallets';
import { useSessionStore } from '../store/session';
import type {
  StealthConfig,
  StealthFundingPlan,
  MasterWallet,
  StealthPattern,
  StealthOperationEvent,
  StealthTransaction
} from '../types/funding';
import './StealthFunding.css';

interface StealthFundingProps {
  onOperationComplete?: (result: any) => void;
  onError?: (error: string) => void;
}

export const StealthFunding: React.FC<StealthFundingProps> = ({
  onOperationComplete,
  onError
}) => {
  // Store hooks
  const {
    currentOperation,
    isExecuting,
    isPaused,
    error: storeError,
    preferences,
    availableMasterWallets,
    recentEvents,
    createStealthPlan,
    validatePlan,
    executeStealthOperationWithPlan,
    pauseOperation,
    resumeOperation,
    cancelOperation,
    loadAvailableMasterWallets,
    refreshMasterWalletBalances,
    updatePreferences,
    generateStealthConfig,
    clearError,
    getCurrentOperationStatus
  } = useWalletFundingStore();

  const { selectedWallets, wallets } = useWalletStore();
  const { isUnlocked } = useSessionStore();

  // Local state
  const [activeTab, setActiveTab] = useState<'configure' | 'preview' | 'execute' | 'monitor'>('configure');
  const [config, setConfig] = useState<StealthConfig>(preferences.defaultStealthConfig);
  const [selectedMasterWallet, setSelectedMasterWallet] = useState<string>('');
  const [totalAmount, setTotalAmount] = useState<number>(0.1);
  const [currentPlan, setCurrentPlan] = useState<StealthFundingPlan | null>(null);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [passphrase, setPassphrase] = useState<string>('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Load master wallets on component mount
  useEffect(() => {
    if (isUnlocked) {
      loadAvailableMasterWallets();
    }
  }, [isUnlocked, loadAvailableMasterWallets]);

  // Auto-select first available master wallet
  useEffect(() => {
    if (availableMasterWallets.length > 0 && !selectedMasterWallet) {
      setSelectedMasterWallet(availableMasterWallets[0].id);
    }
  }, [availableMasterWallets, selectedMasterWallet]);

  // Calculate selected wallet details
  const selectedWalletDetails = useMemo(() => {
    return wallets.filter(w => selectedWallets.includes(w.id));
  }, [wallets, selectedWallets]);

  // Handle configuration changes
  const handleConfigChange = useCallback((updates: Partial<StealthConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  }, []);

  // Apply preset configuration
  const applyPreset = useCallback((preset: 'conservative' | 'moderate' | 'aggressive') => {
    const presetConfig = generateStealthConfig(preset);
    setConfig(presetConfig);
  }, [generateStealthConfig]);

  // Create stealth plan
  const createPlan = useCallback(async () => {
    try {
      if (!selectedMasterWallet) {
        throw new Error('Please select a master wallet');
      }

      if (selectedWallets.length === 0) {
        throw new Error('Please select target wallets');
      }

      const masterWallet = availableMasterWallets.find(w => w.id === selectedMasterWallet);
      if (!masterWallet) {
        throw new Error('Selected master wallet not found');
      }

      const plan = await createStealthPlan(
        selectedMasterWallet,
        selectedWallets,
        totalAmount,
        config
      );

      const validation = validatePlan(plan);
      setValidationResult(validation);
      setCurrentPlan(plan);
      setActiveTab('preview');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create plan';
      onError?.(errorMessage);
    }
  }, [
    selectedMasterWallet,
    selectedWallets,
    totalAmount,
    config,
    availableMasterWallets,
    createStealthPlan,
    validatePlan,
    onError
  ]);

  // Execute stealth operation
  const executeOperation = useCallback(async () => {
    if (!currentPlan || !passphrase) {
      return;
    }

    try {
      setShowConfirmDialog(false);
      setActiveTab('monitor');

      await executeStealthOperationWithPlan(currentPlan, passphrase);
      onOperationComplete?.(currentOperation);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Operation failed';
      onError?.(errorMessage);
    } finally {
      setPassphrase(''); // Clear passphrase
    }
  }, [currentPlan, passphrase, executeStealthOperationWithPlan, currentOperation, onOperationComplete, onError]);

  // Format time duration
  const formatDuration = useCallback((seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }, []);

  // Get operation status
  const operationStatus = getCurrentOperationStatus();

  // Session check
  if (!isUnlocked) {
    return (
      <div className="stealth-funding-locked">
        <div className="lock-container">
          <div className="lock-icon">
            <i className="fas fa-shield-alt"></i>
          </div>
          <h3>Session Required</h3>
          <p>Please unlock your session to access stealth funding operations.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="stealth-funding">
      {/* Header */}
      <div className="stealth-funding-header">
        <h3>
          <i className="fas fa-user-secret"></i>
          Stealth Wallet Funding
        </h3>
        <div className="header-actions">
          <button
            className="refresh-btn"
            onClick={refreshMasterWalletBalances}
            disabled={isExecuting}
          >
            <i className="fas fa-sync-alt"></i>
            Refresh
          </button>
          {storeError && (
            <button className="clear-error-btn" onClick={clearError}>
              <i className="fas fa-times"></i>
              Clear Error
            </button>
          )}
        </div>
      </div>

      {/* Error Display */}
      {storeError && (
        <div className="error-banner">
          <i className="fas fa-exclamation-triangle"></i>
          <span>{storeError}</span>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="stealth-tabs">
        <button
          className={`tab-button ${activeTab === 'configure' ? 'active' : ''}`}
          onClick={() => setActiveTab('configure')}
          disabled={isExecuting}
        >
          <i className="fas fa-cogs"></i>
          Configure
        </button>
        <button
          className={`tab-button ${activeTab === 'preview' ? 'active' : ''}`}
          onClick={() => setActiveTab('preview')}
          disabled={!currentPlan || isExecuting}
        >
          <i className="fas fa-eye"></i>
          Preview
        </button>
        <button
          className={`tab-button ${activeTab === 'execute' ? 'active' : ''}`}
          onClick={() => setActiveTab('execute')}
          disabled={!currentPlan || !validationResult?.isValid || isExecuting}
        >
          <i className="fas fa-play"></i>
          Execute
        </button>
        <button
          className={`tab-button ${activeTab === 'monitor' ? 'active' : ''}`}
          onClick={() => setActiveTab('monitor')}
          disabled={!currentOperation}
        >
          <i className="fas fa-chart-line"></i>
          Monitor
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {/* Configuration Tab */}
        {activeTab === 'configure' && (
          <div className="configure-tab">
            {/* Quick Stats */}
            <div className="quick-stats">
              <div className="stat">
                <label>Selected Wallets</label>
                <span className="stat-value">{selectedWallets.length}</span>
              </div>
              <div className="stat">
                <label>Total Amount</label>
                <span className="stat-value">{totalAmount} BNB</span>
              </div>
              <div className="stat">
                <label>Per Wallet</label>
                <span className="stat-value">
                  {config.useFixedAmount 
                    ? `${config.fixedAmount} BNB` 
                    : `${config.minAmount}-${config.maxAmount} BNB`
                  }
                </span>
              </div>
            </div>

            {/* Master Wallet Selection */}
            <div className="config-section">
              <h4>Master Wallet</h4>
              <div className="master-wallet-selection">
                <select
                  value={selectedMasterWallet}
                  onChange={(e) => setSelectedMasterWallet(e.target.value)}
                  className="master-wallet-select"
                >
                  <option value="">Select master wallet...</option>
                  {availableMasterWallets.map(wallet => (
                    <option key={wallet.id} value={wallet.id}>
                      {wallet.alias} - {wallet.balance.toFixed(4)} BNB
                    </option>
                  ))}
                </select>
                {selectedMasterWallet && (
                  <div className="master-wallet-info">
                    {(() => {
                      const wallet = availableMasterWallets.find(w => w.id === selectedMasterWallet);
                      return wallet ? (
                        <span className={wallet.balance >= totalAmount ? 'sufficient' : 'insufficient'}>
                          Balance: {wallet.balance.toFixed(4)} BNB
                          {wallet.balance < totalAmount && (
                            <span className="warning"> (Insufficient)</span>
                          )}
                        </span>
                      ) : null;
                    })()}
                  </div>
                )}
              </div>
            </div>

            {/* Amount Configuration */}
            <div className="config-section">
              <h4>Distribution Amount</h4>
              <div className="amount-config">
                <div className="input-group">
                  <label>Total Amount (BNB)</label>
                  <input
                    type="number"
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(parseFloat(e.target.value) || 0)}
                    min="0"
                    step="0.001"
                    className="amount-input"
                  />
                </div>
                
                <div className="amount-mode">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={config.useFixedAmount}
                      onChange={(e) => handleConfigChange({ useFixedAmount: e.target.checked })}
                    />
                    Use fixed amount per wallet
                  </label>
                </div>

                {config.useFixedAmount ? (
                  <div className="input-group">
                    <label>Fixed Amount per Wallet (BNB)</label>
                    <input
                      type="number"
                      value={config.fixedAmount || 0}
                      onChange={(e) => handleConfigChange({ fixedAmount: parseFloat(e.target.value) || 0 })}
                      min="0"
                      step="0.001"
                      className="amount-input"
                    />
                  </div>
                ) : (
                  <div className="amount-range">
                    <div className="input-group">
                      <label>Min Amount (BNB)</label>
                      <input
                        type="number"
                        value={config.minAmount}
                        onChange={(e) => handleConfigChange({ minAmount: parseFloat(e.target.value) || 0 })}
                        min="0"
                        step="0.001"
                        className="amount-input"
                      />
                    </div>
                    <div className="input-group">
                      <label>Max Amount (BNB)</label>
                      <input
                        type="number"
                        value={config.maxAmount}
                        onChange={(e) => handleConfigChange({ maxAmount: parseFloat(e.target.value) || 0 })}
                        min="0"
                        step="0.001"
                        className="amount-input"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Stealth Configuration Presets */}
            <div className="config-section">
              <h4>Stealth Presets</h4>
              <div className="preset-buttons">
                <button
                  className="preset-btn conservative"
                  onClick={() => applyPreset('conservative')}
                >
                  <i className="fas fa-shield-alt"></i>
                  Conservative
                  <small>High stealth, slower execution</small>
                </button>
                <button
                  className="preset-btn moderate"
                  onClick={() => applyPreset('moderate')}
                >
                  <i className="fas fa-balance-scale"></i>
                  Moderate
                  <small>Balanced stealth and speed</small>
                </button>
                <button
                  className="preset-btn aggressive"
                  onClick={() => applyPreset('aggressive')}
                >
                  <i className="fas fa-bolt"></i>
                  Aggressive
                  <small>Fast execution, lower stealth</small>
                </button>
              </div>
            </div>

            {/* Timing Configuration */}
            <div className="config-section">
              <h4>Timing Configuration</h4>
              <div className="timing-config">
                <div className="timing-pattern">
                  <label>Pattern</label>
                  <select
                    value={config.pattern}
                    onChange={(e) => handleConfigChange({ pattern: e.target.value as StealthPattern })}
                    className="pattern-select"
                  >
                    <option value="natural">Natural (Human-like)</option>
                    <option value="random">Random</option>
                    <option value="uniform">Uniform</option>
                    <option value="burst">Burst</option>
                    <option value="gradient">Gradient</option>
                  </select>
                </div>
                
                <div className="delay-range">
                  <div className="input-group">
                    <label>Min Delay (seconds)</label>
                    <input
                      type="number"
                      value={config.minDelay}
                      onChange={(e) => handleConfigChange({ minDelay: parseInt(e.target.value) || 1 })}
                      min="1"
                      className="delay-input"
                    />
                  </div>
                  <div className="input-group">
                    <label>Max Delay (seconds)</label>
                    <input
                      type="number"
                      value={config.maxDelay}
                      onChange={(e) => handleConfigChange({ maxDelay: parseInt(e.target.value) || 1 })}
                      min="1"
                      className="delay-input"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Advanced Settings */}
            <div className="config-section">
              <div className="advanced-toggle">
                <button
                  className="toggle-btn"
                  onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                >
                  <i className={`fas ${showAdvancedSettings ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
                  Advanced Settings
                </button>
              </div>

              {showAdvancedSettings && (
                <div className="advanced-settings">
                  <div className="setting-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={config.randomizeOrder}
                        onChange={(e) => handleConfigChange({ randomizeOrder: e.target.checked })}
                      />
                      Randomize wallet order
                    </label>
                  </div>

                  <div className="setting-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={config.simulateHumanBehavior}
                        onChange={(e) => handleConfigChange({ simulateHumanBehavior: e.target.checked })}
                      />
                      Simulate human behavior
                    </label>
                  </div>

                  <div className="setting-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={config.varyTransactionSizes}
                        onChange={(e) => handleConfigChange({ varyTransactionSizes: e.target.checked })}
                      />
                      Vary transaction amounts
                    </label>
                  </div>

                  <div className="setting-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={config.useVariableGas}
                        onChange={(e) => handleConfigChange({ useVariableGas: e.target.checked })}
                      />
                      Use variable gas prices
                    </label>
                  </div>

                  <div className="batch-config">
                    <div className="input-group">
                      <label>Batch Size (0 = no batching)</label>
                      <input
                        type="number"
                        value={config.batchSize}
                        onChange={(e) => handleConfigChange({ batchSize: parseInt(e.target.value) || 0 })}
                        min="0"
                        className="batch-input"
                      />
                    </div>
                    <div className="input-group">
                      <label>Batch Delay (seconds)</label>
                      <input
                        type="number"
                        value={config.batchDelay}
                        onChange={(e) => handleConfigChange({ batchDelay: parseInt(e.target.value) || 0 })}
                        min="0"
                        className="batch-input"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Create Plan Button */}
            <div className="config-actions">
              <button
                className="create-plan-btn"
                onClick={createPlan}
                disabled={!selectedMasterWallet || selectedWallets.length === 0 || totalAmount <= 0}
              >
                <i className="fas fa-magic"></i>
                Create Stealth Plan
              </button>
            </div>
          </div>
        )}

        {/* Preview Tab */}
        {activeTab === 'preview' && currentPlan && validationResult && (
          <div className="preview-tab">
            {/* Plan Summary */}
            <div className="plan-summary">
              <h4>Operation Summary</h4>
              <div className="summary-grid">
                <div className="summary-item">
                  <label>Target Wallets</label>
                  <span className="summary-value">{currentPlan.transactionCount}</span>
                </div>
                <div className="summary-item">
                  <label>Total Distribution</label>
                  <span className="summary-value">{currentPlan.totalAmount} BNB</span>
                </div>
                <div className="summary-item">
                  <label>Estimated Duration</label>
                  <span className="summary-value">{formatDuration(currentPlan.estimatedDuration)}</span>
                </div>
                <div className="summary-item">
                  <label>Pattern</label>
                  <span className="summary-value">{currentPlan.config.pattern}</span>
                </div>
              </div>
            </div>

            {/* Validation Results */}
            <div className="validation-results">
              <h4>Validation Results</h4>
              <div className={`validation-status ${validationResult.isValid ? 'valid' : 'invalid'}`}>
                <i className={`fas ${validationResult.isValid ? 'fa-check-circle' : 'fa-exclamation-triangle'}`}></i>
                {validationResult.isValid ? 'Plan is valid and ready for execution' : 'Plan has validation issues'}
              </div>

              {validationResult.errors.length > 0 && (
                <div className="validation-errors">
                  <h5>Errors:</h5>
                  <ul>
                    {validationResult.errors.map((error: string, index: number) => (
                      <li key={index} className="error-item">
                        <i className="fas fa-times-circle"></i>
                        {error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {validationResult.warnings.length > 0 && (
                <div className="validation-warnings">
                  <h5>Warnings:</h5>
                  <ul>
                    {validationResult.warnings.map((warning: string, index: number) => (
                      <li key={index} className="warning-item">
                        <i className="fas fa-exclamation-triangle"></i>
                        {warning}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {validationResult.recommendations.length > 0 && (
                <div className="validation-recommendations">
                  <h5>Recommendations:</h5>
                  <ul>
                    {validationResult.recommendations.map((recommendation: string, index: number) => (
                      <li key={index} className="recommendation-item">
                        <i className="fas fa-lightbulb"></i>
                        {recommendation}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Transaction Preview */}
            <div className="transaction-preview">
              <h4>Transaction Preview (First 5)</h4>
              <div className="transaction-list">
                {currentPlan.transactions.slice(0, 5).map((tx, index) => (
                  <div key={tx.id} className="transaction-item">
                    <div className="tx-index">#{index + 1}</div>
                    <div className="tx-address">{tx.walletAddress}</div>
                    <div className="tx-amount">{tx.actualAmount.toFixed(4)} BNB</div>
                    <div className="tx-delay">+{tx.executionDelay.toFixed(1)}s</div>
                  </div>
                ))}
                {currentPlan.transactions.length > 5 && (
                  <div className="more-transactions">
                    ... and {currentPlan.transactions.length - 5} more transactions
                  </div>
                )}
              </div>
            </div>

            {/* Preview Actions */}
            <div className="preview-actions">
              <button
                className="back-btn"
                onClick={() => setActiveTab('configure')}
              >
                <i className="fas fa-arrow-left"></i>
                Back to Configure
              </button>
              <button
                className="proceed-btn"
                onClick={() => setActiveTab('execute')}
                disabled={!validationResult.isValid}
              >
                <i className="fas fa-arrow-right"></i>
                Proceed to Execute
              </button>
            </div>
          </div>
        )}

        {/* Execute Tab */}
        {activeTab === 'execute' && currentPlan && (
          <div className="execute-tab">
            {/* Security Warning */}
            <div className="security-warning">
              <i className="fas fa-shield-alt"></i>
              <div className="warning-content">
                <h4>Security Confirmation Required</h4>
                <p>
                  You are about to execute a stealth funding operation that will distribute{' '}
                  <strong>{currentPlan.totalAmount} BNB</strong> across{' '}
                  <strong>{currentPlan.transactionCount} wallets</strong>.
                </p>
                <p>This operation cannot be undone once started.</p>
              </div>
            </div>

            {/* Passphrase Input */}
            <div className="passphrase-section">
              <h4>Enter Passphrase</h4>
              <p>Your passphrase is required to decrypt the master wallet private key.</p>
              <input
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Enter your passphrase..."
                className="passphrase-input"
                autoComplete="off"
              />
            </div>

            {/* Final Summary */}
            <div className="final-summary">
              <h4>Final Confirmation</h4>
              <div className="summary-items">
                <div className="summary-row">
                  <span>Master Wallet:</span>
                  <span>{currentPlan.masterWallet.address}</span>
                </div>
                <div className="summary-row">
                  <span>Total Amount:</span>
                  <span>{currentPlan.totalAmount} BNB</span>
                </div>
                <div className="summary-row">
                  <span>Target Wallets:</span>
                  <span>{currentPlan.transactionCount}</span>
                </div>
                <div className="summary-row">
                  <span>Estimated Time:</span>
                  <span>{formatDuration(currentPlan.estimatedDuration)}</span>
                </div>
                <div className="summary-row">
                  <span>Stealth Pattern:</span>
                  <span>{currentPlan.config.pattern}</span>
                </div>
              </div>
            </div>

            {/* Execute Actions */}
            <div className="execute-actions">
              <button
                className="cancel-btn"
                onClick={() => setActiveTab('preview')}
              >
                <i className="fas fa-arrow-left"></i>
                Back to Preview
              </button>
              <button
                className="execute-btn"
                onClick={() => setShowConfirmDialog(true)}
                disabled={!passphrase || passphrase.length < 8}
              >
                <i className="fas fa-rocket"></i>
                Execute Stealth Operation
              </button>
            </div>
          </div>
        )}

        {/* Monitor Tab */}
        {activeTab === 'monitor' && currentOperation && (
          <div className="monitor-tab">
            {/* Operation Status */}
            <div className="operation-status">
              <div className="status-header">
                <h4>Operation Status</h4>
                <div className={`status-badge ${currentOperation.status}`}>
                  {currentOperation.status === 'executing' && <i className="fas fa-spinner fa-spin"></i>}
                  {currentOperation.status === 'completed' && <i className="fas fa-check-circle"></i>}
                  {currentOperation.status === 'failed' && <i className="fas fa-exclamation-circle"></i>}
                  {currentOperation.status === 'paused' && <i className="fas fa-pause-circle"></i>}
                  {currentOperation.status}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="progress-section">
                <div className="progress-bar">
                  <div 
                    className="progress-fill"
                    style={{ width: `${currentOperation.progress.percentage}%` }}
                  ></div>
                </div>
                <div className="progress-text">
                  {currentOperation.progress.completed} / {currentOperation.progress.total} transactions
                  ({currentOperation.progress.percentage.toFixed(1)}%)
                </div>
              </div>

              {/* Time Estimates */}
              <div className="time-estimates">
                <div className="time-item">
                  <label>Elapsed Time:</label>
                  <span className="time-value">
                    {currentOperation.startedAt && 
                      formatDuration((Date.now() - new Date(currentOperation.startedAt).getTime()) / 1000)
                    }
                  </span>
                </div>
                <div className="time-item">
                  <label>Estimated Remaining:</label>
                  <span className="time-value">{formatDuration(currentOperation.progress.estimatedTimeRemaining)}</span>
                </div>
              </div>
            </div>

            {/* Statistics */}
            <div className="operation-statistics">
              <h4>Statistics</h4>
              <div className="stats-grid">
                <div className="stat-item">
                  <label>Total Sent</label>
                  <span className="stat-value">{currentOperation.statistics.totalSent.toFixed(4)} BNB</span>
                </div>
                <div className="stat-item">
                  <label>Successful</label>
                  <span className="stat-value">{currentOperation.statistics.successfulTransactions}</span>
                </div>
                <div className="stat-item">
                  <label>Failed</label>
                  <span className="stat-value">{currentOperation.statistics.failedTransactions}</span>
                </div>
                <div className="stat-item">
                  <label>Gas Used</label>
                  <span className="stat-value">{currentOperation.statistics.gasUsed}</span>
                </div>
              </div>
            </div>

            {/* Recent Events */}
            <div className="recent-events">
              <h4>Recent Events</h4>
              <div className="events-list">
                {recentEvents.slice(0, 10).map((event, index) => (
                  <div key={index} className={`event-item ${event.type}`}>
                    <div className="event-time">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </div>
                    <div className="event-message">
                      {event.type === 'transaction_confirmed' && (
                        <>
                          <i className="fas fa-check text-success"></i>
                          Transaction confirmed
                        </>
                      )}
                      {event.type === 'transaction_failed' && (
                        <>
                          <i className="fas fa-times text-error"></i>
                          Transaction failed: {event.error}
                        </>
                      )}
                      {event.type === 'batch_completed' && (
                        <>
                          <i className="fas fa-layer-group"></i>
                          Batch {event.batchNumber} completed
                        </>
                      )}
                      {event.type === 'operation_started' && (
                        <>
                          <i className="fas fa-play"></i>
                          Operation started
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Control Actions */}
            {operationStatus.isRunning && (
              <div className="control-actions">
                {!isPaused ? (
                  <button
                    className="pause-btn"
                    onClick={() => pauseOperation(currentOperation.id)}
                  >
                    <i className="fas fa-pause"></i>
                    Pause Operation
                  </button>
                ) : (
                  <button
                    className="resume-btn"
                    onClick={() => resumeOperation(currentOperation.id)}
                  >
                    <i className="fas fa-play"></i>
                    Resume Operation
                  </button>
                )}
                <button
                  className="cancel-btn"
                  onClick={() => cancelOperation(currentOperation.id)}
                >
                  <i className="fas fa-stop"></i>
                  Cancel Operation
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="confirmation-overlay">
          <div className="confirmation-dialog">
            <div className="dialog-header">
              <h3>
                <i className="fas fa-exclamation-triangle"></i>
                Confirm Stealth Operation
              </h3>
            </div>
            <div className="dialog-content">
              <p>
                Are you sure you want to execute this stealth funding operation?
              </p>
              <div className="confirmation-details">
                <div>• {currentPlan?.transactionCount} wallets will be funded</div>
                <div>• {currentPlan?.totalAmount} BNB will be distributed</div>
                <div>• Operation will take approximately {currentPlan && formatDuration(currentPlan.estimatedDuration)}</div>
                <div>• This action cannot be undone</div>
              </div>
            </div>
            <div className="dialog-actions">
              <button
                className="cancel-btn"
                onClick={() => setShowConfirmDialog(false)}
              >
                Cancel
              </button>
              <button
                className="confirm-btn"
                onClick={executeOperation}
              >
                <i className="fas fa-rocket"></i>
                Execute Operation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};