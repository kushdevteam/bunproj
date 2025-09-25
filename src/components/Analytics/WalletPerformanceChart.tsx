/**
 * Wallet Performance Chart Component
 * Pie chart showing wallet activity distribution and performance metrics
 */

import React, { useMemo } from 'react';
import { useAnalyticsStore } from '../../store/analytics';
import type { WalletActivityLevel } from '../../services/analytics';

interface WalletPerformanceChartProps {
  className?: string;
  height?: number;
  showLabels?: boolean;
  showLegend?: boolean;
}

export const WalletPerformanceChart: React.FC<WalletPerformanceChartProps> = ({
  className = '',
  height = 300,
  showLabels = true,
  showLegend = true
}) => {
  const { metrics, isLoading } = useAnalyticsStore();

  // Process wallet data for pie chart visualization
  const chartData = useMemo(() => {
    if (!metrics?.walletAnalytics) {
      return { segments: [], totalWallets: 0, performanceDistribution: [] };
    }

    const { roleDistribution, activityLevels } = metrics.walletAnalytics;
    
    // Create role-based segments for pie chart
    const segments = roleDistribution.map((role, index) => {
      const colors = [
        { primary: '#8b5cf6', secondary: '#a78bfa' }, // Purple
        { primary: '#06b6d4', secondary: '#22d3ee' }, // Cyan  
        { primary: '#22c55e', secondary: '#4ade80' }, // Green
        { primary: '#f59e0b', secondary: '#fbbf24' }, // Amber
        { primary: '#ef4444', secondary: '#f87171' }, // Red
      ];
      
      const color = colors[index % colors.length];
      const percentage = role.percentage;
      
      return {
        ...role,
        color,
        percentage,
        startAngle: 0, // Will be calculated below
        endAngle: 0,   // Will be calculated below
      };
    });

    // Calculate angles for pie segments
    let currentAngle = 0;
    segments.forEach(segment => {
      segment.startAngle = currentAngle;
      const angle = (segment.percentage / 100) * 360;
      segment.endAngle = currentAngle + angle;
      currentAngle += angle;
    });

    // Performance distribution
    const performanceDistribution = [
      {
        rating: 'excellent',
        count: activityLevels.filter(w => w.performanceRating === 'excellent').length,
        color: '#22c55e'
      },
      {
        rating: 'good', 
        count: activityLevels.filter(w => w.performanceRating === 'good').length,
        color: '#3b82f6'
      },
      {
        rating: 'average',
        count: activityLevels.filter(w => w.performanceRating === 'average').length,
        color: '#f59e0b'
      },
      {
        rating: 'poor',
        count: activityLevels.filter(w => w.performanceRating === 'poor').length,
        color: '#ef4444'
      }
    ];

    return {
      segments,
      totalWallets: metrics.walletAnalytics.totalWallets,
      performanceDistribution
    };
  }, [metrics]);

  // Generate SVG path for pie segment
  const generateArcPath = (
    centerX: number,
    centerY: number,
    radius: number,
    startAngle: number,
    endAngle: number
  ) => {
    const start = polarToCartesian(centerX, centerY, radius, endAngle);
    const end = polarToCartesian(centerX, centerY, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

    return [
      "M", centerX, centerY,
      "L", start.x, start.y,
      "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y,
      "Z"
    ].join(" ");
  };

  // Convert polar coordinates to cartesian
  const polarToCartesian = (
    centerX: number,
    centerY: number,
    radius: number,
    angleInDegrees: number
  ) => {
    const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
    return {
      x: centerX + (radius * Math.cos(angleInRadians)),
      y: centerY + (radius * Math.sin(angleInRadians))
    };
  };

  // Get label position for pie segment
  const getLabelPosition = (startAngle: number, endAngle: number, radius: number) => {
    const midAngle = (startAngle + endAngle) / 2;
    const labelRadius = radius * 0.7;
    return polarToCartesian(50, 50, labelRadius, midAngle);
  };

  if (isLoading) {
    return (
      <div className={`wallet-performance-chart loading ${className}`} style={{ height }}>
        <div className="chart-loading">
          <div className="loading-spinner"></div>
          <span>Loading wallet performance data...</span>
        </div>
      </div>
    );
  }

  if (!metrics || chartData.totalWallets === 0) {
    return (
      <div className={`wallet-performance-chart empty ${className}`} style={{ height }}>
        <div className="chart-empty">
          <div className="empty-icon">👛</div>
          <h4>No Wallet Performance Data</h4>
          <p>Generate wallets to see performance distribution</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`wallet-performance-chart ${className}`} style={{ height }}>
      {/* Chart Header */}
      <div className="chart-header">
        <div className="chart-title-section">
          <h3 className="chart-title">Wallet Performance Distribution</h3>
          <div className="chart-subtitle">
            Role distribution and activity levels • {chartData.totalWallets} total wallets
          </div>
        </div>
        
        <div className="chart-stats">
          <div className="stat-item">
            <span className="stat-label">Active</span>
            <span className="stat-value active-wallets">
              {metrics.walletAnalytics.activeWallets}
            </span>
          </div>
          
          <div className="stat-item">
            <span className="stat-label">Total Balance</span>
            <span className="stat-value total-balance">
              {metrics.walletAnalytics.totalBalance.toFixed(4)} BNB
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

      {/* Chart Content */}
      <div className="chart-content">
        <div className="chart-visualization">
          {/* Role Distribution Pie Chart */}
          <div className="pie-chart-container">
            <h4 className="chart-section-title">Role Distribution</h4>
            <svg viewBox="0 0 100 100" className="pie-chart-svg">
              {/* Pie segments */}
              {chartData.segments.map((segment, index) => (
                <g key={segment.role}>
                  <path
                    d={generateArcPath(50, 50, 40, segment.startAngle, segment.endAngle)}
                    fill={segment.color.primary}
                    stroke="#ffffff"
                    strokeWidth="0.5"
                    className="pie-segment"
                    style={{
                      filter: `drop-shadow(0 2px 4px ${segment.color.primary}40)`,
                    }}
                  />
                  
                  {/* Labels */}
                  {showLabels && segment.percentage > 5 && (
                    <g>
                      {(() => {
                        const labelPos = getLabelPosition(segment.startAngle, segment.endAngle, 40);
                        return (
                          <text
                            x={labelPos.x}
                            y={labelPos.y}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fill="#ffffff"
                            fontSize="3"
                            fontWeight="500"
                          >
                            {segment.percentage.toFixed(0)}%
                          </text>
                        );
                      })()}
                    </g>
                  )}
                </g>
              ))}
              
              {/* Center circle for donut effect */}
              <circle
                cx="50"
                cy="50"
                r="15"
                fill="rgba(0,0,0,0.5)"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="0.5"
              />
              
              {/* Center text */}
              <text
                x="50"
                y="48"
                textAnchor="middle"
                fill="#ffffff"
                fontSize="6"
                fontWeight="600"
              >
                {chartData.totalWallets}
              </text>
              <text
                x="50"
                y="54"
                textAnchor="middle"
                fill="rgba(255,255,255,0.7)"
                fontSize="3"
              >
                Wallets
              </text>
            </svg>
          </div>

          {/* Performance Distribution Bar Chart */}
          <div className="performance-chart-container">
            <h4 className="chart-section-title">Performance Levels</h4>
            <div className="performance-bars">
              {chartData.performanceDistribution.map((perf, index) => (
                <div key={perf.rating} className="performance-bar-item">
                  <div className="perf-bar-header">
                    <span className="perf-label">
                      {perf.rating.charAt(0).toUpperCase() + perf.rating.slice(1)}
                    </span>
                    <span className="perf-count">{perf.count}</span>
                  </div>
                  <div className="perf-bar-track">
                    <div
                      className="perf-bar-fill"
                      style={{
                        width: `${chartData.totalWallets > 0 ? (perf.count / chartData.totalWallets) * 100 : 0}%`,
                        backgroundColor: perf.color,
                        boxShadow: `0 0 8px ${perf.color}40`
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Legend */}
        {showLegend && (
          <div className="chart-legend">
            <div className="legend-section">
              <h5>Wallet Roles</h5>
              <div className="legend-items">
                {chartData.segments.map((segment) => (
                  <div key={segment.role} className="legend-item">
                    <div
                      className="legend-color"
                      style={{ backgroundColor: segment.color.primary }}
                    />
                    <span className="legend-label">{segment.role}</span>
                    <span className="legend-value">
                      {segment.count} ({segment.percentage.toFixed(1)}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Wallet Stats Summary */}
      <div className="wallet-stats-summary">
        <div className="stats-grid">
          <div className="stat-card balance-distribution">
            <h5>Balance Distribution</h5>
            <div className="balance-breakdown">
              {metrics.walletAnalytics.balanceDistribution.slice(0, 3).map((range, index) => (
                <div key={range.range} className="balance-range-item">
                  <span className="range-label">{range.range}</span>
                  <span className="range-count">{range.count} wallets</span>
                  <span className="range-percentage">{range.percentage.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="stat-card activity-summary">
            <h5>Activity Summary</h5>
            <div className="activity-metrics">
              <div className="activity-metric">
                <span className="activity-label">High Activity</span>
                <span className="activity-value">
                  {metrics.walletAnalytics.activityLevels.filter(w => w.activityScore > 70).length}
                </span>
              </div>
              <div className="activity-metric">
                <span className="activity-label">Medium Activity</span>
                <span className="activity-value">
                  {metrics.walletAnalytics.activityLevels.filter(w => w.activityScore > 40 && w.activityScore <= 70).length}
                </span>
              </div>
              <div className="activity-metric">
                <span className="activity-label">Low Activity</span>
                <span className="activity-value">
                  {metrics.walletAnalytics.activityLevels.filter(w => w.activityScore <= 40).length}
                </span>
              </div>
            </div>
          </div>

          <div className="stat-card top-performers">
            <h5>Top Performers</h5>
            <div className="top-performer-list">
              {metrics.walletAnalytics.activityLevels
                .sort((a, b) => b.activityScore - a.activityScore)
                .slice(0, 3)
                .map((wallet, index) => (
                  <div key={wallet.walletId} className="top-performer-item">
                    <span className="performer-rank">#{index + 1}</span>
                    <span className="performer-address">
                      {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
                    </span>
                    <span className="performer-score">{wallet.activityScore.toFixed(0)}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WalletPerformanceChart;