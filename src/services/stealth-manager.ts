/**
 * Stealth Manager Service
 * Handles stealth mode operations, timing variations, and MEV protection
 */

import type { EnhancedBundleConfig } from '../types/bundle-config';
import type { EnhancedTransaction } from '../store/transactions';

export interface StealthConfig {
  enabled: boolean;
  randomTiming: boolean;
  variationPercent: number;
  proxyUsage: boolean;
  mevProtection: boolean;
  sandwichProtection: boolean;
  frontrunningProtection: boolean;
  usePrivateMempool: boolean;
}

export interface TimingStrategy {
  baseDelay: number;
  minDelay: number;
  maxDelay: number;
  distribution: 'uniform' | 'normal' | 'exponential' | 'custom';
  adaptiveDelay: boolean;
}

export interface MEVProtectionConfig {
  enabled: boolean;
  slippageTolerance: number;
  maxPriceImpact: number;
  usePrivateMempool: boolean;
  bundleTransactions: boolean;
  delayRandomization: boolean;
  gasObfuscation: boolean;
}

export interface StealthMetrics {
  totalTransactions: number;
  averageDelay: number;
  delayVariation: number;
  mevEvaded: number;
  frontrunningAttempts: number;
  successRate: number;
  detectionRisk: 'low' | 'medium' | 'high';
}

class StealthManager {
  private stealthConfig: StealthConfig = {
    enabled: false,
    randomTiming: false,
    variationPercent: 10,
    proxyUsage: false,
    mevProtection: true,
    sandwichProtection: true,
    frontrunningProtection: true,
    usePrivateMempool: false,
  };
  
  private timingHistory: Array<{ timestamp: string; delay: number; transaction: string }> = [];
  private mevEvents: Array<{ timestamp: string; type: string; detected: boolean; prevented: boolean }> = [];
  
  /**
   * Initialize stealth mode with configuration
   */
  initialize(config: EnhancedBundleConfig): void {
    const stealthMode = config.executionParams?.stealthMode;
    const mevProtection = config.transactionSettings?.mevProtection;
    
    this.stealthConfig = {
      enabled: stealthMode?.enabled || false,
      randomTiming: stealthMode?.randomTiming || false,
      variationPercent: stealthMode?.variationPercent || 10,
      proxyUsage: stealthMode?.proxyUsage || false,
      mevProtection: mevProtection?.enabled || true,
      sandwichProtection: mevProtection?.sandwichProtection || true,
      frontrunningProtection: mevProtection?.frontrunningProtection || true,
      usePrivateMempool: mevProtection?.usePrivateMempool || false,
    };
  }
  
  /**
   * Calculate stealth delay for transaction
   */
  calculateStealthDelay(
    baseDelay: number,
    transactionIndex: number,
    totalTransactions: number,
    transactionType: 'buy' | 'sell' | 'approve' | 'transfer'
  ): number {
    if (!this.stealthConfig.enabled) {
      return baseDelay;
    }
    
    let finalDelay = baseDelay;
    
    // Apply random timing if enabled
    if (this.stealthConfig.randomTiming) {
      finalDelay = this.applyRandomTiming(baseDelay);
    }
    
    // Apply variation based on transaction type
    finalDelay = this.applyTransactionTypeVariation(finalDelay, transactionType);
    
    // Apply position-based variation
    finalDelay = this.applyPositionVariation(finalDelay, transactionIndex, totalTransactions);
    
    // Apply MEV protection timing
    if (this.stealthConfig.mevProtection) {
      finalDelay = this.applyMEVProtectionDelay(finalDelay, transactionType);
    }
    
    // Ensure minimum and maximum bounds
    finalDelay = Math.max(1000, Math.min(finalDelay, 30000)); // 1 second to 30 seconds
    
    // Record timing for analysis
    this.recordTiming(finalDelay, `${transactionType}_${transactionIndex}`);
    
    return Math.floor(finalDelay);
  }
  
  /**
   * Apply random timing variation
   */
  private applyRandomTiming(baseDelay: number): number {
    const variation = this.stealthConfig.variationPercent / 100;
    const minVariation = baseDelay * (1 - variation);
    const maxVariation = baseDelay * (1 + variation);
    
    // Use different distributions for randomness
    return this.generateRandomDelay(minVariation, maxVariation, 'normal');
  }
  
  /**
   * Apply transaction type specific variations
   */
  private applyTransactionTypeVariation(
    delay: number,
    transactionType: 'buy' | 'sell' | 'approve' | 'transfer'
  ): number {
    const typeMultipliers = {
      buy: 1.0,
      sell: 1.2, // Slightly longer delays for sells
      approve: 0.8, // Shorter delays for approvals
      transfer: 0.9,
    };
    
    return delay * typeMultipliers[transactionType];
  }
  
  /**
   * Apply position-based variation to avoid patterns
   */
  private applyPositionVariation(
    delay: number,
    index: number,
    total: number
  ): number {
    // Avoid regular patterns by varying delay based on position
    const positionFactor = Math.sin((index / total) * Math.PI * 4) * 0.2 + 1;
    return delay * positionFactor;
  }
  
  /**
   * Apply MEV protection delays
   */
  private applyMEVProtectionDelay(
    delay: number,
    transactionType: 'buy' | 'sell' | 'approve' | 'transfer'
  ): number {
    if (!this.stealthConfig.mevProtection) {
      return delay;
    }
    
    // Add extra random delay for buy transactions (most vulnerable to MEV)
    if (transactionType === 'buy') {
      const mevDelay = 2000 + Math.random() * 3000; // 2-5 second additional delay
      return delay + mevDelay;
    }
    
    return delay;
  }
  
  /**
   * Generate random delay with specified distribution
   */
  private generateRandomDelay(
    min: number,
    max: number,
    distribution: 'uniform' | 'normal' | 'exponential'
  ): number {
    switch (distribution) {
      case 'uniform':
        return min + Math.random() * (max - min);
      
      case 'normal':
        // Box-Muller transform for normal distribution
        const u1 = Math.random();
        const u2 = Math.random();
        const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        const mean = (min + max) / 2;
        const stdDev = (max - min) / 6; // 99.7% within range
        return Math.max(min, Math.min(max, mean + z0 * stdDev));
      
      case 'exponential':
        const lambda = 2 / (max - min);
        return min + (-Math.log(1 - Math.random()) / lambda);
      
      default:
        return min + Math.random() * (max - min);
    }
  }
  
  /**
   * Check for MEV threats and apply protection
   */
  checkMEVThreats(
    transaction: EnhancedTransaction,
    config: EnhancedBundleConfig
  ): {
    threatsDetected: string[];
    protectionApplied: string[];
    recommendations: string[];
    riskLevel: 'low' | 'medium' | 'high';
  } {
    const threats: string[] = [];
    const protections: string[] = [];
    const recommendations: string[] = [];
    
    // Check for sandwich attack vulnerability
    if (this.detectSandwichRisk(transaction, config)) {
      threats.push('sandwich_attack');
      
      if (this.stealthConfig.sandwichProtection) {
        protections.push('delayed_execution');
        protections.push('slippage_protection');
      } else {
        recommendations.push('Enable sandwich attack protection');
      }
    }
    
    // Check for frontrunning vulnerability
    if (this.detectFrontrunningRisk(transaction, config)) {
      threats.push('frontrunning');
      
      if (this.stealthConfig.frontrunningProtection) {
        protections.push('gas_price_obfuscation');
        protections.push('timing_randomization');
      } else {
        recommendations.push('Enable frontrunning protection');
      }
    }
    
    // Check for large transaction exposure
    if (this.detectLargeTransactionRisk(transaction, config)) {
      threats.push('large_transaction_exposure');
      recommendations.push('Consider splitting large transactions');
    }
    
    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high';
    if (threats.length === 0) {
      riskLevel = 'low';
    } else if (threats.length <= 2 && protections.length >= threats.length) {
      riskLevel = 'medium';
    } else {
      riskLevel = 'high';
    }
    
    // Record MEV event
    this.recordMEVEvent(threats.join(','), threats.length > 0, protections.length > 0);
    
    return {
      threatsDetected: threats,
      protectionApplied: protections,
      recommendations,
      riskLevel,
    };
  }
  
  /**
   * Detect sandwich attack risk
   */
  private detectSandwichRisk(
    transaction: EnhancedTransaction,
    config: EnhancedBundleConfig
  ): boolean {
    // Large buy orders are vulnerable to sandwich attacks
    if (transaction.type === 'buy') {
      const transactionValue = parseFloat(transaction.value);
      const totalBudget = config.purchaseAmount?.totalBnb || 0;
      
      // Risk if single transaction is more than 10% of total budget
      return transactionValue > (totalBudget * 0.1);
    }
    
    return false;
  }
  
  /**
   * Detect frontrunning risk
   */
  private detectFrontrunningRisk(
    transaction: EnhancedTransaction,
    config: EnhancedBundleConfig
  ): boolean {
    // High gas price transactions are visible and attractive to frontrunners
    const gasPrice = parseInt(transaction.gasPrice || '0');
    const standardGasPrice = 5000000000; // 5 gwei
    
    // Risk if gas price is significantly above average
    return gasPrice > (standardGasPrice * 1.5);
  }
  
  /**
   * Detect large transaction exposure risk
   */
  private detectLargeTransactionRisk(
    transaction: EnhancedTransaction,
    config: EnhancedBundleConfig
  ): boolean {
    const transactionValue = parseFloat(transaction.value);
    
    // Risk threshold for large transactions (in BNB)
    const largeTransactionThreshold = 10.0;
    
    return transactionValue > largeTransactionThreshold;
  }
  
  /**
   * Generate stealth transaction bundle
   */
  generateStealthBundle(
    transactions: EnhancedTransaction[],
    config: EnhancedBundleConfig
  ): {
    bundleId: string;
    transactions: EnhancedTransaction[];
    totalDelay: number;
    mevProtectionLevel: 'basic' | 'advanced' | 'maximum';
    estimatedSafety: number; // 0-100
  } {
    const bundleId = `stealth_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Apply stealth modifications to transactions
    const stealthTransactions = transactions.map((tx, index) => {
      const allowedTypes = ['buy', 'sell', 'approve', 'transfer'] as const;
      const transactionType = allowedTypes.includes(tx.type as any) ? tx.type as 'buy' | 'sell' | 'approve' | 'transfer' : 'transfer';
      
      const stealthDelay = this.calculateStealthDelay(
        2000, // Base 2 second delay
        index,
        transactions.length,
        transactionType
      );
      
      return {
        ...tx,
        staggerDelay: stealthDelay,
        isPrivateMempool: this.stealthConfig.usePrivateMempool,
        batchPosition: index,
        bundleHash: bundleId,
      };
    });
    
    // Calculate total execution time
    const totalDelay = stealthTransactions.reduce((sum, tx) => sum + (tx.staggerDelay || 0), 0);
    
    // Determine protection level
    let protectionLevel: 'basic' | 'advanced' | 'maximum';
    if (this.stealthConfig.usePrivateMempool && this.stealthConfig.mevProtection) {
      protectionLevel = 'maximum';
    } else if (this.stealthConfig.mevProtection && this.stealthConfig.randomTiming) {
      protectionLevel = 'advanced';
    } else {
      protectionLevel = 'basic';
    }
    
    // Estimate safety score
    let safetyScore = 50; // Base score
    
    if (this.stealthConfig.randomTiming) safetyScore += 20;
    if (this.stealthConfig.mevProtection) safetyScore += 15;
    if (this.stealthConfig.usePrivateMempool) safetyScore += 10;
    if (this.stealthConfig.sandwichProtection) safetyScore += 5;
    
    safetyScore = Math.min(100, safetyScore);
    
    return {
      bundleId,
      transactions: stealthTransactions,
      totalDelay,
      mevProtectionLevel: protectionLevel,
      estimatedSafety: safetyScore,
    };
  }
  
  /**
   * Analyze stealth effectiveness
   */
  analyzeStealthEffectiveness(): StealthMetrics {
    const recentTimings = this.timingHistory.slice(-100); // Last 100 transactions
    const recentMEVEvents = this.mevEvents.slice(-50); // Last 50 MEV events
    
    const averageDelay = recentTimings.length > 0
      ? recentTimings.reduce((sum, timing) => sum + timing.delay, 0) / recentTimings.length
      : 0;
    
    const delays = recentTimings.map(t => t.delay);
    const delayVariation = delays.length > 1
      ? Math.sqrt(delays.reduce((sum, delay) => sum + Math.pow(delay - averageDelay, 2), 0) / delays.length)
      : 0;
    
    const mevEvaded = recentMEVEvents.filter(event => event.prevented).length;
    const frontrunningAttempts = recentMEVEvents.filter(event => event.type.includes('frontrunning')).length;
    
    const successRate = recentMEVEvents.length > 0
      ? (mevEvaded / recentMEVEvents.length) * 100
      : 100;
    
    // Determine detection risk
    let detectionRisk: 'low' | 'medium' | 'high';
    
    if (delayVariation > (averageDelay * 0.5) && this.stealthConfig.randomTiming) {
      detectionRisk = 'low';
    } else if (delayVariation > (averageDelay * 0.2)) {
      detectionRisk = 'medium';
    } else {
      detectionRisk = 'high';
    }
    
    return {
      totalTransactions: recentTimings.length,
      averageDelay,
      delayVariation,
      mevEvaded,
      frontrunningAttempts,
      successRate,
      detectionRisk,
    };
  }
  
  /**
   * Record timing for analysis
   */
  private recordTiming(delay: number, transactionId: string): void {
    this.timingHistory.push({
      timestamp: new Date().toISOString(),
      delay,
      transaction: transactionId,
    });
    
    // Keep only last 1000 entries
    if (this.timingHistory.length > 1000) {
      this.timingHistory = this.timingHistory.slice(-1000);
    }
  }
  
  /**
   * Record MEV event for analysis
   */
  private recordMEVEvent(type: string, detected: boolean, prevented: boolean): void {
    this.mevEvents.push({
      timestamp: new Date().toISOString(),
      type,
      detected,
      prevented,
    });
    
    // Keep only last 500 entries
    if (this.mevEvents.length > 500) {
      this.mevEvents = this.mevEvents.slice(-500);
    }
  }
  
  /**
   * Get current stealth configuration
   */
  getStealthConfig(): StealthConfig {
    return { ...this.stealthConfig };
  }
  
  /**
   * Update stealth configuration
   */
  updateStealthConfig(updates: Partial<StealthConfig>): void {
    this.stealthConfig = { ...this.stealthConfig, ...updates };
  }
  
  /**
   * Reset stealth metrics
   */
  resetMetrics(): void {
    this.timingHistory = [];
    this.mevEvents = [];
  }
  
  /**
   * Get recommended stealth settings based on transaction profile
   */
  getRecommendedSettings(
    totalValue: number,
    transactionCount: number,
    timeframe: number // minutes
  ): Partial<StealthConfig> {
    const avgTransactionValue = totalValue / transactionCount;
    const transactionRate = transactionCount / timeframe;
    
    const recommendations: Partial<StealthConfig> = {
      enabled: true,
      randomTiming: true,
      mevProtection: true,
    };
    
    // High value transactions need more protection
    if (avgTransactionValue > 5.0) {
      recommendations.usePrivateMempool = true;
      recommendations.variationPercent = 25;
      recommendations.sandwichProtection = true;
    }
    
    // High frequency transactions need timing variation
    if (transactionRate > 2) { // More than 2 transactions per minute
      recommendations.randomTiming = true;
      recommendations.variationPercent = 30;
    }
    
    // Large total value needs maximum protection
    if (totalValue > 50.0) {
      recommendations.usePrivateMempool = true;
      recommendations.frontrunningProtection = true;
      recommendations.sandwichProtection = true;
    }
    
    return recommendations;
  }
}

export const stealthManager = new StealthManager();
export default stealthManager;