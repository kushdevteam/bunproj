/**
 * Configuration Presets Store using Zustand
 * Handles saving, loading, and managing bundle configuration presets
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { generateSecureRandom } from '../utils/crypto';
import type { ConfigurationPreset, EnhancedBundleConfig, ConfigurationTemplate, TemplateInfo } from '../types/bundle-config';
import { Role } from '../types';

interface PresetState {
  // State
  presets: ConfigurationPreset[];
  templates: TemplateInfo[];
  favoritePresets: string[];
  recentlyUsed: string[];
  isLoading: boolean;
  error: string | null;

  // Actions
  savePreset: (name: string, description: string, config: EnhancedBundleConfig) => Promise<void>;
  loadPreset: (id: string) => ConfigurationPreset | null;
  deletePreset: (id: string) => void;
  duplicatePreset: (id: string, newName: string) => void;
  updatePreset: (id: string, updates: Partial<ConfigurationPreset>) => void;
  
  // Favorites
  addToFavorites: (presetId: string) => void;
  removeFromFavorites: (presetId: string) => void;
  
  // Templates
  getTemplate: (type: ConfigurationTemplate) => TemplateInfo | null;
  createFromTemplate: (type: ConfigurationTemplate, customizations?: Partial<EnhancedBundleConfig>) => EnhancedBundleConfig;
  
  // Import/Export
  exportPreset: (id: string) => string;
  importPreset: (presetJson: string) => boolean;
  exportAllPresets: () => string;
  importMultiplePresets: (presetsJson: string) => number;
  
  // Utility
  searchPresets: (query: string) => ConfigurationPreset[];
  getPresetsByTag: (tag: string) => ConfigurationPreset[];
  incrementUsage: (id: string) => void;
  cleanupOldPresets: (daysOld: number) => void;
}

// Default templates for different strategies
const defaultTemplates: TemplateInfo[] = [
  {
    id: 'conservative',
    name: 'Conservative Strategy',
    description: 'Low-risk configuration with minimal slippage and controlled execution',
    riskLevel: 'low',
    config: {
      name: 'Conservative Bundle',
      description: 'Safe configuration for beginners',
      version: '1.0.0',
      purchaseAmount: {
        totalBnb: 0.5,
        perWalletMin: 0.01,
        perWalletMax: 0.05,
        allocation: {
          [Role.DEV]: 10,
          [Role.MEV]: 20,
          [Role.FUNDER]: 20,
          [Role.NUMBERED]: 50,
        },
      },
      strategy: {
        buyStrategy: 'staggered',
        sellStrategy: 'gradual',
        sellDelay: 300, // 5 minutes
        sellPercentage: 70,
        retainPercentage: 30,
      },
      transactionSettings: {
        gasConfiguration: {
          baseGasPrice: '5000000000',
          priorityFee: '2000000000',
          gasLimit: '100000',
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
          maxTotalSpend: 1.0,
          emergencyStopEnabled: true,
          maxFailureRate: 10,
          timeoutPerTx: 60,
        },
      },
      tags: ['conservative', 'beginner', 'safe'],
    },
  },
  {
    id: 'aggressive',
    name: 'Aggressive Strategy',
    description: 'High-speed execution with higher risk tolerance',
    riskLevel: 'high',
    config: {
      name: 'Aggressive Bundle',
      description: 'Fast execution for experienced users',
      version: '1.0.0',
      purchaseAmount: {
        totalBnb: 2.0,
        perWalletMin: 0.05,
        perWalletMax: 0.2,
        allocation: {
          [Role.DEV]: 5,
          [Role.MEV]: 35,
          [Role.FUNDER]: 25,
          [Role.NUMBERED]: 35,
        },
      },
      strategy: {
        buyStrategy: 'immediate',
        sellStrategy: 'dump',
        sellDelay: 30, // 30 seconds
        sellPercentage: 90,
        retainPercentage: 10,
      },
      transactionSettings: {
        gasConfiguration: {
          baseGasPrice: '10000000000',
          priorityFee: '5000000000',
          gasLimit: '150000',
          gasMultiplier: 1.2,
        },
        slippageSettings: {
          tolerance: 5,
          autoAdjust: false,
          maxSlippage: 15,
        },
        mevProtection: {
          enabled: true,
          frontrunningProtection: false,
          sandwichProtection: true,
          usePrivateMempool: true,
        },
        networkSettings: {
          rpcEndpoint: 'https://bsc-dataseed1.binance.org/',
          chainId: 56,
          fallbackRpc: ['https://bsc-dataseed2.binance.org/'],
        },
      },
      executionParams: {
        staggerSettings: {
          enabled: false,
          delayMin: 500,
          delayMax: 1500,
          randomization: true,
        },
        stealthMode: {
          enabled: false,
          randomTiming: false,
          variationPercent: 0,
          proxyUsage: false,
        },
        batchConfiguration: {
          batchSize: 10,
          concurrentLimit: 8,
          pauseBetweenBatches: 1,
        },
        safetyFeatures: {
          maxTotalSpend: 5.0,
          emergencyStopEnabled: true,
          maxFailureRate: 25,
          timeoutPerTx: 30,
        },
      },
      tags: ['aggressive', 'advanced', 'fast'],
    },
  },
  {
    id: 'stealth',
    name: 'Stealth Strategy',
    description: 'Maximum stealth with randomized timing and distribution',
    riskLevel: 'medium',
    config: {
      name: 'Stealth Bundle',
      description: 'Optimized for stealth and anonymity',
      version: '1.0.0',
      purchaseAmount: {
        totalBnb: 1.0,
        perWalletMin: 0.02,
        perWalletMax: 0.08,
        allocation: {
          [Role.DEV]: 15,
          [Role.MEV]: 25,
          [Role.FUNDER]: 20,
          [Role.NUMBERED]: 40,
        },
      },
      strategy: {
        buyStrategy: 'staggered',
        sellStrategy: 'gradual',
        sellDelay: 600, // 10 minutes
        sellPercentage: 75,
        retainPercentage: 25,
      },
      transactionSettings: {
        gasConfiguration: {
          baseGasPrice: '7500000000',
          priorityFee: '3000000000',
          gasLimit: '120000',
          gasMultiplier: 1.15,
        },
        slippageSettings: {
          tolerance: 3,
          autoAdjust: true,
          maxSlippage: 8,
        },
        mevProtection: {
          enabled: true,
          frontrunningProtection: true,
          sandwichProtection: true,
          usePrivateMempool: true,
        },
        networkSettings: {
          rpcEndpoint: 'https://bsc-dataseed1.binance.org/',
          chainId: 56,
          fallbackRpc: ['https://bsc-dataseed2.binance.org/', 'https://bsc-dataseed3.binance.org/'],
        },
      },
      executionParams: {
        staggerSettings: {
          enabled: true,
          delayMin: 5000,
          delayMax: 15000,
          randomization: true,
        },
        stealthMode: {
          enabled: true,
          randomTiming: true,
          variationPercent: 30,
          proxyUsage: true,
        },
        batchConfiguration: {
          batchSize: 3,
          concurrentLimit: 2,
          pauseBetweenBatches: 5,
        },
        safetyFeatures: {
          maxTotalSpend: 2.0,
          emergencyStopEnabled: true,
          maxFailureRate: 15,
          timeoutPerTx: 90,
        },
      },
      tags: ['stealth', 'anonymous', 'randomized'],
    },
  },
];

export const usePresetStore = create<PresetState>()(
  persist(
    (set, get) => ({
      // Initial state
      presets: [],
      templates: defaultTemplates,
      favoritePresets: [],
      recentlyUsed: [],
      isLoading: false,
      error: null,

      // Save new preset
      savePreset: async (name: string, description: string, config: EnhancedBundleConfig) => {
        try {
          set({ isLoading: true, error: null });

          const id = `preset_${Date.now()}_${Array.from(generateSecureRandom(8)).map(b => b.toString(16).padStart(2, '0')).join('')}`;
          
          const preset: ConfigurationPreset = {
            id,
            name,
            description,
            config: {
              ...config,
              id,
              name,
              description,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            isTemplate: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            usage: 0,
          };

          set(state => ({
            presets: [...state.presets, preset],
            isLoading: false,
          }));

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to save preset';
          set({ error: errorMessage, isLoading: false });
        }
      },

      // Load preset by ID
      loadPreset: (id: string) => {
        const state = get();
        const preset = state.presets.find(p => p.id === id);
        
        if (preset) {
          // Add to recently used
          const recentlyUsed = [id, ...state.recentlyUsed.filter(rid => rid !== id)].slice(0, 10);
          set({ recentlyUsed });
          
          // Increment usage
          get().incrementUsage(id);
          
          return preset;
        }
        
        return null;
      },

      // Delete preset
      deletePreset: (id: string) => {
        set(state => ({
          presets: state.presets.filter(p => p.id !== id),
          favoritePresets: state.favoritePresets.filter(fid => fid !== id),
          recentlyUsed: state.recentlyUsed.filter(rid => rid !== id),
        }));
      },

      // Duplicate preset
      duplicatePreset: (id: string, newName: string) => {
        const state = get();
        const originalPreset = state.presets.find(p => p.id === id);
        
        if (originalPreset) {
          const newId = `preset_${Date.now()}_${Array.from(generateSecureRandom(8)).map(b => b.toString(16).padStart(2, '0')).join('')}`;
          
          const duplicatedPreset: ConfigurationPreset = {
            ...originalPreset,
            id: newId,
            name: newName,
            config: {
              ...originalPreset.config,
              id: newId,
              name: newName,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            usage: 0,
          };

          set(state => ({
            presets: [...state.presets, duplicatedPreset],
          }));
        }
      },

      // Update preset
      updatePreset: (id: string, updates: Partial<ConfigurationPreset>) => {
        set(state => ({
          presets: state.presets.map(p => 
            p.id === id 
              ? { 
                  ...p, 
                  ...updates, 
                  updatedAt: new Date().toISOString(),
                  config: updates.config ? { ...p.config, ...updates.config, updatedAt: new Date().toISOString() } : p.config,
                }
              : p
          ),
        }));
      },

      // Favorites management
      addToFavorites: (presetId: string) => {
        set(state => ({
          favoritePresets: [...state.favoritePresets.filter(id => id !== presetId), presetId],
        }));
      },

      removeFromFavorites: (presetId: string) => {
        set(state => ({
          favoritePresets: state.favoritePresets.filter(id => id !== presetId),
        }));
      },

      // Template management
      getTemplate: (type: ConfigurationTemplate) => {
        return get().templates.find(t => t.id === type) || null;
      },

      createFromTemplate: (type: ConfigurationTemplate, customizations?: Partial<EnhancedBundleConfig>) => {
        const template = get().getTemplate(type);
        if (!template) {
          throw new Error(`Template ${type} not found`);
        }

        const config: EnhancedBundleConfig = {
          ...template.config,
          ...customizations,
          id: `config_${Date.now()}_${Array.from(generateSecureRandom(8)).map(b => b.toString(16).padStart(2, '0')).join('')}`,
          name: customizations?.name || `${template.name} - Custom`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as EnhancedBundleConfig;

        return config;
      },

      // Export/Import functionality
      exportPreset: (id: string) => {
        const preset = get().presets.find(p => p.id === id);
        if (!preset) {
          throw new Error(`Preset ${id} not found`);
        }
        
        return JSON.stringify(preset, null, 2);
      },

      importPreset: (presetJson: string) => {
        try {
          const preset = JSON.parse(presetJson) as ConfigurationPreset;
          
          // Validate basic structure
          if (!preset.id || !preset.name || !preset.config) {
            throw new Error('Invalid preset format');
          }

          // Generate new ID to avoid conflicts
          const newId = `preset_${Date.now()}_${Array.from(generateSecureRandom(8)).map(b => b.toString(16).padStart(2, '0')).join('')}`;
          const importedPreset: ConfigurationPreset = {
            ...preset,
            id: newId,
            config: {
              ...preset.config,
              id: newId,
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            usage: 0,
          };

          set(state => ({
            presets: [...state.presets, importedPreset],
          }));

          return true;
        } catch (error) {
          set({ error: 'Failed to import preset: Invalid format' });
          return false;
        }
      },

      exportAllPresets: () => {
        const presets = get().presets;
        return JSON.stringify(presets, null, 2);
      },

      importMultiplePresets: (presetsJson: string) => {
        try {
          const presets = JSON.parse(presetsJson) as ConfigurationPreset[];
          let importedCount = 0;

          presets.forEach(preset => {
            if (preset.id && preset.name && preset.config) {
              const newId = `preset_${Date.now()}_${importedCount}_${Array.from(generateSecureRandom(4)).map(b => b.toString(16).padStart(2, '0')).join('')}`;
              const importedPreset: ConfigurationPreset = {
                ...preset,
                id: newId,
                config: {
                  ...preset.config,
                  id: newId,
                },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                usage: 0,
              };

              set(state => ({
                presets: [...state.presets, importedPreset],
              }));

              importedCount++;
            }
          });

          return importedCount;
        } catch (error) {
          set({ error: 'Failed to import presets: Invalid format' });
          return 0;
        }
      },

      // Utility functions
      searchPresets: (query: string) => {
        const presets = get().presets;
        const lowercaseQuery = query.toLowerCase();
        
        return presets.filter(preset => 
          preset.name.toLowerCase().includes(lowercaseQuery) ||
          preset.description.toLowerCase().includes(lowercaseQuery) ||
          preset.config.tags.some(tag => tag.toLowerCase().includes(lowercaseQuery))
        );
      },

      getPresetsByTag: (tag: string) => {
        return get().presets.filter(preset => 
          preset.config.tags.includes(tag)
        );
      },

      incrementUsage: (id: string) => {
        set(state => ({
          presets: state.presets.map(p => 
            p.id === id ? { ...p, usage: p.usage + 1 } : p
          ),
        }));
      },

      cleanupOldPresets: (daysOld: number) => {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);
        
        set(state => ({
          presets: state.presets.filter(preset => {
            const createdDate = new Date(preset.createdAt);
            return createdDate >= cutoffDate || state.favoritePresets.includes(preset.id);
          }),
        }));
      },
    }),
    {
      name: 'bundle-presets-storage',
      version: 1,
    }
  )
);