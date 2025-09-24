const { useState } = React;

/**
 * Transaction Input Component
 */
function TransactionInput({ onExecuteBundle, loading, showAlert }) {
    const [tokenAddress, setTokenAddress] = useState('');
    const [amountPerWallet, setAmountPerWallet] = useState(0.1);
    const [bundleType, setBundleType] = useState('buy');
    const [slippage, setSlippage] = useState(5);
    const [staggerDelay, setStaggerDelay] = useState(100);
    const [priorityFee, setPriorityFee] = useState(0.001);
    const [stealthMode, setStealthMode] = useState(true);

    /**
     * Handle form submission
     */
    const handleSubmit = (e) => {
        e.preventDefault();
        
        // Validation
        if (!tokenAddress && bundleType !== 'create-lp') {
            showAlert('Token address is required for this bundle type', 'warning');
            return;
        }

        if (amountPerWallet <= 0) {
            showAlert('Amount per wallet must be greater than 0', 'warning');
            return;
        }

        if (slippage < 0.1 || slippage > 50) {
            showAlert('Slippage must be between 0.1% and 50%', 'warning');
            return;
        }

        const bundleConfig = {
            type: bundleType,
            tokenAddress: tokenAddress.trim(),
            amountPerWallet: parseFloat(amountPerWallet),
            settings: {
                staggerDelay: parseInt(staggerDelay),
                priorityFee: parseFloat(priorityFee),
                slippage: parseFloat(slippage),
                stealthMode: stealthMode
            }
        };

        onExecuteBundle(bundleConfig);
    };

    /**
     * Handle bundle type change
     */
    const handleBundleTypeChange = (e) => {
        const newType = e.target.value;
        setBundleType(newType);
        
        // Clear token address if creating LP
        if (newType === 'create-lp') {
            setTokenAddress('');
        }
    };

    return (
        <div className="card">
            <div className="card-header">
                <h5><i className="fas fa-exchange-alt me-2"></i>Transaction Bundler</h5>
            </div>
            <div className="card-body">
                <form onSubmit={handleSubmit}>
                    <div className="row">
                        <div className="col-md-6">
                            <div className="mb-3">
                                <label className="form-label">Bundle Type</label>
                                <select 
                                    className="form-select" 
                                    value={bundleType}
                                    onChange={handleBundleTypeChange}
                                >
                                    <option value="buy">Multi-Wallet Buy</option>
                                    <option value="sell">Multi-Wallet Sell</option>
                                    <option value="create-lp">Create LP + First Buy</option>
                                    <option value="distribute">Token Distribution</option>
                                </select>
                            </div>
                        </div>
                        <div className="col-md-6">
                            <div className="mb-3">
                                <label className="form-label">Token Address</label>
                                <input 
                                    type="text" 
                                    className="form-control" 
                                    value={tokenAddress}
                                    onChange={(e) => setTokenAddress(e.target.value)}
                                    placeholder={bundleType === 'create-lp' ? 'Token will be created automatically' : 'Enter token mint address'}
                                    disabled={bundleType === 'create-lp'}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="row">
                        <div className="col-md-6">
                            <div className="mb-3">
                                <label className="form-label">Amount per Wallet (SOL)</label>
                                <input 
                                    type="number" 
                                    className="form-control" 
                                    value={amountPerWallet}
                                    onChange={(e) => setAmountPerWallet(e.target.value)}
                                    step="0.01" 
                                    min="0.01"
                                />
                            </div>
                        </div>
                        <div className="col-md-6">
                            <div className="mb-3">
                                <label className="form-label">Slippage Tolerance (%)</label>
                                <input 
                                    type="number" 
                                    className="form-control" 
                                    value={slippage}
                                    onChange={(e) => setSlippage(e.target.value)}
                                    min="0.1" 
                                    max="50" 
                                    step="0.1"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="row">
                        <div className="col-md-6">
                            <div className="mb-3">
                                <label className="form-label">Stagger Delay (ms)</label>
                                <input 
                                    type="number" 
                                    className="form-control" 
                                    value={staggerDelay}
                                    onChange={(e) => setStaggerDelay(e.target.value)}
                                    min="0" 
                                    max="5000"
                                />
                            </div>
                        </div>
                        <div className="col-md-6">
                            <div className="mb-3">
                                <label className="form-label">Priority Fee (SOL)</label>
                                <input 
                                    type="number" 
                                    className="form-control" 
                                    value={priorityFee}
                                    onChange={(e) => setPriorityFee(e.target.value)}
                                    step="0.001" 
                                    min="0"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="row">
                        <div className="col-md-6">
                            <div className="form-check">
                                <input 
                                    className="form-check-input" 
                                    type="checkbox" 
                                    id="stealth-mode"
                                    checked={stealthMode}
                                    onChange={(e) => setStealthMode(e.target.checked)}
                                />
                                <label className="form-check-label" htmlFor="stealth-mode">
                                    Stealth Mode
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="d-grid gap-2 d-md-flex justify-content-md-end mt-4">
                        <button 
                            type="submit" 
                            className="btn btn-success btn-lg"
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <i className="fas fa-spinner fa-spin me-2"></i>
                                    Executing...
                                </>
                            ) : (
                                <>
                                    <i className="fas fa-play me-2"></i>
                                    Execute Bundle
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

window.TransactionInput = TransactionInput;
