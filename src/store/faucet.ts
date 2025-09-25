/**
 * Faucet Store using Zustand
 * Central state management for faucet operations, cooldowns, and monitoring
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { faucetClient, type FaucetResponse, type FaucetConfig } from '../services/faucet-client';
import { faucetManager, type FaucetOperationResult, type BulkFaucetResult, type FaucetStrategy } from '../services/faucet-manager';
import { faucetMonitor, type FaucetMetrics, type PerformanceAlert } from '../services/faucet-monitor';
import { useWalletStore } from './wallets';
import { useNetworkStore } from './network';

export interface FaucetRequestStatus {
  id: string;
  address: string;
  faucetId: string;
  status: 'pending' | 'success' | 'failed' | 'cooldown';
  startTime: Date;
  endTime?: Date;
  amount?: number;
  txHash?: string;
  error?: string;
  cooldownUntil?: Date;
}

export interface BulkOperationStatus {
  id: string;
  addresses: string[];
  status: 'pending' | 'running' | 'completed' | 'cancelled';
  startTime: Date;
  endTime?: Date;
  progress: {
    total: number;
    completed: number;
    successful: number;
    failed: number;
  };
  results?: BulkFaucetResult;
}

export interface FaucetStore {
  // Core state
  isEnabled: boolean;
  currentStrategy: string;
  isRequestInProgress: boolean;
  isBulkOperationInProgress: boolean;
  
  // Request tracking
  recentRequests: FaucetRequestStatus[];
  bulkOperations: BulkOperationStatus[];
  requestHistory: Map<string, Date[]>; // address -> request timestamps
  
  // Faucet status
  faucetConfigs: FaucetConfig[];
  faucetMetrics: FaucetMetrics[];
  performanceAlerts: PerformanceAlert[];
  
  // UI state
  selectedFaucets: string[];
  showAdvancedOptions: boolean;
  showMetrics: boolean;
  lastUpdateTime?: Date;
  
  // Error handling
  error?: string;
  warnings: string[];
  
  // Actions - Core operations
  requestBNB: (address: string, faucetId?: string, amount?: number) => Promise<FaucetOperationResult>;
  bulkRequestBNB: (addresses: string[], amount?: number, maxConcurrent?: number) => Promise<BulkFaucetResult>;
  cancelBulkOperation: (operationId: string) => void;
  
  // Actions - Configuration
  setStrategy: (strategyId: string) => void;
  toggleFaucetSelection: (faucetId: string) => void;
  setSelectedFaucets: (faucetIds: string[]) => void;
  resetConfiguration: () => void;
  
  // Actions - Data management
  refreshFaucetData: () => void;
  clearRequestHistory: () => void;
  clearError: () => void;
  dismissWarning: (index: number) => void;
  acknowledgeAlert: (alertId: string) => void;
  
  // Actions - Status checks
  canRequestFromFaucet: (address: string, faucetId: string) => boolean;
  getCooldownInfo: (address: string, faucetId: string) => { isInCooldown: boolean; remainingSeconds: number; nextAvailable?: Date };
  hasAvailableFaucets: (address: string) => boolean;
  getOptimalFaucetOrder: () => { faucetId: string; name: string; score: number; reason: string }[];
  
  // Actions - Utilities
  exportMetrics: () => string;
  getRequestStats: (address: string) => any[];
  estimateSuccessProbability: (address: string) => number;
}

const initialState = {
  isEnabled: false,
  currentStrategy: 'fast-and-reliable',
  isRequestInProgress: false,
  isBulkOperationInProgress: false,
  recentRequests: [],
  bulkOperations: [],
  requestHistory: new Map(),
  faucetConfigs: [],
  faucetMetrics: [],
  performanceAlerts: [],
  selectedFaucets: [],
  showAdvancedOptions: false,
  showMetrics: false,
  warnings: [],
};

export const useFaucetStore = create<FaucetStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      // Request BNB for a single wallet
      requestBNB: async (address: string, faucetId?: string, amount?: number): Promise<FaucetOperationResult> => {
        try {
          set({ isRequestInProgress: true, error: undefined });
          
          // Validate network
          const networkStore = useNetworkStore.getState();
          if (networkStore.isMainnet() || networkStore.currentNetwork.chainId !== 97) {
            throw new Error('Faucet operations only available on BSC Testnet');
          }

          // Validate address format
          if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
            throw new Error('Invalid wallet address format');
          }

          const startTime = new Date();
          const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2)}`;

          // Create request status
          const requestStatus: FaucetRequestStatus = {
            id: requestId,
            address,
            faucetId: faucetId || 'auto',
            status: 'pending',
            startTime,
          };

          set(state => ({
            recentRequests: [requestStatus, ...state.recentRequests.slice(0, 49)],
          }));

          let result: FaucetOperationResult;

          if (faucetId) {
            // Request from specific faucet
            const response = await faucetClient.requestFromFaucet(faucetId, { address, amount });
            result = {
              success: response.success,
              results: [{
                faucetId,
                faucetName: faucetClient.getFaucetConfig(faucetId)?.name || 'Unknown',
                response,
                attemptNumber: 1,
                timestamp: new Date(),
              }],
              totalAmount: response.amount || 0,
              finalError: response.error,
              operationDuration: Date.now() - startTime.getTime(),
            };
          } else {
            // Use manager for intelligent selection
            result = await faucetManager.requestBNB({ address, amount });
          }

          // Update request status
          const updatedStatus: FaucetRequestStatus = {
            ...requestStatus,
            status: result.success ? 'success' : 'failed',
            endTime: new Date(),
            amount: result.totalAmount,
            txHash: result.results.find(r => r.response.txHash)?.response.txHash,
            error: result.finalError,
            cooldownUntil: result.results.find(r => r.response.nextRequestTime)?.response.nextRequestTime,
          };

          // Log to monitor
          result.results.forEach(r => {
            faucetMonitor.logRequest(
              r.faucetId,
              address,
              r.response.success,
              Date.now() - r.timestamp.getTime(),
              r.response.amount,
              r.response.error
            );
          });

          // Update balance in wallet store if successful
          if (result.success && result.totalAmount > 0) {
            const walletStore = useWalletStore.getState();
            const wallet = walletStore.wallets.find(w => w.address === address);
            if (wallet) {
              walletStore.updateWalletBalance(address, wallet.balance + result.totalAmount);
            }
          }

          set(state => ({
            recentRequests: state.recentRequests.map(r => 
              r.id === requestId ? updatedStatus : r
            ),
            isRequestInProgress: false,
            lastUpdateTime: new Date(),
          }));

          // Refresh faucet data
          get().refreshFaucetData();

          return result;

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error during faucet request';
          console.error('Faucet request failed:', error);
          
          set({ 
            error: errorMessage, 
            isRequestInProgress: false,
            lastUpdateTime: new Date(),
          });

          return {
            success: false,
            results: [],
            totalAmount: 0,
            finalError: errorMessage,
            operationDuration: 0,
          };
        }
      },

      // Bulk request BNB for multiple wallets
      bulkRequestBNB: async (addresses: string[], amount?: number, maxConcurrent: number = 3): Promise<BulkFaucetResult> => {
        try {
          set({ isBulkOperationInProgress: true, error: undefined });
          
          // Validate network
          const networkStore = useNetworkStore.getState();
          if (networkStore.isMainnet() || networkStore.currentNetwork.chainId !== 97) {
            throw new Error('Bulk faucet operations only available on BSC Testnet');
          }

          if (addresses.length === 0) {
            throw new Error('No addresses provided for bulk operation');
          }

          const operationId = `bulk_${Date.now()}_${Math.random().toString(36).substring(2)}`;
          const startTime = new Date();

          // Create bulk operation status
          const operationStatus: BulkOperationStatus = {
            id: operationId,
            addresses,
            status: 'running',
            startTime,
            progress: {
              total: addresses.length,
              completed: 0,
              successful: 0,
              failed: 0,
            },
          };

          set(state => ({
            bulkOperations: [operationStatus, ...state.bulkOperations.slice(0, 9)],
          }));

          // Execute bulk operation with progress tracking
          const result = await faucetManager.bulkRequestBNB(addresses, amount, maxConcurrent);

          // Update operation status
          const finalStatus: BulkOperationStatus = {
            ...operationStatus,
            status: 'completed',
            endTime: new Date(),
            progress: {
              total: addresses.length,
              completed: addresses.length,
              successful: result.successfulWallets.length,
              failed: result.failedWallets.length,
            },
            results: result,
          };

          // Update wallet balances for successful requests
          if (result.success && result.successfulWallets.length > 0) {
            const walletStore = useWalletStore.getState();
            
            // Trigger balance refresh for successful wallets
            walletStore.updateAllBalances();
          }

          set(state => ({
            bulkOperations: state.bulkOperations.map(op => 
              op.id === operationId ? finalStatus : op
            ),
            isBulkOperationInProgress: false,
            lastUpdateTime: new Date(),
          }));

          // Refresh faucet data
          get().refreshFaucetData();

          return result;

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error during bulk operation';
          console.error('Bulk faucet operation failed:', error);
          
          set({ 
            error: errorMessage, 
            isBulkOperationInProgress: false,
            lastUpdateTime: new Date(),
          });

          return {
            success: false,
            successfulWallets: [],
            failedWallets: addresses.map(address => ({ address, error: errorMessage })),
            totalAmount: 0,
            operationDuration: 0,
            faucetBreakdown: [],
          };
        }
      },

      // Cancel bulk operation
      cancelBulkOperation: (operationId: string) => {
        set(state => ({
          bulkOperations: state.bulkOperations.map(op => 
            op.id === operationId ? { ...op, status: 'cancelled' as const, endTime: new Date() } : op
          ),
          isBulkOperationInProgress: false,
        }));
      },

      // Set faucet strategy
      setStrategy: (strategyId: string) => {
        try {
          faucetManager.setStrategy(strategyId);
          set({ currentStrategy: strategyId });
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to set strategy' });
        }
      },

      // Toggle faucet selection
      toggleFaucetSelection: (faucetId: string) => {
        set(state => {
          const isSelected = state.selectedFaucets.includes(faucetId);
          const newSelection = isSelected
            ? state.selectedFaucets.filter(id => id !== faucetId)
            : [...state.selectedFaucets, faucetId];
          
          return { selectedFaucets: newSelection };
        });
      },

      // Set selected faucets
      setSelectedFaucets: (faucetIds: string[]) => {
        set({ selectedFaucets: faucetIds });
      },

      // Reset configuration
      resetConfiguration: () => {
        set({
          currentStrategy: 'fast-and-reliable',
          selectedFaucets: [],
          showAdvancedOptions: false,
          showMetrics: false,
        });
        faucetManager.setStrategy('fast-and-reliable');
      },

      // Refresh faucet data
      refreshFaucetData: () => {
        try {
          const configs = faucetClient.getActiveFaucets();
          const metrics = faucetMonitor.getAllMetrics();
          const alerts = faucetMonitor.getActiveAlerts();
          
          // Check if faucets are enabled (testnet only)
          const networkStore = useNetworkStore.getState();
          const isEnabled = !networkStore.isMainnet() && networkStore.currentNetwork.chainId === 97;
          
          set({
            faucetConfigs: configs,
            faucetMetrics: metrics,
            performanceAlerts: alerts,
            isEnabled,
            lastUpdateTime: new Date(),
          });

          // Add warnings if needed
          if (!isEnabled) {
            set(state => ({
              warnings: [...state.warnings.filter(w => !w.includes('testnet')), 'Faucets are only available on BSC Testnet'],
            }));
          }

        } catch (error) {
          console.error('Failed to refresh faucet data:', error);
          set({ error: 'Failed to refresh faucet data' });
        }
      },

      // Clear request history
      clearRequestHistory: () => {
        set({
          recentRequests: [],
          bulkOperations: [],
          requestHistory: new Map(),
        });
        faucetMonitor.reset();
      },

      // Clear error
      clearError: () => {
        set({ error: undefined });
      },

      // Dismiss warning
      dismissWarning: (index: number) => {
        set(state => ({
          warnings: state.warnings.filter((_, i) => i !== index),
        }));
      },

      // Acknowledge alert
      acknowledgeAlert: (alertId: string) => {
        faucetMonitor.acknowledgeAlert(alertId);
        get().refreshFaucetData();
      },

      // Check if can request from faucet
      canRequestFromFaucet: (address: string, faucetId: string): boolean => {
        try {
          const state = get();
          if (!state.isEnabled) return false;
          
          return !faucetClient.isInCooldown(faucetId, address) && 
                 !faucetClient.hasReachedDailyLimit(faucetId, address);
        } catch (error) {
          return false;
        }
      },

      // Get cooldown info
      getCooldownInfo: (address: string, faucetId: string) => {
        const isInCooldown = faucetClient.isInCooldown(faucetId, address);
        const remainingSeconds = faucetClient.getCooldownSeconds(faucetId, address);
        const nextAvailable = faucetClient.getNextRequestTime(faucetId, address);
        
        return {
          isInCooldown,
          remainingSeconds,
          nextAvailable: nextAvailable || undefined,
        };
      },

      // Check if has available faucets
      hasAvailableFaucets: (address: string): boolean => {
        return faucetManager.hasAvailableFaucets(address);
      },

      // Get optimal faucet order
      getOptimalFaucetOrder: () => {
        return faucetMonitor.getOptimalFaucetOrder();
      },

      // Export metrics
      exportMetrics: (): string => {
        return faucetMonitor.exportMetrics();
      },

      // Get request stats
      getRequestStats: (address: string) => {
        return faucetClient.getRequestStats(address);
      },

      // Estimate success probability
      estimateSuccessProbability: (address: string): number => {
        return faucetManager.estimateSuccessProbability(address);
      },
    }),
    {
      name: 'faucet-store',
      // Only persist configuration, not transient state
      partialize: (state) => ({
        currentStrategy: state.currentStrategy,
        selectedFaucets: state.selectedFaucets,
        showAdvancedOptions: state.showAdvancedOptions,
        showMetrics: state.showMetrics,
      }),
    }
  )
);