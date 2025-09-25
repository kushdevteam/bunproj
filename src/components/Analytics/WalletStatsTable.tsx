/**
 * Wallet Stats Table Component
 * Detailed wallet analytics and performance metrics
 */

import React, { useMemo, useState } from 'react';
import { useAnalyticsStore } from '../../store/analytics';
import { useWalletStore } from '../../store/wallets';
import type { WalletActivityLevel, WalletPerformanceScore } from '../../services/analytics';
import { Role } from '../../types';

interface WalletStatsTableProps {
  className?: string;
  maxRows?: number;
  showPagination?: boolean;
  showFilters?: boolean;
}

export const WalletStatsTable: React.FC<WalletStatsTableProps> = ({
  className = '',
  maxRows = 15,
  showPagination = true,
  showFilters = true
}) => {
  const { metrics, isLoading } = useAnalyticsStore();
  const { wallets } = useWalletStore();
  
  const [currentPage, setCurrentPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState<'all' | Role>('all');
  const [performanceFilter, setPerformanceFilter] = useState<'all' | 'excellent' | 'good' | 'average' | 'poor'>('all');
  const [sortField, setSortField] = useState<'balance' | 'activityScore' | 'transactionCount' | 'lastActivity'>('activityScore');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Combine wallet data with analytics metrics
  const processedWallets = useMemo(() => {
    if (!metrics?.walletAnalytics || !wallets.length) {
      return { wallets: [], totalCount: 0, pageCount: 0 };
    }

    const { activityLevels, performanceScores } = metrics.walletAnalytics;
    
    // Create enriched wallet data
    let enrichedWallets = wallets.map(wallet => {
      const activityData = activityLevels.find(a => a.walletId === wallet.id);
      const performanceData = performanceScores.find(p => p.walletId === wallet.id);
      
      return {
        ...wallet,
        activityScore: activityData?.activityScore || 0,
        transactionCount: activityData?.transactionCount || 0,
        lastActivity: activityData?.lastActivity || new Date(wallet.createdAt),
        performanceRating: activityData?.performanceRating || 'poor',
        performanceScore: performanceData?.score || 0,
        performanceMetrics: performanceData?.metrics || {
          transactionSuccess: 0,
          gasEfficiency: 0,
          responseTime: 0,
          reliability: 0
        }
      };
    });

    // Apply filters
    if (roleFilter !== 'all') {
      enrichedWallets = enrichedWallets.filter(w => w.role === roleFilter);
    }
    
    if (performanceFilter !== 'all') {
      enrichedWallets = enrichedWallets.filter(w => w.performanceRating === performanceFilter);
    }

    // Apply sorting
    enrichedWallets.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortField) {
        case 'balance':
          aValue = a.balance;
          bValue = b.balance;
          break;
        case 'activityScore':
          aValue = a.activityScore;
          bValue = b.activityScore;
          break;
        case 'transactionCount':
          aValue = a.transactionCount;
          bValue = b.transactionCount;
          break;
        case 'lastActivity':
          aValue = new Date(a.lastActivity).getTime();
          bValue = new Date(b.lastActivity).getTime();
          break;
        default:
          aValue = a.activityScore;
          bValue = b.activityScore;
      }

      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    const totalCount = enrichedWallets.length;
    const pageCount = Math.ceil(totalCount / maxRows);

    // Apply pagination
    if (showPagination) {
      const startIndex = (currentPage - 1) * maxRows;
      enrichedWallets = enrichedWallets.slice(startIndex, startIndex + maxRows);
    } else {
      enrichedWallets = enrichedWallets.slice(0, maxRows);
    }

    return { wallets: enrichedWallets, totalCount, pageCount };
  }, [metrics, wallets, roleFilter, performanceFilter, sortField, sortDirection, currentPage, maxRows, showPagination]);

  // Get performance rating color and icon
  const getPerformanceDisplay = (rating: string) => {
    switch (rating) {
      case 'excellent':
        return { color: '#22c55e', icon: '🟢', label: 'Excellent' };
      case 'good':
        return { color: '#3b82f6', icon: '🔵', label: 'Good' };
      case 'average':
        return { color: '#f59e0b', icon: '🟡', label: 'Average' };
      case 'poor':
        return { color: '#ef4444', icon: '🔴', label: 'Poor' };
      default:
        return { color: '#6b7280', icon: '⚪', label: 'Unknown' };
    }
  };

  // Get role display
  const getRoleDisplay = (role: Role) => {
    const roleColors = {
      [Role.DEV]: '#8b5cf6',
      [Role.MEV]: '#06b6d4', 
      [Role.FUNDER]: '#22c55e',
      [Role.NUMBERED]: '#f59e0b'
    };
    
    return {
      color: roleColors[role] || '#6b7280',
      label: role.toString().toUpperCase()
    };
  };

  // Format balance
  const formatBalance = (balance: number) => {
    if (balance === 0) return '0';
    if (balance < 0.0001) return '<0.0001';
    return balance.toFixed(4);
  };

  // Format activity score
  const formatActivityScore = (score: number) => {
    return Math.round(score);
  };

  // Format time since last activity
  const formatLastActivity = (lastActivity: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - lastActivity.getTime();
    
    if (diffMs < 60000) return 'Just now';
    if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m ago`;
    if (diffMs < 86400000) return `${Math.floor(diffMs / 3600000)}h ago`;
    return `${Math.floor(diffMs / 86400000)}d ago`;
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
      <div className={`wallet-stats-table loading ${className}`}>
        <div className="table-loading">
          <div className="loading-spinner"></div>
          <span>Loading wallet statistics...</span>
        </div>
      </div>
    );
  }

  if (!metrics || processedWallets.totalCount === 0) {
    return (
      <div className={`wallet-stats-table empty ${className}`}>
        <div className="table-empty">
          <div className="empty-icon">👛</div>
          <h4>No Wallet Statistics</h4>
          <p>Generate wallets to see detailed analytics and performance metrics</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`wallet-stats-table ${className}`}>
      {/* Table Header */}
      <div className="table-header">
        <div className="table-title-section">
          <h3 className="table-title">Wallet Statistics</h3>
          <div className="table-subtitle">
            {processedWallets.totalCount} wallets • Performance and activity metrics
          </div>
        </div>
        
        <div className="table-stats">
          <div className="stat-item">
            <span className="stat-label">Total Balance</span>
            <span className="stat-value total-balance">
              {metrics.walletAnalytics.totalBalance.toFixed(4)} BNB
            </span>
          </div>
          
          <div className="stat-item">
            <span className="stat-label">Active Wallets</span>
            <span className="stat-value active-wallets">
              {metrics.walletAnalytics.activeWallets}
            </span>
          </div>
          
          <div className="stat-item">
            <span className="stat-label">Avg Balance</span>
            <span className="stat-value avg-balance">
              {metrics.walletAnalytics.averageBalance.toFixed(4)} BNB
            </span>
          </div>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="table-filters">
          <div className="filter-group">
            <label className="filter-label">Role:</label>
            <select
              className="filter-select"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as any)}
            >
              <option value="all">All Roles</option>
              <option value={Role.DEV}>Dev</option>
              <option value={Role.MEV}>MEV</option>
              <option value={Role.FUNDER}>Funder</option>
              <option value={Role.NUMBERED}>Numbered</option>
            </select>
          </div>
          
          <div className="filter-group">
            <label className="filter-label">Performance:</label>
            <select
              className="filter-select"
              value={performanceFilter}
              onChange={(e) => setPerformanceFilter(e.target.value as any)}
            >
              <option value="all">All Performance</option>
              <option value="excellent">Excellent</option>
              <option value="good">Good</option>
              <option value="average">Average</option>
              <option value="poor">Poor</option>
            </select>
          </div>
          
          <div className="filter-summary">
            Showing {processedWallets.wallets.length} of {processedWallets.totalCount} wallets
          </div>
        </div>
      )}

      {/* Wallet Stats Table */}
      <div className="table-container">
        <table className="wallet-stats-table-grid">
          <thead>
            <tr>
              <th>Address</th>
              <th>Role</th>
              <th 
                className={`sortable ${sortField === 'balance' ? 'active' : ''}`}
                onClick={() => handleSort('balance')}
              >
                Balance (BNB)
                <span className="sort-indicator">
                  {sortField === 'balance' && (sortDirection === 'asc' ? '↑' : '↓')}
                </span>
              </th>
              <th 
                className={`sortable ${sortField === 'activityScore' ? 'active' : ''}`}
                onClick={() => handleSort('activityScore')}
              >
                Activity Score
                <span className="sort-indicator">
                  {sortField === 'activityScore' && (sortDirection === 'asc' ? '↑' : '↓')}
                </span>
              </th>
              <th 
                className={`sortable ${sortField === 'transactionCount' ? 'active' : ''}`}
                onClick={() => handleSort('transactionCount')}
              >
                Transactions
                <span className="sort-indicator">
                  {sortField === 'transactionCount' && (sortDirection === 'asc' ? '↑' : '↓')}
                </span>
              </th>
              <th>Performance</th>
              <th>Success Rate</th>
              <th>Gas Efficiency</th>
              <th 
                className={`sortable ${sortField === 'lastActivity' ? 'active' : ''}`}
                onClick={() => handleSort('lastActivity')}
              >
                Last Activity
                <span className="sort-indicator">
                  {sortField === 'lastActivity' && (sortDirection === 'asc' ? '↑' : '↓')}
                </span>
              </th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {processedWallets.wallets.map((wallet, index) => {
              const performance = getPerformanceDisplay(wallet.performanceRating);
              const role = getRoleDisplay(wallet.role);
              
              return (
                <tr key={wallet.id} className={`wallet-row performance-${wallet.performanceRating}`}>
                  <td className="address-cell">
                    <div className="address-display">
                      <span className="address-short">
                        {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
                      </span>
                      <button
                        className="copy-btn"
                        onClick={() => navigator.clipboard.writeText(wallet.address)}
                        title="Copy address"
                      >
                        📋
                      </button>
                    </div>
                  </td>
                  
                  <td className="role-cell">
                    <span 
                      className="role-badge"
                      style={{ color: role.color }}
                    >
                      {role.label}
                    </span>
                  </td>
                  
                  <td className="balance-cell">
                    <span className="balance-amount">
                      {formatBalance(wallet.balance)}
                    </span>
                  </td>
                  
                  <td className="activity-cell">
                    <div className="activity-score">
                      <span className="score-value">
                        {formatActivityScore(wallet.activityScore)}
                      </span>
                      <div 
                        className="score-bar"
                        style={{ 
                          background: `linear-gradient(90deg, ${performance.color} 0%, ${performance.color}40 100%)`,
                          width: `${Math.min(wallet.activityScore, 100)}%`
                        }}
                      />
                    </div>
                  </td>
                  
                  <td className="transaction-cell">
                    <span className="transaction-count">
                      {wallet.transactionCount}
                    </span>
                  </td>
                  
                  <td className="performance-cell">
                    <span 
                      className="performance-badge"
                      style={{ color: performance.color }}
                    >
                      <span className="performance-icon">{performance.icon}</span>
                      {performance.label}
                    </span>
                  </td>
                  
                  <td className="success-rate-cell">
                    <span className="success-rate">
                      {wallet.performanceMetrics.transactionSuccess.toFixed(1)}%
                    </span>
                  </td>
                  
                  <td className="gas-efficiency-cell">
                    <span className="gas-efficiency">
                      {wallet.performanceMetrics.gasEfficiency.toFixed(1)}%
                    </span>
                  </td>
                  
                  <td className="last-activity-cell">
                    <span className="last-activity">
                      {formatLastActivity(wallet.lastActivity)}
                    </span>
                  </td>
                  
                  <td className="status-cell">
                    <span className={`status-indicator ${wallet.isActive ? 'active' : 'inactive'}`}>
                      {wallet.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {showPagination && processedWallets.pageCount > 1 && (
        <div className="table-pagination">
          <div className="pagination-info">
            Page {currentPage} of {processedWallets.pageCount}
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
              {Array.from({ length: Math.min(5, processedWallets.pageCount) }, (_, i) => {
                const page = Math.max(1, currentPage - 2) + i;
                if (page <= processedWallets.pageCount) {
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
              disabled={currentPage === processedWallets.pageCount}
              onClick={() => setCurrentPage(currentPage + 1)}
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* Performance Summary */}
      <div className="performance-summary">
        <div className="summary-cards">
          <div className="summary-card excellent">
            <div className="summary-icon">🟢</div>
            <div className="summary-content">
              <span className="summary-label">Excellent Performance</span>
              <span className="summary-value">
                {processedWallets.wallets.filter(w => w.performanceRating === 'excellent').length}
              </span>
            </div>
          </div>
          
          <div className="summary-card good">
            <div className="summary-icon">🔵</div>
            <div className="summary-content">
              <span className="summary-label">Good Performance</span>
              <span className="summary-value">
                {processedWallets.wallets.filter(w => w.performanceRating === 'good').length}
              </span>
            </div>
          </div>
          
          <div className="summary-card average">
            <div className="summary-icon">🟡</div>
            <div className="summary-content">
              <span className="summary-label">Average Performance</span>
              <span className="summary-value">
                {processedWallets.wallets.filter(w => w.performanceRating === 'average').length}
              </span>
            </div>
          </div>
          
          <div className="summary-card poor">
            <div className="summary-icon">🔴</div>
            <div className="summary-content">
              <span className="summary-label">Poor Performance</span>
              <span className="summary-value">
                {processedWallets.wallets.filter(w => w.performanceRating === 'poor').length}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WalletStatsTable;