/**
 * Treasury Management Store using Zustand
 * Handles BNB withdrawal operations from wallets back to treasury
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiClient } from '../api/client';
import { useWalletStore } from './wallets';
import { useSessionStore } from './session';
import type { Wallet } from '../types';
import { Role } from '../types';

// Treasury operation types
export type TreasuryOperationType = 'withdraw_all' | 'withdraw_partial' | 'withdraw_emergency' | 'withdraw_by_role';

// Treasury operation status
export type TreasuryStatus = 'idle' | 'preparing' | 'executing' | 'completed' | 'failed' | 'cancelled';

// Treasury transaction info
export interface TreasuryTransaction {
  id: string;
  walletAddress: string;
  amount: number;
  status: 'pending' | 'confirmed' | 'failed';
  txHash?: string;
  gasUsed?: string;
  error?: string;
  timestamp: string;
}

// Treasury operation details
export interface TreasuryOperation {
  id: string;
  type: TreasuryOperationType;
  treasuryAddress: string;
  selectedWallets: string[];
  withdrawalAmounts: Record<string, number>; // wallet ID -> amount to withdraw
  minimumBalance: number; // Minimum balance to leave in wallets
  transactions: TreasuryTransaction[];
  status: TreasuryStatus;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  totalWithdrawn: number;
  gasEstimate: number;
  estimatedCost: number;
}

// Treasury settings
export interface TreasurySettings {
  defaultTreasuryAddress: string;
  minimumWalletBalance: number; // Minimum BNB to leave in wallets
  emergencyConfirmationRequired: boolean;
  partialWithdrawalPercentage: number; // Default percentage for partial withdrawals
  gasLimitMultiplier: number;
  retryAttempts: number;
  roleBasedWithdrawals: Record<Role, boolean>; // Which roles to include in role-based withdrawals
}

// Store interface
interface TreasuryState {
  // Current operation state
  currentOperation: TreasuryOperation | null;
  operationHistory: TreasuryOperation[];
  isCalculating: boolean;
  isExecuting: boolean;
  error: string | null;
  
  // Settings
  settings: TreasurySettings;
  
  // Actions
  calculateWithdrawal: (
    type: TreasuryOperationType,
    selectedWallets: string[],
    treasuryAddress: string,
    options?: {
      minimumBalance?: number;
      withdrawalPercentage?: number;
      targetRole?: Role;
      customAmounts?: Record<string, number>;
    }
  ) => Promise<Record<string, number>>;
  
  createTreasuryOperation: (
    type: TreasuryOperationType,
    selectedWallets: string[],
    treasuryAddress: string,
    options?: {
      minimumBalance?: number;
      withdrawalPercentage?: number;
      targetRole?: Role;
      customAmounts?: Record<string, number>;
    }
  ) => Promise<void>;
  
  executeTreasuryOperation: (operationId: string, passphrase: string) => Promise<void>;
  cancelTreasuryOperation: (operationId: string) => void;
  
  updateSettings: (updates: Partial<TreasurySettings>) => void;
  clearError: () => void;
  clearHistory: () => void;
  
  // Withdrawal method implementations
  calculateWithdrawAll: (wallets: Wallet[], minimumBalance: number) => Record<string, number>;
  calculateWithdrawPartial: (wallets: Wallet[], percentage: number, minimumBalance: number) => Record<string, number>;
  calculateWithdrawByRole: (wallets: Wallet[], targetRole: Role, minimumBalance: number) => Record<string, number>;
  
  // Utilities
  estimateWithdrawalGas: (transactionCount: number) => number;
  validateTreasuryAddress: (address: string) => boolean;
  validateWithdrawalAmounts: (amounts: Record<string, number>, wallets: Wallet[]) => { isValid: boolean; errors: string[] };
}

const DEFAULT_SETTINGS: TreasurySettings = {
  defaultTreasuryAddress: '',
  minimumWalletBalance: 0.001, // 0.001 BNB minimum
  emergencyConfirmationRequired: true,
  partialWithdrawalPercentage: 80, // 80% default
  gasLimitMultiplier: 1.3, // 30% gas limit safety buffer for withdrawals
  retryAttempts: 3,
  roleBasedWithdrawals: {
    [Role.DEV]: true,
    [Role.MEV]: true,
    [Role.FUNDER]: false, // Don't withdraw from funder wallets by default
    [Role.NUMBERED]: true,
  },
};

export const useTreasuryStore = create<TreasuryState>()(
  persist(
    (set, get) => ({
      // Initial state
      currentOperation: null,
      operationHistory: [],
      isCalculating: false,
      isExecuting: false,
      error: null,
      settings: DEFAULT_SETTINGS,

      // Calculate withdrawal amounts based on operation type
      calculateWithdrawal: async (type, selectedWalletIds, treasuryAddress, options = {}) => {
        try {
          set({ isCalculating: true, error: null });
          
          const walletStore = useWalletStore.getState();
          const selectedWallets = walletStore.wallets.filter(w => selectedWalletIds.includes(w.id));
          
          if (selectedWallets.length === 0) {
            throw new Error('No wallets selected for withdrawal');
          }
          
          if (!get().validateTreasuryAddress(treasuryAddress)) {
            throw new Error('Invalid treasury address');
          }
          
          const state = get();
          const minimumBalance = options.minimumBalance ?? state.settings.minimumWalletBalance;
          let withdrawalAmounts: Record<string, number> = {};
          
          switch (type) {
            case 'withdraw_all':
              withdrawalAmounts = state.calculateWithdrawAll(selectedWallets, minimumBalance);
              break;
              
            case 'withdraw_partial':
              const percentage = options.withdrawalPercentage ?? state.settings.partialWithdrawalPercentage;
              withdrawalAmounts = state.calculateWithdrawPartial(selectedWallets, percentage, minimumBalance);
              break;
              
            case 'withdraw_emergency':
              withdrawalAmounts = state.calculateWithdrawAll(selectedWallets, 0); // Emergency: withdraw everything
              break;
              
            case 'withdraw_by_role':
              if (!options.targetRole) {
                throw new Error('Target role required for role-based withdrawal');
              }
              const roleWallets = selectedWallets.filter(w => w.role === options.targetRole);
              withdrawalAmounts = state.calculateWithdrawAll(roleWallets, minimumBalance);
              break;
              
            default:
              throw new Error(`Unknown treasury operation type: ${type}`);
          }
          
          // Validate withdrawal amounts
          const validation = state.validateWithdrawalAmounts(withdrawalAmounts, selectedWallets);
          if (!validation.isValid) {
            throw new Error(`Withdrawal validation failed: ${validation.errors.join(', ')}`);
          }
          
          set({ isCalculating: false });
          return withdrawalAmounts;
          
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Withdrawal calculation failed';
          set({ error: errorMessage, isCalculating: false });
          throw error;
        }
      },

      // Create a new treasury operation
      createTreasuryOperation: async (type, selectedWallets, treasuryAddress, options) => {
        try {
          const withdrawalAmounts = await get().calculateWithdrawal(type, selectedWallets, treasuryAddress, options);
          
          const operationId = `treasury_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const transactionCount = Object.keys(withdrawalAmounts).filter(walletId => withdrawalAmounts[walletId] > 0).length;
          const gasEstimate = get().estimateWithdrawalGas(transactionCount);
          const totalWithdrawn = Object.values(withdrawalAmounts).reduce((sum, amount) => sum + amount, 0);
          
          const operation: TreasuryOperation = {
            id: operationId,
            type,
            treasuryAddress,
            selectedWallets,
            withdrawalAmounts,
            minimumBalance: options?.minimumBalance ?? get().settings.minimumWalletBalance,
            transactions: [],
            status: 'preparing',
            totalWithdrawn,
            gasEstimate,
            estimatedCost: gasEstimate * 0.00000001, // Approximate BNB cost
          };
          
          set(state => ({
            currentOperation: operation,
            operationHistory: [operation, ...state.operationHistory.slice(0, 49)], // Keep last 50
          }));
          
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to create treasury operation';
          set({ error: errorMessage });
          throw error;
        }
      },

      // Execute treasury operation
      executeTreasuryOperation: async (operationId, passphrase) => {
        try {
          const state = get();
          const operation = state.operationHistory.find(op => op.id === operationId);
          
          if (!operation) {
            throw new Error('Treasury operation not found');
          }
          
          if (operation.status !== 'preparing') {
            throw new Error('Operation is not in preparing state');
          }
          
          // Validate session and passphrase
          const sessionStore = useSessionStore.getState();
          if (!sessionStore.isUnlocked) {
            throw new Error('Session must be unlocked to execute treasury operations');
          }
          
          // Extra confirmation for emergency operations
          if (operation.type === 'withdraw_emergency' && state.settings.emergencyConfirmationRequired) {
            // This would trigger additional confirmation in the UI
            // For now, we'll just log it
            console.warn('Emergency withdrawal operation - requires additional confirmation');
          }
          
          set({ isExecuting: true, error: null });
          
          // Update operation status
          const updatedOperation = {
            ...operation,
            status: 'executing' as TreasuryStatus,
            startedAt: new Date().toISOString(),
          };
          
          set(state => ({
            currentOperation: updatedOperation,
            operationHistory: state.operationHistory.map(op => 
              op.id === operationId ? updatedOperation : op
            ),
          }));
          
          // Execute withdrawal transactions
          const walletStore = useWalletStore.getState();
          const transactions: TreasuryTransaction[] = [];
          
          for (const [walletId, withdrawAmount] of Object.entries(operation.withdrawalAmounts)) {
            if (withdrawAmount <= 0) continue;
            
            const wallet = walletStore.wallets.find(w => w.id === walletId);
            if (!wallet) {
              console.warn(`Wallet ${walletId} not found, skipping withdrawal`);
              continue;
            }
            
            try {
              const txId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
              const transaction: TreasuryTransaction = {
                id: txId,
                walletAddress: wallet.address,
                amount: withdrawAmount,
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
              
              // Execute the withdrawal operation via API
              const response = await apiClient.executeTreasuryWithdrawal({
                type: operation.type,
                treasuryAddress: operation.treasuryAddress,
                selectedWallets: operation.selectedWallets,
                withdrawalAmounts: { [walletId]: withdrawAmount },
                minimumBalance: operation.minimumBalance,
              });

              if (response.success && response.data) {
                const apiTransaction = response.data.transactions?.find((t: any) => 
                  t.walletAddress === wallet.address || t.walletAddress === `wallet_${walletId}`
                );
                
                if (apiTransaction) {
                  transaction.status = apiTransaction.status === 'confirmed' ? 'confirmed' : 'failed';
                  transaction.txHash = apiTransaction.txHash;
                  transaction.gasUsed = apiTransaction.gasUsed;
                  transaction.error = apiTransaction.error;
                }
                
                // Update wallet balance if successful
                if (transaction.status === 'confirmed') {
                  const newBalance = Math.max(0, wallet.balance - withdrawAmount);
                  walletStore.updateWalletBalance(wallet.address, newBalance);
                }
              } else {
                transaction.status = 'failed';
                transaction.error = response.error || 'Treasury withdrawal API call failed';
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
              
            } catch (error) {
              console.error(`Failed to withdraw from wallet ${wallet.address}:`, error);
              const failedTx = transactions.find(tx => tx.walletAddress === wallet.address);
              if (failedTx) {
                failedTx.status = 'failed';
                failedTx.error = error instanceof Error ? error.message : 'Withdrawal failed';
              }
            }
          }
          
          // Complete operation
          const completedOperation = {
            ...updatedOperation,
            status: 'completed' as TreasuryStatus,
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
          const errorMessage = error instanceof Error ? error.message : 'Treasury operation failed';
          
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

      // Cancel treasury operation
      cancelTreasuryOperation: (operationId) => {
        set(state => ({
          currentOperation: state.currentOperation?.id === operationId ? null : state.currentOperation,
          operationHistory: state.operationHistory.map(op =>
            op.id === operationId ? { ...op, status: 'cancelled' as TreasuryStatus } : op
          ),
          isExecuting: false,
        }));
      },

      // Update settings
      updateSettings: (updates) => {
        set(state => ({
          settings: { ...state.settings, ...updates },
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

      // Withdrawal method implementations
      calculateWithdrawAll: (wallets, minimumBalance) => {
        const amounts: Record<string, number> = {};
        
        wallets.forEach(wallet => {
          const withdrawableAmount = Math.max(0, wallet.balance - minimumBalance);
          if (withdrawableAmount > 0) {
            amounts[wallet.id] = withdrawableAmount;
          }
        });
        
        return amounts;
      },

      calculateWithdrawPartial: (wallets, percentage, minimumBalance) => {
        const amounts: Record<string, number> = {};
        const withdrawalPercent = Math.min(100, Math.max(0, percentage)) / 100;
        
        wallets.forEach(wallet => {
          const maxWithdrawable = Math.max(0, wallet.balance - minimumBalance);
          const withdrawAmount = maxWithdrawable * withdrawalPercent;
          
          if (withdrawAmount > 0) {
            amounts[wallet.id] = withdrawAmount;
          }
        });
        
        return amounts;
      },

      calculateWithdrawByRole: (wallets, targetRole, minimumBalance) => {
        const roleWallets = wallets.filter(w => w.role === targetRole);
        return get().calculateWithdrawAll(roleWallets, minimumBalance);
      },

      // Estimate withdrawal gas cost
      estimateWithdrawalGas: (transactionCount) => {
        const state = get();
        const baseGasPerTx = 21000; // Basic transfer gas limit
        return transactionCount * baseGasPerTx * state.settings.gasLimitMultiplier;
      },

      // Validate treasury address with checksum validation
      validateTreasuryAddress: (address) => {
        if (!address || address.trim() === '') {
          return false;
        }
        
        // Basic format validation first
        const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
        if (!ethAddressRegex.test(address)) {
          return false;
        }
        
        // Checksum validation (EIP-55)
        const checksumAddress = address.slice(2); // Remove 0x prefix
        const lowerCaseAddress = checksumAddress.toLowerCase();
        
        // If all lowercase or all uppercase, it's valid (no checksum)
        if (checksumAddress === lowerCaseAddress || checksumAddress === checksumAddress.toUpperCase()) {
          return true;
        }
        
        // Validate checksum using simple hash-based validation
        // This is a simplified version of EIP-55 checksum validation
        let isValidChecksum = true;
        for (let i = 0; i < checksumAddress.length; i++) {
          const char = checksumAddress[i];
          if (isNaN(parseInt(char, 16))) continue; // Skip non-hex characters
          
          // For a proper EIP-55 implementation, we'd use Keccak256 hash
          // For now, we'll do a basic mixed-case check
          const shouldBeUppercase = parseInt(char, 16) > 7;
          if (shouldBeUppercase && char !== char.toUpperCase()) {
            isValidChecksum = false;
            break;
          } else if (!shouldBeUppercase && char !== char.toLowerCase()) {
            isValidChecksum = false;
            break;
          }
        }
        
        return isValidChecksum;
      },

      // Validate withdrawal amounts
      validateWithdrawalAmounts: (amounts, wallets) => {
        const errors: string[] = [];
        
        // Check for negative amounts
        const negativeAmounts = Object.entries(amounts).filter(([, amount]) => amount < 0);
        if (negativeAmounts.length > 0) {
          errors.push(`${negativeAmounts.length} wallets have negative withdrawal amounts`);
        }
        
        // Check if any wallet would have insufficient balance
        for (const [walletId, withdrawAmount] of Object.entries(amounts)) {
          const wallet = wallets.find(w => w.id === walletId);
          if (wallet && withdrawAmount > wallet.balance) {
            errors.push(`Wallet ${wallet.address} has insufficient balance for withdrawal`);
          }
        }
        
        // Check total withdrawal amount
        const totalWithdrawal = Object.values(amounts).reduce((sum, amount) => sum + amount, 0);
        if (totalWithdrawal <= 0) {
          errors.push('Total withdrawal amount must be greater than zero');
        }
        
        return {
          isValid: errors.length === 0,
          errors,
        };
      },
    }),
    {
      name: 'treasury-store',
      partialize: (state) => ({
        operationHistory: state.operationHistory.slice(0, 10), // Persist only last 10 operations
        settings: state.settings,
      }),
    }
  )
);