/**
 * Network management store using Zustand
 * Handles network switching, connection status, and blockchain data
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { config } from '../config/env';
import { bscRpcClient } from '../services/bsc-rpc';
import type { NetworkStore, NetworkConfig } from '../types';

interface NetworkState extends NetworkStore {
  // Additional internal state
  lastBalanceUpdate: Date | null;
  connectionAttempts: number;
  isInitialized: boolean;
  
  // Enhanced actions
  initialize: () => Promise<void>;
  connectToNetwork: (networkId: string) => Promise<void>;
  disconnect: () => void;
  checkConnection: () => Promise<boolean>;
  updateNetworkStats: () => Promise<void>;
  getAvailableNetworks: () => NetworkConfig[];
  isMainnet: () => boolean;
  getBlockExplorerUrl: (txHash?: string) => string;
  validateNetworkSwitch: (networkId: string) => string[];
  resetConnectionAttempts: () => void;
}

export const useNetworkStore = create<NetworkState>()(
  persist(
    (set, get) => ({
      // Initial state
      currentNetwork: config.networks['bsc-testnet'],
      availableNetworks: Object.values(config.networks),
      isConnected: false,
      isConnecting: false,
      blockNumber: undefined,
      gasPrice: undefined,
      lastUpdate: undefined,
      error: undefined,
      lastBalanceUpdate: null,
      connectionAttempts: 0,
      isInitialized: false,

      // Initialize network system
      initialize: async () => {
        try {
          set({ isInitialized: false, error: undefined });
          
          const availableNetworks = Object.values(config.networks);
          set({ availableNetworks });
          
          // Try to connect to the current network
          await get().updateNetworkStats();
          
          set({ isInitialized: true });
          console.log('Network store initialized successfully');
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Network initialization failed';
          set({ error: errorMessage, isInitialized: false });
          console.error('Network initialization failed:', error);
        }
      },

      // Switch to a different network
      switchNetwork: async (networkId: string): Promise<void> => {
        const state = get();
        
        try {
          set({ isConnecting: true, error: undefined });
          
          // Validate network switch
          const warnings = state.validateNetworkSwitch(networkId);
          if (warnings.length > 0) {
            console.warn('Network switch warnings:', warnings);
          }
          
          // Find the network configuration
          const newNetwork = state.availableNetworks.find(n => n.id === networkId);
          if (!newNetwork) {
            throw new Error(`Network configuration not found: ${networkId}`);
          }
          
          console.log(`Switching from ${state.currentNetwork.displayName} to ${newNetwork.displayName}`);
          
          // Update BSC RPC client
          await bscRpcClient.switchNetwork(networkId);
          
          // Update store state
          set({
            currentNetwork: newNetwork,
            isConnected: false,
            blockNumber: undefined,
            gasPrice: undefined,
            lastUpdate: undefined,
            connectionAttempts: 0,
          });
          
          // Test new connection
          await get().updateNetworkStats();
          
          set({ isConnecting: false });
          console.log(`Successfully switched to ${newNetwork.displayName}`);
          
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Network switch failed';
          set({ 
            error: errorMessage, 
            isConnecting: false,
            connectionAttempts: state.connectionAttempts + 1
          });
          console.error('Network switch failed:', error);
          throw error;
        }
      },

      // Connect to the current network
      connectToNetwork: async (networkId: string): Promise<void> => {
        await get().switchNetwork(networkId);
      },

      // Disconnect from network
      disconnect: () => {
        set({
          isConnected: false,
          blockNumber: undefined,
          gasPrice: undefined,
          lastUpdate: undefined,
          error: undefined,
        });
        console.log('Disconnected from network');
      },

      // Check network connection status
      checkConnection: async (): Promise<boolean> => {
        try {
          const isConnected = await bscRpcClient.isConnected();
          set({ isConnected });
          return isConnected;
        } catch (error) {
          console.error('Connection check failed:', error);
          set({ isConnected: false });
          return false;
        }
      },

      // Refresh network status and stats
      refreshNetworkStatus: async (): Promise<void> => {
        await get().updateNetworkStats();
      },

      // Update network statistics
      updateNetworkStats: async (): Promise<void> => {
        try {
          const state = get();
          set({ error: undefined });
          
          // Get blockchain statistics
          const stats = await bscRpcClient.getBlockchainStats();
          
          set({
            isConnected: stats.isConnected,
            blockNumber: stats.blockNumber,
            gasPrice: stats.gasPrice,
            lastUpdate: stats.lastUpdate.toISOString(),
            connectionAttempts: 0, // Reset on successful update
          });
          
          console.log(`Network stats updated for ${state.currentNetwork.displayName}:`, {
            blockNumber: stats.blockNumber,
            gasPrice: stats.gasPrice,
            isConnected: stats.isConnected,
          });
          
        } catch (error) {
          const state = get();
          const errorMessage = error instanceof Error ? error.message : 'Failed to update network stats';
          set({ 
            error: errorMessage,
            isConnected: false,
            connectionAttempts: state.connectionAttempts + 1
          });
          console.error('Failed to update network stats:', error);
        }
      },

      // Update gas price
      updateGasPrice: async (): Promise<void> => {
        try {
          const gasPriceInfo = await bscRpcClient.getGasPriceInfo();
          set({ 
            gasPrice: gasPriceInfo.standard,
            lastUpdate: new Date().toISOString(),
          });
        } catch (error) {
          console.error('Failed to update gas price:', error);
        }
      },

      // Get list of available networks
      getAvailableNetworks: (): NetworkConfig[] => {
        return get().availableNetworks;
      },

      // Check if current network is mainnet
      isMainnet: (): boolean => {
        return get().currentNetwork.type === 'mainnet';
      },

      // Get block explorer URL
      getBlockExplorerUrl: (txHash?: string): string => {
        const state = get();
        const baseUrl = state.currentNetwork.blockExplorerUrl;
        
        if (txHash) {
          return `${baseUrl}/tx/${txHash}`;
        }
        
        return baseUrl;
      },

      // Validate network switch and return warnings
      validateNetworkSwitch: (networkId: string): string[] => {
        const state = get();
        const warnings: string[] = [];
        
        const targetNetwork = state.availableNetworks.find(n => n.id === networkId);
        if (!targetNetwork) {
          warnings.push(`Unknown network: ${networkId}`);
          return warnings;
        }
        
        // Check if switching to mainnet
        if (targetNetwork.type === 'mainnet' && state.currentNetwork.type === 'testnet') {
          warnings.push('DANGER: Switching to MAINNET - real funds will be used!');
          warnings.push('Ensure you understand the risks before proceeding.');
        }
        
        // Check if switching from mainnet to testnet
        if (targetNetwork.type === 'testnet' && state.currentNetwork.type === 'mainnet') {
          warnings.push('Switching to testnet - no real funds will be used.');
        }
        
        return warnings;
      },

      // Reset connection attempts counter
      resetConnectionAttempts: () => {
        set({ connectionAttempts: 0 });
      },

      // Set error message
      setError: (error: string | null) => {
        set({ error: error || undefined });
      },
    }),
    {
      name: 'bnb-bundler-network',
      partialize: (state) => ({
        currentNetwork: state.currentNetwork,
        lastUpdate: state.lastUpdate,
      }),
    }
  )
);

// Network monitoring functions
let networkMonitoringInterval: NodeJS.Timeout | null = null;

export const startNetworkMonitoring = (): void => {
  if (networkMonitoringInterval) {
    clearInterval(networkMonitoringInterval);
  }
  
  // Update network stats every 30 seconds
  networkMonitoringInterval = setInterval(async () => {
    const state = useNetworkStore.getState();
    
    if (state.isInitialized && !state.isConnecting) {
      try {
        await state.updateNetworkStats();
      } catch (error) {
        console.error('Network monitoring update failed:', error);
      }
    }
  }, 30000); // 30 seconds
  
  console.log('Network monitoring started');
};

export const stopNetworkMonitoring = (): void => {
  if (networkMonitoringInterval) {
    clearInterval(networkMonitoringInterval);
    networkMonitoringInterval = null;
    console.log('Network monitoring stopped');
  }
};

// Gas price monitoring
let gasPriceMonitoringInterval: NodeJS.Timeout | null = null;

export const startGasPriceMonitoring = (): void => {
  if (gasPriceMonitoringInterval) {
    clearInterval(gasPriceMonitoringInterval);
  }
  
  // Update gas prices every 30 seconds
  gasPriceMonitoringInterval = setInterval(async () => {
    const state = useNetworkStore.getState();
    
    if (state.isConnected && !state.isConnecting) {
      try {
        await state.updateGasPrice();
      } catch (error) {
        console.error('Gas price monitoring update failed:', error);
      }
    }
  }, config.gas.gasPriceRefreshInterval);
  
  console.log('Gas price monitoring started');
};

export const stopGasPriceMonitoring = (): void => {
  if (gasPriceMonitoringInterval) {
    clearInterval(gasPriceMonitoringInterval);
    gasPriceMonitoringInterval = null;
    console.log('Gas price monitoring stopped');
  }
};

// Utility function to get current network safely
export const getCurrentNetwork = (): NetworkConfig => {
  return useNetworkStore.getState().currentNetwork;
};

// Export store type for use in components
export type { NetworkState };