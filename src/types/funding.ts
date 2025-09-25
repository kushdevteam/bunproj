/**
 * TypeScript interfaces for stealth wallet funding operations
 * Provides type safety for bulk wallet funding with stealth algorithms
 */

import { Role } from './index';

// Stealth operation status types
export type StealthOperationStatus = 
  | 'idle' 
  | 'preparing' 
  | 'executing' 
  | 'paused' 
  | 'completed' 
  | 'failed' 
  | 'cancelled';

// Stealth funding transaction status
export type StealthTransactionStatus = 
  | 'pending' 
  | 'sending' 
  | 'confirmed' 
  | 'failed' 
  | 'retrying';

// Stealth pattern types for transaction randomization
export type StealthPattern = 
  | 'uniform' // Equal delays between all transactions
  | 'random' // Completely random delays within range
  | 'burst' // Send in random bursts with longer pauses
  | 'gradient' // Gradually increasing/decreasing delays
  | 'natural'; // Human-like timing patterns

// Master wallet configuration for funding operations
export interface MasterWallet {
  id: string;
  address: string;
  balance: number;
  privateKey?: string; // Only when decrypted for operations
  alias?: string; // User-friendly name
}

// Stealth configuration for randomization
export interface StealthConfig {
  // Amount randomization
  minAmount: number; // Minimum BNB per wallet (e.g., 0.001)
  maxAmount: number; // Maximum BNB per wallet (e.g., 0.005)
  useFixedAmount: boolean; // If true, use fixedAmount instead of range
  fixedAmount?: number; // Fixed amount per wallet
  
  // Timing randomization
  minDelay: number; // Minimum delay between transactions (seconds)
  maxDelay: number; // Maximum delay between transactions (seconds)
  pattern: StealthPattern; // Timing pattern to use
  
  // Advanced stealth options
  randomizeOrder: boolean; // Randomize wallet funding order
  batchSize: number; // Number of transactions per batch (0 = no batching)
  batchDelay: number; // Delay between batches (seconds)
  useVariableGas: boolean; // Randomize gas prices slightly
  gasVariancePercent: number; // Gas price variance (±%)
  
  // Anti-detection features
  simulateHumanBehavior: boolean; // Add human-like irregularities
  varyTransactionSizes: boolean; // Slightly vary transaction amounts
  amountVariancePercent: number; // Amount variance (±%)
}

// Individual stealth transaction details
export interface StealthTransaction {
  id: string;
  walletId: string;
  walletAddress: string;
  plannedAmount: number; // Original planned amount
  actualAmount: number; // Amount after randomization/variance
  status: StealthTransactionStatus;
  txHash?: string;
  gasUsed?: string;
  gasPrice?: string;
  error?: string;
  retryCount: number;
  maxRetries: number;
  scheduledAt: Date; // When transaction is scheduled to execute
  sentAt?: Date;
  confirmedAt?: Date;
  executionDelay: number; // Actual delay used (seconds)
}

// Stealth funding operation plan
export interface StealthFundingPlan {
  id: string;
  masterWallet: MasterWallet;
  targetWallets: string[]; // Wallet IDs to fund
  totalAmount: number; // Total BNB to distribute
  estimatedDuration: number; // Expected operation duration (seconds)
  transactionCount: number; // Number of transactions
  config: StealthConfig;
  transactions: StealthTransaction[];
  createdAt: Date;
}

// Live operation tracking
export interface StealthFundingOperation {
  id: string;
  plan: StealthFundingPlan;
  status: StealthOperationStatus;
  progress: {
    completed: number; // Number of completed transactions
    total: number; // Total number of transactions
    percentage: number; // Completion percentage
    estimatedTimeRemaining: number; // Seconds remaining
    averageTransactionTime: number; // Average time per transaction
  };
  statistics: {
    totalSent: number; // Total BNB sent so far
    successfulTransactions: number;
    failedTransactions: number;
    retryTransactions: number;
    gasUsed: number; // Total gas consumed
    averageGasPrice: number;
  };
  startedAt?: Date;
  pausedAt?: Date;
  completedAt?: Date;
  error?: string;
  currentBatch?: number; // Current batch being processed
  nextTransactionAt?: Date; // When next transaction will execute
}

// Stealth funding result summary
export interface StealthFundingResult {
  operationId: string;
  success: boolean;
  totalWalletsFunded: number;
  totalAmountDistributed: number;
  totalGasUsed: number;
  operationDuration: number; // Total time in seconds
  transactions: StealthTransaction[];
  summary: {
    successRate: number; // Percentage of successful transactions
    averageAmount: number; // Average amount per transaction
    medianDelay: number; // Median delay between transactions
    gasEfficiency: number; // Average gas per transaction
  };
  errors: string[]; // Any errors encountered
  createdAt: Date;
  completedAt: Date;
}

// Funding preferences for stealth operations
export interface StealthFundingPreferences {
  // Default configurations
  defaultStealthConfig: StealthConfig;
  preferredMasterWallet?: string; // Default master wallet ID
  
  // Safety limits
  maxTotalAmount: number; // Maximum total BNB per operation
  maxWalletsPerOperation: number; // Maximum wallets per operation
  maxOperationDuration: number; // Maximum operation time (seconds)
  
  // Auto-approval settings
  autoApprovalThreshold: number; // Auto-approve operations below this amount
  requireConfirmationForLargeOps: boolean;
  
  // Monitoring and alerts
  enableProgressNotifications: boolean;
  notifyOnCompletion: boolean;
  notifyOnErrors: boolean;
  
  // Advanced settings
  defaultRetryAttempts: number;
  pauseOnConsecutiveFailures: number; // Pause if this many consecutive failures
  resumeOperationsOnStartup: boolean; // Resume paused operations on app start
}

// Master wallet selection criteria
export interface MasterWalletCriteria {
  minimumBalance: number; // Minimum BNB required
  excludeWallets: string[]; // Wallet IDs to exclude
  preferredRole?: Role; // Preferred wallet role
  requirePassphraseAccess: boolean; // Only include wallets with accessible private keys
}

// Stealth operation validation result
export interface StealthValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  recommendations: string[];
  estimatedCosts: {
    totalAmount: number;
    estimatedGas: number;
    estimatedDuration: number;
  };
}

// Real-time operation events
export type StealthOperationEvent = 
  | { type: 'operation_started'; operationId: string; timestamp: Date }
  | { type: 'transaction_sent'; operationId: string; transactionId: string; timestamp: Date }
  | { type: 'transaction_confirmed'; operationId: string; transactionId: string; txHash: string; timestamp: Date }
  | { type: 'transaction_failed'; operationId: string; transactionId: string; error: string; timestamp: Date }
  | { type: 'batch_completed'; operationId: string; batchNumber: number; timestamp: Date }
  | { type: 'operation_paused'; operationId: string; reason: string; timestamp: Date }
  | { type: 'operation_resumed'; operationId: string; timestamp: Date }
  | { type: 'operation_completed'; operationId: string; result: StealthFundingResult; timestamp: Date }
  | { type: 'operation_failed'; operationId: string; error: string; timestamp: Date };

// Store state interface
export interface StealthFundingStore {
  // Current operation state
  currentOperation: StealthFundingOperation | null;
  operationHistory: StealthFundingResult[];
  isExecuting: boolean;
  isPaused: boolean;
  error: string | null;
  
  // Configuration
  preferences: StealthFundingPreferences;
  availableMasterWallets: MasterWallet[];
  
  // Real-time events
  recentEvents: StealthOperationEvent[];
  
  // Actions
  createStealthPlan: (
    masterWalletId: string,
    targetWalletIds: string[],
    totalAmount: number,
    config: StealthConfig
  ) => Promise<StealthFundingPlan>;
  
  validatePlan: (plan: StealthFundingPlan) => StealthValidationResult;
  
  executeStealthOperation: (
    planId: string,
    passphrase: string
  ) => Promise<void>;
  
  pauseOperation: (operationId: string) => void;
  resumeOperation: (operationId: string) => void;
  cancelOperation: (operationId: string) => void;
  
  // Master wallet management
  loadAvailableMasterWallets: () => Promise<void>;
  selectMasterWallet: (criteria: MasterWalletCriteria) => MasterWallet[];
  
  // Configuration management
  updatePreferences: (updates: Partial<StealthFundingPreferences>) => void;
  resetToDefaults: () => void;
  
  // Utilities
  estimateOperationCost: (plan: StealthFundingPlan) => number;
  generateStealthConfig: (preset: 'conservative' | 'moderate' | 'aggressive') => StealthConfig;
  
  // Event handling
  addEvent: (event: StealthOperationEvent) => void;
  clearEvents: () => void;
  
  // Error handling
  clearError: () => void;
  handleTransactionError: (transactionId: string, error: string) => void;
}

// Preset stealth configurations
export const STEALTH_PRESETS: Record<string, StealthConfig> = {
  conservative: {
    minAmount: 0.001,
    maxAmount: 0.002,
    useFixedAmount: false,
    minDelay: 5,
    maxDelay: 15,
    pattern: 'natural',
    randomizeOrder: true,
    batchSize: 5,
    batchDelay: 30,
    useVariableGas: true,
    gasVariancePercent: 5,
    simulateHumanBehavior: true,
    varyTransactionSizes: true,
    amountVariancePercent: 3,
  },
  moderate: {
    minAmount: 0.001,
    maxAmount: 0.005,
    useFixedAmount: false,
    minDelay: 2,
    maxDelay: 8,
    pattern: 'random',
    randomizeOrder: true,
    batchSize: 10,
    batchDelay: 15,
    useVariableGas: true,
    gasVariancePercent: 8,
    simulateHumanBehavior: true,
    varyTransactionSizes: true,
    amountVariancePercent: 5,
  },
  aggressive: {
    minAmount: 0.001,
    maxAmount: 0.01,
    useFixedAmount: false,
    minDelay: 1,
    maxDelay: 3,
    pattern: 'burst',
    randomizeOrder: true,
    batchSize: 20,
    batchDelay: 5,
    useVariableGas: true,
    gasVariancePercent: 10,
    simulateHumanBehavior: false,
    varyTransactionSizes: true,
    amountVariancePercent: 8,
  },
};

// Default preferences
export const DEFAULT_STEALTH_PREFERENCES: StealthFundingPreferences = {
  defaultStealthConfig: STEALTH_PRESETS.moderate,
  maxTotalAmount: 100, // 100 BNB max per operation
  maxWalletsPerOperation: 1000,
  maxOperationDuration: 3600, // 1 hour max
  autoApprovalThreshold: 5, // 5 BNB auto-approval
  requireConfirmationForLargeOps: true,
  enableProgressNotifications: true,
  notifyOnCompletion: true,
  notifyOnErrors: true,
  defaultRetryAttempts: 3,
  pauseOnConsecutiveFailures: 5,
  resumeOperationsOnStartup: false,
};