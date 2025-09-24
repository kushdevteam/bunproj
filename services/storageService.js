const fs = require('fs').promises;
const path = require('path');

class StorageService {
    constructor() {
        this.dataDir = path.join(__dirname, '../data');
        this.transactionsFile = path.join(this.dataDir, 'transactions.json');
        this.bundlesFile = path.join(this.dataDir, 'bundles.json');
        
        this.ensureDataDirectory();
    }

    /**
     * Ensure data directory exists
     */
    async ensureDataDirectory() {
        try {
            await fs.mkdir(this.dataDir, { recursive: true });
        } catch (error) {
            console.error('Error creating data directory:', error);
        }
    }

    /**
     * Read JSON file with error handling
     */
    async readJsonFile(filePath) {
        try {
            const data = await fs.readFile(filePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            if (error.code === 'ENOENT') {
                // File doesn't exist, return empty array
                return [];
            }
            console.error('Error reading JSON file:', error);
            return [];
        }
    }

    /**
     * Write JSON file with error handling
     */
    async writeJsonFile(filePath, data) {
        try {
            const jsonData = JSON.stringify(data, null, 2);
            await fs.writeFile(filePath, jsonData, 'utf8');
            return true;
        } catch (error) {
            console.error('Error writing JSON file:', error);
            return false;
        }
    }

    /**
     * Save transaction
     */
    async saveTransaction(transaction) {
        try {
            const transactions = await this.readJsonFile(this.transactionsFile);
            transactions.push(transaction);
            await this.writeJsonFile(this.transactionsFile, transactions);
            return transaction;
        } catch (error) {
            console.error('Error saving transaction:', error);
            throw error;
        }
    }

    /**
     * Get transaction by ID
     */
    async getTransaction(id) {
        try {
            const transactions = await this.readJsonFile(this.transactionsFile);
            return transactions.find(tx => tx.id === id);
        } catch (error) {
            console.error('Error getting transaction:', error);
            return null;
        }
    }

    /**
     * Get transactions with filters
     */
    async getTransactions(filters = {}, limit = 50, offset = 0) {
        try {
            let transactions = await this.readJsonFile(this.transactionsFile);
            
            // Apply filters
            if (filters.status) {
                transactions = transactions.filter(tx => tx.status === filters.status);
            }
            
            if (filters.type) {
                transactions = transactions.filter(tx => tx.type === filters.type);
            }
            
            if (filters.walletAddress) {
                transactions = transactions.filter(tx => tx.walletAddress === filters.walletAddress);
            }

            // Sort by creation date (newest first)
            transactions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            
            // Apply pagination
            return transactions.slice(offset, offset + limit);
        } catch (error) {
            console.error('Error getting transactions:', error);
            return [];
        }
    }

    /**
     * Update transaction
     */
    async updateTransaction(id, updatedTransaction) {
        try {
            const transactions = await this.readJsonFile(this.transactionsFile);
            const index = transactions.findIndex(tx => tx.id === id);
            
            if (index === -1) {
                return null;
            }
            
            transactions[index] = { ...transactions[index], ...updatedTransaction };
            await this.writeJsonFile(this.transactionsFile, transactions);
            
            return transactions[index];
        } catch (error) {
            console.error('Error updating transaction:', error);
            throw error;
        }
    }

    /**
     * Delete transaction
     */
    async deleteTransaction(id) {
        try {
            const transactions = await this.readJsonFile(this.transactionsFile);
            const index = transactions.findIndex(tx => tx.id === id);
            
            if (index === -1) {
                return false;
            }
            
            transactions.splice(index, 1);
            await this.writeJsonFile(this.transactionsFile, transactions);
            
            return true;
        } catch (error) {
            console.error('Error deleting transaction:', error);
            return false;
        }
    }

    /**
     * Save bundle
     */
    async saveBundle(bundle) {
        try {
            const bundles = await this.readJsonFile(this.bundlesFile);
            bundles.push(bundle);
            
            // Keep only last 1000 bundles to prevent file from growing too large
            if (bundles.length > 1000) {
                bundles.splice(0, bundles.length - 1000);
            }
            
            await this.writeJsonFile(this.bundlesFile, bundles);
            return bundle;
        } catch (error) {
            console.error('Error saving bundle:', error);
            throw error;
        }
    }

    /**
     * Get bundle by ID
     */
    async getBundle(bundleId) {
        try {
            const bundles = await this.readJsonFile(this.bundlesFile);
            return bundles.find(bundle => bundle.bundleId === parseInt(bundleId));
        } catch (error) {
            console.error('Error getting bundle:', error);
            return null;
        }
    }

    /**
     * Get bundles with filters
     */
    async getBundles(filters = {}, limit = 50, offset = 0) {
        try {
            let bundles = await this.readJsonFile(this.bundlesFile);
            
            // Apply filters
            if (filters.status) {
                bundles = bundles.filter(bundle => bundle.status === filters.status);
            }
            
            if (filters.type) {
                bundles = bundles.filter(bundle => bundle.type === filters.type);
            }

            // Sort by creation date (newest first)
            bundles.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            
            // Apply pagination
            return bundles.slice(offset, offset + limit);
        } catch (error) {
            console.error('Error getting bundles:', error);
            return [];
        }
    }

    /**
     * Get bundle history for display
     */
    async getBundleHistory(limit = 10) {
        try {
            const bundles = await this.getBundles({}, limit, 0);
            
            return bundles.map(bundle => ({
                bundleId: bundle.bundleId,
                type: bundle.type,
                tokenAddress: bundle.tokenAddress,
                walletsUsed: bundle.walletsCount || bundle.transactions?.length || 0,
                successCount: bundle.successCount || 0,
                totalCost: bundle.totalCost || '0',
                status: bundle.status,
                timestamp: bundle.createdAt
            }));
        } catch (error) {
            console.error('Error getting bundle history:', error);
            return [];
        }
    }

    /**
     * Clean old data (remove entries older than specified days)
     */
    async cleanOldData(daysToKeep = 30) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
            
            // Clean transactions
            let transactions = await this.readJsonFile(this.transactionsFile);
            const initialTransactionCount = transactions.length;
            transactions = transactions.filter(tx => new Date(tx.createdAt) > cutoffDate);
            
            if (transactions.length !== initialTransactionCount) {
                await this.writeJsonFile(this.transactionsFile, transactions);
                console.log(`🧹 Cleaned ${initialTransactionCount - transactions.length} old transactions`);
            }
            
            // Clean bundles
            let bundles = await this.readJsonFile(this.bundlesFile);
            const initialBundleCount = bundles.length;
            bundles = bundles.filter(bundle => new Date(bundle.createdAt) > cutoffDate);
            
            if (bundles.length !== initialBundleCount) {
                await this.writeJsonFile(this.bundlesFile, bundles);
                console.log(`🧹 Cleaned ${initialBundleCount - bundles.length} old bundles`);
            }
            
            return {
                transactionsRemoved: initialTransactionCount - transactions.length,
                bundlesRemoved: initialBundleCount - bundles.length
            };
        } catch (error) {
            console.error('Error cleaning old data:', error);
            return { transactionsRemoved: 0, bundlesRemoved: 0 };
        }
    }

    /**
     * Get storage statistics
     */
    async getStorageStats() {
        try {
            const transactions = await this.readJsonFile(this.transactionsFile);
            const bundles = await this.readJsonFile(this.bundlesFile);
            
            return {
                totalTransactions: transactions.length,
                totalBundles: bundles.length,
                lastTransaction: transactions.length > 0 ? transactions[transactions.length - 1].createdAt : null,
                lastBundle: bundles.length > 0 ? bundles[bundles.length - 1].createdAt : null
            };
        } catch (error) {
            console.error('Error getting storage stats:', error);
            return {
                totalTransactions: 0,
                totalBundles: 0,
                lastTransaction: null,
                lastBundle: null
            };
        }
    }
}

module.exports = StorageService;
