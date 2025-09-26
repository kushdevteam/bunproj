/**
 * Wallet management store using Zustand
 * Handles wallet generation, selection, balance tracking, and secure private key storage
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Wallet as EthersWallet } from 'ethers';
import { apiClient } from '../api/client';
import { 
  stripPrivateKeys,
  generateSecureRandom,
  getSessionPassphrase
} from '../utils/crypto';
import { 
  vaultStoreKey, 
  vaultRetrieveKey, 
  vaultRemoveKey
} from '../utils/encrypted-vault';
import { verifyStoreSecurityCompliance } from '../utils/storage-security';
import { useSessionStore } from './session';
import type { WalletStore, Wallet } from '../types';
import { Role } from '../types';

interface WalletState extends WalletStore {
  // Additional internal state
  lastUpdated: Date | null;
  isLoading: boolean;
  balanceUpdateInProgress: boolean;
  
  // Enhanced actions
  generateWallets: (count: number, passphrase: string, roles?: Role[]) => Promise<void>;
  updateWalletBalance: (address: string, balance: number) => void;
  updateAllBalances: () => Promise<void>;
  getDecryptedPrivateKey: (walletId: string, passphrase: string) => Promise<string | null>;
  getDecryptedPrivateKeyFromSession: (walletId: string) => Promise<string | null>;
  exportWallet: (walletId: string, passphrase: string) => Promise<{ address: string; privateKey: string } | null>;
  exportWalletFromSession: (walletId: string) => Promise<{ address: string; privateKey: string } | null>;
  importWallet: (privateKey: string, passphrase: string, role?: Role) => Promise<void>;
  clearAllWallets: () => void;
  getWalletById: (id: string) => Wallet | undefined;
  getWalletsByRole: (role: Role) => Wallet[];
  getSelectedWalletDetails: () => Wallet[];
  bulkSelectWallets: (walletIds: string[]) => void;
  selectWalletsByRole: (role: Role) => void;
  toggleWalletSelection: (id: string) => void;
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set, get) => ({
      // Initial state
      wallets: [],
      selectedWallets: [],
      isGenerating: false,
      isLoading: false,
      balanceUpdateInProgress: false,
      error: null,
      lastUpdated: null,

      // Generate new wallets
      generateWallets: async (count: number, passphrase: string, roles?: Role[]) => {
        try {
          set({ isGenerating: true, error: null });
          
          // Validate session and passphrase
          const sessionState = useSessionStore.getState();
          if (!sessionState.isUnlocked) {
            throw new Error('Session must be unlocked to generate wallets');
          }
          
          if (!passphrase || passphrase.length < 8) {
            throw new Error('Passphrase must be at least 8 characters long');
          }

          // No longer need backend API for wallet generation - all done client-side for security

          // Generate wallets client-side using ethers.js for cryptographic security
          const newWallets: Wallet[] = [];
          
          for (let i = 0; i < count; i++) {
            // Generate cryptographically secure private key using ethers.js
            const ethersWallet = EthersWallet.createRandom();
            const privateKey = ethersWallet.privateKey;
            const address = ethersWallet.address;
            
            // Generate secure wallet ID
            const walletId = `wallet_${Date.now()}_${Array.from(generateSecureRandom(8)).map(b => b.toString(16).padStart(2, '0')).join('')}`;
            
            // Store private key in encrypted vault with session management
            const sessionState = useSessionStore.getState();
            if (!sessionState.sessionId) throw new Error('Session required for secure storage');
            await vaultStoreKey(walletId, privateKey, sessionState.sessionId, passphrase);
            
            // Create wallet object (without private key in memory)
            const wallet: Wallet = {
              id: walletId,
              publicKey: ethersWallet.signingKey.publicKey,
              address: address, // Address derived from private key - secure!
              balance: 0,
              role: roles?.[i % roles.length] || Role.NUMBERED,
              createdAt: new Date().toISOString(),
              isActive: true,
            };
            
            newWallets.push(wallet);
          }

          // Add to store
          set(state => ({
            wallets: [...state.wallets, ...newWallets],
            isGenerating: false,
            lastUpdated: new Date(),
          }));

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to generate wallets';
          set({ error: errorMessage, isGenerating: false });
          throw error;
        }
      },

      // Add wallets (from external sources)
      addWallets: (wallets: Wallet[]) => {
        // Strip any private keys before storing
        const sanitizedWallets = wallets.map(stripPrivateKeys);
        
        set(state => ({
          wallets: [...state.wallets, ...sanitizedWallets],
          lastUpdated: new Date(),
        }));
      },

      // Remove wallet
      removeWallet: async (id: string) => {
        // Remove private key from encrypted vault
        const sessionState = useSessionStore.getState();
        await vaultRemoveKey(id, sessionState.sessionId || undefined);
        
        set(state => ({
          wallets: state.wallets.filter(w => w.id !== id),
          selectedWallets: state.selectedWallets.filter(wId => wId !== id),
          lastUpdated: new Date(),
        }));
      },

      // Update wallet
      updateWallet: (id: string, updates: Partial<Wallet>) => {
        // Strip private keys from updates
        const sanitizedUpdates = stripPrivateKeys(updates);
        
        set(state => ({
          wallets: state.wallets.map(w => 
            w.id === id ? { ...w, ...sanitizedUpdates } : w
          ),
          lastUpdated: new Date(),
        }));
      },

      // Update single wallet balance
      updateWalletBalance: (address: string, balance: number) => {
        set(state => ({
          wallets: state.wallets.map(w => 
            w.address === address ? { ...w, balance } : w
          ),
          lastUpdated: new Date(),
        }));
      },

      // Update all wallet balances
      updateAllBalances: async () => {
        try {
          set({ balanceUpdateInProgress: true, error: null });
          
          const state = get();
          const addresses = state.wallets.map(w => w.address);
          
          if (addresses.length === 0) {
            set({ balanceUpdateInProgress: false });
            return;
          }

          const response = await apiClient.getWalletBalances(addresses);
          
          if (!response.success || !response.data) {
            throw new Error(response.error || 'Failed to fetch balances');
          }

          // Update balances
          response.data.forEach(({ address, balance }) => {
            get().updateWalletBalance(address, balance);
          });

          set({ balanceUpdateInProgress: false });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to update balances';
          set({ error: errorMessage, balanceUpdateInProgress: false });
        }
      },

      // Wallet selection methods
      selectWallet: (id: string) => {
        set(state => ({
          selectedWallets: state.selectedWallets.includes(id) 
            ? state.selectedWallets 
            : [...state.selectedWallets, id]
        }));
      },

      deselectWallet: (id: string) => {
        set(state => ({
          selectedWallets: state.selectedWallets.filter(wId => wId !== id)
        }));
      },

      toggleWalletSelection: (id: string) => {
        const state = get();
        if (state.selectedWallets.includes(id)) {
          state.deselectWallet(id);
        } else {
          state.selectWallet(id);
        }
      },

      clearSelection: () => {
        set({ selectedWallets: [] });
      },

      bulkSelectWallets: (walletIds: string[]) => {
        set({ selectedWallets: [...new Set(walletIds)] });
      },

      selectWalletsByRole: (role: Role) => {
        const state = get();
        const walletsByRole = state.wallets
          .filter(w => w.role === role)
          .map(w => w.id);
        state.bulkSelectWallets(walletsByRole);
      },

      // Get decrypted private key (requires session passphrase)
      getDecryptedPrivateKey: async (walletId: string, passphrase: string): Promise<string | null> => {
        try {
          const sessionState = useSessionStore.getState();
          if (!sessionState.sessionId) {
            throw new Error('Session required for private key access');
          }
          
          const privateKey = await vaultRetrieveKey(walletId, sessionState.sessionId, passphrase);
          if (!privateKey) {
            return null;
          }

          return privateKey;
        } catch (error) {
          console.error('Failed to decrypt private key:', error);
          return null;
        }
      },

      // Get decrypted private key using session (secure, no additional passphrase required)
      getDecryptedPrivateKeyFromSession: async (walletId: string): Promise<string | null> => {
        try {
          // Check if session is unlocked
          const sessionState = useSessionStore.getState();
          if (!sessionState.isUnlocked || !sessionState.sessionId) {
            throw new Error('Session is locked - please unlock to access wallet keys');
          }

          // SECURITY FIX: Use securely stored passphrase from memory
          // This ensures wallet keys can only be decrypted if the user has properly unlocked their session
          // and the passphrase exists in memory (never persisted to storage)
          
          const sessionPassphrase = getSessionPassphrase(sessionState.sessionId);
          if (!sessionPassphrase) {
            throw new Error('Session passphrase not available. Please unlock your session again to access wallet keys.');
          }
          
          try {
            // Use the encrypted vault with session management for decryption
            const privateKey = await vaultRetrieveKey(walletId, sessionState.sessionId, sessionPassphrase);
            if (!privateKey) {
              return null;
            }
            return privateKey;
          } catch (decryptError) {
            // Decryption failed - wallet may have been encrypted with different passphrase
            console.warn('Failed to decrypt wallet with session passphrase. May have been encrypted with different passphrase.');
            throw new Error('Unable to decrypt wallet. The wallet may have been encrypted with a different passphrase than the current session.');
          }
        } catch (error) {
          console.error('Failed to decrypt private key from session:', error);
          return null;
        }
      },

      // Export wallet with private key
      exportWallet: async (walletId: string, passphrase: string) => {
        try {
          const state = get();
          const wallet = state.wallets.find(w => w.id === walletId);
          if (!wallet) {
            throw new Error('Wallet not found');
          }

          const privateKey = await state.getDecryptedPrivateKey(walletId, passphrase);
          if (!privateKey) {
            throw new Error('Failed to decrypt private key');
          }

          return {
            address: wallet.address,
            privateKey,
          };
        } catch (error) {
          console.error('Failed to export wallet:', error);
          return null;
        }
      },

      // Export wallet using session (no passphrase required)
      exportWalletFromSession: async (walletId: string) => {
        try {
          const state = get();
          const wallet = state.wallets.find(w => w.id === walletId);
          if (!wallet) {
            throw new Error('Wallet not found');
          }

          const privateKey = await state.getDecryptedPrivateKeyFromSession(walletId);
          if (!privateKey) {
            throw new Error('Failed to decrypt private key from session');
          }

          return {
            address: wallet.address,
            privateKey,
          };
        } catch (error) {
          console.error('Failed to export wallet from session:', error);
          return null;
        }
      },

      // Import wallet from private key
      importWallet: async (privateKey: string, passphrase: string, role: Role = Role.NUMBERED) => {
        try {
          // Validate inputs
          if (!passphrase || passphrase.length < 8) {
            throw new Error('Passphrase must be at least 8 characters long');
          }
          
          if (!privateKey || !privateKey.startsWith('0x') || privateKey.length !== 66) {
            throw new Error('Invalid private key format');
          }
          
          // Create ethers wallet from private key to derive address securely
          const ethersWallet = new EthersWallet(privateKey);
          const address = ethersWallet.address;
          const publicKey = ethersWallet.signingKey.publicKey;
          
          // Generate secure wallet ID
          const walletId = `imported_${Date.now()}_${Array.from(generateSecureRandom(8)).map(b => b.toString(16).padStart(2, '0')).join('')}`;
          
          // Store private key in encrypted vault
          const sessionState = useSessionStore.getState();
          if (!sessionState.sessionId) throw new Error('Session required for secure storage');
          await vaultStoreKey(walletId, privateKey, sessionState.sessionId, passphrase);
          
          // Create wallet object
          const wallet: Wallet = {
            id: walletId,
            publicKey: publicKey,
            address: address, // Address derived from private key - secure!
            balance: 0,
            role,
            createdAt: new Date().toISOString(),
            isActive: true,
          };
          
          // Add to store
          get().addWallets([wallet]);
          
          // Update balance
          await get().updateAllBalances();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to import wallet';
          set({ error: errorMessage });
          throw error;
        }
      },

      // Helper methods
      getWalletById: (id: string) => {
        return get().wallets.find(w => w.id === id);
      },

      getWalletsByRole: (role: Role) => {
        return get().wallets.filter(w => w.role === role);
      },

      getSelectedWalletDetails: () => {
        const state = get();
        return state.wallets.filter(w => state.selectedWallets.includes(w.id));
      },

      // Clear all wallets and encrypted data
      clearAllWallets: async () => {
        const state = get();
        
        // Remove all private keys from encrypted vault
        const sessionState = useSessionStore.getState();
        await Promise.all(
          state.wallets.map(wallet => 
            vaultRemoveKey(wallet.id, sessionState.sessionId || undefined)
          )
        );
        
        set({
          wallets: [],
          selectedWallets: [],
          error: null,
          lastUpdated: new Date(),
        });
      },

      // Set error
      setError: (error: string | null) => {
        set({ error });
      },
    }),
    {
      name: 'bnb-bundler-wallets',
      partialize: (state) => ({
        // Only persist non-sensitive data
        wallets: state.wallets.map(stripPrivateKeys),
        selectedWallets: state.selectedWallets,
        lastUpdated: state.lastUpdated,
      }),
      onRehydrateStorage: () => {
        // SECURITY: Verify no private keys in persisted wallet data after rehydration
        return (state, error) => {
          if (!error) {
            setTimeout(() => {
              const isSecure = verifyStoreSecurityCompliance('bnb-bundler-wallets');
              if (!isSecure) {
                console.error('🚨 SECURITY: Wallet store rehydration failed security compliance');
              }
            }, 100);
          }
        };
      },
    }
  )
);

// Auto-balance update hook
let balanceUpdateInterval: NodeJS.Timeout | null = null;

export const startBalanceMonitoring = (intervalMs: number = 30000): void => {
  if (balanceUpdateInterval) {
    clearInterval(balanceUpdateInterval);
  }
  
  balanceUpdateInterval = setInterval(() => {
    const state = useWalletStore.getState();
    const sessionState = useSessionStore.getState();
    
    if (sessionState.isUnlocked && state.wallets.length > 0 && !state.balanceUpdateInProgress) {
      state.updateAllBalances().catch(error => {
        console.error('Auto balance update failed:', error);
      });
    }
  }, intervalMs);
};

export const stopBalanceMonitoring = (): void => {
  if (balanceUpdateInterval) {
    clearInterval(balanceUpdateInterval);
    balanceUpdateInterval = null;
  }
};