/**
 * Solana Bundler - Handles transaction bundling and execution
 */
class SolanaBundler {
    constructor(walletManager) {
        this.walletManager = walletManager;
        this.serverUrl = 'http://localhost:8000';
        this.bundleHistory = [];
        this.isExecuting = false;
    }

    /**
     * Execute a bundle transaction
     * @param {Object} bundleConfig - Bundle configuration
     */
    async executeBundle(bundleConfig) {
        if (this.isExecuting) {
            return { success: false, error: 'Bundle execution already in progress' };
        }

        if (this.walletManager.wallets.length === 0) {
            return { success: false, error: 'No wallets available. Generate wallets first.' };
        }

        this.isExecuting = true;
        this.showLoadingModal('Preparing Bundle...', 'Validating configuration and wallets');

        try {
            // Validate bundle configuration
            const validation = this.validateBundleConfig(bundleConfig);
            if (!validation.valid) {
                throw new Error(validation.error);
            }

            this.updateLoadingModal('Executing Bundle...', 'Broadcasting transactions to Solana network');

            // Prepare bundle request
            const bundleRequest = {
                type: bundleConfig.type,
                tokenAddress: bundleConfig.tokenAddress,
                amountPerWallet: bundleConfig.amountPerWallet,
                wallets: this.walletManager.wallets,
                settings: {
                    staggerDelay: bundleConfig.staggerDelay,
                    priorityFee: bundleConfig.priorityFee,
                    slippage: bundleConfig.slippage,
                    stealthMode: bundleConfig.stealthMode
                }
            };

            // Execute bundle on server
            const response = await axios.post(`${this.serverUrl}/api/bundle/execute`, bundleRequest);

            if (response.data.success) {
                const bundleResult = response.data.result;
                
                // Add to history
                this.addToHistory(bundleResult);
                
                // Update display
                this.displayBundleResults(bundleResult);
                
                this.hideLoadingModal();
                return { success: true, result: bundleResult };
            } else {
                throw new Error(response.data.error || 'Bundle execution failed');
            }

        } catch (error) {
            console.error('Bundle execution error:', error);
            this.hideLoadingModal();
            this.showError(error.message);
            return { success: false, error: error.message };
        } finally {
            this.isExecuting = false;
        }
    }

    /**
     * Validate bundle configuration
     */
    validateBundleConfig(config) {
        if (!config.tokenAddress && config.type !== 'create-lp') {
            return { valid: false, error: 'Token address is required' };
        }

        if (!config.amountPerWallet || config.amountPerWallet <= 0) {
            return { valid: false, error: 'Amount per wallet must be greater than 0' };
        }

        if (config.slippage < 0.1 || config.slippage > 50) {
            return { valid: false, error: 'Slippage must be between 0.1% and 50%' };
        }

        if (config.staggerDelay < 0 || config.staggerDelay > 5000) {
            return { valid: false, error: 'Stagger delay must be between 0 and 5000ms' };
        }

        return { valid: true };
    }

    /**
     * Display bundle results in the UI
     */
    displayBundleResults(bundleResult) {
        const resultsContainer = document.getElementById('bundle-results');
        
        const statsHtml = this.createBundleStats(bundleResult);
        const transactionsHtml = this.createTransactionsList(bundleResult.transactions);
        
        resultsContainer.innerHTML = `
            <div class="col-12">
                ${statsHtml}
                <div class="card">
                    <div class="card-header">
                        <h6><i class="fas fa-list me-2"></i>Transaction Details</h6>
                    </div>
                    <div class="card-body">
                        ${transactionsHtml}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Create bundle statistics display
     */
    createBundleStats(bundleResult) {
        const successCount = bundleResult.transactions.filter(tx => tx.status === 'confirmed').length;
        const failedCount = bundleResult.transactions.filter(tx => tx.status === 'failed').length;
        const successRate = ((successCount / bundleResult.transactions.length) * 100).toFixed(1);

        return `
            <div class="bundle-stats mb-4">
                <div class="row">
                    <div class="col-md-3 stat-item">
                        <span class="stat-value">${bundleResult.transactions.length}</span>
                        <span class="stat-label">Total Transactions</span>
                    </div>
                    <div class="col-md-3 stat-item">
                        <span class="stat-value status-success">${successCount}</span>
                        <span class="stat-label">Successful</span>
                    </div>
                    <div class="col-md-3 stat-item">
                        <span class="stat-value status-failed">${failedCount}</span>
                        <span class="stat-label">Failed</span>
                    </div>
                    <div class="col-md-3 stat-item">
                        <span class="stat-value">${successRate}%</span>
                        <span class="stat-label">Success Rate</span>
                    </div>
                </div>
                <div class="mt-3">
                    <div class="progress-custom">
                        <div class="progress-bar-custom" style="width: ${successRate}%"></div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Create transactions list display
     */
    createTransactionsList(transactions) {
        if (!transactions || transactions.length === 0) {
            return '<p class="text-muted text-center">No transactions to display</p>';
        }

        const transactionsHtml = transactions.map((tx, index) => {
            const statusClass = tx.status === 'confirmed' ? 'status-success' : 
                               tx.status === 'failed' ? 'status-failed' : 'status-pending';
            
            const statusIcon = tx.status === 'confirmed' ? 'fa-check-circle' : 
                              tx.status === 'failed' ? 'fa-times-circle' : 'fa-clock';

            return `
                <div class="transaction-item">
                    <div class="row align-items-center">
                        <div class="col-md-2">
                            <small class="text-muted">Wallet ${index + 1}</small>
                            <div class="wallet-address">${this.truncateAddress(tx.wallet)}</div>
                        </div>
                        <div class="col-md-2">
                            <i class="fas ${statusIcon} ${statusClass} me-1"></i>
                            <span class="${statusClass}">${tx.status}</span>
                        </div>
                        <div class="col-md-2">
                            <small class="text-muted">Amount</small>
                            <div>${tx.amount} SOL</div>
                        </div>
                        <div class="col-md-2">
                            <small class="text-muted">Fee</small>
                            <div>${tx.fee || '0'} SOL</div>
                        </div>
                        <div class="col-md-3">
                            ${tx.signature ? `
                                <small class="text-muted">Signature</small>
                                <div>
                                    <a href="https://solscan.io/tx/${tx.signature}" target="_blank" class="signature-link">
                                        ${this.truncateAddress(tx.signature)}
                                        <i class="fas fa-external-link-alt ms-1"></i>
                                    </a>
                                </div>
                            ` : '<span class="text-muted">No signature</span>'}
                        </div>
                        <div class="col-md-1">
                            ${tx.error ? `
                                <button class="btn btn-sm btn-outline-danger" onclick="showTransactionError('${tx.error}')" title="View Error">
                                    <i class="fas fa-exclamation-triangle"></i>
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        return transactionsHtml;
    }

    /**
     * Add bundle to history
     */
    addToHistory(bundleResult) {
        const historyItem = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            type: bundleResult.type,
            tokenAddress: bundleResult.tokenAddress,
            walletsUsed: bundleResult.transactions.length,
            successCount: bundleResult.transactions.filter(tx => tx.status === 'confirmed').length,
            totalCost: bundleResult.totalCost,
            status: bundleResult.status
        };

        this.bundleHistory.unshift(historyItem);
        this.updateHistoryDisplay();
    }

    /**
     * Update transaction history display
     */
    updateHistoryDisplay() {
        const historyBody = document.getElementById('transaction-history');
        
        if (this.bundleHistory.length === 0) {
            historyBody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No transactions yet</td></tr>';
            return;
        }

        const historyHtml = this.bundleHistory.slice(0, 10).map(item => {
            const statusBadge = item.status === 'completed' ? 'bg-success' : 
                               item.status === 'failed' ? 'bg-danger' : 'bg-warning';

            return `
                <tr>
                    <td>${new Date(item.timestamp).toLocaleString()}</td>
                    <td>
                        <span class="badge bg-primary">${item.type}</span>
                    </td>
                    <td>
                        <span class="wallet-address">
                            ${item.tokenAddress ? this.truncateAddress(item.tokenAddress) : 'N/A'}
                        </span>
                    </td>
                    <td>${item.walletsUsed}</td>
                    <td>
                        <span class="badge ${statusBadge}">
                            ${item.successCount}/${item.walletsUsed}
                        </span>
                    </td>
                    <td>${item.totalCost} SOL</td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary" onclick="viewBundleDetails(${item.id})">
                            <i class="fas fa-eye"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        historyBody.innerHTML = historyHtml;
    }

    /**
     * Show loading modal
     */
    showLoadingModal(title, details) {
        const modal = new bootstrap.Modal(document.getElementById('loadingModal'));
        document.getElementById('loading-text').textContent = title;
        document.getElementById('loading-details').textContent = details;
        modal.show();
    }

    /**
     * Update loading modal
     */
    updateLoadingModal(title, details) {
        document.getElementById('loading-text').textContent = title;
        document.getElementById('loading-details').textContent = details;
    }

    /**
     * Hide loading modal
     */
    hideLoadingModal() {
        const modal = bootstrap.Modal.getInstance(document.getElementById('loadingModal'));
        if (modal) {
            modal.hide();
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        const alertHtml = `
            <div class="alert alert-danger alert-dismissible fade show" role="alert">
                <i class="fas fa-exclamation-triangle me-2"></i>
                <strong>Bundle Error:</strong> ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
        
        const resultsContainer = document.getElementById('bundle-results');
        resultsContainer.innerHTML = alertHtml + resultsContainer.innerHTML;
    }

    /**
     * Truncate address for display
     */
    truncateAddress(address) {
        if (!address) return '';
        return `${address.substring(0, 4)}...${address.substring(address.length - 4)}`;
    }

    /**
     * Clear bundle results
     */
    clearResults() {
        const resultsContainer = document.getElementById('bundle-results');
        resultsContainer.innerHTML = `
            <div class="col-12 text-center text-muted">
                <i class="fas fa-info-circle fa-2x mb-3"></i>
                <p>No bundle results yet. Execute a bundle to see transaction details.</p>
            </div>
        `;
    }
}

// Global function for viewing transaction errors
function showTransactionError(error) {
    alert(`Transaction Error: ${error}`);
}

// Global function for viewing bundle details
function viewBundleDetails(bundleId) {
    console.log('Viewing bundle details for ID:', bundleId);
    // Implementation for detailed bundle view
}
