/**
 * Execution Summary Component
 * Results and reporting interface for completed or failed bundle executions
 */

import React, { useMemo, useState } from 'react';
import type { ExecutionStatus, ExecutionStatistics } from '../../store/execution';
import type { EnhancedTransaction, GasTracker } from '../../store/transactions';
import type { ExecutionPlan } from '../../services/execution-engine';

interface ExecutionSummaryProps {
  status: ExecutionStatus;
  statistics: ExecutionStatistics;
  transactions: EnhancedTransaction[];
  executionPlan: ExecutionPlan | null;
  gasTracker: GasTracker;
  onExportReport: () => void;
}

export const ExecutionSummary: React.FC<ExecutionSummaryProps> = ({
  status,
  statistics,
  transactions,
  executionPlan,
  gasTracker,
  onExportReport,
}) => {
  const [selectedMetric, setSelectedMetric] = useState<'overview' | 'gas' | 'timing' | 'errors'>('overview');

  const analysisData = useMemo(() => {
    const successful = transactions.filter(tx => tx.status === 'confirmed');
    const failed = transactions.filter(tx => tx.status === 'failed');
    const totalValue = transactions.reduce((sum, tx) => sum + parseFloat(tx.value), 0);
    const totalGasCost = transactions.reduce((sum, tx) => {
      if (tx.gasUsedActual && tx.effectiveGasPrice) {
        return sum + (parseFloat(tx.gasUsedActual) * parseFloat(tx.effectiveGasPrice));
      }
      return sum;
    }, 0);

    // Calculate timing metrics
    const completedTxs = transactions.filter(tx => tx.submittedAt && tx.confirmedAt);
    const confirmationTimes = completedTxs.map(tx => {
      const submitted = new Date(tx.submittedAt!).getTime();
      const confirmed = new Date(tx.confirmedAt!).getTime();
      return confirmed - submitted;
    });

    const avgConfirmationTime = confirmationTimes.length > 0 
      ? confirmationTimes.reduce((a, b) => a + b, 0) / confirmationTimes.length 
      : 0;

    // Calculate success rate by wallet
    const walletStats = transactions.reduce((acc, tx) => {
      if (!acc[tx.walletId]) {
        acc[tx.walletId] = { successful: 0, failed: 0, total: 0 };
      }
      acc[tx.walletId].total++;
      if (tx.status === 'confirmed') acc[tx.walletId].successful++;
      if (tx.status === 'failed') acc[tx.walletId].failed++;
      return acc;
    }, {} as Record<string, { successful: number; failed: number; total: number }>);

    return {
      successful,
      failed,
      totalValue,
      totalGasCost,
      avgConfirmationTime,
      walletStats,
      confirmationTimes,
    };
  }, [transactions]);

  const getStatusColor = () => {
    switch (status) {
      case 'completed': return '#4caf50';
      case 'failed': return '#f44336';
      case 'aborted': return '#ff9800';
      case 'paused': return '#2196f3';
      default: return '#9e9e9e';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'completed': return '✅';
      case 'failed': return '❌';
      case 'aborted': return '⚠️';
      case 'paused': return '⏸️';
      default: return '⚡';
    }
  };

  const formatTime = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const formatBNB = (value: number): string => {
    return value.toFixed(6);
  };

  const formatGas = (value: number): string => {
    return value.toLocaleString();
  };

  return (
    <div className="execution-summary">
      {/* Summary Header */}
      <div className="summary-header">
        <div className="status-indicator">
          <div className="status-icon" style={{ color: getStatusColor() }}>
            {getStatusIcon()}
          </div>
          <div className="status-info">
            <h2 className="status-title">
              Execution {status.charAt(0).toUpperCase() + status.slice(1)}
            </h2>
            <p className="status-description">
              Bundle execution completed at {new Date().toLocaleString()}
            </p>
          </div>
        </div>

        <div className="summary-actions">
          <button onClick={onExportReport} className="export-button">
            📄 Export Report
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="key-metrics">
        <div className="metric-card success">
          <div className="metric-icon">✅</div>
          <div className="metric-content">
            <span className="metric-value">{statistics.successfulTransactions}</span>
            <span className="metric-label">Successful</span>
            <span className="metric-percentage">
              {statistics.totalTransactions > 0 
                ? Math.round((statistics.successfulTransactions / statistics.totalTransactions) * 100)
                : 0}%
            </span>
          </div>
        </div>

        <div className="metric-card failed">
          <div className="metric-icon">❌</div>
          <div className="metric-content">
            <span className="metric-value">{statistics.failedTransactions}</span>
            <span className="metric-label">Failed</span>
            <span className="metric-percentage">
              {statistics.totalTransactions > 0 
                ? Math.round((statistics.failedTransactions / statistics.totalTransactions) * 100)
                : 0}%
            </span>
          </div>
        </div>

        <div className="metric-card value">
          <div className="metric-icon">💰</div>
          <div className="metric-content">
            <span className="metric-value">{formatBNB(analysisData.totalValue)}</span>
            <span className="metric-label">Total Value (BNB)</span>
          </div>
        </div>

        <div className="metric-card gas">
          <div className="metric-icon">⛽</div>
          <div className="metric-content">
            <span className="metric-value">{formatGas(analysisData.totalGasCost)}</span>
            <span className="metric-label">Gas Cost (wei)</span>
          </div>
        </div>

        <div className="metric-card time">
          <div className="metric-icon">⏱️</div>
          <div className="metric-content">
            <span className="metric-value">{formatTime(analysisData.avgConfirmationTime)}</span>
            <span className="metric-label">Avg Confirmation</span>
          </div>
        </div>
      </div>

      {/* Detailed Analysis Tabs */}
      <div className="analysis-tabs">
        <div className="tab-headers">
          <button
            onClick={() => setSelectedMetric('overview')}
            className={selectedMetric === 'overview' ? 'active' : ''}
          >
            Overview
          </button>
          <button
            onClick={() => setSelectedMetric('gas')}
            className={selectedMetric === 'gas' ? 'active' : ''}
          >
            Gas Analysis
          </button>
          <button
            onClick={() => setSelectedMetric('timing')}
            className={selectedMetric === 'timing' ? 'active' : ''}
          >
            Timing Analysis
          </button>
          <button
            onClick={() => setSelectedMetric('errors')}
            className={selectedMetric === 'errors' ? 'active' : ''}
          >
            Error Analysis
          </button>
        </div>

        <div className="tab-content">
          {selectedMetric === 'overview' && (
            <div className="overview-analysis">
              <div className="analysis-section">
                <h3>Execution Overview</h3>
                <div className="overview-stats">
                  <div className="stat-row">
                    <span className="stat-label">Total Transactions:</span>
                    <span className="stat-value">{statistics.totalTransactions}</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Success Rate:</span>
                    <span className="stat-value">{statistics.successRate.toFixed(1)}%</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Total Execution Time:</span>
                    <span className="stat-value">{formatTime(statistics.executionTimeMs)}</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Average Gas Price:</span>
                    <span className="stat-value">{statistics.averageGasPrice} gwei</span>
                  </div>
                </div>
              </div>

              {/* Wallet Performance */}
              <div className="analysis-section">
                <h3>Wallet Performance</h3>
                <div className="wallet-stats">
                  {Object.entries(analysisData.walletStats).map(([walletId, stats]) => (
                    <div key={walletId} className="wallet-stat-row">
                      <span className="wallet-id">{walletId.substring(0, 8)}...</span>
                      <div className="wallet-metrics">
                        <span className="wallet-successful">{stats.successful} success</span>
                        <span className="wallet-failed">{stats.failed} failed</span>
                        <span className="wallet-rate">
                          {Math.round((stats.successful / stats.total) * 100)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {selectedMetric === 'gas' && (
            <div className="gas-analysis">
              <div className="analysis-section">
                <h3>Gas Usage Analysis</h3>
                <div className="gas-stats">
                  <div className="stat-row">
                    <span className="stat-label">Total Gas Used:</span>
                    <span className="stat-value">{formatGas(parseFloat(statistics.totalGasUsed))}</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Average Gas per TX:</span>
                    <span className="stat-value">{statistics.averageGasUsed}</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Total Cost:</span>
                    <span className="stat-value">{statistics.totalCost} BNB</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Network Gas Price:</span>
                    <span className="stat-value">{gasTracker.networkGasPrice} wei</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {selectedMetric === 'timing' && (
            <div className="timing-analysis">
              <div className="analysis-section">
                <h3>Transaction Timing</h3>
                <div className="timing-stats">
                  <div className="stat-row">
                    <span className="stat-label">Average Confirmation Time:</span>
                    <span className="stat-value">{formatTime(analysisData.avgConfirmationTime)}</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Fastest Transaction:</span>
                    <span className="stat-value">
                      {analysisData.confirmationTimes.length > 0 
                        ? formatTime(Math.min(...analysisData.confirmationTimes))
                        : 'N/A'}
                    </span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Slowest Transaction:</span>
                    <span className="stat-value">
                      {analysisData.confirmationTimes.length > 0 
                        ? formatTime(Math.max(...analysisData.confirmationTimes))
                        : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {selectedMetric === 'errors' && (
            <div className="error-analysis">
              <div className="analysis-section">
                <h3>Error Analysis</h3>
                {analysisData.failed.length === 0 ? (
                  <div className="no-errors">
                    <div className="no-errors-icon">🎉</div>
                    <p>No failed transactions! Excellent execution.</p>
                  </div>
                ) : (
                  <div className="error-list">
                    {analysisData.failed.map(tx => (
                      <div key={tx.id} className="error-item">
                        <div className="error-header">
                          <span className="error-tx-id">{tx.id.substring(0, 8)}...</span>
                          <span className="error-wallet">{tx.walletId.substring(0, 8)}...</span>
                        </div>
                        <div className="error-message">{tx.error || 'Unknown error'}</div>
                        <div className="error-details">
                          Retries: {tx.retryCount}/{tx.maxRetries}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recommendations */}
      {(status === 'failed' || analysisData.failed.length > 0) && (
        <div className="recommendations">
          <h3>Recommendations</h3>
          <div className="recommendation-list">
            {statistics.successRate < 90 && (
              <div className="recommendation">
                <span className="recommendation-icon">💡</span>
                <span className="recommendation-text">
                  Consider increasing gas prices or reducing batch size to improve success rate.
                </span>
              </div>
            )}
            {analysisData.avgConfirmationTime > 300000 && (
              <div className="recommendation">
                <span className="recommendation-icon">⚡</span>
                <span className="recommendation-text">
                  Transaction confirmation times are slow. Consider using higher priority fees.
                </span>
              </div>
            )}
            {analysisData.failed.length > statistics.totalTransactions * 0.1 && (
              <div className="recommendation">
                <span className="recommendation-icon">🔧</span>
                <span className="recommendation-text">
                  High failure rate detected. Review transaction settings and network conditions.
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};