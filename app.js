/**
 * Main Application Controller
 */
class ProximaBundlerApp {
    constructor() {
        this.walletManager = new WalletManager();
        this.bundler = new SolanaBundler(this.walletManager);
        this.isConnected = false;
        
        this.init();
    }

    /**
     * Initialize the application
     */
    async init() {
        this.setupEventListeners();
        this.checkServerConnection();
        this.updateConnectionStatus();
        
        // Check for saved wallet data
        this.loadSavedData();
    }

    /**
     * Setup event listeners for UI interactions
     */
    setupEventListeners() {
        // Wallet Management
        document.getElementById('generate-wallets').addEventListener('click', () => {
            this.handleGenerateWallets();
        });

        document.getElementById('fund-wallets').addEventListener('click', () => {
            this.handleFundWallets();
        });

        // Bundle Execution
        document.getElementById('execute-bundle').addEventListener('click', () => {
            this.handleExecuteBundle();
        });

        // Clear Results
        document.getElementById('clear-results').addEventListener('click', () => {
            this.bundler.clearResults();
        });

        // Bundle type change handler
        document.getElementById('bundle-type').addEventListener('change', (e) => {
            this.handleBundleTypeChange(e.target.value);
        });

        // Stealth mode toggle
        document.getElementById('stealth-mode').addEventListener('change', (e) => {
            this.updateStealthMode(e.target.checked);
        });

        // Auto-refresh wallet balances every 30 seconds
        setInterval(() => {
            if (this.walletManager.wallets.length > 0) {
                this.walletManager.getWalletBalances();
            }
        }, 30000);
    }

    /**
     * Handle wallet generation
     */
    async handleGenerateWallets() {
        const walletCount = parseInt(document.getElementById('wallet-count').value);
        
        if (walletCount < 1 || walletCount > 100) {
            this.showAlert('Please enter a valid number of wallets (1-100)', 'warning');
            return;
        }

        const generateBtn = document.getElementById('generate-wallets');
        const originalText = generateBtn.innerHTML;
        
        try {
            generateBtn.disabled = true;
            generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Generating...';

            const result = await this.walletManager.generateWallets(walletCount);
            
            if (result.success) {
                this.showAlert(`Successfully generated ${walletCount} wallets!`, 'success');
            } else {
                this.showAlert(`Failed to generate wallets: ${result.error}`, 'danger');
            }
        } catch (error) {
            this.showAlert(`Error: ${error.message}`, 'danger');
        } finally {
            generateBtn.disabled = false;
            generateBtn.innerHTML = originalText;
        }
    }

    /**
     * Handle wallet funding
     */
    async handleFundWallets() {
        if (this.walletManager.wallets.length === 0) {
            this.showAlert('No wallets to fund. Generate wallets first.', 'warning');
            return;
        }

        const fundBtn = document.getElementById('fund-wallets');
        const originalText = fundBtn.innerHTML;
        
        try {
            fundBtn.disabled = true;
            fundBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Funding...';

            const result = await this.walletManager.fundWallets(0.1);
            
            if (result.success) {
                this.showAlert(`Successfully funded ${result.funded} wallets!`, 'success');
            } else {
                this.showAlert(`Failed to fund wallets: ${result.error}`, 'danger');
            }
        } catch (error) {
            this.showAlert(`Error: ${error.message}`, 'danger');
        } finally {
            fundBtn.disabled = false;
            fundBtn.innerHTML = originalText;
        }
    }

    /**
     * Handle bundle execution
     */
    async handleExecuteBundle() {
        if (this.walletManager.wallets.length === 0) {
            this.showAlert('No wallets available. Generate wallets first.', 'warning');
            return;
        }

        // Get bundle configuration from UI
        const bundleConfig = this.getBundleConfig();
        
        // Validate configuration
        if (!this.validateBundleConfig(bundleConfig)) {
            return;
        }

        const executeBtn = document.getElementById('execute-bundle');
        const originalText = executeBtn.innerHTML;
        
        try {
            executeBtn.disabled = true;
            executeBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Executing...';

            const result = await this.bundler.executeBundle(bundleConfig);
            
            if (result.success) {
                this.showAlert('Bundle executed successfully!', 'success');
            } else {
                this.showAlert(`Bundle execution failed: ${result.error}`, 'danger');
            }
        } catch (error) {
            this.showAlert(`Error: ${error.message}`, 'danger');
        } finally {
            executeBtn.disabled = false;
            executeBtn.innerHTML = originalText;
        }
    }

    /**
     * Get bundle configuration from UI
     */
    getBundleConfig() {
        return {
            type: document.getElementById('bundle-type').value,
            tokenAddress: document.getElementById('token-address').value.trim(),
            amountPerWallet: parseFloat(document.getElementById('amount-per-wallet').value),
            staggerDelay: parseInt(document.getElementById('stagger-delay').value),
            priorityFee: parseFloat(document.getElementById('priority-fee').value),
            slippage: parseFloat(document.getElementById('slippage').value),
            stealthMode: document.getElementById('stealth-mode').checked
        };
    }

    /**
     * Validate bundle configuration
     */
    validateBundleConfig(config) {
        if (!config.tokenAddress && config.type !== 'create-lp') {
            this.showAlert('Token address is required for this bundle type', 'warning');
            return false;
        }

        if (!config.amountPerWallet || config.amountPerWallet <= 0) {
            this.showAlert('Amount per wallet must be greater than 0', 'warning');
            return false;
        }

        const totalRequired = config.amountPerWallet * this.walletManager.wallets.length;
        const totalAvailable = this.walletManager.getTotalBalance();
        
        if (totalRequired > totalAvailable) {
            this.showAlert(`Insufficient balance. Required: ${totalRequired} SOL, Available: ${totalAvailable.toFixed(4)} SOL`, 'warning');
            return false;
        }

        return true;
    }

    /**
     * Handle bundle type change
     */
    handleBundleTypeChange(bundleType) {
        const tokenAddressField = document.getElementById('token-address');
        
        if (bundleType === 'create-lp') {
            tokenAddressField.placeholder = 'Token will be created automatically';
            tokenAddressField.disabled = true;
        } else {
            tokenAddressField.placeholder = 'Enter token mint address';
            tokenAddressField.disabled = false;
        }
    }

    /**
     * Update stealth mode indicator
     */
    updateStealthMode(enabled) {
        const badge = document.getElementById('connection-status');
        if (enabled) {
            badge.classList.add('stealth-indicator');
        } else {
            badge.classList.remove('stealth-indicator');
        }
    }

    /**
     * Check server connection
     */
    async checkServerConnection() {
        try {
            const response = await axios.get(`${this.walletManager.serverUrl}/api/health`);
            this.isConnected = response.data.status === 'ok';
        } catch (error) {
            console.error('Server connection failed:', error);
            this.isConnected = false;
        }
        
        this.updateConnectionStatus();
    }

    /**
     * Update connection status in UI
     */
    updateConnectionStatus() {
        const statusBadge = document.getElementById('connection-status');
        
        if (this.isConnected) {
            statusBadge.textContent = 'Connected';
            statusBadge.className = 'badge bg-success connection-pulse';
        } else {
            statusBadge.textContent = 'Disconnected';
            statusBadge.className = 'badge bg-danger';
        }
    }

    /**
     * Show alert message
     */
    showAlert(message, type = 'info') {
        const alertHtml = `
            <div class="alert alert-${type} alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3" style="z-index: 9999; min-width: 300px;" role="alert">
                <i class="fas fa-${this.getAlertIcon(type)} me-2"></i>
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
        
        // Remove existing alerts
        document.querySelectorAll('.alert.position-fixed').forEach(alert => alert.remove());
        
        // Add new alert
        document.body.insertAdjacentHTML('afterbegin', alertHtml);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            const alert = document.querySelector('.alert.position-fixed');
            if (alert) {
                const bsAlert = new bootstrap.Alert(alert);
                bsAlert.close();
            }
        }, 5000);
    }

    /**
     * Get icon for alert type
     */
    getAlertIcon(type) {
        const icons = {
            'success': 'check-circle',
            'danger': 'exclamation-triangle',
            'warning': 'exclamation-circle',
            'info': 'info-circle'
        };
        return icons[type] || 'info-circle';
    }

    /**
     * Load saved data from localStorage
     */
    loadSavedData() {
        try {
            const savedWallets = localStorage.getItem('proxima-wallets');
            if (savedWallets) {
                this.walletManager.wallets = JSON.parse(savedWallets);
                this.walletManager.updateWalletDisplay();
            }

            const savedHistory = localStorage.getItem('proxima-history');
            if (savedHistory) {
                this.bundler.bundleHistory = JSON.parse(savedHistory);
                this.bundler.updateHistoryDisplay();
            }
        } catch (error) {
            console.error('Error loading saved data:', error);
        }
    }

    /**
     * Save data to localStorage
     */
    saveData() {
        try {
            localStorage.setItem('proxima-wallets', JSON.stringify(this.walletManager.wallets));
            localStorage.setItem('proxima-history', JSON.stringify(this.bundler.bundleHistory));
        } catch (error) {
            console.error('Error saving data:', error);
        }
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.proximaApp = new ProximaBundlerApp();
    
    // Save data periodically
    setInterval(() => {
        if (window.proximaApp) {
            window.proximaApp.saveData();
        }
    }, 30000); // Save every 30 seconds
    
    // Save data before page unload
    window.addEventListener('beforeunload', () => {
        if (window.proximaApp) {
            window.proximaApp.saveData();
        }
    });
});
