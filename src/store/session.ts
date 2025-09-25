/**
 * Session management store using Zustand
 * Handles user authentication, session locking/unlocking, and encrypted storage
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { config } from '../config/env';
import {
  generateSessionId,
  hashPassphrase,
  initializeCrypto,
  isCryptoSupported,
  createSessionKey,
  clearSessionKey,
  storeSessionPassphrase,
} from '../utils/crypto';
import type { SessionStore } from '../types';

interface SessionState extends SessionStore {
  // Additional internal state
  passphraseHash: string | null;
  lastActivity: Date | null;
  isInitialized: boolean;
  error: string | null;
  
  // Actions
  initialize: () => Promise<void>;
  setError: (error: string | null) => void;
  refreshActivity: () => void;
  getTimeUntilExpiry: () => number;
  clearSession: () => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      // Initial state
      isUnlocked: false,
      sessionId: null,
      expiresAt: null,
      passphraseHash: null,
      lastActivity: null,
      isInitialized: false,
      error: null,

      // Initialize crypto and session
      initialize: async () => {
        try {
          if (!isCryptoSupported()) {
            throw new Error('Web Crypto API not supported');
          }
          
          initializeCrypto();
          set({ isInitialized: true, error: null });
          
          // Check if session is still valid
          const state = get();
          if (state.sessionId && state.expiresAt) {
            const now = new Date();
            const expiry = new Date(state.expiresAt);
            
            if (now > expiry) {
              // Session expired, clear it
              get().clearSession();
            }
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Initialization failed';
          set({ error: errorMessage, isInitialized: false });
          throw error;
        }
      },

      // Unlock session with passphrase
      unlock: async (passphrase: string): Promise<boolean> => {
        try {
          if (!get().isInitialized) {
            await get().initialize();
          }

          const state = get();
          
          // If no previous session, create new one
          if (!state.passphraseHash) {
            const hash = await hashPassphrase(passphrase);
            const sessionId = generateSessionId();
            const expiresAt = new Date(Date.now() + config.security.sessionTimeout);
            
            // Create session key for wallet decryption
            await createSessionKey(sessionId, passphrase);
            
            // Store passphrase securely in memory for wallet decryption
            storeSessionPassphrase(sessionId, passphrase);
            
            set({
              isUnlocked: true,
              sessionId,
              expiresAt,
              passphraseHash: hash,
              lastActivity: new Date(),
              error: null,
            });
            
            return true;
          }
          
          // Validate existing session
          const hash = await hashPassphrase(passphrase);
          if (hash === state.passphraseHash) {
            // Extend session and recreate session key
            const expiresAt = new Date(Date.now() + config.security.sessionTimeout);
            
            // Recreate session key for this unlock and store passphrase
            if (state.sessionId) {
              await createSessionKey(state.sessionId, passphrase);
              storeSessionPassphrase(state.sessionId, passphrase);
            }
            
            set({
              isUnlocked: true,
              expiresAt,
              lastActivity: new Date(),
              error: null,
            });
            
            return true;
          } else {
            set({ error: 'Invalid passphrase' });
            return false;
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unlock failed';
          set({ error: errorMessage });
          return false;
        }
      },

      // Lock session
      lock: () => {
        const state = get();
        
        // Clear session key from memory
        if (state.sessionId) {
          clearSessionKey(state.sessionId);
        }
        
        set({
          isUnlocked: false,
          lastActivity: new Date(),
          error: null,
        });
      },

      // Extend session (called on user activity)
      extendSession: () => {
        const state = get();
        if (state.isUnlocked && state.isSessionValid()) {
          const expiresAt = new Date(Date.now() + config.security.sessionTimeout);
          set({
            expiresAt,
            lastActivity: new Date(),
          });
        }
      },

      // Check if session is still valid
      isSessionValid: (): boolean => {
        const state = get();
        if (!state.sessionId || !state.expiresAt || !state.isUnlocked) {
          return false;
        }
        
        const now = new Date();
        const expiry = new Date(state.expiresAt);
        return now <= expiry;
      },

      // Refresh last activity timestamp
      refreshActivity: () => {
        if (get().isUnlocked) {
          set({ lastActivity: new Date() });
        }
      },

      // Get time until session expires (in milliseconds)
      getTimeUntilExpiry: (): number => {
        const state = get();
        if (!state.expiresAt) return 0;
        
        const now = new Date().getTime();
        const expiry = new Date(state.expiresAt).getTime();
        return Math.max(0, expiry - now);
      },

      // Set error message
      setError: (error: string | null) => {
        set({ error });
      },

      // Clear entire session
      clearSession: () => {
        const state = get();
        
        // Clear session key from memory
        if (state.sessionId) {
          clearSessionKey(state.sessionId);
        }
        
        set({
          isUnlocked: false,
          sessionId: null,
          expiresAt: null,
          passphraseHash: null,
          lastActivity: null,
          error: null,
        });
      },
    }),
    {
      name: 'bnb-bundler-session',
      partialize: (state) => ({
        sessionId: state.sessionId,
        expiresAt: state.expiresAt,
        passphraseHash: state.passphraseHash,
        lastActivity: state.lastActivity,
      }),
    }
  )
);

// Session activity monitor
let activityTimer: NodeJS.Timeout | null = null;

export const startSessionMonitoring = (): void => {
  if (activityTimer) {
    clearInterval(activityTimer);
  }
  
  // Check session validity every minute
  activityTimer = setInterval(() => {
    const state = useSessionStore.getState();
    
    if (state.isUnlocked && !state.isSessionValid()) {
      console.warn('Session expired, locking automatically');
      state.lock();
    }
  }, 60000); // Check every minute
};

export const stopSessionMonitoring = (): void => {
  if (activityTimer) {
    clearInterval(activityTimer);
    activityTimer = null;
  }
};

// Activity tracker for auto-extending session
export const trackUserActivity = (): void => {
  const state = useSessionStore.getState();
  if (state.isUnlocked) {
    state.refreshActivity();
    
    // Extend session if more than half the timeout has passed
    const timeUntilExpiry = state.getTimeUntilExpiry();
    const halfTimeout = config.security.sessionTimeout / 2;
    
    if (timeUntilExpiry < halfTimeout) {
      state.extendSession();
    }
  }
};

// Set up global activity listeners
export const setupActivityListeners = (): void => {
  const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
  
  events.forEach(event => {
    document.addEventListener(event, trackUserActivity, { passive: true });
  });
};

// Clean up activity listeners
export const cleanupActivityListeners = (): void => {
  const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
  
  events.forEach(event => {
    document.removeEventListener(event, trackUserActivity);
  });
};