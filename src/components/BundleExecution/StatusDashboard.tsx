/**
 * Status Dashboard Component
 * Real-time progress monitoring and statistics display for bundle execution
 */

import React, { useEffect, useState } from 'react';
import type { ExecutionStatus, ExecutionProgress, ExecutionStatistics } from '../../store/execution';
import type { GasTracker } from '../../store/transactions';
import type { ExecutionPlan } from '../../services/execution-engine';
import { gasManager } from '../../services/gas-manager';
import { stealthManager } from '../../services/stealth-manager';
import { useSessionStore } from '../../store/session';
import { useConfigStore } from '../../store/config';
import { useWalletStore } from '../../store/wallets';

interface StatusDashboardProps {
  status: ExecutionStatus;
  progress: ExecutionProgress;
  statistics: ExecutionStatistics;
  gasTracker: GasTracker;
  executionPlan: ExecutionPlan | null;
}

export const StatusDashboard: React.FC<StatusDashboardProps> = ({
  status,
  progress,
  statistics,
  gasTracker,
  executionPlan,
}) => {
  // Session store selectors
  const isUnlocked = useSessionStore(state => state.isUnlocked);
  const sessionId = useSessionStore(state => state.sessionId);
  const isSessionValid = useSessionStore(state => state.isSessionValid);
  const expiresAt = useSessionStore(state => state.expiresAt);
  const getTimeUntilExpiry = useSessionStore(state => state.getTimeUntilExpiry);
  
  // Config store selectors
  const isValidConfig = useConfigStore(state => state.isValidConfig);
  const validationErrors = useConfigStore(state => state.validationErrors);
  const currentConfig = useConfigStore(state => state.currentConfig);
  const validateConfig = useConfigStore(state => state.validateConfig);
  
  // Wallet store selectors
  const selectedWallets = useWalletStore(state => state.selectedWallets);
  
  const [networkConditions, setNetworkConditions] = useState(gasManager.getNetworkConditions());
  const [stealthMetrics, setStealthMetrics] = useState(stealthManager.analyzeStealthEffectiveness());
  const [realTimeData, setRealTimeData] = useState({
    currentTime: new Date(),
    executionDuration: 0,
    estimatedCompletion: null as Date | null,
    transactionsPerMinute: 0,
  });

  // Update real-time data
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setRealTimeData(prev => {
        const duration = progress.startTime ? now.getTime() - new Date(progress.startTime).getTime() : 0;
        const completedTransactions = statistics.successfulTransactions + statistics.failedTransactions;
        const transactionsPerMinute = duration > 0 ? (completedTransactions / (duration / 60000)) : 0;
        
        let estimatedCompletion: Date | null = null;
        if (progress.totalTransactions && progress.overallProgress && progress.overallProgress > 0) {
          const remainingProgress = 100 - progress.overallProgress;
          const estimatedRemainingTime = (duration / progress.overallProgress) * remainingProgress;
          estimatedCompletion = new Date(now.getTime() + estimatedRemainingTime);
        }
        
        return {
          currentTime: now,
          executionDuration: duration,
          estimatedCompletion,
          transactionsPerMinute,
        };
      });
      
      // Update network conditions
      setNetworkConditions(gasManager.getNetworkConditions());
      setStealthMetrics(stealthManager.analyzeStealthEffectiveness());
    }, 2000);

    return () => clearInterval(interval);
  }, [progress, statistics]);

  const formatDuration = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getProgressColor = (percentage: number): string => {
    if (percentage >= 90) return '#4caf50'; // Green
    if (percentage >= 70) return '#8bc34a'; // Light green
    if (percentage >= 50) return '#ffc107'; // Yellow
    if (percentage >= 30) return '#ff9800'; // Orange
    return '#f44336'; // Red
  };

  const getCongestionColor = (congestion: string): string => {
    switch (congestion) {
      case 'low': return '#4caf50';
      case 'medium': return '#ff9800';
      case 'high': return '#f44336';
      default: return '#9e9e9e';
    }
  };

  const getSecurityStatus = (): { status: 'Unlocked' | 'Locked'; reason: string; color: string } => {
    if (!sessionId) {
      return { status: 'Locked', reason: 'No session created', color: '#f44336' };
    }
    
    if (!isUnlocked) {
      return { status: 'Locked', reason: 'Not authenticated', color: '#f44336' };
    }
    
    if (!isSessionValid()) {
      return { status: 'Locked', reason: 'Session expired', color: '#f44336' };
    }
    
    return { status: 'Unlocked', reason: 'Authenticated and active', color: '#4caf50' };
  };

  const getTimeUntilExpiryText = (): string => {
    if (!expiresAt || !isUnlocked) return 'N/A';
    
    const timeLeft = getTimeUntilExpiry();
    if (timeLeft <= 0) return 'Expired';
    
    const minutes = Math.floor(timeLeft / 60000);
    const seconds = Math.floor((timeLeft % 60000) / 1000);
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const getConfigStatus = (): { status: 'Valid' | 'Invalid'; reason: string; color: string; errors: string[] } => {
    // Check wallet selection
    if (selectedWallets.length === 0) {
      return { 
        status: 'Invalid', 
        reason: 'No wallets selected', 
        color: '#f44336',
        errors: ['At least one wallet must be selected for execution']
      };
    }

    // Check basic config presence
    if (!currentConfig) {
      return { 
        status: 'Invalid', 
        reason: 'No configuration found', 
        color: '#f44336',
        errors: ['Bundle configuration is required']
      };
    }

    // Use store validation state
    if (isValidConfig) {
      return { 
        status: 'Valid', 
        reason: 'Configuration is complete and valid', 
        color: '#4caf50',
        errors: []
      };
    }

    // Show specific validation errors if available
    if (validationErrors.length > 0) {
      const primaryError = validationErrors[0];
      return { 
        status: 'Invalid', 
        reason: primaryError, 
        color: '#f44336',
        errors: validationErrors
      };
    }

    // Fallback to manual validation
    const errors = validateConfig();
    if (errors.length === 0) {
      return { 
        status: 'Valid', 
        reason: 'Configuration is complete and valid', 
        color: '#4caf50',
        errors: []
      };
    }

    return { 
      status: 'Invalid', 
      reason: errors[0] || 'Configuration incomplete', 
      color: '#f44336',
      errors
    };
  };

  return (
    <div className="status-dashboard">
      {/* Overview Cards */}
      <div className="overview-cards">
        <div className="overview-card progress-card">
          <div className="card-header">
            <h4>Overall Progress</h4>
            <span className="card-value">{progress.overallProgress?.toFixed(1) || 0}%</span>
          </div>
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ 
                width: `${progress.overallProgress || 0}%`,
                backgroundColor: getProgressColor(progress.overallProgress || 0)
              }}
            ></div>
          </div>
          <div className="card-details">
            <span>{progress.completedTransactions || 0} of {progress.totalTransactions || 0} transactions</span>
          </div>
        </div>

        <div className="overview-card stats-card">
          <div className="card-header">
            <h4>Success Rate</h4>
            <span className="card-value">{statistics.successRate?.toFixed(1) || 0}%</span>
          </div>
          <div className="stats-breakdown">
            <div className="stat-item success">
              <span className="stat-label">Successful</span>
              <span className="stat-value">{statistics.successfulTransactions || 0}</span>
            </div>
            <div className="stat-item failed">
              <span className="stat-label">Failed</span>
              <span className="stat-value">{statistics.failedTransactions || 0}</span>
            </div>
            <div className="stat-item pending">
              <span className="stat-label">Pending</span>
              <span className="stat-value">{statistics.pendingTransactions || 0}</span>
            </div>
          </div>
        </div>

        <div className="overview-card timing-card">
          <div className="card-header">
            <h4>Timing</h4>
            <span className="card-value">{formatDuration(realTimeData.executionDuration)}</span>
          </div>
          <div className="timing-details">
            <div className="timing-item">
              <span className="timing-label">Started:</span>
              <span className="timing-value">
                {progress.startTime ? formatTime(new Date(progress.startTime)) : 'Not started'}
              </span>
            </div>
            <div className="timing-item">
              <span className="timing-label">ETA:</span>
              <span className="timing-value">
                {realTimeData.estimatedCompletion ? formatTime(realTimeData.estimatedCompletion) : 'Calculating...'}
              </span>
            </div>
          </div>
        </div>

        <div className="overview-card rate-card">
          <div className="card-header">
            <h4>Transaction Rate</h4>
            <span className="card-value">{realTimeData.transactionsPerMinute.toFixed(1)}/min</span>
          </div>
          <div className="rate-details">
            <div className="rate-item">
              <span className="rate-label">Current Batch:</span>
              <span className="rate-value">{progress.currentBatch || 0}/{progress.totalBatches || 0}</span>
            </div>
            <div className="rate-item">
              <span className="rate-label">Phase:</span>
              <span className="rate-value">{progress.currentPhase || 'idle'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Configuration Status */}
      <div className="config-status">
        <h3>Configuration Status</h3>
        <div className="config-grid">
          <div className="config-item">
            <div className="config-header">
              <span className="config-label">Config</span>
              <span 
                className="config-value"
                style={{ 
                  color: getConfigStatus().color,
                  fontWeight: 'bold'
                }}
              >
                {getConfigStatus().status === 'Valid' ? '✅' : '❌'} {getConfigStatus().status}
              </span>
            </div>
            <div className="config-details">
              <span>{getConfigStatus().reason}</span>
              {getConfigStatus().errors.length > 1 && (
                <span> • {getConfigStatus().errors.length - 1} more issue{getConfigStatus().errors.length > 2 ? 's' : ''}</span>
              )}
            </div>
          </div>

          <div className="config-item">
            <div className="config-header">
              <span className="config-label">Wallets Selected</span>
              <span className="config-value">
                {selectedWallets.length}
              </span>
            </div>
            <div className="config-details">
              <span>{selectedWallets.length > 0 ? 'Ready for execution' : 'No wallets selected'}</span>
            </div>
          </div>

          <div className="config-item">
            <div className="config-header">
              <span className="config-label">Token Config</span>
              <span className="config-value">
                {currentConfig?.token?.address ? '✅' : '❌'}
              </span>
            </div>
            <div className="config-details">
              <span>
                {currentConfig?.token?.address 
                  ? `${currentConfig.token.symbol || 'Token'} configured`
                  : 'Token not configured'
                }
              </span>
            </div>
          </div>

          <div className="config-item">
            <div className="config-header">
              <span className="config-label">Purchase Amount</span>
              <span className="config-value">
                {currentConfig?.purchaseAmount?.totalBnb ? `${currentConfig.purchaseAmount.totalBnb} BNB` : '❌'}
              </span>
            </div>
            <div className="config-details">
              <span>
                {currentConfig?.purchaseAmount?.totalBnb 
                  ? 'Amount configured'
                  : 'Amount not set'
                }
              </span>
            </div>
          </div>

          {getConfigStatus().errors.length > 0 && (
            <div className="config-item validation-errors">
              <div className="config-header">
                <span className="config-label">Validation Issues</span>
                <span className="config-value error-count">
                  {getConfigStatus().errors.length}
                </span>
              </div>
              <div className="config-details">
                <div className="error-list">
                  {getConfigStatus().errors.slice(0, 3).map((error, index) => (
                    <div key={index} className="error-item">• {error}</div>
                  ))}
                  {getConfigStatus().errors.length > 3 && (
                    <div className="error-item">• And {getConfigStatus().errors.length - 3} more...</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Network Status */}
      <div className="network-status">
        <h3>Network Status</h3>
        <div className="network-grid">
          <div className="network-item">
            <div className="network-header">
              <span className="network-label">Network Congestion</span>
              <span 
                className="network-value"
                style={{ color: getCongestionColor(networkConditions.congestion) }}
              >
                {networkConditions.congestion.toUpperCase()}
              </span>
            </div>
            <div className="network-details">
              <span>Block Time: ~{(networkConditions.averageBlockTime / 1000).toFixed(1)}s</span>
            </div>
          </div>

          <div className="network-item">
            <div className="network-header">
              <span className="network-label">Gas Prices</span>
              <span className="network-value">
                {(parseInt(networkConditions.gasPrice.standard) / 1e9).toFixed(1)} gwei
              </span>
            </div>
            <div className="gas-price-range">
              <div className="gas-item">
                <span>Slow: {(parseInt(networkConditions.gasPrice.slow) / 1e9).toFixed(1)}</span>
              </div>
              <div className="gas-item">
                <span>Fast: {(parseInt(networkConditions.gasPrice.fast) / 1e9).toFixed(1)}</span>
              </div>
              <div className="gas-item">
                <span>Instant: {(parseInt(networkConditions.gasPrice.instant) / 1e9).toFixed(1)}</span>
              </div>
            </div>
          </div>

          <div className="network-item">
            <div className="network-header">
              <span className="network-label">Gas Usage</span>
              <span className="network-value">
                {(parseFloat(statistics.totalGasUsed || '0') / 1e18).toFixed(6)} BNB
              </span>
            </div>
            <div className="network-details">
              <span>Avg: {statistics.averageGasUsed || '0'} gas/tx</span>
            </div>
          </div>

          <div className="network-item">
            <div className="network-header">
              <span className="network-label">Confirmations</span>
              <span className="network-value">
                ~{gasTracker.estimatedConfirmationTime || 0}s
              </span>
            </div>
            <div className="network-details">
              <span>Network recommended</span>
            </div>
          </div>
        </div>
      </div>

      {/* Execution Plan Status */}
      {executionPlan && (
        <div className="execution-plan-status">
          <h3>Execution Plan</h3>
          <div className="plan-grid">
            <div className="plan-item">
              <span className="plan-label">Plan ID:</span>
              <span className="plan-value">{executionPlan.id}</span>
            </div>
            <div className="plan-item">
              <span className="plan-label">Total Transactions:</span>
              <span className="plan-value">{executionPlan.totalTransactions}</span>
            </div>
            <div className="plan-item">
              <span className="plan-label">Wallets:</span>
              <span className="plan-value">{executionPlan.walletIds.length}</span>
            </div>
            <div className="plan-item">
              <span className="plan-label">Total Value:</span>
              <span className="plan-value">{executionPlan.totalValue} BNB</span>
            </div>
            <div className="plan-item">
              <span className="plan-label">Estimated Duration:</span>
              <span className="plan-value">{Math.ceil(executionPlan.estimatedDuration / 60000)} minutes</span>
            </div>
            <div className="plan-item">
              <span className="plan-label">Est. Gas Cost:</span>
              <span className="plan-value">
                {(parseFloat(executionPlan.estimatedGasCost) / 1e18).toFixed(6)} BNB
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Stealth & Security Status */}
      <div className="stealth-status">
        <h3>Stealth & Security</h3>
        <div className="stealth-grid">
          <div className="stealth-item">
            <div className="stealth-header">
              <span className="stealth-label">Security</span>
              <span 
                className="stealth-value" 
                style={{ 
                  color: getSecurityStatus().color,
                  fontWeight: 'bold'
                }}
              >
                {getSecurityStatus().status === 'Unlocked' ? '🔓' : '🔒'} {getSecurityStatus().status}
              </span>
            </div>
            <div className="stealth-details">
              <span>{getSecurityStatus().reason}</span>
              {isUnlocked && expiresAt && (
                <span> • Expires in {getTimeUntilExpiryText()}</span>
              )}
            </div>
          </div>

          <div className="stealth-item">
            <div className="stealth-header">
              <span className="stealth-label">Detection Risk</span>
              <span className={`stealth-value risk-${stealthMetrics.detectionRisk}`}>
                {stealthMetrics.detectionRisk.toUpperCase()}
              </span>
            </div>
            <div className="stealth-details">
              <span>Avg Delay: {stealthMetrics.averageDelay.toFixed(0)}ms</span>
            </div>
          </div>

          <div className="stealth-item">
            <div className="stealth-header">
              <span className="stealth-label">MEV Protection</span>
              <span className="stealth-value">
                {stealthMetrics.successRate.toFixed(1)}%
              </span>
            </div>
            <div className="stealth-details">
              <span>Evaded: {stealthMetrics.mevEvaded}</span>
            </div>
          </div>

          <div className="stealth-item">
            <div className="stealth-header">
              <span className="stealth-label">Timing Variation</span>
              <span className="stealth-value">
                {stealthMetrics.delayVariation.toFixed(0)}ms
              </span>
            </div>
            <div className="stealth-details">
              <span>Randomization active</span>
            </div>
          </div>

          <div className="stealth-item">
            <div className="stealth-header">
              <span className="stealth-label">Frontrun Attempts</span>
              <span className="stealth-value">
                {stealthMetrics.frontrunningAttempts}
              </span>
            </div>
            <div className="stealth-details">
              <span>Detected & blocked</span>
            </div>
          </div>
        </div>
      </div>

      {/* Current Phase Indicator */}
      <div className="current-phase">
        <h3>Current Phase</h3>
        <div className="phase-indicator">
          <div className="phase-steps">
            <div className={`phase-step ${['idle', 'preparing', 'executing', 'paused', 'stopping', 'completed', 'failed', 'aborted'].indexOf(status) >= 0 ? 'completed' : ''}`}>
              <div className="step-number">1</div>
              <div className="step-label">Initialize</div>
            </div>
            <div className={`phase-step ${['preparing', 'executing', 'paused', 'stopping', 'completed', 'failed', 'aborted'].indexOf(status) >= 1 ? 'completed' : ''} ${status === 'preparing' ? 'active' : ''}`}>
              <div className="step-number">2</div>
              <div className="step-label">Prepare</div>
            </div>
            <div className={`phase-step ${['executing', 'paused', 'stopping', 'completed'].indexOf(status) >= 0 ? 'completed' : ''} ${status === 'executing' ? 'active' : ''}`}>
              <div className="step-number">3</div>
              <div className="step-label">Execute</div>
            </div>
            <div className={`phase-step ${status === 'completed' ? 'completed' : ''} ${status === 'stopping' ? 'active' : ''}`}>
              <div className="step-number">4</div>
              <div className="step-label">Complete</div>
            </div>
          </div>
          <div className="phase-description">
            {progress.currentPhase && (
              <span>Current: {progress.currentPhase} ({progress.phaseProgress?.toFixed(1) || 0}%)</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatusDashboard;