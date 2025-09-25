/**
 * Analytics Service for JustJewIt Bundler
 * Collects, processes, and provides real-time and historical analytics data
 */

import { bscRpcClient } from './bsc-rpc';
import { useWalletStore } from '../store/wallets';
import { useNetworkStore } from '../store/network';
import { useExecutionStore } from '../store/execution';
import type { 
  Wallet, 
  Transaction, 
  BundleResult, 
  NetworkConfig
} from '../types';
import type { ExecutionStatistics, ExecutionProgress } from '../store/execution';

// Analytics specific types
export interface AnalyticsMetrics {
  bundlePerformance: BundlePerformanceMetrics;
  walletAnalytics: WalletAnalyticsMetrics;
  networkStats: NetworkAnalyticsMetrics;
  transactionTracking: TransactionAnalyticsMetrics;
  gasAnalytics: GasAnalyticsMetrics;
  timeRange: AnalyticsTimeRange;
  lastUpdated: Date;
}

export interface BundlePerformanceMetrics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  successRate: number;
  averageExecutionTime: number;
  totalGasUsed: string;
  totalCostBNB: number;
  gasEfficiencyScore: number;
  recentExecutions: BundleExecutionSummary[];
  performanceTrend: PerformanceTrend[];
}

export interface WalletAnalyticsMetrics {
  totalWallets: number;
  activeWallets: number;
  totalBalance: number;
  averageBalance: number;
  balanceDistribution: BalanceDistribution[];
  roleDistribution: RoleDistribution[];
  activityLevels: WalletActivityLevel[];
  performanceScores: WalletPerformanceScore[];
  recentActivity: WalletActivity[];
}

export interface NetworkAnalyticsMetrics {
  currentBlockNumber: number;
  currentGasPrice: string;
  averageBlockTime: number;
  networkCongestion: 'low' | 'medium' | 'high';
  gasPriceHistory: GasPricePoint[];
  blockHistory: BlockInfo[];
  networkUptime: number;
  lastNetworkUpdate: Date;
}

export interface TransactionAnalyticsMetrics {
  totalTransactions: number;
  successfulTransactions: number;
  failedTransactions: number;
  pendingTransactions: number;
  successRate: number;
  averageGasUsed: number;
  averageConfirmationTime: number;
  recentTransactions: TransactionSummary[];
  errorAnalysis: ErrorAnalysis[];
  dailyTransactionCount: DailyTransactionCount[];
}

export interface GasAnalyticsMetrics {
  currentGasPrice: string;
  averageGasPrice: string;
  gasOptimizationSavings: number;
  totalGasUsed: string;
  estimatedCostSavings: number;
  gasEfficiencyTrend: GasEfficiencyPoint[];
  optimalGasStrategy: string;
  gasPriceRecommendations: GasPriceRecommendation;
}

export interface AnalyticsTimeRange {
  start: Date;
  end: Date;
  period: '1h' | '4h' | '12h' | '24h' | '7d' | '30d' | 'all';
  granularity: 'minute' | 'hour' | 'day' | 'week';
}

// Supporting interface types
export interface BundleExecutionSummary {
  id: string;
  timestamp: Date;
  success: boolean;
  executionTimeMs: number;
  gasUsed: string;
  cost: number;
  walletsInvolved: number;
  errorMessage?: string;
}

export interface PerformanceTrend {
  timestamp: Date;
  successRate: number;
  avgExecutionTime: number;
  gasEfficiency: number;
  totalExecutions: number;
}

export interface BalanceDistribution {
  range: string;
  count: number;
  percentage: number;
  totalBalance: number;
}

export interface RoleDistribution {
  role: string;
  count: number;
  percentage: number;
  totalBalance: number;
  averageBalance: number;
}

export interface WalletActivityLevel {
  walletId: string;
  address: string;
  role: string;
  activityScore: number;
  transactionCount: number;
  lastActivity: Date;
  performanceRating: 'excellent' | 'good' | 'average' | 'poor';
}

export interface WalletPerformanceScore {
  walletId: string;
  address: string;
  score: number;
  metrics: {
    transactionSuccess: number;
    gasEfficiency: number;
    responseTime: number;
    reliability: number;
  };
}

export interface WalletActivity {
  walletId: string;
  address: string;
  activity: string;
  timestamp: Date;
  value?: number;
  txHash?: string;
}

export interface GasPricePoint {
  timestamp: Date;
  gasPrice: string;
  blockNumber: number;
}

export interface BlockInfo {
  number: number;
  timestamp: Date;
  gasLimit: string;
  gasUsed: string;
  utilization: number;
}

export interface TransactionSummary {
  hash: string;
  from: string;
  to: string;
  value: string;
  gasUsed: string;
  gasPrice: string;
  status: 'success' | 'failed' | 'pending';
  timestamp: Date;
  confirmationTime?: number;
  error?: string;
}

export interface ErrorAnalysis {
  errorType: string;
  count: number;
  percentage: number;
  recentOccurrences: Date[];
  resolution?: string;
}

export interface DailyTransactionCount {
  date: Date;
  successful: number;
  failed: number;
  total: number;
}

export interface GasEfficiencyPoint {
  timestamp: Date;
  estimatedGas: number;
  actualGas: number;
  efficiency: number;
  savings: number;
}

export interface GasPriceRecommendation {
  slow: string;
  standard: string;
  fast: string;
  optimal: string;
  reasoning: string;
}

export interface AnalyticsExportOptions {
  format: 'json' | 'csv' | 'pdf';
  timeRange: AnalyticsTimeRange;
  includeCharts: boolean;
  metrics: (keyof AnalyticsMetrics)[];
}

class AnalyticsService {
  private metricsCache: AnalyticsMetrics | null = null;
  private lastCacheUpdate: Date | null = null;
  private cacheValidityMs = 30000; // 30 seconds
  private historicalData: Map<string, any[]> = new Map();
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isMonitoring = false;

  /**
   * Initialize the analytics service
   */
  async initialize(): Promise<void> {
    console.log('Initializing Analytics Service...');
    
    try {
      // Load historical data if available
      await this.loadHistoricalData();
      
      // Start monitoring
      this.startMonitoring();
      
      console.log('Analytics Service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Analytics Service:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive analytics metrics
   */
  async getAnalyticsMetrics(timeRange?: AnalyticsTimeRange): Promise<AnalyticsMetrics> {
    const effectiveTimeRange = timeRange || this.getDefaultTimeRange();
    
    // Check cache validity
    if (this.isCacheValid() && this.metricsCache) {
      return this.metricsCache;
    }

    try {
      console.log('Fetching fresh analytics metrics...');
      
      const [
        bundlePerformance,
        walletAnalytics,
        networkStats,
        transactionTracking,
        gasAnalytics
      ] = await Promise.all([
        this.getBundlePerformanceMetrics(effectiveTimeRange),
        this.getWalletAnalyticsMetrics(effectiveTimeRange),
        this.getNetworkAnalyticsMetrics(),
        this.getTransactionAnalyticsMetrics(effectiveTimeRange),
        this.getGasAnalyticsMetrics(effectiveTimeRange)
      ]);

      const metrics: AnalyticsMetrics = {
        bundlePerformance,
        walletAnalytics,
        networkStats,
        transactionTracking,
        gasAnalytics,
        timeRange: effectiveTimeRange,
        lastUpdated: new Date()
      };

      // Update cache
      this.metricsCache = metrics;
      this.lastCacheUpdate = new Date();

      // Store historical point
      this.storeHistoricalPoint(metrics);

      return metrics;
    } catch (error) {
      console.error('Failed to fetch analytics metrics:', error);
      throw error;
    }
  }

  /**
   * Get bundle performance metrics
   */
  private async getBundlePerformanceMetrics(timeRange: AnalyticsTimeRange): Promise<BundlePerformanceMetrics> {
    const executionStore = useExecutionStore.getState();
    
    // Get historical execution data (would come from persistent storage in production)
    const executions = this.getHistoricalExecutions(timeRange);
    
    const totalExecutions = executions.length;
    const successfulExecutions = executions.filter(e => e.success).length;
    const failedExecutions = totalExecutions - successfulExecutions;
    const successRate = totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 0;
    
    const avgExecutionTime = totalExecutions > 0 
      ? executions.reduce((sum, e) => sum + e.executionTimeMs, 0) / totalExecutions 
      : 0;
    
    const totalGasUsed = executions.reduce((sum, e) => sum + parseInt(e.gasUsed || '0'), 0).toString();
    const totalCostBNB = executions.reduce((sum, e) => sum + (e.cost || 0), 0);
    
    // Calculate gas efficiency score (higher is better)
    const gasEfficiencyScore = this.calculateGasEfficiencyScore(executions);
    
    // Get recent executions (last 10)
    const recentExecutions = executions.slice(-10);
    
    // Get performance trend
    const performanceTrend = this.calculatePerformanceTrend(executions, timeRange);

    return {
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      successRate,
      averageExecutionTime: avgExecutionTime,
      totalGasUsed,
      totalCostBNB,
      gasEfficiencyScore,
      recentExecutions,
      performanceTrend
    };
  }

  /**
   * Get wallet analytics metrics
   */
  private async getWalletAnalyticsMetrics(timeRange: AnalyticsTimeRange): Promise<WalletAnalyticsMetrics> {
    const walletStore = useWalletStore.getState();
    const wallets = walletStore.wallets;
    
    const totalWallets = wallets.length;
    const activeWallets = wallets.filter(w => w.isActive && w.balance > 0).length;
    const totalBalance = wallets.reduce((sum, w) => sum + w.balance, 0);
    const averageBalance = totalWallets > 0 ? totalBalance / totalWallets : 0;
    
    const balanceDistribution = this.calculateBalanceDistribution(wallets);
    const roleDistribution = this.calculateRoleDistribution(wallets);
    const activityLevels = await this.calculateWalletActivityLevels(wallets, timeRange);
    const performanceScores = this.calculateWalletPerformanceScores(wallets);
    const recentActivity = this.getRecentWalletActivity(timeRange);

    return {
      totalWallets,
      activeWallets,
      totalBalance,
      averageBalance,
      balanceDistribution,
      roleDistribution,
      activityLevels,
      performanceScores,
      recentActivity
    };
  }

  /**
   * Get network analytics metrics
   */
  private async getNetworkAnalyticsMetrics(): Promise<NetworkAnalyticsMetrics> {
    const networkStore = useNetworkStore.getState();
    
    try {
      const stats = await bscRpcClient.getBlockchainStats();
      const gasPriceHistory = this.getGasPriceHistory();
      const blockHistory = this.getBlockHistory();
      
      const networkCongestion = this.calculateNetworkCongestion(stats.gasPrice);
      const averageBlockTime = this.calculateAverageBlockTime(blockHistory);
      const networkUptime = this.calculateNetworkUptime();

      return {
        currentBlockNumber: stats.blockNumber,
        currentGasPrice: stats.gasPrice,
        averageBlockTime,
        networkCongestion,
        gasPriceHistory,
        blockHistory,
        networkUptime,
        lastNetworkUpdate: new Date()
      };
    } catch (error) {
      console.error('Failed to get network analytics:', error);
      // Return default values on error
      return {
        currentBlockNumber: 0,
        currentGasPrice: '0',
        averageBlockTime: 3,
        networkCongestion: 'medium',
        gasPriceHistory: [],
        blockHistory: [],
        networkUptime: 99.9,
        lastNetworkUpdate: new Date()
      };
    }
  }

  /**
   * Get transaction analytics metrics
   */
  private async getTransactionAnalyticsMetrics(timeRange: AnalyticsTimeRange): Promise<TransactionAnalyticsMetrics> {
    const transactions = this.getHistoricalTransactions(timeRange);
    
    const totalTransactions = transactions.length;
    const successfulTransactions = transactions.filter(t => t.status === 'success').length;
    const failedTransactions = transactions.filter(t => t.status === 'failed').length;
    const pendingTransactions = transactions.filter(t => t.status === 'pending').length;
    const successRate = totalTransactions > 0 ? (successfulTransactions / totalTransactions) * 100 : 0;
    
    const avgGasUsed = totalTransactions > 0
      ? transactions.reduce((sum, t) => sum + parseInt(t.gasUsed || '0'), 0) / totalTransactions
      : 0;
    
    const avgConfirmationTime = this.calculateAverageConfirmationTime(transactions);
    const recentTransactions = transactions.slice(-20);
    const errorAnalysis = this.analyzeTransactionErrors(transactions);
    const dailyTransactionCount = this.calculateDailyTransactionCount(transactions, timeRange);

    return {
      totalTransactions,
      successfulTransactions,
      failedTransactions,
      pendingTransactions,
      successRate,
      averageGasUsed: avgGasUsed,
      averageConfirmationTime: avgConfirmationTime,
      recentTransactions,
      errorAnalysis,
      dailyTransactionCount
    };
  }

  /**
   * Get gas analytics metrics
   */
  private async getGasAnalyticsMetrics(timeRange: AnalyticsTimeRange): Promise<GasAnalyticsMetrics> {
    const networkStore = useNetworkStore.getState();
    const transactions = this.getHistoricalTransactions(timeRange);
    
    const currentGasPrice = networkStore.gasPrice || '0';
    const avgGasPrice = this.calculateAverageGasPrice(transactions);
    const totalGasUsed = transactions.reduce((sum, t) => sum + parseInt(t.gasUsed || '0'), 0).toString();
    
    const gasOptimizationSavings = this.calculateGasOptimizationSavings(transactions);
    const estimatedCostSavings = this.calculateEstimatedCostSavings(transactions);
    const gasEfficiencyTrend = this.calculateGasEfficiencyTrend(transactions, timeRange);
    const optimalGasStrategy = this.determineOptimalGasStrategy();
    const gasPriceRecommendations = await this.getGasPriceRecommendations();

    return {
      currentGasPrice,
      averageGasPrice: avgGasPrice,
      gasOptimizationSavings,
      totalGasUsed,
      estimatedCostSavings,
      gasEfficiencyTrend,
      optimalGasStrategy,
      gasPriceRecommendations
    };
  }

  // Helper methods for calculations and data processing

  private getDefaultTimeRange(): AnalyticsTimeRange {
    const end = new Date();
    const start = new Date(end.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago
    
    return {
      start,
      end,
      period: '24h',
      granularity: 'hour'
    };
  }

  private isCacheValid(): boolean {
    if (!this.lastCacheUpdate) return false;
    const now = new Date();
    return (now.getTime() - this.lastCacheUpdate.getTime()) < this.cacheValidityMs;
  }

  private getHistoricalExecutions(timeRange: AnalyticsTimeRange): BundleExecutionSummary[] {
    // In production, this would fetch from persistent storage
    // For now, return mock data based on current execution state
    const data = this.historicalData.get('executions') || [];
    return data.filter(e => 
      new Date(e.timestamp) >= timeRange.start && 
      new Date(e.timestamp) <= timeRange.end
    );
  }

  private getHistoricalTransactions(timeRange: AnalyticsTimeRange): TransactionSummary[] {
    const data = this.historicalData.get('transactions') || [];
    return data.filter(t => 
      new Date(t.timestamp) >= timeRange.start && 
      new Date(t.timestamp) <= timeRange.end
    );
  }

  private calculateGasEfficiencyScore(executions: BundleExecutionSummary[]): number {
    if (executions.length === 0) return 0;
    
    // Score based on gas optimization vs estimated gas
    // Higher score means better efficiency
    const scores = executions.map(e => {
      const estimatedGas = 21000 * 1.5; // Base estimation
      const actualGas = parseInt(e.gasUsed || '21000');
      return Math.max(0, (estimatedGas - actualGas) / estimatedGas * 100);
    });
    
    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
  }

  private calculatePerformanceTrend(executions: BundleExecutionSummary[], timeRange: AnalyticsTimeRange): PerformanceTrend[] {
    // Group executions by time period and calculate trends
    const trend: PerformanceTrend[] = [];
    const periodMs = this.getPeriodMs(timeRange.granularity);
    
    const grouped = this.groupByTimePeriod(executions, periodMs);
    
    grouped.forEach((periodExecutions, timestamp) => {
      const successful = periodExecutions.filter(e => e.success).length;
      const total = periodExecutions.length;
      const successRate = total > 0 ? (successful / total) * 100 : 0;
      const avgExecutionTime = total > 0 
        ? periodExecutions.reduce((sum, e) => sum + e.executionTimeMs, 0) / total 
        : 0;
      
      trend.push({
        timestamp: new Date(timestamp),
        successRate,
        avgExecutionTime,
        gasEfficiency: this.calculateGasEfficiencyScore(periodExecutions),
        totalExecutions: total
      });
    });
    
    return trend.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  private calculateBalanceDistribution(wallets: Wallet[]): BalanceDistribution[] {
    const ranges = [
      { min: 0, max: 0.001, label: '0 - 0.001 BNB' },
      { min: 0.001, max: 0.01, label: '0.001 - 0.01 BNB' },
      { min: 0.01, max: 0.1, label: '0.01 - 0.1 BNB' },
      { min: 0.1, max: 1, label: '0.1 - 1 BNB' },
      { min: 1, max: Infinity, label: '1+ BNB' }
    ];
    
    const distribution = ranges.map(range => {
      const walletsInRange = wallets.filter(w => w.balance >= range.min && w.balance < range.max);
      const count = walletsInRange.length;
      const percentage = wallets.length > 0 ? (count / wallets.length) * 100 : 0;
      const totalBalance = walletsInRange.reduce((sum, w) => sum + w.balance, 0);
      
      return {
        range: range.label,
        count,
        percentage,
        totalBalance
      };
    });
    
    return distribution;
  }

  private calculateRoleDistribution(wallets: Wallet[]): RoleDistribution[] {
    const roleMap = new Map<string, Wallet[]>();
    
    wallets.forEach(wallet => {
      const role = wallet.role.toString();
      if (!roleMap.has(role)) {
        roleMap.set(role, []);
      }
      roleMap.get(role)!.push(wallet);
    });
    
    const distribution: RoleDistribution[] = [];
    roleMap.forEach((roleWallets, role) => {
      const count = roleWallets.length;
      const percentage = wallets.length > 0 ? (count / wallets.length) * 100 : 0;
      const totalBalance = roleWallets.reduce((sum, w) => sum + w.balance, 0);
      const averageBalance = count > 0 ? totalBalance / count : 0;
      
      distribution.push({
        role,
        count,
        percentage,
        totalBalance,
        averageBalance
      });
    });
    
    return distribution;
  }

  private async calculateWalletActivityLevels(wallets: Wallet[], timeRange: AnalyticsTimeRange): Promise<WalletActivityLevel[]> {
    // Calculate activity levels based on transaction history and other factors
    return wallets.map(wallet => {
      const transactions = this.getWalletTransactions(wallet.address, timeRange);
      const transactionCount = transactions.length;
      
      // Activity score based on transaction frequency, success rate, and recency
      const successRate = transactionCount > 0 
        ? transactions.filter(t => t.status === 'success').length / transactionCount 
        : 0;
      
      const recencyScore = this.calculateRecencyScore(transactions);
      const activityScore = (transactionCount * 10) + (successRate * 50) + recencyScore;
      
      let performanceRating: 'excellent' | 'good' | 'average' | 'poor';
      if (activityScore >= 80) performanceRating = 'excellent';
      else if (activityScore >= 60) performanceRating = 'good';
      else if (activityScore >= 40) performanceRating = 'average';
      else performanceRating = 'poor';
      
      const lastActivity = transactions.length > 0 
        ? new Date(Math.max(...transactions.map(t => t.timestamp.getTime())))
        : new Date(wallet.createdAt);
      
      return {
        walletId: wallet.id,
        address: wallet.address,
        role: wallet.role.toString(),
        activityScore,
        transactionCount,
        lastActivity,
        performanceRating
      };
    });
  }

  private calculateWalletPerformanceScores(wallets: Wallet[]): WalletPerformanceScore[] {
    return wallets.map(wallet => {
      const transactions = this.getWalletTransactions(wallet.address);
      
      // Calculate performance metrics
      const transactionSuccess = transactions.length > 0
        ? (transactions.filter(t => t.status === 'success').length / transactions.length) * 100
        : 0;
      
      const gasEfficiency = this.calculateWalletGasEfficiency(transactions);
      const responseTime = this.calculateWalletResponseTime(transactions);
      const reliability = this.calculateWalletReliability(wallet, transactions);
      
      const score = (transactionSuccess * 0.3) + (gasEfficiency * 0.25) + 
                   (responseTime * 0.25) + (reliability * 0.2);
      
      return {
        walletId: wallet.id,
        address: wallet.address,
        score,
        metrics: {
          transactionSuccess,
          gasEfficiency,
          responseTime,
          reliability
        }
      };
    });
  }

  private getRecentWalletActivity(timeRange: AnalyticsTimeRange): WalletActivity[] {
    // Get recent wallet activities (balance changes, transactions, etc.)
    const activities = this.historicalData.get('walletActivities') || [];
    return activities.filter(a => 
      new Date(a.timestamp) >= timeRange.start && 
      new Date(a.timestamp) <= timeRange.end
    ).slice(-50); // Last 50 activities
  }

  private getGasPriceHistory(): GasPricePoint[] {
    return this.historicalData.get('gasPrices') || [];
  }

  private getBlockHistory(): BlockInfo[] {
    return this.historicalData.get('blocks') || [];
  }

  private calculateNetworkCongestion(currentGasPrice: string): 'low' | 'medium' | 'high' {
    const gasPrice = parseInt(currentGasPrice);
    const baseGasPrice = 5000000000; // 5 Gwei in Wei
    
    if (gasPrice <= baseGasPrice) return 'low';
    if (gasPrice <= baseGasPrice * 2) return 'medium';
    return 'high';
  }

  private calculateAverageBlockTime(blocks: BlockInfo[]): number {
    if (blocks.length < 2) return 3; // Default BSC block time
    
    const timeDiffs = [];
    for (let i = 1; i < blocks.length; i++) {
      const diff = blocks[i].timestamp.getTime() - blocks[i-1].timestamp.getTime();
      timeDiffs.push(diff / 1000); // Convert to seconds
    }
    
    return timeDiffs.reduce((sum, diff) => sum + diff, 0) / timeDiffs.length;
  }

  private calculateNetworkUptime(): number {
    // Calculate network uptime based on connection history
    // For now, return a calculated value based on successful connections
    const uptimeData = this.historicalData.get('networkUptime');
    const uptime = typeof uptimeData === 'number' ? uptimeData : 99.9;
    return uptime;
  }

  private calculateAverageConfirmationTime(transactions: TransactionSummary[]): number {
    const confirmedTransactions = transactions.filter(t => t.confirmationTime !== undefined);
    if (confirmedTransactions.length === 0) return 0;
    
    const totalTime = confirmedTransactions.reduce((sum, t) => sum + (t.confirmationTime || 0), 0);
    return totalTime / confirmedTransactions.length;
  }

  private analyzeTransactionErrors(transactions: TransactionSummary[]): ErrorAnalysis[] {
    const errorMap = new Map<string, { count: number; occurrences: Date[] }>();
    
    transactions.filter(t => t.status === 'failed' && t.error).forEach(t => {
      const errorType = this.categorizeError(t.error!);
      if (!errorMap.has(errorType)) {
        errorMap.set(errorType, { count: 0, occurrences: [] });
      }
      const error = errorMap.get(errorType)!;
      error.count++;
      error.occurrences.push(t.timestamp);
    });
    
    const totalErrors = Array.from(errorMap.values()).reduce((sum, e) => sum + e.count, 0);
    
    return Array.from(errorMap.entries()).map(([errorType, data]) => ({
      errorType,
      count: data.count,
      percentage: totalErrors > 0 ? (data.count / totalErrors) * 100 : 0,
      recentOccurrences: data.occurrences.slice(-5),
      resolution: this.getErrorResolution(errorType)
    }));
  }

  private calculateDailyTransactionCount(transactions: TransactionSummary[], timeRange: AnalyticsTimeRange): DailyTransactionCount[] {
    const dailyMap = new Map<string, { successful: number; failed: number; total: number }>();
    
    transactions.forEach(t => {
      const date = new Date(t.timestamp).toDateString();
      if (!dailyMap.has(date)) {
        dailyMap.set(date, { successful: 0, failed: 0, total: 0 });
      }
      
      const daily = dailyMap.get(date)!;
      daily.total++;
      if (t.status === 'success') daily.successful++;
      if (t.status === 'failed') daily.failed++;
    });
    
    return Array.from(dailyMap.entries()).map(([dateStr, counts]) => ({
      date: new Date(dateStr),
      ...counts
    })).sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  private calculateAverageGasPrice(transactions: TransactionSummary[]): string {
    if (transactions.length === 0) return '0';
    
    const total = transactions.reduce((sum, t) => sum + parseInt(t.gasPrice || '0'), 0);
    return (total / transactions.length).toString();
  }

  private calculateGasOptimizationSavings(transactions: TransactionSummary[]): number {
    // Calculate savings from gas optimization strategies
    return transactions.reduce((savings, t) => {
      const estimatedGas = 21000 * 1.5; // Base estimation with buffer
      const actualGas = parseInt(t.gasUsed || '21000');
      const gasPrice = parseInt(t.gasPrice || '0');
      
      if (actualGas < estimatedGas) {
        const savedGas = estimatedGas - actualGas;
        const savedCost = (savedGas * gasPrice) / 1e18; // Convert to BNB
        return savings + savedCost;
      }
      
      return savings;
    }, 0);
  }

  private calculateEstimatedCostSavings(transactions: TransactionSummary[]): number {
    // Calculate estimated cost savings from optimization
    return this.calculateGasOptimizationSavings(transactions);
  }

  private calculateGasEfficiencyTrend(transactions: TransactionSummary[], timeRange: AnalyticsTimeRange): GasEfficiencyPoint[] {
    const periodMs = this.getPeriodMs(timeRange.granularity);
    const grouped = this.groupByTimePeriod(transactions, periodMs);
    
    const trend: GasEfficiencyPoint[] = [];
    
    grouped.forEach((periodTransactions, timestamp) => {
      const avgEstimatedGas = 21000 * 1.5;
      const avgActualGas = periodTransactions.reduce((sum, t) => sum + parseInt(t.gasUsed || '0'), 0) / periodTransactions.length;
      const efficiency = Math.max(0, ((avgEstimatedGas - avgActualGas) / avgEstimatedGas) * 100);
      const savings = Math.max(0, avgEstimatedGas - avgActualGas);
      
      trend.push({
        timestamp: new Date(timestamp),
        estimatedGas: avgEstimatedGas,
        actualGas: avgActualGas,
        efficiency,
        savings
      });
    });
    
    return trend.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  private determineOptimalGasStrategy(): string {
    const networkStore = useNetworkStore.getState();
    const congestion = this.calculateNetworkCongestion(networkStore.gasPrice || '0');
    
    switch (congestion) {
      case 'low': return 'Standard gas price with 10% buffer';
      case 'medium': return 'Fast gas price with 15% buffer';
      case 'high': return 'Priority gas price with minimal buffer';
      default: return 'Standard gas price';
    }
  }

  private async getGasPriceRecommendations(): Promise<GasPriceRecommendation> {
    try {
      const gasPriceInfo = await bscRpcClient.getGasPriceInfo();
      const reasoning = this.determineOptimalGasStrategy();
      
      return {
        slow: gasPriceInfo.slow,
        standard: gasPriceInfo.standard,
        fast: gasPriceInfo.fast,
        optimal: gasPriceInfo.standard,
        reasoning
      };
    } catch (error) {
      console.error('Failed to get gas price recommendations:', error);
      return {
        slow: '5000000000',
        standard: '10000000000',
        fast: '15000000000',
        optimal: '10000000000',
        reasoning: 'Default values - unable to fetch current prices'
      };
    }
  }

  // Utility helper methods

  private getPeriodMs(granularity: 'minute' | 'hour' | 'day' | 'week'): number {
    switch (granularity) {
      case 'minute': return 60 * 1000;
      case 'hour': return 60 * 60 * 1000;
      case 'day': return 24 * 60 * 60 * 1000;
      case 'week': return 7 * 24 * 60 * 60 * 1000;
      default: return 60 * 60 * 1000;
    }
  }

  private groupByTimePeriod<T extends { timestamp: Date }>(items: T[], periodMs: number): Map<number, T[]> {
    const grouped = new Map<number, T[]>();
    
    items.forEach(item => {
      const timestamp = Math.floor(item.timestamp.getTime() / periodMs) * periodMs;
      if (!grouped.has(timestamp)) {
        grouped.set(timestamp, []);
      }
      grouped.get(timestamp)!.push(item);
    });
    
    return grouped;
  }

  private getWalletTransactions(address: string, timeRange?: AnalyticsTimeRange): TransactionSummary[] {
    const allTransactions = this.historicalData.get('transactions') || [];
    let transactions = allTransactions.filter(t => t.from === address || t.to === address);
    
    if (timeRange) {
      transactions = transactions.filter(t => 
        t.timestamp >= timeRange.start && t.timestamp <= timeRange.end
      );
    }
    
    return transactions;
  }

  private calculateRecencyScore(transactions: TransactionSummary[]): number {
    if (transactions.length === 0) return 0;
    
    const now = new Date();
    const mostRecent = new Date(Math.max(...transactions.map(t => t.timestamp.getTime())));
    const hoursSinceLastTx = (now.getTime() - mostRecent.getTime()) / (1000 * 60 * 60);
    
    // Score decreases as time since last transaction increases
    return Math.max(0, 30 - hoursSinceLastTx);
  }

  private calculateWalletGasEfficiency(transactions: TransactionSummary[]): number {
    if (transactions.length === 0) return 0;
    
    const efficiencies = transactions.map(t => {
      const estimated = 21000 * 1.5;
      const actual = parseInt(t.gasUsed || '21000');
      return Math.max(0, ((estimated - actual) / estimated) * 100);
    });
    
    return efficiencies.reduce((sum, eff) => sum + eff, 0) / efficiencies.length;
  }

  private calculateWalletResponseTime(transactions: TransactionSummary[]): number {
    const confirmedTxs = transactions.filter(t => t.confirmationTime !== undefined);
    if (confirmedTxs.length === 0) return 0;
    
    const avgConfirmationTime = confirmedTxs.reduce((sum, t) => sum + (t.confirmationTime || 0), 0) / confirmedTxs.length;
    
    // Convert to score (lower confirmation time = higher score)
    return Math.max(0, 100 - (avgConfirmationTime / 30)); // 30 seconds = 0 score
  }

  private calculateWalletReliability(wallet: Wallet, transactions: TransactionSummary[]): number {
    if (transactions.length === 0) return 50; // Neutral score for new wallets
    
    const successRate = (transactions.filter(t => t.status === 'success').length / transactions.length) * 100;
    const consistencyScore = this.calculateTransactionConsistency(transactions);
    
    return (successRate * 0.7) + (consistencyScore * 0.3);
  }

  private calculateTransactionConsistency(transactions: TransactionSummary[]): number {
    if (transactions.length < 2) return 100;
    
    // Measure consistency in gas usage, timing, etc.
    const gasUsages = transactions.map(t => parseInt(t.gasUsed || '0'));
    const gasVariance = this.calculateVariance(gasUsages);
    const maxVariance = 100000; // Threshold for low consistency
    
    return Math.max(0, 100 - ((gasVariance / maxVariance) * 100));
  }

  private calculateVariance(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    
    const mean = numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
    const squaredDiffs = numbers.map(n => Math.pow(n - mean, 2));
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / numbers.length;
  }

  private categorizeError(error: string): string {
    error = error.toLowerCase();
    
    if (error.includes('gas') || error.includes('out of gas')) return 'Gas Related';
    if (error.includes('nonce')) return 'Nonce Error';
    if (error.includes('insufficient')) return 'Insufficient Funds';
    if (error.includes('revert')) return 'Transaction Reverted';
    if (error.includes('timeout') || error.includes('network')) return 'Network Error';
    
    return 'Other Error';
  }

  private getErrorResolution(errorType: string): string {
    switch (errorType) {
      case 'Gas Related': return 'Increase gas limit or optimize contract calls';
      case 'Nonce Error': return 'Wait for pending transactions or reset nonce';
      case 'Insufficient Funds': return 'Add more funds to wallet';
      case 'Transaction Reverted': return 'Check contract conditions and parameters';
      case 'Network Error': return 'Check network connection and try again';
      default: return 'Contact support for assistance';
    }
  }

  private async loadHistoricalData(): Promise<void> {
    // In production, load from persistent storage (database, local storage, etc.)
    // For now, initialize with empty data structures
    this.historicalData.set('executions', []);
    this.historicalData.set('transactions', []);
    this.historicalData.set('walletActivities', []);
    this.historicalData.set('gasPrices', []);
    this.historicalData.set('blocks', []);
    
    console.log('Historical data loaded');
  }

  private storeHistoricalPoint(metrics: AnalyticsMetrics): void {
    // Store key metrics as historical data points
    const now = new Date();
    
    // Store gas price point
    const gasPrices = this.historicalData.get('gasPrices') || [];
    gasPrices.push({
      timestamp: now,
      gasPrice: metrics.networkStats.currentGasPrice,
      blockNumber: metrics.networkStats.currentBlockNumber
    });
    
    // Keep only last 1000 points
    if (gasPrices.length > 1000) {
      gasPrices.splice(0, gasPrices.length - 1000);
    }
    this.historicalData.set('gasPrices', gasPrices);
    
    // Store other relevant data points...
  }

  /**
   * Start monitoring for real-time analytics
   */
  startMonitoring(): void {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    
    // Update analytics every 30 seconds
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.getAnalyticsMetrics();
      } catch (error) {
        console.error('Analytics monitoring update failed:', error);
      }
    }, 30000);
    
    console.log('Analytics monitoring started');
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    this.isMonitoring = false;
    console.log('Analytics monitoring stopped');
  }

  /**
   * Export analytics data
   */
  async exportAnalytics(options: AnalyticsExportOptions): Promise<string> {
    const metrics = await this.getAnalyticsMetrics(options.timeRange);
    
    switch (options.format) {
      case 'json':
        return JSON.stringify(metrics, null, 2);
      
      case 'csv':
        return this.convertToCSV(metrics, options.metrics);
      
      case 'pdf':
        // Would implement PDF generation here
        throw new Error('PDF export not implemented yet');
      
      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }
  }

  private convertToCSV(metrics: AnalyticsMetrics, includedMetrics: (keyof AnalyticsMetrics)[]): string {
    // Convert metrics to CSV format
    const csv: string[] = [];
    
    // Add headers
    csv.push('Metric,Value,Timestamp');
    
    if (includedMetrics.includes('bundlePerformance')) {
      csv.push(`Total Bundle Executions,${metrics.bundlePerformance.totalExecutions},${metrics.lastUpdated.toISOString()}`);
      csv.push(`Bundle Success Rate,${metrics.bundlePerformance.successRate.toFixed(2)}%,${metrics.lastUpdated.toISOString()}`);
      csv.push(`Average Execution Time,${metrics.bundlePerformance.averageExecutionTime.toFixed(2)}ms,${metrics.lastUpdated.toISOString()}`);
    }
    
    if (includedMetrics.includes('walletAnalytics')) {
      csv.push(`Total Wallets,${metrics.walletAnalytics.totalWallets},${metrics.lastUpdated.toISOString()}`);
      csv.push(`Active Wallets,${metrics.walletAnalytics.activeWallets},${metrics.lastUpdated.toISOString()}`);
      csv.push(`Total Balance,${metrics.walletAnalytics.totalBalance.toFixed(4)} BNB,${metrics.lastUpdated.toISOString()}`);
    }
    
    // Add more metric categories as needed...
    
    return csv.join('\n');
  }

  /**
   * Get real-time network status
   */
  async getRealTimeNetworkStatus(): Promise<NetworkAnalyticsMetrics> {
    return this.getNetworkAnalyticsMetrics();
  }

  /**
   * Get wallet performance summary
   */
  async getWalletPerformanceSummary(): Promise<WalletAnalyticsMetrics> {
    const timeRange = this.getDefaultTimeRange();
    return this.getWalletAnalyticsMetrics(timeRange);
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.stopMonitoring();
    this.metricsCache = null;
    this.historicalData.clear();
    console.log('Analytics service destroyed');
  }
}

// Create singleton instance
export const analyticsService = new AnalyticsService();

// Export types for components