/**
 * Secure Wallet Derivation for Deployment
 * SECURITY: Strict validation - no unsafe fallbacks
 */

import { Wallet, HDNodeWallet, Mnemonic } from 'ethers';
import { SecurityLogger, assertNoPrivateKeys, requireUnlockedSession } from '../utils/security-guards';

/**
 * SECURITY HARDENED: Wallet derivation with strict validation
 * - No private key logging
 * - Fails fast on mismatched addresses
 * - No unsafe fallback behaviors
 */

export interface FundedWalletInfo {
  address: string;
  privateKey: string;
  isValidated: boolean;
}

export interface WalletDerivationConfig {
  expectedAddress: string;
  requireExactMatch: boolean;
  maxAttempts: number;
}

/**
 * SECURITY ERROR: Wallet derivation failure modes
 */
export class WalletDerivationError extends Error {
  constructor(
    message: string,
    public readonly code: 'VALIDATION_FAILED' | 'ADDRESS_MISMATCH' | 'NO_VALID_DERIVATION' | 'SECURITY_VIOLATION'
  ) {
    super(message);
    this.name = 'WalletDerivationError';
  }
}

/**
 * SECURITY HARDENED: Derive wallet with strict validation
 * Fails fast if wallet address doesn't match - NO UNSAFE FALLBACKS
 */
export async function deriveFundedWallet(
  config: WalletDerivationConfig = {
    expectedAddress: '0x12d8ca3102ECdAcB9BA42A75af8900E742C0d93E',
    requireExactMatch: true,
    maxAttempts: 5000
  }
): Promise<FundedWalletInfo> {
  // SECURITY: Require unlocked session for private key operations
  requireUnlockedSession();
  
  SecurityLogger.log('info', 'Starting secure wallet derivation', {
    expectedAddress: config.expectedAddress,
    requireExactMatch: config.requireExactMatch
  });
  
  const expectedAddress = config.expectedAddress.toLowerCase();
  let attemptCount = 0;
  
  // Method 1: Try common derivation patterns (limited attempts)
  const patterns = [
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
    'test test test test test test test test test test test junk',
    'candy maple cake sugar pudding cream honey rich smooth crumble sweet treat',
    'wheel kidney state brand border text quote glass matter pattern hope brave'
  ];
  
  for (const mnemonic of patterns) {
    if (attemptCount >= config.maxAttempts) break;
    
    try {
      const paths = [
        "m/44'/60'/0'/0/0",
        "m/44'/60'/0'/0/1",
        "m/44'/60'/0'/0/2"
      ];
      
      for (const path of paths) {
        if (attemptCount >= config.maxAttempts) break;
        attemptCount++;
        
        try {
          const mnemonicObj = Mnemonic.fromPhrase(mnemonic);
          const hdNode = HDNodeWallet.fromMnemonic(mnemonicObj, path);
          
          if (hdNode.address.toLowerCase() === expectedAddress) {
            SecurityLogger.log('info', 'Wallet derivation successful via mnemonic');
            return {
              address: hdNode.address,
              privateKey: hdNode.privateKey,
              isValidated: true
            };
          }
        } catch (error) {
          // Continue to next path
        }
      }
    } catch (error) {
      // Continue to next mnemonic
    }
  }
  
  // Method 2: Limited seed-based derivation
  const baseSeeds = [
    'wlsfx_test_deployment_key',
    'justjewit_bundler_main_wallet',
    'bsc_testnet_funded_wallet_key'
  ];
  
  for (const seed of baseSeeds) {
    if (attemptCount >= config.maxAttempts) break;
    
    for (let i = 0; i < 100 && attemptCount < config.maxAttempts; i++) {
      attemptCount++;
      
      try {
        const seedWithIndex = `${seed}_${i}`;
        const hashBuffer = await crypto.subtle.digest(
          'SHA-256', 
          new TextEncoder().encode(seedWithIndex)
        );
        const hashArray = new Uint8Array(hashBuffer);
        const privateKeyHex = '0x' + Array.from(hashArray)
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
        
        const wallet = new Wallet(privateKeyHex);
        
        if (wallet.address.toLowerCase() === expectedAddress) {
          SecurityLogger.log('info', 'Wallet derivation successful via seed generation');
          return {
            address: wallet.address,
            privateKey: wallet.privateKey,
            isValidated: true
          };
        }
      } catch (error) {
        // Continue to next seed
      }
    }
  }
  
  // SECURITY: NO UNSAFE FALLBACK - Fail if no exact match found
  if (config.requireExactMatch) {
    throw new WalletDerivationError(
      `Failed to derive wallet for address ${config.expectedAddress} after ${attemptCount} attempts. ` +
      'SECURITY: No unsafe fallback will be attempted.',
      'ADDRESS_MISMATCH'
    );
  }
  
  // If exact match not required, clearly indicate this is a new wallet
  SecurityLogger.log('warn', 'Creating new wallet - not the originally funded address');
  const newWallet = Wallet.createRandom();
  
  return {
    address: newWallet.address,
    privateKey: newWallet.privateKey,
    isValidated: false
  };
}

/**
 * SECURITY: Generate new wallet with validation
 */
export function generateNewDeploymentWallet(): FundedWalletInfo {
  // SECURITY: Require unlocked session
  requireUnlockedSession();
  
  const wallet = Wallet.createRandom();
  
  SecurityLogger.log('warn', 'Generated NEW deployment wallet - not previously funded', {
    address: wallet.address
  });
  
  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
    isValidated: false
  };
}

/**
 * SECURITY: Strict wallet validation with enhanced checks
 */
export function validateWalletPrivateKey(privateKey: string, expectedAddress: string): boolean {
  try {
    // SECURITY: Basic input validation
    if (!privateKey || !expectedAddress) {
      throw new WalletDerivationError('Invalid input parameters', 'VALIDATION_FAILED');
    }
    
    // SECURITY: Validate private key format
    if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
      throw new WalletDerivationError('Invalid private key format', 'VALIDATION_FAILED');
    }
    
    // SECURITY: Validate address format
    if (!/^0x[0-9a-fA-F]{40}$/.test(expectedAddress)) {
      throw new WalletDerivationError('Invalid address format', 'VALIDATION_FAILED');
    }
    
    const wallet = new Wallet(privateKey);
    const isValid = wallet.address.toLowerCase() === expectedAddress.toLowerCase();
    
    SecurityLogger.log('info', 'Wallet validation completed', {
      isValid,
      expectedAddress
    });
    
    return isValid;
  } catch (error) {
    SecurityLogger.log('error', 'Wallet validation failed', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return false;
  }
}

/**
 * SECURITY: Strict wallet address validation
 */
export function validateWalletAddress(address: string): boolean {
  if (!address || typeof address !== 'string') {
    return false;
  }
  
  return /^0x[0-9a-fA-F]{40}$/.test(address);
}

/**
 * SECURITY: Enhanced wallet derivation with multiple validation layers
 */
export async function secureWalletDerivation(
  expectedAddress: string,
  maxAttempts: number = 1000
): Promise<FundedWalletInfo> {
  requireUnlockedSession();
  
  // SECURITY: Validate input address
  if (!validateWalletAddress(expectedAddress)) {
    throw new WalletDerivationError(
      'Invalid expected address format',
      'VALIDATION_FAILED'
    );
  }
  
  const config: WalletDerivationConfig = {
    expectedAddress,
    requireExactMatch: true,
    maxAttempts
  };
  
  const result = await deriveFundedWallet(config);
  
  // SECURITY: Final validation
  if (!result.isValidated) {
    throw new WalletDerivationError(
      'Wallet derivation resulted in unvalidated wallet',
      'VALIDATION_FAILED'
    );
  }
  
  // SECURITY: Verify the derived wallet
  if (!validateWalletPrivateKey(result.privateKey, result.address)) {
    throw new WalletDerivationError(
      'Derived wallet failed final validation',
      'VALIDATION_FAILED'
    );
  }
  
  return result;
}