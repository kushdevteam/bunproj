/**
 * Bundle Execution State Management Store
 * Handles execution progress, control state, and coordination between components
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { EnhancedBundleConfig } from '../types/bundle-config';
import type { Wallet } from '../types';

export type ExecutionStatus = 'idle' | 'preparing' | 'executing' | 'paused' | 'completed' | 'failed' | 'aborted' | 'stopping';
export type ExecutionPhase = 'validation' | 'planning' | 'execution' | 'completion';

export interface ExecutionStatistics {
  totalTransactions: number;
  successfulTransactions: number;
  failedTransactions: number;
  pendingTransactions: number;
  totalGasUsed: string;
  totalCost: string;
  averageGasPrice: string;
  averageGasUsed: string;
  executionTimeMs: number;
  estimatedCompletionTime?: Date;
  successRate: number;
}

export interface ExecutionProgress {
  currentPhase: ExecutionPhase;
  phaseProgress: number; // 0-100
  overallProgress: number; // 0-100
  completedTransactions: number;
  totalTransactions: number;
  currentBatch: number;
  totalBatches: number;
  walletsProcessed: number;
  totalWallets: number;
  startTime?: string;
}

export interface ExecutionSafety {
  emergencyStopTriggered: boolean;
  spendingLimitExceeded: boolean;
  failureRateExceeded: boolean;
  timeoutExceeded: boolean;
  networkIssuesDetected: boolean;
  userAborted: boolean;
}

export interface ExecutionSession {
  id: string;
  bundleConfig: EnhancedBundleConfig;
  selectedWallets: string[];
  startedAt?: Date;
  completedAt?: Date;
  passphraseHash?: string;
  isAuthenticated: boolean;
  maxSpendLimit: number;
  currentSpent: number;
}

export interface ExecutionControl {
  canStart: boolean;
  canPause: boolean;
  canResume: boolean;
  canStop: boolean;
  canAbort: boolean;
  requiresPassphrase: boolean;
}

interface ExecutionState {
  // Current execution session
  currentSession: ExecutionSession | null;
  status: ExecutionStatus;
  progress: ExecutionProgress;
  statistics: ExecutionStatistics;
  safety: ExecutionSafety;
  control: ExecutionControl;
  
  // Error handling
  error: string | null;
  warnings: string[];
  
  // Real-time data
  lastUpdate: Date | null;
  isRealTimeEnabled: boolean;
  refreshInterval: number;
  
  // Actions
  initializeExecution: (config: EnhancedBundleConfig, wallets: string[], passphrase: string) => Promise<boolean>;
  startExecution: () => Promise<boolean>;
  pauseExecution: () => Promise<boolean>;
  resumeExecution: () => Promise<boolean>;
  stopExecution: () => Promise<boolean>;
  abortExecution: () => Promise<boolean>;
  
  // Progress updates
  updateProgress: (progress: Partial<ExecutionProgress>) => void;
  updateStatistics: (stats: Partial<ExecutionStatistics>) => void;
  updatePhase: (phase: ExecutionPhase, progress?: number) => void;
  
  // Safety and control
  triggerEmergencyStop: (reason: string) => void;
  checkSafetyLimits: () => boolean;
  authenticateSession: (passphrase: string) => Promise<boolean>;
  
  // Real-time control
  enableRealTime: () => void;
  disableRealTime: () => void;
  setRefreshInterval: (intervalMs: number) => void;
  
  // Cleanup
  resetExecution: () => void;
  clearError: () => void;
  clearWarnings: () => void;
}

const initialProgress: ExecutionProgress = {
  currentPhase: 'validation',
  phaseProgress: 0,
  overallProgress: 0,
  completedTransactions: 0,
  totalTransactions: 0,
  currentBatch: 0,
  totalBatches: 0,
  walletsProcessed: 0,
  totalWallets: 0,
};

const initialStatistics: ExecutionStatistics = {
  totalTransactions: 0,
  successfulTransactions: 0,
  failedTransactions: 0,
  pendingTransactions: 0,
  totalGasUsed: '0',
  totalCost: '0',
  averageGasPrice: '0',
  averageGasUsed: '0',
  executionTimeMs: 0,
  successRate: 0,
};

const initialSafety: ExecutionSafety = {
  emergencyStopTriggered: false,
  spendingLimitExceeded: false,
  failureRateExceeded: false,
  timeoutExceeded: false,
  networkIssuesDetected: false,
  userAborted: false,
};

const initialControl: ExecutionControl = {
  canStart: false,
  canPause: false,
  canResume: false,
  canStop: false,
  canAbort: false,
  requiresPassphrase: true,
};

export const useExecutionStore = create<ExecutionState>()(
  persist(
    (set, get) => ({
      // Initial state
      currentSession: null,
      status: 'idle',
      progress: { ...initialProgress },
      statistics: { ...initialStatistics },
      safety: { ...initialSafety },
      control: { ...initialControl },
      error: null,
      warnings: [],
      lastUpdate: null,
      isRealTimeEnabled: true,
      refreshInterval: 1000, // 1 second

      // Initialize execution session
      initializeExecution: async (config: EnhancedBundleConfig, wallets: string[], passphrase: string) => {
        try {
          set({ error: null, warnings: [] });
          
          // Validate inputs
          if (!config || !wallets.length) {
            throw new Error('Invalid configuration or wallet selection');
          }
          
          if (!passphrase || passphrase.length < 8) {
            throw new Error('Valid passphrase required for execution');
          }
          
          // Calculate spending limits
          const maxSpendLimit = config.executionParams?.safetyFeatures?.maxTotalSpend || 5.0;
          const estimatedSpend = (config.purchaseAmount?.totalBnb || 0) * 1.1; // Add 10% buffer
          
          if (estimatedSpend > maxSpendLimit) {
            throw new Error(`Estimated spend (${estimatedSpend} BNB) exceeds safety limit (${maxSpendLimit} BNB)`);
          }
          
          // Create session
          const session: ExecutionSession = {
            id: `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            bundleConfig: config,
            selectedWallets: wallets,
            isAuthenticated: false,
            maxSpendLimit,
            currentSpent: 0,
          };
          
          // Update state
          set({
            currentSession: session,
            status: 'preparing',
            progress: {
              ...initialProgress,
              totalWallets: wallets.length,
            },
            statistics: { ...initialStatistics },
            safety: { ...initialSafety },
            control: {
              ...initialControl,
              canStart: false,
              canAbort: true,
              requiresPassphrase: true,
            },
            lastUpdate: new Date(),
          });
          
          return true;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to initialize execution';
          set({ error: errorMessage, status: 'failed' });
          return false;
        }
      },

      // Start execution
      startExecution: async () => {
        try {
          const state = get();
          
          if (!state.currentSession?.isAuthenticated) {
            throw new Error('Session must be authenticated before starting execution');
          }
          
          if (state.status !== 'preparing' && state.status !== 'paused') {
            throw new Error(`Cannot start execution from status: ${state.status}`);
          }
          
          set({
            status: 'executing',
            progress: {
              ...state.progress,
              currentPhase: 'execution',
            },
            control: {
              ...state.control,
              canStart: false,
              canPause: true,
              canStop: true,
              canAbort: true,
            },
            currentSession: {
              ...state.currentSession!,
              startedAt: state.currentSession!.startedAt || new Date(),
            },
            lastUpdate: new Date(),
          });
          
          return true;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to start execution';
          set({ error: errorMessage });
          return false;
        }
      },

      // Pause execution
      pauseExecution: async () => {
        try {
          const state = get();
          
          if (state.status !== 'executing') {
            throw new Error('Can only pause active execution');
          }
          
          set({
            status: 'paused',
            control: {
              ...state.control,
              canPause: false,
              canResume: true,
              canStop: true,
              canAbort: true,
            },
            lastUpdate: new Date(),
          });
          
          return true;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to pause execution';
          set({ error: errorMessage });
          return false;
        }
      },

      // Resume execution
      resumeExecution: async () => {
        try {
          const state = get();
          
          if (state.status !== 'paused') {
            throw new Error('Can only resume paused execution');
          }
          
          set({
            status: 'executing',
            control: {
              ...state.control,
              canResume: false,
              canPause: true,
              canStop: true,
              canAbort: true,
            },
            lastUpdate: new Date(),
          });
          
          return true;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to resume execution';
          set({ error: errorMessage });
          return false;
        }
      },

      // Stop execution
      stopExecution: async () => {
        try {
          const state = get();
          
          if (!['executing', 'paused'].includes(state.status)) {
            throw new Error('No active execution to stop');
          }
          
          set({
            status: 'completed',
            progress: {
              ...state.progress,
              currentPhase: 'completion',
              overallProgress: 100,
            },
            control: {
              ...initialControl,
              canStart: false,
            },
            currentSession: {
              ...state.currentSession!,
              completedAt: new Date(),
            },
            lastUpdate: new Date(),
          });
          
          return true;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to stop execution';
          set({ error: errorMessage });
          return false;
        }
      },

      // Abort execution
      abortExecution: async () => {
        try {
          const state = get();
          
          set({
            status: 'aborted',
            safety: {
              ...state.safety,
              userAborted: true,
            },
            control: {
              ...initialControl,
              canStart: false,
            },
            currentSession: {
              ...state.currentSession!,
              completedAt: new Date(),
            },
            lastUpdate: new Date(),
          });
          
          return true;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to abort execution';
          set({ error: errorMessage });
          return false;
        }
      },

      // Update progress
      updateProgress: (progress: Partial<ExecutionProgress>) => {
        set((state: ExecutionState) => ({
          ...state,
          progress: { ...state.progress, ...progress },
          lastUpdate: new Date(),
        }));
      },

      // Update statistics
      updateStatistics: (stats: Partial<ExecutionStatistics>) => {
        set((state: ExecutionState) => {
          const newStats = { ...state.statistics, ...stats };
          
          // Calculate success rate
          const total = newStats.successfulTransactions + newStats.failedTransactions;
          newStats.successRate = total > 0 ? (newStats.successfulTransactions / total) * 100 : 0;
          
          return {
            ...state,
            statistics: newStats,
            lastUpdate: new Date(),
          };
        });
      },

      // Update execution phase
      updatePhase: (phase: ExecutionPhase, progress?: number) => {
        set((state: ExecutionState) => ({
          ...state,
          progress: {
            ...state.progress,
            currentPhase: phase,
            phaseProgress: progress !== undefined ? progress : state.progress.phaseProgress,
          },
          lastUpdate: new Date(),
        }));
      },

      // Trigger emergency stop
      triggerEmergencyStop: (reason: string) => {
        set((state: ExecutionState) => ({
          ...state,
          status: 'aborted',
          safety: {
            ...state.safety,
            emergencyStopTriggered: true,
          },
          error: `Emergency stop triggered: ${reason}`,
          control: {
            ...initialControl,
            canStart: false,
          },
          lastUpdate: new Date(),
        }));
      },

      // Check safety limits
      checkSafetyLimits: () => {
        const state = get();
        
        if (!state.currentSession) return false;
        
        const config = state.currentSession.bundleConfig;
        const safetyFeatures = config.executionParams?.safetyFeatures;
        
        // Check spending limit
        if (state.currentSession.currentSpent > state.currentSession.maxSpendLimit) {
          set((state: ExecutionState) => ({
            ...state,
            safety: { ...state.safety, spendingLimitExceeded: true },
          }));
          get().triggerEmergencyStop('Spending limit exceeded');
          return false;
        }
        
        // Check failure rate
        const maxFailureRate = safetyFeatures?.maxFailureRate || 10;
        if (state.statistics.successRate < (100 - maxFailureRate) && state.statistics.totalTransactions > 5) {
          set((state: ExecutionState) => ({
            ...state,
            safety: { ...state.safety, failureRateExceeded: true },
          }));
          get().triggerEmergencyStop('Failure rate exceeded');
          return false;
        }
        
        return true;
      },

      // Authenticate session
      authenticateSession: async (passphrase: string) => {
        try {
          const state = get();
          
          if (!state.currentSession) {
            throw new Error('No active session to authenticate');
          }
          
          // Basic passphrase validation (in real implementation, compare with stored hash)
          if (passphrase.length < 8) {
            throw new Error('Invalid passphrase');
          }
          
          set((state: ExecutionState) => ({
            ...state,
            currentSession: {
              ...state.currentSession!,
              isAuthenticated: true,
              passphraseHash: btoa(passphrase), // Simple hash for demo
            },
            control: {
              ...state.control,
              canStart: true,
              requiresPassphrase: false,
            },
            lastUpdate: new Date(),
          }));
          
          return true;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
          set({ error: errorMessage });
          return false;
        }
      },

      // Real-time control
      enableRealTime: () => {
        set({ isRealTimeEnabled: true });
      },

      disableRealTime: () => {
        set({ isRealTimeEnabled: false });
      },

      setRefreshInterval: (intervalMs: number) => {
        set({ refreshInterval: Math.max(500, intervalMs) }); // Minimum 500ms
      },

      // Cleanup
      resetExecution: () => {
        set({
          currentSession: null,
          status: 'idle',
          progress: { ...initialProgress },
          statistics: { ...initialStatistics },
          safety: { ...initialSafety },
          control: { ...initialControl },
          error: null,
          warnings: [],
          lastUpdate: null,
        });
      },

      clearError: () => {
        set({ error: null });
      },

      clearWarnings: () => {
        set({ warnings: [] });
      },
    }),
    {
      name: 'execution-store',
      // Only persist essential data, not sensitive session info
      partialize: (state: ExecutionState) => ({
        isRealTimeEnabled: state.isRealTimeEnabled,
        refreshInterval: state.refreshInterval,
      }),
    }
  )
);