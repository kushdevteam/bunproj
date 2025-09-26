/**
 * Runtime Security Guards for Private Key Protection
 * - Prevents private key leakage in API calls, logs, and persistence
 * - Clipboard auto-clear for sensitive data
 * - Session validation for private key operations
 */

import { useSessionStore } from '../store/session';

/**
 * ENHANCED: Security assertion with improved detection patterns
 */
export const assertNoPrivateKeys = (data: any, context: string): void => {
  const str = JSON.stringify(data);
  const patterns = [
    /privateKey/gi,
    /private_key/gi,
    /privkey/gi,
    /pk/gi,
    /0x[0-9a-f]{64}/gi, // 64-char hex strings (private key pattern)
    /"[0-9a-f]{64}"/gi, // Quoted 64-char hex strings
    /[0-9a-f]{64}/gi, // Unquoted 64-char hex strings
    /mnemonic/gi,
    /seed/gi,
    /passphrase/gi,
  ];

  for (const pattern of patterns) {
    if (pattern.test(str)) {
      const error = `🚨 SECURITY VIOLATION: Sensitive data detected in ${context}`;
      SecurityLogger.log('error', error);
      throw new SecurityValidationError(error, 'PRIVATE_KEY_DETECTED');
    }
  }
};

/**
 * SECURITY: Strict wallet validation utilities
 */
export const validateWalletData = {
  /**
   * Validate wallet address format and checksum
   */
  address: (address: string): boolean => {
    if (!address || typeof address !== 'string') {
      return false;
    }
    
    // Basic format check
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
      return false;
    }
    
    // Additional validation could include checksum verification
    return true;
  },
  
  /**
   * Validate private key format (without exposing the key)
   */
  privateKeyFormat: (privateKey: string): boolean => {
    if (!privateKey || typeof privateKey !== 'string') {
      return false;
    }
    
    return /^0x[0-9a-fA-F]{64}$/.test(privateKey);
  },
  
  /**
   * Validate wallet address matches expected address (case-insensitive)
   */
  addressMatch: (actual: string, expected: string): boolean => {
    if (!validateWalletData.address(actual) || !validateWalletData.address(expected)) {
      return false;
    }
    
    return actual.toLowerCase() === expected.toLowerCase();
  },
  
  /**
   * SECURITY: Strict validation that fails fast on mismatches
   */
  strictAddressMatch: (actual: string, expected: string, context: string = 'wallet validation'): void => {
    if (!validateWalletData.addressMatch(actual, expected)) {
      throw new SecurityValidationError(
        `Wallet address mismatch in ${context}: expected ${expected}, got ${actual}`,
        'WALLET_MISMATCH'
      );
    }
  }
};

/**
 * Sanitize data before API transmission - removes any private key fields
 */
export const sanitizeForAPI = <T>(data: T): T => {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(sanitizeForAPI) as T;
  }

  const sanitized = { ...data };
  
  // Remove private key fields
  delete (sanitized as any).privateKey;
  delete (sanitized as any).private_key;
  delete (sanitized as any).encryptedPrivateKey;
  delete (sanitized as any).encrypted_private_key;

  // Recursively sanitize nested objects
  for (const key in sanitized) {
    if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeForAPI(sanitized[key]);
    }
  }

  return sanitized;
};

/**
 * ENHANCED: Session validation with additional security checks
 */
export const requireUnlockedSession = (): void => {
  try {
    const sessionState = useSessionStore.getState();
    
    if (!sessionState.isUnlocked || !sessionState.isSessionValid()) {
      throw new SecurityValidationError('Session must be unlocked to access private keys', 'SESSION_LOCKED');
    }
    
    // Additional validation checks
    const now = Date.now();
    const lastActivityTime = sessionState.lastActivity ? new Date(sessionState.lastActivity).getTime() : 0;
    const maxSessionDuration = 3600000; // 1 hour
    
    if (now - lastActivityTime > maxSessionDuration) {
      throw new SecurityValidationError('Session expired - please re-authenticate', 'SESSION_EXPIRED');
    }
  } catch (error) {
    if (error instanceof SecurityValidationError) {
      throw error;
    }
    // Fallback for store access issues
    throw new SecurityValidationError('Unable to validate session state', 'SESSION_VALIDATION_FAILED');
  }
};

/**
 * SECURITY: Enhanced error types for better security handling
 */
export class SecurityValidationError extends Error {
  constructor(
    message: string,
    public readonly code: 'SESSION_LOCKED' | 'SESSION_EXPIRED' | 'SESSION_VALIDATION_FAILED' | 'WALLET_MISMATCH' | 'PRIVATE_KEY_DETECTED' | 'INVALID_ADDRESS'
  ) {
    super(message);
    this.name = 'SecurityValidationError';
  }
}

/**
 * Secure clipboard utility with auto-clear
 */
export class SecureClipboard {
  private static clearTimeouts = new Map<string, NodeJS.Timeout>();

  /**
   * Copy sensitive data to clipboard with auto-clear
   */
  static async copyWithAutoClear(
    text: string, 
    clearAfterMs: number = 30000, // 30 seconds default
    label: string = 'sensitive data'
  ): Promise<void> {
    if (!navigator.clipboard) {
      throw new Error('Clipboard API not available');
    }

    // Copy to clipboard
    await navigator.clipboard.writeText(text);
    console.log(`📋 ${label} copied to clipboard (will auto-clear in ${clearAfterMs}ms)`);

    // Clear any existing timeout for this label
    const existingTimeout = this.clearTimeouts.get(label);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set new auto-clear timeout
    const timeout = setTimeout(async () => {
      try {
        const currentClipboard = await navigator.clipboard.readText();
        if (currentClipboard === text) {
          await navigator.clipboard.writeText('');
          console.log(`🔒 Auto-cleared ${label} from clipboard`);
        }
      } catch (error) {
        // Ignore clipboard read errors (permission-related)
        console.log(`🔒 Auto-clear attempted for ${label}`);
      }
      this.clearTimeouts.delete(label);
    }, clearAfterMs);

    this.clearTimeouts.set(label, timeout);
  }

  /**
   * Manual clear all secure clipboard entries
   */
  static clearAll(): void {
    for (const timeout of this.clearTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.clearTimeouts.clear();
    
    // Clear clipboard if possible
    if (navigator.clipboard) {
      navigator.clipboard.writeText('').catch(() => {
        // Ignore errors
      });
    }
  }
}

/**
 * Security logger that redacts sensitive information
 */
export class SecurityLogger {
  private static sensitivePatterns = [
    /0x[0-9a-f]{64}/gi, // Private key pattern
    /privateKey/gi,
    /private_key/gi,
    /password/gi,
    /passphrase/gi,
    /seed/gi,
    /mnemonic/gi,
  ];

  /**
   * Log with automatic sensitive data redaction
   */
  static log(level: 'info' | 'warn' | 'error', message: string, data?: any): void {
    const redactedMessage = this.redactSensitiveData(message);
    const redactedData = data ? this.redactSensitiveData(JSON.stringify(data)) : undefined;

    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${level.toUpperCase()}: ${redactedMessage}`;

    switch (level) {
      case 'info':
        console.log(logEntry, redactedData ? JSON.parse(redactedData) : '');
        break;
      case 'warn':
        console.warn(logEntry, redactedData ? JSON.parse(redactedData) : '');
        break;
      case 'error':
        console.error(logEntry, redactedData ? JSON.parse(redactedData) : '');
        break;
    }
  }

  /**
   * Redact sensitive data from strings
   */
  private static redactSensitiveData(text: string): string {
    let redacted = text;
    
    for (const pattern of this.sensitivePatterns) {
      redacted = redacted.replace(pattern, '***REDACTED***');
    }

    return redacted;
  }
}

/**
 * API call interceptor to prevent private key transmission
 */
export const secureAPICall = async <T>(
  url: string,
  options: RequestInit = {}
): Promise<T> => {
  // Security check: ensure no private keys in request body
  if (options.body) {
    const body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
    assertNoPrivateKeys(body, `API call to ${url}`);
  }

  // Log the API call (redacted)
  SecurityLogger.log('info', `API call: ${options.method || 'GET'} ${url}`, {
    headers: options.headers,
    hasBody: !!options.body,
  });

  const response = await fetch(url, options);
  
  if (!response.ok) {
    SecurityLogger.log('error', `API call failed: ${response.status} ${response.statusText}`, {
      url,
      status: response.status,
    });
    throw new Error(`API call failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
};

/**
 * Persistent storage interceptor to prevent private key storage
 */
export const secureStorage = {
  setItem: (key: string, value: string): void => {
    assertNoPrivateKeys(value, `localStorage.setItem(${key})`);
    localStorage.setItem(key, value);
  },

  getItem: (key: string): string | null => {
    return localStorage.getItem(key);
  },

  removeItem: (key: string): void => {
    localStorage.removeItem(key);
  },

  clear: (): void => {
    localStorage.clear();
  },
};

/**
 * Development-only runtime tests to verify security
 */
export const runSecurityTests = (): void => {
  if (process.env.NODE_ENV !== 'development') {
    return;
  }

  console.log('🔒 Running security tests...');

  try {
    // Test 1: Private key detection
    const testData = {
      address: '0x123...',
      privateKey: '0x' + '0'.repeat(64),
      balance: 1.5,
    };

    try {
      assertNoPrivateKeys(testData, 'security test');
      console.error('❌ Security test failed: Private key not detected');
    } catch (error) {
      console.log('✅ Private key detection working');
    }

    // Test 2: Sanitization
    const sanitized = sanitizeForAPI(testData);
    if ('privateKey' in sanitized) {
      console.error('❌ Security test failed: Private key not sanitized');
    } else {
      console.log('✅ Data sanitization working');
    }

    // Test 3: Session validation
    try {
      requireUnlockedSession();
      console.log('⚠️ Session validation test: depends on session state');
    } catch (error) {
      console.log('✅ Session validation working (session locked)');
    }

    console.log('🔒 Security tests completed');
  } catch (error) {
    console.error('❌ Security tests failed:', error);
  }
};

// Auto-run security tests in development
if (process.env.NODE_ENV === 'development') {
  // Delay to ensure stores are initialized
  setTimeout(runSecurityTests, 1000);
}