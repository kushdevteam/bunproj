/**
 * Transaction Tracking and Management Store
 * Handles individual transaction states, queuing, and historical data
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Transaction } from '../types';

export type TransactionStatus = 'queued' | 'pending' | 'submitted' | 'confirming' | 'confirmed' | 'failed' | 'cancelled';
export type TransactionType = 'buy' | 'sell' | 'approve' | 'transfer' | 'funding';
export type TransactionPriority = 'low' | 'normal' | 'high' | 'critical';

export interface EnhancedTransaction extends Omit<Transaction, 'status'> {
  // Override status with enhanced values
  status: TransactionStatus;
  
  // Enhanced fields
  type: TransactionType;
  priority: TransactionPriority;
  walletId: string;
  executionId: string;
  batchId?: string;
  
  // Timing
  queuedAt: string;
  submittedAt?: string;
  confirmedAt?: string;
  failedAt?: string;
  
  // Gas and fees
  gasLimit: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  effectiveGasPrice?: string;
  gasUsedActual?: string;
  
  // Transaction data
  inputData?: string;
  amount?: string; // Transaction amount (alias for value)
  data?: string; // Transaction data
  nonce?: number;
  confirmations: number;
  requiredConfirmations: number;
  
  // Error handling
  error?: string;
  retryCount: number;
  maxRetries: number;
  
  // MEV protection
  isPrivateMempool?: boolean;
  bundleHash?: string;
  
  // Execution context
  staggerDelay?: number;
  actualDelay?: number;
  batchPosition?: number;
  
  // Tax system properties
  taxCollectionStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  taxTransactionHash?: string;
  
  // Additional required fields
  createdAt?: string;
  updatedAt?: string;
}

export interface TransactionBatch {
  id: string;
  executionId: string;
  transactions: string[]; // Transaction IDs
  status: 'pending' | 'executing' | 'completed' | 'failed';
  startedAt?: string;
  completedAt?: string;
  concurrentLimit: number;
  pauseBetweenTx: number;
}

export interface GasTracker {
  networkGasPrice: string;
  recommendedGasPrice: string;
  fastGasPrice: string;
  estimatedConfirmationTime: number;
  networkCongestion: 'low' | 'medium' | 'high';
  lastUpdated: string;
}

export interface RetryPolicy {
  enabled: boolean;
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

export interface TransactionQueue {
  transactions: string[]; // Transaction IDs in order
  currentIndex: number;
  isPaused: boolean;
  concurrentLimit: number;
  activeTransactions: string[];
}

export interface TransactionFilters {
  status?: TransactionStatus[];
  type?: TransactionType[];
  walletId?: string;
  executionId?: string;
  dateRange?: {
    start: string;
    end: string;
  };
}

export interface TransactionMetrics {
  totalTransactions: number;
  successRate: number;
  averageConfirmationTime: number;
  averageGasUsed: string;
  totalGasCost: string;
  fastestTransaction: number;
  slowestTransaction: number;
  retryRate: number;
}

interface TransactionState {
  // Core data
  transactions: Record<string, EnhancedTransaction>;
  batches: Record<string, TransactionBatch>;
  queue: TransactionQueue;
  
  // Gas management
  gasTracker: GasTracker;
  retryPolicy: RetryPolicy;
  
  // Metrics and filtering
  metrics: TransactionMetrics;
  filters: TransactionFilters;
  
  // Real-time updates
  isMonitoring: boolean;
  lastUpdate: Date | null;
  
  // Actions - Transaction Management
  addTransaction: (tx: Omit<EnhancedTransaction, 'id' | 'queuedAt'>) => string;
  updateTransaction: (id: string, updates: Partial<EnhancedTransaction>) => void;
  updateTransactionStatus: (id: string, status: TransactionStatus) => void;
  removeTransaction: (id: string) => void;
  retryTransaction: (id: string) => Promise<boolean>;
  cancelTransaction: (id: string) => void;
  
  // Actions - Queue Management
  queueTransaction: (txId: string, priority?: TransactionPriority) => void;
  dequeueTransaction: () => string | null;
  pauseQueue: () => void;
  resumeQueue: () => void;
  clearQueue: () => void;
  reorderQueue: (txIds: string[]) => void;
  
  // Actions - Batch Management
  createBatch: (executionId: string, txIds: string[], concurrentLimit: number) => string;
  updateBatch: (batchId: string, updates: Partial<TransactionBatch>) => void;
  completeBatch: (batchId: string) => void;
  
  // Actions - Gas Management
  updateGasTracker: (gasData: Partial<GasTracker>) => void;
  optimizeGasPrice: (txId: string) => string;
  
  // Actions - Monitoring
  startMonitoring: () => void;
  stopMonitoring: () => void;
  pollTransactionStatus: (txId: string) => Promise<void>;
  
  // Actions - Filtering and Search
  setFilters: (filters: Partial<TransactionFilters>) => void;
  clearFilters: () => void;
  getFilteredTransactions: () => EnhancedTransaction[];
  searchTransactions: (query: string) => EnhancedTransaction[];
  
  // Actions - Metrics
  calculateMetrics: () => void;
  getTransactionsByStatus: (status: TransactionStatus) => EnhancedTransaction[];
  getTransactionsByWallet: (walletId: string) => EnhancedTransaction[];
  getTransactionsByExecution: (executionId: string) => EnhancedTransaction[];
  
  // Actions - Utilities
  exportTransactionHistory: () => string;
  importTransactionHistory: (data: string) => boolean;
  clearHistory: () => void;
  clearCompleted: () => void;
}

const initialGasTracker: GasTracker = {
  networkGasPrice: '5000000000', // 5 gwei
  recommendedGasPrice: '5000000000',
  fastGasPrice: '7000000000', // 7 gwei
  estimatedConfirmationTime: 60, // seconds
  networkCongestion: 'medium',
  lastUpdated: new Date().toISOString(),
};

const initialRetryPolicy: RetryPolicy = {
  enabled: true,
  maxRetries: 3,
  baseDelayMs: 5000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  retryableErrors: [
    'insufficient funds',
    'nonce too low',
    'replacement transaction underpriced',
    'network error',
    'timeout',
  ],
};

const initialQueue: TransactionQueue = {
  transactions: [],
  currentIndex: 0,
  isPaused: false,
  concurrentLimit: 5,
  activeTransactions: [],
};

const initialMetrics: TransactionMetrics = {
  totalTransactions: 0,
  successRate: 0,
  averageConfirmationTime: 0,
  averageGasUsed: '0',
  totalGasCost: '0',
  fastestTransaction: 0,
  slowestTransaction: 0,
  retryRate: 0,
};

export const useTransactionStore = create<TransactionState>()(
  persist(
    (set, get) => ({
      // Initial state
      transactions: {},
      batches: {},
      queue: { ...initialQueue },
      gasTracker: { ...initialGasTracker },
      retryPolicy: { ...initialRetryPolicy },
      metrics: { ...initialMetrics },
      filters: {},
      isMonitoring: false,
      lastUpdate: null,

      // Add transaction
      addTransaction: (txData: Omit<EnhancedTransaction, 'id' | 'queuedAt'>) => {
        const id = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const timestamp = new Date().toISOString();
        
        const transaction: EnhancedTransaction = {
          ...txData,
          id,
          queuedAt: timestamp,
          confirmations: 0,
          requiredConfirmations: 1,
          retryCount: 0,
          maxRetries: get().retryPolicy.maxRetries,
        };
        
        set((state: TransactionState) => ({
          ...state,
          transactions: {
            ...state.transactions,
            [id]: transaction,
          },
          lastUpdate: new Date(),
        }));
        
        // Auto-calculate metrics
        get().calculateMetrics();
        
        return id;
      },

      // Update transaction
      updateTransaction: (id: string, updates: Partial<EnhancedTransaction>) => {
        set((state: TransactionState) => {
          const transaction = state.transactions[id];
          if (!transaction) return state;
          
          const updatedTransaction = { ...transaction, ...updates };
          
          // Update timestamps based on status changes
          if (updates.status) {
            const timestamp = new Date().toISOString();
            switch (updates.status) {
              case 'submitted':
                updatedTransaction.submittedAt = timestamp;
                break;
              case 'confirmed':
                updatedTransaction.confirmedAt = timestamp;
                break;
              case 'failed':
                updatedTransaction.failedAt = timestamp;
                break;
            }
          }
          
          return {
            ...state,
            transactions: {
              ...state.transactions,
              [id]: updatedTransaction,
            },
            lastUpdate: new Date(),
          };
        });
        
        // Auto-calculate metrics after update
        get().calculateMetrics();
      },

      // Update transaction status (convenience method)
      updateTransactionStatus: (id: string, status: TransactionStatus) => {
        get().updateTransaction(id, { status });
      },

      // Remove transaction
      removeTransaction: (id: string) => {
        set((state: TransactionState) => {
          const { [id]: removed, ...rest } = state.transactions;
          
          return {
            ...state,
            transactions: rest,
            queue: {
              ...state.queue,
              transactions: state.queue.transactions.filter(txId => txId !== id),
              activeTransactions: state.queue.activeTransactions.filter(txId => txId !== id),
            },
            lastUpdate: new Date(),
          };
        });
      },

      // Retry transaction
      retryTransaction: async (id: string) => {
        try {
          const state = get();
          const transaction = state.transactions[id];
          
          if (!transaction) {
            throw new Error('Transaction not found');
          }
          
          if (transaction.retryCount >= transaction.maxRetries) {
            throw new Error('Maximum retry attempts reached');
          }
          
          // Check if error is retryable
          const isRetryable = state.retryPolicy.retryableErrors.some(error => 
            transaction.error?.toLowerCase().includes(error.toLowerCase())
          );
          
          if (!isRetryable) {
            throw new Error('Error is not retryable');
          }
          
          // Calculate retry delay with exponential backoff
          const delay = Math.min(
            state.retryPolicy.baseDelayMs * Math.pow(state.retryPolicy.backoffMultiplier, transaction.retryCount),
            state.retryPolicy.maxDelayMs
          );
          
          // Schedule retry
          setTimeout(() => {
            get().updateTransaction(id, {
              status: 'queued',
              retryCount: transaction.retryCount + 1,
              error: undefined,
            });
            
            // Re-queue transaction
            get().queueTransaction(id, transaction.priority);
          }, delay);
          
          return true;
        } catch (error) {
          console.error('Failed to retry transaction:', error);
          return false;
        }
      },

      // Cancel transaction
      cancelTransaction: (id: string) => {
        get().updateTransaction(id, {
          status: 'cancelled',
          error: 'Cancelled by user',
        });
      },

      // Queue transaction
      queueTransaction: (txId: string, priority: TransactionPriority = 'normal') => {
        set((state: TransactionState) => {
          const queue = { ...state.queue };
          
          // Remove if already in queue
          queue.transactions = queue.transactions.filter(id => id !== txId);
          
          // Insert based on priority
          if (priority === 'critical') {
            queue.transactions.unshift(txId);
          } else if (priority === 'high') {
            const firstNormalIndex = queue.transactions.findIndex(id => {
              const tx = state.transactions[id];
              return tx && tx.priority !== 'critical';
            });
            if (firstNormalIndex === -1) {
              queue.transactions.push(txId);
            } else {
              queue.transactions.splice(firstNormalIndex, 0, txId);
            }
          } else {
            queue.transactions.push(txId);
          }
          
          return {
            ...state,
            queue,
            lastUpdate: new Date(),
          };
        });
      },

      // Dequeue transaction
      dequeueTransaction: () => {
        const state = get();
        
        if (state.queue.isPaused || state.queue.transactions.length === 0) {
          return null;
        }
        
        if (state.queue.activeTransactions.length >= state.queue.concurrentLimit) {
          return null;
        }
        
        const txId = state.queue.transactions[state.queue.currentIndex];
        
        set((state: TransactionState) => ({
          ...state,
          queue: {
            ...state.queue,
            currentIndex: state.queue.currentIndex + 1,
            activeTransactions: [...state.queue.activeTransactions, txId],
          },
          lastUpdate: new Date(),
        }));
        
        return txId;
      },

      // Pause queue
      pauseQueue: () => {
        set((state: TransactionState) => ({
          ...state,
          queue: {
            ...state.queue,
            isPaused: true,
          },
          lastUpdate: new Date(),
        }));
      },

      // Resume queue
      resumeQueue: () => {
        set((state: TransactionState) => ({
          ...state,
          queue: {
            ...state.queue,
            isPaused: false,
          },
          lastUpdate: new Date(),
        }));
      },

      // Clear queue
      clearQueue: () => {
        set((state: TransactionState) => ({
          ...state,
          queue: {
            ...initialQueue,
            concurrentLimit: state.queue.concurrentLimit,
          },
          lastUpdate: new Date(),
        }));
      },

      // Reorder queue
      reorderQueue: (txIds: string[]) => {
        set((state: TransactionState) => ({
          ...state,
          queue: {
            ...state.queue,
            transactions: txIds,
            currentIndex: 0,
          },
          lastUpdate: new Date(),
        }));
      },

      // Create batch
      createBatch: (executionId: string, txIds: string[], concurrentLimit: number) => {
        const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const batch: TransactionBatch = {
          id: batchId,
          executionId,
          transactions: txIds,
          status: 'pending',
          concurrentLimit,
          pauseBetweenTx: 1000, // 1 second default
        };
        
        set((state: TransactionState) => ({
          ...state,
          batches: {
            ...state.batches,
            [batchId]: batch,
          },
          lastUpdate: new Date(),
        }));
        
        return batchId;
      },

      // Update batch
      updateBatch: (batchId: string, updates: Partial<TransactionBatch>) => {
        set((state: TransactionState) => {
          const batch = state.batches[batchId];
          if (!batch) return state;
          
          const updatedBatch = { ...batch, ...updates };
          
          // Update timestamps
          if (updates.status === 'executing' && !batch.startedAt) {
            updatedBatch.startedAt = new Date().toISOString();
          } else if (['completed', 'failed'].includes(updates.status || '') && !batch.completedAt) {
            updatedBatch.completedAt = new Date().toISOString();
          }
          
          return {
            ...state,
            batches: {
              ...state.batches,
              [batchId]: updatedBatch,
            },
            lastUpdate: new Date(),
          };
        });
      },

      // Complete batch
      completeBatch: (batchId: string) => {
        get().updateBatch(batchId, {
          status: 'completed',
          completedAt: new Date().toISOString(),
        });
      },

      // Update gas tracker
      updateGasTracker: (gasData: Partial<GasTracker>) => {
        set((state: TransactionState) => ({
          ...state,
          gasTracker: {
            ...state.gasTracker,
            ...gasData,
            lastUpdated: new Date().toISOString(),
          },
          lastUpdate: new Date(),
        }));
      },

      // Optimize gas price
      optimizeGasPrice: (txId: string) => {
        const state = get();
        const transaction = state.transactions[txId];
        const gasTracker = state.gasTracker;
        
        if (!transaction) return '0';
        
        // Simple optimization based on priority and network conditions
        let gasPrice = gasTracker.recommendedGasPrice;
        
        if (transaction.priority === 'high' || transaction.priority === 'critical') {
          gasPrice = gasTracker.fastGasPrice;
        }
        
        if (gasTracker.networkCongestion === 'high') {
          gasPrice = (BigInt(gasPrice) * BigInt(120) / BigInt(100)).toString(); // +20%
        }
        
        return gasPrice;
      },

      // Start monitoring
      startMonitoring: () => {
        set({ isMonitoring: true });
      },

      // Stop monitoring
      stopMonitoring: () => {
        set({ isMonitoring: false });
      },

      // Poll transaction status (placeholder - would integrate with blockchain API)
      pollTransactionStatus: async (txId: string) => {
        // In real implementation, this would check blockchain for transaction status
        const state = get();
        const transaction = state.transactions[txId];
        
        if (!transaction || !transaction.hash) {
          return;
        }
        
        // Simulate status polling
        // get().updateTransaction(txId, { confirmations: transaction.confirmations + 1 });
      },

      // Set filters
      setFilters: (filters: Partial<TransactionFilters>) => {
        set((state: TransactionState) => ({
          ...state,
          filters: { ...state.filters, ...filters },
          lastUpdate: new Date(),
        }));
      },

      // Clear filters
      clearFilters: () => {
        set({ filters: {} });
      },

      // Get filtered transactions
      getFilteredTransactions: () => {
        const state = get();
        const transactions = Object.values(state.transactions);
        const filters = state.filters;
        
        return transactions.filter(tx => {
          if (filters.status && !filters.status.includes(tx.status as TransactionStatus)) {
            return false;
          }
          
          if (filters.type && !filters.type.includes(tx.type)) {
            return false;
          }
          
          if (filters.walletId && tx.walletId !== filters.walletId) {
            return false;
          }
          
          if (filters.executionId && tx.executionId !== filters.executionId) {
            return false;
          }
          
          if (filters.dateRange) {
            const txDate = new Date(tx.queuedAt);
            const startDate = new Date(filters.dateRange.start);
            const endDate = new Date(filters.dateRange.end);
            
            if (txDate < startDate || txDate > endDate) {
              return false;
            }
          }
          
          return true;
        });
      },

      // Search transactions
      searchTransactions: (query: string) => {
        const state = get();
        const transactions = Object.values(state.transactions);
        const lowercaseQuery = query.toLowerCase();
        
        return transactions.filter(tx => 
          tx.id.toLowerCase().includes(lowercaseQuery) ||
          tx.hash.toLowerCase().includes(lowercaseQuery) ||
          tx.from.toLowerCase().includes(lowercaseQuery) ||
          tx.to.toLowerCase().includes(lowercaseQuery) ||
          tx.walletId.toLowerCase().includes(lowercaseQuery)
        );
      },

      // Calculate metrics
      calculateMetrics: () => {
        set((state: TransactionState) => {
          const transactions = Object.values(state.transactions);
          const completedTx = transactions.filter(tx => 
            ['confirmed', 'failed'].includes(tx.status)
          );
          
          const successfulTx = transactions.filter(tx => tx.status === 'confirmed');
          const failedTx = transactions.filter(tx => tx.status === 'failed');
          const retriedTx = transactions.filter(tx => tx.retryCount > 0);
          
          const confirmationTimes = successfulTx
            .filter(tx => tx.submittedAt && tx.confirmedAt)
            .map(tx => new Date(tx.confirmedAt!).getTime() - new Date(tx.submittedAt!).getTime());
          
          const gasUsed = successfulTx
            .filter(tx => tx.gasUsedActual)
            .map(tx => BigInt(tx.gasUsedActual!));
          
          const metrics: TransactionMetrics = {
            totalTransactions: transactions.length,
            successRate: completedTx.length > 0 ? (successfulTx.length / completedTx.length) * 100 : 0,
            averageConfirmationTime: confirmationTimes.length > 0 
              ? confirmationTimes.reduce((a, b) => a + b, 0) / confirmationTimes.length / 1000 // seconds
              : 0,
            averageGasUsed: gasUsed.length > 0
              ? (gasUsed.reduce((a, b) => a + b, BigInt(0)) / BigInt(gasUsed.length)).toString()
              : '0',
            totalGasCost: '0', // Would calculate from gas used * gas price
            fastestTransaction: confirmationTimes.length > 0 ? Math.min(...confirmationTimes) / 1000 : 0,
            slowestTransaction: confirmationTimes.length > 0 ? Math.max(...confirmationTimes) / 1000 : 0,
            retryRate: transactions.length > 0 ? (retriedTx.length / transactions.length) * 100 : 0,
          };
          
          return {
            ...state,
            metrics,
            lastUpdate: new Date(),
          };
        });
      },

      // Get transactions by status
      getTransactionsByStatus: (status: TransactionStatus) => {
        const state = get();
        return Object.values(state.transactions).filter(tx => tx.status === status);
      },

      // Get transactions by wallet
      getTransactionsByWallet: (walletId: string) => {
        const state = get();
        return Object.values(state.transactions).filter(tx => tx.walletId === walletId);
      },

      // Get transactions by execution
      getTransactionsByExecution: (executionId: string) => {
        const state = get();
        return Object.values(state.transactions).filter(tx => tx.executionId === executionId);
      },

      // Export transaction history
      exportTransactionHistory: () => {
        const state = get();
        const data = {
          transactions: state.transactions,
          batches: state.batches,
          exportedAt: new Date().toISOString(),
        };
        return JSON.stringify(data, null, 2);
      },

      // Import transaction history
      importTransactionHistory: (data: string) => {
        try {
          const parsed = JSON.parse(data);
          
          if (!parsed.transactions || !parsed.batches) {
            throw new Error('Invalid data format');
          }
          
          set((state: TransactionState) => ({
            ...state,
            transactions: { ...state.transactions, ...parsed.transactions },
            batches: { ...state.batches, ...parsed.batches },
            lastUpdate: new Date(),
          }));
          
          get().calculateMetrics();
          return true;
        } catch (error) {
          console.error('Failed to import transaction history:', error);
          return false;
        }
      },

      // Clear history
      clearHistory: () => {
        set({
          transactions: {},
          batches: {},
          queue: { ...initialQueue },
          metrics: { ...initialMetrics },
          lastUpdate: new Date(),
        });
      },

      // Clear completed transactions
      clearCompleted: () => {
        set((state: TransactionState) => {
          const transactions = Object.fromEntries(
            Object.entries(state.transactions).filter(([_, tx]) => 
              !['confirmed', 'failed', 'cancelled'].includes((tx as EnhancedTransaction).status)
            )
          );
          
          return {
            ...state,
            transactions,
            lastUpdate: new Date(),
          };
        });
        
        get().calculateMetrics();
      },
    }),
    {
      name: 'transaction-store',
      // Persist configuration but not sensitive transaction data
      partialize: (state: TransactionState) => ({
        retryPolicy: state.retryPolicy,
        filters: state.filters,
        gasTracker: {
          ...state.gasTracker,
          // Don't persist real-time gas data
          lastUpdated: new Date().toISOString(),
        },
      }),
    }
  )
);