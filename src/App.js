const { useState, useEffect, useCallback } = React;

/**
 * Main Application Component - Proxima Solana Bundler
 */
function App() {
    const [wallets, setWallets] = useState([]);
    const [bundleResults, setBundleResults] = useState(null);
    const [transactionHistory, setTransactionHistory] = useState([]);
    const [connectionStatus, setConnectionStatus] = useState('disconnected');
    const [loading, setLoading] = useState(false);
    const [alerts, setAlerts] = useState([]);

    // Check server connection on mount
    useEffect(() => {
        checkConnection();
        loadTransactionHistory();
    }, []);

    /**
     * Check server connection
     */
    const checkConnection = async () => {
        try {
            const response = await axios.get('/api/health');
            if (response.data.status === 'ok') {
                setConnectionStatus('connected');
            }
        } catch (error) {
            setConnectionStatus('disconnected');
            console.error('Connection check failed:', error);
        }
    };

    /**
     * Load transaction history
     */
    const loadTransactionHistory = async () => {
        try {
            const response = await axios.get('/api/history?limit=10');
            if (response.data.success) {
                setTransactionHistory(response.data.history);
            }
        } catch (error) {
            console.error('Failed to load history:', error);
        }
    };

    /**
     * Show alert message
     */
    const showAlert = useCallback((message, type = 'info') => {
        const id = Date.now();
        const alert = { id, message, type };
        
        setAlerts(prev => [...prev, alert]);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            setAlerts(prev => prev.filter(a => a.id !== id));
        }, 5000);
    }, []);

    /**
     * Remove alert
     */
    const removeAlert = (id) => {
        setAlerts(prev => prev.filter(a => a.id !== id));
    };

    /**
     * Handle bundle execution
     */
    const handleBundleExecution = async (bundleConfig) => {
        if (wallets.length === 0) {
            showAlert('No wallets available. Generate wallets first.', 'warning');
            return;
        }

        setLoading(true);
        try {
            const response = await axios.post('/api/bundle/execute', {
                ...bundleConfig,
                wallets: wallets
            });

            if (response.data.success) {
                setBundleResults(response.data.result);
                loadTransactionHistory();
                showAlert('Bundle executed successfully!', 'success');
            } else {
                showAlert(`Bundle execution failed: ${response.data.error}`, 'danger');
            }
        } catch (error) {
            console.error('Bundle execution error:', error);
            showAlert(`Error: ${error.response?.data?.error || error.message}`, 'danger');
        } finally {
            setLoading(false);
        }
    };

    /**
     * Handle wallet updates
     */
    const handleWalletUpdate = (newWallets) => {
        setWallets(newWallets);
    };

    /**
     * Clear bundle results
     */
    const clearResults = () => {
        setBundleResults(null);
    };

    return (
        <div className="app">
            {/* Navigation */}
            <nav className="navbar navbar-dark bg-dark">
                <div className="container-fluid">
                    <span className="navbar-brand mb-0 h1">
                        <i className="fas fa-cube me-2"></i>
                        Proxima Solana Bundler
                    </span>
                    <div className="d-flex">
                        <span className={`badge ${connectionStatus === 'connected' ? 'bg-success' : 'bg-danger'}`}>
                            {connectionStatus === 'connected' ? 'Connected' : 'Disconnected'}
                        </span>
                    </div>
                </div>
            </nav>

            {/* Alerts */}
            <div className="alert-container position-fixed top-0 start-50 translate-middle-x mt-5" style={{ zIndex: 9999 }}>
                {alerts.map(alert => (
                    <div key={alert.id} className={`alert alert-${alert.type} alert-dismissible fade show mb-2`}>
                        {alert.message}
                        <button 
                            type="button" 
                            className="btn-close" 
                            onClick={() => removeAlert(alert.id)}
                        ></button>
                    </div>
                ))}
            </div>

            <div className="container-fluid mt-4">
                <div className="row">
                    {/* Sidebar */}
                    <div className="col-md-3">
                        <WalletManager 
                            wallets={wallets}
                            onWalletUpdate={handleWalletUpdate}
                            showAlert={showAlert}
                        />
                        <BundlingOptions />
                    </div>

                    {/* Main Content */}
                    <div className="col-md-9">
                        <TransactionInput 
                            onExecuteBundle={handleBundleExecution}
                            loading={loading}
                            showAlert={showAlert}
                        />
                        
                        <ResultDisplay 
                            bundleResults={bundleResults}
                            onClearResults={clearResults}
                        />

                        {/* Transaction History */}
                        <div className="card mt-4">
                            <div className="card-header">
                                <h5><i className="fas fa-history me-2"></i>Transaction History</h5>
                            </div>
                            <div className="card-body">
                                <div className="table-responsive">
                                    <table className="table table-striped">
                                        <thead>
                                            <tr>
                                                <th>Timestamp</th>
                                                <th>Type</th>
                                                <th>Token</th>
                                                <th>Wallets</th>
                                                <th>Status</th>
                                                <th>Total Cost</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {transactionHistory.length === 0 ? (
                                                <tr>
                                                    <td colSpan="6" className="text-center text-muted">
                                                        No transactions yet
                                                    </td>
                                                </tr>
                                            ) : (
                                                transactionHistory.map((item, index) => (
                                                    <tr key={index}>
                                                        <td>{new Date(item.timestamp).toLocaleString()}</td>
                                                        <td>
                                                            <span className="badge bg-primary">{item.type}</span>
                                                        </td>
                                                        <td>
                                                            <span className="wallet-address">
                                                                {item.tokenAddress ? 
                                                                    `${item.tokenAddress.substring(0, 4)}...${item.tokenAddress.substring(item.tokenAddress.length - 4)}` 
                                                                    : 'N/A'
                                                                }
                                                            </span>
                                                        </td>
                                                        <td>{item.walletsUsed}</td>
                                                        <td>
                                                            <span className={`badge ${item.status === 'completed' ? 'bg-success' : item.status === 'failed' ? 'bg-danger' : 'bg-warning'}`}>
                                                                {item.successCount}/{item.walletsUsed}
                                                            </span>
                                                        </td>
                                                        <td>{item.totalCost} SOL</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Loading Modal */}
            {loading && (
                <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content">
                            <div className="modal-body text-center">
                                <div className="spinner-border text-primary mb-3" role="status">
                                    <span className="visually-hidden">Loading...</span>
                                </div>
                                <h5>Processing Bundle...</h5>
                                <p className="text-muted">Please wait while we execute your transactions</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Render the app
ReactDOM.render(<App />, document.getElementById('root'));
