/**
 * API Service for Proxima Solana Bundler
 */
class ApiService {
    constructor() {
        this.baseURL = '/api';
        this.timeout = 30000; // 30 seconds timeout
    }

    /**
     * Make HTTP request with error handling
     */
    async makeRequest(method, endpoint, data = null, options = {}) {
        const config = {
            method,
            url: `${this.baseURL}${endpoint}`,
            timeout: this.timeout,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        if (data) {
            config.data = data;
        }

        try {
            const response = await axios(config);
            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            console.error(`API Error [${method} ${endpoint}]:`, error);
            
            let errorMessage = 'An unexpected error occurred';
            if (error.response) {
                errorMessage = error.response.data?.error || error.response.statusText;
            } else if (error.request) {
                errorMessage = 'No response from server';
            } else {
                errorMessage = error.message;
            }

            return {
                success: false,
                error: errorMessage,
                status: error.response?.status
            };
        }
    }

    /**
     * Health check
     */
    async healthCheck() {
        return this.makeRequest('GET', '/health');
    }

    /**
     * Generate wallets
     */
    async generateWallets(count) {
        return this.makeRequest('POST', '/wallets/generate', { count });
    }

    /**
     * Fund wallets
     */
    async fundWallets(wallets, amount) {
        return this.makeRequest('POST', '/wallets/fund', { wallets, amount });
    }

    /**
     * Get wallet balances
     */
    async getWalletBalances(wallets) {
        return this.makeRequest('POST', '/wallets/balances', { wallets });
    }

    /**
     * Execute bundle transaction
     */
    async executeBundle(bundleConfig) {
        return this.makeRequest('POST', '/bundle/execute', bundleConfig);
    }

    /**
     * Get transaction history
     */
    async getTransactionHistory(limit = 50, offset = 0) {
        return this.makeRequest('GET', `/history?limit=${limit}&offset=${offset}`);
    }

    /**
     * Get bundle details
     */
    async getBundleDetails(bundleId) {
        return this.makeRequest('GET', `/bundle/${bundleId}`);
    }

    /**
     * Get token information
     */
    async getTokenInfo(tokenAddress) {
        return this.makeRequest('GET', `/token/${tokenAddress}`);
    }

    /**
     * Validate transaction before execution
     */
    async validateTransaction(transactionData) {
        return this.makeRequest('POST', '/transaction/validate', transactionData);
    }

    /**
     * Get network status
     */
    async getNetworkStatus() {
        return this.makeRequest('GET', '/network/status');
    }

    /**
     * Get current SOL price
     */
    async getSolPrice() {
        return this.makeRequest('GET', '/price/sol');
    }
}

// Export for use in other modules
window.ApiService = ApiService;
