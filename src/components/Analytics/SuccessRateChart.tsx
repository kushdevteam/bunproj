/**
 * Success Rate Chart Component
 * Line chart showing bundle success rates over time with trend analysis
 */

import React, { useMemo } from 'react';
import { useAnalyticsStore } from '../../store/analytics';
import type { PerformanceTrend } from '../../services/analytics';

interface SuccessRateChartProps {
  className?: string;
  height?: number;
  showTrendline?: boolean;
  showTooltips?: boolean;
}

export const SuccessRateChart: React.FC<SuccessRateChartProps> = ({
  className = '',
  height = 300,
  showTrendline = true,
  showTooltips = true
}) => {
  const { metrics, timeRange, isLoading } = useAnalyticsStore();

  // Process trend data for visualization
  const chartData = useMemo(() => {
    if (!metrics?.bundlePerformance?.performanceTrend) {
      return { dataPoints: [], maxValue: 100, minValue: 0 };
    }

    const trend = metrics.bundlePerformance.performanceTrend;
    if (trend.length === 0) {
      return { dataPoints: [], maxValue: 100, minValue: 0 };
    }

    const dataPoints = trend.map((point, index) => ({
      ...point,
      x: (index / (trend.length - 1)) * 100, // Convert to percentage for positioning
      y: 100 - point.successRate, // Invert for SVG coordinate system
    }));

    const maxValue = Math.max(...trend.map(p => p.successRate));
    const minValue = Math.min(...trend.map(p => p.successRate));

    return { dataPoints, maxValue, minValue };
  }, [metrics]);

  // Generate SVG path for the success rate line
  const generatePath = (points: any[]) => {
    if (points.length === 0) return '';
    
    const commands = points.map((point, index) => {
      const command = index === 0 ? 'M' : 'L';
      return `${command} ${point.x} ${point.y}`;
    });
    
    return commands.join(' ');
  };

  // Generate area path for gradient fill
  const generateAreaPath = (points: any[]) => {
    if (points.length === 0) return '';
    
    const pathCommands = points.map((point, index) => {
      const command = index === 0 ? 'M' : 'L';
      return `${command} ${point.x} ${point.y}`;
    });
    
    // Close the path at the bottom
    const lastPoint = points[points.length - 1];
    const firstPoint = points[0];
    pathCommands.push(`L ${lastPoint.x} 100`);
    pathCommands.push(`L ${firstPoint.x} 100`);
    pathCommands.push('Z');
    
    return pathCommands.join(' ');
  };

  // Calculate trend direction
  const trendDirection = useMemo(() => {
    if (chartData.dataPoints.length < 2) return 'stable';
    
    const recent = chartData.dataPoints.slice(-3);
    const older = chartData.dataPoints.slice(0, 3);
    
    const recentAvg = recent.reduce((sum, p) => sum + (100 - p.y), 0) / recent.length;
    const olderAvg = older.reduce((sum, p) => sum + (100 - p.y), 0) / older.length;
    
    const diff = recentAvg - olderAvg;
    
    if (diff > 2) return 'up';
    if (diff < -2) return 'down';
    return 'stable';
  }, [chartData]);

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
      <div className={`success-rate-chart loading ${className}`} style={{ height }}>
        <div className="chart-loading">
          <div className="loading-spinner"></div>
          <span>Loading success rate data...</span>
        </div>
      </div>
    );
  }

  if (!metrics || chartData.dataPoints.length === 0) {
    return (
      <div className={`success-rate-chart empty ${className}`} style={{ height }}>
        <div className="chart-empty">
          <div className="empty-icon">📈</div>
          <h4>No Success Rate Data</h4>
          <p>Execute some bundles to see success rate trends</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`success-rate-chart ${className}`} style={{ height }}>
      {/* Chart Header */}
      <div className="chart-header">
        <div className="chart-title-section">
          <h3 className="chart-title">Bundle Success Rate</h3>
          <div className="chart-subtitle">
            Success rate over {timeRange.period} • {chartData.dataPoints.length} data points
          </div>
        </div>
        
        <div className="chart-stats">
          <div className="stat-item">
            <span className="stat-label">Current</span>
            <span className="stat-value success-rate">
              {chartData.dataPoints.length > 0 
                ? `${(100 - chartData.dataPoints[chartData.dataPoints.length - 1].y).toFixed(1)}%`
                : '0%'
              }
            </span>
          </div>
          
          <div className="stat-item">
            <span className="stat-label">Trend</span>
            <span className={`stat-value trend-${trendDirection}`}>
              {trendDirection === 'up' && '↗ Improving'}
              {trendDirection === 'down' && '↘ Declining'}
              {trendDirection === 'stable' && '→ Stable'}
            </span>
          </div>
          
          <div className="stat-item">
            <span className="stat-label">Average</span>
            <span className="stat-value">
              {metrics.bundlePerformance.successRate.toFixed(1)}%
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
            <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
              <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5"/>
            </pattern>
            
            {/* Gradient for area fill */}
            <linearGradient id="successGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(34, 197, 94, 0.3)" />
              <stop offset="100%" stopColor="rgba(34, 197, 94, 0.05)" />
            </linearGradient>
          </defs>
          
          {/* Grid */}
          <rect width="100" height="100" fill="url(#grid)" />
          
          {/* Horizontal reference lines */}
          <line x1="0" y1="25" x2="100" y2="25" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
          <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
          <line x1="0" y1="75" x2="100" y2="75" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
          
          {/* Area fill */}
          {chartData.dataPoints.length > 1 && (
            <path
              d={generateAreaPath(chartData.dataPoints)}
              fill="url(#successGradient)"
            />
          )}
          
          {/* Success rate line */}
          {chartData.dataPoints.length > 1 && (
            <path
              d={generatePath(chartData.dataPoints)}
              fill="none"
              stroke="#22c55e"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="success-line"
            />
          )}
          
          {/* Data points */}
          {chartData.dataPoints.map((point, index) => (
            <circle
              key={index}
              cx={point.x}
              cy={point.y}
              r="2"
              fill="#22c55e"
              stroke="#ffffff"
              strokeWidth="1"
              className="data-point"
            />
          ))}
        </svg>
        
        {/* Y-axis labels */}
        <div className="y-axis-labels">
          <span className="y-label" style={{ bottom: '75%' }}>100%</span>
          <span className="y-label" style={{ bottom: '50%' }}>75%</span>
          <span className="y-label" style={{ bottom: '25%' }}>50%</span>
          <span className="y-label" style={{ bottom: '0%' }}>25%</span>
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

      {/* Success Rate Breakdown */}
      <div className="chart-breakdown">
        <div className="breakdown-item success">
          <div className="breakdown-icon">✅</div>
          <div className="breakdown-content">
            <span className="breakdown-label">Successful</span>
            <span className="breakdown-value">{metrics.bundlePerformance.successfulExecutions}</span>
          </div>
        </div>
        
        <div className="breakdown-item failed">
          <div className="breakdown-icon">❌</div>
          <div className="breakdown-content">
            <span className="breakdown-label">Failed</span>
            <span className="breakdown-value">{metrics.bundlePerformance.failedExecutions}</span>
          </div>
        </div>
        
        <div className="breakdown-item total">
          <div className="breakdown-icon">📦</div>
          <div className="breakdown-content">
            <span className="breakdown-label">Total</span>
            <span className="breakdown-value">{metrics.bundlePerformance.totalExecutions}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuccessRateChart;