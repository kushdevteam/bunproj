const SolanaService = require('./solanaService');
const StorageService = require('./storageService');

class BundleService {
    constructor() {
        this.solanaService = new SolanaService();
        this.storageService = new StorageService();
        this.activeBundles = new Map();
        this.bundleCounter = 0;
    }

    /**
     * Validate bundle configuration
     */
    validateBundleConfig({ type, tokenAddress, amountPerWallet, wallets, settings }) {
        const errors = [];

        // Validate bundle type
        if (!['buy', 'sell', 'create-lp', 'distribute'].includes(type)) {
            errors.push('Invalid bundle type');
        }

        // Validate token address (except for create-lp)
        if (type !== 'create-lp' && (!tokenAddress || !this.solanaService.isValidAddress(tokenAddress))) {
            errors.push('Valid token address is required');
        }

        // Validate amount per wallet
        if (!amountPerWallet || amountPerWallet <= 0 || amountPerWallet > 100) {
            errors.push('Amount per wallet must be between 0.001 and 100 SOL');
        }

        // Validate wallets
        if (!wallets || !Array.isArray(wallets) || wallets.length === 0 || wallets.length > 100) {
            errors.push('Must provide between 1 and 100 wallets');
        }

        // Validate wallet addresses
        if (wallets) {
            const invalidWallets = wallets.filter(wallet => 
                !wallet.publicKey || !this.solanaService.isValidAddress(wallet.publicKey)
            );
            if (invalidWallets.length > 0) {
                errors.push(`${invalidWallets.length} invalid wallet addresses`);
            }
        }

        // Validate settings if provided
        if (settings) {
            if (settings.staggerDelay && (settings.staggerDelay < 0 || settings.staggerDelay > 10000)) {
                errors.push('Stagger delay must be between 0 and 10000ms');
            }
            
            if (settings.priorityFee && (settings.priorityFee < 0 || settings.priorityFee > 1)) {
                errors.push('Priority fee must be between 0 and 1 SOL');
            }
            
            if (settings.slippage && (settings.slippage < 0.1 || settings.slippage > 50)) {
                errors.push('Slippage must be between 0.1% and 50%');
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Execute bundle transaction
     */
    async executeBundle({ type, tokenAddress, amountPerWallet, wallets, settings }) {
        const bundleId = ++this.bundleCounter;
        const bundleStartTime = Date.now();
        
        console.log(`🚀 Executing bundle ${bundleId}: ${type} with ${wallets.length} wallets`);

        // Create bundle object
        const bundle = {
            bundleId,
            type,
            tokenAddress,
            amountPerWallet,
            walletsCount: wallets.length,
            settings: settings || {},
            status: 'executing',
            transactions: [],
            createdAt: new Date().toISOString(),
            startTime: bundleStartTime
        };

        // Add to active bundles
        this.activeBundles.set(bundleId, bundle);

        try {
            // Execute transactions for each wallet
            const transactions = await this.executeWalletTransactions({
                bundleId,
                type,
                tokenAddress,
                amountPerWallet,
                wallets,
                settings
            });

            // Calculate results
            const successCount = transactions.filter(tx => tx.status === 'confirmed').length;
            const failedCount = transactions.filter(tx => tx.status === 'failed').length;
            const totalCost = this.calculateTotalCost(transactions);

            // Update bundle with results
            bundle.transactions = transactions;
            bundle.successCount = successCount;
            bundle.failedCount = failedCount;
            bundle.totalCost = totalCost.toFixed(6);
            bundle.status = successCount > 0 ? 'completed' : 'failed';
            bundle.completedAt = new Date().toISOString();
            bundle.executionTime = Date.now() - bundleStartTime;

            // Remove from active bundles
            this.activeBundles.delete(bundleId);

            console.log(`✅ Bundle ${bundleId} completed: ${successCount}/${wallets.length} successful transactions`);

            return bundle;

        } catch (error) {
            console.error(`❌ Bundle ${bundleId} failed:`, error);
            
            // Update bundle with error
            bundle.status = 'failed';
            bundle.error = error.message;
            bundle.completedAt = new Date().toISOString();
            bundle.executionTime = Date.now() - bundleStartTime;

            // Remove from active bundles
            this.activeBundles.delete(bundleId);

            throw error;
        }
    }

    /**
     * Execute transactions for all wallets in the bundle
     */
    async executeWalletTransactions({ bundleId, type, tokenAddress, amountPerWallet, wallets, settings }) {
        const transactions = [];
        const { staggerDelay = 100, priorityFee = 0.001, stealthMode = false } = settings || {};

        for (let i = 0; i < wallets.length; i++) {
            const wallet = wallets[i];
            
            try {
                console.log(`💰 Processing wallet ${i + 1}/${wallets.length}: ${wallet.publicKey.substring(0, 8)}...`);

                // Execute single wallet transaction
                const transaction = await this.executeWalletTransaction({
                    bundleId,
                    wallet,
                    type,
                    tokenAddress,
                    amountPerWallet,
                    priorityFee,
                    stealthMode
                });

                transactions.push(transaction);

                // Apply stagger delay between transactions (except for last one)
                if (staggerDelay > 0 && i < wallets.length - 1) {
                    await this.sleep(staggerDelay);
                }

            } catch (error) {
                console.error(`❌ Wallet transaction failed: ${error.message}`);
                
                transactions.push({
                    bundleId,
                    wallet: wallet.publicKey,
                    status: 'failed',
                    amount: amountPerWallet,
                    fee: 0,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        }

        return transactions;
    }

    /**
     * Execute transaction for a single wallet
     */
    async executeWalletTransaction({ bundleId, wallet, type, tokenAddress, amountPerWallet, priorityFee, stealthMode }) {
        // Simulate transaction processing
        const processingTime = Math.random() * 2000 + 500; // 500-2500ms
        await this.sleep(processingTime);

        // Simulate transaction success/failure (95% success rate)
        const success = Math.random() > 0.05;
        
        if (!success) {
            throw new Error('Transaction simulation failed');
        }

        // Create transaction result
        const transaction = {
            bundleId,
            wallet: wallet.publicKey,
            status: 'confirmed',
            amount: amountPerWallet,
            fee: priorityFee,
            signature: this.solanaService.generateMockSignature(),
            timestamp: new Date().toISOString(),
            type,
            tokenAddress,
            stealthMode
        };

        return transaction;
    }

    /**
     * Calculate total cost of all transactions
     */
    calculateTotalCost(transactions) {
        return transactions.reduce((total, tx) => {
            const amount = parseFloat(tx.amount) || 0;
            const fee = parseFloat(tx.fee) || 0;
            return total + amount + fee;
        }, 0);
    }

    /**
     * Cancel bundle execution
     */
    async cancelBundle(bundleId) {
        const bundle = this.activeBundles.get(parseInt(bundleId));
        
        if (!bundle) {
            return {
                success: false,
                error: 'Bundle not found or already completed'
            };
        }

        // Mark bundle as cancelled
        bundle.status = 'cancelled';
        bundle.cancelledAt = new Date().toISOString();
        
        // Remove from active bundles
        this.activeBundles.delete(parseInt(bundleId));

        console.log(`🛑 Bundle ${bundleId} cancelled`);

        return {
            success: true,
            bundle
        };
    }

    /**
     * Get bundle statistics
     */
    async getBundleStats() {
        try {
            const bundles = await this.storageService.getBundles();
            
            const stats = {
                totalBundles: bundles.length,
                completedBundles: bundles.filter(b => b.status === 'completed').length,
                failedBundles: bundles.filter(b => b.status === 'failed').length,
                totalTransactions: bundles.reduce((sum, b) => sum + (b.transactions?.length || 0), 0),
                successfulTransactions: bundles.reduce((sum, b) => {
                    return sum + (b.transactions?.filter(t => t.status === 'confirmed').length || 0);
                }, 0),
                totalVolume: bundles.reduce((sum, b) => sum + parseFloat(b.totalCost || 0), 0),
                averageSuccessRate: 0,
                activeBundles: this.activeBundles.size
            };

            // Calculate average success rate
            const bundlesWithTransactions = bundles.filter(b => b.transactions && b.transactions.length > 0);
            if (bundlesWithTransactions.length > 0) {
                const totalSuccessRate = bundlesWithTransactions.reduce((sum, b) => {
                    const successRate = (b.successCount / b.transactions.length) * 100;
                    return sum + successRate;
                }, 0);
                stats.averageSuccessRate = (totalSuccessRate / bundlesWithTransactions.length).toFixed(2);
            }

            return stats;
        } catch (error) {
            console.error('Error getting bundle stats:', error);
            return {
                totalBundles: 0,
                completedBundles: 0,
                failedBundles: 0,
                totalTransactions: 0,
                successfulTransactions: 0,
                totalVolume: 0,
                averageSuccessRate: 0,
                activeBundles: this.activeBundles.size
            };
        }
    }

    /**
     * Estimate bundle cost
     */
    estimateBundleCost({ type, amountPerWallet, walletCount, settings }) {
        const { priorityFee = 0.001 } = settings || {};
        
        const totalAmount = walletCount * amountPerWallet;
        const totalFees = walletCount * priorityFee;
        const networkFees = walletCount * 0.000005; // Base network fee
        
        return {
            walletCount,
            amountPerWallet,
            totalAmount: totalAmount.toFixed(6),
            priorityFees: totalFees.toFixed(6),
            networkFees: networkFees.toFixed(6),
            totalCost: (totalAmount + totalFees + networkFees).toFixed(6),
            estimatedTime: `${walletCount * 0.5}-${walletCount * 2} seconds`
        };
    }

    /**
     * Get supported bundle types
     */
    getSupportedBundleTypes() {
        return [
            {
                type: 'buy',
                name: 'Multi-Wallet Buy',
                description: 'Execute simultaneous buy orders across multiple wallets',
                requiresToken: true,
                maxWallets: 100
            },
            {
                type: 'sell',
                name: 'Multi-Wallet Sell',
                description: 'Execute coordinated sell orders across multiple wallets',
                requiresToken: true,
                maxWallets: 100
            },
            {
                type: 'create-lp',
                name: 'Create LP + First Buy',
                description: 'Create liquidity pool and execute first buy in same bundle',
                requiresToken: false,
                maxWallets: 50
            },
            {
                type: 'distribute',
                name: 'Token Distribution',
                description: 'Distribute tokens to multiple wallets',
                requiresToken: true,
                maxWallets: 100
            }
        ];
    }

    /**
     * Sleep utility function
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = BundleService;
