/**
 * Tax Monitoring Service
 * Monitors wallet transactions and automatically applies 5% tax collection
 * Integrates with existing BSC RPC client and QuickNode infrastructure
 */

import { ethers, formatEther, parseEther, Contract } from 'ethers';
import { bscRpcClient } from './bsc-rpc';
import { apiClient } from '../api/client';
import { SecurityLogger, assertNoPrivateKeys, validateWalletData, requireUnlockedSession } from '../utils/security-guards';
import type { 
  TaxTransaction, 
  TaxMonitoringEvent, 
  TaxCollectionJob, 
  TaxConfiguration,
  RecordTaxTransactionRequest,
  TransactionWithTax,
  WalletWithTaxInfo
} from '../types';

export interface MonitoredWallet {
  address: string;
  // SECURITY: Private keys are NOT stored in monitoring data
  // Private keys are retrieved securely when needed via encrypted storage
  isExcluded: boolean;
  lastCheckedBlock: number;
  hasSecureAccess: boolean; // Flag indicating if secure key access is available
}

export interface TransactionEvent {
  hash: string;
  from: string;
  to: string;
  value: string;
  blockNumber: number;
  timestamp: number;
  transactionType: 'buy' | 'sell' | 'transfer';
  isMonitoredWallet: boolean;
}

export interface TaxCalculation {
  originalAmount: number; // in BNB
  taxAmount: number; // in BNB
  taxRate: number; // percentage
  shouldCollectTax: boolean;
  reason?: string; // Why tax was or wasn't applied
}

class TaxMonitoringService {
  private isMonitoring = false;
  private monitoredWallets: Map<string, MonitoredWallet> = new Map();
  private taxConfig: TaxConfiguration | null = null;
  private collectionJobs: Map<string, TaxCollectionJob> = new Map();
  private eventListeners: ((event: TaxMonitoringEvent) => void)[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  private lastProcessedBlock = 0;
  private readonly POLL_INTERVAL = 5000; // 5 seconds
  private readonly MAX_BLOCKS_PER_POLL = 100;
  private readonly TREASURY_WALLET = '0x91e58Ea55BF914fE15444E34AF11A259f1DE8526';

  constructor() {
    SecurityLogger.log('info', 'Tax Monitoring Service initializing with security hardening');
  }

  /**
   * SECURITY HARDENED: Initialize with validation
   */
  async initialize(): Promise<void> {
    try {
      // SECURITY: Validate treasury wallet address
      if (!validateWalletData.address(this.TREASURY_WALLET)) {
        throw new Error('Invalid treasury wallet address');
      }
      
      // Load tax configuration from backend
      await this.loadTaxConfiguration();
      
      // Get current block number as starting point
      const currentBlock = await bscRpcClient.getBlockchainStats();
      this.lastProcessedBlock = currentBlock.blockNumber;
      
      SecurityLogger.log('info', 'Tax monitoring system initialized successfully', {
        startingBlock: this.lastProcessedBlock,
        treasuryWallet: this.TREASURY_WALLET,
        taxRate: this.taxConfig?.tax_rate_percent || 5
      });
    } catch (error) {
      SecurityLogger.log('error', 'Failed to initialize tax monitoring system', { error });
      throw error;
    }
  }

  /**
   * Load tax configuration from backend API
   */
  private async loadTaxConfiguration(): Promise<void> {
    try {
      const response = await apiClient.getTaxConfig();
      if (response.success && response.data) {
        this.taxConfig = response.data;
        SecurityLogger.log('info', 'Tax configuration loaded successfully');
      } else {
        SecurityLogger.log('warn', 'Failed to load tax configuration, using defaults');
        // Use default configuration
        this.taxConfig = {
          tax_rate_percent: 5,
          treasury_wallet: this.TREASURY_WALLET,
          enabled: true,
          apply_to_buys: true,
          apply_to_sells: true,
          minimum_tax_amount: 0.001, // 0.001 BNB minimum
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }
    } catch (error) {
      SecurityLogger.log('error', 'Error loading tax configuration', { error });
      throw error;
    }
  }

  /**
   * SECURITY HARDENED: Add wallet with validation
   */
  addWalletToMonitoring(address: string, hasSecureAccess = false, isExcluded = false): void {
    // SECURITY: Validate wallet address
    if (!validateWalletData.address(address)) {
      throw new Error(`Invalid wallet address format: ${address}`);
    }
    
    const wallet: MonitoredWallet = {
      address: address.toLowerCase(),
      isExcluded,
      lastCheckedBlock: this.lastProcessedBlock,
      hasSecureAccess
    };
    
    this.monitoredWallets.set(address.toLowerCase(), wallet);
    SecurityLogger.log('info', 'Added wallet to monitoring', {
      address: address.toLowerCase(),
      isExcluded,
      hasSecureAccess
    });
  }

  /**
   * Remove wallet from monitoring
   */
  removeWalletFromMonitoring(address: string): void {
    this.monitoredWallets.delete(address.toLowerCase());
    SecurityLogger.log('info', 'Removed wallet from monitoring', { address: address.toLowerCase() });
  }

  /**
   * Update wallet exclusion status
   */
  updateWalletExclusion(address: string, isExcluded: boolean): void {
    const wallet = this.monitoredWallets.get(address.toLowerCase());
    if (wallet) {
      wallet.isExcluded = isExcluded;
      SecurityLogger.log('info', 'Updated wallet exclusion status', {
        address: address.toLowerCase(),
        isExcluded
      });
    }
  }

  /**
   * Start monitoring transactions
   */
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      console.warn('Tax monitoring is already active');
      return;
    }

    if (!this.taxConfig || !this.taxConfig.enabled) {
      console.warn('Tax monitoring is disabled in configuration');
      return;
    }

    this.isMonitoring = true;
    SecurityLogger.log('info', 'Starting tax transaction monitoring');
    
    // Start the monitoring loop
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.pollForTransactions();
      } catch (error) {
        SecurityLogger.log('error', 'Error in monitoring loop', { error });
      }
    }, this.POLL_INTERVAL);

    this.emitEvent({
      eventType: 'transaction_detected',
      walletAddress: '',
      transactionHash: '',
      timestamp: new Date().toISOString(),
      data: { message: 'Tax monitoring started' },
    });
  }

  /**
   * Stop monitoring transactions
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      console.warn('Tax monitoring is not active');
      return;
    }

    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    SecurityLogger.log('info', 'Tax transaction monitoring stopped');
  }

  /**
   * Poll for new transactions from monitored wallets
   */
  private async pollForTransactions(): Promise<void> {
    if (!this.taxConfig || !this.taxConfig.enabled) return;

    try {
      // Get current blockchain stats
      const stats = await bscRpcClient.getBlockchainStats();
      const currentBlock = stats.blockNumber;
      
      if (currentBlock <= this.lastProcessedBlock) {
        return; // No new blocks
      }

      const blocksToProcess = Math.min(
        currentBlock - this.lastProcessedBlock,
        this.MAX_BLOCKS_PER_POLL
      );

      SecurityLogger.log('info', 'Processing blocks for tax monitoring', {
        blocksToProcess,
        fromBlock: this.lastProcessedBlock + 1,
        toBlock: currentBlock
      });

      // Check transactions for each monitored wallet
      for (const [address, wallet] of this.monitoredWallets) {
        if (wallet.isExcluded) continue;

        try {
          await this.checkWalletTransactions(wallet, currentBlock);
        } catch (error) {
          SecurityLogger.log('error', 'Error checking wallet transactions', {
            walletAddress: address,
            error
          });
        }
      }

      this.lastProcessedBlock = currentBlock;
    } catch (error) {
      SecurityLogger.log('error', 'Error polling for transactions', { error });
    }
  }

  /**
   * Check transactions for a specific wallet
   */
  private async checkWalletTransactions(wallet: MonitoredWallet, currentBlock: number): Promise<void> {
    if (!bscRpcClient.getCurrentNetwork()) return;

    try {
      // Note: This is a simplified approach. In a production system, you would use:
      // 1. Event logs from DEX contracts (PancakeSwap, etc.)
      // 2. Transaction scanning services
      // 3. WebSocket subscriptions for real-time monitoring
      
      // For now, we'll use a placeholder that would integrate with actual transaction detection
      console.log(`Checking transactions for wallet: ${wallet.address} up to block ${currentBlock}`);
      
      // In a real implementation, you would:
      // 1. Query transaction logs for DEX interactions
      // 2. Parse transaction data to identify buy/sell transactions
      // 3. Calculate tax amounts
      // 4. Queue tax collection jobs
      
      wallet.lastCheckedBlock = currentBlock;
    } catch (error) {
      console.error(`Error checking wallet transactions: ${wallet.address}`, error);
    }
  }

  /**
   * Process a detected transaction and calculate tax
   */
  async processTransaction(event: TransactionEvent): Promise<void> {
    if (!this.taxConfig || !this.taxConfig.enabled) return;

    const wallet = this.monitoredWallets.get(event.from.toLowerCase());
    if (!wallet || wallet.isExcluded) return;

    try {
      console.log(`Processing transaction: ${event.hash} from ${event.from}`);

      // Calculate tax
      const taxCalculation = await this.calculateTax(event);
      
      if (taxCalculation.shouldCollectTax && taxCalculation.taxAmount > 0) {
        // Create tax collection job
        await this.createTaxCollectionJob(event, taxCalculation);
        
        this.emitEvent({
          eventType: 'tax_calculated',
          walletAddress: event.from,
          transactionHash: event.hash,
          timestamp: new Date().toISOString(),
          data: {
            originalAmount: taxCalculation.originalAmount,
            taxAmount: taxCalculation.taxAmount,
            taxRate: taxCalculation.taxRate,
          },
        });
      }
    } catch (error) {
      console.error(`Error processing transaction ${event.hash}:`, error);
    }
  }

  /**
   * Calculate tax amount for a transaction
   */
  private async calculateTax(event: TransactionEvent): Promise<TaxCalculation> {
    if (!this.taxConfig) {
      return {
        originalAmount: 0,
        taxAmount: 0,
        taxRate: 0,
        shouldCollectTax: false,
        reason: 'Tax configuration not loaded',
      };
    }

    const originalAmount = parseFloat(formatEther(event.value));
    
    // Check minimum tax amount threshold
    if (originalAmount < this.taxConfig.minimum_tax_amount) {
      return {
        originalAmount,
        taxAmount: 0,
        taxRate: this.taxConfig.tax_rate_percent,
        shouldCollectTax: false,
        reason: `Transaction amount ${originalAmount} BNB below minimum ${this.taxConfig.minimum_tax_amount} BNB`,
      };
    }

    // Check if tax should apply to this transaction type
    const shouldApply = 
      (event.transactionType === 'buy' && this.taxConfig.apply_to_buys) ||
      (event.transactionType === 'sell' && this.taxConfig.apply_to_sells);

    if (!shouldApply) {
      return {
        originalAmount,
        taxAmount: 0,
        taxRate: this.taxConfig.tax_rate_percent,
        shouldCollectTax: false,
        reason: `Tax not applicable to ${event.transactionType} transactions`,
      };
    }

    // Calculate tax amount
    const taxAmount = (originalAmount * this.taxConfig.tax_rate_percent) / 100;

    return {
      originalAmount,
      taxAmount,
      taxRate: this.taxConfig.tax_rate_percent,
      shouldCollectTax: true,
    };
  }

  /**
   * Create a tax collection job
   */
  private async createTaxCollectionJob(event: TransactionEvent, taxCalculation: TaxCalculation): Promise<void> {
    const job: TaxCollectionJob = {
      id: `tax_${event.hash}_${Date.now()}`,
      walletAddress: event.from,
      originalTxHash: event.hash,
      calculatedTaxAmount: taxCalculation.taxAmount,
      status: 'queued',
      attempts: 0,
      maxAttempts: 3,
      scheduledAt: new Date().toISOString(),
    };

    this.collectionJobs.set(job.id, job);
    console.log(`Created tax collection job: ${job.id} for ${taxCalculation.taxAmount} BNB`);

    // Process the job immediately
    await this.processTaxCollectionJob(job);
  }

  /**
   * Process a tax collection job
   */
  private async processTaxCollectionJob(job: TaxCollectionJob): Promise<void> {
    if (!this.taxConfig) return;

    const wallet = this.monitoredWallets.get(job.walletAddress.toLowerCase());
    if (!wallet || !wallet.hasSecureAccess) {
      job.status = 'failed';
      job.error = 'Wallet private key not available for tax collection';
      console.error(`Tax collection failed for ${job.id}: ${job.error}`);
      return;
    }

    // SECURITY: Retrieve private key securely through session vault
    requireUnlockedSession();
    let privateKey: string;
    try {
      // Note: In production, this would use secure vault access
      // privateKey = await secureVault.getWalletPrivateKey(wallet.address);
      // For now, we'll fail gracefully since private keys aren't stored in MonitoredWallet
      throw new Error('Secure private key access not implemented for tax collection');
    } catch (error) {
      job.status = 'failed';
      job.error = `Failed to retrieve private key securely: ${error instanceof Error ? error.message : 'Unknown error'}`;
      SecurityLogger.log('error', 'Tax collection failed - secure key access failed', {
        jobId: job.id,
        walletAddress: job.walletAddress,
        error
      });
      return;
    }

    try {
      job.status = 'processing';
      job.attempts++;

      console.log(`Processing tax collection job: ${job.id} (attempt ${job.attempts})`);

      // Check wallet balance (wallet is guaranteed to exist due to checks above)
      const balance = await bscRpcClient.getWalletBalance(wallet!.address);
      if (balance.balance < job.calculatedTaxAmount) {
        throw new Error(`Insufficient balance: ${balance.balance} BNB < ${job.calculatedTaxAmount} BNB`);
      }

      // Create tax collection transaction
      const taxTxResult = await bscRpcClient.createAndSendTransaction({
        privateKey: privateKey,
        to: this.taxConfig!.treasury_wallet,
        value: job.calculatedTaxAmount.toString(),
      });

      console.log(`Tax collection transaction sent: ${taxTxResult.hash}`);

      // Wait for confirmation
      const confirmedTx = await bscRpcClient.confirmTransaction(taxTxResult.hash, 1, 60000);

      if (confirmedTx.status === 'success') {
        job.status = 'completed';
        job.processedAt = new Date().toISOString();

        // Record tax transaction in backend
        await this.recordTaxTransaction({
          original_tx_hash: job.originalTxHash,
          tax_tx_hash: confirmedTx.hash,
          wallet_address: job.walletAddress,
          transaction_amount: job.calculatedTaxAmount / (this.taxConfig!.tax_rate_percent / 100), // Reverse calculate
          tax_amount: job.calculatedTaxAmount,
          tax_rate_percent: this.taxConfig!.tax_rate_percent,
          treasury_wallet: this.taxConfig!.treasury_wallet,
          transaction_type: 'sell', // Assuming sell for now
          status: 'confirmed',
          block_number: confirmedTx.blockNumber,
          gas_used: confirmedTx.gasUsed,
        });

        this.emitEvent({
          eventType: 'tax_collected',
          walletAddress: job.walletAddress,
          transactionHash: confirmedTx.hash,
          timestamp: new Date().toISOString(),
          data: {
            originalTxHash: job.originalTxHash,
            taxAmount: job.calculatedTaxAmount,
            treasuryWallet: this.taxConfig!.treasury_wallet,
          },
        });

        console.log(`Tax collection completed: ${job.id}`);
      } else {
        throw new Error(`Tax transaction failed: ${confirmedTx.status}`);
      }
    } catch (error: unknown) {
      console.error(`Tax collection job failed: ${job.id}`, error);
      job.error = error instanceof Error ? error.message : String(error);

      if (job.attempts >= job.maxAttempts) {
        job.status = 'failed';
      } else {
        job.status = 'queued';
        // Retry later (implement retry logic as needed)
        setTimeout(() => this.processTaxCollectionJob(job), 30000); // Retry in 30 seconds
      }
    }
  }

  /**
   * Record tax transaction in backend API
   */
  private async recordTaxTransaction(transaction: RecordTaxTransactionRequest): Promise<void> {
    try {
      const response = await apiClient.recordTaxTransaction(transaction);
      if (response.success) {
        console.log(`Tax transaction recorded: ${transaction.tax_tx_hash}`);
      } else {
        console.error('Failed to record tax transaction:', response.error);
      }
    } catch (error) {
      console.error('Error recording tax transaction:', error);
    }
  }

  /**
   * Check if wallet is excluded from tax
   */
  async checkWalletExclusion(address: string): Promise<boolean> {
    try {
      const response = await apiClient.checkWalletExclusion(address);
      return response.is_excluded || false;
    } catch (error) {
      console.error('Error checking wallet exclusion:', error);
      return false;
    }
  }

  /**
   * Add event listener for monitoring events
   */
  addEventListener(listener: (event: TaxMonitoringEvent) => void): void {
    this.eventListeners.push(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(listener: (event: TaxMonitoringEvent) => void): void {
    const index = this.eventListeners.indexOf(listener);
    if (index > -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  /**
   * Emit monitoring event to all listeners
   */
  private emitEvent(event: TaxMonitoringEvent): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in event listener:', error);
      }
    });
  }

  /**
   * Get current monitoring status
   */
  getStatus(): {
    isMonitoring: boolean;
    monitoredWalletsCount: number;
    lastProcessedBlock: number;
    activeCollectionJobs: number;
    taxConfig: TaxConfiguration | null;
  } {
    return {
      isMonitoring: this.isMonitoring,
      monitoredWalletsCount: this.monitoredWallets.size,
      lastProcessedBlock: this.lastProcessedBlock,
      activeCollectionJobs: Array.from(this.collectionJobs.values()).filter(job => 
        job.status === 'queued' || job.status === 'processing'
      ).length,
      taxConfig: this.taxConfig,
    };
  }

  /**
   * Get all monitored wallets
   */
  getMonitoredWallets(): MonitoredWallet[] {
    return Array.from(this.monitoredWallets.values());
  }

  /**
   * Get collection jobs
   */
  getCollectionJobs(): TaxCollectionJob[] {
    return Array.from(this.collectionJobs.values());
  }

  /**
   * Clean up completed jobs (keep last 100)
   */
  cleanupCompletedJobs(): void {
    const jobs = Array.from(this.collectionJobs.entries());
    const completedJobs = jobs.filter(([_, job]) => job.status === 'completed' || job.status === 'failed');
    
    if (completedJobs.length > 100) {
      // Sort by processed date and keep the most recent 100
      completedJobs.sort(([_, a], [__, b]) => {
        const timeA = a.processedAt ? new Date(a.processedAt).getTime() : 0;
        const timeB = b.processedAt ? new Date(b.processedAt).getTime() : 0;
        return timeB - timeA;
      });

      // Remove older jobs
      const jobsToRemove = completedJobs.slice(100);
      jobsToRemove.forEach(([jobId, _]) => {
        this.collectionJobs.delete(jobId);
      });

      console.log(`Cleaned up ${jobsToRemove.length} old tax collection jobs`);
    }
  }

  /**
   * Destroy the monitoring service
   */
  destroy(): void {
    this.stopMonitoring();
    this.monitoredWallets.clear();
    this.collectionJobs.clear();
    this.eventListeners = [];
    console.log('Tax monitoring service destroyed');
  }
}

// Export singleton instance
export const taxMonitoringService = new TaxMonitoringService();
export default taxMonitoringService;