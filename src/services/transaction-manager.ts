/**
 * Transaction Manager Service
 * Handles transaction queue management, state coordination, and real blockchain transaction execution
 */

import { ethers } from 'ethers';
import { useTransactionStore, type EnhancedTransaction, type TransactionStatus, type TransactionBatch } from '../store/transactions';
import { useExecutionStore } from '../store/execution';
import { useWalletStore } from '../store/wallets';
import { gasManager } from './gas-manager';
import { apiClient } from '../api/client';
import { decryptPrivateKey, secureRetrieve } from '../utils/crypto';
import { config } from '../config/env';

// Real blockchain transaction result
export interface BlockchainTransactionResult {
  hash: string;
  response: ethers.TransactionResponse;
  gasUsed?: string;
  blockNumber?: number;
  confirmations?: number;
}

export interface TransactionQueueConfig {
  maxConcurrent: number;
  batchSize: number;
  pauseBetweenBatches: number;
  retryEnabled: boolean;
  maxRetries: number;
  priorityProcessing: boolean;
}

export interface TransactionStats {
  total: number;
  pending: number;
  executing: number;
  completed: number;
  failed: number;
  successRate: number;
  averageTime: number;
  totalGasUsed: string;
}

class TransactionManager {
  private monitoringInterval: NodeJS.Timeout | null = null;
  private queueProcessor: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private provider: ethers.JsonRpcProvider | null = null;
  private signers = new Map<string, ethers.Wallet>();
  private activeTransactions = new Map<string, ethers.TransactionResponse>();
  
  /**
   * Initialize transaction monitoring
   */
  startMonitoring(intervalMs: number = 2000): void {
    if (this.monitoringInterval) {
      this.stopMonitoring();
    }
    
    const transactionStore = useTransactionStore.getState();
    transactionStore.startMonitoring();
    
    this.monitoringInterval = setInterval(() => {
      this.updateTransactionStatuses();
      this.processQueue();
      this.updateExecutionProgress();
    }, intervalMs);
  }
  
  /**
   * Stop transaction monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    if (this.queueProcessor) {
      clearTimeout(this.queueProcessor);
      this.queueProcessor = null;
    }
    
    const transactionStore = useTransactionStore.getState();
    transactionStore.stopMonitoring();
    this.isProcessing = false;
  }
  
  /**
   * Add transaction to queue with proper prioritization
   */
  queueTransaction(
    transaction: Omit<EnhancedTransaction, 'id' | 'queuedAt'>,
    priority: 'low' | 'normal' | 'high' | 'critical' = 'normal'
  ): string {
    const transactionStore = useTransactionStore.getState();
    
    // Add transaction to store
    const txId = transactionStore.addTransaction({
      ...transaction,
      priority,
      status: 'queued',
    });
    
    // Queue for processing
    transactionStore.queueTransaction(txId, priority);
    
    return txId;
  }
  
  /**
   * Create and manage transaction batch
   */
  createTransactionBatch(
    executionId: string,
    transactions: Array<Omit<EnhancedTransaction, 'id' | 'queuedAt'>>,
    config: TransactionQueueConfig
  ): string {
    const transactionStore = useTransactionStore.getState();
    
    // Add all transactions
    const txIds = transactions.map(tx => 
      transactionStore.addTransaction({
        ...tx,
        status: 'queued',
        executionId,
      })
    );
    
    // Create batch
    const batchId = transactionStore.createBatch(
      executionId,
      txIds,
      config.maxConcurrent
    );
    
    // Queue all transactions
    txIds.forEach(txId => {
      transactionStore.queueTransaction(txId, transactions[txIds.indexOf(txId)].priority || 'normal');
    });
    
    return batchId;
  }
  
  /**
   * Process transaction queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    
    const transactionStore = useTransactionStore.getState();
    const executionStore = useExecutionStore.getState();
    
    // Check if execution is active
    if (executionStore.status !== 'executing') {
      return;
    }
    
    this.isProcessing = true;
    
    try {
      // Dequeue next transaction
      const txId = transactionStore.dequeueTransaction();
      if (!txId) {
        this.isProcessing = false;
        return;
      }
      
      const transaction = transactionStore.transactions[txId];
      if (!transaction) {
        this.isProcessing = false;
        return;
      }
      
      // Process the transaction
      await this.processTransaction(txId);
      
    } catch (error) {
      console.error('Queue processing error:', error);
    } finally {
      this.isProcessing = false;
    }
  }
  
  /**
   * Process individual transaction
   */
  private async processTransaction(txId: string): Promise<void> {
    const transactionStore = useTransactionStore.getState();
    const transaction = transactionStore.transactions[txId];
    
    if (!transaction) return;
    
    try {
      // Update status to pending
      transactionStore.updateTransaction(txId, {
        status: 'pending',
        submittedAt: new Date().toISOString(),
      });
      
      // Get optimized gas price
      const gasPrice = gasManager.getOptimizedGasPrice(
        transaction.priority,
        undefined // Would pass config here
      );
      
      // Update gas price
      transactionStore.updateTransaction(txId, {
        gasPrice,
        effectiveGasPrice: gasPrice,
      });
      
      // Submit real transaction to blockchain
      const result = await this.submitTransaction(transaction);
      
      // Update status to submitted with real transaction hash
      transactionStore.updateTransaction(txId, {
        status: 'submitted',
        hash: result.hash,
        submittedAt: new Date().toISOString(),
      });
      
      console.log(`🎯 Transaction ${txId} submitted with hash: ${result.hash}`);
      
      // Start real confirmation monitoring
      this.monitorTransactionConfirmation(txId);
      
    } catch (error) {
      // Handle transaction failure
      const errorMessage = error instanceof Error ? error.message : 'Transaction processing failed';
      
      transactionStore.updateTransaction(txId, {
        status: 'failed',
        error: errorMessage,
        failedAt: new Date().toISOString(),
      });
      
      // Attempt retry if enabled
      await this.handleTransactionRetry(txId);
    }
  }
  
  /**
   * Submit real transaction to BSC testnet blockchain
   */
  private async submitTransaction(transaction: EnhancedTransaction): Promise<BlockchainTransactionResult> {
    console.log(`🚀 Submitting real transaction for wallet ${transaction.walletId}...`);
    
    try {
      // Initialize provider if needed
      await this.ensureProviderInitialized();
      
      if (!this.provider) {
        throw new Error('Provider not initialized');
      }

      // Get wallet information
      const walletStore = useWalletStore.getState();
      const wallet = walletStore.getWalletById(transaction.walletId);
      if (!wallet) {
        throw new Error(`Wallet ${transaction.walletId} not found`);
      }

      // Get or create signer for this wallet
      let signer = this.signers.get(transaction.walletId);
      if (!signer) {
        // Get session passphrase from execution store
        const executionStore = useExecutionStore.getState();
        // Use a mock passphrase for testing - in production this would come from authenticated session
        const passphrase = 'test-passphrase-123'; // TODO: Get from authenticated session
        if (!passphrase) {
          throw new Error('Session passphrase not available - execution must be authenticated');
        }

        // Decrypt private key
        const encryptedKey = await secureRetrieve(`wallet_${wallet.id}_pk`);
        if (!encryptedKey) {
          throw new Error(`No encrypted private key found for wallet ${wallet.id}`);
        }

        const privateKey = await decryptPrivateKey(encryptedKey, passphrase);
        signer = new ethers.Wallet(privateKey, this.provider);
        this.signers.set(transaction.walletId, signer);
        
        // Log signer creation (without exposing private key)
        console.log(`🔑 Created signer for wallet ${wallet.address}`);
      }

      // Verify signer address matches wallet
      if (signer.address.toLowerCase() !== wallet.address.toLowerCase()) {
        throw new Error(`Signer address mismatch for wallet ${transaction.walletId}`);
      }

      // Get nonce for the wallet
      const nonce = await this.provider.getTransactionCount(wallet.address, 'pending');
      console.log(`📋 Using nonce ${nonce} for wallet ${wallet.address}`);

      // Build transaction request based on type
      let txRequest: ethers.TransactionRequest;
      
      if (transaction.type === 'buy') {
        // Token purchase transaction
        if (!transaction.to) {
          throw new Error('Token address required for buy transaction');
        }
        
        // For now, implement a simple BNB transfer (in production this would be DEX swap)
        txRequest = {
          to: transaction.to,
          value: ethers.parseEther(transaction.value),
          gasLimit: transaction.gasLimit || '21000',
          gasPrice: transaction.gasPrice || await this.provider.getFeeData().then(f => f.gasPrice),
          nonce,
        };
        
      } else if (transaction.type === 'sell') {
        // Token sell transaction - simplified for testing
        txRequest = {
          to: transaction.to || wallet.address,
          value: ethers.parseEther('0'), // Token transfers don't send BNB
          gasLimit: transaction.gasLimit || '50000',
          gasPrice: transaction.gasPrice || await this.provider.getFeeData().then(f => f.gasPrice),
          nonce,
        };
        
      } else {
        // Default transfer transaction
        txRequest = {
          to: transaction.to || wallet.address,
          value: ethers.parseEther(transaction.value),
          gasLimit: transaction.gasLimit || '21000',
          gasPrice: transaction.gasPrice || await this.provider.getFeeData().then(f => f.gasPrice),
          nonce,
        };
      }

      console.log(`💸 Transaction details:`, {
        type: transaction.type,
        from: wallet.address,
        to: txRequest.to,
        value: txRequest.value?.toString(),
        gasLimit: txRequest.gasLimit?.toString(),
        gasPrice: txRequest.gasPrice?.toString(),
        nonce
      });

      // Sign and send transaction
      const txResponse = await signer.sendTransaction(txRequest);
      console.log(`✅ Transaction submitted! Hash: ${txResponse.hash}`);
      console.log(`⛽ Gas limit: ${txResponse.gasLimit?.toString()}`);
      console.log(`💰 Gas price: ${txResponse.gasPrice ? ethers.formatUnits(txResponse.gasPrice, 'gwei') : 'unknown'} gwei`);
      
      // Store transaction response for monitoring
      this.activeTransactions.set(transaction.id, txResponse);
      
      return {
        hash: txResponse.hash,
        response: txResponse,
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Transaction submission failed';
      console.error(`❌ Transaction submission failed:`, errorMessage);
      throw new Error(`Blockchain transaction failed: ${errorMessage}`);
    }
  }
  
  /**
   * Monitor real transaction confirmation on blockchain
   */
  private async monitorTransactionConfirmation(txId: string): Promise<void> {
    const transactionStore = useTransactionStore.getState();
    const transaction = transactionStore.transactions[txId];
    
    if (!transaction || transaction.status !== 'submitted') return;
    
    // Get the active transaction response
    const txResponse = this.activeTransactions.get(txId);
    if (!txResponse) {
      console.error(`❌ No transaction response found for ${txId}`);
      return;
    }

    try {
      console.log(`⏳ Monitoring confirmation for transaction ${txResponse.hash}...`);
      
      // Update to confirming status
      transactionStore.updateTransaction(txId, {
        status: 'confirming',
      });

      // Wait for transaction to be mined (with timeout)
      const receipt = await Promise.race([
        txResponse.wait(),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Transaction confirmation timeout')), 120000) // 2 minutes
        )
      ]);

      if (!receipt) {
        throw new Error('Transaction receipt not received');
      }

      const success = receipt.status === 1;
      console.log(`${success ? '✅' : '❌'} Transaction ${success ? 'confirmed' : 'failed'}: ${txResponse.hash}`);
      console.log(`📊 Block number: ${receipt.blockNumber}`);
      console.log(`⛽ Gas used: ${receipt.gasUsed.toString()}`);
      console.log(`💰 Gas price: ${receipt.gasPrice ? ethers.formatUnits(receipt.gasPrice, 'gwei') : 'unknown'} gwei`);

      // Update transaction with confirmation details
      transactionStore.updateTransaction(txId, {
        status: success ? 'confirmed' : 'failed',
        confirmations: 1,
        confirmedAt: new Date().toISOString(),
        gasUsed: receipt.gasUsed.toString(),
        gasUsedActual: receipt.gasUsed.toString(),
        blockNumber: receipt.blockNumber,
        error: success ? undefined : 'Transaction reverted on blockchain',
      });

      // Continue monitoring for additional confirmations if successful
      if (success) {
        this.monitorAdditionalConfirmations(txResponse.hash, txId, receipt.blockNumber);
      }

      // Clean up
      this.activeTransactions.delete(txId);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Confirmation monitoring failed';
      console.error(`❌ Transaction confirmation failed:`, errorMessage);
      
      transactionStore.updateTransaction(txId, {
        status: 'failed',
        error: errorMessage,
        failedAt: new Date().toISOString(),
      });
      
      // Clean up
      this.activeTransactions.delete(txId);
    }
  }
  
  /**
   * Handle transaction retry logic
   */
  private async handleTransactionRetry(txId: string): Promise<void> {
    const transactionStore = useTransactionStore.getState();
    const transaction = transactionStore.transactions[txId];
    
    if (!transaction) return;
    
    // Check if retry is allowed
    if (transaction.retryCount >= transaction.maxRetries) {
      return;
    }
    
    // Check if error is retryable
    const retryableErrors = [
      'network error',
      'timeout',
      'nonce too low',
      'insufficient funds',
      'replacement transaction underpriced',
    ];
    
    const isRetryable = retryableErrors.some(error => 
      transaction.error?.toLowerCase().includes(error.toLowerCase())
    );
    
    if (!isRetryable) return;
    
    // Schedule retry with exponential backoff
    const retryDelay = Math.min(
      5000 * Math.pow(2, transaction.retryCount), // Exponential backoff
      30000 // Max 30 seconds
    );
    
    setTimeout(async () => {
      try {
        await transactionStore.retryTransaction(txId);
      } catch (error) {
        console.error('Retry failed:', error);
      }
    }, retryDelay);
  }
  
  /**
   * Update transaction statuses from blockchain
   */
  private async updateTransactionStatuses(): Promise<void> {
    const transactionStore = useTransactionStore.getState();
    const pendingTransactions = transactionStore.getTransactionsByStatus('submitted');
    
    // In real implementation, would batch check transaction statuses
    for (const transaction of pendingTransactions.slice(0, 10)) { // Limit to 10 per check
      try {
        await transactionStore.pollTransactionStatus(transaction.id);
      } catch (error) {
        console.warn('Failed to poll transaction status:', error);
      }
    }
  }
  
  /**
   * Update execution progress based on transaction states
   */
  private updateExecutionProgress(): void {
    const transactionStore = useTransactionStore.getState();
    const executionStore = useExecutionStore.getState();
    
    if (!executionStore.currentSession) return;
    
    const executionId = executionStore.currentSession.id;
    const executionTransactions = transactionStore.getTransactionsByExecution(executionId);
    
    const stats = this.calculateTransactionStats(executionTransactions);
    
    // Update execution progress
    executionStore.updateProgress({
      completedTransactions: stats.completed,
      totalTransactions: stats.total,
      overallProgress: stats.total > 0 ? (stats.completed / stats.total) * 100 : 0,
    });
    
    // Update execution statistics
    executionStore.updateStatistics({
      totalTransactions: stats.total,
      successfulTransactions: stats.completed,
      failedTransactions: stats.failed,
      pendingTransactions: stats.pending,
      successRate: stats.successRate,
      totalGasUsed: stats.totalGasUsed,
    });
  }
  
  /**
   * Ensure blockchain provider is initialized
   */
  private async ensureProviderInitialized(): Promise<void> {
    if (this.provider) {
      return; // Already initialized
    }

    try {
      // BSC Testnet RPC URLs with fallbacks
      const bscTestnetRpcUrls = [
        'https://data-seed-prebsc-1-s1.binance.org:8545/',
        'https://data-seed-prebsc-2-s1.binance.org:8545/',
        'https://bsc-testnet-rpc.publicnode.com',
        'https://bsc-testnet.blockpi.network/v1/rpc/public'
      ];
      
      for (const rpcUrl of bscTestnetRpcUrls) {
        try {
          console.log(`🔗 Transaction Manager: Connecting to BSC testnet: ${rpcUrl}`);
          
          this.provider = new ethers.JsonRpcProvider(rpcUrl, {
            name: 'BSC Testnet',
            chainId: 97
          });

          // Test connection
          const network = await this.provider.getNetwork();
          if (Number(network.chainId) !== 97) {
            throw new Error(`Invalid network - expected chain ID 97, got ${network.chainId}`);
          }

          console.log(`✅ Transaction Manager: Connected to BSC testnet successfully!`);
          return;
          
        } catch (error) {
          console.warn(`❌ Failed to connect to ${rpcUrl}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          if (this.provider) {
            this.provider.destroy();
            this.provider = null;
          }
        }
      }
      
      throw new Error('Failed to connect to any BSC testnet RPC');
      
    } catch (error) {
      this.provider = null;
      throw new Error(`Provider initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Monitor additional confirmations beyond the first
   */
  private async monitorAdditionalConfirmations(
    txHash: string,
    txId: string,
    txBlockNumber: number
  ): Promise<void> {
    if (!this.provider) return;
    
    const requiredConfirmations = 3; // BSC testnet confirmations
    let currentConfirmations = 1;
    
    console.log(`⏳ Monitoring additional confirmations for ${txHash}...`);
    
    const checkConfirmations = async () => {
      try {
        if (!this.provider) return;
        
        const currentBlock = await this.provider.getBlockNumber();
        const newConfirmations = currentBlock - txBlockNumber + 1;
        
        if (newConfirmations > currentConfirmations) {
          currentConfirmations = newConfirmations;
          
          const transactionStore = useTransactionStore.getState();
          transactionStore.updateTransaction(txId, {
            confirmations: currentConfirmations,
          });
          
          console.log(`📊 Transaction ${txHash} now has ${currentConfirmations} confirmations`);
          
          if (currentConfirmations >= requiredConfirmations) {
            console.log(`✅ Transaction ${txHash} fully confirmed with ${currentConfirmations} confirmations`);
            return;
          }
        }
        
        // Continue checking if not enough confirmations
        if (currentConfirmations < requiredConfirmations) {
          setTimeout(checkConfirmations, 3000); // Check every 3 seconds
        }
        
      } catch (error) {
        console.warn(`⚠️ Error checking confirmations for ${txHash}:`, error);
      }
    };
    
    // Start checking after initial delay
    setTimeout(checkConfirmations, 3000);
  }

  /**
   * Clean up provider and signers resources
   */
  cleanup(): void {
    console.log('🧹 Cleaning up TransactionManager resources...');
    
    // Clear signers (helps with memory cleanup and key zeroization)
    this.signers.clear();
    
    // Clear active transactions
    this.activeTransactions.clear();
    
    // Close provider connection
    if (this.provider) {
      this.provider.destroy();
      this.provider = null;
    }
    
    console.log('✅ TransactionManager cleanup completed');
  }

  /**
   * Calculate transaction statistics
   */
  calculateTransactionStats(transactions: EnhancedTransaction[]): TransactionStats {
    const stats: TransactionStats = {
      total: transactions.length,
      pending: 0,
      executing: 0,
      completed: 0,
      failed: 0,
      successRate: 0,
      averageTime: 0,
      totalGasUsed: '0',
    };
    
    if (transactions.length === 0) return stats;
    
    let totalGasUsed = BigInt(0);
    let totalTime = 0;
    let completedWithTiming = 0;
    
    transactions.forEach(tx => {
      switch (tx.status) {
        case 'queued':
        case 'pending':
          stats.pending++;
          break;
        case 'submitted':
        case 'confirming':
          stats.executing++;
          break;
        case 'confirmed':
          stats.completed++;
          if (tx.gasUsedActual) {
            totalGasUsed += BigInt(tx.gasUsedActual);
          }
          if (tx.submittedAt && tx.confirmedAt) {
            totalTime += new Date(tx.confirmedAt).getTime() - new Date(tx.submittedAt).getTime();
            completedWithTiming++;
          }
          break;
        case 'failed':
        case 'cancelled':
          stats.failed++;
          break;
      }
    });
    
    stats.successRate = (stats.completed + stats.failed) > 0 
      ? (stats.completed / (stats.completed + stats.failed)) * 100 
      : 0;
    
    stats.averageTime = completedWithTiming > 0 
      ? totalTime / completedWithTiming / 1000 // Convert to seconds
      : 0;
    
    stats.totalGasUsed = totalGasUsed.toString();
    
    return stats;
  }
  
  /**
   * Get transaction queue status
   */
  getQueueStatus(): {
    queueLength: number;
    activeTransactions: number;
    isPaused: boolean;
    processingRate: number;
  } {
    const transactionStore = useTransactionStore.getState();
    
    return {
      queueLength: transactionStore.queue.transactions.length,
      activeTransactions: transactionStore.queue.activeTransactions.length,
      isPaused: transactionStore.queue.isPaused,
      processingRate: 0, // Would calculate based on recent processing history
    };
  }
  
  /**
   * Pause transaction queue
   */
  pauseQueue(): void {
    const transactionStore = useTransactionStore.getState();
    transactionStore.pauseQueue();
  }
  
  /**
   * Resume transaction queue
   */
  resumeQueue(): void {
    const transactionStore = useTransactionStore.getState();
    transactionStore.resumeQueue();
  }
  
  /**
   * Clear completed transactions
   */
  clearCompleted(): void {
    const transactionStore = useTransactionStore.getState();
    transactionStore.clearCompleted();
  }
  
  /**
   * Emergency stop all transactions
   */
  emergencyStop(): void {
    this.stopMonitoring();
    
    const transactionStore = useTransactionStore.getState();
    
    // Cancel all queued and pending transactions
    const activeTransactions = [
      ...transactionStore.getTransactionsByStatus('queued'),
      ...transactionStore.getTransactionsByStatus('pending'),
    ];
    
    activeTransactions.forEach(tx => {
      transactionStore.cancelTransaction(tx.id);
    });
    
    // Clear queue
    transactionStore.clearQueue();
  }
  
  /**
   * Get detailed transaction report
   */
  generateTransactionReport(executionId?: string): {
    summary: TransactionStats;
    transactions: EnhancedTransaction[];
    batches: TransactionBatch[];
    timeline: Array<{
      timestamp: string;
      event: string;
      transactionId: string;
      details: Record<string, any>;
    }>;
  } {
    const transactionStore = useTransactionStore.getState();
    
    const transactions = executionId
      ? transactionStore.getTransactionsByExecution(executionId)
      : Object.values(transactionStore.transactions);
    
    const batches = Object.values(transactionStore.batches).filter(batch => 
      !executionId || batch.executionId === executionId
    );
    
    const summary = this.calculateTransactionStats(transactions);
    
    // Create timeline
    const timeline: any[] = [];
    transactions.forEach(tx => {
      if (tx.queuedAt) {
        timeline.push({
          timestamp: tx.queuedAt,
          event: 'queued',
          transactionId: tx.id,
          details: { type: tx.type, amount: tx.value, walletId: tx.walletId },
        });
      }
      
      if (tx.submittedAt) {
        timeline.push({
          timestamp: tx.submittedAt,
          event: 'submitted',
          transactionId: tx.id,
          details: { hash: tx.hash, gasPrice: tx.gasPrice },
        });
      }
      
      if (tx.confirmedAt) {
        timeline.push({
          timestamp: tx.confirmedAt,
          event: 'confirmed',
          transactionId: tx.id,
          details: { gasUsed: tx.gasUsed, confirmations: tx.confirmations },
        });
      }
      
      if (tx.failedAt) {
        timeline.push({
          timestamp: tx.failedAt,
          event: 'failed',
          transactionId: tx.id,
          details: { error: tx.error, retryCount: tx.retryCount },
        });
      }
    });
    
    // Sort timeline by timestamp
    timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    return {
      summary,
      transactions,
      batches,
      timeline,
    };
  }
}

export const transactionManager = new TransactionManager();
export default transactionManager;