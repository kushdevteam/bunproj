/**
 * Transport and RPC Security Hardening
 * - HTTPS-only enforcement for BSC RPC endpoints
 * - ChainId validation and pinning
 * - Nonce management with collision detection
 * - Gas price caps and rate limiting
 * - Request/response security validation
 */

import { JsonRpcProvider } from 'ethers';
import { config } from '../config/env';
import type { NetworkConfig } from '../types';

/**
 * Security configuration for transport layer
 */
interface TransportSecurityConfig {
  allowInsecureConnections: boolean;
  maxGasPrice: bigint;
  maxGasLimit: bigint;
  rateLimitRequestsPerSecond: number;
  rateLimitBurstSize: number;
  nonceCollisionThreshold: number;
  chainIdWhitelist: number[];
  requiredConfirmations: number;
}

const TRANSPORT_SECURITY_CONFIG: TransportSecurityConfig = {
  allowInsecureConnections: false, // PRODUCTION: Must be false
  maxGasPrice: BigInt('100000000000'), // 100 gwei max
  maxGasLimit: BigInt('10000000'), // 10M gas max
  rateLimitRequestsPerSecond: 10,
  rateLimitBurstSize: 20,
  nonceCollisionThreshold: 5,
  chainIdWhitelist: [97, 56], // BSC Testnet and Mainnet only
  requiredConfirmations: 3,
};

/**
 * Rate limiter for RPC requests
 */
class RpcRateLimiter {
  private requestTimes: number[] = [];
  private burstCount = 0;
  private lastBurstReset = Date.now();

  canMakeRequest(): boolean {
    const now = Date.now();
    
    // Reset burst counter every second
    if (now - this.lastBurstReset >= 1000) {
      this.burstCount = 0;
      this.lastBurstReset = now;
    }

    // Check burst limit
    if (this.burstCount >= TRANSPORT_SECURITY_CONFIG.rateLimitBurstSize) {
      return false;
    }

    // Clean old requests (older than 1 second)
    this.requestTimes = this.requestTimes.filter(time => now - time < 1000);

    // Check rate limit
    if (this.requestTimes.length >= TRANSPORT_SECURITY_CONFIG.rateLimitRequestsPerSecond) {
      return false;
    }

    // Allow request
    this.requestTimes.push(now);
    this.burstCount++;
    return true;
  }

  getWaitTime(): number {
    const now = Date.now();
    
    if (this.requestTimes.length === 0) return 0;
    
    const oldestRequest = Math.min(...this.requestTimes);
    const waitTime = 1000 - (now - oldestRequest);
    
    return Math.max(0, waitTime);
  }
}

/**
 * Nonce manager with collision detection
 */
class NonceManager {
  private usedNonces = new Map<string, Set<number>>();
  private pendingNonces = new Map<string, number>();

  /**
   * Get next safe nonce for an address
   */
  async getSafeNonce(
    provider: JsonRpcProvider, 
    address: string, 
    checkPending: boolean = true
  ): Promise<number> {
    const networkNonce = await provider.getTransactionCount(address, checkPending ? 'pending' : 'latest');
    
    // Track nonce collisions
    const addressNonces = this.usedNonces.get(address) || new Set();
    const pendingNonce = this.pendingNonces.get(address) || networkNonce;
    
    // Use the higher of network nonce or our tracked nonce
    const baseNonce = Math.max(networkNonce, pendingNonce);
    
    // Find first unused nonce
    let safeNonce = baseNonce;
    while (addressNonces.has(safeNonce)) {
      safeNonce++;
    }

    // Check for excessive nonce collisions (potential attack)
    if (safeNonce - baseNonce > TRANSPORT_SECURITY_CONFIG.nonceCollisionThreshold) {
      throw new Error(`🚨 SECURITY: Excessive nonce collisions detected for ${address}`);
    }

    // Reserve the nonce
    addressNonces.add(safeNonce);
    this.usedNonces.set(address, addressNonces);
    this.pendingNonces.set(address, safeNonce + 1);

    return safeNonce;
  }

  /**
   * Mark nonce as confirmed (remove from pending)
   */
  confirmNonce(address: string, nonce: number): void {
    const addressNonces = this.usedNonces.get(address);
    if (addressNonces) {
      addressNonces.delete(nonce);
    }
  }

  /**
   * Clear all pending nonces for an address (on error/reset)
   */
  clearPendingNonces(address: string): void {
    this.usedNonces.delete(address);
    this.pendingNonces.delete(address);
  }
}

/**
 * Secure RPC URL validator
 */
export const validateRpcUrl = (url: string): void => {
  try {
    const parsed = new URL(url);
    
    // Enforce HTTPS in production
    if (!TRANSPORT_SECURITY_CONFIG.allowInsecureConnections && parsed.protocol !== 'https:') {
      throw new Error(`🚨 SECURITY: Insecure RPC URL detected: ${url}. HTTPS required.`);
    }
    
    // Check for suspicious domains
    const suspiciousDomains = ['localhost', '127.0.0.1', '0.0.0.0'];
    if (!config.development.isDev && suspiciousDomains.some(domain => parsed.hostname.includes(domain))) {
      throw new Error(`🚨 SECURITY: Suspicious RPC domain: ${parsed.hostname}`);
    }
    
    // Validate port ranges
    if (parsed.port && parseInt(parsed.port) < 443) {
      console.warn(`⚠️ SECURITY: RPC using low port ${parsed.port}, verify this is intentional`);
    }
    
  } catch (error) {
    if (error instanceof Error && error.message.includes('SECURITY:')) {
      throw error;
    }
    throw new Error(`🚨 SECURITY: Invalid RPC URL format: ${url}`);
  }
};

/**
 * ChainId validator and pinning
 */
export const validateChainId = async (provider: JsonRpcProvider, expectedChainId: number): Promise<void> => {
  try {
    const network = await provider.getNetwork();
    const actualChainId = Number(network.chainId);
    
    // Validate against whitelist
    if (!TRANSPORT_SECURITY_CONFIG.chainIdWhitelist.includes(actualChainId)) {
      throw new Error(`🚨 SECURITY: ChainId ${actualChainId} not in whitelist`);
    }
    
    // Validate against expected
    if (actualChainId !== expectedChainId) {
      throw new Error(`🚨 SECURITY: ChainId mismatch. Expected ${expectedChainId}, got ${actualChainId}`);
    }
    
    console.log(`🔒 ChainId validation passed: ${actualChainId}`);
  } catch (error) {
    if (error instanceof Error && error.message.includes('SECURITY:')) {
      throw error;
    }
    throw new Error(`🚨 SECURITY: ChainId validation failed: ${error}`);
  }
};

/**
 * Gas parameter security validator
 */
export const validateGasParameters = (gasPrice?: bigint, gasLimit?: bigint): void => {
  if (gasPrice && gasPrice > TRANSPORT_SECURITY_CONFIG.maxGasPrice) {
    throw new Error(`🚨 SECURITY: Gas price ${gasPrice} exceeds maximum ${TRANSPORT_SECURITY_CONFIG.maxGasPrice}`);
  }
  
  if (gasLimit && gasLimit > TRANSPORT_SECURITY_CONFIG.maxGasLimit) {
    throw new Error(`🚨 SECURITY: Gas limit ${gasLimit} exceeds maximum ${TRANSPORT_SECURITY_CONFIG.maxGasLimit}`);
  }
};

/**
 * Transaction security validator
 */
export const validateTransaction = (tx: any): void => {
  // Validate recipient address format
  if (tx.to && !/^0x[0-9a-fA-F]{40}$/.test(tx.to)) {
    throw new Error(`🚨 SECURITY: Invalid recipient address format: ${tx.to}`);
  }
  
  // Validate value is not negative
  if (tx.value && BigInt(tx.value) < 0) {
    throw new Error(`🚨 SECURITY: Negative transaction value: ${tx.value}`);
  }
  
  // Validate gas parameters
  if (tx.gasPrice) validateGasParameters(BigInt(tx.gasPrice));
  if (tx.gasLimit) validateGasParameters(undefined, BigInt(tx.gasLimit));
  
  // Check for suspicious data patterns
  if (tx.data && tx.data.length > 100000) { // 100KB limit
    throw new Error(`🚨 SECURITY: Transaction data too large: ${tx.data.length} bytes`);
  }
};

/**
 * Secure RPC Provider wrapper
 */
export class SecureRpcProvider {
  private provider: JsonRpcProvider;
  private rateLimiter = new RpcRateLimiter();
  private nonceManager = new NonceManager();
  private networkConfig: NetworkConfig;

  constructor(networkConfig: NetworkConfig) {
    this.networkConfig = networkConfig;
    
    // Validate RPC URL
    validateRpcUrl(networkConfig.rpcUrl);
    
    // Create provider
    this.provider = new JsonRpcProvider(networkConfig.rpcUrl, {
      name: networkConfig.displayName,
      chainId: networkConfig.chainId,
    });

    // Validate chain ID on initialization
    this.validateNetworkConnection();
  }

  /**
   * Validate network connection and chain ID
   */
  private async validateNetworkConnection(): Promise<void> {
    try {
      await validateChainId(this.provider, this.networkConfig.chainId);
    } catch (error) {
      console.error('🚨 Network validation failed:', error);
      throw error;
    }
  }

  /**
   * Rate-limited RPC call
   */
  private async secureCall<T>(method: () => Promise<T>): Promise<T> {
    if (!this.rateLimiter.canMakeRequest()) {
      const waitTime = this.rateLimiter.getWaitTime();
      throw new Error(`🚨 SECURITY: Rate limit exceeded. Wait ${waitTime}ms before next request.`);
    }

    try {
      return await method();
    } catch (error) {
      console.error('🚨 Secure RPC call failed:', error);
      throw error;
    }
  }

  /**
   * Get secure transaction count with nonce management
   */
  async getTransactionCount(address: string, blockTag: string = 'pending'): Promise<number> {
    return this.secureCall(async () => {
      return await this.nonceManager.getSafeNonce(this.provider, address, blockTag === 'pending');
    });
  }

  /**
   * Send secure transaction
   */
  async sendTransaction(signedTx: string): Promise<any> {
    return this.secureCall(async () => {
      // Additional validation could be added here
      return await this.provider.broadcastTransaction(signedTx);
    });
  }

  /**
   * Get balance with rate limiting
   */
  async getBalance(address: string): Promise<bigint> {
    return this.secureCall(async () => {
      return await this.provider.getBalance(address);
    });
  }

  /**
   * Get gas price with validation
   */
  async getGasPrice(): Promise<bigint> {
    return this.secureCall(async () => {
      const feeData = await this.provider.getFeeData();
      const gasPrice = feeData.gasPrice || BigInt('20000000000'); // 20 gwei fallback
      validateGasParameters(gasPrice);
      return gasPrice;
    });
  }

  /**
   * Estimate gas with validation
   */
  async estimateGas(tx: any): Promise<bigint> {
    return this.secureCall(async () => {
      validateTransaction(tx);
      const gasEstimate = await this.provider.estimateGas(tx);
      validateGasParameters(undefined, gasEstimate);
      return gasEstimate;
    });
  }

  /**
   * Confirm nonce usage
   */
  confirmNonce(address: string, nonce: number): void {
    this.nonceManager.confirmNonce(address, nonce);
  }

  /**
   * Clear pending nonces on error
   */
  clearPendingNonces(address: string): void {
    this.nonceManager.clearPendingNonces(address);
  }

  /**
   * Get underlying provider (for read-only operations)
   */
  getProvider(): JsonRpcProvider {
    return this.provider;
  }
}

/**
 * Create secure RPC provider for a network
 */
export const createSecureProvider = (networkConfig: NetworkConfig): SecureRpcProvider => {
  return new SecureRpcProvider(networkConfig);
};

/**
 * Security audit for existing RPC configuration
 */
export const auditRpcSecurity = (networkConfigs: Record<string, NetworkConfig>): void => {
  console.log('🔒 Starting RPC security audit...');
  
  const issues: string[] = [];
  
  for (const [name, config] of Object.entries(networkConfigs)) {
    try {
      // Validate RPC URL
      validateRpcUrl(config.rpcUrl);
      
      // Check chain ID whitelist
      if (!TRANSPORT_SECURITY_CONFIG.chainIdWhitelist.includes(config.chainId)) {
        issues.push(`⚠️ Network ${name}: ChainId ${config.chainId} not in whitelist`);
      }
      
      // Check backup URLs
      if (config.backupRpcUrls) {
        for (const backupUrl of config.backupRpcUrls) {
          try {
            validateRpcUrl(backupUrl);
          } catch (error) {
            issues.push(`⚠️ Network ${name}: Invalid backup URL ${backupUrl}`);
          }
        }
      }
      
      console.log(`✅ Network ${name}: Security validation passed`);
      
    } catch (error) {
      issues.push(`❌ Network ${name}: ${error}`);
    }
  }
  
  if (issues.length > 0) {
    console.warn('🚨 RPC security issues found:');
    issues.forEach(issue => console.warn(issue));
  } else {
    console.log('🔒 RPC security audit completed - no issues found');
  }
};