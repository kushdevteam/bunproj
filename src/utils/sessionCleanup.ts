/**
 * Session and Data Cleanup Utilities
 * Comprehensive cleanup functions to clear all user sessions and data
 * while preserving only the admin access key.
 */

import { 
  secureClearAll, 
  clearAllSessionKeys, 
  clearAllSessionPassphrases 
} from './crypto';
import { useSessionStore } from '../store/session';
import { useUserStore } from '../store/users';

// Default admin access key that should be preserved
const DEFAULT_ADMIN_ACCESS_KEY = 'WLSFX-ADM7WWGB2Dm0RuKqMLw';

// All localStorage keys used by the application
const LOCALSTORAGE_KEYS = [
  'bnb-bundler-session',
  'user-management-store', 
  'bnb-bundler-wallets',
  'bnb-bundler-config',
  'bnb-bundler-network',
  'bnb-bundler-analytics',
  'launch-store',
  'wallet-funding-store',
  'treasury-store',
  'bundle-presets-storage',
  'funding-store',
  'faucet-store',
  'execution-store',
  'launch-plan-storage',
  'transaction-store',
];

/**
 * Clear all localStorage data for the application
 */
export const clearAllLocalStorage = (): void => {
  console.log('🧹 Clearing all localStorage data...');
  
  // Clear specific application keys
  LOCALSTORAGE_KEYS.forEach(key => {
    try {
      localStorage.removeItem(key);
      console.log(`✅ Cleared localStorage key: ${key}`);
    } catch (error) {
      console.warn(`⚠️ Failed to clear localStorage key ${key}:`, error);
    }
  });
  
  // Also clear any keys that might have been created with different naming
  const allKeys = Object.keys(localStorage);
  allKeys.forEach(key => {
    if (key.includes('bnb-bundler') || key.includes('wallet') || key.includes('user')) {
      try {
        localStorage.removeItem(key);
        console.log(`✅ Cleared additional localStorage key: ${key}`);
      } catch (error) {
        console.warn(`⚠️ Failed to clear additional key ${key}:`, error);
      }
    }
  });
  
  console.log('✅ All localStorage data cleared');
};

/**
 * Clear all IndexedDB data 
 */
export const clearAllIndexedDB = async (): Promise<void> => {
  console.log('🧹 Clearing all IndexedDB data...');
  
  try {
    await secureClearAll();
    console.log('✅ All IndexedDB encrypted data cleared');
  } catch (error) {
    console.error('❌ Failed to clear IndexedDB data:', error);
    throw error;
  }
};

/**
 * Clear all in-memory session data
 */
export const clearAllInMemoryData = (): void => {
  console.log('🧹 Clearing all in-memory session data...');
  
  try {
    // Clear session keys and passphrases
    clearAllSessionKeys();
    clearAllSessionPassphrases();
    console.log('✅ All in-memory session data cleared');
  } catch (error) {
    console.error('❌ Failed to clear in-memory data:', error);
    throw error;
  }
};

/**
 * Reset user store to initial state with only admin access key
 */
export const resetUserStoreToDefaults = (): void => {
  console.log('🧹 Resetting user store to defaults...');
  
  try {
    const userStore = useUserStore.getState();
    
    // Clear current session
    userStore.logout();
    
    // Reset to initial state using the store's reset method
    userStore.reset();
    
    console.log('✅ User store reset to defaults with admin access key preserved');
  } catch (error) {
    console.error('❌ Failed to reset user store:', error);
    throw error;
  }
};

/**
 * Reset session store to initial state
 */
export const resetSessionStore = (): void => {
  console.log('🧹 Resetting session store...');
  
  try {
    const sessionStore = useSessionStore.getState();
    sessionStore.clearSession();
    console.log('✅ Session store cleared');
  } catch (error) {
    console.error('❌ Failed to reset session store:', error);
    throw error;
  }
};

/**
 * Comprehensive cleanup of all user sessions and data
 * Preserves only the admin access key
 */
export const performCompleteCleanup = async (): Promise<void> => {
  console.log('🚀 Starting complete system cleanup...');
  
  try {
    // 1. Clear in-memory data first (session keys, passphrases)
    clearAllInMemoryData();
    
    // 2. Clear persistent storage (localStorage)
    clearAllLocalStorage();
    
    // 3. Clear encrypted storage (IndexedDB) 
    await clearAllIndexedDB();
    
    // 4. Reset store states
    resetSessionStore();
    resetUserStoreToDefaults();
    
    console.log('🎉 Complete system cleanup successful!');
    console.log('ℹ️ Only admin access key preserved:', DEFAULT_ADMIN_ACCESS_KEY);
    
  } catch (error) {
    console.error('❌ Complete cleanup failed:', error);
    throw error;
  }
};

/**
 * Enhanced logout function that properly clears all session data
 */
export const performSecureLogout = async (): Promise<void> => {
  console.log('🔐 Performing secure logout...');
  
  try {
    const sessionStore = useSessionStore.getState();
    const userStore = useUserStore.getState();
    
    // Get current session ID before clearing
    const currentSessionId = sessionStore.sessionId;
    
    // Clear in-memory session data
    if (currentSessionId) {
      clearAllSessionKeys();
      clearAllSessionPassphrases();
    }
    
    // Clear store sessions
    sessionStore.clearSession();
    userStore.logout();
    
    console.log('✅ Secure logout completed');
    
  } catch (error) {
    console.error('❌ Secure logout failed:', error);
    throw error;
  }
};

/**
 * Verify cleanup was successful
 */
export const verifyCleanupSuccess = (): boolean => {
  console.log('🔍 Verifying cleanup success...');
  
  try {
    const sessionStore = useSessionStore.getState();
    const userStore = useUserStore.getState();
    
    // Check session store is clean
    const sessionClean = !sessionStore.isUnlocked && 
                        !sessionStore.sessionId && 
                        !sessionStore.passphraseHash;
    
    // Check user store is clean  
    const userClean = !userStore.currentSession &&
                     userStore.users.length === 0 &&
                     userStore.adminAccessKey === DEFAULT_ADMIN_ACCESS_KEY;
    
    // Check localStorage is clean
    const hasSessionData = LOCALSTORAGE_KEYS.some(key => localStorage.getItem(key) !== null);
    
    const success = sessionClean && userClean && !hasSessionData;
    
    console.log('📊 Cleanup verification results:');
    console.log(`  Session store clean: ${sessionClean}`);
    console.log(`  User store clean: ${userClean}`);
    console.log(`  LocalStorage clean: ${!hasSessionData}`);
    console.log(`  Overall success: ${success}`);
    
    return success;
    
  } catch (error) {
    console.error('❌ Cleanup verification failed:', error);
    return false;
  }
};

// Export for easy access
export {
  DEFAULT_ADMIN_ACCESS_KEY,
  LOCALSTORAGE_KEYS,
};