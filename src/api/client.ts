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
  TaxConfiguration,
  UpdateTaxConfigRequest,
  TaxStatistics,
  TaxTransaction,
  RecordTaxTransactionRequest,
  ExcludedWallet,
  AddExcludedWalletRequest,
  CheckWalletExclusionResponse,
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
   * PUT request helper
   */
  private async put<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.fetchWithRetry<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * DELETE request helper
   */
  private async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.fetchWithRetry<T>(endpoint, {
      method: 'DELETE',
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
    return this.post<CreateTokenResponse>('/api/tokens', request);
  }

  /**
   * Get token by ID
   */
  async getToken(id: string): Promise<ApiResponse<any>> {
    return this.get<any>(`/api/tokens/${id}`);
  }

  /**
   * Save draft
   */
  async saveDraft(draft: any): Promise<ApiResponse<any>> {
    return this.post<any>('/api/drafts', draft);
  }

  /**
   * Get all drafts
   */
  async getDrafts(): Promise<ApiResponse<any[]>> {
    return this.get<any[]>('/api/drafts');
  }

  /**
   * Delete draft
   */
  async deleteDraft(id: string): Promise<ApiResponse<any>> {
    return this.fetchWithRetry<any>(`/api/drafts/${id}`, { method: 'DELETE' });
  }

  /**
   * Create launch plan
   */
  async createLaunchPlan(request: any): Promise<ApiResponse<any>> {
    return this.post<any>('/api/launch-plans', request);
  }

  /**
   * Get launch plan by ID
   */
  async getLaunchPlan(id: string): Promise<ApiResponse<any>> {
    return this.get<any>(`/api/launch-plans/${id}`);
  }

  /**
   * Generate wallets for launch plan
   */
  async generateWalletsForPlan(request: { launch_plan_id: string; count: number }): Promise<ApiResponse<any[]>> {
    return this.post<any[]>('/api/wallets/generate', request);
  }

  /**
   * Get wallets by launch plan ID
   */
  async getWalletsByPlan(planId: string): Promise<ApiResponse<any[]>> {
    return this.get<any[]>(`/api/wallets/${planId}`);
  }

  // ===== TAX SYSTEM API METHODS =====

  /**
   * Get current tax configuration
   */
  async getTaxConfig(): Promise<ApiResponse<TaxConfiguration>> {
    return this.get<TaxConfiguration>('/api/tax/config');
  }

  /**
   * Update tax configuration
   */
  async updateTaxConfig(updates: UpdateTaxConfigRequest): Promise<ApiResponse<TaxConfiguration>> {
    return this.put<TaxConfiguration>('/api/tax/config', updates);
  }

  /**
   * Get tax statistics
   */
  async getTaxStatistics(): Promise<ApiResponse<TaxStatistics>> {
    return this.get<TaxStatistics>('/api/tax/statistics');
  }

  /**
   * Get tax transactions history
   */
  async getTaxTransactions(limit?: number): Promise<ApiResponse<TaxTransaction[]>> {
    const params = limit ? `?limit=${limit}` : '';
    return this.get<TaxTransaction[]>(`/api/tax/transactions${params}`);
  }

  /**
   * Record a new tax transaction
   */
  async recordTaxTransaction(transaction: RecordTaxTransactionRequest): Promise<ApiResponse<TaxTransaction>> {
    return this.post<TaxTransaction>('/api/tax/transactions', transaction);
  }

  /**
   * Get excluded wallets list
   */
  async getExcludedWallets(): Promise<ApiResponse<ExcludedWallet[]>> {
    return this.get<ExcludedWallet[]>('/api/tax/excluded-wallets');
  }

  /**
   * Add wallet to exclusion list
   */
  async addExcludedWallet(request: AddExcludedWalletRequest): Promise<ApiResponse<{ message: string; wallet_address: string }>> {
    return this.post<{ message: string; wallet_address: string }>('/api/tax/excluded-wallets', request);
  }

  /**
   * Remove wallet from exclusion list
   */
  async removeExcludedWallet(walletAddress: string): Promise<ApiResponse<{ message: string; wallet_address: string }>> {
    return this.delete<{ message: string; wallet_address: string }>(`/api/tax/excluded-wallets/${walletAddress}`);
  }

  /**
   * Check if wallet is excluded from tax
   */
  async checkWalletExclusion(walletAddress: string): Promise<CheckWalletExclusionResponse> {
    const response = await this.get<CheckWalletExclusionResponse>(`/api/tax/check-exclusion/${walletAddress}`);
    if (response.success && response.data) {
      return response.data;
    }
    return {
      wallet_address: walletAddress,
      is_excluded: false,
    };
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