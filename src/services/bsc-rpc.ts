/**
 * BSC RPC Client Service
 * Handles real blockchain interactions with BSC testnet and mainnet
 * Replaces mock server calls with actual RPC calls
 */

import { JsonRpcProvider, formatEther, parseEther, Wallet, parseUnits } from 'ethers';
import { config } from '../config/env';
import type { NetworkConfig } from '../types';

export interface BlockchainStats {
  blockNumber: number;
  gasPrice: string;
  networkVersion: string;
  isConnected: boolean;
  lastUpdate: Date;
}

export interface WalletBalance {
  address: string;
  balance: number; // in BNB
  formattedBalance: string;
  blockNumber: number;
}

export interface GasPriceInfo {
  slow: string;
  standard: string;
  fast: string;
  estimatedConfirmationTime: {
    slow: number;
    standard: number;
    fast: number;
  };
}

export interface TransactionRequest {
  to: string;
  value?: string;
  data?: string;
  gasLimit?: string;
  gasPrice?: string;
  nonce?: number;
}

export interface TransactionResult {
  hash: string;
  from: string;
  to: string;
  value: string;
  gasUsed?: string;
  gasPrice: string;
  status: 'pending' | 'success' | 'failed';
  blockNumber?: number;
  confirmations: number;
  timestamp?: number;
}

class BSCRPCClient {
  private provider: JsonRpcProvider | null = null;
  private currentNetwork: NetworkConfig;
  private connectionRetries = 0;
  private maxRetries = 3;
  private lastGasPriceUpdate = 0;
  private cachedGasPrice: string | null = null;

  constructor() {
    // Initialize with testnet by default
    this.currentNetwork = config.networks['bsc-testnet'];
    this.initializeProvider();
  }

  /**
   * Initialize the RPC provider for the current network
   */
  private initializeProvider(): void {
    try {
      this.provider = new JsonRpcProvider(this.currentNetwork.rpcUrl, {
        name: this.currentNetwork.displayName,
        chainId: this.currentNetwork.chainId,
      });
      
      // Set up provider event listeners
      this.setupProviderListeners();
      
      console.log(`BSC RPC Client initialized for ${this.currentNetwork.displayName}`);
    } catch (error) {
      console.error('Failed to initialize BSC RPC provider:', error);
      this.handleProviderError(error);
    }
  }

  /**
   * Set up provider event listeners for monitoring
   */
  private setupProviderListeners(): void {
    if (!this.provider) return;

    this.provider.on('error', (error) => {
      console.error('BSC RPC Provider error:', error);
      this.handleProviderError(error);
    });

    this.provider.on('network', (newNetwork, oldNetwork) => {
      if (oldNetwork) {
        console.log(`BSC network changed from ${oldNetwork.chainId} to ${newNetwork.chainId}`);
      }
    });
  }

  /**
   * Handle provider errors with retry logic
   */
  private async handleProviderError(error: any): Promise<void> {
    console.error('BSC RPC error:', error);
    
    if (this.connectionRetries < this.maxRetries) {
      this.connectionRetries++;
      console.log(`Retrying BSC connection (attempt ${this.connectionRetries}/${this.maxRetries})`);
      
      // Try backup RPC URLs if available
      const backupUrls = this.currentNetwork.backupRpcUrls || [];
      if (backupUrls.length > 0 && this.connectionRetries <= backupUrls.length) {
        const backupUrl = backupUrls[this.connectionRetries - 1];
        console.log(`Switching to backup RPC: ${backupUrl}`);
        
        this.provider = new JsonRpcProvider(backupUrl, {
          name: this.currentNetwork.displayName,
          chainId: this.currentNetwork.chainId,
        });
        
        this.setupProviderListeners();
      } else {
        // Wait before retrying with the same URL
        await new Promise(resolve => setTimeout(resolve, config.rpc.retryDelay));
        this.initializeProvider();
      }
    } else {
      console.error('Max retries reached for BSC RPC connection');
      throw new Error(`Failed to connect to BSC network after ${this.maxRetries} attempts`);
    }
  }

  /**
   * Switch to a different network
   */
  async switchNetwork(networkId: string): Promise<void> {
    const networks = config.networks as Record<string, NetworkConfig>;
    if (!networks[networkId]) {
      throw new Error(`Unknown network: ${networkId}`);
    }

    const newNetwork = networks[networkId];
    console.log(`Switching BSC network from ${this.currentNetwork.displayName} to ${newNetwork.displayName}`);

    // Clean up existing provider
    if (this.provider) {
      this.provider.removeAllListeners();
    }

    // Update current network and reinitialize
    this.currentNetwork = newNetwork;
    this.connectionRetries = 0;
    this.cachedGasPrice = null;
    this.lastGasPriceUpdate = 0;
    
    this.initializeProvider();

    // Verify the network switch was successful
    await this.verifyNetworkConnection();
  }

  /**
   * Verify network connection and chain ID
   */
  private async verifyNetworkConnection(): Promise<void> {
    if (!this.provider) {
      throw new Error('No provider available');
    }

    try {
      const network = await this.provider.getNetwork();
      if (Number(network.chainId) !== this.currentNetwork.chainId) {
        throw new Error(
          `Chain ID mismatch: expected ${this.currentNetwork.chainId}, got ${network.chainId}`
        );
      }
      console.log(`Network verification successful: ${this.currentNetwork.displayName} (${network.chainId})`);
    } catch (error) {
      console.error('Network verification failed:', error);
      throw error;
    }
  }

  /**
   * Get current network information
   */
  getCurrentNetwork(): NetworkConfig {
    return this.currentNetwork;
  }

  /**
   * Check if connected to the blockchain
   */
  async isConnected(): Promise<boolean> {
    if (!this.provider) return false;

    try {
      await this.provider.getBlockNumber();
      return true;
    } catch (error) {
      console.error('Connection check failed:', error);
      return false;
    }
  }

  /**
   * Get blockchain statistics
   */
  async getBlockchainStats(): Promise<BlockchainStats> {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    try {
      const [blockNumber, feeData, network] = await Promise.all([
        this.provider.getBlockNumber(),
        this.provider.getFeeData(),
        this.provider.getNetwork(),
      ]);

      return {
        blockNumber,
        gasPrice: feeData.gasPrice?.toString() || '0',
        networkVersion: network.chainId.toString(),
        isConnected: true,
        lastUpdate: new Date(),
      };
    } catch (error) {
      console.error('Failed to get blockchain stats:', error);
      throw error;
    }
  }

  /**
   * Get wallet balance from the blockchain
   */
  async getWalletBalance(address: string): Promise<WalletBalance> {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    try {
      const [balance, blockNumber] = await Promise.all([
        this.provider.getBalance(address),
        this.provider.getBlockNumber(),
      ]);

      const balanceInBNB = parseFloat(formatEther(balance));

      return {
        address,
        balance: balanceInBNB,
        formattedBalance: formatEther(balance),
        blockNumber,
      };
    } catch (error) {
      console.error(`Failed to get balance for ${address}:`, error);
      throw error;
    }
  }

  /**
   * Get multiple wallet balances efficiently
   */
  async getBulkWalletBalances(addresses: string[]): Promise<WalletBalance[]> {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    try {
      console.log(`Fetching balances for ${addresses.length} wallets from ${this.currentNetwork.displayName}`);
      
      // Batch requests with concurrency limit
      const concurrencyLimit = config.rpc.maxConcurrentRequests;
      const results: WalletBalance[] = [];
      
      for (let i = 0; i < addresses.length; i += concurrencyLimit) {
        const batch = addresses.slice(i, i + concurrencyLimit);
        const batchPromises = batch.map(address => this.getWalletBalance(address));
        
        const batchResults = await Promise.allSettled(batchPromises);
        
        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            console.error(`Failed to get balance for ${batch[index]}:`, result.reason);
            // Add zero balance for failed requests
            results.push({
              address: batch[index],
              balance: 0,
              formattedBalance: '0.0',
              blockNumber: 0,
            });
          }
        });
        
        // Add small delay between batches to avoid rate limiting
        if (i + concurrencyLimit < addresses.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      console.log(`Successfully fetched ${results.length} wallet balances`);
      return results;
    } catch (error) {
      console.error('Failed to get bulk wallet balances:', error);
      throw error;
    }
  }

  /**
   * Get current gas price information
   */
  async getGasPriceInfo(): Promise<GasPriceInfo> {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    // Use cached gas price if recent
    const now = Date.now();
    if (this.cachedGasPrice && (now - this.lastGasPriceUpdate) < config.gas.gasPriceRefreshInterval) {
      const gasPrice = this.cachedGasPrice;
      return {
        slow: gasPrice,
        standard: (BigInt(gasPrice) * BigInt(120) / BigInt(100)).toString(), // 20% higher
        fast: (BigInt(gasPrice) * BigInt(150) / BigInt(100)).toString(), // 50% higher
        estimatedConfirmationTime: {
          slow: 60, // 1 minute
          standard: 30, // 30 seconds
          fast: 15, // 15 seconds
        },
      };
    }

    try {
      const feeData = await this.provider.getFeeData();
      const gasPrice = feeData.gasPrice?.toString() || config.gas.defaultGasPrice;
      
      // Update cache
      this.cachedGasPrice = gasPrice;
      this.lastGasPriceUpdate = now;

      return {
        slow: gasPrice,
        standard: (BigInt(gasPrice) * BigInt(120) / BigInt(100)).toString(),
        fast: (BigInt(gasPrice) * BigInt(150) / BigInt(100)).toString(),
        estimatedConfirmationTime: {
          slow: 60,
          standard: 30,
          fast: 15,
        },
      };
    } catch (error) {
      console.error('Failed to get gas price:', error);
      
      // Return default gas prices as fallback
      const defaultGasPrice = config.gas.defaultGasPrice;
      return {
        slow: defaultGasPrice,
        standard: (BigInt(defaultGasPrice) * BigInt(120) / BigInt(100)).toString(),
        fast: (BigInt(defaultGasPrice) * BigInt(150) / BigInt(100)).toString(),
        estimatedConfirmationTime: {
          slow: 60,
          standard: 30,
          fast: 15,
        },
      };
    }
  }

  /**
   * Estimate gas for a transaction
   */
  async estimateGas(transaction: {
    to: string;
    value?: string;
    data?: string;
  }): Promise<string> {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    try {
      const gasEstimate = await this.provider.estimateGas(transaction);
      
      // Add buffer using configured multiplier
      const gasWithBuffer = BigInt(gasEstimate) * BigInt(Math.floor(config.gas.gasLimitMultiplier * 100)) / BigInt(100);
      
      return gasWithBuffer.toString();
    } catch (error) {
      console.error('Failed to estimate gas:', error);
      return config.gas.defaultGasLimit.toString();
    }
  }

  /**
   * Get transaction by hash
   */
  async getTransaction(hash: string) {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    try {
      return await this.provider.getTransaction(hash);
    } catch (error) {
      console.error(`Failed to get transaction ${hash}:`, error);
      throw error;
    }
  }

  /**
   * Get transaction receipt
   */
  async getTransactionReceipt(hash: string) {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    try {
      return await this.provider.getTransactionReceipt(hash);
    } catch (error) {
      console.error(`Failed to get transaction receipt ${hash}:`, error);
      throw error;
    }
  }

  /**
   * Monitor transaction status
   */
  async waitForTransaction(hash: string, confirmations = 1, timeout = 60000) {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    try {
      return await this.provider.waitForTransaction(hash, confirmations, timeout);
    } catch (error) {
      console.error(`Failed to wait for transaction ${hash}:`, error);
      throw error;
    }
  }

  /**
   * Send a signed transaction to the network
   */
  async sendTransaction(signedTx: string): Promise<TransactionResult> {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    // CRITICAL SECURITY: Enforce testnet-only execution
    if (this.currentNetwork.chainId !== 97) {
      throw new Error(`SAFETY: Transaction broadcast blocked. Only BSC Testnet (chainId: 97) is allowed, but connected to chainId ${this.currentNetwork.chainId}`);
    }

    try {
      console.log('Broadcasting transaction to', this.currentNetwork.displayName);
      const txResponse = await this.provider.broadcastTransaction(signedTx);
      
      return {
        hash: txResponse.hash,
        from: txResponse.from || '',
        to: txResponse.to || '',
        value: txResponse.value.toString(),
        gasPrice: txResponse.gasPrice?.toString() || '0',
        status: 'pending',
        confirmations: 0,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('Failed to broadcast transaction:', error);
      throw error;
    }
  }

  /**
   * Create and send a transaction (requires private key)
   */
  async createAndSendTransaction({
    privateKey,
    to,
    value,
    data,
    gasLimit,
    gasPrice,
  }: {
    privateKey: string;
    to: string;
    value?: string;
    data?: string;
    gasLimit?: string;
    gasPrice?: string;
  }): Promise<TransactionResult> {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    // CRITICAL SECURITY: Enforce testnet-only execution
    if (this.currentNetwork.chainId !== 97) {
      throw new Error(`SAFETY: Transaction creation blocked. Only BSC Testnet (chainId: 97) is allowed, but connected to chainId ${this.currentNetwork.chainId}`);
    }

    try {
      // Create wallet instance
      const wallet = new Wallet(privateKey, this.provider);
      
      // Get current nonce
      const nonce = await this.provider.getTransactionCount(wallet.address, 'pending');
      
      // Use provided gas price or fetch current
      let finalGasPrice = gasPrice;
      if (!finalGasPrice) {
        const gasPriceInfo = await this.getGasPriceInfo();
        finalGasPrice = gasPriceInfo.standard;
      }
      
      // Prepare transaction
      const txRequest = {
        to,
        value: value ? parseEther(value) : 0,
        data: data || '0x',
        gasLimit: gasLimit ? parseInt(gasLimit) : 21000,
        gasPrice: parseUnits(finalGasPrice, 'gwei'),
        nonce,
        chainId: this.currentNetwork.chainId,
      };
      
      // Estimate gas if not provided
      if (!gasLimit) {
        try {
          const estimatedGas = await wallet.estimateGas(txRequest);
          txRequest.gasLimit = Number(estimatedGas) * 1.2; // Add 20% buffer
        } catch (gasError) {
          console.warn('Gas estimation failed, using default:', gasError);
        }
      }
      
      console.log('Sending transaction:', {
        from: wallet.address,
        to: txRequest.to,
        value: formatEther(txRequest.value),
        gasLimit: txRequest.gasLimit,
        gasPrice: formatEther(txRequest.gasPrice * BigInt(1000000000)),
        nonce: txRequest.nonce,
        network: this.currentNetwork.displayName,
      });
      
      // Send transaction
      const txResponse = await wallet.sendTransaction(txRequest);
      
      console.log(`Transaction sent: ${txResponse.hash}`);
      console.log(`View on BSCScan: ${this.currentNetwork.blockExplorerUrl}/tx/${txResponse.hash}`);
      
      return {
        hash: txResponse.hash,
        from: txResponse.from,
        to: txResponse.to || '',
        value: txResponse.value.toString(),
        gasPrice: txResponse.gasPrice?.toString() || '0',
        gasUsed: txResponse.gasLimit?.toString(),
        status: 'pending',
        confirmations: 0,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('Failed to create and send transaction:', error);
      throw error;
    }
  }

  /**
   * Wait for transaction confirmation and return final result with enhanced verification
   */
  async confirmTransaction(hash: string, requiredConfirmations = 1, timeoutMs = 120000): Promise<TransactionResult> {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    // CRITICAL SECURITY: Enforce testnet-only execution
    if (this.currentNetwork.chainId !== 97) {
      throw new Error(`SAFETY: Transaction confirmation blocked. Only BSC Testnet (chainId: 97) is allowed, but connected to chainId ${this.currentNetwork.chainId}`);
    }

    try {
      console.log(`Waiting for transaction confirmation: ${hash}`);
      console.log(`Required confirmations: ${requiredConfirmations}, Timeout: ${timeoutMs}ms`);
      
      // Use enhanced receipt verification with timeout
      const receipt = await this.waitForTransactionWithEnhancedVerification(hash, requiredConfirmations, timeoutMs);
      
      if (!receipt) {
        throw new Error('Transaction receipt not available after waiting');
      }
      
      // Get the original transaction details
      const transaction = await this.getTransaction(hash);
      if (!transaction) {
        throw new Error('Transaction not found on blockchain');
      }
      
      // Additional verification: Double-check receipt matches transaction
      if (receipt.hash.toLowerCase() !== hash.toLowerCase()) {
        throw new Error(`Receipt hash mismatch: expected ${hash}, got ${receipt.hash}`);
      }
      
      // Get actual confirmation count
      const currentBlock = await this.provider.getBlockNumber();
      const actualConfirmations = Math.max(0, currentBlock - receipt.blockNumber + 1);
      
      const result: TransactionResult = {
        hash: receipt.hash,
        from: transaction.from,
        to: transaction.to || '',
        value: transaction.value.toString(),
        gasUsed: receipt.gasUsed?.toString(),
        gasPrice: transaction.gasPrice?.toString() || '0',
        status: receipt.status === 1 ? 'success' : 'failed',
        blockNumber: receipt.blockNumber,
        confirmations: actualConfirmations,
        timestamp: Date.now(),
      };
      
      console.log(`Transaction confirmed with enhanced verification:`, {
        hash: result.hash,
        status: result.status,
        gasUsed: result.gasUsed,
        blockNumber: result.blockNumber,
        actualConfirmations: actualConfirmations,
        requiredConfirmations: requiredConfirmations,
        bscScanLink: `${this.currentNetwork.blockExplorerUrl}/tx/${result.hash}`,
      });
      
      // Verify we have sufficient confirmations
      if (actualConfirmations < requiredConfirmations) {
        console.warn(`Transaction has ${actualConfirmations} confirmations, but ${requiredConfirmations} required`);
      }
      
      return result;
    } catch (error) {
      console.error(`Failed to confirm transaction ${hash}:`, error);
      throw error;
    }
  }

  /**
   * Enhanced transaction waiting with better verification and timeout handling
   */
  private async waitForTransactionWithEnhancedVerification(
    hash: string, 
    requiredConfirmations: number, 
    timeoutMs: number
  ) {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    const startTime = Date.now();
    
    // First, try the built-in waitForTransaction with timeout
    try {
      const receipt = await this.provider.waitForTransaction(hash, requiredConfirmations, timeoutMs);
      if (receipt) {
        // Additional verification: Check if receipt is actually valid
        const directReceipt = await this.provider.getTransactionReceipt(hash);
        if (!directReceipt) {
          throw new Error('Receipt verification failed: could not retrieve receipt directly');
        }
        return receipt;
      }
    } catch (error) {
      console.warn(`Standard waitForTransaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    // Fallback: Manual polling with enhanced checks
    console.log(`Falling back to manual transaction polling for ${hash}`);
    
    while (Date.now() - startTime < timeoutMs) {
      try {
        const receipt = await this.provider.getTransactionReceipt(hash);
        if (receipt) {
          const currentBlock = await this.provider.getBlockNumber();
          const confirmations = currentBlock - receipt.blockNumber + 1;
          
          console.log(`Transaction ${hash}: block ${receipt.blockNumber}, current block ${currentBlock}, confirmations: ${confirmations}`);
          
          if (confirmations >= requiredConfirmations) {
            return receipt;
          }
        }
      } catch (error) {
        console.warn(`Receipt check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      
      // Wait before next check
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    throw new Error(`Transaction confirmation timeout after ${timeoutMs}ms`);
  }

  /**
   * Clean up provider resources
   */
  destroy(): void {
    if (this.provider) {
      this.provider.removeAllListeners();
      this.provider = null;
    }
    this.cachedGasPrice = null;
    this.lastGasPriceUpdate = 0;
    console.log('BSC RPC Client destroyed');
  }
}

// Create singleton instance
export const bscRpcClient = new BSCRPCClient();

// Export for testing and advanced usage
export { BSCRPCClient };
export default bscRpcClient;