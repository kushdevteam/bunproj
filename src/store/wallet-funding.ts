/**
 * Stealth Wallet Funding Store using Zustand
 * Manages stealth funding operations, plans, and real-time progress tracking
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { walletFundingService } from '../services/wallet-funding-service';
import { useWalletStore } from './wallets';
import { useSessionStore } from './session';
import type {
  StealthFundingStore,
  StealthFundingOperation,
  StealthFundingPlan,
  StealthFundingResult,
  StealthFundingPreferences,
  StealthConfig,
  MasterWallet,
  MasterWalletCriteria,
  StealthValidationResult,
  StealthOperationEvent,
  StealthTransaction,
} from '../types/funding';
import {
  DEFAULT_STEALTH_PREFERENCES,
  STEALTH_PRESETS
} from '../types/funding';
import { Role } from '../types';

interface WalletFundingState extends StealthFundingStore {
  // Additional internal state
  lastUpdated: Date | null;
  operationStartTime: Date | null;
  
  // Enhanced methods
  loadMasterWallets: () => Promise<void>;
  refreshMasterWalletBalances: () => Promise<void>;
  getAvailableMasterWallets: (criteria?: Partial<MasterWalletCriteria>) => MasterWallet[];
  executeStealthOperationWithPlan: (plan: StealthFundingPlan, passphrase: string) => Promise<void>;
  
  // Operation management
  getCurrentOperationStatus: () => {
    isRunning: boolean;
    progress: number;
    estimatedTimeRemaining: number;
    currentTransaction?: StealthTransaction;
  };
  
  // Real-time updates
  updateOperationProgress: (operationId: string, progress: Partial<StealthFundingOperation['progress']>) => void;
  updateTransactionStatus: (transactionId: string, status: StealthTransaction['status'], txHash?: string, error?: string) => void;
  
  // Analytics and statistics
  getOperationStats: () => {
    totalOperations: number;
    successfulOperations: number;
    totalWalletsFunded: number;
    totalAmountDistributed: number;
    averageSuccessRate: number;
  };
}

export const useWalletFundingStore = create<WalletFundingState>()(
  persist(
    (set, get) => ({
      // Initial state
      currentOperation: null,
      operationHistory: [],
      isExecuting: false,
      isPaused: false,
      error: null,
      preferences: DEFAULT_STEALTH_PREFERENCES,
      availableMasterWallets: [],
      recentEvents: [],
      lastUpdated: null,
      operationStartTime: null,

      // Create stealth funding plan
      createStealthPlan: async (masterWalletId, targetWalletIds, totalAmount, config) => {
        try {
          set({ error: null });

          // Find master wallet
          const state = get();
          const masterWallet = state.availableMasterWallets.find(w => w.id === masterWalletId);
          if (!masterWallet) {
            throw new Error('Master wallet not found');
          }

          // Validate inputs
          if (targetWalletIds.length === 0) {
            throw new Error('No target wallets specified');
          }

          if (totalAmount <= 0) {
            throw new Error('Total amount must be greater than 0');
          }

          if (totalAmount > state.preferences.maxTotalAmount) {
            throw new Error(`Total amount exceeds maximum allowed (${state.preferences.maxTotalAmount} BNB)`);
          }

          if (targetWalletIds.length > state.preferences.maxWalletsPerOperation) {
            throw new Error(`Too many wallets selected (max: ${state.preferences.maxWalletsPerOperation})`);
          }

          // Create plan using service
          const plan = await walletFundingService.createStealthPlan(
            masterWallet,
            targetWalletIds,
            totalAmount,
            config
          );

          return plan;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to create stealth plan';
          set({ error: errorMessage });
          throw error;
        }
      },

      // Validate plan
      validatePlan: (plan) => {
        try {
          return walletFundingService.validatePlan(plan);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Plan validation failed';
          set({ error: errorMessage });
          return {
            isValid: false,
            errors: [errorMessage],
            warnings: [],
            recommendations: [],
            estimatedCosts: {
              totalAmount: 0,
              estimatedGas: 0,
              estimatedDuration: 0,
            },
          };
        }
      },

      // Execute stealth operation
      executeStealthOperation: async (planId, passphrase) => {
        try {
          set({ error: null, isExecuting: true, operationStartTime: new Date() });

          // Find the plan (in a real implementation, plans would be stored separately)
          // For now, we'll create a mock plan or expect it to be passed differently
          throw new Error('Plan execution requires plan object - implementation needs plan storage');

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Operation execution failed';
          set({ error: errorMessage, isExecuting: false, operationStartTime: null });
          throw error;
        }
      },

      // Execute with plan object (alternative implementation)
      executeStealthOperationWithPlan: async (plan: StealthFundingPlan, passphrase: string) => {
        try {
          set({ error: null, isExecuting: true, operationStartTime: new Date() });

          // Create operation tracking object
          const operation: StealthFundingOperation = {
            id: plan.id,
            plan,
            status: 'executing',
            progress: {
              completed: 0,
              total: plan.transactionCount,
              percentage: 0,
              estimatedTimeRemaining: plan.estimatedDuration,
              averageTransactionTime: 0,
            },
            statistics: {
              totalSent: 0,
              successfulTransactions: 0,
              failedTransactions: 0,
              retryTransactions: 0,
              gasUsed: 0,
              averageGasPrice: 0,
            },
            startedAt: new Date(),
          };

          set({ currentOperation: operation });

          // Execute the operation with progress tracking
          await walletFundingService.executeStealthOperation(
            plan,
            passphrase,
            // Progress callback
            (progress) => {
              const state = get();
              if (state.currentOperation) {
                const percentage = (progress.completed / progress.total) * 100;
                const updatedOperation = {
                  ...state.currentOperation,
                  progress: {
                    ...state.currentOperation.progress,
                    completed: progress.completed,
                    percentage,
                  },
                };
                set({ currentOperation: updatedOperation });
              }
            },
            // Event callback
            (event) => {
              get().addEvent(event);
              
              // Update operation status based on event
              const state = get();
              if (state.currentOperation && event.operationId === state.currentOperation.id) {
                let updatedOperation = { ...state.currentOperation };
                
                switch (event.type) {
                  case 'transaction_confirmed':
                    updatedOperation.statistics.successfulTransactions++;
                    // Find the transaction and add its amount
                    const confirmedTx = plan.transactions.find(tx => tx.id === event.transactionId);
                    if (confirmedTx) {
                      updatedOperation.statistics.totalSent += confirmedTx.actualAmount;
                    }
                    break;
                    
                  case 'transaction_failed':
                    updatedOperation.statistics.failedTransactions++;
                    break;
                    
                  case 'operation_completed':
                    updatedOperation.status = 'completed';
                    updatedOperation.completedAt = new Date();
                    break;
                    
                  case 'operation_failed':
                    updatedOperation.status = 'failed';
                    updatedOperation.error = event.error;
                    updatedOperation.completedAt = new Date();
                    break;
                }
                
                set({ currentOperation: updatedOperation });
              }
            }
          );

          // Operation completed successfully
          const completedOperation = get().currentOperation;
          if (completedOperation) {
            const result: StealthFundingResult = {
              operationId: completedOperation.id,
              success: completedOperation.status === 'completed',
              totalWalletsFunded: completedOperation.statistics.successfulTransactions,
              totalAmountDistributed: completedOperation.statistics.totalSent,
              totalGasUsed: completedOperation.statistics.gasUsed,
              operationDuration: Date.now() - (completedOperation.startedAt?.getTime() || 0),
              transactions: plan.transactions,
              summary: {
                successRate: (completedOperation.statistics.successfulTransactions / plan.transactionCount) * 100,
                averageAmount: completedOperation.statistics.totalSent / completedOperation.statistics.successfulTransactions,
                medianDelay: 0, // Would be calculated from actual transaction data
                gasEfficiency: completedOperation.statistics.averageGasPrice,
              },
              errors: plan.transactions.filter(t => t.status === 'failed').map(t => t.error || 'Unknown error'),
              createdAt: plan.createdAt,
              completedAt: new Date(),
            };

            set(state => ({
              operationHistory: [result, ...state.operationHistory.slice(0, 49)], // Keep last 50
              currentOperation: null,
              isExecuting: false,
              operationStartTime: null,
            }));
          }

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Operation execution failed';
          set(state => ({
            error: errorMessage,
            isExecuting: false,
            operationStartTime: null,
            currentOperation: state.currentOperation ? {
              ...state.currentOperation,
              status: 'failed',
              error: errorMessage,
              completedAt: new Date(),
            } : null,
          }));
          throw error;
        }
      },

      // Pause operation
      pauseOperation: (operationId) => {
        set(state => {
          if (state.currentOperation?.id === operationId) {
            return {
              isPaused: true,
              currentOperation: {
                ...state.currentOperation,
                status: 'paused',
                pausedAt: new Date(),
              },
            };
          }
          return state;
        });
      },

      // Resume operation
      resumeOperation: (operationId) => {
        set(state => {
          if (state.currentOperation?.id === operationId && state.isPaused) {
            return {
              isPaused: false,
              currentOperation: {
                ...state.currentOperation,
                status: 'executing',
                pausedAt: undefined,
              },
            };
          }
          return state;
        });
      },

      // Cancel operation
      cancelOperation: (operationId) => {
        set(state => {
          if (state.currentOperation?.id === operationId) {
            return {
              currentOperation: {
                ...state.currentOperation,
                status: 'cancelled',
                completedAt: new Date(),
              },
              isExecuting: false,
              isPaused: false,
              operationStartTime: null,
            };
          }
          return state;
        });
      },

      // Load available master wallets
      loadAvailableMasterWallets: async () => {
        try {
          const walletStore = useWalletStore.getState();
          const sessionStore = useSessionStore.getState();

          if (!sessionStore.isUnlocked) {
            set({ availableMasterWallets: [] });
            return;
          }

          // Filter wallets that can be used as master wallets
          const masterWallets: MasterWallet[] = walletStore.wallets
            .filter(wallet => 
              wallet.isActive && 
              wallet.balance > 0.01 && // Minimum balance requirement
              (wallet.role === Role.FUNDER || wallet.role === Role.DEV) // Preferred roles
            )
            .map(wallet => ({
              id: wallet.id,
              address: wallet.address,
              balance: wallet.balance,
              alias: `${wallet.role} - ${wallet.address.slice(0, 8)}...`,
            }));

          set({ availableMasterWallets: masterWallets, lastUpdated: new Date() });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to load master wallets';
          set({ error: errorMessage });
        }
      },

      // Refresh master wallet balances
      refreshMasterWalletBalances: async () => {
        try {
          const state = get();
          const walletStore = useWalletStore.getState();

          // Update balances from wallet store
          const updatedMasterWallets = state.availableMasterWallets.map(masterWallet => {
            const wallet = walletStore.wallets.find(w => w.id === masterWallet.id);
            return wallet ? { ...masterWallet, balance: wallet.balance } : masterWallet;
          });

          set({ availableMasterWallets: updatedMasterWallets, lastUpdated: new Date() });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to refresh master wallet balances';
          set({ error: errorMessage });
        }
      },

      // Get available master wallets with criteria
      getAvailableMasterWallets: (criteria) => {
        const state = get();
        let wallets = state.availableMasterWallets;

        if (criteria) {
          if (criteria.minimumBalance) {
            wallets = wallets.filter(w => w.balance >= criteria.minimumBalance!);
          }
          
          if (criteria.excludeWallets?.length) {
            wallets = wallets.filter(w => !criteria.excludeWallets!.includes(w.id));
          }
        }

        return wallets;
      },

      // Select master wallet based on criteria
      selectMasterWallet: (criteria) => {
        return get().getAvailableMasterWallets(criteria);
      },

      // Update preferences
      updatePreferences: (updates) => {
        set(state => ({
          preferences: { ...state.preferences, ...updates },
        }));
      },

      // Reset to defaults
      resetToDefaults: () => {
        set({
          preferences: DEFAULT_STEALTH_PREFERENCES,
          currentOperation: null,
          isExecuting: false,
          isPaused: false,
          error: null,
        });
      },

      // Estimate operation cost
      estimateOperationCost: (plan) => {
        const gasEstimate = plan.transactionCount * 21000; // Basic transfer gas
        const gasPrice = 5e9; // 5 Gwei estimate
        return (gasEstimate * gasPrice) / 1e18; // Convert to BNB
      },

      // Generate stealth config presets
      generateStealthConfig: (preset) => {
        return STEALTH_PRESETS[preset] || STEALTH_PRESETS.moderate;
      },

      // Event management
      addEvent: (event) => {
        set(state => ({
          recentEvents: [event, ...state.recentEvents.slice(0, 99)], // Keep last 100 events
        }));
      },

      clearEvents: () => {
        set({ recentEvents: [] });
      },

      // Error handling
      clearError: () => {
        set({ error: null });
      },

      handleTransactionError: (transactionId, error) => {
        const state = get();
        if (state.currentOperation) {
          const updatedTransactions = state.currentOperation.plan.transactions.map(tx =>
            tx.id === transactionId ? { ...tx, status: 'failed' as const, error } : tx
          );
          
          set({
            currentOperation: {
              ...state.currentOperation,
              plan: {
                ...state.currentOperation.plan,
                transactions: updatedTransactions,
              },
            },
          });
        }
      },

      // Get current operation status
      getCurrentOperationStatus: () => {
        const state = get();
        const operation = state.currentOperation;
        
        if (!operation) {
          return {
            isRunning: false,
            progress: 0,
            estimatedTimeRemaining: 0,
          };
        }

        const currentTransaction = operation.plan.transactions.find(tx => tx.status === 'sending');
        
        return {
          isRunning: state.isExecuting && !state.isPaused,
          progress: operation.progress.percentage,
          estimatedTimeRemaining: operation.progress.estimatedTimeRemaining,
          currentTransaction,
        };
      },

      // Update operation progress
      updateOperationProgress: (operationId, progress) => {
        set(state => {
          if (state.currentOperation?.id === operationId) {
            return {
              currentOperation: {
                ...state.currentOperation,
                progress: { ...state.currentOperation.progress, ...progress },
              },
            };
          }
          return state;
        });
      },

      // Update transaction status
      updateTransactionStatus: (transactionId, status, txHash, error) => {
        set(state => {
          if (state.currentOperation) {
            const updatedTransactions = state.currentOperation.plan.transactions.map(tx =>
              tx.id === transactionId
                ? { ...tx, status, txHash, error, confirmedAt: status === 'confirmed' ? new Date() : tx.confirmedAt }
                : tx
            );

            return {
              currentOperation: {
                ...state.currentOperation,
                plan: {
                  ...state.currentOperation.plan,
                  transactions: updatedTransactions,
                },
              },
            };
          }
          return state;
        });
      },

      // Get operation statistics
      getOperationStats: () => {
        const state = get();
        const history = state.operationHistory;
        
        const totalOperations = history.length;
        const successfulOperations = history.filter(op => op.success).length;
        const totalWalletsFunded = history.reduce((sum, op) => sum + op.totalWalletsFunded, 0);
        const totalAmountDistributed = history.reduce((sum, op) => sum + op.totalAmountDistributed, 0);
        const averageSuccessRate = totalOperations > 0
          ? history.reduce((sum, op) => sum + op.summary.successRate, 0) / totalOperations
          : 0;

        return {
          totalOperations,
          successfulOperations,
          totalWalletsFunded,
          totalAmountDistributed,
          averageSuccessRate,
        };
      },

      // Load master wallets (alias for consistency)
      loadMasterWallets: async () => {
        return get().loadAvailableMasterWallets();
      },
    }),
    {
      name: 'wallet-funding-store',
      partialize: (state) => ({
        operationHistory: state.operationHistory.slice(0, 10), // Persist only last 10 operations
        preferences: state.preferences,
        recentEvents: state.recentEvents.slice(0, 20), // Persist last 20 events
      }),
    }
  )
);