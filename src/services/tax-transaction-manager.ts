/**
 * Tax-Enhanced Transaction Manager
 * Extends transaction management with integrated tax collection processing
 * Coordinates main transactions with automatic tax transfers to treasury
 */

import { ethers } from 'ethers';
import { useTransactionStore, type EnhancedTransaction, type TransactionStatus, type TransactionBatch } from '../store/transactions';
import { useExecutionStore } from '../store/execution';
import { useWalletStore } from '../store/wallets';
import { gasManager } from './gas-manager';
import { apiClient } from '../api/client';
import { decryptPrivateKey, secureRetrieve } from '../utils/crypto';
import { config } from '../config/env';
import { taxMonitoringService } from './tax-monitoring';
import { bscRpcClient } from './bsc-rpc';
import type { TaxConfiguration, RecordTaxTransactionRequest } from '../types';

// Enhanced transaction interface with tax information
export interface TaxEnhancedTransaction extends EnhancedTransaction {
  isTaxTransaction?: boolean;
  originalTransactionId?: string;
  taxAmount?: string;
  taxRate?: number;
  isExcludedFromTax?: boolean;
  taxCollectionStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  taxTransactionHash?: string;
}

export interface TaxTransactionResult {
  mainTransaction: {
    hash: string;
    status: 'pending' | 'success' | 'failed';
    gasUsed?: string;
    blockNumber?: number;
  };
  taxTransaction?: {
    hash: string;
    status: 'pending' | 'success' | 'failed';
    amount: string;
    gasUsed?: string;
    blockNumber?: number;
  };
  totalGasUsed: string;
  success: boolean;
  error?: string;
}

export interface TaxCollectionStats {
  totalCollected: string;
  transactionsProcessed: number;
  successfulCollections: number;
  failedCollections: number;
  averageCollectionTime: number;
  treasuryWallet: string;
  lastCollectionAt?: string;
}

class TaxEnhancedTransactionManager {
  private monitoringInterval: NodeJS.Timeout | null = null;
  private queueProcessor: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private provider: ethers.JsonRpcProvider | null = null;
  private signers = new Map<string, ethers.Wallet>();
  private activeTransactions = new Map<string, ethers.TransactionResponse>();
  private taxConfig: TaxConfiguration | null = null;
  private excludedWallets = new Set<string>();
  private taxCollectionStats: TaxCollectionStats;

  // Treasury wallet address
  private readonly TREASURY_WALLET = '0x91e58Ea55BF914fE15444E34AF11A259f1DE8526';

  constructor() {
    this.taxCollectionStats = {
      totalCollected: '0',
      transactionsProcessed: 0,
      successfulCollections: 0,
      failedCollections: 0,
      averageCollectionTime: 0,
      treasuryWallet: this.TREASURY_WALLET,
    };
    
    this.initializeTaxSystem();
  }

  /**
   * Initialize tax system integration
   */
  private async initializeTaxSystem(): Promise<void> {
    try {
      // Load tax configuration
      const response = await apiClient.getTaxConfig();
      if (response.success && response.data) {
        this.taxConfig = response.data;
      }

      // Load excluded wallets
      const excludedResponse = await apiClient.getExcludedWallets();
      if (excludedResponse.success && excludedResponse.data) {
        this.excludedWallets = new Set(excludedResponse.data.map(w => w.address.toLowerCase()));
      }

      console.log('Tax-enhanced transaction manager initialized');
    } catch (error) {
      console.error('Failed to initialize tax system:', error);
    }
  }

  /**
   * Start monitoring with tax collection support
   */
  startMonitoring(intervalMs: number = 2000): void {
    if (this.monitoringInterval) {
      this.stopMonitoring();
    }
    
    const transactionStore = useTransactionStore.getState();
    transactionStore.startMonitoring();
    
    this.monitoringInterval = setInterval(() => {
      this.updateTransactionStatuses();
      this.processTaxEnhancedQueue();
      this.updateExecutionProgress();
      this.processPendingTaxCollections();
    }, intervalMs);

    // Start tax monitoring service
    taxMonitoringService.startMonitoring();
    
    console.log('Tax-enhanced transaction monitoring started');
  }

  /**
   * Stop monitoring and tax collection
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

    // Stop tax monitoring
    taxMonitoringService.stopMonitoring();
    
    console.log('Tax-enhanced transaction monitoring stopped');
  }

  /**
   * Process queue with integrated tax collection
   */
  private async processTaxEnhancedQueue(): Promise<void> {
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
      
      const transaction = transactionStore.transactions[txId] as TaxEnhancedTransaction;
      if (!transaction) {
        this.isProcessing = false;
        return;
      }
      
      // Process the transaction with tax integration
      await this.processTaxEnhancedTransaction(transaction);
      
    } catch (error) {
      console.error('Error in tax-enhanced queue processing:', error);
    }
    
    this.isProcessing = false;
  }

  /**
   * Process individual transaction with tax collection
   */
  private async processTaxEnhancedTransaction(transaction: TaxEnhancedTransaction): Promise<void> {
    const transactionStore = useTransactionStore.getState();
    
    try {
      // Update status to pending (processing)
      transactionStore.updateTransaction(transaction.id, { status: 'pending' });
      
      // Check if this is a tax collection transaction
      if (transaction.isTaxTransaction) {
        await this.processTaxCollectionTransaction(transaction);
        return;
      }

      // Process regular transaction first
      const result = await this.executeMainTransaction(transaction);
      
      if (result.success && result.mainTransaction.hash) {
        // Update transaction with result
        transactionStore.updateTransaction(transaction.id, { status: 'submitted' });
        transactionStore.updateTransaction(transaction.id, {
          hash: result.mainTransaction.hash,
          gasUsed: result.mainTransaction.gasUsed,
          blockNumber: result.mainTransaction.blockNumber,
        });

        // Schedule tax collection if applicable
        if (this.shouldCollectTax(transaction)) {
          await this.scheduleTaxCollection(transaction, result.mainTransaction.hash);
        }

        // Add wallet to monitoring
        await this.addWalletToTaxMonitoring(transaction);
        
        console.log(`Transaction ${transaction.id} processed successfully with tax integration`);
      } else {
        // Handle failure
        transactionStore.updateTransaction(transaction.id, { status: 'failed' });
        transactionStore.updateTransaction(transaction.id, {
          error: result.error || 'Transaction execution failed',
        });
      }
    } catch (error) {
      console.error(`Failed to process tax-enhanced transaction ${transaction.id}:`, error);
      transactionStore.updateTransactionStatus(transaction.id, 'failed');
      transactionStore.updateTransaction(transaction.id, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Execute the main buy/sell transaction
   */
  private async executeMainTransaction(transaction: TaxEnhancedTransaction): Promise<TaxTransactionResult> {
    try {
      const walletStore = useWalletStore.getState();
      const wallet = walletStore.getWalletById(transaction.walletId);
      
      if (!wallet) {
        throw new Error(`Wallet not found: ${transaction.walletId}`);
      }

      // Get private key for transaction signing
      const encryptedKey = await secureRetrieve(`wallet_${wallet.id}_pk`);
      if (!encryptedKey) {
        throw new Error('Private key not found');
      }

      // Note: In a real implementation, the passphrase would be securely obtained
      // For this example, we'll need to handle passphrase management properly
      
      // Execute transaction via BSC RPC client
      // This is simplified - in reality would involve DEX contract interactions
      const txResult = await bscRpcClient.createAndSendTransaction({
        privateKey: 'temp_key', // This needs proper passphrase management
        to: transaction.to || wallet.address,
        value: transaction.amount,
        data: transaction.data,
        gasLimit: transaction.gasLimit,
        gasPrice: transaction.gasPrice,
      });

      return {
        mainTransaction: {
          hash: txResult.hash,
          status: 'pending',
          gasUsed: txResult.gasUsed,
        },
        totalGasUsed: txResult.gasUsed || '0',
        success: true,
      };
    } catch (error) {
      return {
        mainTransaction: {
          hash: '',
          status: 'failed',
        },
        totalGasUsed: '0',
        success: false,
        error: error instanceof Error ? error.message : 'Transaction failed',
      };
    }
  }

  /**
   * Process tax collection transaction
   */
  private async processTaxCollectionTransaction(transaction: TaxEnhancedTransaction): Promise<void> {
    const transactionStore = useTransactionStore.getState();
    
    try {
      if (!this.taxConfig || !transaction.taxAmount) {
        throw new Error('Tax configuration or amount not available');
      }

      const walletStore = useWalletStore.getState();
      const wallet = walletStore.getWalletById(transaction.walletId);
      
      if (!wallet) {
        throw new Error(`Wallet not found: ${transaction.walletId}`);
      }

      // Execute tax transfer to treasury
      const taxResult = await bscRpcClient.createAndSendTransaction({
        privateKey: 'temp_key', // Needs proper key management
        to: this.taxConfig.treasury_wallet,
        value: transaction.taxAmount,
      });

      // Wait for confirmation
      const confirmedTax = await bscRpcClient.confirmTransaction(taxResult.hash, 1, 60000);

      if (confirmedTax.status === 'success') {
        // Update transaction status
        transactionStore.updateTransactionStatus(transaction.id, 'confirmed');
        transactionStore.updateTransaction(transaction.id, {
          hash: confirmedTax.hash,
          gasUsed: confirmedTax.gasUsed,
          blockNumber: confirmedTax.blockNumber,
          taxCollectionStatus: 'completed',
          taxTransactionHash: confirmedTax.hash,
        });

        // Record in backend
        await this.recordTaxTransaction({
          original_tx_hash: transaction.originalTransactionId || '',
          tax_tx_hash: confirmedTax.hash,
          wallet_address: wallet.address,
          transaction_amount: parseFloat(transaction.amount || '0'),
          tax_amount: parseFloat(transaction.taxAmount),
          tax_rate_percent: transaction.taxRate || 5,
          treasury_wallet: this.taxConfig.treasury_wallet,
          transaction_type: transaction.type === 'buy' ? 'buy' : 'sell',
          status: 'confirmed',
          block_number: confirmedTax.blockNumber,
          gas_used: confirmedTax.gasUsed,
        });

        // Update stats
        this.updateTaxCollectionStats(parseFloat(transaction.taxAmount), true);
        
        console.log(`Tax collection completed: ${transaction.taxAmount} BNB from ${wallet.address}`);
      } else {
        throw new Error('Tax transaction confirmation failed');
      }
    } catch (error) {
      console.error(`Tax collection transaction failed:`, error);
      
      transactionStore.updateTransactionStatus(transaction.id, 'failed');
      transactionStore.updateTransaction(transaction.id, {
        error: error instanceof Error ? error.message : 'Tax collection failed',
        taxCollectionStatus: 'failed',
      });

      // Update failure stats
      this.updateTaxCollectionStats(0, false);
    }
  }

  /**
   * Check if tax should be collected for a transaction
   */
  private shouldCollectTax(transaction: TaxEnhancedTransaction): boolean {
    if (!this.taxConfig?.enabled || transaction.isExcludedFromTax) {
      return false;
    }

    // Check transaction type
    const isBuyTax = transaction.type === 'buy' && this.taxConfig.apply_to_buys;
    const isSellTax = transaction.type === 'sell' && this.taxConfig.apply_to_sells;
    
    if (!isBuyTax && !isSellTax) {
      return false;
    }

    // Check minimum amount
    const txAmount = parseFloat(transaction.amount || '0');
    const taxAmount = (txAmount * this.taxConfig.tax_rate_percent) / 100;
    
    return taxAmount >= (this.taxConfig.minimum_tax_amount || 0.001);
  }

  /**
   * Schedule tax collection for a successful transaction
   */
  private async scheduleTaxCollection(transaction: TaxEnhancedTransaction, mainTxHash: string): Promise<void> {
    if (!this.taxConfig) return;

    try {
      const transactionStore = useTransactionStore.getState();
      const txAmount = parseFloat(transaction.amount || '0');
      const taxAmount = (txAmount * this.taxConfig.tax_rate_percent) / 100;

      // Create tax collection transaction
      const taxTransactionId = transactionStore.addTransaction({
        walletId: transaction.walletId,
        type: 'transfer',
        amount: taxAmount.toString(),
        to: this.taxConfig.treasury_wallet,
        priority: 'high',
        executionId: transaction.executionId,
        status: 'queued',
        queuedAt: Date.now(),
        gasLimit: '21000',
        confirmations: 0,
        retryCount: 0,
        maxRetries: 3,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        // Tax-specific fields
        isTaxTransaction: true,
        originalTransactionId: transaction.id,
        taxAmount: taxAmount.toString(),
        taxRate: this.taxConfig.tax_rate_percent,
        taxCollectionStatus: 'pending',
      } as any);

      // Queue with high priority
      transactionStore.queueTransaction(taxTransactionId, 'high');
      
      console.log(`Tax collection scheduled for transaction ${transaction.id}: ${taxAmount} BNB`);
    } catch (error) {
      console.error('Failed to schedule tax collection:', error);
    }
  }

  /**
   * Add wallet to tax monitoring system
   */
  private async addWalletToTaxMonitoring(transaction: TaxEnhancedTransaction): Promise<void> {
    try {
      if (!transaction.isExcludedFromTax) {
        const walletStore = useWalletStore.getState();
        const wallet = walletStore.getWalletById(transaction.walletId);
        
        if (wallet) {
          taxMonitoringService.addWalletToMonitoring(
            wallet.address,
            undefined, // Private key handled separately for security
            false
          );
        }
      }
    } catch (error) {
      console.error('Failed to add wallet to tax monitoring:', error);
    }
  }

  /**
   * Process pending tax collections
   */
  private async processPendingTaxCollections(): Promise<void> {
    try {
      const transactionStore = useTransactionStore.getState();
      const pendingTaxTransactions = Object.values(transactionStore.transactions)
        .filter((tx): tx is TaxEnhancedTransaction => 
          (tx as TaxEnhancedTransaction).isTaxTransaction === true && 
          tx.status === 'queued'
        );

      // Process up to 3 tax collections per interval to avoid overwhelming
      for (const tx of pendingTaxTransactions.slice(0, 3)) {
        if (tx.taxCollectionStatus === 'pending') {
          await this.processTaxCollectionTransaction(tx);
        }
      }
    } catch (error) {
      console.error('Error processing pending tax collections:', error);
    }
  }

  /**
   * Record tax transaction in backend
   */
  private async recordTaxTransaction(transaction: RecordTaxTransactionRequest): Promise<void> {
    try {
      const response = await apiClient.recordTaxTransaction(transaction);
      if (!response.success) {
        console.error('Failed to record tax transaction:', response.error);
      }
    } catch (error) {
      console.error('Error recording tax transaction:', error);
    }
  }

  /**
   * Update tax collection statistics
   */
  private updateTaxCollectionStats(amount: number, success: boolean): void {
    this.taxCollectionStats.transactionsProcessed++;
    
    if (success) {
      this.taxCollectionStats.successfulCollections++;
      const currentTotal = parseFloat(this.taxCollectionStats.totalCollected);
      this.taxCollectionStats.totalCollected = (currentTotal + amount).toString();
      this.taxCollectionStats.lastCollectionAt = new Date().toISOString();
    } else {
      this.taxCollectionStats.failedCollections++;
    }

    // Update average collection time (simplified calculation)
    this.taxCollectionStats.averageCollectionTime = 
      (this.taxCollectionStats.averageCollectionTime + 5000) / 2; // Rough average
  }

  /**
   * Get tax collection statistics
   */
  getTaxCollectionStats(): TaxCollectionStats {
    return { ...this.taxCollectionStats };
  }

  /**
   * Update transaction statuses including tax transactions
   */
  private async updateTransactionStatuses(): Promise<void> {
    try {
      const transactionStore = useTransactionStore.getState();
      const pendingTransactions = Object.values(transactionStore.transactions)
        .filter(tx => tx.status === 'submitted' || tx.status === 'confirming');

      for (const transaction of pendingTransactions) {
        if (transaction.hash) {
          try {
            const receipt = await bscRpcClient.getTransactionReceipt(transaction.hash);
            if (receipt) {
              const status = receipt.status === 1 ? 'confirmed' : 'failed';
              transactionStore.updateTransactionStatus(transaction.id, status);
              
              if (receipt.status === 1) {
                transactionStore.updateTransaction(transaction.id, {
                  gasUsed: receipt.gasUsed?.toString(),
                  blockNumber: receipt.blockNumber,
                });
              }
            }
          } catch (error) {
            console.error(`Failed to check status for transaction ${transaction.hash}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Error updating transaction statuses:', error);
    }
  }

  /**
   * Update execution progress including tax metrics
   */
  private updateExecutionProgress(): void {
    try {
      const transactionStore = useTransactionStore.getState();
      const executionStore = useExecutionStore.getState();
      
      const transactions = Object.values(transactionStore.transactions) as TaxEnhancedTransaction[];
      const currentExecution = executionStore.currentSession?.executionId;
      
      if (!currentExecution) return;
      
      const executionTransactions = transactions.filter(tx => tx.executionId === currentExecution);
      const completedTx = executionTransactions.filter(tx => tx.status === 'confirmed');
      const failedTx = executionTransactions.filter(tx => tx.status === 'failed');
      const taxTransactions = executionTransactions.filter(tx => tx.isTaxTransaction);
      const completedTaxTransactions = taxTransactions.filter(tx => tx.status === 'confirmed');
      
      const progress = executionTransactions.length > 0 
        ? ((completedTx.length + failedTx.length) / executionTransactions.length) * 100 
        : 0;

      executionStore.updateProgress({
        percentage: progress,
        completed: completedTx.length,
        failed: failedTx.length,
        total: executionTransactions.length,
        // Tax-specific metrics
        taxTransactionsTotal: taxTransactions.length,
        taxTransactionsCompleted: completedTaxTransactions.length,
        totalTaxCollected: this.taxCollectionStats.totalCollected,
      });
    } catch (error) {
      console.error('Error updating execution progress:', error);
    }
  }

  /**
   * Get current tax configuration
   */
  getTaxConfiguration(): TaxConfiguration | null {
    return this.taxConfig;
  }

  /**
   * Refresh tax configuration
   */
  async refreshTaxConfiguration(): Promise<void> {
    await this.initializeTaxSystem();
  }
}

// Export singleton instance
export const taxEnhancedTransactionManager = new TaxEnhancedTransactionManager();
export default taxEnhancedTransactionManager;