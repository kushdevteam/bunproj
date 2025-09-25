/**
 * Network Status Chart Component
 * Real-time network health indicators and gas price monitoring
 */

import React, { useMemo, useEffect, useState } from 'react';
import { useAnalyticsStore } from '../../store/analytics';
import { useNetworkStore } from '../../store/network';
import type { GasPricePoint, BlockInfo } from '../../services/analytics';

interface NetworkStatusChartProps {
  className?: string;
  height?: number;
  showGasPriceHistory?: boolean;
  showBlockTimes?: boolean;
}

export const NetworkStatusChart: React.FC<NetworkStatusChartProps> = ({
  className = '',
  height = 300,
  showGasPriceHistory = true,
  showBlockTimes = true
}) => {
  const { metrics, isLoading } = useAnalyticsStore();
  const { currentNetwork, isConnected, blockNumber, gasPrice } = useNetworkStore();
  const [realTimeUpdate, setRealTimeUpdate] = useState(new Date());

  // Update real-time indicator every second
  useEffect(() => {
    const interval = setInterval(() => {
      setRealTimeUpdate(new Date());
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);

  // Process network data for visualization
  const chartData = useMemo(() => {
    if (!metrics?.networkStats) {
      return {
        gasPriceHistory: [],
        blockHistory: [],
        maxGasPrice: 0,
        minGasPrice: 0,
        avgBlockTime: 3,
        congestionLevel: 'unknown' as const
      };
    }

    const { gasPriceHistory, blockHistory, averageBlockTime, networkCongestion } = metrics.networkStats;
    
    // Process gas price history for line chart
    const processedGasPrices = gasPriceHistory.slice(-20).map((point, index) => ({
      ...point,
      x: (index / Math.max(gasPriceHistory.length - 1, 1)) * 100,
      y: 0, // Will be calculated below
      gasPriceGwei: parseInt(point.gasPrice) / 1e9
    }));

    const maxGasPrice = Math.max(...processedGasPrices.map(p => p.gasPriceGwei));
    const minGasPrice = Math.min(...processedGasPrices.map(p => p.gasPriceGwei));
    const priceRange = Math.max(maxGasPrice - minGasPrice, 1);

    // Calculate Y positions for gas prices
    processedGasPrices.forEach(point => {
      point.y = 100 - ((point.gasPriceGwei - minGasPrice) / priceRange) * 80; // 80% of chart height
    });

    return {
      gasPriceHistory: processedGasPrices,
      blockHistory: blockHistory.slice(-10),
      maxGasPrice,
      minGasPrice,
      avgBlockTime: averageBlockTime,
      congestionLevel: networkCongestion
    };
  }, [metrics]);

  // Generate SVG path for gas price line
  const generateGasPricePath = (points: any[]) => {
    if (points.length === 0) return '';
    
    const commands = points.map((point, index) => {
      const command = index === 0 ? 'M' : 'L';
      return `${command} ${point.x} ${point.y}`;
    });
    
    return commands.join(' ');
  };

  // Get network status color
  const getNetworkStatusColor = () => {
    if (!isConnected) return '#ef4444'; // Red
    if (chartData.congestionLevel === 'low') return '#22c55e'; // Green
    if (chartData.congestionLevel === 'medium') return '#f59e0b'; // Amber
    if (chartData.congestionLevel === 'high') return '#ef4444'; // Red
    return '#6b7280'; // Gray
  };

  // Format gas price
  const formatGasPrice = (gasPrice: number) => {
    return gasPrice.toFixed(1);
  };

  // Format time since update
  const getTimeSinceUpdate = () => {
    if (!metrics?.lastUpdated) return 'Never';
    
    const now = realTimeUpdate;
    const updated = new Date(metrics.lastUpdated);
    const diffMs = now.getTime() - updated.getTime();
    
    if (diffMs < 60000) return `${Math.floor(diffMs / 1000)}s ago`;
    if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m ago`;
    return `${Math.floor(diffMs / 3600000)}h ago`;
  };

  if (isLoading) {
    return (
      <div className={`network-status-chart loading ${className}`} style={{ height }}>
        <div className="chart-loading">
          <div className="loading-spinner"></div>
          <span>Loading network status...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`network-status-chart ${className}`} style={{ height }}>
      {/* Chart Header */}
      <div className="chart-header">
        <div className="chart-title-section">
          <h3 className="chart-title">Network Status</h3>
          <div className="chart-subtitle">
            {currentNetwork.displayName} • Real-time monitoring
          </div>
        </div>
        
        <div className="chart-stats">
          <div className="stat-item">
            <span className="stat-label">Status</span>
            <span 
              className="stat-value network-status"
              style={{ color: getNetworkStatusColor() }}
            >
              <span className="status-indicator" style={{ backgroundColor: getNetworkStatusColor() }}></span>
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          
          <div className="stat-item">
            <span className="stat-label">Current Gas</span>
            <span className="stat-value gas-price">
              {gasPrice ? formatGasPrice(parseInt(gasPrice) / 1e9) : '0'} Gwei
            </span>
          </div>
          
          <div className="stat-item">
            <span className="stat-label">Block Time</span>
            <span className="stat-value block-time">
              {chartData.avgBlockTime.toFixed(1)}s
            </span>
          </div>
          
          <div className="stat-item">
            <span className="stat-label">Updated</span>
            <span className="stat-value update-time">
              {getTimeSinceUpdate()}
            </span>
          </div>
        </div>
      </div>

      {/* Network Status Cards */}
      <div className="network-status-cards">
        {/* Current Block Info */}
        <div className="status-card block-info">
          <div className="card-header">
            <span className="card-icon">🧱</span>
            <h4>Current Block</h4>
          </div>
          <div className="card-content">
            <div className="block-number">
              #{blockNumber?.toLocaleString() || 'N/A'}
            </div>
            <div className="block-details">
              <div className="detail-item">
                <span className="detail-label">Network</span>
                <span className="detail-value">{currentNetwork.name}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Chain ID</span>
                <span className="detail-value">{currentNetwork.chainId}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Gas Price Status */}
        <div className="status-card gas-status">
          <div className="card-header">
            <span className="card-icon">⛽</span>
            <h4>Gas Price Status</h4>
          </div>
          <div className="card-content">
            <div className="gas-price-main">
              {gasPrice ? formatGasPrice(parseInt(gasPrice) / 1e9) : '0'} Gwei
            </div>
            <div className="gas-details">
              <div className="detail-item">
                <span className="detail-label">Congestion</span>
                <span 
                  className="detail-value congestion-level"
                  style={{ color: getNetworkStatusColor() }}
                >
                  {chartData.congestionLevel}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Trend</span>
                <span className="detail-value">
                  {chartData.gasPriceHistory.length > 1 ? (
                    chartData.gasPriceHistory[chartData.gasPriceHistory.length - 1].gasPriceGwei > 
                    chartData.gasPriceHistory[chartData.gasPriceHistory.length - 2].gasPriceGwei ? '📈' : '📉'
                  ) : '➡️'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Network Health */}
        <div className="status-card network-health">
          <div className="card-header">
            <span className="card-icon">💚</span>
            <h4>Network Health</h4>
          </div>
          <div className="card-content">
            <div className="health-score">
              {metrics?.networkStats.networkUptime.toFixed(1) || '0'}%
            </div>
            <div className="health-details">
              <div className="detail-item">
                <span className="detail-label">Uptime</span>
                <span className="detail-value">
                  {metrics?.networkStats.networkUptime.toFixed(2) || '0'}%
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Status</span>
                <span className="detail-value">
                  {isConnected ? 'Healthy' : 'Issues'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Gas Price History Chart */}
      {showGasPriceHistory && chartData.gasPriceHistory.length > 0 && (
        <div className="gas-price-history">
          <h4 className="chart-section-title">Gas Price History</h4>
          <div className="chart-container">
            <svg viewBox="0 0 100 100" className="gas-price-svg">
              {/* Grid */}
              <defs>
                <pattern id="networkGrid" width="10" height="10" patternUnits="userSpaceOnUse">
                  <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5"/>
                </pattern>
                
                {/* Gradient for area under curve */}
                <linearGradient id="gasPriceGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="rgba(59, 130, 246, 0.3)" />
                  <stop offset="100%" stopColor="rgba(59, 130, 246, 0.05)" />
                </linearGradient>
              </defs>
              
              <rect width="100" height="100" fill="url(#networkGrid)" />
              
              {/* Reference lines */}
              <line x1="0" y1="25" x2="100" y2="25" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
              <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
              <line x1="0" y1="75" x2="100" y2="75" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
              
              {/* Gas price line */}
              {chartData.gasPriceHistory.length > 1 && (
                <>
                  {/* Area fill */}
                  <path
                    d={`${generateGasPricePath(chartData.gasPriceHistory)} L 100 100 L 0 100 Z`}
                    fill="url(#gasPriceGradient)"
                  />
                  
                  {/* Line */}
                  <path
                    d={generateGasPricePath(chartData.gasPriceHistory)}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </>
              )}
              
              {/* Data points */}
              {chartData.gasPriceHistory.map((point, index) => (
                <circle
                  key={index}
                  cx={point.x}
                  cy={point.y}
                  r="1.5"
                  fill="#3b82f6"
                  stroke="#ffffff"
                  strokeWidth="0.5"
                  className="gas-price-point"
                />
              ))}
            </svg>
            
            {/* Y-axis labels */}
            <div className="y-axis-labels">
              <span className="y-label" style={{ bottom: '80%' }}>{chartData.maxGasPrice.toFixed(1)}</span>
              <span className="y-label" style={{ bottom: '50%' }}>{((chartData.maxGasPrice + chartData.minGasPrice) / 2).toFixed(1)}</span>
              <span className="y-label" style={{ bottom: '20%' }}>{chartData.minGasPrice.toFixed(1)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Block Time History */}
      {showBlockTimes && chartData.blockHistory.length > 0 && (
        <div className="block-time-history">
          <h4 className="chart-section-title">Recent Block Times</h4>
          <div className="block-time-bars">
            {chartData.blockHistory.map((block, index) => {
              const blockTime = index > 0 
                ? (block.timestamp.getTime() - chartData.blockHistory[index - 1].timestamp.getTime()) / 1000
                : chartData.avgBlockTime;
              
              const heightPercent = Math.min((blockTime / (chartData.avgBlockTime * 2)) * 100, 100);
              const isNormal = blockTime >= chartData.avgBlockTime * 0.8 && blockTime <= chartData.avgBlockTime * 1.2;
              
              return (
                <div key={block.number} className="block-time-bar">
                  <div 
                    className="block-bar-fill"
                    style={{
                      height: `${heightPercent}%`,
                      backgroundColor: isNormal ? '#22c55e' : '#f59e0b'
                    }}
                  />
                  <span className="block-bar-label">#{block.number.toString().slice(-3)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Network Recommendations */}
      <div className="network-recommendations">
        <h5>Network Recommendations</h5>
        <div className="recommendation-items">
          {chartData.congestionLevel === 'high' && (
            <div className="recommendation-item warning">
              <span className="rec-icon">⚠️</span>
              <span className="rec-text">High congestion detected. Consider using higher gas prices for faster transactions.</span>
            </div>
          )}
          
          {chartData.congestionLevel === 'low' && (
            <div className="recommendation-item success">
              <span className="rec-icon">✅</span>
              <span className="rec-text">Low congestion. Good time for transactions with standard gas prices.</span>
            </div>
          )}
          
          {!isConnected && (
            <div className="recommendation-item error">
              <span className="rec-icon">❌</span>
              <span className="rec-text">Network connection lost. Check your internet connection.</span>
            </div>
          )}
          
          {chartData.avgBlockTime > 5 && (
            <div className="recommendation-item info">
              <span className="rec-icon">ℹ️</span>
              <span className="rec-text">Block times are slower than normal. Network may be experiencing delays.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NetworkStatusChart;