/**
 * User Management Store with Username + PIN Authentication
 * Handles user registration, authentication, admin functionality, and session isolation
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { encryptPrivateKey, decryptPrivateKey, generateSecureRandom } from '../utils/crypto';
import { useSessionStore } from './session';

// User role types
export type UserRole = 'admin' | 'user';

// User interface
export interface User {
  id: string;
  username: string;
  role: UserRole;
  createdAt: Date;
  lastLoginAt?: Date;
  isActive: boolean;
  encryptedPinHash: string; // PIN is encrypted and hashed for security
  sessionData?: {
    wallets: string[];
    preferences: Record<string, any>;
    lastActivity: Date;
  };
}

// Session interface for current user
export interface UserSession {
  user: User;
  loginAt: Date;
  lastActivity: Date;
  sessionId: string;
  isAuthenticated: boolean;
}

// Authentication request interfaces
export interface LoginRequest {
  username: string;
  pin: string;
}

export interface AccessKey {
  id: string;
  key: string;
  label: string;
  role: UserRole;
  createdAt: Date;
  createdBy: string;
  lastUsedAt?: Date;
  isActive: boolean;
  expiresAt?: Date;
}

export interface CreateUserRequest {
  username: string;
  pin: string;
  role: UserRole;
}

// Store state interface
interface UserStore {
  // State
  users: User[];
  currentSession: UserSession | null;
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Admin configuration
  adminCredentials: {
    username: string;
    pin: string;
  };
  
  // Access Keys
  accessKeys: AccessKey[];
  adminAccessKey: string;
  
  // Actions - Authentication
  login: (request: LoginRequest) => Promise<boolean>;
  loginWithAccessKey: (accessKey: string) => Promise<boolean>;
  logout: () => void;
  
  // Actions - User Management (Admin only)
  createUser: (request: CreateUserRequest) => Promise<boolean>;
  updateUser: (userId: string, updates: Partial<User>) => Promise<boolean>;
  deleteUser: (userId: string) => Promise<boolean>;
  toggleUserStatus: (userId: string) => Promise<boolean>;
  
  // Actions - Access Key Management (Admin only)
  createAccessKey: (label: string, role: UserRole, expiresAt?: Date) => Promise<string>;
  updateAccessKey: (keyId: string, updates: Partial<AccessKey>) => Promise<boolean>;
  deleteAccessKey: (keyId: string) => Promise<boolean>;
  toggleAccessKeyStatus: (keyId: string) => Promise<boolean>;
  
  // Actions - Session Management
  updateSessionActivity: () => void;
  clearUserSession: (userId: string) => void;
  
  // Actions - Getters
  getUserById: (userId: string) => User | undefined;
  getUserByUsername: (username: string) => User | undefined;
  getAllUsers: () => User[];
  getCurrentUser: () => User | undefined;
  isAdmin: () => boolean;
  isUserLoggedIn: () => boolean;
  
  // Actions - Validation
  validatePin: (pin: string) => boolean;
  validateUsername: (username: string) => boolean;
  isUsernameAvailable: (username: string) => boolean;
  
  // Actions - Security
  hashPin: (pin: string, salt?: string) => Promise<string>;
  verifyPin: (pin: string, hashedPin: string) => Promise<boolean>;
  
  // Actions - Initialize
  initialize: () => Promise<void>;
  reset: () => void;
}

// PIN validation rules
const PIN_RULES = {
  minLength: 6,
  maxLength: 8,
  allowOnlyNumbers: true,
};

// Username validation rules
const USERNAME_RULES = {
  minLength: 3,
  maxLength: 20,
  allowedChars: /^[a-zA-Z0-9_-]+$/,
};

// Default admin credentials
const DEFAULT_ADMIN = {
  username: 'walshadmin',
  pin: '612599',
};

// Default admin access key as requested
const DEFAULT_ADMIN_ACCESS_KEY = 'WLSFX-ADM7WWGB2Dm0RuKqMLw';

// Default user access key for immediate use
const DEFAULT_USER_ACCESS_KEY: AccessKey = {
  id: 'key_1758820507042_0focofo9',
  key: 'JJIT-WLSFmphjwejzPTqe',
  label: 'WLSFX User Access',
  role: 'user' as UserRole,
  createdAt: new Date('2025-09-25T17:15:07.042Z'),
  createdBy: 'admin',
  lastUsedAt: undefined,
  isActive: true,
  expiresAt: undefined,
};

export const useUserStore = create<UserStore>()(
  persist(
    (set, get) => ({
      // Initial state
      users: [],
      currentSession: null,
      isInitialized: false,
      isLoading: false,
      error: null,
      adminCredentials: DEFAULT_ADMIN,
      accessKeys: [DEFAULT_USER_ACCESS_KEY],
      adminAccessKey: DEFAULT_ADMIN_ACCESS_KEY,
      
      // Authentication
      login: async (request: LoginRequest): Promise<boolean> => {
        try {
          set({ isLoading: true, error: null });
          
          const { username, pin } = request;
          
          // Validate input
          if (!get().validateUsername(username) || !get().validatePin(pin)) {
            set({ error: 'Invalid username or PIN format', isLoading: false });
            return false;
          }
          
          // Check for admin login
          if (username === get().adminCredentials.username && pin === get().adminCredentials.pin) {
            const adminUser: User = {
              id: 'admin',
              username: get().adminCredentials.username,
              role: 'admin',
              createdAt: new Date(),
              lastLoginAt: new Date(),
              isActive: true,
              encryptedPinHash: await get().hashPin(pin),
            };
            
            const session: UserSession = {
              user: adminUser,
              loginAt: new Date(),
              lastActivity: new Date(),
              sessionId: `session_${Date.now()}_${generateSecureRandom(8)}`,
              isAuthenticated: true,
            };
            
            set({ currentSession: session, isLoading: false });
            
            // Automatically unlock session with admin PIN
            const sessionStore = useSessionStore.getState();
            await sessionStore.unlock(pin);
            
            console.log('Admin login successful');
            return true;
          }
          
          // Check for regular user login
          const user = get().getUserByUsername(username);
          if (!user) {
            set({ error: 'Username not found', isLoading: false });
            return false;
          }
          
          if (!user.isActive) {
            set({ error: 'Account is deactivated', isLoading: false });
            return false;
          }
          
          // Verify PIN
          const isPinValid = await get().verifyPin(pin, user.encryptedPinHash);
          if (!isPinValid) {
            set({ error: 'Invalid PIN', isLoading: false });
            return false;
          }
          
          // Create session
          const updatedUser = {
            ...user,
            lastLoginAt: new Date(),
          };
          
          const session: UserSession = {
            user: updatedUser,
            loginAt: new Date(),
            lastActivity: new Date(),
            sessionId: `session_${Date.now()}_${generateSecureRandom(8)}`,
            isAuthenticated: true,
          };
          
          // Update user in store
          const updatedUsers = get().users.map(u => u.id === user.id ? updatedUser : u);
          set({ 
            users: updatedUsers,
            currentSession: session, 
            isLoading: false 
          });
          
          // Automatically unlock session with user PIN
          const sessionStore = useSessionStore.getState();
          await sessionStore.unlock(pin);
          
          console.log(`User login successful: ${username}`);
          return true;
          
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Login failed';
          set({ error: errorMessage, isLoading: false });
          console.error('Login error:', error);
          return false;
        }
      },

      // Access Key Authentication
      loginWithAccessKey: async (accessKey: string): Promise<boolean> => {
        try {
          set({ isLoading: true, error: null });
          
          // Validate access key format
          if (!accessKey || accessKey.length < 10) {
            set({ error: 'Invalid access key format', isLoading: false });
            return false;
          }
          
          // Check for admin access key
          if (accessKey === get().adminAccessKey) {
            const adminUser: User = {
              id: 'admin',
              username: 'admin',
              role: 'admin',
              createdAt: new Date(),
              lastLoginAt: new Date(),
              isActive: true,
              encryptedPinHash: await get().hashPin('000000'), // Dummy hash for access key login
            };
            
            const session: UserSession = {
              user: adminUser,
              loginAt: new Date(),
              lastActivity: new Date(),
              sessionId: `session_${Date.now()}_${generateSecureRandom(8)}`,
              isAuthenticated: true,
            };
            
            set({ currentSession: session, isLoading: false });
            
            // Clear any existing session state and unlock with access key 
            const sessionStore = useSessionStore.getState();
            sessionStore.clearSession(); // Clear any previous session data
            await sessionStore.unlock(accessKey);
            
            console.log('Admin access key login successful');
            return true;
          }
          
          // Check for other access keys
          const validAccessKey = get().accessKeys.find(
            key => key.key === accessKey && key.isActive && 
            (!key.expiresAt || new Date() < key.expiresAt)
          );
          
          if (validAccessKey) {
            const user: User = {
              id: validAccessKey.id,
              username: validAccessKey.label,
              role: validAccessKey.role,
              createdAt: validAccessKey.createdAt,
              lastLoginAt: new Date(),
              isActive: true,
              encryptedPinHash: await get().hashPin('000000'), // Dummy hash for access key login
            };
            
            const session: UserSession = {
              user,
              loginAt: new Date(),
              lastActivity: new Date(),
              sessionId: `session_${Date.now()}_${generateSecureRandom(8)}`,
              isAuthenticated: true,
            };
            
            // Update last used date
            const updatedAccessKeys = get().accessKeys.map(key =>
              key.id === validAccessKey.id ? { ...key, lastUsedAt: new Date() } : key
            );
            
            set({ 
              currentSession: session, 
              accessKeys: updatedAccessKeys,
              isLoading: false 
            });
            
            // Clear any existing session state and unlock with access key 
            const sessionStore = useSessionStore.getState();
            sessionStore.clearSession(); // Clear any previous session data
            await sessionStore.unlock(accessKey);
            
            console.log(`Access key login successful: ${validAccessKey.label}`);
            return true;
          }
          
          set({ error: 'Invalid or expired access key', isLoading: false });
          return false;
          
        } catch (error) {
          console.error('Access key login error:', error);
          set({ error: 'Authentication failed', isLoading: false });
          return false;
        }
      },
      
      logout: () => {
        const currentUser = get().getCurrentUser();
        if (currentUser) {
          console.log(`User logout: ${currentUser.username}`);
        }
        
        // Automatically lock the session
        const sessionStore = useSessionStore.getState();
        sessionStore.lock();
        
        // Clear current session
        set({ currentSession: null, error: null });
        
        // Clear in-memory session data from crypto utils
        try {
          const { clearAllSessionKeys, clearAllSessionPassphrases } = require('../utils/crypto');
          clearAllSessionKeys();
          clearAllSessionPassphrases();
        } catch (error) {
          console.warn('Failed to clear crypto session data:', error);
        }
      },
      
      // User Management (Admin only)
      createUser: async (request: CreateUserRequest): Promise<boolean> => {
        try {
          if (!get().isAdmin()) {
            set({ error: 'Admin access required' });
            return false;
          }
          
          set({ isLoading: true, error: null });
          
          const { username, pin, role } = request;
          
          // Validate input
          if (!get().validateUsername(username)) {
            set({ error: 'Invalid username format', isLoading: false });
            return false;
          }
          
          if (!get().validatePin(pin)) {
            set({ error: 'Invalid PIN format', isLoading: false });
            return false;
          }
          
          if (!get().isUsernameAvailable(username)) {
            set({ error: 'Username already exists', isLoading: false });
            return false;
          }
          
          // Create user
          const encryptedPinHash = await get().hashPin(pin);
          const newUser: User = {
            id: `user_${Date.now()}_${generateSecureRandom(8)}`,
            username,
            role,
            createdAt: new Date(),
            isActive: true,
            encryptedPinHash,
          };
          
          const updatedUsers = [...get().users, newUser];
          set({ users: updatedUsers, isLoading: false });
          
          console.log(`User created successfully: ${username}`);
          return true;
          
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'User creation failed';
          set({ error: errorMessage, isLoading: false });
          console.error('User creation error:', error);
          return false;
        }
      },
      
      updateUser: async (userId: string, updates: Partial<User>): Promise<boolean> => {
        try {
          if (!get().isAdmin()) {
            set({ error: 'Admin access required' });
            return false;
          }
          
          const user = get().getUserById(userId);
          if (!user) {
            set({ error: 'User not found' });
            return false;
          }
          
          const updatedUsers = get().users.map(u => 
            u.id === userId ? { ...u, ...updates } : u
          );
          
          set({ users: updatedUsers });
          console.log(`User updated: ${user.username}`);
          return true;
          
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'User update failed';
          set({ error: errorMessage });
          console.error('User update error:', error);
          return false;
        }
      },
      
      deleteUser: async (userId: string): Promise<boolean> => {
        try {
          if (!get().isAdmin()) {
            set({ error: 'Admin access required' });
            return false;
          }
          
          const user = get().getUserById(userId);
          if (!user) {
            set({ error: 'User not found' });
            return false;
          }
          
          // Don't allow deleting admin
          if (user.role === 'admin') {
            set({ error: 'Cannot delete admin user' });
            return false;
          }
          
          const updatedUsers = get().users.filter(u => u.id !== userId);
          set({ users: updatedUsers });
          
          console.log(`User deleted: ${user.username}`);
          return true;
          
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'User deletion failed';
          set({ error: errorMessage });
          console.error('User deletion error:', error);
          return false;
        }
      },
      
      toggleUserStatus: async (userId: string): Promise<boolean> => {
        try {
          if (!get().isAdmin()) {
            set({ error: 'Admin access required' });
            return false;
          }
          
          const user = get().getUserById(userId);
          if (!user) {
            set({ error: 'User not found' });
            return false;
          }
          
          return await get().updateUser(userId, { isActive: !user.isActive });
          
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Status toggle failed';
          set({ error: errorMessage });
          console.error('Status toggle error:', error);
          return false;
        }
      },
      
      // Session Management
      updateSessionActivity: () => {
        const currentSession = get().currentSession;
        if (currentSession) {
          set({
            currentSession: {
              ...currentSession,
              lastActivity: new Date(),
            }
          });
        }
      },
      
      clearUserSession: (userId: string) => {
        const updatedUsers = get().users.map(user => {
          if (user.id === userId) {
            return {
              ...user,
              sessionData: undefined,
            };
          }
          return user;
        });
        set({ users: updatedUsers });
      },
      
      // Getters
      getUserById: (userId: string): User | undefined => {
        return get().users.find(user => user.id === userId);
      },
      
      getUserByUsername: (username: string): User | undefined => {
        return get().users.find(user => user.username.toLowerCase() === username.toLowerCase());
      },
      
      getAllUsers: (): User[] => {
        return get().users;
      },
      
      getCurrentUser: (): User | undefined => {
        return get().currentSession?.user;
      },
      
      isAdmin: (): boolean => {
        return get().currentSession?.user?.role === 'admin';
      },
      
      isUserLoggedIn: (): boolean => {
        return !!get().currentSession?.isAuthenticated;
      },
      
      // Validation
      validatePin: (pin: string): boolean => {
        if (!pin || typeof pin !== 'string') return false;
        if (pin.length < PIN_RULES.minLength || pin.length > PIN_RULES.maxLength) return false;
        if (PIN_RULES.allowOnlyNumbers && !/^\d+$/.test(pin)) return false;
        return true;
      },
      
      validateUsername: (username: string): boolean => {
        if (!username || typeof username !== 'string') return false;
        if (username.length < USERNAME_RULES.minLength || username.length > USERNAME_RULES.maxLength) return false;
        if (!USERNAME_RULES.allowedChars.test(username)) return false;
        return true;
      },
      
      isUsernameAvailable: (username: string): boolean => {
        // Check against existing users
        const existingUser = get().getUserByUsername(username);
        if (existingUser) return false;
        
        // Check against admin username
        if (username.toLowerCase() === get().adminCredentials.username.toLowerCase()) return false;
        
        return true;
      },
      
      // Security
      hashPin: async (pin: string, salt?: string): Promise<string> => {
        try {
          // Create a salt if not provided
          const pinSalt = salt || generateSecureRandom(16);
          
          // Combine PIN with salt and encode
          const saltedPin = `${pin}_${pinSalt}`;
          const encoder = new TextEncoder();
          const data = encoder.encode(saltedPin);
          
          // Hash the salted PIN
          const hashBuffer = await crypto.subtle.digest('SHA-256', data);
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
          
          // Return salt + hash for storage
          return `${pinSalt}:${hashHex}`;
          
        } catch (error) {
          console.error('PIN hashing error:', error);
          throw new Error('Failed to hash PIN');
        }
      },
      
      verifyPin: async (pin: string, hashedPin: string): Promise<boolean> => {
        try {
          const [salt, hash] = hashedPin.split(':');
          if (!salt || !hash) return false;
          
          const newHash = await get().hashPin(pin, salt);
          return newHash === hashedPin;
          
        } catch (error) {
          console.error('PIN verification error:', error);
          return false;
        }
      },
      
      // Initialize
      initialize: async (): Promise<void> => {
        try {
          set({ isLoading: true, error: null });
          
          // Initialize with default admin if no users exist
          if (get().users.length === 0) {
            console.log('Initializing user store with default admin');
          }
          
          set({ isInitialized: true, isLoading: false });
          console.log('User store initialized successfully');
          
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Initialization failed';
          set({ error: errorMessage, isLoading: false });
          console.error('User store initialization error:', error);
        }
      },
      
      // Access Key Management (Admin only)
      createAccessKey: async (label: string, role: UserRole): Promise<string> => {
        try {
          if (!get().isAdmin()) {
            set({ error: 'Admin access required' });
            return '';
          }

          // Extract first few letters from label (2-4 chars, uppercase)
          const labelPrefix = label.replace(/[^a-zA-Z]/g, '').slice(0, 4).toUpperCase();
          const finalPrefix = labelPrefix.length >= 2 ? labelPrefix : 'USR';
          
          // Generate random alphanumeric characters (12-16 characters)
          const randomLength = 12 + Math.floor(Math.random() * 5); // 12-16 chars
          const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
          let randomSuffix = '';
          for (let i = 0; i < randomLength; i++) {
            randomSuffix += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          
          const newKey = `JJIT-${finalPrefix}${randomSuffix}`;
          const accessKey: AccessKey = {
            id: `key_${Date.now()}_${generateSecureRandom(8)}`,
            key: newKey,
            label,
            role,
            createdAt: new Date(),
            createdBy: get().getCurrentUser()?.id || 'admin',
            lastUsedAt: undefined,
            isActive: true,
            expiresAt: undefined, // Never expires, only manual revoke
          };

          const updatedKeys = [...get().accessKeys, accessKey];
          set({ accessKeys: updatedKeys });
          
          console.log(`✅ Created access key: ${newKey} (Label: ${label})`);
          return newKey;
        } catch (error) {
          console.error('Error creating access key:', error);
          set({ error: 'Failed to create access key' });
          return '';
        }
      },

      updateAccessKey: async (keyId: string, updates: Partial<AccessKey>): Promise<boolean> => {
        try {
          if (!get().isAdmin()) {
            set({ error: 'Admin access required' });
            return false;
          }

          const updatedKeys = get().accessKeys.map(key =>
            key.id === keyId ? { ...key, ...updates } : key
          );

          set({ accessKeys: updatedKeys });
          console.log(`Updated access key: ${keyId}`);
          return true;
        } catch (error) {
          console.error('Error updating access key:', error);
          set({ error: 'Failed to update access key' });
          return false;
        }
      },

      deleteAccessKey: async (keyId: string): Promise<boolean> => {
        try {
          if (!get().isAdmin()) {
            set({ error: 'Admin access required' });
            return false;
          }

          const updatedKeys = get().accessKeys.filter(key => key.id !== keyId);
          set({ accessKeys: updatedKeys });
          
          console.log(`Deleted access key: ${keyId}`);
          return true;
        } catch (error) {
          console.error('Error deleting access key:', error);
          set({ error: 'Failed to delete access key' });
          return false;
        }
      },

      toggleAccessKeyStatus: async (keyId: string): Promise<boolean> => {
        try {
          if (!get().isAdmin()) {
            set({ error: 'Admin access required' });
            return false;
          }

          const updatedKeys = get().accessKeys.map(key =>
            key.id === keyId ? { ...key, isActive: !key.isActive } : key
          );

          set({ accessKeys: updatedKeys });
          console.log(`Toggled access key status: ${keyId}`);
          return true;
        } catch (error) {
          console.error('Error toggling access key status:', error);
          set({ error: 'Failed to toggle access key status' });
          return false;
        }
      },

      reset: () => {
        // Clear all crypto session data first
        try {
          const { clearAllSessionKeys, clearAllSessionPassphrases } = require('../utils/crypto');
          clearAllSessionKeys();
          clearAllSessionPassphrases();
        } catch (error) {
          console.warn('Failed to clear crypto session data on reset:', error);
        }
        
        // Reset to initial state while preserving admin access key AND ALL existing access keys
        const currentAccessKeys = get().accessKeys;
        set({
          users: [],
          currentSession: null,
          isInitialized: false,
          isLoading: false,
          error: null,
          // Preserve ALL existing access keys (don't destroy created keys on reset)
          accessKeys: currentAccessKeys.length > 0 ? currentAccessKeys : [DEFAULT_USER_ACCESS_KEY],
          // Reset admin credentials to defaults
          adminCredentials: DEFAULT_ADMIN,
          // Preserve the admin access key
          adminAccessKey: DEFAULT_ADMIN_ACCESS_KEY,
        });
        console.log('User store reset with admin access key preserved:', DEFAULT_ADMIN_ACCESS_KEY);
      },
    }),
    {
      name: 'user-management-store',
      partialize: (state) => ({
        users: state.users,
        isInitialized: state.isInitialized,
        adminCredentials: state.adminCredentials,
        accessKeys: state.accessKeys,
        currentSession: state.currentSession,
      }),
    }
  )
);