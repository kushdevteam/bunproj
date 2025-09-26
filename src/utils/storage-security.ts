/**
 * Storage Security Verification Utilities
 * Provides automated verification that localStorage never contains private keys
 * 
 * SECURITY REQUIREMENTS:
 * - Continuously monitor localStorage for private key leakage
 * - Alert if any private keys are found in persistent storage
 * - Provide automated cleanup and security warnings
 */

// Automated verification that localStorage never contains private keys

/**
 * Check if localStorage contains any private key data
 * Returns an array of storage keys that contain private key references
 */
export const checkLocalStorageForPrivateKeys = (): string[] => {
  const problematicKeys: string[] = [];
  
  try {
    // Check all localStorage keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      
      const value = localStorage.getItem(key);
      if (!value) continue;
      
      // Check if the value contains private key references
      const lowercaseValue = value.toLowerCase();
      if (
        lowercaseValue.includes('privatekey') ||
        lowercaseValue.includes('private_key') ||
        lowercaseValue.includes('"privateKey"') ||
        lowercaseValue.includes("'privateKey'") ||
        // Check for hex patterns that look like private keys
        /0x[a-f0-9]{64}/i.test(value) ||
        // Check for base64 encoded private keys (common patterns)
        /"privateKey":\s*"[A-Za-z0-9+/]{40,}={0,2}"/i.test(value)
      ) {
        problematicKeys.push(key);
      }
    }
  } catch (error) {
    console.error('🚨 SECURITY: Error checking localStorage for private keys:', error);
  }
  
  return problematicKeys;
};

/**
 * Sanitize localStorage by removing any entries that contain private keys
 * Returns the number of entries that were removed
 */
export const sanitizeLocalStorage = (): number => {
  const problematicKeys = checkLocalStorageForPrivateKeys();
  
  if (problematicKeys.length > 0) {
    console.error('🚨 SECURITY ALERT: Found private keys in localStorage!');
    console.error('🔒 SECURITY: Removing compromised storage entries:', problematicKeys);
    
    problematicKeys.forEach(key => {
      try {
        localStorage.removeItem(key);
        console.log(`✅ SECURITY: Removed compromised storage entry: ${key}`);
      } catch (error) {
        console.error(`❌ SECURITY: Failed to remove compromised entry: ${key}`, error);
      }
    });
  }
  
  return problematicKeys.length;
};

/**
 * Verify that a specific store's localStorage entry doesn't contain private keys
 * This should be called after any store operation that might persist data
 */
export const verifyStoreSecurityCompliance = (storeName: string): boolean => {
  try {
    const storeValue = localStorage.getItem(storeName);
    if (!storeValue) return true; // No data stored is secure
    
    // Check if this specific store contains private keys
    const lowercaseValue = storeValue.toLowerCase();
    const hasPrivateKeys = 
      lowercaseValue.includes('privatekey') ||
      lowercaseValue.includes('private_key') ||
      lowercaseValue.includes('"privateKey"') ||
      lowercaseValue.includes("'privateKey'") ||
      /0x[a-f0-9]{64}/i.test(storeValue);
    
    if (hasPrivateKeys) {
      console.error(`🚨 SECURITY VIOLATION: Store "${storeName}" contains private keys in localStorage!`);
      console.error('🔒 SECURITY: This indicates a failure in the partialize configuration');
      
      // Remove the compromised store data immediately
      localStorage.removeItem(storeName);
      console.log(`✅ SECURITY: Emergency removal of compromised store: ${storeName}`);
      
      return false;
    }
    
    return true;
  } catch (error) {
    console.error(`🚨 SECURITY: Error verifying store security compliance for "${storeName}":`, error);
    return false;
  }
};

/**
 * Security monitoring function that continuously checks localStorage
 * Should be called periodically to ensure no private keys leak into persistence
 */
export const startSecurityMonitoring = (): NodeJS.Timeout => {
  const checkInterval = 30000; // Default 30 seconds
  
  console.log('🔒 SECURITY: Starting localStorage monitoring for private key leakage');
  console.log(`🔒 SECURITY: Check interval: ${checkInterval}ms`);
  
  const monitoringInterval = setInterval(() => {
    const problematicKeys = checkLocalStorageForPrivateKeys();
    
    if (problematicKeys.length > 0) {
      console.error('🚨 SECURITY BREACH DETECTED: Private keys found in localStorage during monitoring!');
      console.error('🔒 SECURITY: Problematic storage keys:', problematicKeys);
      
      // Auto-sanitize for security
      const removedCount = sanitizeLocalStorage();
      console.log(`✅ SECURITY: Auto-removed ${removedCount} compromised storage entries`);
      
      // Optionally alert user or trigger security measures
      if (typeof window !== 'undefined' && window.alert) {
        window.alert('SECURITY ALERT: Private keys detected in browser storage and have been automatically removed. Please review your security settings.');
      }
    }
  }, checkInterval);
  
  // Run initial check
  const initialProblematicKeys = checkLocalStorageForPrivateKeys();
  if (initialProblematicKeys.length > 0) {
    console.warn('🚨 SECURITY: Initial localStorage scan found private keys - auto-cleaning');
    sanitizeLocalStorage();
  } else {
    console.log('✅ SECURITY: Initial localStorage scan completed - no private keys detected');
  }
  
  return monitoringInterval;
};

/**
 * Stop security monitoring
 */
export const stopSecurityMonitoring = (monitoringInterval: NodeJS.Timeout): void => {
  clearInterval(monitoringInterval);
  console.log('🔒 SECURITY: Stopped localStorage monitoring');
};

/**
 * Test function to verify that the stripPrivateKeys function is working correctly
 * This should be used in development to ensure partialize configurations are secure
 */
export const testPrivateKeyExclusion = (): boolean => {
  // Create a test wallet object with private key
  const testWallet = {
    id: 'test-wallet',
    address: '0x1234567890123456789012345678901234567890',
    privateKey: '0x' + 'a'.repeat(64), // Test private key
    balance: 0,
    funded: false,
  };
  
  // Test if stripPrivateKeys function exists and works
  try {
    // Try to access stripPrivateKeys from crypto utils
    const { stripPrivateKeys } = require('./crypto');
    const strippedWallet = stripPrivateKeys(testWallet);
    
    // Verify private key was removed
    const hasPrivateKey = 'privateKey' in strippedWallet;
    const privateKeyValue = strippedWallet.privateKey;
    
    if (hasPrivateKey && privateKeyValue) {
      console.error('🚨 SECURITY TEST FAILED: stripPrivateKeys did not remove private key');
      return false;
    }
    
    console.log('✅ SECURITY TEST PASSED: stripPrivateKeys properly excludes private keys');
    return true;
  } catch (error) {
    console.error('🚨 SECURITY TEST ERROR: Could not test stripPrivateKeys function:', error);
    return false;
  }
};

/**
 * Comprehensive security audit of the entire localStorage
 * Returns detailed report of security compliance
 */
export const performSecurityAudit = (): {
  isSecure: boolean;
  problematicKeys: string[];
  totalStorageKeys: number;
  auditTimestamp: string;
  recommendations: string[];
} => {
  const problematicKeys = checkLocalStorageForPrivateKeys();
  const totalStorageKeys = localStorage.length;
  const isSecure = problematicKeys.length === 0;
  const auditTimestamp = new Date().toISOString();
  const recommendations: string[] = [];
  
  if (!isSecure) {
    recommendations.push('CRITICAL: Remove all private keys from localStorage immediately');
    recommendations.push('URGENT: Review Zustand partialize configurations');
    recommendations.push('REQUIRED: Implement proper encrypted storage for private keys');
  } else {
    recommendations.push('GOOD: No private keys detected in localStorage');
    recommendations.push('MAINTAIN: Continue using proper partialize configurations');
    recommendations.push('ENHANCE: Consider implementing IndexedDB encrypted storage');
  }
  
  // Additional security checks
  if (totalStorageKeys > 10) {
    recommendations.push('OPTIMIZE: Consider reducing localStorage usage for better performance');
  }
  
  const auditReport = {
    isSecure,
    problematicKeys,
    totalStorageKeys,
    auditTimestamp,
    recommendations
  };
  
  console.log('🔒 SECURITY AUDIT COMPLETED:', auditReport);
  return auditReport;
};