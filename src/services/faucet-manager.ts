/**
 * Faucet Manager Service
 * Provides intelligent faucet selection, auto-retry logic, load balancing, and optimization
 */

import { faucetClient, type FaucetRequest, type FaucetResponse, type FaucetConfig } from './faucet-client';
import { useNetworkStore } from '../store/network';

export interface FaucetOperationResult {
  success: boolean;
  results: {
    faucetId: string;
    faucetName: string;
    response: FaucetResponse;
    attemptNumber: number;
    timestamp: Date;
  }[];
  totalAmount: number;
  finalError?: string;
  operationDuration: number;
}

export interface BulkFaucetResult {
  success: boolean;
  successfulWallets: string[];
  failedWallets: { address: string; error: string }[];
  totalAmount: number;
  operationDuration: number;
  faucetBreakdown: {
    faucetId: string;
    successCount: number;
    failureCount: number;
    totalAmount: number;
  }[];
}

export interface FaucetStrategy {
  id: string;
  name: string;
  description: string;
  maxRetries: number;
  retryDelay: number; // seconds between retries
  loadBalancing: boolean;
  prioritizeFastFaucets: boolean;
  respectCooldowns: boolean;
  fallbackToSlowerFaucets: boolean;
}

export const FAUCET_STRATEGIES: FaucetStrategy[] = [
  {
    id: 'fast-and-reliable',
    name: 'Fast & Reliable',
    description: 'Prioritize fast faucets with good success rates',
    maxRetries: 3,
    retryDelay: 5,
    loadBalancing: true,
    prioritizeFastFaucets: true,
    respectCooldowns: true,
    fallbackToSlowerFaucets: true,
  },
  {
    id: 'maximum-attempts',
    name: 'Maximum Attempts',
    description: 'Try all available faucets until success',
    maxRetries: 5,
    retryDelay: 10,
    loadBalancing: true,
    prioritizeFastFaucets: false,
    respectCooldowns: true,
    fallbackToSlowerFaucets: true,
  },
  {
    id: 'conservative',
    name: 'Conservative',
    description: 'Respect all cooldowns and limits strictly',
    maxRetries: 2,
    retryDelay: 30,
    loadBalancing: false,
    prioritizeFastFaucets: true,
    respectCooldowns: true,
    fallbackToSlowerFaucets: false,
  },
  {
    id: 'aggressive',
    name: 'Aggressive',
    description: 'Try to get funds quickly with minimal delays',
    maxRetries: 4,
    retryDelay: 2,
    loadBalancing: true,
    prioritizeFastFaucets: true,
    respectCooldowns: false,
    fallbackToSlowerFaucets: true,
  },
];

class FaucetManager {
  private loadBalancer: Map<string, number> = new Map(); // Track usage per faucet
  private currentStrategy: FaucetStrategy = FAUCET_STRATEGIES[0]; // Default to fast-and-reliable

  /**
   * Set the faucet strategy
   */
  setStrategy(strategyId: string): void {
    const strategy = FAUCET_STRATEGIES.find(s => s.id === strategyId);
    if (!strategy) {
      throw new Error(`Unknown faucet strategy: ${strategyId}`);
    }
    this.currentStrategy = strategy;
    console.log(`Faucet strategy set to: ${strategy.name}`);
  }

  /**
   * Get current strategy
   */
  getCurrentStrategy(): FaucetStrategy {
    return this.currentStrategy;
  }

  /**
   * Get available faucets sorted by current strategy preferences
   */
  private getSortedFaucets(address: string): FaucetConfig[] {
    let faucets = faucetClient.getActiveFaucets();

    // Filter out faucets in cooldown if strategy respects them
    if (this.currentStrategy.respectCooldowns) {
      faucets = faucets.filter(faucet => 
        !faucetClient.isInCooldown(faucet.id, address)
      );
    }

    // Sort based on strategy preferences
    faucets.sort((a, b) => {
      // First, prioritize by success rate if available (would come from monitor)
      
      // Priority sorting (lower number = higher priority)
      if (this.currentStrategy.prioritizeFastFaucets) {
        if (a.priority !== b.priority) {
          return a.priority - b.priority;
        }
      }

      // Load balancing - prefer less used faucets
      if (this.currentStrategy.loadBalancing) {
        const aUsage = this.loadBalancer.get(a.id) || 0;
        const bUsage = this.loadBalancer.get(b.id) || 0;
        if (aUsage !== bUsage) {
          return aUsage - bUsage;
        }
      }

      // Default to priority order
      return a.priority - b.priority;
    });

    return faucets;
  }

  /**
   * Request BNB with intelligent faucet selection and retry logic
   */
  async requestBNB(request: FaucetRequest): Promise<FaucetOperationResult> {
    const startTime = Date.now();
    const results: FaucetOperationResult['results'] = [];
    let totalAmount = 0;
    let lastError = '';

    try {
      // Validate network first
      const networkStore = useNetworkStore.getState();
      if (networkStore.isMainnet() || networkStore.currentNetwork.chainId !== 97) {
        throw new Error('Faucet operations only available on BSC Testnet');
      }

      console.log(`Starting faucet request for ${request.address} with strategy: ${this.currentStrategy.name}`);

      const availableFaucets = this.getSortedFaucets(request.address);
      
      if (availableFaucets.length === 0) {
        throw new Error('No faucets available - all may be in cooldown or disabled');
      }

      let attemptNumber = 0;
      let successfulRequest = false;

      // Try faucets according to strategy
      for (const faucet of availableFaucets) {
        if (successfulRequest && !this.currentStrategy.fallbackToSlowerFaucets) {
          break;
        }

        for (let retry = 0; retry <= this.currentStrategy.maxRetries && !successfulRequest; retry++) {
          attemptNumber++;
          
          console.log(`Attempt ${attemptNumber}: Trying ${faucet.name} (retry ${retry})`);

          try {
            // Add delay between retries (except first attempt)
            if (retry > 0) {
              console.log(`Waiting ${this.currentStrategy.retryDelay}s before retry...`);
              await new Promise(resolve => setTimeout(resolve, this.currentStrategy.retryDelay * 1000));
            }

            const response = await faucetClient.requestFromFaucet(faucet.id, request);
            
            results.push({
              faucetId: faucet.id,
              faucetName: faucet.name,
              response,
              attemptNumber,
              timestamp: new Date(),
            });

            if (response.success) {
              console.log(`✅ Success! Got ${response.amount || 0} BNB from ${faucet.name}`);
              totalAmount += response.amount || 0;
              successfulRequest = true;
              
              // Update load balancer
              this.loadBalancer.set(faucet.id, (this.loadBalancer.get(faucet.id) || 0) + 1);
              
              break; // Exit retry loop for this faucet
            } else {
              console.log(`❌ Failed: ${response.error}`);
              lastError = response.error || 'Unknown error';
              
              // If it's a cooldown error, don't retry this faucet
              if (response.error?.includes('cooldown') || response.cooldownSeconds) {
                console.log(`⏰ Cooldown detected for ${faucet.name}, moving to next faucet`);
                break;
              }
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error(`Error during faucet request to ${faucet.name}:`, error);
            
            results.push({
              faucetId: faucet.id,
              faucetName: faucet.name,
              response: { success: false, error: errorMessage },
              attemptNumber,
              timestamp: new Date(),
            });
            
            lastError = errorMessage;
          }
        }

        if (successfulRequest) {
          break; // Exit faucet loop
        }
      }

      const operationDuration = Date.now() - startTime;

      if (!successfulRequest) {
        console.log(`❌ All faucet attempts failed. Last error: ${lastError}`);
        return {
          success: false,
          results,
          totalAmount: 0,
          finalError: lastError || 'All faucet requests failed',
          operationDuration,
        };
      }

      console.log(`✅ Faucet operation completed successfully in ${operationDuration}ms`);
      return {
        success: true,
        results,
        totalAmount,
        operationDuration,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during faucet operation';
      console.error('Faucet operation failed:', error);
      
      return {
        success: false,
        results,
        totalAmount: 0,
        finalError: errorMessage,
        operationDuration: Date.now() - startTime,
      };
    }
  }

  /**
   * Request BNB for multiple wallets (bulk operation)
   */
  async bulkRequestBNB(
    addresses: string[], 
    amount?: number,
    maxConcurrent: number = 3
  ): Promise<BulkFaucetResult> {
    const startTime = Date.now();
    const successfulWallets: string[] = [];
    const failedWallets: { address: string; error: string }[] = [];
    const faucetBreakdown = new Map<string, { successCount: number; failureCount: number; totalAmount: number }>();
    let totalAmount = 0;

    try {
      console.log(`Starting bulk faucet operation for ${addresses.length} wallets with max ${maxConcurrent} concurrent requests`);

      // Initialize faucet breakdown
      faucetClient.getActiveFaucets().forEach(faucet => {
        faucetBreakdown.set(faucet.id, { successCount: 0, failureCount: 0, totalAmount: 0 });
      });

      // Process wallets in batches to avoid overwhelming faucets
      const batches: string[][] = [];
      for (let i = 0; i < addresses.length; i += maxConcurrent) {
        batches.push(addresses.slice(i, i + maxConcurrent));
      }

      let processedCount = 0;

      for (const batch of batches) {
        console.log(`Processing batch ${batches.indexOf(batch) + 1}/${batches.length} (${batch.length} addresses)`);

        // Process batch concurrently
        const batchPromises = batch.map(async (address) => {
          try {
            const result = await this.requestBNB({
              address,
              amount,
              userAgent: 'BundlerBulkFaucet/1.0',
            });

            if (result.success) {
              successfulWallets.push(address);
              totalAmount += result.totalAmount;

              // Update faucet breakdown
              result.results.forEach(r => {
                if (r.response.success) {
                  const breakdown = faucetBreakdown.get(r.faucetId);
                  if (breakdown) {
                    breakdown.successCount++;
                    breakdown.totalAmount += r.response.amount || 0;
                  }
                }
              });
            } else {
              failedWallets.push({
                address,
                error: result.finalError || 'Unknown error',
              });

              // Update failure count
              result.results.forEach(r => {
                if (!r.response.success) {
                  const breakdown = faucetBreakdown.get(r.faucetId);
                  if (breakdown) {
                    breakdown.failureCount++;
                  }
                }
              });
            }

            processedCount++;
            console.log(`Progress: ${processedCount}/${addresses.length} wallets processed`);

          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            failedWallets.push({ address, error: errorMessage });
            processedCount++;
          }
        });

        await Promise.all(batchPromises);

        // Add delay between batches to be respectful to faucets
        if (batches.indexOf(batch) < batches.length - 1) {
          const batchDelay = Math.max(this.currentStrategy.retryDelay, 5);
          console.log(`Waiting ${batchDelay}s before next batch...`);
          await new Promise(resolve => setTimeout(resolve, batchDelay * 1000));
        }
      }

      const operationDuration = Date.now() - startTime;
      const success = successfulWallets.length > 0;

      console.log(`✅ Bulk operation completed: ${successfulWallets.length}/${addresses.length} successful in ${operationDuration}ms`);

      return {
        success,
        successfulWallets,
        failedWallets,
        totalAmount,
        operationDuration,
        faucetBreakdown: Array.from(faucetBreakdown.entries()).map(([faucetId, stats]) => ({
          faucetId,
          ...stats,
        })),
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during bulk operation';
      console.error('Bulk faucet operation failed:', error);

      return {
        success: false,
        successfulWallets,
        failedWallets: [
          ...failedWallets,
          ...addresses.filter(a => !successfulWallets.includes(a)).map(a => ({ address: a, error: errorMessage }))
        ],
        totalAmount,
        operationDuration: Date.now() - startTime,
        faucetBreakdown: [],
      };
    }
  }

  /**
   * Get optimal amount for faucet request based on wallet needs
   */
  getOptimalAmount(purpose: 'bundling' | 'testing' | 'gas' = 'bundling'): number {
    switch (purpose) {
      case 'bundling':
        return 0.1; // Enough for multiple transactions
      case 'testing':
        return 0.05; // Minimal amount for testing
      case 'gas':
        return 0.02; // Just for gas fees
      default:
        return 0.1;
    }
  }

  /**
   * Check if any faucets are available for an address
   */
  hasAvailableFaucets(address: string): boolean {
    return this.getSortedFaucets(address).length > 0;
  }

  /**
   * Get next available faucet time for an address
   */
  getNextAvailableTime(address: string): Date | null {
    const faucets = faucetClient.getActiveFaucets();
    const nextTimes = faucets
      .map(f => faucetClient.getNextRequestTime(f.id, address))
      .filter((time): time is Date => time !== null)
      .sort((a, b) => a.getTime() - b.getTime());
    
    return nextTimes.length > 0 ? nextTimes[0] : null;
  }

  /**
   * Get faucet usage statistics
   */
  getUsageStats(): {
    faucetId: string;
    name: string;
    requestCount: number;
    successRate: number;
  }[] {
    const faucets = faucetClient.getActiveFaucets();
    
    return faucets.map(faucet => ({
      faucetId: faucet.id,
      name: faucet.name,
      requestCount: this.loadBalancer.get(faucet.id) || 0,
      successRate: 0.85, // TODO: Get from monitor service
    }));
  }

  /**
   * Reset load balancer (for testing or rebalancing)
   */
  resetLoadBalancer(): void {
    this.loadBalancer.clear();
    console.log('Load balancer reset');
  }

  /**
   * Estimate success probability for a request
   */
  estimateSuccessProbability(address: string): number {
    const availableFaucets = this.getSortedFaucets(address);
    if (availableFaucets.length === 0) return 0;

    // Simple estimation based on available faucets and retry strategy
    const baseSuccessRate = 0.75; // Assume 75% base success rate per faucet
    const faucetCount = availableFaucets.length;
    const maxRetries = this.currentStrategy.maxRetries + 1;
    
    // Calculate probability of at least one success
    const failureRate = Math.pow(1 - baseSuccessRate, maxRetries);
    const overallFailureRate = Math.pow(failureRate, faucetCount);
    
    return 1 - overallFailureRate;
  }

  /**
   * Get recommended strategy based on urgency and wallet count
   */
  getRecommendedStrategy(urgency: 'low' | 'medium' | 'high', walletCount: number): string {
    if (urgency === 'high' || walletCount > 20) {
      return 'aggressive';
    } else if (urgency === 'low' || walletCount < 5) {
      return 'conservative';
    } else if (walletCount > 10) {
      return 'maximum-attempts';
    } else {
      return 'fast-and-reliable';
    }
  }
}

// Export singleton instance
export const faucetManager = new FaucetManager();