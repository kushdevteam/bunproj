/**
 * Faucet Monitor Service
 * Tracks success rates, performance metrics, and provides analytics for faucet optimization
 */

import { faucetClient, type FaucetConfig } from './faucet-client';

export interface FaucetMetrics {
  faucetId: string;
  name: string;
  
  // Success tracking
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  successRate: number; // 0-1
  
  // Timing metrics
  averageResponseTime: number; // milliseconds
  fastestResponse: number;
  slowestResponse: number;
  
  // Amount tracking
  totalAmountDispensed: number;
  averageAmount: number;
  
  // Error tracking
  commonErrors: { error: string; count: number }[];
  lastError?: string;
  lastErrorTime?: Date;
  
  // Availability tracking
  availabilityRate: number; // 0-1 (not in cooldown / total time)
  lastSuccessTime?: Date;
  lastFailureTime?: Date;
  
  // Performance scoring
  overallScore: number; // 0-100 composite score
  reliability: number; // 0-100
  speed: number; // 0-100
  availability: number; // 0-100
  
  // Trending
  trend: 'improving' | 'declining' | 'stable';
  recentSuccessRate: number; // Last 24 hours
  
  // Updated timestamps
  firstRequestTime?: Date;
  lastUpdateTime: Date;
}

export interface RequestLog {
  id: string;
  faucetId: string;
  address: string;
  timestamp: Date;
  success: boolean;
  responseTime: number;
  amount?: number;
  error?: string;
  userAgent?: string;
}

export interface PerformanceAlert {
  id: string;
  type: 'success_rate_drop' | 'high_failure_rate' | 'slow_response' | 'faucet_down' | 'unusual_errors';
  faucetId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details: any;
  timestamp: Date;
  acknowledged: boolean;
}

export interface MonitorConfig {
  // Data retention
  maxRequestLogs: number;
  maxAlerts: number;
  logRetentionDays: number;
  
  // Alert thresholds
  minSuccessRateThreshold: number; // 0-1
  maxResponseTimeThreshold: number; // milliseconds
  minAvailabilityThreshold: number; // 0-1
  maxErrorRateThreshold: number; // 0-1
  
  // Analysis windows
  recentTimeWindow: number; // milliseconds for "recent" analysis
  trendAnalysisWindow: number; // milliseconds for trend analysis
  
  // Performance scoring weights
  successWeight: number;
  speedWeight: number;
  availabilityWeight: number;
  reliabilityWeight: number;
}

const DEFAULT_MONITOR_CONFIG: MonitorConfig = {
  maxRequestLogs: 10000,
  maxAlerts: 1000,
  logRetentionDays: 30,
  
  minSuccessRateThreshold: 0.7,
  maxResponseTimeThreshold: 30000, // 30 seconds
  minAvailabilityThreshold: 0.8,
  maxErrorRateThreshold: 0.3,
  
  recentTimeWindow: 24 * 60 * 60 * 1000, // 24 hours
  trendAnalysisWindow: 7 * 24 * 60 * 60 * 1000, // 7 days
  
  successWeight: 0.4,
  speedWeight: 0.2,
  availabilityWeight: 0.2,
  reliabilityWeight: 0.2,
};

class FaucetMonitor {
  private requestLogs: RequestLog[] = [];
  private alerts: PerformanceAlert[] = [];
  private config: MonitorConfig = DEFAULT_MONITOR_CONFIG;
  private metricsCache: Map<string, FaucetMetrics> = new Map();
  private lastCleanup: Date = new Date();

  constructor() {
    // Cleanup old data periodically
    setInterval(() => this.cleanup(), 60 * 60 * 1000); // Every hour
  }

  /**
   * Log a faucet request result
   */
  logRequest(
    faucetId: string,
    address: string,
    success: boolean,
    responseTime: number,
    amount?: number,
    error?: string,
    userAgent?: string
  ): void {
    const log: RequestLog = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2)}`,
      faucetId,
      address,
      timestamp: new Date(),
      success,
      responseTime,
      amount,
      error,
      userAgent,
    };

    this.requestLogs.push(log);
    
    // Update metrics cache
    this.updateMetricsForFaucet(faucetId);
    
    // Check for alerts
    this.checkAlerts(faucetId);
    
    // Cleanup if needed
    if (this.requestLogs.length > this.config.maxRequestLogs) {
      this.cleanup();
    }

    console.log(`📊 Logged faucet request: ${faucetId} - ${success ? '✅' : '❌'} (${responseTime}ms)`);
  }

  /**
   * Get metrics for a specific faucet
   */
  getFaucetMetrics(faucetId: string): FaucetMetrics {
    if (this.metricsCache.has(faucetId)) {
      return this.metricsCache.get(faucetId)!;
    }

    return this.calculateMetrics(faucetId);
  }

  /**
   * Get metrics for all faucets
   */
  getAllMetrics(): FaucetMetrics[] {
    const faucets = faucetClient.getActiveFaucets();
    return faucets.map(faucet => this.getFaucetMetrics(faucet.id));
  }

  /**
   * Calculate comprehensive metrics for a faucet
   */
  private calculateMetrics(faucetId: string): FaucetMetrics {
    const faucetConfig = faucetClient.getFaucetConfig(faucetId);
    const faucetLogs = this.requestLogs.filter(log => log.faucetId === faucetId);
    const now = new Date();
    const recentCutoff = new Date(now.getTime() - this.config.recentTimeWindow);
    const recentLogs = faucetLogs.filter(log => log.timestamp >= recentCutoff);

    if (faucetLogs.length === 0) {
      return this.createEmptyMetrics(faucetId, faucetConfig?.name || 'Unknown');
    }

    // Basic counts
    const totalRequests = faucetLogs.length;
    const successfulRequests = faucetLogs.filter(log => log.success).length;
    const failedRequests = totalRequests - successfulRequests;
    const successRate = totalRequests > 0 ? successfulRequests / totalRequests : 0;

    // Recent success rate for trending
    const recentSuccessful = recentLogs.filter(log => log.success).length;
    const recentSuccessRate = recentLogs.length > 0 ? recentSuccessful / recentLogs.length : 0;

    // Response time metrics
    const responseTimes = faucetLogs.map(log => log.responseTime);
    const averageResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    const fastestResponse = Math.min(...responseTimes);
    const slowestResponse = Math.max(...responseTimes);

    // Amount metrics
    const amounts = faucetLogs.filter(log => log.amount).map(log => log.amount!);
    const totalAmountDispensed = amounts.reduce((sum, amount) => sum + amount, 0);
    const averageAmount = amounts.length > 0 ? totalAmountDispensed / amounts.length : 0;

    // Error analysis
    const errors = faucetLogs.filter(log => !log.success && log.error);
    const errorCounts = new Map<string, number>();
    errors.forEach(log => {
      const error = log.error!;
      errorCounts.set(error, (errorCounts.get(error) || 0) + 1);
    });
    const commonErrors = Array.from(errorCounts.entries())
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const lastError = errors[errors.length - 1];

    // Availability calculation (simplified - based on cooldown patterns)
    const availabilityRate = this.calculateAvailabilityRate(faucetId, faucetLogs);

    // Performance scoring
    const reliability = Math.min(100, (successRate * 100));
    const speed = Math.min(100, Math.max(0, 100 - (averageResponseTime / 1000) * 10));
    const availability = availabilityRate * 100;
    
    const overallScore = (
      reliability * this.config.reliabilityWeight +
      speed * this.config.speedWeight +
      availability * this.config.availabilityWeight +
      successRate * 100 * this.config.successWeight
    );

    // Trend analysis
    const trend = this.calculateTrend(faucetId, successRate, recentSuccessRate);

    // Timestamps
    const firstRequestTime = faucetLogs[0]?.timestamp;
    const lastSuccessTime = faucetLogs.filter(log => log.success).pop()?.timestamp;
    const lastFailureTime = faucetLogs.filter(log => !log.success).pop()?.timestamp;

    const metrics: FaucetMetrics = {
      faucetId,
      name: faucetConfig?.name || 'Unknown',
      totalRequests,
      successfulRequests,
      failedRequests,
      successRate,
      averageResponseTime,
      fastestResponse,
      slowestResponse,
      totalAmountDispensed,
      averageAmount,
      commonErrors,
      lastError: lastError?.error,
      lastErrorTime: lastError?.timestamp,
      availabilityRate,
      lastSuccessTime,
      lastFailureTime,
      overallScore,
      reliability,
      speed,
      availability,
      trend,
      recentSuccessRate,
      firstRequestTime,
      lastUpdateTime: new Date(),
    };

    // Cache the metrics
    this.metricsCache.set(faucetId, metrics);
    
    return metrics;
  }

  /**
   * Create empty metrics for a faucet with no data
   */
  private createEmptyMetrics(faucetId: string, name: string): FaucetMetrics {
    return {
      faucetId,
      name,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      successRate: 0,
      averageResponseTime: 0,
      fastestResponse: 0,
      slowestResponse: 0,
      totalAmountDispensed: 0,
      averageAmount: 0,
      commonErrors: [],
      availabilityRate: 1,
      overallScore: 50, // Neutral score for unknown faucets
      reliability: 50,
      speed: 50,
      availability: 100,
      trend: 'stable',
      recentSuccessRate: 0,
      lastUpdateTime: new Date(),
    };
  }

  /**
   * Calculate availability rate based on cooldown patterns
   */
  private calculateAvailabilityRate(faucetId: string, logs: RequestLog[]): number {
    if (logs.length === 0) return 1;

    const faucetConfig = faucetClient.getFaucetConfig(faucetId);
    if (!faucetConfig) return 1;

    // Simple availability calculation based on successful requests vs expected availability
    const totalTime = Date.now() - logs[0].timestamp.getTime();
    const cooldownTime = faucetConfig.cooldownMinutes * 60 * 1000;
    const maxPossibleRequests = Math.floor(totalTime / cooldownTime);
    
    if (maxPossibleRequests === 0) return 1;

    const actualRequests = logs.length;
    return Math.min(1, actualRequests / maxPossibleRequests);
  }

  /**
   * Calculate trend based on historical vs recent performance
   */
  private calculateTrend(faucetId: string, overallSuccessRate: number, recentSuccessRate: number): 'improving' | 'declining' | 'stable' {
    const threshold = 0.1; // 10% change threshold

    if (recentSuccessRate > overallSuccessRate + threshold) {
      return 'improving';
    } else if (recentSuccessRate < overallSuccessRate - threshold) {
      return 'declining';
    } else {
      return 'stable';
    }
  }

  /**
   * Update metrics cache for a specific faucet
   */
  private updateMetricsForFaucet(faucetId: string): void {
    this.metricsCache.set(faucetId, this.calculateMetrics(faucetId));
  }

  /**
   * Check for performance alerts
   */
  private checkAlerts(faucetId: string): void {
    const metrics = this.getFaucetMetrics(faucetId);
    const now = new Date();

    // Success rate alert
    if (metrics.successRate < this.config.minSuccessRateThreshold && metrics.totalRequests >= 5) {
      this.createAlert({
        type: 'success_rate_drop',
        faucetId,
        severity: metrics.successRate < 0.3 ? 'critical' : 'high',
        message: `Success rate dropped to ${(metrics.successRate * 100).toFixed(1)}%`,
        details: { successRate: metrics.successRate, threshold: this.config.minSuccessRateThreshold },
      });
    }

    // Response time alert
    if (metrics.averageResponseTime > this.config.maxResponseTimeThreshold) {
      this.createAlert({
        type: 'slow_response',
        faucetId,
        severity: metrics.averageResponseTime > this.config.maxResponseTimeThreshold * 2 ? 'high' : 'medium',
        message: `Slow response times: ${(metrics.averageResponseTime / 1000).toFixed(1)}s average`,
        details: { responseTime: metrics.averageResponseTime, threshold: this.config.maxResponseTimeThreshold },
      });
    }

    // High failure rate alert
    const recentFailureRate = 1 - metrics.recentSuccessRate;
    if (recentFailureRate > this.config.maxErrorRateThreshold && metrics.totalRequests >= 3) {
      this.createAlert({
        type: 'high_failure_rate',
        faucetId,
        severity: recentFailureRate > 0.7 ? 'critical' : 'high',
        message: `High failure rate: ${(recentFailureRate * 100).toFixed(1)}% in recent requests`,
        details: { failureRate: recentFailureRate, threshold: this.config.maxErrorRateThreshold },
      });
    }

    // Availability alert
    if (metrics.availabilityRate < this.config.minAvailabilityThreshold) {
      this.createAlert({
        type: 'faucet_down',
        faucetId,
        severity: metrics.availabilityRate < 0.3 ? 'critical' : 'high',
        message: `Low availability: ${(metrics.availabilityRate * 100).toFixed(1)}%`,
        details: { availability: metrics.availabilityRate, threshold: this.config.minAvailabilityThreshold },
      });
    }
  }

  /**
   * Create a performance alert
   */
  private createAlert(alertData: Omit<PerformanceAlert, 'id' | 'timestamp' | 'acknowledged'>): void {
    // Check if similar alert already exists (avoid spam)
    const existingAlert = this.alerts.find(alert => 
      alert.faucetId === alertData.faucetId &&
      alert.type === alertData.type &&
      !alert.acknowledged &&
      Date.now() - alert.timestamp.getTime() < 60 * 60 * 1000 // Last hour
    );

    if (existingAlert) {
      return; // Don't create duplicate alerts
    }

    const alert: PerformanceAlert = {
      ...alertData,
      id: `alert_${Date.now()}_${Math.random().toString(36).substring(2)}`,
      timestamp: new Date(),
      acknowledged: false,
    };

    this.alerts.push(alert);
    console.warn(`🚨 Faucet Alert [${alert.severity.toUpperCase()}]: ${alert.message} (${alertData.faucetId})`);
  }

  /**
   * Get all active alerts
   */
  getActiveAlerts(): PerformanceAlert[] {
    return this.alerts.filter(alert => !alert.acknowledged);
  }

  /**
   * Get all alerts
   */
  getAllAlerts(): PerformanceAlert[] {
    return [...this.alerts];
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      console.log(`✅ Alert acknowledged: ${alertId}`);
    }
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): {
    totalFaucets: number;
    activeFaucets: number;
    averageSuccessRate: number;
    averageResponseTime: number;
    totalRequests: number;
    totalAmountDispensed: number;
    activeAlerts: number;
    bestPerformingFaucet?: string;
    worstPerformingFaucet?: string;
  } {
    const allMetrics = this.getAllMetrics();
    const activeAlerts = this.getActiveAlerts().length;

    if (allMetrics.length === 0) {
      return {
        totalFaucets: 0,
        activeFaucets: 0,
        averageSuccessRate: 0,
        averageResponseTime: 0,
        totalRequests: 0,
        totalAmountDispensed: 0,
        activeAlerts,
      };
    }

    const totalRequests = allMetrics.reduce((sum, m) => sum + m.totalRequests, 0);
    const totalAmountDispensed = allMetrics.reduce((sum, m) => sum + m.totalAmountDispensed, 0);
    const averageSuccessRate = allMetrics.reduce((sum, m) => sum + m.successRate, 0) / allMetrics.length;
    const averageResponseTime = allMetrics.reduce((sum, m) => sum + m.averageResponseTime, 0) / allMetrics.length;

    const sortedByScore = allMetrics.filter(m => m.totalRequests > 0).sort((a, b) => b.overallScore - a.overallScore);
    const bestPerformingFaucet = sortedByScore[0]?.name;
    const worstPerformingFaucet = sortedByScore[sortedByScore.length - 1]?.name;

    return {
      totalFaucets: allMetrics.length,
      activeFaucets: allMetrics.filter(m => m.totalRequests > 0).length,
      averageSuccessRate,
      averageResponseTime,
      totalRequests,
      totalAmountDispensed,
      activeAlerts,
      bestPerformingFaucet,
      worstPerformingFaucet,
    };
  }

  /**
   * Get optimal faucet recommendations based on current metrics
   */
  getOptimalFaucetOrder(): { faucetId: string; name: string; score: number; reason: string }[] {
    const metrics = this.getAllMetrics()
      .filter(m => m.totalRequests > 0)
      .sort((a, b) => b.overallScore - a.overallScore);

    return metrics.map(m => {
      let reason = '';
      if (m.successRate > 0.9) reason = 'High success rate';
      else if (m.averageResponseTime < 5000) reason = 'Fast response';
      else if (m.trend === 'improving') reason = 'Improving performance';
      else if (m.availabilityRate > 0.9) reason = 'High availability';
      else reason = 'Standard performance';

      return {
        faucetId: m.faucetId,
        name: m.name,
        score: Math.round(m.overallScore),
        reason,
      };
    });
  }

  /**
   * Export metrics as JSON
   */
  exportMetrics(): string {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      summary: this.getPerformanceSummary(),
      metrics: this.getAllMetrics(),
      alerts: this.getActiveAlerts(),
      optimalOrder: this.getOptimalFaucetOrder(),
    }, null, 2);
  }

  /**
   * Cleanup old data
   */
  private cleanup(): void {
    const cutoffTime = new Date(Date.now() - (this.config.logRetentionDays * 24 * 60 * 60 * 1000));
    
    // Clean old request logs
    const initialLogCount = this.requestLogs.length;
    this.requestLogs = this.requestLogs.filter(log => log.timestamp >= cutoffTime);
    
    // Clean old alerts
    const initialAlertCount = this.alerts.length;
    this.alerts = this.alerts.slice(-this.config.maxAlerts);
    
    // Clear metrics cache to force recalculation
    this.metricsCache.clear();
    
    this.lastCleanup = new Date();
    
    if (initialLogCount !== this.requestLogs.length || initialAlertCount !== this.alerts.length) {
      console.log(`🧹 Cleanup: Removed ${initialLogCount - this.requestLogs.length} old logs and ${initialAlertCount - this.alerts.length} old alerts`);
    }
  }

  /**
   * Reset all monitoring data (for testing)
   */
  reset(): void {
    this.requestLogs = [];
    this.alerts = [];
    this.metricsCache.clear();
    console.log('🔄 Faucet monitoring data reset');
  }

  /**
   * Update monitoring configuration
   */
  updateConfig(newConfig: Partial<MonitorConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('⚙️ Faucet monitor configuration updated');
  }

  /**
   * Get current configuration
   */
  getConfig(): MonitorConfig {
    return { ...this.config };
  }
}

// Export singleton instance
export const faucetMonitor = new FaucetMonitor();