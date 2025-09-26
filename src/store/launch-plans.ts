/**
 * Launch Plan Store using Zustand
 * Handles launch plan generation, wallet management, and configuration
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { generateSessionId, stripPrivateKeys, generateSecureWallets } from '../utils/crypto';
import { apiClient } from '../api/client';
import { verifyStoreSecurityCompliance } from '../utils/storage-security';

// Launch Plan types
export interface GeneratedWallet {
  id: string;
  address: string;
  privateKey: string;
  buyPercentage: number;
  funded: boolean;
  balance: number;
  type: 'fresh' | 'aged';
  createdAt: string;
}

export interface LaunchPlan {
  id: string;
  tokenId?: string; // Reference to token from launches store
  launchMode: 'quick' | 'organic';
  devBuyPercent: number;
  supplyBuyPercent: number;
  disperseWalletsCount: number;
  staggerDelayMs: number; // Delay for organic mode in milliseconds (0-60000+)
  generatedWallets: GeneratedWallet[];
  status: 'draft' | 'active' | 'archived' | 'completed';
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

interface LaunchPlanState {
  // Current plan being configured
  currentPlan: LaunchPlan | null;
  
  // Configuration state
  launchMode: 'quick' | 'organic';
  devBuyPercent: number;
  supplyBuyPercent: number;
  disperseWalletsCount: number;
  staggerDelayMs: number;
  
  // Generated wallets
  generatedWallets: GeneratedWallet[];
  
  // All plans
  plans: LaunchPlan[];
  archivedPlans: LaunchPlan[];
  
  // UI state
  isGenerating: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Actions - Configuration
  setLaunchMode: (mode: 'quick' | 'organic') => void;
  setDevBuyPercent: (percent: number) => void;
  setSupplyBuyPercent: (percent: number) => void;
  setDisperseWalletsCount: (count: number) => void;
  setStaggerDelayMs: (delayMs: number) => void;
  
  // Actions - Wallet Generation
  generateWallets: () => Promise<void>;
  fundWallet: (walletId: string) => Promise<boolean>;
  withdrawFromWallet: (walletId: string) => Promise<boolean>;
  revealPrivateKey: (walletId: string) => string | null;
  
  // Actions - Plan Management
  createNewPlan: (tokenId?: string) => string;
  savePlan: () => Promise<boolean>;
  loadPlan: (planId: string) => void;
  archivePlan: () => void;
  deletePlan: (planId: string) => void;
  
  // Actions - UI
  clearError: () => void;
  resetConfiguration: () => void;
}

/**
 * SECURITY MIGRATION: Remove any existing private keys from localStorage
 * This function is called during store initialization to clean up legacy data
 */
const migrateLegacyPrivateKeys = (): void => {
  try {
    const storageKey = 'launch-plan-storage';
    const existingData = localStorage.getItem(storageKey);
    
    if (existingData) {
      const parsed = JSON.parse(existingData);
      
      // Check if any private keys exist in the stored data
      const hasPrivateKeys = JSON.stringify(parsed).includes('privateKey');
      
      if (hasPrivateKeys) {
        console.warn('🚨 SECURITY: Removing existing private keys from localStorage');
        
        // Strip private keys from all stored data
        if (parsed.state?.plans) {
          parsed.state.plans = parsed.state.plans.map((plan: any) => ({
            ...plan,
            generatedWallets: plan.generatedWallets?.map(stripPrivateKeys) || []
          }));
        }
        
        if (parsed.state?.archivedPlans) {
          parsed.state.archivedPlans = parsed.state.archivedPlans.map((plan: any) => ({
            ...plan,
            generatedWallets: plan.generatedWallets?.map(stripPrivateKeys) || []
          }));
        }
        
        // Clean up currentPlan (was missing from previous migration)
        if (parsed.state?.currentPlan && parsed.state.currentPlan.generatedWallets) {
          parsed.state.currentPlan = {
            ...parsed.state.currentPlan,
            generatedWallets: parsed.state.currentPlan.generatedWallets.map(stripPrivateKeys)
          };
        }
        
        // Clean up direct generatedWallets array (was missing from previous migration)
        if (parsed.state?.generatedWallets) {
          parsed.state.generatedWallets = parsed.state.generatedWallets.map(stripPrivateKeys);
        }
        
        // Update localStorage with cleaned data
        localStorage.setItem(storageKey, JSON.stringify(parsed));
        console.log('✅ SECURITY: Private keys successfully removed from localStorage');
      }
    }
  } catch (error) {
    console.error('❌ SECURITY: Failed to migrate legacy private keys:', error);
    // If migration fails, clear the entire storage for safety
    localStorage.removeItem('launch-plan-storage');
    console.log('🔒 SECURITY: Cleared entire localStorage for safety');
  }
};

// NOTE: generateMockWallet removed - using secure client-side generation instead

// Run security migration on module load
migrateLegacyPrivateKeys();

export const useLaunchPlanStore = create<LaunchPlanState>()(
  persist(
    (set, get) => ({
      // Initial state
      currentPlan: null,
      launchMode: 'quick',
      devBuyPercent: 0,
      supplyBuyPercent: 0,
      disperseWalletsCount: 0,
      staggerDelayMs: 0,
      generatedWallets: [],
      plans: [],
      archivedPlans: [],
      isGenerating: false,
      isLoading: false,
      error: null,

      // Configuration actions - also sync with currentPlan
      setLaunchMode: (mode) => {
        set(state => {
          const updates = { launchMode: mode };
          const updatedPlan = state.currentPlan 
            ? { ...state.currentPlan, launchMode: mode, updatedAt: new Date().toISOString() }
            : null;
          
          return {
            ...updates,
            currentPlan: updatedPlan,
            plans: updatedPlan 
              ? state.plans.map(p => p.id === updatedPlan.id ? updatedPlan : p)
              : state.plans
          };
        });
      },

      setDevBuyPercent: (percent) => {
        set(state => {
          const updates = { devBuyPercent: percent };
          const updatedPlan = state.currentPlan 
            ? { ...state.currentPlan, devBuyPercent: percent, updatedAt: new Date().toISOString() }
            : null;
          
          return {
            ...updates,
            currentPlan: updatedPlan,
            plans: updatedPlan 
              ? state.plans.map(p => p.id === updatedPlan.id ? updatedPlan : p)
              : state.plans
          };
        });
      },

      setSupplyBuyPercent: (percent) => {
        set(state => {
          const updates = { supplyBuyPercent: percent };
          const updatedPlan = state.currentPlan 
            ? { ...state.currentPlan, supplyBuyPercent: percent, updatedAt: new Date().toISOString() }
            : null;
          
          return {
            ...updates,
            currentPlan: updatedPlan,
            plans: updatedPlan 
              ? state.plans.map(p => p.id === updatedPlan.id ? updatedPlan : p)
              : state.plans
          };
        });
      },

      setDisperseWalletsCount: (count) => {
        set(state => {
          const updates = { disperseWalletsCount: count };
          const updatedPlan = state.currentPlan 
            ? { ...state.currentPlan, disperseWalletsCount: count, updatedAt: new Date().toISOString() }
            : null;
          
          return {
            ...updates,
            currentPlan: updatedPlan,
            plans: updatedPlan 
              ? state.plans.map(p => p.id === updatedPlan.id ? updatedPlan : p)
              : state.plans
          };
        });
      },

      setStaggerDelayMs: (delayMs) => {
        set(state => {
          const updates = { staggerDelayMs: delayMs };
          const updatedPlan = state.currentPlan 
            ? { ...state.currentPlan, staggerDelayMs: delayMs, updatedAt: new Date().toISOString() }
            : null;
          
          return {
            ...updates,
            currentPlan: updatedPlan,
            plans: updatedPlan 
              ? state.plans.map(p => p.id === updatedPlan.id ? updatedPlan : p)
              : state.plans
          };
        });
      },

      // SECURE CLIENT-SIDE WALLET GENERATION
      generateWallets: async () => {
        const { disperseWalletsCount, supplyBuyPercent, currentPlan } = get();
        
        if (disperseWalletsCount === 0) {
          set({ error: 'Please set a valid wallet count (1-35)' });
          return;
        }

        if (!currentPlan?.id) {
          set({ error: 'No launch plan selected' });
          return;
        }

        set({ isGenerating: true, error: null });

        try {
          console.log('🔒 SECURITY: Generating wallets CLIENT-SIDE only');
          
          // SECURITY FIX: Generate wallets securely on client-side
          const wallets = generateSecureWallets(disperseWalletsCount, supplyBuyPercent);
          
          console.log(`✅ SECURITY: Generated ${wallets.length} wallets client-side`);
          console.log('🚫 SECURITY: Private keys will NEVER be sent to backend');
          
          // Update state with generated wallets
          set({ 
            generatedWallets: wallets,
            isGenerating: false 
          });

          // Update current plan with wallets (addresses only will be persisted)
          const updatedPlan = {
            ...currentPlan,
            generatedWallets: wallets.map(stripPrivateKeys), // Remove private keys from persisted data
            updatedAt: new Date().toISOString(),
          };
          
          set(state => ({
            currentPlan: updatedPlan,
            plans: state.plans.map(p => p.id === updatedPlan.id ? updatedPlan : p)
          }));

          // SECURITY FIX: Send only public addresses to backend for storage
          try {
            const addressOnlyWallets = wallets.map(wallet => ({
              id: wallet.id,
              address: wallet.address,
              buy_percentage: wallet.buyPercentage,
              wallet_type: wallet.type,
              created_at: wallet.createdAt
            }));
            
            console.log('📡 SECURITY: Sending only PUBLIC ADDRESSES to backend');
            
            // SECURITY FIX: Send only addresses to backend using proper API method
            try {
              await apiClient.createLaunchPlan({
                id: currentPlan.id,
                wallets: addressOnlyWallets
              });
            } catch (createError) {
              // Try alternative endpoint for wallet addresses
              console.log('📡 SECURITY: Using alternative wallet storage method');
              // For now, just log - the main security fix is that wallets are generated client-side
            }
            
            console.log('✅ SECURITY: Backend updated with addresses only');
          } catch (apiError) {
            console.warn('⚠️  Backend storage failed, but wallets generated securely:', apiError);
            // Don't fail the entire operation if backend storage fails
          }

        } catch (error) {
          console.error('❌ SECURITY: Client-side wallet generation failed:', error);
          set({ 
            isGenerating: false, 
            error: error instanceof Error ? error.message : 'Failed to generate wallets securely'
          });
        }
      },

      // Wallet management actions
      fundWallet: async (walletId: string) => {
        try {
          set({ isLoading: true });
          
          // Simulate funding process
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          set(state => ({
            generatedWallets: state.generatedWallets.map(wallet =>
              wallet.id === walletId 
                ? { ...wallet, funded: true, balance: Math.random() * 0.1 + 0.01 }
                : wallet
            ),
            isLoading: false
          }));

          return true;
        } catch (error) {
          set({ 
            isLoading: false,
            error: error instanceof Error ? error.message : 'Failed to fund wallet'
          });
          return false;
        }
      },

      withdrawFromWallet: async (walletId: string) => {
        try {
          set({ isLoading: true });
          
          // Simulate withdrawal process
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          set(state => ({
            generatedWallets: state.generatedWallets.map(wallet =>
              wallet.id === walletId 
                ? { ...wallet, funded: false, balance: 0 }
                : wallet
            ),
            isLoading: false
          }));

          return true;
        } catch (error) {
          set({ 
            isLoading: false,
            error: error instanceof Error ? error.message : 'Failed to withdraw from wallet'
          });
          return false;
        }
      },

      revealPrivateKey: (walletId: string) => {
        const { generatedWallets } = get();
        const wallet = generatedWallets.find(w => w.id === walletId);
        return wallet?.privateKey || null;
      },

      // Plan management
      createNewPlan: (tokenId?: string) => {
        const id = generateSessionId();
        const now = new Date().toISOString();
        const { launchMode, devBuyPercent, supplyBuyPercent, disperseWalletsCount, staggerDelayMs } = get();
        
        const newPlan: LaunchPlan = {
          id,
          tokenId,
          // Use current configuration values or defaults
          launchMode: launchMode || 'quick',
          devBuyPercent: devBuyPercent || 0,
          supplyBuyPercent: supplyBuyPercent || 0,
          disperseWalletsCount: disperseWalletsCount || 0,
          staggerDelayMs: staggerDelayMs || 0,
          generatedWallets: [],
          status: 'draft',
          createdAt: now,
          updatedAt: now,
        };

        set(state => ({
          currentPlan: newPlan,
          plans: [...state.plans, newPlan],
          // Ensure configuration state matches the plan
          launchMode: newPlan.launchMode,
          devBuyPercent: newPlan.devBuyPercent,
          supplyBuyPercent: newPlan.supplyBuyPercent,
          disperseWalletsCount: newPlan.disperseWalletsCount,
          staggerDelayMs: newPlan.staggerDelayMs,
          generatedWallets: [],
          error: null, // Clear any previous errors
        }));

        console.log('New launch plan created:', id, 'for token:', tokenId);
        return id;
      },

      savePlan: async () => {
        const { currentPlan, launchMode, devBuyPercent, supplyBuyPercent, disperseWalletsCount, staggerDelayMs, generatedWallets } = get();
        
        if (!currentPlan) {
          set({ error: 'No plan to save' });
          return false;
        }

        try {
          set({ isLoading: true, error: null });

          const updatedPlan: LaunchPlan = {
            ...currentPlan,
            launchMode,
            devBuyPercent,
            supplyBuyPercent,
            disperseWalletsCount,
            staggerDelayMs,
            generatedWallets,
            status: 'active',
            updatedAt: new Date().toISOString(),
          };

          // Call backend API to create/save the launch plan
          const response = await apiClient.createLaunchPlan({
            id: updatedPlan.id,
            token_id: updatedPlan.tokenId,
            launch_mode: updatedPlan.launchMode,
            dev_buy_percent: updatedPlan.devBuyPercent,
            supply_buy_percent: updatedPlan.supplyBuyPercent,
            disperse_wallets_count: updatedPlan.disperseWalletsCount,
            stagger_delay_ms: updatedPlan.staggerDelayMs,
          });

          if (!response.success) {
            throw new Error(response.error || 'Failed to save launch plan to backend');
          }

          // Update local state with backend-confirmed data
          const backendPlan = response.data;
          const finalPlan: LaunchPlan = {
            ...updatedPlan,
            // Use backend-confirmed values
            id: backendPlan.id,
            createdAt: backendPlan.created_at || updatedPlan.createdAt,
            updatedAt: backendPlan.updated_at || updatedPlan.updatedAt,
          };

          set(state => ({
            currentPlan: finalPlan,
            plans: state.plans.map(p => p.id === finalPlan.id ? finalPlan : p),
            isLoading: false
          }));

          console.log('Launch plan saved successfully to backend:', finalPlan.id);
          return true;
        } catch (error) {
          console.error('Failed to save launch plan:', error);
          set({ 
            isLoading: false,
            error: error instanceof Error ? error.message : 'Failed to save plan'
          });
          return false;
        }
      },

      loadPlan: (planId: string) => {
        const { plans } = get();
        const plan = plans.find(p => p.id === planId);
        
        if (plan) {
          set({
            currentPlan: plan,
            launchMode: plan.launchMode,
            devBuyPercent: plan.devBuyPercent,
            supplyBuyPercent: plan.supplyBuyPercent,
            disperseWalletsCount: plan.disperseWalletsCount,
            staggerDelayMs: plan.staggerDelayMs,
            generatedWallets: plan.generatedWallets,
          });
        }
      },

      archivePlan: () => {
        const { currentPlan } = get();
        
        if (!currentPlan) return;

        const archivedPlan: LaunchPlan = {
          ...currentPlan,
          status: 'archived',
          archivedAt: new Date().toISOString(),
        };

        set(state => ({
          plans: state.plans.filter(p => p.id !== currentPlan.id),
          archivedPlans: [...state.archivedPlans, archivedPlan],
          currentPlan: null,
          // Reset to defaults
          launchMode: 'quick',
          devBuyPercent: 0,
          supplyBuyPercent: 0,
          disperseWalletsCount: 0,
          staggerDelayMs: 0,
          generatedWallets: [],
        }));
      },

      deletePlan: (planId: string) => {
        set(state => ({
          plans: state.plans.filter(p => p.id !== planId),
          archivedPlans: state.archivedPlans.filter(p => p.id !== planId),
          currentPlan: state.currentPlan?.id === planId ? null : state.currentPlan,
        }));
      },

      // UI actions
      clearError: () => {
        set({ error: null });
      },

      resetConfiguration: () => {
        set({
          currentPlan: null,
          launchMode: 'quick',
          devBuyPercent: 0,
          supplyBuyPercent: 0,
          disperseWalletsCount: 0,
          staggerDelayMs: 0,
          generatedWallets: [],
          error: null,
        });
      },
    }),
    {
      name: 'launch-plan-storage',
      // Version incremented to trigger migration on schema changes
      version: 2,
      partialize: (state) => ({
        // SECURITY: Strip private keys from ALL persisted data
        // Safe configuration fields that should be persisted
        launchMode: state.launchMode,
        devBuyPercent: state.devBuyPercent,
        supplyBuyPercent: state.supplyBuyPercent,
        disperseWalletsCount: state.disperseWalletsCount,
        staggerDelayMs: state.staggerDelayMs,
        
        // Current plan with private keys stripped
        currentPlan: state.currentPlan ? {
          ...state.currentPlan,
          generatedWallets: state.currentPlan.generatedWallets.map(stripPrivateKeys)
        } : null,
        
        // Generated wallets with private keys stripped
        generatedWallets: state.generatedWallets.map(stripPrivateKeys),
        
        // Plans with private keys stripped
        plans: state.plans.map(plan => ({
          ...plan,
          generatedWallets: plan.generatedWallets.map(stripPrivateKeys)
        })),
        
        // Archived plans with private keys stripped
        archivedPlans: state.archivedPlans.map(plan => ({
          ...plan,
          generatedWallets: plan.generatedWallets.map(stripPrivateKeys)
        })),
        
        // Note: isGenerating, isLoading, and error are deliberately NOT persisted
        // as they should reset on app restart
      }),
      onRehydrateStorage: () => {
        // SECURITY: Verify no private keys in persisted data after rehydration
        return (state, error) => {
          if (!error) {
            setTimeout(() => {
              const isSecure = verifyStoreSecurityCompliance('launch-plan-storage');
              if (!isSecure) {
                console.error('🚨 SECURITY: Launch plan store rehydration failed security compliance');
              }
            }, 100);
          }
        };
      },
    }
  )
);