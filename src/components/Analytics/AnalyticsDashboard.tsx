/**
 * Main Analytics Dashboard Component
 * Comprehensive analytics interface for JustJewIt bundler operations
 */

import React, { useEffect, useState } from 'react';
import { useAnalyticsStore, createTimeRange, formatTimeRange, getViewDisplayName } from '../../store/analytics';
import type { AnalyticsViewMode } from '../../store/analytics';
import type { AnalyticsMetrics } from '../../services/analytics';
import './AnalyticsDashboard.css';

interface AnalyticsDashboardProps {
  className?: string;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  className = ''
}) => {
  const {
    metrics,
    currentView,
    timeRange,
    isLoading,
    refreshStatus,
    lastUpdated,
    error,
    isRealTimeEnabled,
    autoRefreshInterval,
    isExporting,
    exportProgress,
    
    fetchAnalytics,
    refreshAnalytics,
    setTimeRange,
    setCurrentView,
    enableRealTime,
    disableRealTime,
    setAutoRefreshInterval,
    exportAnalytics,
    clearError
  } = useAnalyticsStore();

  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json'); // FIXED: Removed PDF option until implemented

  // Initialize analytics on component mount
  useEffect(() => {
    if (!metrics) {
      fetchAnalytics();
    }
  }, [fetchAnalytics, metrics]);

  // Handle time range change
  const handleTimeRangeChange = (period: '1h' | '4h' | '12h' | '24h' | '7d' | '30d' | 'all') => {
    const newTimeRange = createTimeRange(period);
    setTimeRange(newTimeRange);
  };

  // Handle export
  const handleExport = async () => {
    try {
      const exportOptions = {
        format: exportFormat,
        timeRange,
        includeCharts: true,
        metrics: ['bundlePerformance', 'walletAnalytics', 'networkStats', 'transactionTracking', 'gasAnalytics'] as (keyof AnalyticsMetrics)[]
      };
      
      const exportData = await exportAnalytics(exportOptions);
      
      // Create download link with proper MIME type handling
      const mimeType = exportFormat === 'json' ? 'application/json' : 'text/csv';
      const blob = new Blob([exportData], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `analytics-${new Date().toISOString().split('T')[0]}.${exportFormat}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setShowExportModal(false);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  // View navigation items
  const viewItems: { key: AnalyticsViewMode; label: string; icon: string }[] = [
    { key: 'overview', label: 'Overview', icon: '📊' },
    { key: 'bundles', label: 'Bundle Performance', icon: '📦' },
    { key: 'wallets', label: 'Wallet Analytics', icon: '👛' },
    { key: 'network', label: 'Network Stats', icon: '🌐' },
    { key: 'transactions', label: 'Transactions', icon: '💳' },
    { key: 'gas', label: 'Gas Analytics', icon: '⛽' },
  ];

  // Time range options
  const timeRangeOptions = [
    { key: '1h', label: '1 Hour' },
    { key: '4h', label: '4 Hours' },
    { key: '12h', label: '12 Hours' },
    { key: '24h', label: '24 Hours' },
    { key: '7d', label: '7 Days' },
    { key: '30d', label: '30 Days' },
    { key: 'all', label: 'All Time' },
  ];

  return (
    <div className={`analytics-dashboard ${className}`}>
      {/* Header */}
      <div className="analytics-header">
        <div className="analytics-header-left">
          <h1 className="analytics-title">
            <span className="analytics-icon">📈</span>
            Analytics Dashboard
          </h1>
          <div className="analytics-subtitle">
            {getViewDisplayName(currentView)} • {formatTimeRange(timeRange)}
          </div>
        </div>
        
        <div className="analytics-header-right">
          {/* Real-time toggle */}
          <div className="real-time-controls">
            <button
              className={`real-time-toggle ${isRealTimeEnabled ? 'active' : ''}`}
              onClick={isRealTimeEnabled ? disableRealTime : enableRealTime}
              title={isRealTimeEnabled ? 'Disable Real-time' : 'Enable Real-time'}
            >
              <span className={`real-time-indicator ${isRealTimeEnabled ? 'active' : ''}`}></span>
              Real-time
            </button>
            
            {isRealTimeEnabled && (
              <select 
                className="refresh-interval-select"
                value={autoRefreshInterval}
                onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
              >
                <option value={10}>10s</option>
                <option value={30}>30s</option>
                <option value={60}>1m</option>
                <option value={300}>5m</option>
              </select>
            )}
          </div>

          {/* Action buttons */}
          <div className="analytics-actions">
            <button
              className="analytics-action-btn refresh-btn"
              onClick={refreshAnalytics}
              disabled={isLoading}
              title="Refresh Analytics"
            >
              <span className={`refresh-icon ${isLoading ? 'spinning' : ''}`}>🔄</span>
            </button>
            
            <button
              className="analytics-action-btn export-btn"
              onClick={() => setShowExportModal(true)}
              disabled={isExporting}
              title="Export Analytics"
            >
              <span className="export-icon">📥</span>
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="analytics-navigation">
        <div className="analytics-nav-tabs">
          {viewItems.map(item => (
            <button
              key={item.key}
              className={`nav-tab ${currentView === item.key ? 'active' : ''}`}
              onClick={() => setCurrentView(item.key)}
            >
              <span className="nav-tab-icon">{item.icon}</span>
              <span className="nav-tab-label">{item.label}</span>
            </button>
          ))}
        </div>
        
        <div className="time-range-selector">
          <label className="time-range-label">Time Range:</label>
          <div className="time-range-buttons">
            {timeRangeOptions.map(option => (
              <button
                key={option.key}
                className={`time-range-btn ${timeRange.period === option.key ? 'active' : ''}`}
                onClick={() => handleTimeRangeChange(option.key as any)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Status bar */}
      {(error || isLoading || lastUpdated) && (
        <div className="analytics-status-bar">
          {error && (
            <div className="status-error">
              <span className="error-icon">⚠️</span>
              <span className="error-message">{error}</span>
              <button className="error-dismiss" onClick={clearError}>×</button>
            </div>
          )}
          
          {isLoading && (
            <div className="status-loading">
              <span className="loading-spinner"></span>
              <span className="loading-message">Loading analytics...</span>
            </div>
          )}
          
          {lastUpdated && !isLoading && !error && (
            <div className="status-updated">
              <span className="updated-icon">✓</span>
              <span className="updated-message">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </span>
            </div>
          )}
          
          {refreshStatus === 'success' && (
            <div className="status-success">
              <span className="success-icon">✅</span>
              <span className="success-message">Analytics updated successfully</span>
            </div>
          )}
        </div>
      )}

      {/* Main Content Area */}
      <div className="analytics-content">
        {!metrics && !isLoading ? (
          <div className="analytics-empty">
            <div className="empty-icon">📊</div>
            <h3>No Analytics Data</h3>
            <p>Click refresh to load analytics data</p>
            <button className="empty-action-btn" onClick={refreshAnalytics}>
              Load Analytics
            </button>
          </div>
        ) : (
          <div className="analytics-content-inner">
            {/* Overview Section - Always visible with key metrics */}
            {currentView === 'overview' && metrics && (
              <div className="analytics-overview">
                <div className="overview-grid">
                  {/* Bundle Performance Summary */}
                  <div className="overview-card bundle-performance">
                    <div className="overview-card-header">
                      <h3>Bundle Performance</h3>
                      <span className="overview-icon">📦</span>
                    </div>
                    <div className="overview-metrics">
                      <div className="overview-metric">
                        <span className="metric-value">{metrics.bundlePerformance.totalExecutions}</span>
                        <span className="metric-label">Total Executions</span>
                      </div>
                      <div className="overview-metric">
                        <span className="metric-value">{metrics.bundlePerformance.successRate.toFixed(1)}%</span>
                        <span className="metric-label">Success Rate</span>
                      </div>
                      <div className="overview-metric">
                        <span className="metric-value">{metrics.bundlePerformance.averageExecutionTime.toFixed(0)}ms</span>
                        <span className="metric-label">Avg Execution Time</span>
                      </div>
                    </div>
                  </div>

                  {/* Wallet Analytics Summary */}
                  <div className="overview-card wallet-analytics">
                    <div className="overview-card-header">
                      <h3>Wallet Analytics</h3>
                      <span className="overview-icon">👛</span>
                    </div>
                    <div className="overview-metrics">
                      <div className="overview-metric">
                        <span className="metric-value">{metrics.walletAnalytics.totalWallets}</span>
                        <span className="metric-label">Total Wallets</span>
                      </div>
                      <div className="overview-metric">
                        <span className="metric-value">{metrics.walletAnalytics.activeWallets}</span>
                        <span className="metric-label">Active Wallets</span>
                      </div>
                      <div className="overview-metric">
                        <span className="metric-value">{metrics.walletAnalytics.totalBalance.toFixed(4)} BNB</span>
                        <span className="metric-label">Total Balance</span>
                      </div>
                    </div>
                  </div>

                  {/* Network Stats Summary */}
                  <div className="overview-card network-stats">
                    <div className="overview-card-header">
                      <h3>Network Stats</h3>
                      <span className="overview-icon">🌐</span>
                    </div>
                    <div className="overview-metrics">
                      <div className="overview-metric">
                        <span className="metric-value">#{metrics.networkStats.currentBlockNumber.toLocaleString()}</span>
                        <span className="metric-label">Current Block</span>
                      </div>
                      <div className="overview-metric">
                        <span className="metric-value">{(parseInt(metrics.networkStats.currentGasPrice) / 1e9).toFixed(1)} Gwei</span>
                        <span className="metric-label">Gas Price</span>
                      </div>
                      <div className="overview-metric">
                        <span className="metric-value">{metrics.networkStats.averageBlockTime.toFixed(1)}s</span>
                        <span className="metric-label">Block Time</span>
                      </div>
                    </div>
                  </div>

                  {/* Transaction Tracking Summary */}
                  <div className="overview-card transaction-tracking">
                    <div className="overview-card-header">
                      <h3>Transactions</h3>
                      <span className="overview-icon">💳</span>
                    </div>
                    <div className="overview-metrics">
                      <div className="overview-metric">
                        <span className="metric-value">{metrics.transactionTracking.totalTransactions}</span>
                        <span className="metric-label">Total Transactions</span>
                      </div>
                      <div className="overview-metric">
                        <span className="metric-value">{metrics.transactionTracking.successRate.toFixed(1)}%</span>
                        <span className="metric-label">Success Rate</span>
                      </div>
                      <div className="overview-metric">
                        <span className="metric-value">{metrics.transactionTracking.averageConfirmationTime.toFixed(1)}s</span>
                        <span className="metric-label">Avg Confirmation</span>
                      </div>
                    </div>
                  </div>

                  {/* Gas Analytics Summary */}
                  <div className="overview-card gas-analytics">
                    <div className="overview-card-header">
                      <h3>Gas Analytics</h3>
                      <span className="overview-icon">⛽</span>
                    </div>
                    <div className="overview-metrics">
                      <div className="overview-metric">
                        <span className="metric-value">{(parseInt(metrics.gasAnalytics.currentGasPrice) / 1e9).toFixed(1)} Gwei</span>
                        <span className="metric-label">Current Gas Price</span>
                      </div>
                      <div className="overview-metric">
                        <span className="metric-value">{metrics.gasAnalytics.gasOptimizationSavings.toFixed(4)} BNB</span>
                        <span className="metric-label">Optimization Savings</span>
                      </div>
                      <div className="overview-metric">
                        <span className="metric-value">{metrics.gasAnalytics.optimalGasStrategy}</span>
                        <span className="metric-label">Optimal Strategy</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quick insights */}
                <div className="overview-insights">
                  <h3>Key Insights</h3>
                  <div className="insights-grid">
                    <div className="insight-item">
                      <span className="insight-icon">📈</span>
                      <div className="insight-content">
                        <span className="insight-title">Performance Trend</span>
                        <span className="insight-description">
                          Bundle success rate is {metrics.bundlePerformance.successRate > 95 ? 'excellent' : 
                                                  metrics.bundlePerformance.successRate > 85 ? 'good' : 'needs improvement'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="insight-item">
                      <span className="insight-icon">💰</span>
                      <div className="insight-content">
                        <span className="insight-title">Cost Optimization</span>
                        <span className="insight-description">
                          Saved {metrics.gasAnalytics.gasOptimizationSavings.toFixed(4)} BNB through gas optimization
                        </span>
                      </div>
                    </div>
                    
                    <div className="insight-item">
                      <span className="insight-icon">🎯</span>
                      <div className="insight-content">
                        <span className="insight-title">Network Status</span>
                        <span className="insight-description">
                          Network congestion is {metrics.networkStats.networkCongestion} - 
                          {metrics.networkStats.networkCongestion === 'low' ? ' optimal for trading' :
                           metrics.networkStats.networkCongestion === 'medium' ? ' moderate delays expected' :
                           ' high fees and delays expected'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Specific view content - placeholder for chart components */}
            {currentView !== 'overview' && (
              <div className="analytics-specific-view">
                <div className="view-header">
                  <h2>{getViewDisplayName(currentView)}</h2>
                  <p>Detailed {currentView} analytics and visualizations</p>
                </div>
                
                <div className="view-content">
                  <div className="placeholder-chart">
                    <div className="placeholder-icon">📊</div>
                    <h3>{getViewDisplayName(currentView)} Charts</h3>
                    <p>Chart components will be implemented next</p>
                    <div className="placeholder-metrics">
                      {metrics && currentView === 'bundles' && (
                        <div>Bundle performance data available: {metrics.bundlePerformance.totalExecutions} executions</div>
                      )}
                      {metrics && currentView === 'wallets' && (
                        <div>Wallet analytics data available: {metrics.walletAnalytics.totalWallets} wallets</div>
                      )}
                      {metrics && currentView === 'network' && (
                        <div>Network data available: Block #{metrics.networkStats.currentBlockNumber}</div>
                      )}
                      {metrics && currentView === 'transactions' && (
                        <div>Transaction data available: {metrics.transactionTracking.totalTransactions} transactions</div>
                      )}
                      {metrics && currentView === 'gas' && (
                        <div>Gas analytics available: {(parseInt(metrics.gasAnalytics.currentGasPrice) / 1e9).toFixed(1)} Gwei current price</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div className="export-modal-overlay">
          <div className="export-modal">
            <div className="export-modal-header">
              <h3>Export Analytics</h3>
              <button className="export-modal-close" onClick={() => setShowExportModal(false)}>×</button>
            </div>
            
            <div className="export-modal-content">
              <div className="export-option">
                <label htmlFor="export-format">Export Format:</label>
                <select
                  id="export-format"
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value as 'json' | 'csv')}
                >
                  <option value="json">JSON</option>
                  <option value="csv">CSV</option>
                </select>
              </div>
              
              <div className="export-summary">
                <p>Exporting {formatTimeRange(timeRange)} data</p>
                <p>Format: {exportFormat.toUpperCase()}</p>
                {lastUpdated && <p>Data as of: {lastUpdated.toLocaleString()}</p>}
              </div>
              
              {isExporting && (
                <div className="export-progress">
                  <div className="progress-bar">
                    <div 
                      className="progress-fill" 
                      style={{ width: `${exportProgress}%` }}
                    ></div>
                  </div>
                  <span className="progress-text">{exportProgress}%</span>
                </div>
              )}
            </div>
            
            <div className="export-modal-actions">
              <button 
                className="export-cancel-btn" 
                onClick={() => setShowExportModal(false)}
                disabled={isExporting}
              >
                Cancel
              </button>
              <button 
                className="export-confirm-btn" 
                onClick={handleExport}
                disabled={isExporting}
              >
                {isExporting ? 'Exporting...' : 'Export'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalyticsDashboard;