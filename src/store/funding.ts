/**
 * Funding Operations Store using Zustand
 * Handles BNB distribution across wallets and operation tracking
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiClient } from '../api/client';
import { useWalletStore } from './wallets';
import { useSessionStore } from './session';
import type { Wallet } from '../types';
import { Role } from '../types';

// Distribution Methods
export type DistributionMethod = 'equal' | 'weighted' | 'custom' | 'smart';

// Role multipliers for weighted distribution
export const ROLE_MULTIPLIERS: Record<Role, number> = {
  [Role.DEV]: 2,
  [Role.MEV]: 3,
  [Role.FUNDER]: 1,
  [Role.NUMBERED]: 1,
};

// Operation status types
export type OperationStatus = 'idle' | 'preparing' | 'executing' | 'completed' | 'failed' | 'cancelled';

// Transaction info for operations
export interface FundingTransaction {
  id: string;
  walletAddress: string;
  amount: number;
  status: 'pending' | 'confirmed' | 'failed';
  txHash?: string;
  gasUsed?: string;
  error?: string;
  timestamp: string;
}

// Distribution calculation result
export interface DistributionPlan {
  walletId: string;
  address: string;
  role: Role;
  currentBalance: number;
  plannedAmount: number;
  finalBalance: number;
  requiresFunding: boolean;
}

// Funding operation details
export interface FundingOperation {
  id: string;
  method: DistributionMethod;
  totalAmount: number;
  selectedWallets: string[];
  distributionPlan: DistributionPlan[];
  transactions: FundingTransaction[];
  status: OperationStatus;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  gasEstimate: number;
  estimatedCost: number;
}

// Funding preferences
export interface FundingPreferences {
  defaultMethod: DistributionMethod;
  customRoleMultipliers: Record<Role, number>;
  smartDistributionThreshold: number; // Minimum balance threshold
  autoApprovalLimit: number; // Auto-approve operations below this amount
  gasLimitMultiplier: number; // Gas limit safety multiplier
  retryAttempts: number;
  confirmLargeOperations: boolean;
}

// Store interface
interface FundingState {
  // Current operation state
  currentOperation: FundingOperation | null;
  operationHistory: FundingOperation[];
  isCalculating: boolean;
  isExecuting: boolean;
  error: string | null;
  
  // Preferences
  preferences: FundingPreferences;
  
  // Actions
  calculateDistribution: (
    method: DistributionMethod,
    totalAmount: number,
    selectedWallets: string[],
    customAmounts?: Record<string, number>
  ) => Promise<DistributionPlan[]>;
  
  createFundingOperation: (
    method: DistributionMethod,
    totalAmount: number,
    selectedWallets: string[],
    customAmounts?: Record<string, number>
  ) => Promise<void>;
  
  executeFundingOperation: (operationId: string, passphrase: string) => Promise<void>;
  cancelOperation: (operationId: string) => void;
  
  updatePreferences: (updates: Partial<FundingPreferences>) => void;
  clearError: () => void;
  clearHistory: () => void;
  
  // Distribution method implementations
  calculateEqualDistribution: (totalAmount: number, wallets: Wallet[]) => number;
  calculateWeightedDistribution: (totalAmount: number, wallets: Wallet[]) => Record<string, number>;
  calculateSmartDistribution: (totalAmount: number, wallets: Wallet[], threshold?: number) => Record<string, number>;
  
  // Utilities
  estimateGasCost: (transactions: number) => number;
  validateDistribution: (plan: DistributionPlan[]) => { isValid: boolean; errors: string[] };
}

const DEFAULT_PREFERENCES: FundingPreferences = {
  defaultMethod: 'equal',
  customRoleMultipliers: { ...ROLE_MULTIPLIERS },
  smartDistributionThreshold: 0.01, // 0.01 BNB minimum
  autoApprovalLimit: 1.0, // Auto-approve up to 1 BNB
  gasLimitMultiplier: 1.2, // 20% gas limit safety buffer
  retryAttempts: 3,
  confirmLargeOperations: true,
};

export const useFundingStore = create<FundingState>()(
  persist(
    (set, get) => ({
      // Initial state
      currentOperation: null,
      operationHistory: [],
      isCalculating: false,
      isExecuting: false,
      error: null,
      preferences: DEFAULT_PREFERENCES,

      // Calculate distribution based on method
      calculateDistribution: async (method, totalAmount, selectedWalletIds, customAmounts) => {
        try {
          set({ isCalculating: true, error: null });
          
          const walletStore = useWalletStore.getState();
          const selectedWallets = walletStore.wallets.filter(w => selectedWalletIds.includes(w.id));
          
          if (selectedWallets.length === 0) {
            throw new Error('No wallets selected for distribution');
          }
          
          if (totalAmount <= 0) {
            throw new Error('Total amount must be greater than 0');
          }
          
          let plannedAmounts: Record<string, number> = {};
          const state = get();
          
          switch (method) {
            case 'equal':
              const equalAmount = state.calculateEqualDistribution(totalAmount, selectedWallets);
              selectedWallets.forEach(wallet => {
                plannedAmounts[wallet.id] = equalAmount;
              });
              break;
              
            case 'weighted':
              plannedAmounts = state.calculateWeightedDistribution(totalAmount, selectedWallets);
              break;
              
            case 'custom':
              if (!customAmounts) {
                throw new Error('Custom amounts required for custom distribution method');
              }
              plannedAmounts = customAmounts;
              break;
              
            case 'smart':
              plannedAmounts = state.calculateSmartDistribution(
                totalAmount, 
                selectedWallets, 
                state.preferences.smartDistributionThreshold
              );
              break;
              
            default:
              throw new Error(`Unknown distribution method: ${method}`);
          }
          
          // Create distribution plan
          const distributionPlan: DistributionPlan[] = selectedWallets.map(wallet => ({
            walletId: wallet.id,
            address: wallet.address,
            role: wallet.role,
            currentBalance: wallet.balance,
            plannedAmount: plannedAmounts[wallet.id] || 0,
            finalBalance: wallet.balance + (plannedAmounts[wallet.id] || 0),
            requiresFunding: (plannedAmounts[wallet.id] || 0) > 0,
          }));
          
          // Validate distribution
          const validation = state.validateDistribution(distributionPlan);
          if (!validation.isValid) {
            throw new Error(`Distribution validation failed: ${validation.errors.join(', ')}`);
          }
          
          set({ isCalculating: false });
          return distributionPlan;
          
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Distribution calculation failed';
          set({ error: errorMessage, isCalculating: false });
          throw error;
        }
      },

      // Create a new funding operation
      createFundingOperation: async (method, totalAmount, selectedWallets, customAmounts) => {
        try {
          const distributionPlan = await get().calculateDistribution(method, totalAmount, selectedWallets, customAmounts);
          
          const operationId = `funding_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const gasEstimate = get().estimateGasCost(distributionPlan.filter(p => p.requiresFunding).length);
          
          const operation: FundingOperation = {
            id: operationId,
            method,
            totalAmount,
            selectedWallets,
            distributionPlan,
            transactions: [],
            status: 'preparing',
            gasEstimate,
            estimatedCost: gasEstimate * 0.00000001, // Approximate BNB cost
          };
          
          set(state => ({
            currentOperation: operation,
            operationHistory: [operation, ...state.operationHistory.slice(0, 49)], // Keep last 50
          }));
          
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to create funding operation';
          set({ error: errorMessage });
          throw error;
        }
      },

      // Execute funding operation
      executeFundingOperation: async (operationId, passphrase) => {
        try {
          const state = get();
          const operation = state.operationHistory.find(op => op.id === operationId);
          
          if (!operation) {
            throw new Error('Operation not found');
          }
          
          if (operation.status !== 'preparing') {
            throw new Error('Operation is not in preparing state');
          }
          
          // Validate session and passphrase
          const sessionStore = useSessionStore.getState();
          if (!sessionStore.isUnlocked) {
            throw new Error('Session must be unlocked to execute funding operations');
          }
          
          set({ isExecuting: true, error: null });
          
          // Update operation status
          const updatedOperation = {
            ...operation,
            status: 'executing' as OperationStatus,
            startedAt: new Date().toISOString(),
          };
          
          set(state => ({
            currentOperation: updatedOperation,
            operationHistory: state.operationHistory.map(op => 
              op.id === operationId ? updatedOperation : op
            ),
          }));
          
          // Execute transactions
          const walletsToFund = operation.distributionPlan.filter(p => p.requiresFunding);
          const transactions: FundingTransaction[] = [];
          
          for (const wallet of walletsToFund) {
            try {
              const txId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
              const transaction: FundingTransaction = {
                id: txId,
                walletAddress: wallet.address,
                amount: wallet.plannedAmount,
                status: 'pending',
                timestamp: new Date().toISOString(),
              };
              
              transactions.push(transaction);
              
              // Update state with pending transaction
              set(state => ({
                currentOperation: state.currentOperation ? {
                  ...state.currentOperation,
                  transactions: [...state.currentOperation.transactions, transaction],
                } : null,
              }));
              
              // Call API to fund wallet
              const response = await apiClient.fundWallets({
                wallets: [wallet.address],
                amount: wallet.plannedAmount,
                currency: 'BNB',
              });
              
              if (response.success && response.data) {
                const fundingResult = response.data.fundedWallets[0];
                transaction.status = fundingResult.success ? 'confirmed' : 'failed';
                transaction.txHash = fundingResult.txHash;
                if (!fundingResult.success) {
                  transaction.error = 'Funding failed';
                }
              } else {
                transaction.status = 'failed';
                transaction.error = response.error || 'API call failed';
              }
              
              // Update transaction status
              set(state => ({
                currentOperation: state.currentOperation ? {
                  ...state.currentOperation,
                  transactions: state.currentOperation.transactions.map(tx =>
                    tx.id === txId ? transaction : tx
                  ),
                } : null,
              }));
              
              // Update wallet balance if successful
              if (transaction.status === 'confirmed') {
                const walletStore = useWalletStore.getState();
                walletStore.updateWalletBalance(wallet.address, wallet.finalBalance);
              }
              
            } catch (error) {
              console.error(`Failed to fund wallet ${wallet.address}:`, error);
              const failedTx = transactions.find(tx => tx.walletAddress === wallet.address);
              if (failedTx) {
                failedTx.status = 'failed';
                failedTx.error = error instanceof Error ? error.message : 'Transaction failed';
              }
            }
          }
          
          // Complete operation
          const completedOperation = {
            ...updatedOperation,
            status: 'completed' as OperationStatus,
            completedAt: new Date().toISOString(),
            transactions,
          };
          
          set(state => ({
            currentOperation: completedOperation,
            operationHistory: state.operationHistory.map(op => 
              op.id === operationId ? completedOperation : op
            ),
            isExecuting: false,
          }));
          
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Funding operation failed';
          
          set(state => ({
            error: errorMessage,
            isExecuting: false,
            currentOperation: state.currentOperation ? {
              ...state.currentOperation,
              status: 'failed',
              error: errorMessage,
              completedAt: new Date().toISOString(),
            } : null,
          }));
          
          throw error;
        }
      },

      // Cancel operation
      cancelOperation: (operationId) => {
        set(state => ({
          currentOperation: state.currentOperation?.id === operationId ? null : state.currentOperation,
          operationHistory: state.operationHistory.map(op =>
            op.id === operationId ? { ...op, status: 'cancelled' as OperationStatus } : op
          ),
          isExecuting: false,
        }));
      },

      // Update preferences
      updatePreferences: (updates) => {
        set(state => ({
          preferences: { ...state.preferences, ...updates },
        }));
      },

      // Clear error
      clearError: () => {
        set({ error: null });
      },

      // Clear history
      clearHistory: () => {
        set({ operationHistory: [], currentOperation: null });
      },

      // Distribution method implementations
      calculateEqualDistribution: (totalAmount, wallets) => {
        return totalAmount / wallets.length;
      },

      calculateWeightedDistribution: (totalAmount, wallets) => {
        const state = get();
        const multipliers = state.preferences.customRoleMultipliers;
        
        // Calculate total weight
        const totalWeight = wallets.reduce((sum, wallet) => sum + multipliers[wallet.role], 0);
        
        // Calculate amounts based on weights
        const amounts: Record<string, number> = {};
        wallets.forEach(wallet => {
          const weight = multipliers[wallet.role];
          amounts[wallet.id] = (weight / totalWeight) * totalAmount;
        });
        
        return amounts;
      },

      calculateSmartDistribution: (totalAmount, wallets, threshold = 0.01) => {
        // Only fund wallets below threshold
        const walletsNeedingFunding = wallets.filter(w => w.balance < threshold);
        
        if (walletsNeedingFunding.length === 0) {
          return {};
        }
        
        // Calculate equal distribution among wallets needing funding
        const equalAmount = totalAmount / walletsNeedingFunding.length;
        const amounts: Record<string, number> = {};
        
        walletsNeedingFunding.forEach(wallet => {
          amounts[wallet.id] = equalAmount;
        });
        
        return amounts;
      },

      // Estimate gas cost
      estimateGasCost: (transactionCount) => {
        const state = get();
        const baseGasPerTx = 21000; // Basic transfer gas limit
        return transactionCount * baseGasPerTx * state.preferences.gasLimitMultiplier;
      },

      // Validate distribution with enhanced checks
      validateDistribution: (plan) => {
        const errors: string[] = [];
        
        // Check for negative amounts (stricter than zero check)
        const negativeAmounts = plan.filter(p => p.plannedAmount < 0);
        if (negativeAmounts.length > 0) {
          errors.push(`${negativeAmounts.length} wallets have negative funding amounts`);
        }
        
        // Check for zero amounts in funding wallets
        const zeroAmounts = plan.filter(p => p.requiresFunding && p.plannedAmount <= 0);
        if (zeroAmounts.length > 0) {
          errors.push(`${zeroAmounts.length} wallets marked for funding have zero amounts`);
        }
        
        // Check total amount consistency
        const totalPlanned = plan.reduce((sum, p) => sum + p.plannedAmount, 0);
        if (totalPlanned <= 0) {
          errors.push('Total planned amount must be greater than zero');
        }
        
        // Add minimum/maximum amount limits
        const minAmountPerWallet = 0.0001; // 0.0001 BNB minimum per wallet
        const maxAmountPerWallet = 100; // 100 BNB maximum per wallet
        const maxTotalAmount = 1000; // 1000 BNB total maximum
        
        const tooSmallAmounts = plan.filter(p => p.requiresFunding && p.plannedAmount < minAmountPerWallet);
        if (tooSmallAmounts.length > 0) {
          errors.push(`${tooSmallAmounts.length} wallets have amounts below minimum (${minAmountPerWallet} BNB)`);
        }
        
        const tooLargeAmounts = plan.filter(p => p.plannedAmount > maxAmountPerWallet);
        if (tooLargeAmounts.length > 0) {
          errors.push(`${tooLargeAmounts.length} wallets exceed maximum amount (${maxAmountPerWallet} BNB)`);
        }
        
        if (totalPlanned > maxTotalAmount) {
          errors.push(`Total amount (${totalPlanned.toFixed(4)} BNB) exceeds maximum allowed (${maxTotalAmount} BNB)`);
        }
        
        // Check for duplicate addresses
        const addresses = plan.map(p => p.address);
        const uniqueAddresses = new Set(addresses);
        if (addresses.length !== uniqueAddresses.size) {
          errors.push('Duplicate wallet addresses detected');
        }
        
        // Validate individual wallet balances won't overflow
        const overflowRisk = plan.filter(p => p.finalBalance > 1000); // Warn if final balance > 1000 BNB
        if (overflowRisk.length > 0) {
          errors.push(`${overflowRisk.length} wallets will have very high final balances (>1000 BNB) - review for potential errors`);
        }
        
        return {
          isValid: errors.length === 0,
          errors,
        };
      },
    }),
    {
      name: 'funding-store',
      partialize: (state) => ({
        operationHistory: state.operationHistory.slice(0, 10), // Persist only last 10 operations
        preferences: state.preferences,
      }),
    }
  )
);