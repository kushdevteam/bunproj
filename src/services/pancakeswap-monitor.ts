/**
 * PancakeSwap Transaction Monitor
 * Monitors PancakeSwap DEX for buy/sell transactions from tracked wallets
 * Integrates with tax monitoring service for automatic tax collection
 */

import { ethers, Contract, formatEther } from 'ethers';
import { bscRpcClient } from './bsc-rpc';
import { taxMonitoringService } from './tax-monitoring';
import type { TransactionEvent } from './tax-monitoring';

// PancakeSwap V2 Router Contract Address on BSC
const PANCAKESWAP_V2_ROUTER = '0x10ED43C718714eb63d5aA57B78B54704E256024E';
const PANCAKESWAP_V2_FACTORY = '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73';

// WBNB Contract Address on BSC
const WBNB_ADDRESS = '0xbb4CdB9CBd36B01bD1cBaAA1d4e5DB0B5a2f8f5e';

// PancakeSwap Router ABI (partial - only the functions we need)
const PANCAKESWAP_ROUTER_ABI = [
  // Swap functions
  'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)',
  'function swapTokensForExactETH(uint amountOut, uint amountInMax, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  'function swapTokensForExactTokens(uint amountOut, uint amountInMax, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  
  // Events
  'event SwapETHForTokens(address indexed to, uint amountIn, uint[] amountOut)',
  'event SwapTokensForETH(address indexed to, uint amountIn, uint[] amountOut)',
];

// Standard ERC20 Transfer Event
const ERC20_TRANSFER_EVENT_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

export interface DEXTransaction {
  hash: string;
  from: string;
  to: string;
  tokenAddress?: string;
  tokenAmount?: string;
  bnbAmount: string;
  type: 'buy' | 'sell';
  blockNumber: number;
  timestamp: number;
  gasUsed?: string;
  gasPrice?: string;
}

class PancakeSwapMonitor {
  private provider: ethers.JsonRpcProvider | null = null;
  private routerContract: Contract | null = null;
  private isMonitoring = false;
  private monitoredTokens: Set<string> = new Set();
  private lastProcessedBlock = 0;
  private readonly POLL_INTERVAL = 10000; // 10 seconds
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor() {
    console.log('PancakeSwap Monitor initialized');
    this.initializeProvider();
  }

  /**
   * Initialize ethers provider and contracts
   */
  private initializeProvider(): void {
    try {
      const currentNetwork = bscRpcClient.getCurrentNetwork();
      this.provider = new ethers.JsonRpcProvider(currentNetwork.rpcUrl, {
        name: currentNetwork.displayName,
        chainId: currentNetwork.chainId,
      });

      this.routerContract = new Contract(PANCAKESWAP_V2_ROUTER, PANCAKESWAP_ROUTER_ABI, this.provider);
      
      console.log(`PancakeSwap Monitor connected to ${currentNetwork.displayName}`);
    } catch (error) {
      console.error('Failed to initialize PancakeSwap monitor provider:', error);
    }
  }

  /**
   * Add token address to monitor for DEX transactions
   */
  addTokenToMonitor(tokenAddress: string): void {
    this.monitoredTokens.add(tokenAddress.toLowerCase());
    console.log(`Added token to PancakeSwap monitoring: ${tokenAddress}`);
  }

  /**
   * Remove token from monitoring
   */
  removeTokenFromMonitor(tokenAddress: string): void {
    this.monitoredTokens.delete(tokenAddress.toLowerCase());
    console.log(`Removed token from PancakeSwap monitoring: ${tokenAddress}`);
  }

  /**
   * Start monitoring PancakeSwap transactions
   */
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      console.warn('PancakeSwap monitoring is already active');
      return;
    }

    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    // Get current block as starting point
    const currentBlock = await this.provider.getBlockNumber();
    this.lastProcessedBlock = currentBlock;

    this.isMonitoring = true;
    console.log('Starting PancakeSwap transaction monitoring...');
    console.log(`Starting from block: ${this.lastProcessedBlock}`);

    // Start monitoring interval
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.pollForDEXTransactions();
      } catch (error) {
        console.error('Error in PancakeSwap monitoring loop:', error);
      }
    }, this.POLL_INTERVAL);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      console.warn('PancakeSwap monitoring is not active');
      return;
    }

    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    console.log('PancakeSwap transaction monitoring stopped');
  }

  /**
   * Poll for new DEX transactions
   */
  private async pollForDEXTransactions(): Promise<void> {
    if (!this.provider) return;

    try {
      const currentBlock = await this.provider.getBlockNumber();
      
      if (currentBlock <= this.lastProcessedBlock) {
        return; // No new blocks
      }

      // Process blocks in batches to avoid overwhelming the RPC
      const maxBlocksPerBatch = 50;
      const blocksToProcess = Math.min(currentBlock - this.lastProcessedBlock, maxBlocksPerBatch);

      console.log(`Processing PancakeSwap transactions in blocks ${this.lastProcessedBlock + 1} to ${this.lastProcessedBlock + blocksToProcess}`);

      // Get logs for PancakeSwap Router transactions
      const filter = {
        address: PANCAKESWAP_V2_ROUTER,
        fromBlock: this.lastProcessedBlock + 1,
        toBlock: this.lastProcessedBlock + blocksToProcess,
        topics: [
          // Any PancakeSwap transaction
          null
        ]
      };

      const logs = await this.provider.getLogs(filter);
      console.log(`Found ${logs.length} PancakeSwap logs to process`);

      for (const log of logs) {
        try {
          await this.processPancakeSwapLog(log);
        } catch (error) {
          console.error(`Error processing PancakeSwap log ${log.transactionHash}:`, error);
        }
      }

      this.lastProcessedBlock += blocksToProcess;
    } catch (error) {
      console.error('Error polling for DEX transactions:', error);
    }
  }

  /**
   * Process a PancakeSwap transaction log
   */
  private async processPancakeSwapLog(log: any): Promise<void> {
    if (!this.provider) return;

    try {
      // Get the full transaction details
      const txReceipt = await this.provider.getTransactionReceipt(log.transactionHash);
      const transaction = await this.provider.getTransaction(log.transactionHash);
      
      if (!txReceipt || !transaction) {
        console.warn(`Could not fetch transaction details for ${log.transactionHash}`);
        return;
      }

      // Check if transaction is from a monitored wallet
      const fromAddress = transaction.from.toLowerCase();
      const monitoredWallets = taxMonitoringService.getMonitoredWallets();
      const isMonitoredWallet = monitoredWallets.some(w => w.address.toLowerCase() === fromAddress);

      if (!isMonitoredWallet) {
        return; // Not from a monitored wallet
      }

      console.log(`Processing PancakeSwap transaction from monitored wallet: ${transaction.from}`);

      // Parse transaction to determine if it's a buy or sell
      const dexTransaction = await this.parseDEXTransaction(transaction, txReceipt);
      
      if (dexTransaction) {
        console.log(`Detected ${dexTransaction.type} transaction:`, {
          hash: dexTransaction.hash,
          from: dexTransaction.from,
          bnbAmount: dexTransaction.bnbAmount,
          tokenAddress: dexTransaction.tokenAddress,
          tokenAmount: dexTransaction.tokenAmount,
        });

        // Convert to TransactionEvent for tax monitoring
        const taxEvent: TransactionEvent = {
          hash: dexTransaction.hash,
          from: dexTransaction.from,
          to: dexTransaction.to,
          value: ethers.parseEther(dexTransaction.bnbAmount).toString(),
          blockNumber: dexTransaction.blockNumber,
          timestamp: dexTransaction.timestamp,
          transactionType: dexTransaction.type,
          isMonitoredWallet: true,
        };

        // Send to tax monitoring service
        await taxMonitoringService.processTransaction(taxEvent);
      }
    } catch (error) {
      console.error(`Error processing PancakeSwap log for transaction ${log.transactionHash}:`, error);
    }
  }

  /**
   * Parse a transaction to extract DEX transaction details
   */
  private async parseDEXTransaction(transaction: any, receipt: any): Promise<DEXTransaction | null> {
    if (!this.provider) return null;

    try {
      // Get transaction timestamp
      const block = await this.provider.getBlock(transaction.blockNumber);
      const timestamp = block ? block.timestamp * 1000 : Date.now();

      // Analyze transaction data to determine type
      const inputData = transaction.data;
      const value = formatEther(transaction.value || '0');
      const bnbValue = parseFloat(value);

      let transactionType: 'buy' | 'sell' = 'buy';
      let bnbAmount = value;
      let tokenAddress = '';
      let tokenAmount = '';

      // Decode function call to determine transaction type
      if (inputData && this.routerContract) {
        try {
          // Try to decode the function call
          const decoded = this.routerContract.interface.parseTransaction({ data: inputData, value: transaction.value });
          
          if (decoded) {
            const functionName = decoded.name;
            console.log(`PancakeSwap function: ${functionName}`);

            // Determine transaction type based on function
            if (functionName.includes('swapETHForTokens') || functionName.includes('swapExactETHForTokens')) {
              transactionType = 'buy';
              bnbAmount = value; // BNB spent to buy tokens
              
              // Extract token address from path
              if (decoded.args.path && decoded.args.path.length > 1) {
                tokenAddress = decoded.args.path[decoded.args.path.length - 1];
              }
            } else if (functionName.includes('swapTokensForETH') || functionName.includes('swapExactTokensForETH')) {
              transactionType = 'sell';
              
              // For sell transactions, we need to look at the logs to get the BNB amount received
              const transferLogs = receipt.logs.filter((log: any) => 
                log.topics[0] === ERC20_TRANSFER_EVENT_TOPIC
              );

              // Find WBNB transfer to get BNB amount
              const wbnbTransfer = transferLogs.find((log: any) => 
                log.address.toLowerCase() === WBNB_ADDRESS.toLowerCase()
              );

              if (wbnbTransfer) {
                // Decode the transfer amount
                const transferAmount = ethers.AbiCoder.defaultAbiCoder().decode(['uint256'], wbnbTransfer.data);
                bnbAmount = formatEther(transferAmount[0]);
              }

              // Extract token address from path
              if (decoded.args.path && decoded.args.path.length > 0) {
                tokenAddress = decoded.args.path[0];
              }
            }
          }
        } catch (decodeError) {
          console.warn(`Could not decode PancakeSwap transaction ${transaction.hash}:`, decodeError);
        }
      }

      // Only process if we have a meaningful BNB amount
      if (bnbValue < 0.001) {
        return null; // Ignore very small transactions
      }

      return {
        hash: transaction.hash,
        from: transaction.from,
        to: transaction.to || PANCAKESWAP_V2_ROUTER,
        tokenAddress,
        tokenAmount,
        bnbAmount,
        type: transactionType,
        blockNumber: transaction.blockNumber,
        timestamp,
        gasUsed: receipt.gasUsed?.toString(),
        gasPrice: transaction.gasPrice?.toString(),
      };
    } catch (error) {
      console.error('Error parsing DEX transaction:', error);
      return null;
    }
  }

  /**
   * Get monitoring status
   */
  getStatus(): {
    isMonitoring: boolean;
    lastProcessedBlock: number;
    monitoredTokensCount: number;
  } {
    return {
      isMonitoring: this.isMonitoring,
      lastProcessedBlock: this.lastProcessedBlock,
      monitoredTokensCount: this.monitoredTokens.size,
    };
  }

  /**
   * Get monitored tokens
   */
  getMonitoredTokens(): string[] {
    return Array.from(this.monitoredTokens);
  }

  /**
   * Destroy the monitor
   */
  destroy(): void {
    this.stopMonitoring();
    this.monitoredTokens.clear();
    console.log('PancakeSwap monitor destroyed');
  }
}

// Export singleton instance
export const pancakeSwapMonitor = new PancakeSwapMonitor();
export default pancakeSwapMonitor;