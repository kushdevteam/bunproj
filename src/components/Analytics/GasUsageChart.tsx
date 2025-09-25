/**
 * Gas Usage Chart Component
 * Bar chart showing gas usage optimization and efficiency metrics
 */

import React, { useMemo } from 'react';
import { useAnalyticsStore } from '../../store/analytics';
import type { GasEfficiencyPoint } from '../../services/analytics';

interface GasUsageChartProps {
  className?: string;
  height?: number;
  showOptimization?: boolean;
  showComparison?: boolean;
}

export const GasUsageChart: React.FC<GasUsageChartProps> = ({
  className = '',
  height = 300,
  showOptimization = true,
  showComparison = true
}) => {
  const { metrics, timeRange, isLoading } = useAnalyticsStore();

  // Process gas efficiency data for visualization
  const chartData = useMemo(() => {
    if (!metrics?.gasAnalytics?.gasEfficiencyTrend) {
      return { 
        dataPoints: [], 
        maxEstimated: 0, 
        maxActual: 0, 
        totalSavings: 0,
        avgEfficiency: 0
      };
    }

    const trend = metrics.gasAnalytics.gasEfficiencyTrend;
    if (trend.length === 0) {
      return { 
        dataPoints: [], 
        maxEstimated: 0, 
        maxActual: 0, 
        totalSavings: 0,
        avgEfficiency: 0
      };
    }

    const maxEstimated = Math.max(...trend.map(p => p.estimatedGas));
    const maxActual = Math.max(...trend.map(p => p.actualGas));
    const maxValue = Math.max(maxEstimated, maxActual);

    const dataPoints = trend.map((point, index) => ({
      ...point,
      x: (index / Math.max(trend.length - 1, 1)) * 100,
      estimatedHeight: (point.estimatedGas / maxValue) * 80, // 80% of chart height
      actualHeight: (point.actualGas / maxValue) * 80,
      efficiencyPercent: point.efficiency,
    }));

    const totalSavings = trend.reduce((sum, p) => sum + p.savings, 0);
    const avgEfficiency = trend.reduce((sum, p) => sum + p.efficiency, 0) / trend.length;

    return { 
      dataPoints, 
      maxEstimated, 
      maxActual, 
      totalSavings,
      avgEfficiency
    };
  }, [metrics]);

  // Calculate gas price in Gwei
  const currentGasPriceGwei = useMemo(() => {
    if (!metrics?.gasAnalytics?.currentGasPrice) return 0;
    return parseInt(metrics.gasAnalytics.currentGasPrice) / 1e9;
  }, [metrics]);

  // Format gas amount
  const formatGasAmount = (gas: number) => {
    if (gas >= 1000000) return `${(gas / 1000000).toFixed(1)}M`;
    if (gas >= 1000) return `${(gas / 1000).toFixed(1)}K`;
    return gas.toString();
  };

  // Format time labels
  const formatTimeLabel = (timestamp: Date) => {
    if (timeRange.granularity === 'minute') {
      return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (timeRange.granularity === 'hour') {
      return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (timeRange.granularity === 'day') {
      return timestamp.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } else {
      return timestamp.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  if (isLoading) {
    return (
      <div className={`gas-usage-chart loading ${className}`} style={{ height }}>
        <div className="chart-loading">
          <div className="loading-spinner"></div>
          <span>Loading gas usage data...</span>
        </div>
      </div>
    );
  }

  if (!metrics || chartData.dataPoints.length === 0) {
    return (
      <div className={`gas-usage-chart empty ${className}`} style={{ height }}>
        <div className="chart-empty">
          <div className="empty-icon">⛽</div>
          <h4>No Gas Usage Data</h4>
          <p>Execute transactions to see gas optimization metrics</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`gas-usage-chart ${className}`} style={{ height }}>
      {/* Chart Header */}
      <div className="chart-header">
        <div className="chart-title-section">
          <h3 className="chart-title">Gas Usage Optimization</h3>
          <div className="chart-subtitle">
            Estimated vs Actual gas usage • {chartData.dataPoints.length} transactions
          </div>
        </div>
        
        <div className="chart-stats">
          <div className="stat-item">
            <span className="stat-label">Current Price</span>
            <span className="stat-value gas-price">
              {currentGasPriceGwei.toFixed(1)} Gwei
            </span>
          </div>
          
          <div className="stat-item">
            <span className="stat-label">Avg Efficiency</span>
            <span className="stat-value efficiency">
              {chartData.avgEfficiency.toFixed(1)}%
            </span>
          </div>
          
          <div className="stat-item">
            <span className="stat-label">Total Savings</span>
            <span className="stat-value savings">
              {formatGasAmount(chartData.totalSavings)} gas
            </span>
          </div>
        </div>
      </div>

      {/* Chart SVG */}
      <div className="chart-container">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="chart-svg"
        >
          {/* Grid lines */}
          <defs>
            <pattern id="gasGrid" width="10" height="10" patternUnits="userSpaceOnUse">
              <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5"/>
            </pattern>
            
            {/* Gradients for bars */}
            <linearGradient id="estimatedGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(239, 68, 68, 0.8)" />
              <stop offset="100%" stopColor="rgba(239, 68, 68, 0.4)" />
            </linearGradient>
            
            <linearGradient id="actualGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(34, 197, 94, 0.8)" />
              <stop offset="100%" stopColor="rgba(34, 197, 94, 0.4)" />
            </linearGradient>
          </defs>
          
          {/* Grid */}
          <rect width="100" height="100" fill="url(#gasGrid)" />
          
          {/* Horizontal reference lines */}
          <line x1="0" y1="20" x2="100" y2="20" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
          <line x1="0" y1="40" x2="100" y2="40" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
          <line x1="0" y1="60" x2="100" y2="60" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
          <line x1="0" y1="80" x2="100" y2="80" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
          
          {/* Gas usage bars */}
          {chartData.dataPoints.map((point, index) => {
            const barWidth = Math.max(1, 80 / chartData.dataPoints.length);
            const barSpacing = 0.5;
            const groupX = point.x - barWidth;
            
            return (
              <g key={index}>
                {/* Estimated gas bar */}
                <rect
                  x={groupX - barSpacing}
                  y={100 - point.estimatedHeight - 10}
                  width={barWidth / 2}
                  height={point.estimatedHeight}
                  fill="url(#estimatedGradient)"
                  className="estimated-bar"
                />
                
                {/* Actual gas bar */}
                <rect
                  x={groupX + barWidth / 2 + barSpacing}
                  y={100 - point.actualHeight - 10}
                  width={barWidth / 2}
                  height={point.actualHeight}
                  fill="url(#actualGradient)"
                  className="actual-bar"
                />
                
                {/* Efficiency indicator */}
                {showOptimization && point.efficiency > 0 && (
                  <circle
                    cx={point.x}
                    cy={5}
                    r="1.5"
                    fill={point.efficiency > 10 ? "#22c55e" : point.efficiency > 5 ? "#f59e0b" : "#ef4444"}
                    className="efficiency-indicator"
                  />
                )}
              </g>
            );
          })}
        </svg>
        
        {/* Y-axis labels */}
        <div className="y-axis-labels">
          <span className="y-label" style={{ bottom: '80%' }}>
            {formatGasAmount(chartData.maxEstimated)}
          </span>
          <span className="y-label" style={{ bottom: '60%' }}>
            {formatGasAmount(chartData.maxEstimated * 0.75)}
          </span>
          <span className="y-label" style={{ bottom: '40%' }}>
            {formatGasAmount(chartData.maxEstimated * 0.5)}
          </span>
          <span className="y-label" style={{ bottom: '20%' }}>
            {formatGasAmount(chartData.maxEstimated * 0.25)}
          </span>
          <span className="y-label" style={{ bottom: '0%' }}>0</span>
        </div>
        
        {/* X-axis labels */}
        <div className="x-axis-labels">
          {chartData.dataPoints.length > 0 && (
            <>
              <span className="x-label" style={{ left: '0%' }}>
                {formatTimeLabel(chartData.dataPoints[0].timestamp)}
              </span>
              {chartData.dataPoints.length > 2 && (
                <span className="x-label" style={{ left: '50%' }}>
                  {formatTimeLabel(chartData.dataPoints[Math.floor(chartData.dataPoints.length / 2)].timestamp)}
                </span>
              )}
              <span className="x-label" style={{ right: '0%' }}>
                {formatTimeLabel(chartData.dataPoints[chartData.dataPoints.length - 1].timestamp)}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Legend and Gas Breakdown */}
      <div className="chart-breakdown">
        {/* Legend */}
        <div className="chart-legend">
          <div className="legend-item">
            <div className="legend-color estimated"></div>
            <span className="legend-label">Estimated Gas</span>
          </div>
          <div className="legend-item">
            <div className="legend-color actual"></div>
            <span className="legend-label">Actual Gas</span>
          </div>
          {showOptimization && (
            <div className="legend-item">
              <div className="legend-color efficiency"></div>
              <span className="legend-label">Efficiency Score</span>
            </div>
          )}
        </div>
        
        {/* Gas Price Recommendations */}
        {metrics.gasAnalytics.gasPriceRecommendations && (
          <div className="gas-recommendations">
            <h5>Gas Price Recommendations</h5>
            <div className="recommendation-grid">
              <div className="recommendation-item slow">
                <span className="rec-label">Slow</span>
                <span className="rec-value">
                  {(parseInt(metrics.gasAnalytics.gasPriceRecommendations.slow) / 1e9).toFixed(1)} Gwei
                </span>
              </div>
              <div className="recommendation-item standard">
                <span className="rec-label">Standard</span>
                <span className="rec-value">
                  {(parseInt(metrics.gasAnalytics.gasPriceRecommendations.standard) / 1e9).toFixed(1)} Gwei
                </span>
              </div>
              <div className="recommendation-item fast">
                <span className="rec-label">Fast</span>
                <span className="rec-value">
                  {(parseInt(metrics.gasAnalytics.gasPriceRecommendations.fast) / 1e9).toFixed(1)} Gwei
                </span>
              </div>
            </div>
            <div className="recommendation-note">
              <span className="note-icon">💡</span>
              <span className="note-text">{metrics.gasAnalytics.gasPriceRecommendations.reasoning}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GasUsageChart;