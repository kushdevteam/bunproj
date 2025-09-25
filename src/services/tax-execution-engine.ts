/**
 * Tax-Enhanced Execution Engine
 * Integrates 5% tax calculation and collection logic into wallet transaction flows
 * Extends existing execution engine with automated tax processing
 */

import { ethers } from 'ethers';
import { useExecutionStore } from '../store/execution';
import { useTransactionStore, type EnhancedTransaction, type TransactionType } from '../store/transactions';
import { useWalletStore } from '../store/wallets';
import { useConfigStore } from '../store/config';
import { apiClient } from '../api/client';
import { decryptPrivateKey, secureRetrieve } from '../utils/crypto';
import { config } from '../config/env';
import { transactionManager } from './transaction-manager';
import { gasManager } from './gas-manager';
import { stealthManager } from './stealth-manager';
import { taxMonitoringService } from './tax-monitoring';
import { bscRpcClient } from './bsc-rpc';
import type { EnhancedBundleConfig } from '../types/bundle-config';
import type { Role, TaxConfiguration, RecordTaxTransactionRequest } from '../types';

export interface TaxEnhancedExecutionPlan {
  id: string;
  config: EnhancedBundleConfig;
  walletIds: string[];
  transactions: Array<{
    walletId: string;
    type: TransactionType;
    amount: string;
    priority: 'low' | 'normal' | 'high' | 'critical';
    delay?: number;
    batchIndex: number;
    // Tax-specific fields
    isTaxTransaction?: boolean;
    originalTransactionId?: string;
    taxAmount?: string;
    taxRate?: number;
    isExcludedFromTax?: boolean;
  }>;
  totalTransactions: number;
  estimatedDuration: number;
  estimatedGasCost: string;
  totalValue: string;
  // Tax-specific plan data
  taxConfig: TaxConfiguration | null;
  totalTaxAmount: string;
  taxTransactionCount: number;
  excludedWallets: string[];
}

export interface TaxExecutionResult {
  success: boolean;
  executionId: string;
  completedTransactions: number;
  failedTransactions: number;
  totalGasUsed: string;
  totalCost: string;
  executionTime: number;
  errors: string[];
  transactionHashes: string[];
  // Tax-specific results
  taxTransactionHashes: string[];
  totalTaxCollected: string;
  taxCollectionFailures: number;
  taxConfigApplied: TaxConfiguration | null;
}

class TaxEnhancedExecutionEngine {
  private isExecuting = false;
  private currentExecutionId: string | null = null;
  private executionAbortController: AbortController | null = null;
  private executionTimeout: NodeJS.Timeout | null = null;
  private provider: ethers.JsonRpcProvider | null = null;
  private signers = new Map<string, ethers.Wallet>();
  private networkValidated = false;
  private taxConfig: TaxConfiguration | null = null;
  private excludedWallets: Set<string> = new Set();

  // Treasury wallet configuration
  private readonly TREASURY_WALLET = '0x91e58Ea55BF914fE15444E34AF11A259f1DE8526';
  private readonly DEFAULT_TAX_RATE = 5; // 5%

  constructor() {
    this.initializeTaxSystem();
  }

  /**
   * Initialize tax system configuration
   */
  private async initializeTaxSystem(): Promise<void> {
    try {
      // Load tax configuration from backend
      const response = await apiClient.getTaxConfig();
      if (response.success && response.data) {
        this.taxConfig = response.data;
        console.log('Tax system initialized with configuration:', this.taxConfig);
      } else {
        // Use default configuration
        this.taxConfig = {
          tax_rate_percent: this.DEFAULT_TAX_RATE,
          treasury_wallet: this.TREASURY_WALLET,
          enabled: true,
          apply_to_buys: true,
          apply_to_sells: true,
          minimum_tax_amount: 0.001, // 0.001 BNB minimum
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        console.log('Tax system initialized with default configuration');
      }

      // Load excluded wallets
      await this.loadExcludedWallets();

      // Initialize tax monitoring service
      await taxMonitoringService.initialize();
      console.log('Tax-enhanced execution engine initialized successfully');
    } catch (error) {
      console.error('Failed to initialize tax system:', error);
    }
  }

  /**
   * Load excluded wallets from backend
   */
  private async loadExcludedWallets(): Promise<void> {
    try {
      const response = await apiClient.getExcludedWallets();
      if (response.success && response.data) {
        this.excludedWallets = new Set(response.data.map(w => w.address.toLowerCase()));
        console.log(`Loaded ${this.excludedWallets.size} excluded wallets for tax system`);
      }
    } catch (error) {
      console.error('Failed to load excluded wallets:', error);
    }
  }

  /**
   * Enhanced validation including tax system checks
   */
  async validateExecution(
    config: EnhancedBundleConfig,
    walletIds: string[],
    passphrase: string
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      // Standard validation logic (same as original)
      if (!config || !config.token?.address) {
        errors.push('Invalid token configuration');
      }

      if (!config.purchaseAmount?.totalBnb || config.purchaseAmount.totalBnb <= 0) {
        errors.push('Invalid purchase amount');
      }

      // Validate wallets
      if (!walletIds || walletIds.length === 0) {
        errors.push('No wallets selected for execution');
      }

      const walletStore = useWalletStore.getState();
      const selectedWallets = walletIds.map(id => walletStore.getWalletById(id)).filter(Boolean);
      
      if (selectedWallets.length !== walletIds.length) {
        errors.push('Some selected wallets not found');
      }

      // Validate passphrase with actual wallet
      if (selectedWallets.length > 0) {
        try {
          const testWallet = selectedWallets[0];
          if (testWallet) {
            const encryptedKey = await secureRetrieve(`wallet_${testWallet.id}_pk`);
            if (encryptedKey) {
              const decryptedKey = await decryptPrivateKey(encryptedKey, passphrase);
              if (!decryptedKey || decryptedKey.length !== 66 || !decryptedKey.startsWith('0x')) {
                errors.push('Invalid passphrase - decryption failed');
              }
            } else {
              errors.push('No encrypted private key found for wallet validation');
            }
          }
        } catch (error) {
          errors.push('Invalid passphrase - unable to decrypt private key');
        }
      }

      // TAX SYSTEM VALIDATION
      if (this.taxConfig?.enabled) {
        // Check if treasury wallet is valid
        if (!this.taxConfig.treasury_wallet || !ethers.isAddress(this.taxConfig.treasury_wallet)) {
          errors.push('Invalid treasury wallet address in tax configuration');
        }

        // Check if tax rate is reasonable
        if (this.taxConfig.tax_rate_percent < 0 || this.taxConfig.tax_rate_percent > 20) {
          errors.push('Tax rate must be between 0% and 20%');
        }

        // Validate sufficient balance for tax collection
        const totalAmount = config.purchaseAmount.totalBnb;
        const estimatedTax = (totalAmount * this.taxConfig.tax_rate_percent) / 100;
        
        if (estimatedTax > totalAmount * 0.5) {
          errors.push(`Tax amount (${estimatedTax.toFixed(4)} BNB) is too high relative to transaction amount`);
        }

        // Check network connectivity for tax operations
        try {
          const networkConnected = await bscRpcClient.isConnected();
          if (!networkConnected) {
            errors.push('BSC network not connected - required for tax collection');
          }
        } catch {
          errors.push('Unable to verify network connection for tax operations');
        }
      }

      // Validate spending limits including tax overhead
      const safetyFeatures = config.executionParams?.safetyFeatures;
      const maxSpend = safetyFeatures?.maxTotalSpend || 5.0;
      let estimatedSpend = config.purchaseAmount.totalBnb * 1.1; // Add buffer
      
      // Add estimated tax to spending calculation
      if (this.taxConfig?.enabled) {
        const estimatedTax = (config.purchaseAmount.totalBnb * this.taxConfig.tax_rate_percent) / 100;
        estimatedSpend += estimatedTax;
      }
      
      if (estimatedSpend > maxSpend) {
        errors.push(`Estimated spend including tax (${estimatedSpend.toFixed(4)} BNB) exceeds safety limit (${maxSpend} BNB)`);
      }

      return { valid: errors.length === 0, errors };
    } catch (error) {
      errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { valid: false, errors };
    }
  }

  /**
   * Create tax-enhanced execution plan
   */
  async createTaxEnhancedExecutionPlan(
    config: EnhancedBundleConfig,
    walletIds: string[]
  ): Promise<TaxEnhancedExecutionPlan> {
    const planId = `tax_plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const walletStore = useWalletStore.getState();
    const wallets = walletIds.map(id => walletStore.getWalletById(id)).filter(Boolean);
    
    const transactions: TaxEnhancedExecutionPlan['transactions'] = [];
    const batchSize = config.executionParams?.batchConfiguration?.batchSize || 5;
    
    // Calculate amounts per wallet based on allocation
    const totalBnb = config.purchaseAmount?.totalBnb || 0;
    const allocation = config.purchaseAmount?.allocation || {};
    
    // Group wallets by role and calculate amounts  
    const validWallets = wallets.filter((wallet): wallet is NonNullable<typeof wallet> => wallet !== null && wallet !== undefined);
    const walletsByRole = validWallets.reduce((acc, wallet) => {
      if (!acc[wallet.role]) acc[wallet.role] = [];
      acc[wallet.role].push(wallet);
      return acc;
    }, {} as Record<Role, typeof validWallets>);

    let totalTaxAmount = 0;
    let taxTransactionCount = 0;
    
    Object.entries(walletsByRole).forEach(([roleKey, roleWallets]) => {
      const role = roleKey as Role;
      const roleAllocation = allocation[role] || 0;
      const roleAmount = (totalBnb * roleAllocation) / 100;
      const amountPerWallet = roleAmount / roleWallets.length;
      
      roleWallets.forEach((wallet, index) => {
        if (!wallet) return;
        
        const isExcluded = this.excludedWallets.has(wallet.address.toLowerCase());
        
        // Create buy transaction for each wallet
        const buyTxId = `buy_${wallet.id}_${index}`;
        transactions.push({
          walletId: wallet.id,
          type: 'buy',
          amount: amountPerWallet.toString(),
          priority: this.getTransactionPriority(role, index),
          delay: this.calculateStaggerDelay(config, index),
          batchIndex: Math.floor(transactions.length / batchSize),
          isExcludedFromTax: isExcluded,
        });

        // Add tax collection transaction for buy if enabled and not excluded
        if (this.taxConfig?.enabled && this.taxConfig.apply_to_buys && !isExcluded && this.taxConfig.tax_rate_percent > 0) {
          const taxAmount = (amountPerWallet * this.taxConfig.tax_rate_percent) / 100;
          
          if (taxAmount >= (this.taxConfig.minimum_tax_amount || 0.001)) {
            transactions.push({
              walletId: wallet.id,
              type: 'transfer', // Tax collection is a transfer to treasury
              amount: taxAmount.toString(),
              priority: 'high', // Tax collection has high priority
              delay: (this.calculateStaggerDelay(config, index) + 5000), // Slight delay after main transaction
              batchIndex: Math.floor(transactions.length / batchSize),
              isTaxTransaction: true,
              originalTransactionId: buyTxId,
              taxAmount: taxAmount.toString(),
              taxRate: this.taxConfig.tax_rate_percent,
            });
            
            totalTaxAmount += taxAmount;
            taxTransactionCount++;
          }
        }
        
        // Add sell transaction if auto-sell is enabled
        if (config.strategy?.sellStrategy !== 'hold') {
          const sellDelay = config.strategy?.sellDelay || 300; // 5 minutes
          const sellAmount = (amountPerWallet * (config.strategy?.sellPercentage || 80)) / 100;
          
          const sellTxId = `sell_${wallet.id}_${index}`;
          transactions.push({
            walletId: wallet.id,
            type: 'sell',
            amount: sellAmount.toString(),
            priority: 'normal',
            delay: sellDelay * 1000, // Convert to milliseconds
            batchIndex: Math.floor(transactions.length / batchSize),
            isExcludedFromTax: isExcluded,
          });

          // Add tax collection for sell transaction
          if (this.taxConfig?.enabled && this.taxConfig.apply_to_sells && !isExcluded && this.taxConfig.tax_rate_percent > 0) {
            const sellTaxAmount = (sellAmount * this.taxConfig.tax_rate_percent) / 100;
            
            if (sellTaxAmount >= (this.taxConfig.minimum_tax_amount || 0.001)) {
              transactions.push({
                walletId: wallet.id,
                type: 'transfer',
                amount: sellTaxAmount.toString(),
                priority: 'high',
                delay: (sellDelay * 1000) + 5000, // After sell transaction
                batchIndex: Math.floor(transactions.length / batchSize),
                isTaxTransaction: true,
                originalTransactionId: sellTxId,
                taxAmount: sellTaxAmount.toString(),
                taxRate: this.taxConfig.tax_rate_percent,
              });
              
              totalTaxAmount += sellTaxAmount;
              taxTransactionCount++;
            }
          }
        }
      });
    });
    
    // Calculate estimates including tax overhead
    const baseGasPrice = config.transactionSettings?.gasConfiguration?.baseGasPrice || '5000000000';
    const gasLimit = config.transactionSettings?.gasConfiguration?.gasLimit || '21000';
    const estimatedGasCost = (BigInt(baseGasPrice) * BigInt(gasLimit) * BigInt(transactions.length)).toString();
    
    const avgDelay = transactions.reduce((sum, tx) => sum + (tx.delay || 0), 0) / transactions.length;
    const estimatedDuration = (transactions.length * avgDelay) + (30000 * Math.ceil(transactions.length / batchSize));
    
    return {
      id: planId,
      config,
      walletIds,
      transactions,
      totalTransactions: transactions.length,
      estimatedDuration,
      estimatedGasCost,
      totalValue: totalBnb.toString(),
      taxConfig: this.taxConfig,
      totalTaxAmount: totalTaxAmount.toString(),
      taxTransactionCount,
      excludedWallets: Array.from(this.excludedWallets),
    };
  }

  /**
   * Execute transaction with integrated tax collection
   */
  async executeTransactionWithTax(
    transaction: TaxEnhancedExecutionPlan['transactions'][0],
    passphrase: string
  ): Promise<{
    success: boolean;
    mainTxHash?: string;
    taxTxHash?: string;
    error?: string;
  }> {
    try {
      const walletStore = useWalletStore.getState();
      const wallet = walletStore.getWalletById(transaction.walletId);
      
      if (!wallet) {
        throw new Error(`Wallet not found: ${transaction.walletId}`);
      }

      // Skip tax collection for excluded wallets
      if (transaction.isExcludedFromTax) {
        console.log(`Wallet ${wallet.address} is excluded from tax collection`);
      }

      // Handle tax collection transaction
      if (transaction.isTaxTransaction) {
        return await this.executeTaxCollection(transaction, wallet, passphrase);
      }

      // Handle regular buy/sell transaction
      const result = await this.executeRegularTransaction(transaction, wallet, passphrase);
      
      // Record transaction for tax monitoring
      if (result.success && result.mainTxHash) {
        await this.recordTransactionForTaxMonitoring(transaction, wallet, result.mainTxHash);
      }

      return result;
    } catch (error) {
      console.error(`Transaction execution failed for ${transaction.type}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Execute tax collection transaction
   */
  private async executeTaxCollection(
    transaction: TaxEnhancedExecutionPlan['transactions'][0],
    wallet: any,
    passphrase: string
  ): Promise<{ success: boolean; taxTxHash?: string; error?: string }> {
    try {
      if (!this.taxConfig) {
        throw new Error('Tax configuration not available');
      }

      // Get decrypted private key
      const encryptedKey = await secureRetrieve(`wallet_${wallet.id}_pk`);
      if (!encryptedKey) {
        throw new Error('Private key not found');
      }

      const privateKey = await decryptPrivateKey(encryptedKey, passphrase);
      
      // Execute tax transfer to treasury
      const taxResult = await bscRpcClient.createAndSendTransaction({
        privateKey,
        to: this.taxConfig.treasury_wallet,
        value: transaction.amount,
      });

      // Wait for confirmation
      const confirmedTax = await bscRpcClient.confirmTransaction(taxResult.hash, 1, 60000);

      if (confirmedTax.status === 'success') {
        // Record tax transaction in backend
        await this.recordTaxTransaction({
          original_tx_hash: transaction.originalTransactionId || '',
          tax_tx_hash: confirmedTax.hash,
          wallet_address: wallet.address,
          transaction_amount: parseFloat(transaction.amount) * 100 / (transaction.taxRate || this.DEFAULT_TAX_RATE), // Reverse calculate original amount
          tax_amount: parseFloat(transaction.amount),
          tax_rate_percent: transaction.taxRate || this.DEFAULT_TAX_RATE,
          treasury_wallet: this.taxConfig.treasury_wallet,
          transaction_type: transaction.originalTransactionId?.includes('buy') ? 'buy' : 'sell',
          status: 'confirmed',
          block_number: confirmedTax.blockNumber,
          gas_used: confirmedTax.gasUsed,
        });

        console.log(`Tax collection successful: ${transaction.amount} BNB collected from ${wallet.address}`);
        return { success: true, taxTxHash: confirmedTax.hash };
      } else {
        throw new Error(`Tax transaction failed: ${confirmedTax.status}`);
      }
    } catch (error) {
      console.error('Tax collection failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Tax collection failed',
      };
    }
  }

  /**
   * Execute regular buy/sell transaction
   */
  private async executeRegularTransaction(
    transaction: TaxEnhancedExecutionPlan['transactions'][0],
    wallet: any,
    passphrase: string
  ): Promise<{ success: boolean; mainTxHash?: string; error?: string }> {
    try {
      // This would integrate with the existing transaction execution logic
      // For now, we'll use a simplified version
      
      const encryptedKey = await secureRetrieve(`wallet_${wallet.id}_pk`);
      if (!encryptedKey) {
        throw new Error('Private key not found');
      }

      const privateKey = await decryptPrivateKey(encryptedKey, passphrase);
      
      // Execute the main transaction (buy/sell)
      // This is a simplified version - in reality, this would integrate with DEX contracts
      const txResult = await bscRpcClient.createAndSendTransaction({
        privateKey,
        to: wallet.address, // Placeholder - would be DEX contract
        value: transaction.amount,
      });

      console.log(`${transaction.type} transaction executed: ${txResult.hash}`);
      return { success: true, mainTxHash: txResult.hash };
    } catch (error) {
      console.error(`${transaction.type} transaction failed:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Transaction failed',
      };
    }
  }

  /**
   * Record transaction for tax monitoring
   */
  private async recordTransactionForTaxMonitoring(
    transaction: TaxEnhancedExecutionPlan['transactions'][0],
    wallet: any,
    txHash: string
  ): Promise<void> {
    try {
      // Add wallet to tax monitoring if not excluded
      if (!transaction.isExcludedFromTax) {
        const encryptedKey = await secureRetrieve(`wallet_${wallet.id}_pk`);
        const privateKey = encryptedKey ? await decryptPrivateKey(encryptedKey, 'temp') : undefined;
        
        taxMonitoringService.addWalletToMonitoring(wallet.address, privateKey);
      }
    } catch (error) {
      console.error('Failed to add wallet to tax monitoring:', error);
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
   * Get transaction priority based on role and index
   */
  private getTransactionPriority(role: Role, index: number): 'low' | 'normal' | 'high' | 'critical' {
    // Funding wallets get high priority
    if (role === 'funder') return 'high';
    
    // MEV wallets get critical priority
    if (role === 'mev') return 'critical';
    
    // First few transactions get higher priority
    if (index < 5) return 'high';
    
    return 'normal';
  }

  /**
   * Calculate stagger delay for transaction timing
   */
  private calculateStaggerDelay(config: EnhancedBundleConfig, index: number): number {
    const timingConfig = (config.executionParams as any)?.timingConfiguration;
    const baseDelay = timingConfig?.staggerDelay || 1000;
    const randomness = timingConfig?.randomness || 0.2;
    
    const randomMultiplier = 1 + (Math.random() - 0.5) * randomness;
    return Math.floor(baseDelay * index * randomMultiplier);
  }

  /**
   * Get current tax configuration
   */
  getTaxConfiguration(): TaxConfiguration | null {
    return this.taxConfig;
  }

  /**
   * Update tax configuration
   */
  async updateTaxConfiguration(updates: Partial<TaxConfiguration>): Promise<void> {
    try {
      const response = await apiClient.updateTaxConfig(updates);
      if (response.success && response.data) {
        this.taxConfig = response.data;
        console.log('Tax configuration updated:', this.taxConfig);
      }
    } catch (error) {
      console.error('Failed to update tax configuration:', error);
      throw error;
    }
  }

  /**
   * Check if wallet is excluded from tax
   */
  isWalletExcluded(address: string): boolean {
    return this.excludedWallets.has(address.toLowerCase());
  }

  /**
   * Add wallet to tax exclusion list
   */
  async addWalletExclusion(address: string, reason?: string): Promise<void> {
    try {
      const response = await apiClient.addExcludedWallet({
        wallet_address: address,
        reason: reason || 'Manual exclusion',
      });
      
      if (response.success) {
        this.excludedWallets.add(address.toLowerCase());
        console.log(`Wallet ${address} added to tax exclusions`);
      }
    } catch (error) {
      console.error('Failed to add wallet exclusion:', error);
      throw error;
    }
  }

  /**
   * Remove wallet from tax exclusion list
   */
  async removeWalletExclusion(address: string): Promise<void> {
    try {
      const response = await apiClient.removeExcludedWallet(address);
      
      if (response.success) {
        this.excludedWallets.delete(address.toLowerCase());
        console.log(`Wallet ${address} removed from tax exclusions`);
      }
    } catch (error) {
      console.error('Failed to remove wallet exclusion:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const taxEnhancedExecutionEngine = new TaxEnhancedExecutionEngine();
export default taxEnhancedExecutionEngine;