/**
 * Faucet Client Service
 * Handles API integration with multiple BSC testnet faucets for test BNB distribution
 */

import { useNetworkStore } from '../store/network';

export interface FaucetRequest {
  address: string;
  amount?: number; // Optional amount in BNB, defaults to faucet standard
  userAgent?: string;
  captchaToken?: string;
}

export interface FaucetResponse {
  success: boolean;
  txHash?: string;
  amount?: number;
  message?: string;
  error?: string;
  cooldownSeconds?: number;
  nextRequestTime?: Date;
}

export interface FaucetConfig {
  id: string;
  name: string;
  url: string;
  apiUrl?: string;
  maxAmount: number; // Maximum BNB per request
  cooldownMinutes: number; // Cooldown period between requests
  requestsPerDay: number;
  isActive: boolean;
  priority: number; // Lower number = higher priority
  requiresCaptcha: boolean;
  supportsCustomAmount: boolean;
}

export const BSC_TESTNET_FAUCETS: FaucetConfig[] = [
  {
    id: 'bsc-official',
    name: 'BSC Official Faucet',
    url: 'https://testnet.bnbchain.org/faucet-smart',
    apiUrl: 'https://testnet.bnbchain.org/api/faucet-smart',
    maxAmount: 0.1,
    cooldownMinutes: 1440, // 24 hours
    requestsPerDay: 1,
    isActive: true,
    priority: 1,
    requiresCaptcha: false,
    supportsCustomAmount: false,
  },
  {
    id: 'alchemy-faucet',
    name: 'Alchemy BSC Testnet Faucet',
    url: 'https://bsctestnet.com/',
    apiUrl: 'https://api.bsctestnet.com/v1/faucet',
    maxAmount: 0.5,
    cooldownMinutes: 60, // 1 hour
    requestsPerDay: 24,
    isActive: true,
    priority: 2,
    requiresCaptcha: false,
    supportsCustomAmount: true,
  },
  {
    id: 'quicknode-faucet',
    name: 'QuickNode BSC Faucet',
    url: 'https://faucet.quicknode.com/binance-smart-chain/bnb-testnet',
    maxAmount: 0.2,
    cooldownMinutes: 720, // 12 hours
    requestsPerDay: 2,
    isActive: true,
    priority: 3,
    requiresCaptcha: true,
    supportsCustomAmount: false,
  },
  {
    id: 'testnet-faucet-community',
    name: 'Community BSC Faucet',
    url: 'https://testnet-faucet.com/bsc',
    maxAmount: 0.05,
    cooldownMinutes: 30,
    requestsPerDay: 48,
    isActive: true,
    priority: 4,
    requiresCaptcha: false,
    supportsCustomAmount: true,
  },
];

class FaucetClient {
  private requestHistory: Map<string, Date[]> = new Map();
  private cooldownTracker: Map<string, Date> = new Map();

  /**
   * Get active faucets sorted by priority
   */
  getActiveFaucets(): FaucetConfig[] {
    return BSC_TESTNET_FAUCETS
      .filter(faucet => faucet.isActive)
      .sort((a, b) => a.priority - b.priority);
  }

  /**
   * Get faucet configuration by ID
   */
  getFaucetConfig(faucetId: string): FaucetConfig | undefined {
    return BSC_TESTNET_FAUCETS.find(f => f.id === faucetId);
  }

  /**
   * Check if faucet requests are allowed (testnet only)
   */
  private validateNetworkForFaucet(): void {
    const networkStore = useNetworkStore.getState();
    
    if (networkStore.isMainnet()) {
      throw new Error('Faucet requests are only allowed on testnet for security reasons');
    }

    if (networkStore.currentNetwork.chainId !== 97) {
      throw new Error('Faucets are only available on BSC Testnet (Chain ID 97)');
    }

    if (!networkStore.isConnected) {
      throw new Error('Network connection required for faucet requests');
    }
  }

  /**
   * Check if address is in cooldown for a specific faucet
   */
  isInCooldown(faucetId: string, address: string): boolean {
    const key = `${faucetId}:${address}`;
    const lastRequest = this.cooldownTracker.get(key);
    
    if (!lastRequest) return false;

    const faucet = this.getFaucetConfig(faucetId);
    if (!faucet) return false;

    const cooldownMs = faucet.cooldownMinutes * 60 * 1000;
    return Date.now() - lastRequest.getTime() < cooldownMs;
  }

  /**
   * Get remaining cooldown time in seconds
   */
  getCooldownSeconds(faucetId: string, address: string): number {
    const key = `${faucetId}:${address}`;
    const lastRequest = this.cooldownTracker.get(key);
    
    if (!lastRequest) return 0;

    const faucet = this.getFaucetConfig(faucetId);
    if (!faucet) return 0;

    const cooldownMs = faucet.cooldownMinutes * 60 * 1000;
    const remainingMs = cooldownMs - (Date.now() - lastRequest.getTime());
    
    return Math.max(0, Math.ceil(remainingMs / 1000));
  }

  /**
   * Get next available request time
   */
  getNextRequestTime(faucetId: string, address: string): Date | null {
    const key = `${faucetId}:${address}`;
    const lastRequest = this.cooldownTracker.get(key);
    
    if (!lastRequest) return null;

    const faucet = this.getFaucetConfig(faucetId);
    if (!faucet) return null;

    const cooldownMs = faucet.cooldownMinutes * 60 * 1000;
    return new Date(lastRequest.getTime() + cooldownMs);
  }

  /**
   * Check daily request limit for address
   */
  hasReachedDailyLimit(faucetId: string, address: string): boolean {
    const key = `${faucetId}:${address}`;
    const requests = this.requestHistory.get(key) || [];
    
    const faucet = this.getFaucetConfig(faucetId);
    if (!faucet) return false;

    // Filter requests from last 24 hours
    const last24Hours = Date.now() - (24 * 60 * 60 * 1000);
    const recentRequests = requests.filter(time => time.getTime() > last24Hours);
    
    return recentRequests.length >= faucet.requestsPerDay;
  }

  /**
   * Request BNB from BSC Official Faucet
   */
  private async requestFromBSCOfficial(request: FaucetRequest): Promise<FaucetResponse> {
    const faucet = this.getFaucetConfig('bsc-official')!;
    
    try {
      // BSC Official faucet typically requires a POST request
      const response = await fetch(faucet.apiUrl!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': request.userAgent || 'Mozilla/5.0 (compatible; BundlerFaucetClient/1.0)',
        },
        body: JSON.stringify({
          address: request.address,
        }),
      });

      if (!response.ok) {
        throw new Error(`BSC Official faucet responded with ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // BSC faucet response format may vary
      if (data.success || data.status === 'success') {
        return {
          success: true,
          txHash: data.txHash || data.transactionHash,
          amount: faucet.maxAmount,
          message: data.message || 'Successfully requested test BNB from BSC Official faucet',
          cooldownSeconds: faucet.cooldownMinutes * 60,
        };
      } else {
        return {
          success: false,
          error: data.error || data.message || 'Failed to request from BSC Official faucet',
          cooldownSeconds: data.cooldown || faucet.cooldownMinutes * 60,
        };
      }
    } catch (error) {
      console.error('BSC Official faucet request failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error requesting from BSC Official faucet',
      };
    }
  }

  /**
   * Request BNB from Alchemy Faucet
   */
  private async requestFromAlchemy(request: FaucetRequest): Promise<FaucetResponse> {
    const faucet = this.getFaucetConfig('alchemy-faucet')!;
    
    try {
      const amount = Math.min(request.amount || faucet.maxAmount, faucet.maxAmount);
      
      const response = await fetch(faucet.apiUrl!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': request.userAgent || 'Mozilla/5.0 (compatible; BundlerFaucetClient/1.0)',
        },
        body: JSON.stringify({
          address: request.address,
          amount: amount.toString(),
          network: 'bsc-testnet',
        }),
      });

      if (!response.ok) {
        throw new Error(`Alchemy faucet responded with ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        return {
          success: true,
          txHash: data.txHash,
          amount: parseFloat(data.amount || amount.toString()),
          message: `Successfully requested ${amount} BNB from Alchemy faucet`,
          cooldownSeconds: faucet.cooldownMinutes * 60,
        };
      } else {
        return {
          success: false,
          error: data.error || 'Failed to request from Alchemy faucet',
          cooldownSeconds: faucet.cooldownMinutes * 60,
        };
      }
    } catch (error) {
      console.error('Alchemy faucet request failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error requesting from Alchemy faucet',
      };
    }
  }

  /**
   * Request BNB from QuickNode Faucet
   */
  private async requestFromQuickNode(request: FaucetRequest): Promise<FaucetResponse> {
    const faucet = this.getFaucetConfig('quicknode-faucet')!;
    
    try {
      // QuickNode may require captcha verification
      if (faucet.requiresCaptcha && !request.captchaToken) {
        return {
          success: false,
          error: 'QuickNode faucet requires captcha verification. Please complete captcha first.',
        };
      }

      const response = await fetch(faucet.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          address: request.address,
          ...(request.captchaToken && { 'g-recaptcha-response': request.captchaToken }),
        }),
      });

      if (!response.ok) {
        throw new Error(`QuickNode faucet responded with ${response.status}: ${response.statusText}`);
      }

      const text = await response.text();
      
      // QuickNode may return HTML, we need to parse it
      if (text.includes('success') || text.includes('sent')) {
        return {
          success: true,
          amount: faucet.maxAmount,
          message: `Successfully requested ${faucet.maxAmount} BNB from QuickNode faucet`,
          cooldownSeconds: faucet.cooldownMinutes * 60,
        };
      } else {
        return {
          success: false,
          error: 'Failed to request from QuickNode faucet - check cooldown period',
          cooldownSeconds: faucet.cooldownMinutes * 60,
        };
      }
    } catch (error) {
      console.error('QuickNode faucet request failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error requesting from QuickNode faucet',
      };
    }
  }

  /**
   * Request BNB from Community Faucet
   */
  private async requestFromCommunityFaucet(request: FaucetRequest): Promise<FaucetResponse> {
    const faucet = this.getFaucetConfig('testnet-faucet-community')!;
    
    try {
      const amount = Math.min(request.amount || faucet.maxAmount, faucet.maxAmount);
      
      const response = await fetch(faucet.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address: request.address,
          amount: amount,
          chain: 'bsc-testnet',
        }),
      });

      if (!response.ok) {
        throw new Error(`Community faucet responded with ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        return {
          success: true,
          txHash: data.txHash,
          amount: parseFloat(data.amount || amount.toString()),
          message: `Successfully requested ${amount} BNB from Community faucet`,
          cooldownSeconds: faucet.cooldownMinutes * 60,
        };
      } else {
        return {
          success: false,
          error: data.error || 'Failed to request from Community faucet',
          cooldownSeconds: faucet.cooldownMinutes * 60,
        };
      }
    } catch (error) {
      console.error('Community faucet request failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error requesting from Community faucet',
      };
    }
  }

  /**
   * Request BNB from a specific faucet
   */
  async requestFromFaucet(faucetId: string, request: FaucetRequest): Promise<FaucetResponse> {
    try {
      // Validate network
      this.validateNetworkForFaucet();

      // Validate request
      if (!request.address || !/^0x[a-fA-F0-9]{40}$/.test(request.address)) {
        throw new Error('Invalid Ethereum address format');
      }

      // Check cooldown
      if (this.isInCooldown(faucetId, request.address)) {
        const cooldownSeconds = this.getCooldownSeconds(faucetId, request.address);
        const nextRequestTime = this.getNextRequestTime(faucetId, request.address);
        return {
          success: false,
          error: `Address is in cooldown. Try again in ${Math.ceil(cooldownSeconds / 60)} minutes.`,
          cooldownSeconds,
          nextRequestTime: nextRequestTime || undefined,
        };
      }

      // Check daily limit
      if (this.hasReachedDailyLimit(faucetId, request.address)) {
        const faucet = this.getFaucetConfig(faucetId);
        return {
          success: false,
          error: `Daily limit of ${faucet?.requestsPerDay} requests reached for this address.`,
        };
      }

      let response: FaucetResponse;

      // Route to appropriate faucet implementation
      switch (faucetId) {
        case 'bsc-official':
          response = await this.requestFromBSCOfficial(request);
          break;
        case 'alchemy-faucet':
          response = await this.requestFromAlchemy(request);
          break;
        case 'quicknode-faucet':
          response = await this.requestFromQuickNode(request);
          break;
        case 'testnet-faucet-community':
          response = await this.requestFromCommunityFaucet(request);
          break;
        default:
          throw new Error(`Unknown faucet: ${faucetId}`);
      }

      // Track request history if successful or if there's a cooldown
      if (response.success || response.cooldownSeconds) {
        this.trackRequest(faucetId, request.address);
      }

      return response;
    } catch (error) {
      console.error(`Faucet request failed for ${faucetId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred during faucet request',
      };
    }
  }

  /**
   * Track successful request for cooldown and history
   */
  private trackRequest(faucetId: string, address: string): void {
    const key = `${faucetId}:${address}`;
    const now = new Date();
    
    // Update cooldown tracker
    this.cooldownTracker.set(key, now);
    
    // Update request history
    const history = this.requestHistory.get(key) || [];
    history.push(now);
    
    // Keep only last 50 requests to prevent memory bloat
    if (history.length > 50) {
      history.splice(0, history.length - 50);
    }
    
    this.requestHistory.set(key, history);
  }

  /**
   * Clear cooldown for an address (admin function for testing)
   */
  clearCooldown(faucetId: string, address: string): void {
    const key = `${faucetId}:${address}`;
    this.cooldownTracker.delete(key);
  }

  /**
   * Get request statistics for an address
   */
  getRequestStats(address: string): {
    faucetId: string;
    name: string;
    lastRequest: Date | null;
    requestCount24h: number;
    cooldownSeconds: number;
    nextRequestTime: Date | null;
  }[] {
    return this.getActiveFaucets().map(faucet => {
      const key = `${faucet.id}:${address}`;
      const history = this.requestHistory.get(key) || [];
      const lastRequest = this.cooldownTracker.get(key) || null;
      
      // Count requests in last 24 hours
      const last24Hours = Date.now() - (24 * 60 * 60 * 1000);
      const requestCount24h = history.filter(time => time.getTime() > last24Hours).length;
      
      return {
        faucetId: faucet.id,
        name: faucet.name,
        lastRequest,
        requestCount24h,
        cooldownSeconds: this.getCooldownSeconds(faucet.id, address),
        nextRequestTime: this.getNextRequestTime(faucet.id, address),
      };
    });
  }
}

// Export singleton instance
export const faucetClient = new FaucetClient();