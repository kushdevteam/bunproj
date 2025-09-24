/**
 * Result Display Component
 */
function ResultDisplay({ bundleResults, onClearResults }) {
    if (!bundleResults) {
        return (
            <div className="card mt-4">
                <div className="card-header d-flex justify-content-between align-items-center">
                    <h5><i className="fas fa-chart-line me-2"></i>Bundle Results</h5>
                    <button className="btn btn-sm btn-outline-secondary" onClick={onClearResults}>
                        <i className="fas fa-trash me-1"></i>Clear
                    </button>
                </div>
                <div className="card-body">
                    <div className="row">
                        <div className="col-12 text-center text-muted">
                            <i className="fas fa-info-circle fa-2x mb-3"></i>
                            <p>No bundle results yet. Execute a bundle to see transaction details.</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const { transactions, successCount, bundleId, type, totalCost, timestamp } = bundleResults;
    const successRate = ((successCount / transactions.length) * 100).toFixed(1);
    const failedCount = transactions.length - successCount;

    return (
        <div className="card mt-4">
            <div className="card-header d-flex justify-content-between align-items-center">
                <h5><i className="fas fa-chart-line me-2"></i>Bundle Results #{bundleId}</h5>
                <button className="btn btn-sm btn-outline-secondary" onClick={onClearResults}>
                    <i className="fas fa-trash me-1"></i>Clear
                </button>
            </div>
            <div className="card-body">
                {/* Bundle Statistics */}
                <div className="bundle-stats mb-4">
                    <div className="row">
                        <div className="col-md-3 stat-item text-center">
                            <span className="stat-value">{transactions.length}</span>
                            <span className="stat-label">Total Transactions</span>
                        </div>
                        <div className="col-md-3 stat-item text-center">
                            <span className="stat-value status-success">{successCount}</span>
                            <span className="stat-label">Successful</span>
                        </div>
                        <div className="col-md-3 stat-item text-center">
                            <span className="stat-value status-failed">{failedCount}</span>
                            <span className="stat-label">Failed</span>
                        </div>
                        <div className="col-md-3 stat-item text-center">
                            <span className="stat-value">{successRate}%</span>
                            <span className="stat-label">Success Rate</span>
                        </div>
                    </div>
                    <div className="mt-3">
                        <div className="progress-custom">
                            <div className="progress-bar-custom" style={{ width: `${successRate}%` }}></div>
                        </div>
                    </div>
                </div>

                {/* Bundle Info */}
                <div className="row mb-3">
                    <div className="col-md-3">
                        <strong>Bundle Type:</strong> <span className="badge bg-primary">{type}</span>
                    </div>
                    <div className="col-md-3">
                        <strong>Total Cost:</strong> {totalCost} SOL
                    </div>
                    <div className="col-md-6">
                        <strong>Timestamp:</strong> {new Date(timestamp).toLocaleString()}
                    </div>
                </div>

                {/* Transaction Details */}
                <div className="card">
                    <div className="card-header">
                        <h6><i className="fas fa-list me-2"></i>Transaction Details</h6>
                    </div>
                    <div className="card-body">
                        {transactions.length === 0 ? (
                            <p className="text-muted text-center">No transactions to display</p>
                        ) : (
                            <div className="table-responsive">
                                <table className="table table-sm">
                                    <thead>
                                        <tr>
                                            <th>Wallet</th>
                                            <th>Status</th>
                                            <th>Amount</th>
                                            <th>Fee</th>
                                            <th>Signature</th>
                                            <th>Error</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {transactions.map((tx, index) => {
                                            const statusClass = tx.status === 'confirmed' ? 'status-success' : 
                                                               tx.status === 'failed' ? 'status-failed' : 'status-pending';
                                            
                                            const statusIcon = tx.status === 'confirmed' ? 'fa-check-circle' : 
                                                              tx.status === 'failed' ? 'fa-times-circle' : 'fa-clock';

                                            return (
                                                <tr key={index}>
                                                    <td>
                                                        <small>#{index + 1}</small><br />
                                                        <code style={{ fontSize: '0.75rem' }}>
                                                            {tx.wallet ? `${tx.wallet.substring(0, 4)}...${tx.wallet.substring(tx.wallet.length - 4)}` : 'N/A'}
                                                        </code>
                                                    </td>
                                                    <td>
                                                        <i className={`fas ${statusIcon} ${statusClass} me-1`}></i>
                                                        <span className={statusClass}>{tx.status}</span>
                                                    </td>
                                                    <td>{tx.amount} SOL</td>
                                                    <td>{tx.fee || '0'} SOL</td>
                                                    <td>
                                                        {tx.signature ? (
                                                            <a 
                                                                href={`https://solscan.io/tx/${tx.signature}`} 
                                                                target="_blank" 
                                                                rel="noopener noreferrer" 
                                                                className="signature-link"
                                                            >
                                                                {`${tx.signature.substring(0, 4)}...${tx.signature.substring(tx.signature.length - 4)}`}
                                                                <i className="fas fa-external-link-alt ms-1"></i>
                                                            </a>
                                                        ) : (
                                                            <span className="text-muted">N/A</span>
                                                        )}
                                                    </td>
                                                    <td>
                                                        {tx.error ? (
                                                            <span className="text-danger" title={tx.error}>
                                                                <i className="fas fa-exclamation-triangle"></i>
                                                            </span>
                                                        ) : (
                                                            <span className="text-muted">-</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

window.ResultDisplay = ResultDisplay;
