/**
 * EncryptedKeyVault - Production-ready encrypted storage for private keys
 * - Uses IndexedDB for persistent encrypted storage
 * - Keys are encrypted with session passphrases
 * - Auto-purges on session timeout/logout
 * - Keyed by walletId/sessionId for compartmentalization
 */

import { config } from '../config/env';
import { encryptData, decryptData } from './crypto';

interface VaultEntry {
  walletId: string;
  sessionId: string;
  encryptedKey: string; // Base64 encoded encrypted private key
  salt: string; // Base64 encoded salt
  iv: string; // Base64 encoded IV
  createdAt: number;
  lastAccessed: number;
  expiresAt: number;
}

interface EncryptedKeyVault {
  store: (walletId: string, privateKey: string, sessionId: string, passphrase: string) => Promise<void>;
  retrieve: (walletId: string, sessionId: string, passphrase: string) => Promise<string | null>;
  remove: (walletId: string, sessionId?: string) => Promise<void>;
  purgeExpired: () => Promise<void>;
  purgeSession: (sessionId: string) => Promise<void>;
  clear: () => Promise<void>;
  listWallets: (sessionId?: string) => Promise<string[]>;
}

class IndexedDBKeyVault implements EncryptedKeyVault {
  private dbName = 'bnb-bundler-vault';
  private storeName = 'encrypted-keys';
  private version = 1;
  private db: IDBDatabase | null = null;
  
  private async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onerror = () => reject(new Error('Failed to open IndexedDB'));
      
      request.onsuccess = () => {
        this.db = request.result;
        resolve(request.result);
      };
      
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'walletId' });
          store.createIndex('sessionId', 'sessionId', { unique: false });
          store.createIndex('expiresAt', 'expiresAt', { unique: false });
        }
      };
    });
  }
  
  async store(walletId: string, privateKey: string, sessionId: string, passphrase: string): Promise<void> {
    const db = await this.getDB();
    const transaction = db.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);
    
    // Encrypt the private key
    const encryptionResult = await encryptData(privateKey, passphrase);
    
    const entry: VaultEntry = {
      walletId,
      sessionId,
      encryptedKey: btoa(String.fromCharCode(...new Uint8Array(encryptionResult.encrypted))),
      salt: btoa(String.fromCharCode(...encryptionResult.salt)),
      iv: btoa(String.fromCharCode(...encryptionResult.iv)),
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      expiresAt: Date.now() + config.security.sessionTimeout
    };
    
    return new Promise((resolve, reject) => {
      const request = store.put(entry);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to store encrypted key'));
    });
  }
  
  async retrieve(walletId: string, sessionId: string, passphrase: string): Promise<string | null> {
    const db = await this.getDB();
    const transaction = db.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);
    
    return new Promise((resolve, reject) => {
      const request = store.get(walletId);
      
      request.onsuccess = async () => {
        const entry: VaultEntry | undefined = request.result;
        
        if (!entry) {
          resolve(null);
          return;
        }
        
        // Check if entry is expired
        if (Date.now() > entry.expiresAt) {
          await this.remove(walletId);
          resolve(null);
          return;
        }
        
        // Check if sessionId matches (security: prevent cross-session access)
        if (entry.sessionId !== sessionId) {
          resolve(null);
          return;
        }
        
        try {
          // Decrypt the private key
          const encrypted = new Uint8Array(atob(entry.encryptedKey).split('').map(c => c.charCodeAt(0)));
          const salt = new Uint8Array(atob(entry.salt).split('').map(c => c.charCodeAt(0)));
          const iv = new Uint8Array(atob(entry.iv).split('').map(c => c.charCodeAt(0)));
          
          const privateKey = await decryptData({ encrypted: encrypted.buffer, salt, iv, passphrase });
          
          // Update last accessed time
          entry.lastAccessed = Date.now();
          store.put(entry);
          
          resolve(privateKey);
        } catch (error) {
          console.error('Failed to decrypt private key:', error);
          resolve(null);
        }
      };
      
      request.onerror = () => reject(new Error('Failed to retrieve encrypted key'));
    });
  }
  
  async remove(walletId: string, sessionId?: string): Promise<void> {
    const db = await this.getDB();
    const transaction = db.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);
    
    return new Promise((resolve, reject) => {
      if (sessionId) {
        // Only remove if sessionId matches (security)
        const getRequest = store.get(walletId);
        getRequest.onsuccess = () => {
          const entry: VaultEntry | undefined = getRequest.result;
          if (entry && entry.sessionId === sessionId) {
            const deleteRequest = store.delete(walletId);
            deleteRequest.onsuccess = () => resolve();
            deleteRequest.onerror = () => reject(new Error('Failed to remove encrypted key'));
          } else {
            resolve(); // Entry doesn't exist or sessionId doesn't match
          }
        };
        getRequest.onerror = () => reject(new Error('Failed to check encrypted key'));
      } else {
        // Remove without sessionId check (for cleanup)
        const request = store.delete(walletId);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(new Error('Failed to remove encrypted key'));
      }
    });
  }
  
  async purgeExpired(): Promise<void> {
    const db = await this.getDB();
    const transaction = db.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);
    const index = store.index('expiresAt');
    
    return new Promise((resolve, reject) => {
      const request = index.openCursor(IDBKeyRange.upperBound(Date.now()));
      
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
      
      request.onerror = () => reject(new Error('Failed to purge expired keys'));
    });
  }
  
  async purgeSession(sessionId: string): Promise<void> {
    const db = await this.getDB();
    const transaction = db.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);
    const index = store.index('sessionId');
    
    return new Promise((resolve, reject) => {
      const request = index.openCursor(IDBKeyRange.only(sessionId));
      
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
      
      request.onerror = () => reject(new Error('Failed to purge session keys'));
    });
  }
  
  async clear(): Promise<void> {
    const db = await this.getDB();
    const transaction = db.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);
    
    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to clear vault'));
    });
  }
  
  async listWallets(sessionId?: string): Promise<string[]> {
    const db = await this.getDB();
    const transaction = db.transaction([this.storeName], 'readonly');
    const store = transaction.objectStore(this.storeName);
    
    return new Promise((resolve, reject) => {
      const wallets: string[] = [];
      
      if (sessionId) {
        const index = store.index('sessionId');
        const request = index.openCursor(IDBKeyRange.only(sessionId));
        
        request.onsuccess = () => {
          const cursor = request.result;
          if (cursor) {
            const entry: VaultEntry = cursor.value;
            if (Date.now() <= entry.expiresAt) {
              wallets.push(entry.walletId);
            }
            cursor.continue();
          } else {
            resolve(wallets);
          }
        };
        
        request.onerror = () => reject(new Error('Failed to list wallets'));
      } else {
        const request = store.openCursor();
        
        request.onsuccess = () => {
          const cursor = request.result;
          if (cursor) {
            const entry: VaultEntry = cursor.value;
            if (Date.now() <= entry.expiresAt) {
              wallets.push(entry.walletId);
            }
            cursor.continue();
          } else {
            resolve(wallets);
          }
        };
        
        request.onerror = () => reject(new Error('Failed to list wallets'));
      }
    });
  }
}

// Global vault instance
let vaultInstance: EncryptedKeyVault | null = null;

/**
 * Get the global encrypted key vault instance
 */
export const getKeyVault = (): EncryptedKeyVault => {
  if (!vaultInstance) {
    vaultInstance = new IndexedDBKeyVault();
  }
  return vaultInstance;
};

/**
 * Store a private key in the encrypted vault
 */
export const vaultStoreKey = async (
  walletId: string, 
  privateKey: string, 
  sessionId: string, 
  passphrase: string
): Promise<void> => {
  const vault = getKeyVault();
  await vault.store(walletId, privateKey, sessionId, passphrase);
};

/**
 * Retrieve a private key from the encrypted vault
 */
export const vaultRetrieveKey = async (
  walletId: string, 
  sessionId: string, 
  passphrase: string
): Promise<string | null> => {
  const vault = getKeyVault();
  return await vault.retrieve(walletId, sessionId, passphrase);
};

/**
 * Remove a private key from the encrypted vault
 */
export const vaultRemoveKey = async (
  walletId: string, 
  sessionId?: string
): Promise<void> => {
  const vault = getKeyVault();
  await vault.remove(walletId, sessionId);
};

/**
 * Purge all keys for a specific session (called on logout)
 */
export const vaultPurgeSession = async (sessionId: string): Promise<void> => {
  const vault = getKeyVault();
  await vault.purgeSession(sessionId);
};

/**
 * Purge expired keys (called periodically)
 */
export const vaultPurgeExpired = async (): Promise<void> => {
  const vault = getKeyVault();
  await vault.purgeExpired();
};

/**
 * Clear entire vault (emergency use only)
 */
export const vaultClear = async (): Promise<void> => {
  const vault = getKeyVault();
  await vault.clear();
};

// Auto-cleanup expired vault entries every 10 minutes
setInterval(async () => {
  try {
    await vaultPurgeExpired();
  } catch (error) {
    console.error('🔒 Vault cleanup failed:', error);
  }
}, 10 * 60 * 1000);