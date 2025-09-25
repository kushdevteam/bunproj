/**
 * Bundle configuration store using Zustand
 * Handles bundle configuration management, saving/loading configurations, and validation
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { config as appConfig } from '../config/env';
import { generateSecureRandom } from '../utils/crypto';
import type { ConfigStore, BundleConfiguration } from '../types';
import type { EnhancedBundleConfig } from '../types/bundle-config';
import { Role } from '../types';

interface ConfigState {
  // Current configuration using nested structure
  currentConfig: Partial<EnhancedBundleConfig>;
  savedConfigs: EnhancedBundleConfig[];
  
  // Additional internal state
  isValidConfig: boolean;
  validationErrors: string[];
  lastSaved: Date | null;
  isDirty: boolean;
  
  // Enhanced actions
  updateConfig: (updates: Partial<EnhancedBundleConfig>) => void;
  validateConfig: () => string[];
  saveConfig: (name: string) => void;
  loadConfig: (id: string) => void;
  deleteConfig: (id: string) => void;
  resetConfig: () => void;
  exportConfig: () => string;
  importConfig: (configJson: string) => boolean;
  duplicateConfig: (id: string, newName: string) => void;
  getConfigById: (id: string) => EnhancedBundleConfig | undefined;
  setConfigDefaults: () => void;
  markClean: () => void;
  markDirty: () => void;
}

// Default configuration template using nested structure
const defaultEnhancedBundleConfig: Partial<EnhancedBundleConfig> = {
  name: '',
  description: '',
  version: '1.0.0',
  
  // Token configuration (nested)
  token: {
    address: '',
    name: '',
    symbol: '',
    decimals: 18,
    totalSupply: '1000000',
    verified: false,
    contractValidated: false,
  },
  
  // Purchase amounts and allocation (nested)
  purchaseAmount: {
    totalBnb: 1,
    perWalletMin: 0.01,
    perWalletMax: 0.1,
    allocation: {
      [Role.DEV]: 10,
      [Role.MEV]: 30,
      [Role.FUNDER]: 20,
      [Role.NUMBERED]: 40,
    },
  },
  
  // Buy/Sell strategy (nested)
  strategy: {
    buyStrategy: 'staggered',
    sellStrategy: 'gradual',
    sellDelay: 300, // 5 minutes
    sellPercentage: 80,
    retainPercentage: 20,
  },
  
  // Transaction settings (nested)
  transactionSettings: {
    gasConfiguration: {
      baseGasPrice: appConfig.blockchain.defaultGasPrice,
      priorityFee: '2000000000', // 2 gwei
      gasLimit: appConfig.blockchain.defaultGasLimit,
      gasMultiplier: 1.1,
    },
    slippageSettings: {
      tolerance: 2,
      autoAdjust: true,
      maxSlippage: 5,
    },
    mevProtection: {
      enabled: true,
      frontrunningProtection: true,
      sandwichProtection: true,
      usePrivateMempool: false,
    },
    networkSettings: {
      rpcEndpoint: 'https://bsc-dataseed1.binance.org/',
      chainId: 56,
      fallbackRpc: ['https://bsc-dataseed2.binance.org/', 'https://bsc-dataseed3.binance.org/'],
    },
  },
  
  // Execution parameters (nested)
  executionParams: {
    staggerSettings: {
      enabled: true,
      delayMin: 2000,
      delayMax: 8000,
      randomization: true,
    },
    stealthMode: {
      enabled: false,
      randomTiming: false,
      variationPercent: 10,
      proxyUsage: false,
    },
    batchConfiguration: {
      batchSize: 5,
      concurrentLimit: 3,
      pauseBetweenBatches: 2,
    },
    safetyFeatures: {
      maxTotalSpend: 5.0,
      emergencyStopEnabled: true,
      maxFailureRate: 10,
      timeoutPerTx: 60,
    },
  },
  
  // Metadata
  tags: ['default'],
};

export const useConfigStore = create<ConfigState>()(
  persist(
    (set, get) => ({
      // Initial state
      currentConfig: { ...defaultEnhancedBundleConfig },
      savedConfigs: [],
      isValidConfig: false,
      validationErrors: [],
      lastSaved: null,
      isDirty: false,

      // Update current configuration
      updateConfig: (updates: Partial<EnhancedBundleConfig>) => {
        set(state => ({
          currentConfig: { ...state.currentConfig, ...updates },
          isDirty: true,
          isValidConfig: false, // Reset validation when config changes
          validationErrors: [],
        }));
        
        // Validate after update
        setTimeout(() => {
          const errors = get().validateConfig();
          set({ 
            isValidConfig: errors.length === 0,
            validationErrors: errors,
          });
        }, 0);
      },

      // Save current configuration with a name
      saveConfig: (name: string) => {
        const state = get();
        
        // Validate before saving
        const errors = state.validateConfig();
        if (errors.length > 0) {
          throw new Error(`Cannot save invalid configuration: ${errors.join(', ')}`);
        }

        const newConfig: EnhancedBundleConfig = {
          ...state.currentConfig as EnhancedBundleConfig,
          // Add metadata
          id: `config_${Date.now()}_${Array.from(generateSecureRandom(8)).map(b => b.toString(16).padStart(2, '0')).join('')}`,
          name,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        set(state => ({
          savedConfigs: [...state.savedConfigs, newConfig],
          lastSaved: new Date(),
          isDirty: false,
        }));
      },

      // Load a saved configuration
      loadConfig: (id: string) => {
        const state = get();
        const config = state.savedConfigs.find(c => (c as any).id === id);
        
        if (!config) {
          throw new Error(`Configuration with ID ${id} not found`);
        }

        // Remove metadata before loading
        const { id: configId, name, createdAt, updatedAt, ...configData } = config as any;
        
        set({
          currentConfig: configData,
          isDirty: false,
          isValidConfig: false,
          validationErrors: [],
        });

        // Validate loaded config
        setTimeout(() => {
          const errors = get().validateConfig();
          set({ 
            isValidConfig: errors.length === 0,
            validationErrors: errors,
          });
        }, 0);
      },

      // Delete a saved configuration
      deleteConfig: (id: string) => {
        set(state => ({
          savedConfigs: state.savedConfigs.filter(c => (c as any).id !== id)
        }));
      },

      // Reset to default configuration
      resetConfig: () => {
        set({
          currentConfig: { ...defaultEnhancedBundleConfig },
          isDirty: false,
          isValidConfig: false,
          validationErrors: [],
        });

        // Validate default config
        setTimeout(() => {
          const errors = get().validateConfig();
          set({ 
            isValidConfig: errors.length === 0,
            validationErrors: errors,
          });
        }, 0);
      },

      // Set default values
      setConfigDefaults: () => {
        get().resetConfig();
      },

      // Validate current configuration
      validateConfig: (): string[] => {
        const config = get().currentConfig;
        const errors: string[] = [];

        // Token validation (nested structure)
        if (config.token) {
          if (!config.token.name?.trim()) {
            errors.push('Token name is required');
          }
          if (!config.token.symbol?.trim()) {
            errors.push('Token symbol is required');
          }
          if (config.token.symbol && config.token.symbol.length > 10) {
            errors.push('Token symbol must be 10 characters or less');
          }
          if (config.token.address && config.token.address.length > 0) {
            // Basic address format validation (should be 42 chars starting with 0x)
            if (!/^0x[a-fA-F0-9]{40}$/.test(config.token.address)) {
              errors.push('Invalid token address format');
            }
          }
          if (!config.token.totalSupply || isNaN(Number(config.token.totalSupply)) || Number(config.token.totalSupply) <= 0) {
            errors.push('Total supply must be a positive number');
          }
        } else {
          errors.push('Token configuration is required');
        }

        // Purchase amount validation (nested structure)
        if (config.purchaseAmount) {
          if (!config.purchaseAmount.totalBnb || config.purchaseAmount.totalBnb <= 0) {
            errors.push('Total BNB amount must be greater than 0');
          }
          if (!config.purchaseAmount.perWalletMin || config.purchaseAmount.perWalletMin <= 0) {
            errors.push('Minimum amount per wallet must be greater than 0');
          }
          if (!config.purchaseAmount.perWalletMax || config.purchaseAmount.perWalletMax <= 0) {
            errors.push('Maximum amount per wallet must be greater than 0');
          }
          if (config.purchaseAmount.perWalletMin > config.purchaseAmount.perWalletMax) {
            errors.push('Minimum amount per wallet cannot exceed maximum amount');
          }
          
          // Allocation validation
          if (config.purchaseAmount.allocation) {
            const totalAllocation = Object.values(config.purchaseAmount.allocation).reduce((sum, val) => sum + val, 0);
            if (Math.abs(totalAllocation - 100) > 0.01) {
              errors.push(`Total allocation must equal 100% (currently ${totalAllocation.toFixed(1)}%)`);
            }
            
            // Individual allocation checks
            Object.entries(config.purchaseAmount.allocation).forEach(([role, percentage]) => {
              if (percentage < 0 || percentage > 100) {
                errors.push(`${role} allocation must be between 0% and 100%`);
              }
            });
          } else {
            errors.push('Wallet allocation is required');
          }
        } else {
          errors.push('Purchase amount configuration is required');
        }

        // Strategy validation (nested structure)
        if (config.strategy) {
          if (config.strategy.sellPercentage < 0 || config.strategy.sellPercentage > 100) {
            errors.push('Sell percentage must be between 0 and 100');
          }
          if (config.strategy.retainPercentage < 0 || config.strategy.retainPercentage > 100) {
            errors.push('Retain percentage must be between 0 and 100');
          }
          if ((config.strategy.sellPercentage + config.strategy.retainPercentage) > 100) {
            errors.push('Sell percentage + retain percentage cannot exceed 100%');
          }
          if (config.strategy.sellDelay < 0) {
            errors.push('Sell delay cannot be negative');
          }
        }

        // Transaction settings validation (nested structure)
        if (config.transactionSettings) {
          // Gas configuration validation
          if (config.transactionSettings.gasConfiguration) {
            const gas = config.transactionSettings.gasConfiguration;
            if (!gas.gasLimit || isNaN(Number(gas.gasLimit))) {
              errors.push('Gas limit must be a valid number');
            }
            if (!gas.baseGasPrice || isNaN(Number(gas.baseGasPrice))) {
              errors.push('Base gas price must be a valid number');
            }
            if (!gas.priorityFee || isNaN(Number(gas.priorityFee))) {
              errors.push('Priority fee must be a valid number');
            }
            if (gas.gasMultiplier < 1 || gas.gasMultiplier > 5) {
              errors.push('Gas multiplier must be between 1 and 5');
            }
          }
          
          // Slippage settings validation
          if (config.transactionSettings.slippageSettings) {
            const slippage = config.transactionSettings.slippageSettings;
            if (slippage.tolerance < 0.1 || slippage.tolerance > 50) {
              errors.push('Slippage tolerance must be between 0.1% and 50%');
            }
            if (slippage.maxSlippage < slippage.tolerance) {
              errors.push('Max slippage cannot be less than tolerance');
            }
            if (slippage.maxSlippage > 50) {
              errors.push('Max slippage cannot exceed 50%');
            }
          }
          
          // Network settings validation
          if (config.transactionSettings.networkSettings) {
            const network = config.transactionSettings.networkSettings;
            if (!network.rpcEndpoint || !network.rpcEndpoint.startsWith('http')) {
              errors.push('Valid RPC endpoint is required');
            }
            if (!network.chainId || network.chainId <= 0) {
              errors.push('Valid chain ID is required');
            }
          }
        }

        // Execution parameters validation (nested structure)
        if (config.executionParams) {
          // Stagger settings validation
          if (config.executionParams.staggerSettings) {
            const stagger = config.executionParams.staggerSettings;
            if (stagger.enabled) {
              if (stagger.delayMin < 0) {
                errors.push('Minimum stagger delay cannot be negative');
              }
              if (stagger.delayMax < stagger.delayMin) {
                errors.push('Maximum stagger delay cannot be less than minimum');
              }
            }
          }
          
          // Batch configuration validation
          if (config.executionParams.batchConfiguration) {
            const batch = config.executionParams.batchConfiguration;
            if (batch.batchSize < 1 || batch.batchSize > 50) {
              errors.push('Batch size must be between 1 and 50');
            }
            if (batch.concurrentLimit < 1 || batch.concurrentLimit > batch.batchSize) {
              errors.push('Concurrent limit must be between 1 and batch size');
            }
            if (batch.pauseBetweenBatches < 0) {
              errors.push('Pause between batches cannot be negative');
            }
          }
          
          // Safety features validation
          if (config.executionParams.safetyFeatures) {
            const safety = config.executionParams.safetyFeatures;
            if (safety.maxTotalSpend <= 0) {
              errors.push('Maximum total spend must be greater than 0');
            }
            if (config.purchaseAmount && safety.maxTotalSpend < config.purchaseAmount.totalBnb) {
              errors.push('Maximum total spend cannot be less than total BNB amount');
            }
            if (safety.maxFailureRate < 0 || safety.maxFailureRate > 100) {
              errors.push('Maximum failure rate must be between 0% and 100%');
            }
            if (safety.timeoutPerTx <= 0) {
              errors.push('Transaction timeout must be greater than 0');
            }
          }
        }

        return errors;
      },

      // Export configuration as JSON
      exportConfig: (): string => {
        const config = get().currentConfig;
        return JSON.stringify(config, null, 2);
      },

      // Import configuration from JSON
      importConfig: (configJson: string): boolean => {
        try {
          const imported = JSON.parse(configJson);
          
          // Validate imported structure
          if (typeof imported !== 'object' || !imported) {
            throw new Error('Invalid configuration format');
          }

          set({
            currentConfig: { ...defaultEnhancedBundleConfig, ...imported },
            isDirty: true,
            isValidConfig: false,
            validationErrors: [],
          });

          // Validate imported config
          const errors = get().validateConfig();
          set({ 
            isValidConfig: errors.length === 0,
            validationErrors: errors,
          });

          return errors.length === 0;
        } catch (error) {
          console.error('Failed to import configuration:', error);
          return false;
        }
      },

      // Duplicate an existing configuration
      duplicateConfig: (id: string, newName: string) => {
        const state = get();
        const originalConfig = state.savedConfigs.find(c => (c as any).id === id);
        
        if (!originalConfig) {
          throw new Error(`Configuration with ID ${id} not found`);
        }

        const duplicatedConfig = {
          ...originalConfig,
          id: `config_${Date.now()}_${Array.from(generateSecureRandom(8)).map(b => b.toString(16).padStart(2, '0')).join('')}`,
          name: newName,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as any;

        set(state => ({
          savedConfigs: [...state.savedConfigs, duplicatedConfig]
        }));
      },

      // Get configuration by ID
      getConfigById: (id: string) => {
        return get().savedConfigs.find(c => (c as any).id === id);
      },

      // Mark configuration as clean/dirty
      markClean: () => set({ isDirty: false }),
      markDirty: () => set({ isDirty: true }),
    }),
    {
      name: 'bnb-bundler-config',
      partialize: (state) => ({
        currentConfig: state.currentConfig,
        savedConfigs: state.savedConfigs,
        lastSaved: state.lastSaved,
      }),
    }
  )
);

// Configuration presets
export const configPresets = {
  conservative: {
    ...defaultEnhancedBundleConfig,
    strategy: {
      buyStrategy: 'staggered' as const,
      sellStrategy: 'gradual' as const,
      sellPercentage: 60,
      sellDelay: 30,
      retainPercentage: 40,
    },
    transactionSettings: {
      ...defaultEnhancedBundleConfig.transactionSettings!,
      gasConfiguration: {
        baseGasPrice: '15000000000', // 15 gwei
        priorityFee: '1500000000', // 1.5 gwei
        gasLimit: '250000',
        gasMultiplier: 1.0,
      },
      slippageSettings: {
        tolerance: 2,
        autoAdjust: true,
        maxSlippage: 3,
      },
    },
  },
  
  aggressive: {
    ...defaultEnhancedBundleConfig,
    strategy: {
      buyStrategy: 'immediate' as const,
      sellStrategy: 'dump' as const,
      sellPercentage: 90,
      sellDelay: 5,
      retainPercentage: 10,
    },
    transactionSettings: {
      ...defaultEnhancedBundleConfig.transactionSettings!,
      gasConfiguration: {
        baseGasPrice: '30000000000', // 30 gwei
        priorityFee: '5000000000', // 5 gwei
        gasLimit: '400000',
        gasMultiplier: 1.5,
      },
      slippageSettings: {
        tolerance: 5,
        autoAdjust: false,
        maxSlippage: 10,
      },
    },
  },
  
  balanced: {
    ...defaultEnhancedBundleConfig,
    strategy: {
      buyStrategy: 'staggered' as const,
      sellStrategy: 'gradual' as const,
      sellPercentage: 75,
      sellDelay: 15,
      retainPercentage: 25,
    },
    transactionSettings: {
      ...defaultEnhancedBundleConfig.transactionSettings!,
      gasConfiguration: {
        baseGasPrice: '20000000000', // 20 gwei
        priorityFee: '2000000000', // 2 gwei
        gasLimit: '300000',
        gasMultiplier: 1.1,
      },
      slippageSettings: {
        tolerance: 3,
        autoAdjust: true,
        maxSlippage: 5,
      },
    },
  },
};

// Load preset configuration
export const loadPreset = (presetName: keyof typeof configPresets): void => {
  const preset = configPresets[presetName];
  if (preset) {
    useConfigStore.getState().updateConfig(preset);
  }
};