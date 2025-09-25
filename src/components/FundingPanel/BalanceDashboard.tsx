/**
 * BalanceDashboard - Visual balance overview component
 * Displays wallet balance statistics and distribution visualization
 */

import React, { useMemo } from 'react';
import { useWalletStore } from '../../store/wallets';
import { Role } from '../../types';

interface BalanceStats {
  totalBalance: number;
  selectedBalance: number;
  averageBalance: number;
  medianBalance: number;
  roleDistribution: Record<Role, { count: number; totalBalance: number; avgBalance: number }>;
  balanceRanges: {
    zero: number;
    low: number; // 0 < balance <= 0.01
    medium: number; // 0.01 < balance <= 0.1
    high: number; // balance > 0.1
  };
}

export const BalanceDashboard: React.FC = () => {
  const { wallets, selectedWallets } = useWalletStore();

  // Calculate comprehensive balance statistics
  const stats: BalanceStats = useMemo(() => {
    const totalBalance = wallets.reduce((sum, wallet) => sum + wallet.balance, 0);
    const selectedBalance = wallets
      .filter(wallet => selectedWallets.includes(wallet.id))
      .reduce((sum, wallet) => sum + wallet.balance, 0);

    // Sort balances for median calculation
    const sortedBalances = wallets.map(w => w.balance).sort((a, b) => a - b);
    const medianBalance = sortedBalances.length > 0 
      ? sortedBalances.length % 2 === 0
        ? (sortedBalances[sortedBalances.length / 2 - 1] + sortedBalances[sortedBalances.length / 2]) / 2
        : sortedBalances[Math.floor(sortedBalances.length / 2)]
      : 0;

    const averageBalance = wallets.length > 0 ? totalBalance / wallets.length : 0;

    // Role-based distribution
    const roleDistribution = wallets.reduce((acc, wallet) => {
      if (!acc[wallet.role]) {
        acc[wallet.role] = { count: 0, totalBalance: 0, avgBalance: 0 };
      }
      acc[wallet.role].count++;
      acc[wallet.role].totalBalance += wallet.balance;
      return acc;
    }, {} as Record<Role, { count: number; totalBalance: number; avgBalance: number }>);

    // Calculate average balance per role
    Object.keys(roleDistribution).forEach(role => {
      const roleData = roleDistribution[role as Role];
      roleData.avgBalance = roleData.count > 0 ? roleData.totalBalance / roleData.count : 0;
    });

    // Balance range distribution
    const balanceRanges = wallets.reduce(
      (ranges, wallet) => {
        if (wallet.balance === 0) ranges.zero++;
        else if (wallet.balance <= 0.01) ranges.low++;
        else if (wallet.balance <= 0.1) ranges.medium++;
        else ranges.high++;
        return ranges;
      },
      { zero: 0, low: 0, medium: 0, high: 0 }
    );

    return {
      totalBalance,
      selectedBalance,
      averageBalance,
      medianBalance,
      roleDistribution,
      balanceRanges,
    };
  }, [wallets, selectedWallets]);

  // Role colors for visualization
  const getRoleColor = (role: Role): string => {
    switch (role) {
      case Role.DEV:
        return '#3b82f6'; // Blue
      case Role.MEV:
        return '#ef4444'; // Red
      case Role.FUNDER:
        return '#10b981'; // Green
      case Role.NUMBERED:
        return '#f59e0b'; // Orange
      default:
        return '#6b7280'; // Gray
    }
  };

  // Get role display name
  const getRoleDisplayName = (role: Role): string => {
    switch (role) {
      case Role.DEV:
        return 'Developer';
      case Role.MEV:
        return 'MEV';
      case Role.FUNDER:
        return 'Funder';
      case Role.NUMBERED:
        return 'Numbered';
      default:
        return 'Unknown';
    }
  };

  // Format balance for display
  const formatBalance = (balance: number): string => {
    if (balance === 0) return '0';
    if (balance < 0.001) return balance.toFixed(6);
    if (balance < 1) return balance.toFixed(4);
    return balance.toFixed(2);
  };

  return (
    <div className="balance-dashboard">
      {/* Summary Cards */}
      <div className="summary-cards">
        <div className="summary-card total-balance">
          <div className="card-header">
            <i className="fas fa-coins"></i>
            <h3>Total Balance</h3>
          </div>
          <div className="card-value">
            {formatBalance(stats.totalBalance)} <span className="currency">BNB</span>
          </div>
          <div className="card-subtitle">
            Across {wallets.length} wallets
          </div>
        </div>

        <div className="summary-card selected-balance">
          <div className="card-header">
            <i className="fas fa-check-circle"></i>
            <h3>Selected Balance</h3>
          </div>
          <div className="card-value">
            {formatBalance(stats.selectedBalance)} <span className="currency">BNB</span>
          </div>
          <div className="card-subtitle">
            {selectedWallets.length} wallets selected
          </div>
        </div>

        <div className="summary-card average-balance">
          <div className="card-header">
            <i className="fas fa-chart-line"></i>
            <h3>Average Balance</h3>
          </div>
          <div className="card-value">
            {formatBalance(stats.averageBalance)} <span className="currency">BNB</span>
          </div>
          <div className="card-subtitle">
            Median: {formatBalance(stats.medianBalance)} BNB
          </div>
        </div>

        <div className="summary-card zero-balance">
          <div className="card-header">
            <i className="fas fa-exclamation-triangle"></i>
            <h3>Zero Balance</h3>
          </div>
          <div className="card-value">
            {stats.balanceRanges.zero}
          </div>
          <div className="card-subtitle">
            {wallets.length > 0 ? ((stats.balanceRanges.zero / wallets.length) * 100).toFixed(1) : 0}% of wallets
          </div>
        </div>
      </div>

      {/* Role Distribution */}
      <div className="role-distribution">
        <h3>
          <i className="fas fa-users"></i>
          Balance by Role
        </h3>
        <div className="role-cards">
          {Object.entries(stats.roleDistribution).map(([role, data]) => (
            <div
              key={role}
              className="role-card"
              style={{ borderLeftColor: getRoleColor(role as Role) }}
            >
              <div className="role-header">
                <span className="role-name">{getRoleDisplayName(role as Role)}</span>
                <span className="role-count">{data.count} wallets</span>
              </div>
              <div className="role-balance">
                <div className="total-balance">
                  <span className="label">Total:</span>
                  <span className="value">{formatBalance(data.totalBalance)} BNB</span>
                </div>
                <div className="avg-balance">
                  <span className="label">Avg:</span>
                  <span className="value">{formatBalance(data.avgBalance)} BNB</span>
                </div>
              </div>
              <div className="role-percentage">
                {stats.totalBalance > 0 
                  ? ((data.totalBalance / stats.totalBalance) * 100).toFixed(1)
                  : 0}% of total
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Balance Distribution Chart */}
      <div className="balance-distribution">
        <h3>
          <i className="fas fa-chart-pie"></i>
          Balance Distribution
        </h3>
        <div className="distribution-chart">
          <div className="chart-bars">
            <div className="chart-bar">
              <div className="bar-label">Zero (0 BNB)</div>
              <div className="bar-container">
                <div
                  className="bar-fill zero"
                  style={{
                    width: wallets.length > 0 
                      ? `${(stats.balanceRanges.zero / wallets.length) * 100}%`
                      : '0%'
                  }}
                ></div>
              </div>
              <div className="bar-value">{stats.balanceRanges.zero}</div>
            </div>

            <div className="chart-bar">
              <div className="bar-label">Low (0-0.01 BNB)</div>
              <div className="bar-container">
                <div
                  className="bar-fill low"
                  style={{
                    width: wallets.length > 0 
                      ? `${(stats.balanceRanges.low / wallets.length) * 100}%`
                      : '0%'
                  }}
                ></div>
              </div>
              <div className="bar-value">{stats.balanceRanges.low}</div>
            </div>

            <div className="chart-bar">
              <div className="bar-label">Medium (0.01-0.1 BNB)</div>
              <div className="bar-container">
                <div
                  className="bar-fill medium"
                  style={{
                    width: wallets.length > 0 
                      ? `${(stats.balanceRanges.medium / wallets.length) * 100}%`
                      : '0%'
                  }}
                ></div>
              </div>
              <div className="bar-value">{stats.balanceRanges.medium}</div>
            </div>

            <div className="chart-bar">
              <div className="bar-label">High (&gt;0.1 BNB)</div>
              <div className="bar-container">
                <div
                  className="bar-fill high"
                  style={{
                    width: wallets.length > 0 
                      ? `${(stats.balanceRanges.high / wallets.length) * 100}%`
                      : '0%'
                  }}
                ></div>
              </div>
              <div className="bar-value">{stats.balanceRanges.high}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="dashboard-actions">
        <h3>
          <i className="fas fa-bolt"></i>
          Quick Actions
        </h3>
        <div className="action-buttons">
          <button className="action-btn fund-zero">
            <i className="fas fa-plus-circle"></i>
            <span>Fund Zero Balance</span>
            <small>{stats.balanceRanges.zero} wallets</small>
          </button>
          <button className="action-btn fund-low">
            <i className="fas fa-level-up-alt"></i>
            <span>Top Up Low Balance</span>
            <small>{stats.balanceRanges.low} wallets</small>
          </button>
          <button className="action-btn equal-distribution">
            <i className="fas fa-balance-scale"></i>
            <span>Equal Distribution</span>
            <small>All selected wallets</small>
          </button>
          <button className="action-btn treasury-withdraw">
            <i className="fas fa-university"></i>
            <span>Collect to Treasury</span>
            <small>{formatBalance(stats.totalBalance)} BNB total</small>
          </button>
        </div>
      </div>
    </div>
  );
};