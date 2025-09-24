/**
 * Wallet Manager - Handles wallet generation, funding, and management
 */
class WalletManager {
    constructor() {
        this.wallets = [];
        this.serverUrl = 'http://localhost:8000';
    }

    /**
     * Generate specified number of wallets
     * @param {number} count - Number of wallets to generate
     */
    async generateWallets(count) {
        try {
            const response = await axios.post(`${this.serverUrl}/api/wallets/generate`, {
                count: count
            });

            if (response.data.success) {
                this.wallets = response.data.wallets;
                this.updateWalletDisplay();
                return { success: true, wallets: this.wallets };
            } else {
                throw new Error(response.data.error || 'Failed to generate wallets');
            }
        } catch (error) {
            console.error('Error generating wallets:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Fund all generated wallets with SOL
     * @param {number} amount - Amount of SOL to fund each wallet
     */
    async fundWallets(amount = 0.1) {
        if (this.wallets.length === 0) {
            return { success: false, error: 'No wallets to fund. Generate wallets first.' };
        }

        try {
            const response = await axios.post(`${this.serverUrl}/api/wallets/fund`, {
                wallets: this.wallets.map(w => w.publicKey),
                amount: amount
            });

            if (response.data.success) {
                // Update wallet balances
                this.wallets = response.data.wallets;
                this.updateWalletDisplay();
                return { success: true, funded: response.data.funded };
            } else {
                throw new Error(response.data.error || 'Failed to fund wallets');
            }
        } catch (error) {
            console.error('Error funding wallets:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get wallet balances
     */
    async getWalletBalances() {
        if (this.wallets.length === 0) {
            return { success: false, error: 'No wallets available' };
        }

        try {
            const response = await axios.post(`${this.serverUrl}/api/wallets/balances`, {
                wallets: this.wallets.map(w => w.publicKey)
            });

            if (response.data.success) {
                this.wallets = response.data.wallets;
                this.updateWalletDisplay();
                return { success: true, balances: response.data.balances };
            } else {
                throw new Error(response.data.error || 'Failed to get balances');
            }
        } catch (error) {
            console.error('Error getting balances:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Update wallet display in the UI
     */
    updateWalletDisplay() {
        const walletCounter = document.getElementById('wallet-counter');
        if (walletCounter) {
            walletCounter.textContent = this.wallets.length;
        }

        // Create wallet grid display
        const resultsContainer = document.getElementById('bundle-results');
        if (this.wallets.length > 0 && resultsContainer) {
            const walletGrid = this.createWalletGrid();
            resultsContainer.innerHTML = `
                <div class="col-12">
                    <h6><i class="fas fa-wallet me-2"></i>Generated Wallets</h6>
                    ${walletGrid}
                </div>
            `;
        }
    }

    /**
     * Create wallet grid HTML
     */
    createWalletGrid() {
        const walletsHtml = this.wallets.map((wallet, index) => `
            <div class="wallet-card">
                <div class="wallet-address">
                    ${this.truncateAddress(wallet.publicKey)}
                </div>
                <div class="balance-display">
                    <i class="fas fa-coins me-1"></i>
                    ${wallet.balance || '0'} SOL
                </div>
                <small class="text-muted">Wallet ${index + 1}</small>
            </div>
        `).join('');

        return `<div class="wallet-grid">${walletsHtml}</div>`;
    }

    /**
     * Truncate wallet address for display
     */
    truncateAddress(address) {
        if (!address) return '';
        return `${address.substring(0, 4)}...${address.substring(address.length - 4)}`;
    }

    /**
     * Get total wallet balance
     */
    getTotalBalance() {
        return this.wallets.reduce((total, wallet) => {
            return total + (parseFloat(wallet.balance) || 0);
        }, 0);
    }

    /**
     * Export wallets data
     */
    exportWallets() {
        if (this.wallets.length === 0) {
            return { success: false, error: 'No wallets to export' };
        }

        const exportData = {
            timestamp: new Date().toISOString(),
            wallets: this.wallets.map(wallet => ({
                publicKey: wallet.publicKey,
                balance: wallet.balance
            }))
        };

        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `proxima-wallets-${Date.now()}.json`;
        link.click();

        return { success: true };
    }

    /**
     * Clear all wallets
     */
    clearWallets() {
        this.wallets = [];
        this.updateWalletDisplay();
        
        // Clear results display
        const resultsContainer = document.getElementById('bundle-results');
        if (resultsContainer) {
            resultsContainer.innerHTML = `
                <div class="col-12 text-center text-muted">
                    <i class="fas fa-info-circle fa-2x mb-3"></i>
                    <p>No bundle results yet. Execute a bundle to see transaction details.</p>
                </div>
            `;
        }
    }
}
