/**
 * User Management Store with Username + PIN Authentication
 * Handles user registration, authentication, admin functionality, and session isolation
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { encryptPrivateKey, decryptPrivateKey, generateSecureRandom } from '../utils/crypto';

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
  
  // Actions - Authentication
  login: (request: LoginRequest) => Promise<boolean>;
  logout: () => void;
  
  // Actions - User Management (Admin only)
  createUser: (request: CreateUserRequest) => Promise<boolean>;
  updateUser: (userId: string, updates: Partial<User>) => Promise<boolean>;
  deleteUser: (userId: string) => Promise<boolean>;
  toggleUserStatus: (userId: string) => Promise<boolean>;
  
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
          
          console.log(`User login successful: ${username}`);
          return true;
          
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Login failed';
          set({ error: errorMessage, isLoading: false });
          console.error('Login error:', error);
          return false;
        }
      },
      
      logout: () => {
        const currentUser = get().getCurrentUser();
        if (currentUser) {
          console.log(`User logout: ${currentUser.username}`);
        }
        set({ currentSession: null, error: null });
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
      
      reset: () => {
        set({
          users: [],
          currentSession: null,
          isInitialized: false,
          isLoading: false,
          error: null,
        });
        console.log('User store reset');
      },
    }),
    {
      name: 'user-management-store',
      partialize: (state) => ({
        users: state.users,
        isInitialized: state.isInitialized,
        adminCredentials: state.adminCredentials,
      }),
    }
  )
);