/**
 * Stealth Wallet Funding Service
 * Core service for executing bulk wallet funding with stealth algorithms
 * Provides randomization, timing control, and anti-detection patterns
 */

import { ethers } from 'ethers';
import { apiClient } from '../api/client';
import { useWalletStore } from '../store/wallets';
import { useSessionStore } from '../store/session';
import { useNetworkStore } from '../store/network';
import type { 
  StealthConfig,
  StealthFundingPlan,
  StealthTransaction,
  StealthPattern,
  MasterWallet,
  StealthValidationResult,
  StealthOperationEvent
} from '../types/funding';
import type { Wallet } from '../types';

/**
 * Core stealth wallet funding service
 */
export class WalletFundingService {
  private static instance: WalletFundingService;
  private provider: ethers.JsonRpcProvider | null = null;
  private isInitialized = false;
  private eventListeners: ((event: StealthOperationEvent) => void)[] = [];

  private constructor() {}

  static getInstance(): WalletFundingService {
    if (!WalletFundingService.instance) {
      WalletFundingService.instance = new WalletFundingService();
    }
    return WalletFundingService.instance;
  }

  /**
   * Initialize the service with BSC provider
   */
  async initialize(): Promise<void> {
    try {
      const networkStore = useNetworkStore.getState();
      
      // Initialize provider based on current network
      if (networkStore.currentNetwork?.rpcUrl) {
        this.provider = new ethers.JsonRpcProvider(networkStore.currentNetwork.rpcUrl);
        await this.provider.getNetwork(); // Test connection
      } else {
        throw new Error('No RPC URL configured for current network');
      }

      this.isInitialized = true;
      console.log('WalletFundingService initialized successfully');
    } catch (error) {
      console.error('Failed to initialize WalletFundingService:', error);
      throw error;
    }
  }

  /**
   * Create a stealth funding plan with randomized parameters
   */
  async createStealthPlan(
    masterWallet: MasterWallet,
    targetWalletIds: string[],
    totalAmount: number,
    config: StealthConfig
  ): Promise<StealthFundingPlan> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const walletStore = useWalletStore.getState();
    const targetWallets = walletStore.wallets.filter(w => targetWalletIds.includes(w.id));

    if (targetWallets.length === 0) {
      throw new Error('No valid target wallets found');
    }

    // Generate randomized transaction amounts
    const transactions = this.generateStealthTransactions(
      targetWallets,
      totalAmount,
      config
    );

    // Calculate timing delays based on pattern
    this.applyTimingPattern(transactions, config);

    // Estimate operation duration
    const estimatedDuration = this.calculateEstimatedDuration(transactions, config);

    const plan: StealthFundingPlan = {
      id: `stealth_plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      masterWallet,
      targetWallets: targetWalletIds,
      totalAmount,
      estimatedDuration,
      transactionCount: transactions.length,
      config,
      transactions,
      createdAt: new Date(),
    };

    return plan;
  }

  /**
   * Validate a stealth funding plan
   */
  validatePlan(plan: StealthFundingPlan): StealthValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Validate master wallet balance
    if (plan.masterWallet.balance < plan.totalAmount) {
      errors.push(`Insufficient master wallet balance. Required: ${plan.totalAmount} BNB, Available: ${plan.masterWallet.balance} BNB`);
    }

    // Validate transaction amounts
    const minTransaction = Math.min(...plan.transactions.map(t => t.actualAmount));
    const maxTransaction = Math.max(...plan.transactions.map(t => t.actualAmount));

    if (minTransaction <= 0) {
      errors.push('Some transactions have zero or negative amounts');
    }

    if (maxTransaction > 10) {
      warnings.push('Some transactions exceed 10 BNB - this may draw attention');
    }

    // Validate timing patterns
    const delays = plan.transactions.map(t => t.executionDelay);
    const avgDelay = delays.reduce((sum, delay) => sum + delay, 0) / delays.length;

    if (avgDelay < 1) {
      warnings.push('Very short delays between transactions may appear suspicious');
    }

    if (plan.estimatedDuration > 3600) {
      warnings.push('Operation will take over 1 hour to complete');
    }

    // Security recommendations
    if (!plan.config.randomizeOrder) {
      recommendations.push('Consider enabling wallet order randomization for better stealth');
    }

    if (!plan.config.simulateHumanBehavior) {
      recommendations.push('Enable human behavior simulation for more natural patterns');
    }

    // Estimate costs
    const estimatedGasPerTx = 21000;
    const estimatedGasPrice = 5e9; // 5 Gwei
    const estimatedGasCost = (plan.transactionCount * estimatedGasPerTx * estimatedGasPrice) / 1e18;

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      recommendations,
      estimatedCosts: {
        totalAmount: plan.totalAmount,
        estimatedGas: estimatedGasCost,
        estimatedDuration: plan.estimatedDuration,
      },
    };
  }

  /**
   * Execute a stealth funding operation
   */
  async executeStealthOperation(
    plan: StealthFundingPlan,
    passphrase: string,
    onProgress?: (progress: { completed: number; total: number; current?: StealthTransaction }) => void,
    onEvent?: (event: StealthOperationEvent) => void
  ): Promise<void> {
    if (!this.isInitialized || !this.provider) {
      throw new Error('Service not initialized');
    }

    // Validate session
    const sessionStore = useSessionStore.getState();
    if (!sessionStore.isUnlocked) {
      throw new Error('Session must be unlocked to execute funding operations');
    }

    // Get master wallet private key
    const walletStore = useWalletStore.getState();
    const masterPrivateKey = await walletStore.getDecryptedPrivateKey(
      plan.masterWallet.id,
      passphrase
    );

    if (!masterPrivateKey) {
      throw new Error('Failed to decrypt master wallet private key');
    }

    // Create wallet instance
    const masterWalletInstance = new ethers.Wallet(masterPrivateKey, this.provider);

    // Emit operation started event
    const startEvent: StealthOperationEvent = {
      type: 'operation_started',
      operationId: plan.id,
      timestamp: new Date(),
    };
    this.emitEvent(startEvent, onEvent);

    let completed = 0;
    let currentBatch = 0;
    const batchSize = plan.config.batchSize || plan.transactions.length;

    try {
      // Sort transactions by scheduled time
      const sortedTransactions = [...plan.transactions].sort(
        (a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime()
      );

      for (let i = 0; i < sortedTransactions.length; i += batchSize) {
        currentBatch++;
        const batch = sortedTransactions.slice(i, i + batchSize);

        // Process batch
        for (const transaction of batch) {
          try {
            // Wait for scheduled time
            const now = new Date();
            const delay = transaction.scheduledAt.getTime() - now.getTime();
            if (delay > 0) {
              await this.sleep(delay);
            }

            // Update transaction status
            transaction.status = 'sending';
            transaction.sentAt = new Date();

            onProgress?.({ completed, total: plan.transactions.length, current: transaction });

            // Send transaction with stealth parameters
            const txResponse = await this.sendStealthTransaction(
              masterWalletInstance,
              transaction,
              plan.config
            );

            // Update transaction with response
            transaction.txHash = txResponse.hash;
            transaction.status = 'confirmed';
            transaction.confirmedAt = new Date();

            // Emit transaction confirmed event
            const confirmEvent: StealthOperationEvent = {
              type: 'transaction_confirmed',
              operationId: plan.id,
              transactionId: transaction.id,
              txHash: txResponse.hash,
              timestamp: new Date(),
            };
            this.emitEvent(confirmEvent, onEvent);

            completed++;
            onProgress?.({ completed, total: plan.transactions.length });

            // Update wallet balance in store
            walletStore.updateWalletBalance(
              transaction.walletAddress,
              transaction.actualAmount
            );

          } catch (error) {
            transaction.status = 'failed';
            transaction.error = error instanceof Error ? error.message : 'Transaction failed';

            // Emit transaction failed event
            const failEvent: StealthOperationEvent = {
              type: 'transaction_failed',
              operationId: plan.id,
              transactionId: transaction.id,
              error: transaction.error,
              timestamp: new Date(),
            };
            this.emitEvent(failEvent, onEvent);

            // Retry logic
            if (transaction.retryCount < transaction.maxRetries) {
              transaction.retryCount++;
              transaction.status = 'retrying';
              
              // Reschedule with delay
              const retryDelay = this.calculateRetryDelay(transaction.retryCount);
              transaction.scheduledAt = new Date(Date.now() + retryDelay);
              
              // Add back to queue (simplified - in real implementation would need proper queue management)
              console.log(`Retrying transaction ${transaction.id} in ${retryDelay}ms`);
            }
          }
        }

        // Emit batch completed event
        const batchEvent: StealthOperationEvent = {
          type: 'batch_completed',
          operationId: plan.id,
          batchNumber: currentBatch,
          timestamp: new Date(),
        };
        this.emitEvent(batchEvent, onEvent);

        // Wait between batches
        if (i + batchSize < sortedTransactions.length && plan.config.batchDelay > 0) {
          await this.sleep(plan.config.batchDelay * 1000);
        }
      }

      // Emit operation completed event
      const completedEvent: StealthOperationEvent = {
        type: 'operation_completed',
        operationId: plan.id,
        result: {
          operationId: plan.id,
          success: true,
          totalWalletsFunded: completed,
          totalAmountDistributed: plan.totalAmount,
          totalGasUsed: 0, // Would be calculated from actual transactions
          operationDuration: Date.now() - plan.createdAt.getTime(),
          transactions: plan.transactions,
          summary: {
            successRate: (completed / plan.transactions.length) * 100,
            averageAmount: plan.totalAmount / plan.transactions.length,
            medianDelay: this.calculateMedianDelay(plan.transactions),
            gasEfficiency: 0, // Would be calculated
          },
          errors: plan.transactions.filter(t => t.status === 'failed').map(t => t.error || 'Unknown error'),
          createdAt: plan.createdAt,
          completedAt: new Date(),
        },
        timestamp: new Date(),
      };
      this.emitEvent(completedEvent, onEvent);

    } catch (error) {
      const failedEvent: StealthOperationEvent = {
        type: 'operation_failed',
        operationId: plan.id,
        error: error instanceof Error ? error.message : 'Operation failed',
        timestamp: new Date(),
      };
      this.emitEvent(failedEvent, onEvent);
      throw error;
    }
  }

  /**
   * Generate randomized transactions based on stealth config
   */
  private generateStealthTransactions(
    targetWallets: Wallet[],
    totalAmount: number,
    config: StealthConfig
  ): StealthTransaction[] {
    const transactions: StealthTransaction[] = [];
    let remainingAmount = totalAmount;

    // Randomize wallet order if configured
    const wallets = config.randomizeOrder 
      ? this.shuffleArray([...targetWallets])
      : targetWallets;

    for (let i = 0; i < wallets.length; i++) {
      const wallet = wallets[i];
      let amount: number;

      if (config.useFixedAmount && config.fixedAmount) {
        amount = config.fixedAmount;
      } else if (i === wallets.length - 1) {
        // Last wallet gets remaining amount
        amount = remainingAmount;
      } else {
        // Random amount within range
        amount = this.randomBetween(config.minAmount, config.maxAmount);
        
        // Apply variance if configured
        if (config.varyTransactionSizes) {
          const variance = amount * (config.amountVariancePercent / 100);
          const adjustment = this.randomBetween(-variance, variance);
          amount += adjustment;
        }
        
        // Ensure we don't exceed remaining amount
        amount = Math.min(amount, remainingAmount);
      }

      remainingAmount -= amount;

      const transaction: StealthTransaction = {
        id: `stx_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 6)}`,
        walletId: wallet.id,
        walletAddress: wallet.address,
        plannedAmount: amount,
        actualAmount: amount,
        status: 'pending',
        retryCount: 0,
        maxRetries: 3,
        scheduledAt: new Date(), // Will be updated by timing pattern
        executionDelay: 0, // Will be calculated
      };

      transactions.push(transaction);

      if (remainingAmount <= 0) break;
    }

    return transactions;
  }

  /**
   * Apply timing patterns to transactions
   */
  private applyTimingPattern(transactions: StealthTransaction[], config: StealthConfig): void {
    const startTime = new Date();
    let currentTime = startTime.getTime();

    for (let i = 0; i < transactions.length; i++) {
      const transaction = transactions[i];
      
      let delay: number;
      
      switch (config.pattern) {
        case 'uniform':
          delay = (config.minDelay + config.maxDelay) / 2;
          break;
          
        case 'random':
          delay = this.randomBetween(config.minDelay, config.maxDelay);
          break;
          
        case 'burst':
          // Send in bursts with longer pauses
          const burstSize = 5;
          if (i % burstSize === 0 && i > 0) {
            delay = this.randomBetween(config.maxDelay * 2, config.maxDelay * 4);
          } else {
            delay = this.randomBetween(config.minDelay, config.minDelay * 2);
          }
          break;
          
        case 'gradient':
          // Gradually increase delays
          const progress = i / transactions.length;
          delay = config.minDelay + (config.maxDelay - config.minDelay) * progress;
          break;
          
        case 'natural':
        default:
          // Human-like patterns with irregularities
          delay = this.generateNaturalDelay(config.minDelay, config.maxDelay, i);
          break;
      }

      // Add human behavior simulation
      if (config.simulateHumanBehavior) {
        delay = this.addHumanVariation(delay);
      }

      transaction.executionDelay = delay;
      transaction.scheduledAt = new Date(currentTime + delay * 1000);
      currentTime += delay * 1000;
    }
  }

  /**
   * Send a single stealth transaction
   */
  private async sendStealthTransaction(
    masterWallet: ethers.Wallet,
    transaction: StealthTransaction,
    config: StealthConfig
  ): Promise<ethers.TransactionResponse> {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    // Get current gas price
    const feeData = await this.provider.getFeeData();
    let gasPrice = feeData.gasPrice || BigInt(5e9); // 5 Gwei fallback

    // Apply gas price variance if configured
    if (config.useVariableGas) {
      const variance = Number(gasPrice) * (config.gasVariancePercent / 100);
      const adjustment = this.randomBetween(-variance, variance);
      gasPrice = BigInt(Math.floor(Number(gasPrice) + adjustment));
    }

    // Create transaction
    const txRequest: ethers.TransactionRequest = {
      to: transaction.walletAddress,
      value: ethers.parseEther(transaction.actualAmount.toString()),
      gasLimit: 21000,
      gasPrice,
    };

    // Send transaction
    const txResponse = await masterWallet.sendTransaction(txRequest);
    
    // Wait for confirmation
    await txResponse.wait();
    
    return txResponse;
  }

  /**
   * Generate natural, human-like delays
   */
  private generateNaturalDelay(minDelay: number, maxDelay: number, index: number): number {
    // Base delay with some randomness
    let delay = this.randomBetween(minDelay, maxDelay);
    
    // Add occasional longer pauses (simulating human breaks)
    if (Math.random() < 0.1) { // 10% chance of longer pause
      delay *= this.randomBetween(2, 4);
    }
    
    // Add micro-variations (simulating human inconsistency)
    const microVariation = delay * 0.1 * (Math.random() - 0.5);
    delay += microVariation;
    
    return Math.max(delay, minDelay);
  }

  /**
   * Add human behavior variations to delays
   */
  private addHumanVariation(baseDelay: number): number {
    // Add small random variations that humans naturally have
    const variation = baseDelay * 0.15 * (Math.random() - 0.5);
    return Math.max(baseDelay + variation, 0.5);
  }

  /**
   * Calculate estimated operation duration
   */
  private calculateEstimatedDuration(transactions: StealthTransaction[], config: StealthConfig): number {
    const totalDelays = transactions.reduce((sum, tx) => sum + tx.executionDelay, 0);
    const batchDelays = config.batchSize > 0 
      ? Math.floor(transactions.length / config.batchSize) * config.batchDelay 
      : 0;
    
    return totalDelays + batchDelays;
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(retryCount: number): number {
    const baseDelay = 5000; // 5 seconds
    return baseDelay * Math.pow(2, retryCount - 1);
  }

  /**
   * Calculate median delay from transactions
   */
  private calculateMedianDelay(transactions: StealthTransaction[]): number {
    const delays = transactions.map(t => t.executionDelay).sort((a, b) => a - b);
    const mid = Math.floor(delays.length / 2);
    return delays.length % 2 === 0 
      ? (delays[mid - 1] + delays[mid]) / 2 
      : delays[mid];
  }

  /**
   * Utility: Generate random number between min and max
   */
  private randomBetween(min: number, max: number): number {
    return Math.random() * (max - min) + min;
  }

  /**
   * Utility: Shuffle array using Fisher-Yates algorithm
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Utility: Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Event system for real-time updates
   */
  addEventListener(listener: (event: StealthOperationEvent) => void): void {
    this.eventListeners.push(listener);
  }

  removeEventListener(listener: (event: StealthOperationEvent) => void): void {
    const index = this.eventListeners.indexOf(listener);
    if (index > -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  private emitEvent(event: StealthOperationEvent, onEvent?: (event: StealthOperationEvent) => void): void {
    // Call provided event handler
    onEvent?.(event);
    
    // Call all registered listeners
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in event listener:', error);
      }
    });
  }
}

// Export singleton instance
export const walletFundingService = WalletFundingService.getInstance();