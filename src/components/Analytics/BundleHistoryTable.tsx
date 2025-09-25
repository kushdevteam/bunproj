/**
 * Bundle History Table Component
 * Displays past bundle executions with detailed metrics and performance data
 */

import React, { useMemo, useState } from 'react';
import { useAnalyticsStore } from '../../store/analytics';
import { useNetworkStore } from '../../store/network';
import type { BundleExecutionSummary } from '../../services/analytics';

interface BundleHistoryTableProps {
  className?: string;
  maxRows?: number;
  showPagination?: boolean;
  showFilters?: boolean;
}

export const BundleHistoryTable: React.FC<BundleHistoryTableProps> = ({
  className = '',
  maxRows = 15,
  showPagination = true,
  showFilters = true
}) => {
  const { metrics, isLoading } = useAnalyticsStore();
  const { currentNetwork } = useNetworkStore();
  
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failed'>('all');
  const [sortField, setSortField] = useState<'timestamp' | 'executionTime' | 'gasUsed' | 'cost'>('timestamp');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Process bundle execution data
  const processedBundles = useMemo(() => {
    if (!metrics?.bundlePerformance?.recentExecutions) {
      return { bundles: [], totalCount: 0, pageCount: 0 };
    }

    let bundles = [...metrics.bundlePerformance.recentExecutions];

    // Apply status filter
    if (statusFilter !== 'all') {
      bundles = bundles.filter(bundle => 
        statusFilter === 'success' ? bundle.success : !bundle.success
      );
    }

    // Apply sorting
    bundles.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortField) {
        case 'timestamp':
          aValue = new Date(a.timestamp).getTime();
          bValue = new Date(b.timestamp).getTime();
          break;
        case 'executionTime':
          aValue = a.executionTimeMs;
          bValue = b.executionTimeMs;
          break;
        case 'gasUsed':
          aValue = parseInt(a.gasUsed || '0');
          bValue = parseInt(b.gasUsed || '0');
          break;
        case 'cost':
          aValue = a.cost || 0;
          bValue = b.cost || 0;
          break;
        default:
          aValue = a.timestamp;
          bValue = b.timestamp;
      }

      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    const totalCount = bundles.length;
    const pageCount = Math.ceil(totalCount / maxRows);

    // Apply pagination
    if (showPagination) {
      const startIndex = (currentPage - 1) * maxRows;
      bundles = bundles.slice(startIndex, startIndex + maxRows);
    } else {
      bundles = bundles.slice(0, maxRows);
    }

    return { bundles, totalCount, pageCount };
  }, [metrics, statusFilter, sortField, sortDirection, currentPage, maxRows, showPagination]);

  // Format execution time
  const formatExecutionTime = (timeMs: number) => {
    if (timeMs < 1000) return `${timeMs}ms`;
    return `${(timeMs / 1000).toFixed(1)}s`;
  };

  // Format gas amount
  const formatGas = (gas: string) => {
    const gasNum = parseInt(gas || '0');
    if (gasNum >= 1000000) return `${(gasNum / 1000000).toFixed(1)}M`;
    if (gasNum >= 1000) return `${(gasNum / 1000).toFixed(1)}K`;
    return gasNum.toString();
  };

  // Format cost in BNB
  const formatCost = (cost: number) => {
    if (cost === 0) return '0';
    if (cost < 0.0001) return '<0.0001';
    return cost.toFixed(4);
  };

  // Get status display
  const getStatusDisplay = (success: boolean) => {
    return success 
      ? { color: '#22c55e', icon: '✅', label: 'Success' }
      : { color: '#ef4444', icon: '❌', label: 'Failed' };
  };

  // Get execution time performance rating
  const getExecutionTimeRating = (timeMs: number) => {
    if (timeMs < 1000) return { color: '#22c55e', rating: 'Excellent' };
    if (timeMs < 3000) return { color: '#3b82f6', rating: 'Good' };
    if (timeMs < 5000) return { color: '#f59e0b', rating: 'Average' };
    return { color: '#ef4444', rating: 'Poor' };
  };

  // Calculate gas efficiency
  const calculateGasEfficiency = (gasUsed: string, walletsInvolved: number) => {
    const gas = parseInt(gasUsed || '0');
    const estimatedGas = walletsInvolved * 21000 * 1.5; // Base estimation
    
    if (gas === 0 || estimatedGas === 0) return 0;
    
    const efficiency = Math.max(0, ((estimatedGas - gas) / estimatedGas) * 100);
    return efficiency;
  };

  // Handle sort change
  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  if (isLoading) {
    return (
      <div className={`bundle-history-table loading ${className}`}>
        <div className="table-loading">
          <div className="loading-spinner"></div>
          <span>Loading bundle history...</span>
        </div>
      </div>
    );
  }

  if (!metrics || processedBundles.totalCount === 0) {
    return (
      <div className={`bundle-history-table empty ${className}`}>
        <div className="table-empty">
          <div className="empty-icon">📦</div>
          <h4>No Bundle History</h4>
          <p>Execute bundles to see performance history and analytics</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bundle-history-table ${className}`}>
      {/* Table Header */}
      <div className="table-header">
        <div className="table-title-section">
          <h3 className="table-title">Bundle Execution History</h3>
          <div className="table-subtitle">
            {processedBundles.totalCount} executions • Performance analytics
          </div>
        </div>
        
        <div className="table-stats">
          <div className="stat-item">
            <span className="stat-label">Success Rate</span>
            <span className="stat-value success-rate">
              {metrics.bundlePerformance.successRate.toFixed(1)}%
            </span>
          </div>
          
          <div className="stat-item">
            <span className="stat-label">Avg Execution Time</span>
            <span className="stat-value avg-time">
              {formatExecutionTime(metrics.bundlePerformance.averageExecutionTime)}
            </span>
          </div>
          
          <div className="stat-item">
            <span className="stat-label">Gas Efficiency</span>
            <span className="stat-value gas-efficiency">
              {metrics.bundlePerformance.gasEfficiencyScore.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="table-filters">
          <div className="filter-group">
            <label className="filter-label">Status:</label>
            <select
              className="filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
            >
              <option value="all">All Executions</option>
              <option value="success">Successful</option>
              <option value="failed">Failed</option>
            </select>
          </div>
          
          <div className="filter-summary">
            Showing {processedBundles.bundles.length} of {processedBundles.totalCount} executions
          </div>
        </div>
      )}

      {/* Bundle History Table */}
      <div className="table-container">
        <table className="bundle-history-table-grid">
          <thead>
            <tr>
              <th>Bundle ID</th>
              <th>Status</th>
              <th 
                className={`sortable ${sortField === 'timestamp' ? 'active' : ''}`}
                onClick={() => handleSort('timestamp')}
              >
                Execution Time
                <span className="sort-indicator">
                  {sortField === 'timestamp' && (sortDirection === 'asc' ? '↑' : '↓')}
                </span>
              </th>
              <th 
                className={`sortable ${sortField === 'executionTime' ? 'active' : ''}`}
                onClick={() => handleSort('executionTime')}
              >
                Duration
                <span className="sort-indicator">
                  {sortField === 'executionTime' && (sortDirection === 'asc' ? '↑' : '↓')}
                </span>
              </th>
              <th>Wallets</th>
              <th 
                className={`sortable ${sortField === 'gasUsed' ? 'active' : ''}`}
                onClick={() => handleSort('gasUsed')}
              >
                Gas Used
                <span className="sort-indicator">
                  {sortField === 'gasUsed' && (sortDirection === 'asc' ? '↑' : '↓')}
                </span>
              </th>
              <th>Gas Efficiency</th>
              <th 
                className={`sortable ${sortField === 'cost' ? 'active' : ''}`}
                onClick={() => handleSort('cost')}
              >
                Cost (BNB)
                <span className="sort-indicator">
                  {sortField === 'cost' && (sortDirection === 'asc' ? '↑' : '↓')}
                </span>
              </th>
              <th>Performance</th>
              <th>Error</th>
            </tr>
          </thead>
          <tbody>
            {processedBundles.bundles.map((bundle, index) => {
              const status = getStatusDisplay(bundle.success);
              const timeRating = getExecutionTimeRating(bundle.executionTimeMs);
              const gasEfficiency = calculateGasEfficiency(bundle.gasUsed, bundle.walletsInvolved);
              
              return (
                <tr key={`${bundle.id}-${index}`} className={`bundle-row status-${bundle.success ? 'success' : 'failed'}`}>
                  <td className="bundle-id-cell">
                    <div className="bundle-id-display">
                      <span className="bundle-id-short">
                        {bundle.id.slice(0, 8)}...
                      </span>
                      <button
                        className="copy-btn"
                        onClick={() => navigator.clipboard.writeText(bundle.id)}
                        title="Copy bundle ID"
                      >
                        📋
                      </button>
                    </div>
                  </td>
                  
                  <td className="status-cell">
                    <span 
                      className="status-badge"
                      style={{ color: status.color }}
                    >
                      <span className="status-icon">{status.icon}</span>
                      {status.label}
                    </span>
                  </td>
                  
                  <td className="timestamp-cell">
                    <div className="timestamp-display">
                      <span className="timestamp-time">
                        {new Date(bundle.timestamp).toLocaleTimeString()}
                      </span>
                      <span className="timestamp-date">
                        {new Date(bundle.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                  </td>
                  
                  <td className="execution-time-cell">
                    <div className="execution-time-display">
                      <span className="execution-time-value">
                        {formatExecutionTime(bundle.executionTimeMs)}
                      </span>
                      <span 
                        className="execution-time-rating"
                        style={{ color: timeRating.color }}
                      >
                        {timeRating.rating}
                      </span>
                    </div>
                  </td>
                  
                  <td className="wallets-cell">
                    <span className="wallets-count">
                      {bundle.walletsInvolved}
                    </span>
                  </td>
                  
                  <td className="gas-used-cell">
                    <span className="gas-amount">
                      {formatGas(bundle.gasUsed)}
                    </span>
                  </td>
                  
                  <td className="gas-efficiency-cell">
                    <div className="efficiency-display">
                      <span className="efficiency-value">
                        {gasEfficiency.toFixed(1)}%
                      </span>
                      <div 
                        className="efficiency-bar"
                        style={{ 
                          background: `linear-gradient(90deg, ${gasEfficiency > 10 ? '#22c55e' : gasEfficiency > 5 ? '#f59e0b' : '#ef4444'} 0%, ${gasEfficiency > 10 ? '#22c55e' : gasEfficiency > 5 ? '#f59e0b' : '#ef4444'}40 100%)`,
                          width: `${Math.min(gasEfficiency, 100)}%`
                        }}
                      />
                    </div>
                  </td>
                  
                  <td className="cost-cell">
                    <span className="cost-amount">
                      {formatCost(bundle.cost || 0)}
                    </span>
                  </td>
                  
                  <td className="performance-cell">
                    <div className="performance-metrics">
                      <div className="metric-item">
                        <span className="metric-label">Time:</span>
                        <span 
                          className="metric-value"
                          style={{ color: timeRating.color }}
                        >
                          {timeRating.rating}
                        </span>
                      </div>
                      <div className="metric-item">
                        <span className="metric-label">Gas:</span>
                        <span 
                          className="metric-value"
                          style={{ 
                            color: gasEfficiency > 10 ? '#22c55e' : gasEfficiency > 5 ? '#f59e0b' : '#ef4444'
                          }}
                        >
                          {gasEfficiency > 10 ? 'Excellent' : gasEfficiency > 5 ? 'Good' : 'Poor'}
                        </span>
                      </div>
                    </div>
                  </td>
                  
                  <td className="error-cell">
                    {bundle.errorMessage ? (
                      <div className="error-display">
                        <button
                          className="error-btn"
                          title={bundle.errorMessage}
                        >
                          ⚠️ Error
                        </button>
                        <div className="error-tooltip">
                          {bundle.errorMessage}
                        </div>
                      </div>
                    ) : (
                      <span className="no-error">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {showPagination && processedBundles.pageCount > 1 && (
        <div className="table-pagination">
          <div className="pagination-info">
            Page {currentPage} of {processedBundles.pageCount}
          </div>
          
          <div className="pagination-controls">
            <button
              className="pagination-btn"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(currentPage - 1)}
            >
              ← Previous
            </button>
            
            <div className="page-numbers">
              {Array.from({ length: Math.min(5, processedBundles.pageCount) }, (_, i) => {
                const page = Math.max(1, currentPage - 2) + i;
                if (page <= processedBundles.pageCount) {
                  return (
                    <button
                      key={page}
                      className={`page-btn ${page === currentPage ? 'active' : ''}`}
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </button>
                  );
                }
                return null;
              })}
            </div>
            
            <button
              className="pagination-btn"
              disabled={currentPage === processedBundles.pageCount}
              onClick={() => setCurrentPage(currentPage + 1)}
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* Execution Summary */}
      <div className="execution-summary">
        <div className="summary-cards">
          <div className="summary-card successful">
            <div className="summary-icon">✅</div>
            <div className="summary-content">
              <span className="summary-label">Successful Executions</span>
              <span className="summary-value">{metrics.bundlePerformance.successfulExecutions}</span>
            </div>
          </div>
          
          <div className="summary-card failed">
            <div className="summary-icon">❌</div>
            <div className="summary-content">
              <span className="summary-label">Failed Executions</span>
              <span className="summary-value">{metrics.bundlePerformance.failedExecutions}</span>
            </div>
          </div>
          
          <div className="summary-card total-cost">
            <div className="summary-icon">💰</div>
            <div className="summary-content">
              <span className="summary-label">Total Cost</span>
              <span className="summary-value">{metrics.bundlePerformance.totalCostBNB.toFixed(4)} BNB</span>
            </div>
          </div>
          
          <div className="summary-card total-gas">
            <div className="summary-icon">⛽</div>
            <div className="summary-content">
              <span className="summary-label">Total Gas Used</span>
              <span className="summary-value">{formatGas(metrics.bundlePerformance.totalGasUsed)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BundleHistoryTable;