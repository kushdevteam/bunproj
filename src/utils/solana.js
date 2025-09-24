/**
 * Solana Utilities
 */
class SolanaUtils {
    constructor() {
        this.LAMPORTS_PER_SOL = 1000000000;
        this.SOLANA_DEVNET_URL = 'https://api.devnet.solana.com';
        this.SOLANA_MAINNET_URL = 'https://api.mainnet-beta.solana.com';
    }

    /**
     * Validate Solana address
     */
    isValidAddress(address) {
        if (!address || typeof address !== 'string') {
            return false;
        }

        // Basic validation - Solana addresses are base58 encoded and typically 32-44 characters
        const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
        return base58Regex.test(address);
    }

    /**
     * Convert SOL to lamports
     */
    solToLamports(sol) {
        return Math.floor(parseFloat(sol) * this.LAMPORTS_PER_SOL);
    }

    /**
     * Convert lamports to SOL
     */
    lamportsToSol(lamports) {
        return parseFloat(lamports) / this.LAMPORTS_PER_SOL;
    }

    /**
     * Format SOL amount for display
     */
    formatSolAmount(amount, decimals = 4) {
        const num = parseFloat(amount);
        if (isNaN(num)) return '0';
        return num.toFixed(decimals);
    }

    /**
     * Truncate address for display
     */
    truncateAddress(address, startChars = 4, endChars = 4) {
        if (!address) return '';
        if (address.length <= startChars + endChars) return address;
        return `${address.substring(0, startChars)}...${address.substring(address.length - endChars)}`;
    }

    /**
     * Generate explorer URL
     */
    getExplorerUrl(signature, network = 'devnet') {
        const baseUrl = network === 'mainnet' 
            ? 'https://solscan.io'
            : 'https://solscan.io';
        
        const networkParam = network === 'devnet' ? '?cluster=devnet' : '';
        return `${baseUrl}/tx/${signature}${networkParam}`;
    }

    /**
     * Get token explorer URL
     */
    getTokenExplorerUrl(tokenAddress, network = 'devnet') {
        const baseUrl = network === 'mainnet' 
            ? 'https://solscan.io'
            : 'https://solscan.io';
        
        const networkParam = network === 'devnet' ? '?cluster=devnet' : '';
        return `${baseUrl}/token/${tokenAddress}${networkParam}`;
    }

    /**
     * Validate transaction signature
     */
    isValidSignature(signature) {
        if (!signature || typeof signature !== 'string') {
            return false;
        }

        // Transaction signatures are base58 encoded and typically 64-88 characters
        const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{64,88}$/;
        return base58Regex.test(signature);
    }

    /**
     * Calculate transaction fee estimate
     */
    estimateTransactionFee(priorityFee = 0.001) {
        const baseFee = 0.000005; // 5000 lamports base fee
        return baseFee + parseFloat(priorityFee);
    }

    /**
     * Validate bundle configuration
     */
    validateBundleConfig(config) {
        const errors = [];

        // Validate token address (if provided)
        if (config.tokenAddress && !this.isValidAddress(config.tokenAddress)) {
            errors.push('Invalid token address format');
        }

        // Validate amount
        if (!config.amountPerWallet || config.amountPerWallet <= 0) {
            errors.push('Amount per wallet must be greater than 0');
        }

        // Validate slippage
        if (config.settings?.slippage < 0.1 || config.settings?.slippage > 50) {
            errors.push('Slippage must be between 0.1% and 50%');
        }

        // Validate stagger delay
        if (config.settings?.staggerDelay < 0 || config.settings?.staggerDelay > 10000) {
            errors.push('Stagger delay must be between 0 and 10000ms');
        }

        // Validate priority fee
        if (config.settings?.priorityFee < 0 || config.settings?.priorityFee > 1) {
            errors.push('Priority fee must be between 0 and 1 SOL');
        }

        return {
            valid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Calculate bundle cost estimate
     */
    calculateBundleCost(walletCount, amountPerWallet, priorityFee = 0.001) {
        const totalAmount = walletCount * parseFloat(amountPerWallet);
        const totalFees = walletCount * this.estimateTransactionFee(priorityFee);
        
        return {
            totalAmount: this.formatSolAmount(totalAmount),
            totalFees: this.formatSolAmount(totalFees),
            totalCost: this.formatSolAmount(totalAmount + totalFees)
        };
    }

    /**
     * Format transaction status
     */
    formatTransactionStatus(status) {
        const statusMap = {
            'confirmed': { text: 'Confirmed', class: 'status-success', icon: 'fa-check-circle' },
            'failed': { text: 'Failed', class: 'status-failed', icon: 'fa-times-circle' },
            'pending': { text: 'Pending', class: 'status-pending', icon: 'fa-clock' },
            'processing': { text: 'Processing', class: 'status-pending', icon: 'fa-spinner fa-spin' }
        };

        return statusMap[status] || { text: 'Unknown', class: 'text-muted', icon: 'fa-question' };
    }

    /**
     * Get recommended network based on environment
     */
    getRecommendedNetwork() {
        return window.location.hostname === 'localhost' ? 'devnet' : 'mainnet';
    }

    /**
     * Format timestamp for display
     */
    formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        return {
            date: date.toLocaleDateString(),
            time: date.toLocaleTimeString(),
            full: date.toLocaleString(),
            iso: date.toISOString()
        };
    }

    /**
     * Generate random transaction signature for demo purposes
     */
    generateMockSignature() {
        const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
        let result = '';
        for (let i = 0; i < 64; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    /**
     * Parse error message from Solana transaction
     */
    parseTransactionError(error) {
        if (typeof error === 'string') {
            return error;
        }

        if (error?.message) {
            return error.message;
        }

        if (error?.logs && Array.isArray(error.logs)) {
            const errorLog = error.logs.find(log => log.includes('Error:'));
            if (errorLog) {
                return errorLog.replace('Program log: Error: ', '');
            }
        }

        return 'Unknown transaction error';
    }
}

// Export for use in other modules
window.SolanaUtils = SolanaUtils;
