const { useState, useEffect } = React;

/**
 * Wallet Manager Component
 */
function WalletManager({ wallets, onWalletUpdate, showAlert }) {
    const [walletCount, setWalletCount] = useState(5);
    const [fundAmount, setFundAmount] = useState(0.1);
    const [generating, setGenerating] = useState(false);
    const [funding, setFunding] = useState(false);

    /**
     * Generate wallets
     */
    const handleGenerateWallets = async () => {
        if (walletCount < 1 || walletCount > 100) {
            showAlert('Please enter a valid number of wallets (1-100)', 'warning');
            return;
        }

        setGenerating(true);
        try {
            const response = await axios.post('/api/wallets/generate', {
                count: walletCount
            });

            if (response.data.success) {
                onWalletUpdate(response.data.wallets);
                showAlert(`Successfully generated ${walletCount} wallets!`, 'success');
            } else {
                showAlert(`Failed to generate wallets: ${response.data.error}`, 'danger');
            }
        } catch (error) {
            console.error('Error generating wallets:', error);
            showAlert(`Error: ${error.response?.data?.error || error.message}`, 'danger');
        } finally {
            setGenerating(false);
        }
    };

    /**
     * Fund wallets
     */
    const handleFundWallets = async () => {
        if (wallets.length === 0) {
            showAlert('No wallets to fund. Generate wallets first.', 'warning');
            return;
        }

        setFunding(true);
        try {
            const response = await axios.post('/api/wallets/fund', {
                wallets: wallets.map(w => w.publicKey),
                amount: fundAmount
            });

            if (response.data.success) {
                onWalletUpdate(response.data.wallets);
                showAlert(`Successfully funded ${response.data.funded} wallets!`, 'success');
            } else {
                showAlert(`Failed to fund wallets: ${response.data.error}`, 'danger');
            }
        } catch (error) {
            console.error('Error funding wallets:', error);
            showAlert(`Error: ${error.response?.data?.error || error.message}`, 'danger');
        } finally {
            setFunding(false);
        }
    };

    /**
     * Refresh wallet balances
     */
    const handleRefreshBalances = async () => {
        if (wallets.length === 0) {
            showAlert('No wallets to refresh', 'warning');
            return;
        }

        try {
            const response = await axios.post('/api/wallets/balances', {
                wallets: wallets.map(w => w.publicKey)
            });

            if (response.data.success) {
                onWalletUpdate(response.data.wallets);
                showAlert('Wallet balances refreshed!', 'info');
            }
        } catch (error) {
            console.error('Error refreshing balances:', error);
            showAlert('Failed to refresh balances', 'danger');
        }
    };

    /**
     * Calculate total balance
     */
    const getTotalBalance = () => {
        return wallets.reduce((total, wallet) => {
            return total + (parseFloat(wallet.balance) || 0);
        }, 0).toFixed(4);
    };

    /**
     * Export wallets
     */
    const handleExportWallets = () => {
        if (wallets.length === 0) {
            showAlert('No wallets to export', 'warning');
            return;
        }

        const exportData = {
            timestamp: new Date().toISOString(),
            wallets: wallets.map(wallet => ({
                publicKey: wallet.publicKey,
                balance: wallet.balance
            }))
        };

        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `proxima-wallets-${Date.now()}.json`;
        link.click();

        showAlert('Wallets exported successfully!', 'success');
    };

    return (
        <div>
            <div className="card">
                <div className="card-header">
                    <h5><i className="fas fa-wallet me-2"></i>Wallet Manager</h5>
                </div>
                <div className="card-body">
                    <div className="mb-3">
                        <label className="form-label">Number of Wallets</label>
                        <input 
                            type="number" 
                            className="form-control" 
                            value={walletCount}
                            onChange={(e) => setWalletCount(parseInt(e.target.value))}
                            min="1" 
                            max="100"
                        />
                    </div>
                    
                    <button 
                        className="btn btn-primary w-100 mb-2" 
                        onClick={handleGenerateWallets}
                        disabled={generating}
                    >
                        {generating ? (
                            <>
                                <i className="fas fa-spinner fa-spin me-2"></i>
                                Generating...
                            </>
                        ) : (
                            <>
                                <i className="fas fa-plus me-2"></i>
                                Generate Wallets
                            </>
                        )}
                    </button>

                    <div className="mb-3">
                        <label className="form-label">Fund Amount (SOL)</label>
                        <input 
                            type="number" 
                            className="form-control" 
                            value={fundAmount}
                            onChange={(e) => setFundAmount(parseFloat(e.target.value))}
                            step="0.01"
                            min="0.01"
                        />
                    </div>

                    <button 
                        className="btn btn-info w-100 mb-2" 
                        onClick={handleFundWallets}
                        disabled={funding || wallets.length === 0}
                    >
                        {funding ? (
                            <>
                                <i className="fas fa-spinner fa-spin me-2"></i>
                                Funding...
                            </>
                        ) : (
                            <>
                                <i className="fas fa-coins me-2"></i>
                                Fund Wallets
                            </>
                        )}
                    </button>

                    <div className="row">
                        <div className="col-6">
                            <button 
                                className="btn btn-outline-secondary w-100 mb-2" 
                                onClick={handleRefreshBalances}
                                disabled={wallets.length === 0}
                            >
                                <i className="fas fa-sync me-1"></i>
                                Refresh
                            </button>
                        </div>
                        <div className="col-6">
                            <button 
                                className="btn btn-outline-primary w-100 mb-2" 
                                onClick={handleExportWallets}
                                disabled={wallets.length === 0}
                            >
                                <i className="fas fa-download me-1"></i>
                                Export
                            </button>
                        </div>
                    </div>

                    <div className="mt-3">
                        <small className="text-muted d-block">Generated Wallets: <strong>{wallets.length}</strong></small>
                        <small className="text-muted d-block">Total Balance: <strong>{getTotalBalance()} SOL</strong></small>
                    </div>
                </div>
            </div>

            {/* Wallet Grid Display */}
            {wallets.length > 0 && (
                <div className="card mt-3">
                    <div className="card-header">
                        <h6><i className="fas fa-list me-2"></i>Wallet Overview</h6>
                    </div>
                    <div className="card-body">
                        <div className="wallet-grid">
                            {wallets.map((wallet, index) => (
                                <div key={wallet.publicKey} className="wallet-card">
                                    <div className="wallet-address">
                                        {`${wallet.publicKey.substring(0, 4)}...${wallet.publicKey.substring(wallet.publicKey.length - 4)}`}
                                    </div>
                                    <div className="balance-display">
                                        <i className="fas fa-coins me-1"></i>
                                        {wallet.balance || '0'} SOL
                                    </div>
                                    <small className="text-muted">Wallet {index + 1}</small>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

window.WalletManager = WalletManager;
