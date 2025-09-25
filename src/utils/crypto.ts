/**
 * Client-side cryptographic utilities for secure private key management
 * Uses Web Crypto API with AES-GCM encryption and PBKDF2 key derivation
 * 
 * SECURITY REQUIREMENTS:
 * - Private keys NEVER leave the client
 * - All encryption/decryption happens client-side only
 * - Uses strong encryption standards (AES-GCM + PBKDF2)
 * - Secure random IV generation for each encryption
 */

import { config } from '../config/env';
import type { EncryptionResult, DecryptionParams } from '../types';

/**
 * Generate cryptographically secure random bytes
 */
export const generateSecureRandom = (length: number): Uint8Array => {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return array;
};

/**
 * Generate a salt for PBKDF2 key derivation
 */
export const generateSalt = (): Uint8Array => {
  return generateSecureRandom(16); // 128-bit salt
};

// SECURITY NOTE: getSessionDefaultPassphrase function removed due to critical security vulnerability.
// Deterministic passphrases based on persisted sessionIds allow attackers with storage access
// to decrypt wallet keys. Use createSessionKey/getSessionKey for secure in-memory key management instead.

/**
 * Generate an initialization vector for AES-GCM
 */
export const generateIV = (): Uint8Array => {
  return generateSecureRandom(12); // 96-bit IV for GCM
};

/**
 * Derive an encryption key from a passphrase using PBKDF2
 */
export const deriveKey = async (
  passphrase: string,
  salt: Uint8Array,
  iterations: number = config.security.pbkdf2Iterations
): Promise<CryptoKey> => {
  // Import the passphrase as a key
  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  // Derive the actual encryption key
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: iterations,
      hash: 'SHA-256',
    },
    baseKey,
    {
      name: 'AES-GCM',
      length: config.security.encryptionKeyLength * 8, // Convert bytes to bits
    },
    false,
    ['encrypt', 'decrypt']
  );
};

/**
 * Encrypt data using AES-GCM
 */
export const encryptData = async (
  data: string,
  passphrase: string
): Promise<EncryptionResult> => {
  try {
    // Generate random salt and IV
    const salt = generateSalt();
    const iv = generateIV();
    
    // Derive encryption key from passphrase
    const key = await deriveKey(passphrase, salt);
    
    // Encrypt the data
    const encrypted = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv as BufferSource,
      },
      key,
      new TextEncoder().encode(data)
    );

    return {
      encrypted,
      iv,
      salt,
    };
  } catch (error) {
    throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Decrypt data using AES-GCM
 */
export const decryptData = async (
  params: DecryptionParams
): Promise<string> => {
  try {
    // Derive the same encryption key from passphrase and salt
    const key = await deriveKey(params.passphrase, params.salt);
    
    // Decrypt the data
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: params.iv as BufferSource,
      },
      key,
      params.encrypted
    );

    return new TextDecoder().decode(decrypted);
  } catch (error) {
    throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Invalid passphrase or corrupted data'}`);
  }
};

/**
 * Encrypt a private key for secure storage
 */
export const encryptPrivateKey = async (
  privateKey: string,
  passphrase: string
): Promise<string> => {
  const result = await encryptData(privateKey, passphrase);
  
  // Package everything into a single base64 string for storage
  const combined = new Uint8Array(
    result.salt.length + 
    result.iv.length + 
    result.encrypted.byteLength + 
    8 // 8 bytes for length headers
  );
  
  let offset = 0;
  
  // Store salt length (4 bytes) and salt
  new DataView(combined.buffer).setUint32(offset, result.salt.length, true);
  offset += 4;
  combined.set(result.salt, offset);
  offset += result.salt.length;
  
  // Store IV length (4 bytes) and IV
  new DataView(combined.buffer).setUint32(offset, result.iv.length, true);
  offset += 4;
  combined.set(result.iv, offset);
  offset += result.iv.length;
  
  // Store encrypted data
  combined.set(new Uint8Array(result.encrypted), offset);
  
  // Convert to base64 for storage
  return btoa(String.fromCharCode.apply(null, Array.from(combined)));
};

/**
 * Decrypt a private key from secure storage
 */
export const decryptPrivateKey = async (
  encryptedData: string,
  passphrase: string
): Promise<string> => {
  try {
    // Decode from base64
    const combined = new Uint8Array(
      atob(encryptedData).split('').map(char => char.charCodeAt(0))
    );
    
    let offset = 0;
    
    // Extract salt length and salt
    const saltLength = new DataView(combined.buffer).getUint32(offset, true);
    offset += 4;
    const salt = combined.slice(offset, offset + saltLength);
    offset += saltLength;
    
    // Extract IV length and IV
    const ivLength = new DataView(combined.buffer).getUint32(offset, true);
    offset += 4;
    const iv = combined.slice(offset, offset + ivLength);
    offset += ivLength;
    
    // Extract encrypted data
    const encrypted = combined.slice(offset).buffer;
    
    return await decryptData({
      encrypted,
      iv,
      salt,
      passphrase,
    });
  } catch (error) {
    throw new Error(`Failed to decrypt private key: ${error instanceof Error ? error.message : 'Invalid data format'}`);
  }
};

// ========================================================================
// SECURE INDEXEDDB STORAGE - NO PRIVATE KEYS IN LOCALSTORAGE
// ========================================================================

/**
 * Database name for secure storage
 */
const DB_NAME = 'BNBBundlerSecureDB';
const DB_VERSION = 1;
const STORE_NAME = 'encryptedData';

/**
 * Initialize IndexedDB for secure storage
 */
let dbInstance: IDBDatabase | null = null;

const initializeSecureDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open IndexedDB'));
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

/**
 * Securely store encrypted data in IndexedDB (NO PLAINTEXT KEYS)
 */
export const secureStore = async (key: string, encryptedData: string): Promise<void> => {
  try {
    const db = await initializeSecureDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const storageKey = `${config.security.storagePrefix}${key}`;
    await new Promise<void>((resolve, reject) => {
      const request = store.put({ id: storageKey, data: encryptedData, timestamp: Date.now() });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to store encrypted data'));
    });
  } catch (error) {
    throw new Error(`Failed to store encrypted data: ${error instanceof Error ? error.message : 'Storage error'}`);
  }
};

/**
 * Retrieve encrypted data from IndexedDB
 */
export const secureRetrieve = async (key: string): Promise<string | null> => {
  try {
    const db = await initializeSecureDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    
    const storageKey = `${config.security.storagePrefix}${key}`;
    return new Promise<string | null>((resolve, reject) => {
      const request = store.get(storageKey);
      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.data : null);
      };
      request.onerror = () => {
        console.error('Failed to retrieve encrypted data:', request.error);
        resolve(null);
      };
    });
  } catch (error) {
    console.error('Failed to retrieve encrypted data:', error);
    return null;
  }
};

/**
 * Remove encrypted data from IndexedDB
 */
export const secureRemove = async (key: string): Promise<void> => {
  try {
    const db = await initializeSecureDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const storageKey = `${config.security.storagePrefix}${key}`;
    await new Promise<void>((resolve, reject) => {
      const request = store.delete(storageKey);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to remove encrypted data'));
    });
  } catch (error) {
    console.error('Failed to remove encrypted data:', error);
  }
};

/**
 * Clear all app-related encrypted data from IndexedDB
 */
export const secureClearAll = async (): Promise<void> => {
  try {
    const db = await initializeSecureDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    // Get all keys with our prefix
    const request = store.openCursor();
    const keysToDelete: string[] = [];
    
    await new Promise<void>((resolve, reject) => {
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          if (cursor.key.toString().startsWith(config.security.storagePrefix)) {
            keysToDelete.push(cursor.key.toString());
          }
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
    
    // Delete all matching keys
    for (const key of keysToDelete) {
      await new Promise<void>((resolve, reject) => {
        const deleteRequest = store.delete(key);
        deleteRequest.onsuccess = () => resolve();
        deleteRequest.onerror = () => reject(deleteRequest.error);
      });
    }
  } catch (error) {
    console.error('Failed to clear encrypted storage:', error);
  }
};

/**
 * Generate a secure session ID
 */
export const generateSessionId = (): string => {
  const randomBytes = generateSecureRandom(32);
  return Array.from(randomBytes)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
};

/**
 * Hash a passphrase for session verification (without storing the actual passphrase)
 */
export const hashPassphrase = async (passphrase: string): Promise<string> => {
  const encoded = new TextEncoder().encode(passphrase);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
};

/**
 * Validate that Web Crypto API is available
 */
export const isCryptoSupported = (): boolean => {
  return (
    typeof crypto !== 'undefined' &&
    typeof crypto.subtle !== 'undefined' &&
    typeof crypto.getRandomValues === 'function'
  );
};

/**
 * Initialize crypto utilities (call this on app startup)
 */
export const initializeCrypto = (): void => {
  if (!isCryptoSupported()) {
    throw new Error(
      'Web Crypto API is not supported in this browser. ' +
      'Please use a modern browser with HTTPS for security.'
    );
  }
  
  if (config.development.enableLogging) {
    console.log('Crypto utilities initialized successfully');
  }
};

/**
 * Security utilities for TypeScript guards
 */
export const containsPrivateKey = (obj: any): boolean => {
  const str = JSON.stringify(obj);
  return str.includes('privateKey') || str.includes('private_key');
};

export const stripPrivateKeys = <T>(obj: T): T => {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(stripPrivateKeys) as T;
  }
  
  const result = { ...obj };
  delete (result as any).privateKey;
  delete (result as any).private_key;
  
  return result;
};

// ========================================================================
// MEMORY-ONLY SESSION KEY MANAGEMENT
// ========================================================================

/**
 * In-memory session key storage with automatic cleanup
 * CRITICAL: Private keys are NEVER persisted anywhere
 */
interface SessionKey {
  key: CryptoKey;
  salt: Uint8Array;
  createdAt: number;
  lastAccessed: number;
  accessCount: number;
}

// Memory-only storage for session keys
const sessionKeys = new Map<string, SessionKey>();
const SESSION_KEY_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const MAX_ACCESS_COUNT = 100; // Limit key usage

/**
 * Derive and store a session key in memory only
 */
export const createSessionKey = async (
  sessionId: string,
  passphrase: string
): Promise<void> => {
  try {
    // Generate fresh salt for this session
    const salt = generateSalt();
    
    // Derive session key using PBKDF2
    const key = await deriveKey(passphrase, salt);
    
    // Store in memory only
    sessionKeys.set(sessionId, {
      key,
      salt,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      accessCount: 0,
    });
    
    // Zero out passphrase from memory (not foolproof but better than nothing)
    if (typeof passphrase === 'string') {
      // Note: JavaScript doesn't allow true memory zeroing of strings
      // but we can at least overwrite the reference
      passphrase = '';
    }
  } catch (error) {
    throw new Error(`Failed to create session key: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Get session key for cryptographic operations
 */
export const getSessionKey = (sessionId: string): CryptoKey | null => {
  const session = sessionKeys.get(sessionId);
  if (!session) return null;
  
  const now = Date.now();
  
  // Check timeout
  if (now - session.lastAccessed > SESSION_KEY_TIMEOUT) {
    clearSessionKey(sessionId);
    return null;
  }
  
  // Check access count limit
  if (session.accessCount >= MAX_ACCESS_COUNT) {
    clearSessionKey(sessionId);
    return null;
  }
  
  // Update access tracking
  session.lastAccessed = now;
  session.accessCount++;
  
  return session.key;
};

/**
 * Get session salt for key derivation
 */
export const getSessionSalt = (sessionId: string): Uint8Array | null => {
  const session = sessionKeys.get(sessionId);
  return session ? session.salt : null;
};

/**
 * Clear session key from memory with secure cleanup
 */
export const clearSessionKey = (sessionId: string): void => {
  const session = sessionKeys.get(sessionId);
  if (session) {
    // Zero out salt array
    session.salt.fill(0);
    
    // Clear the session
    sessionKeys.delete(sessionId);
  }
  
  // Also clear the session passphrase
  clearSessionPassphrase(sessionId);
};

/**
 * Clear all session keys (on logout/shutdown)
 */
export const clearAllSessionKeys = (): void => {
  for (const [sessionId] of sessionKeys) {
    clearSessionKey(sessionId);
  }
  sessionKeys.clear();
  
  // Also clear all session passphrases
  clearAllSessionPassphrases();
};

/**
 * Cleanup expired session keys
 */
export const cleanupExpiredSessions = (): void => {
  const now = Date.now();
  for (const [sessionId, session] of sessionKeys) {
    if (now - session.lastAccessed > SESSION_KEY_TIMEOUT) {
      clearSessionKey(sessionId);
    }
  }
};

// Auto-cleanup expired sessions every 5 minutes
setInterval(cleanupExpiredSessions, 5 * 60 * 1000);

// ========================================================================
// SECURE IN-MEMORY PASSPHRASE STORAGE - FOR SESSION-BASED WALLET DECRYPTION
// ========================================================================

/**
 * In-memory storage for user passphrases during active sessions
 * These are cleared when sessions end and never persisted
 */
const sessionPassphrases = new Map<string, string>();

/**
 * Store user passphrase securely in memory for session duration
 */
export const storeSessionPassphrase = (sessionId: string, passphrase: string): void => {
  sessionPassphrases.set(sessionId, passphrase);
};

/**
 * Retrieve user passphrase from secure memory storage
 */
export const getSessionPassphrase = (sessionId: string): string | null => {
  return sessionPassphrases.get(sessionId) || null;
};

/**
 * Clear session passphrase from memory
 */
export const clearSessionPassphrase = (sessionId: string): void => {
  sessionPassphrases.delete(sessionId);
};

/**
 * Clear all session passphrases (on logout/shutdown)
 */
export const clearAllSessionPassphrases = (): void => {
  sessionPassphrases.clear();
};

/**
 * Encrypt data using session key (memory-only)
 */
export const encryptWithSessionKey = async (
  sessionId: string,
  data: string
): Promise<EncryptionResult | null> => {
  const key = getSessionKey(sessionId);
  const salt = getSessionSalt(sessionId);
  
  if (!key || !salt) return null;
  
  try {
    const iv = generateIV();
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      new TextEncoder().encode(data)
    );
    
    return { encrypted, iv, salt };
  } catch (error) {
    throw new Error(`Session encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Decrypt data using session key (memory-only)
 */
export const decryptWithSessionKey = async (
  sessionId: string,
  encrypted: ArrayBuffer,
  iv: Uint8Array
): Promise<string | null> => {
  const key = getSessionKey(sessionId);
  
  if (!key) return null;
  
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      encrypted
    );
    
    return new TextDecoder().decode(decrypted);
  } catch (error) {
    // Don't log decryption errors to avoid information leakage
    return null;
  }
};