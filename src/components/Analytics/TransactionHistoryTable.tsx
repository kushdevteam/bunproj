/**
 * Transaction History Table Component
 * Displays recent transactions with BSCScan integration and detailed metrics
 */

import React, { useMemo, useState } from 'react';
import { useAnalyticsStore } from '../../store/analytics';
import { useNetworkStore } from '../../store/network';
import type { TransactionSummary } from '../../services/analytics';

interface TransactionHistoryTableProps {
  className?: string;
  maxRows?: number;
  showPagination?: boolean;
  showFilters?: boolean;
}

export const TransactionHistoryTable: React.FC<TransactionHistoryTableProps> = ({
  className = '',
  maxRows = 20,
  showPagination = true,
  showFilters = true
}) => {
  const { metrics, isLoading } = useAnalyticsStore();
  const { currentNetwork } = useNetworkStore();
  
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failed' | 'pending'>('all');
  const [sortField, setSortField] = useState<'timestamp' | 'gasUsed' | 'value'>('timestamp');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Process and filter transaction data
  const processedTransactions = useMemo(() => {
    if (!metrics?.transactionTracking?.recentTransactions) {
      return { transactions: [], totalCount: 0, pageCount: 0 };
    }

    let transactions = [...metrics.transactionTracking.recentTransactions];

    // Apply status filter
    if (statusFilter !== 'all') {
      transactions = transactions.filter(tx => tx.status === statusFilter);
    }

    // Apply sorting
    transactions.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortField) {
        case 'timestamp':
          aValue = new Date(a.timestamp).getTime();
          bValue = new Date(b.timestamp).getTime();
          break;
        case 'gasUsed':
          aValue = parseInt(a.gasUsed || '0');
          bValue = parseInt(b.gasUsed || '0');
          break;
        case 'value':
          aValue = parseFloat(a.value || '0');
          bValue = parseFloat(b.value || '0');
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

    const totalCount = transactions.length;
    const pageCount = Math.ceil(totalCount / maxRows);

    // Apply pagination
    if (showPagination) {
      const startIndex = (currentPage - 1) * maxRows;
      transactions = transactions.slice(startIndex, startIndex + maxRows);
    } else {
      transactions = transactions.slice(0, maxRows);
    }

    return { transactions, totalCount, pageCount };
  }, [metrics, statusFilter, sortField, sortDirection, currentPage, maxRows, showPagination]);

  // Format transaction value in BNB
  const formatValue = (value: string) => {
    const bnbValue = parseFloat(value) / 1e18;
    if (bnbValue === 0) return '0';
    if (bnbValue < 0.0001) return '<0.0001';
    return bnbValue.toFixed(4);
  };

  // Format gas amount
  const formatGas = (gas: string) => {
    const gasNum = parseInt(gas || '0');
    if (gasNum >= 1000000) return `${(gasNum / 1000000).toFixed(1)}M`;
    if (gasNum >= 1000) return `${(gasNum / 1000).toFixed(1)}K`;
    return gasNum.toString();
  };

  // Get status color and icon
  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'success':
        return { color: '#22c55e', icon: '✅', label: 'Success' };
      case 'failed':
        return { color: '#ef4444', icon: '❌', label: 'Failed' };
      case 'pending':
        return { color: '#f59e0b', icon: '⏳', label: 'Pending' };
      default:
        return { color: '#6b7280', icon: '❓', label: 'Unknown' };
    }
  };

  // Generate BSCScan URL
  const getBSCScanUrl = (hash: string) => {
    return `${currentNetwork.blockExplorerUrl}/tx/${hash}`;
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
      <div className={`transaction-history-table loading ${className}`}>
        <div className="table-loading">
          <div className="loading-spinner"></div>
          <span>Loading transaction history...</span>
        </div>
      </div>
    );
  }

  if (!metrics || processedTransactions.totalCount === 0) {
    return (
      <div className={`transaction-history-table empty ${className}`}>
        <div className="table-empty">
          <div className="empty-icon">💳</div>
          <h4>No Transaction History</h4>
          <p>Execute transactions to see history and analytics</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`transaction-history-table ${className}`}>
      {/* Table Header */}
      <div className="table-header">
        <div className="table-title-section">
          <h3 className="table-title">Transaction History</h3>
          <div className="table-subtitle">
            {processedTransactions.totalCount} transactions • Real-time updates
          </div>
        </div>
        
        <div className="table-stats">
          <div className="stat-item">
            <span className="stat-label">Success Rate</span>
            <span className="stat-value success-rate">
              {metrics.transactionTracking.successRate.toFixed(1)}%
            </span>
          </div>
          
          <div className="stat-item">
            <span className="stat-label">Avg Gas</span>
            <span className="stat-value avg-gas">
              {formatGas(metrics.transactionTracking.averageGasUsed.toString())}
            </span>
          </div>
          
          <div className="stat-item">
            <span className="stat-label">Avg Confirmation</span>
            <span className="stat-value avg-confirmation">
              {metrics.transactionTracking.averageConfirmationTime.toFixed(1)}s
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
              <option value="all">All</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
              <option value="pending">Pending</option>
            </select>
          </div>
          
          <div className="filter-summary">
            Showing {processedTransactions.transactions.length} of {processedTransactions.totalCount} transactions
          </div>
        </div>
      )}

      {/* Transaction Table */}
      <div className="table-container">
        <table className="transactions-table">
          <thead>
            <tr>
              <th>Status</th>
              <th 
                className={`sortable ${sortField === 'timestamp' ? 'active' : ''}`}
                onClick={() => handleSort('timestamp')}
              >
                Time
                <span className="sort-indicator">
                  {sortField === 'timestamp' && (sortDirection === 'asc' ? '↑' : '↓')}
                </span>
              </th>
              <th>Hash</th>
              <th>From</th>
              <th>To</th>
              <th 
                className={`sortable ${sortField === 'value' ? 'active' : ''}`}
                onClick={() => handleSort('value')}
              >
                Value (BNB)
                <span className="sort-indicator">
                  {sortField === 'value' && (sortDirection === 'asc' ? '↑' : '↓')}
                </span>
              </th>
              <th 
                className={`sortable ${sortField === 'gasUsed' ? 'active' : ''}`}
                onClick={() => handleSort('gasUsed')}
              >
                Gas Used
                <span className="sort-indicator">
                  {sortField === 'gasUsed' && (sortDirection === 'asc' ? '↑' : '↓')}
                </span>
              </th>
              <th>Gas Price</th>
              <th>Confirmation</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {processedTransactions.transactions.map((tx, index) => {
              const status = getStatusDisplay(tx.status);
              
              return (
                <tr key={`${tx.hash}-${index}`} className={`transaction-row status-${tx.status}`}>
                  <td className="status-cell">
                    <span 
                      className="status-badge"
                      style={{ color: status.color }}
                    >
                      <span className="status-icon">{status.icon}</span>
                      {status.label}
                    </span>
                  </td>
                  
                  <td className="time-cell">
                    <div className="time-display">
                      <span className="time-relative">
                        {new Date(tx.timestamp).toLocaleTimeString()}
                      </span>
                      <span className="time-absolute">
                        {new Date(tx.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                  </td>
                  
                  <td className="hash-cell">
                    <div className="hash-display">
                      <span className="hash-short">
                        {tx.hash.slice(0, 6)}...{tx.hash.slice(-4)}
                      </span>
                      <button
                        className="copy-btn"
                        onClick={() => navigator.clipboard.writeText(tx.hash)}
                        title="Copy full hash"
                      >
                        📋
                      </button>
                    </div>
                  </td>
                  
                  <td className="address-cell">
                    <span className="address-short">
                      {tx.from.slice(0, 6)}...{tx.from.slice(-4)}
                    </span>
                  </td>
                  
                  <td className="address-cell">
                    <span className="address-short">
                      {tx.to.slice(0, 6)}...{tx.to.slice(-4)}
                    </span>
                  </td>
                  
                  <td className="value-cell">
                    <span className="value-amount">
                      {formatValue(tx.value)}
                    </span>
                  </td>
                  
                  <td className="gas-cell">
                    <span className="gas-amount">
                      {formatGas(tx.gasUsed)}
                    </span>
                  </td>
                  
                  <td className="gas-price-cell">
                    <span className="gas-price-amount">
                      {(parseInt(tx.gasPrice) / 1e9).toFixed(1)} Gwei
                    </span>
                  </td>
                  
                  <td className="confirmation-cell">
                    {tx.confirmationTime ? (
                      <span className="confirmation-time">
                        {tx.confirmationTime.toFixed(1)}s
                      </span>
                    ) : (
                      <span className="confirmation-pending">-</span>
                    )}
                  </td>
                  
                  <td className="actions-cell">
                    <div className="action-buttons">
                      <a
                        href={getBSCScanUrl(tx.hash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bscscan-btn"
                        title="View on BSCScan"
                      >
                        🔗
                      </a>
                      
                      {tx.error && (
                        <button
                          className="error-btn"
                          title={`Error: ${tx.error}`}
                        >
                          ⚠️
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {showPagination && processedTransactions.pageCount > 1 && (
        <div className="table-pagination">
          <div className="pagination-info">
            Page {currentPage} of {processedTransactions.pageCount}
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
              {Array.from({ length: Math.min(5, processedTransactions.pageCount) }, (_, i) => {
                const page = Math.max(1, currentPage - 2) + i;
                if (page <= processedTransactions.pageCount) {
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
              disabled={currentPage === processedTransactions.pageCount}
              onClick={() => setCurrentPage(currentPage + 1)}
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* Transaction Summary */}
      <div className="transaction-summary">
        <div className="summary-cards">
          <div className="summary-card successful">
            <div className="summary-icon">✅</div>
            <div className="summary-content">
              <span className="summary-label">Successful</span>
              <span className="summary-value">{metrics.transactionTracking.successfulTransactions}</span>
            </div>
          </div>
          
          <div className="summary-card failed">
            <div className="summary-icon">❌</div>
            <div className="summary-content">
              <span className="summary-label">Failed</span>
              <span className="summary-value">{metrics.transactionTracking.failedTransactions}</span>
            </div>
          </div>
          
          <div className="summary-card pending">
            <div className="summary-icon">⏳</div>
            <div className="summary-content">
              <span className="summary-label">Pending</span>
              <span className="summary-value">{metrics.transactionTracking.pendingTransactions}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransactionHistoryTable;