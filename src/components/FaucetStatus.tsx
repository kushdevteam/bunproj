/**
 * FaucetStatus Component
 * Displays comprehensive faucet status, cooldown timers, and performance metrics
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useFaucetStore } from '../store/faucet';
import { useWalletStore } from '../store/wallets';
import { useNetworkStore } from '../store/network';
import type { FaucetMetrics, PerformanceAlert } from '../services/faucet-monitor';

interface FaucetStatusProps {
  address?: string; // If provided, show status for specific wallet
  compact?: boolean; // Compact view for smaller spaces
  showMetrics?: boolean; // Show performance metrics
  showAlerts?: boolean; // Show performance alerts
  className?: string;
}

interface FaucetCardProps {
  faucetId: string;
  name: string;
  address?: string;
  cooldownInfo?: {
    isInCooldown: boolean;
    remainingSeconds: number;
    nextAvailable?: Date;
  };
  metrics?: FaucetMetrics;
  compact?: boolean;
}

const FaucetCard: React.FC<FaucetCardProps> = ({
  faucetId,
  name,
  address,
  cooldownInfo,
  metrics,
  compact = false,
}) => {
  const [countdown, setCountdown] = useState(cooldownInfo?.remainingSeconds || 0);

  // Update countdown timer
  useEffect(() => {
    if (cooldownInfo?.remainingSeconds) {
      setCountdown(cooldownInfo.remainingSeconds);
      
      const timer = setInterval(() => {
        setCountdown(prev => Math.max(0, prev - 1));
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [cooldownInfo?.remainingSeconds]);

  const formatTime = (seconds: number): string => {
    if (seconds === 0) return 'Available';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const getStatusClass = (): string => {
    if (cooldownInfo?.isInCooldown) return 'cooldown';
    if (metrics?.successRate && metrics.successRate > 0.8) return 'good';
    if (metrics?.successRate && metrics.successRate > 0.5) return 'medium';
    if (metrics?.successRate && metrics.successRate < 0.5) return 'poor';
    return 'unknown';
  };

  const getStatusIcon = (): string => {
    const status = getStatusClass();
    switch (status) {
      case 'cooldown': return '⏰';
      case 'good': return '✅';
      case 'medium': return '⚠️';
      case 'poor': return '❌';
      default: return '🔄';
    }
  };

  return (
    <div className={`faucet-card ${getStatusClass()} ${compact ? 'compact' : ''}`}>
      <div className="faucet-header">
        <span className="faucet-icon">{getStatusIcon()}</span>
        <span className="faucet-name">{name}</span>
        <span className="faucet-status">{formatTime(countdown)}</span>
      </div>

      {!compact && metrics && (
        <div className="faucet-details">
          <div className="detail-row">
            <span className="detail-label">Success Rate:</span>
            <span className="detail-value">{(metrics.successRate * 100).toFixed(1)}%</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Avg Response:</span>
            <span className="detail-value">{(metrics.averageResponseTime / 1000).toFixed(1)}s</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Requests:</span>
            <span className="detail-value">{metrics.totalRequests}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Score:</span>
            <span className="detail-value">{Math.round(metrics.overallScore)}/100</span>
          </div>
          {metrics.trend && (
            <div className="detail-row">
              <span className="detail-label">Trend:</span>
              <span className={`detail-value trend-${metrics.trend}`}>
                {metrics.trend === 'improving' && '📈'}
                {metrics.trend === 'declining' && '📉'}
                {metrics.trend === 'stable' && '➡️'}
                {metrics.trend}
              </span>
            </div>
          )}
        </div>
      )}

      {cooldownInfo?.nextAvailable && (
        <div className="next-available">
          <small>Next: {cooldownInfo.nextAvailable.toLocaleTimeString()}</small>
        </div>
      )}
    </div>
  );
};

export const FaucetStatus: React.FC<FaucetStatusProps> = ({
  address,
  compact = false,
  showMetrics = true,
  showAlerts = true,
  className = '',
}) => {
  const {
    isEnabled,
    faucetConfigs,
    faucetMetrics,
    performanceAlerts,
    getCooldownInfo,
    acknowledgeAlert,
    refreshFaucetData,
    getOptimalFaucetOrder,
    exportMetrics,
  } = useFaucetStore();

  const { wallets } = useWalletStore();
  const { isMainnet, currentNetwork } = useNetworkStore();

  const [isExpanded, setIsExpanded] = useState(!compact);
  const [showExportDialog, setShowExportDialog] = useState(false);

  // Refresh data periodically
  useEffect(() => {
    refreshFaucetData();
    const interval = setInterval(refreshFaucetData, 30000); // Every 30 seconds
    return () => clearInterval(interval);
  }, [refreshFaucetData]);

  // Get faucet status for specific address or all wallets
  const faucetStatusData = useMemo(() => {
    if (address) {
      // Status for specific wallet
      return faucetConfigs.map(faucet => ({
        faucetId: faucet.id,
        name: faucet.name,
        cooldownInfo: getCooldownInfo(address, faucet.id),
        metrics: faucetMetrics.find(m => m.faucetId === faucet.id),
      }));
    } else {
      // General status for all faucets
      return faucetConfigs.map(faucet => ({
        faucetId: faucet.id,
        name: faucet.name,
        metrics: faucetMetrics.find(m => m.faucetId === faucet.id),
      }));
    }
  }, [address, faucetConfigs, faucetMetrics, getCooldownInfo]);

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    const validMetrics = faucetMetrics.filter(m => m.totalRequests > 0);
    
    if (validMetrics.length === 0) {
      return {
        totalFaucets: faucetConfigs.length,
        activeFaucets: 0,
        averageSuccessRate: 0,
        totalRequests: 0,
        totalAmount: 0,
        averageScore: 0,
      };
    }

    const totalRequests = validMetrics.reduce((sum, m) => sum + m.totalRequests, 0);
    const totalAmount = validMetrics.reduce((sum, m) => sum + m.totalAmountDispensed, 0);
    const averageSuccessRate = validMetrics.reduce((sum, m) => sum + m.successRate, 0) / validMetrics.length;
    const averageScore = validMetrics.reduce((sum, m) => sum + m.overallScore, 0) / validMetrics.length;

    return {
      totalFaucets: faucetConfigs.length,
      activeFaucets: validMetrics.length,
      averageSuccessRate,
      totalRequests,
      totalAmount,
      averageScore,
    };
  }, [faucetConfigs, faucetMetrics]);

  // Get active alerts
  const activeAlerts = useMemo(() => {
    return performanceAlerts.filter(alert => !alert.acknowledged);
  }, [performanceAlerts]);

  // Get optimal faucet order
  const optimalOrder = useMemo(() => {
    return getOptimalFaucetOrder();
  }, [getOptimalFaucetOrder]);

  const handleExportMetrics = () => {
    const data = exportMetrics();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `faucet-metrics-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowExportDialog(false);
  };

  if (!isEnabled || isMainnet() || currentNetwork.chainId !== 97) {
    return (
      <div className={`faucet-status disabled ${className}`}>
        <div className="disabled-message">
          <span className="icon">🔒</span>
          <span className="message">Faucets only available on BSC Testnet</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`faucet-status ${className}`}>
      {/* Header */}
      <div className="status-header">
        <div className="header-main">
          <span className="icon">🚰</span>
          <span className="title">
            {address ? `Faucet Status - ${address.substring(0, 8)}...` : 'Faucet Status'}
          </span>
          {!compact && (
            <button
              className="expand-btn"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? '▼' : '▶'}
            </button>
          )}
        </div>

        {!compact && (
          <div className="header-stats">
            <div className="stat">
              <span className="stat-value">{summaryStats.activeFaucets}/{summaryStats.totalFaucets}</span>
              <span className="stat-label">Active</span>
            </div>
            <div className="stat">
              <span className="stat-value">{(summaryStats.averageSuccessRate * 100).toFixed(1)}%</span>
              <span className="stat-label">Success Rate</span>
            </div>
            <div className="stat">
              <span className="stat-value">{summaryStats.totalAmount.toFixed(4)}</span>
              <span className="stat-label">Total BNB</span>
            </div>
            <div className="stat">
              <span className="stat-value">{Math.round(summaryStats.averageScore)}</span>
              <span className="stat-label">Avg Score</span>
            </div>
          </div>
        )}
      </div>

      {/* Alerts */}
      {showAlerts && activeAlerts.length > 0 && (
        <div className="alerts-section">
          <h4>Performance Alerts</h4>
          <div className="alerts-list">
            {activeAlerts.slice(0, 3).map(alert => (
              <div key={alert.id} className={`alert ${alert.severity}`}>
                <div className="alert-content">
                  <span className="alert-icon">
                    {alert.severity === 'critical' && '🚨'}
                    {alert.severity === 'high' && '⚠️'}
                    {alert.severity === 'medium' && '⚡'}
                    {alert.severity === 'low' && 'ℹ️'}
                  </span>
                  <span className="alert-message">{alert.message}</span>
                </div>
                <button
                  className="alert-dismiss"
                  onClick={() => acknowledgeAlert(alert.id)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Faucet Cards */}
      {(isExpanded || compact) && (
        <div className="faucets-grid">
          {faucetStatusData.map(data => (
            <FaucetCard
              key={data.faucetId}
              faucetId={data.faucetId}
              name={data.name}
              address={address}
              cooldownInfo={(data as any).cooldownInfo}
              metrics={data.metrics}
              compact={compact}
            />
          ))}
        </div>
      )}

      {/* Optimal Order */}
      {!compact && isExpanded && showMetrics && optimalOrder.length > 0 && (
        <div className="optimal-order">
          <h4>Recommended Faucet Order</h4>
          <div className="order-list">
            {optimalOrder.slice(0, 3).map((item, index) => (
              <div key={item.faucetId} className="order-item">
                <span className="order-rank">#{index + 1}</span>
                <span className="order-name">{item.name}</span>
                <span className="order-score">{item.score}/100</span>
                <span className="order-reason">{item.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      {!compact && isExpanded && (
        <div className="status-actions">
          <button className="action-btn refresh" onClick={refreshFaucetData}>
            🔄 Refresh
          </button>
          {showMetrics && (
            <button className="action-btn export" onClick={() => setShowExportDialog(true)}>
              📊 Export Metrics
            </button>
          )}
        </div>
      )}

      {/* Export Dialog */}
      {showExportDialog && (
        <div className="export-dialog-overlay">
          <div className="export-dialog">
            <h3>Export Faucet Metrics</h3>
            <p>Download comprehensive faucet performance data as JSON file.</p>
            <div className="dialog-actions">
              <button className="btn-secondary" onClick={() => setShowExportDialog(false)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleExportMetrics}>
                Download
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// CSS styles would be added to the appropriate CSS file
export const faucetStatusStyles = `
.faucet-status {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #ffffff;
  overflow: hidden;
}

.faucet-status.disabled {
  opacity: 0.7;
}

.disabled-message {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px;
  color: #718096;
  font-size: 14px;
}

.status-header {
  padding: 16px;
  border-bottom: 1px solid #e2e8f0;
  background: #f7fafc;
}

.header-main {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.title {
  font-weight: 600;
  color: #2d3748;
  flex: 1;
}

.expand-btn {
  background: none;
  border: none;
  color: #4299e1;
  cursor: pointer;
  font-size: 14px;
}

.header-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
  gap: 16px;
}

.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.stat-value {
  font-size: 18px;
  font-weight: 600;
  color: #2d3748;
}

.stat-label {
  font-size: 12px;
  color: #718096;
}

.alerts-section {
  padding: 16px;
  background: #fff5f5;
  border-bottom: 1px solid #e2e8f0;
}

.alerts-section h4 {
  margin: 0 0 8px 0;
  color: #c53030;
  font-size: 14px;
}

.alerts-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.alert {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 13px;
}

.alert.critical {
  background: #fed7d7;
  color: #c53030;
}

.alert.high {
  background: #fef2b0;
  color: #c05621;
}

.alert.medium {
  background: #bee3f8;
  color: #2c5282;
}

.alert.low {
  background: #d3f9d8;
  color: #276749;
}

.alert-content {
  display: flex;
  align-items: center;
  gap: 6px;
}

.alert-dismiss {
  background: none;
  border: none;
  cursor: pointer;
  color: inherit;
  opacity: 0.6;
}

.faucets-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 12px;
  padding: 16px;
}

.faucet-card {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 12px;
  background: #ffffff;
}

.faucet-card.compact {
  padding: 8px;
}

.faucet-card.good {
  border-color: #9ae6b4;
  background: #f0fff4;
}

.faucet-card.medium {
  border-color: #faf089;
  background: #fffff0;
}

.faucet-card.poor {
  border-color: #feb2b2;
  background: #fffaf0;
}

.faucet-card.cooldown {
  border-color: #90cdf4;
  background: #ebf8ff;
}

.faucet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.faucet-name {
  font-weight: 600;
  color: #2d3748;
  flex: 1;
  margin-left: 8px;
}

.faucet-status {
  font-size: 12px;
  font-weight: 500;
  color: #4a5568;
}

.faucet-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.detail-label {
  color: #718096;
}

.detail-value {
  font-weight: 500;
  color: #2d3748;
}

.trend-improving {
  color: #38a169;
}

.trend-declining {
  color: #e53e3e;
}

.trend-stable {
  color: #4a5568;
}

.next-available {
  margin-top: 8px;
  text-align: center;
  color: #718096;
}

.optimal-order {
  padding: 16px;
  border-top: 1px solid #e2e8f0;
  background: #f7fafc;
}

.optimal-order h4 {
  margin: 0 0 8px 0;
  color: #2d3748;
  font-size: 14px;
}

.order-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.order-item {
  display: grid;
  grid-template-columns: 30px 1fr auto auto;
  gap: 8px;
  align-items: center;
  padding: 6px 8px;
  background: #ffffff;
  border-radius: 4px;
  font-size: 12px;
}

.order-rank {
  font-weight: 600;
  color: #4299e1;
}

.order-name {
  font-weight: 500;
  color: #2d3748;
}

.order-score {
  font-weight: 600;
  color: #38a169;
}

.order-reason {
  color: #718096;
  font-style: italic;
}

.status-actions {
  display: flex;
  gap: 8px;
  padding: 16px;
  border-top: 1px solid #e2e8f0;
  background: #f7fafc;
}

.action-btn {
  padding: 8px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: #ffffff;
  color: #4a5568;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-btn:hover {
  background: #f7fafc;
  border-color: #cbd5e0;
}

.export-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.export-dialog {
  background: #ffffff;
  border-radius: 8px;
  padding: 24px;
  max-width: 400px;
  width: 90%;
}

.export-dialog h3 {
  margin: 0 0 8px 0;
  color: #2d3748;
}

.export-dialog p {
  margin: 0 0 16px 0;
  color: #718096;
  font-size: 14px;
}

.dialog-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.btn-secondary {
  padding: 8px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: #ffffff;
  color: #4a5568;
  cursor: pointer;
}

.btn-primary {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  background: #4299e1;
  color: #ffffff;
  cursor: pointer;
}
`;

export default FaucetStatus;