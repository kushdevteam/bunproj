/**
 * API Client for Multi-Wallet Bundler
 * Handles all communication with the Python backend
 */

import { config } from '../config/env';
import type {
  ApiResponse,
  ApiError,
  HealthResponse,
  GenerateWalletsRequest,
  GenerateWalletsResponse,
  FundWalletsRequest,
  FundWalletsResponse,
  ExecuteBundleRequest,
  ExecuteBundleResponse,
  CreateTokenRequest,
  CreateTokenResponse,
  Wallet,
} from '../types';

class ApiClient {
  private baseUrl: string;
  private timeout: number;
  private retryAttempts: number;

  constructor() {
    this.baseUrl = config.api.baseUrl;
    this.timeout = config.api.timeout;
    this.retryAttempts = config.api.retryAttempts;
  }

  /**
   * Generic fetch wrapper with error handling and retries
   */
  private async fetchWithRetry<T>(
    endpoint: string,
    options: RequestInit = {},
    attempt: number = 1
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    
    // Security guard: Ensure no private keys in request body
    if (options.body) {
      const bodyString = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
      if (bodyString.includes('privateKey') || bodyString.includes('private_key')) {
        throw new Error('SECURITY ERROR: Private keys must never be transmitted to backend');
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data as ApiResponse<T>;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (attempt < this.retryAttempts && !controller.signal.aborted) {
        console.warn(`API request failed, retrying... (attempt ${attempt}/${this.retryAttempts})`);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
        return this.fetchWithRetry<T>(endpoint, options, attempt + 1);
      }
      
      throw error;
    }
  }

  /**
   * GET request helper
   */
  private async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.fetchWithRetry<T>(endpoint, { method: 'GET' });
  }

  /**
   * POST request helper
   */
  private async post<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.fetchWithRetry<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * Health check endpoint
   */
  async health(): Promise<ApiResponse<HealthResponse>> {
    return this.get<HealthResponse>('/api/health');
  }

  /**
   * Generate wallets
   * Note: Private keys are handled client-side only
   */
  async generateWallets(request: GenerateWalletsRequest): Promise<ApiResponse<GenerateWalletsResponse>> {
    // Remove any private key references before sending
    const sanitizedRequest = {
      count: request.count,
      roles: request.roles,
    };
    
    return this.post<GenerateWalletsResponse>('/api/wallets/generate', sanitizedRequest);
  }

  /**
   * Get wallet balances
   */
  async getWalletBalances(addresses: string[]): Promise<ApiResponse<Array<{ address: string; balance: number }>>> {
    // Use POST with addresses in body for large lists
    if (addresses.length > 10) {
      return this.post<Array<{ address: string; balance: number }>>('/api/wallets/balances', { addresses });
    }
    
    // Use GET with query params for small lists
    const queryParams = addresses.map(addr => `address=${encodeURIComponent(addr)}`).join('&');
    return this.get<Array<{ address: string; balance: number }>>(`/api/wallets/balances?${queryParams}`);
  }

  /**
   * Fund wallets with BNB/ETH
   */
  async fundWallets(request: FundWalletsRequest): Promise<ApiResponse<FundWalletsResponse>> {
    // Ensure wallet addresses are public keys only
    const sanitizedRequest = {
      wallets: request.wallets, // Only addresses, no private keys
      amount: request.amount,
      currency: request.currency,
    };
    
    return this.post<FundWalletsResponse>('/api/wallets/fund', sanitizedRequest);
  }

  /**
   * Execute bundle transaction
   */
  async executeBundle(request: ExecuteBundleRequest): Promise<ApiResponse<ExecuteBundleResponse>> {
    // Remove any sensitive data and ensure only public addresses are sent
    const sanitizedRequest = {
      config: request.config,
      wallets: request.wallets, // Only addresses
      dryRun: request.dryRun || false,
    };
    
    return this.post<ExecuteBundleResponse>('/api/bundle/execute', sanitizedRequest);
  }

  /**
   * Create token
   */
  async createToken(request: CreateTokenRequest): Promise<ApiResponse<CreateTokenResponse>> {
    return this.post<CreateTokenResponse>('/api/tokens/create', request);
  }

  /**
   * Get statistics (if available)
   */
  async getStatistics(): Promise<ApiResponse<any>> {
    return this.get<any>('/api/statistics');
  }

  /**
   * Execute treasury withdrawal operation
   */
  async executeTreasuryWithdrawal(request: {
    type: string;
    treasuryAddress: string;
    selectedWallets: string[];
    withdrawalAmounts: Record<string, number>;
    minimumBalance: number;
  }): Promise<ApiResponse<any>> {
    // Remove any sensitive data and ensure only public addresses are sent
    const sanitizedRequest = {
      type: request.type,
      treasuryAddress: request.treasuryAddress,
      selectedWallets: request.selectedWallets,
      withdrawalAmounts: request.withdrawalAmounts,
      minimumBalance: request.minimumBalance,
    };
    
    return this.post<any>('/api/treasury/withdraw', sanitizedRequest);
  }

  /**
   * Test connection to API
   */
  async testConnection(): Promise<boolean> {
    try {
      console.log('Testing API connection with baseUrl:', this.baseUrl);
      const response = await this.health();
      console.log('API health response:', response);
      return response.success === true;
    } catch (error) {
      console.error('API connection test failed:', error);
      return false;
    }
  }

  /**
   * Validate API response format
   */
  private validateResponse<T>(response: any): ApiResponse<T> {
    if (typeof response !== 'object' || response === null) {
      throw new Error('Invalid API response format');
    }
    
    if (typeof response.success !== 'boolean') {
      throw new Error('API response missing success field');
    }
    
    if (!response.success && !response.error) {
      throw new Error('API response indicates failure but no error provided');
    }
    
    return response;
  }

  /**
   * Handle API errors consistently
   */
  private handleError(error: any): ApiError {
    if (error instanceof Error) {
      return {
        code: 'NETWORK_ERROR',
        message: error.message,
        details: error.stack,
      };
    }
    
    return {
      code: 'UNKNOWN_ERROR',
      message: 'An unknown error occurred',
      details: String(error),
    };
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Export class for testing
export { ApiClient };

// Utility function to check if we're in development mode
export const isDevelopment = (): boolean => config.development.isDev;

// Utility function to log API calls in development
export const logApiCall = (endpoint: string, method: string, data?: any): void => {
  if (config.development.enableLogging) {
    console.log(`[API] ${method} ${endpoint}`, data || '');
  }
};