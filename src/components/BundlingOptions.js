/**
 * Bundling Options Component
 */
function BundlingOptions() {
    return (
        <div className="card mt-3">
            <div className="card-header">
                <h5><i className="fas fa-cog me-2"></i>Bundle Information</h5>
            </div>
            <div className="card-body">
                <div className="mb-3">
                    <h6 className="text-primary">Features</h6>
                    <ul className="list-unstyled">
                        <li><i className="fas fa-check text-success me-2"></i>Up to 100 Wallets</li>
                        <li><i className="fas fa-check text-success me-2"></i>Stealth Mode</li>
                        <li><i className="fas fa-check text-success me-2"></i>MEV Protection</li>
                        <li><i className="fas fa-check text-success me-2"></i>Custom Delays</li>
                    </ul>
                </div>

                <div className="mb-3">
                    <h6 className="text-primary">Bundle Types</h6>
                    <div className="accordion accordion-flush" id="bundleTypesAccordion">
                        <div className="accordion-item">
                            <h2 className="accordion-header" id="buyHeading">
                                <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#buyCollapse">
                                    Multi-Wallet Buy
                                </button>
                            </h2>
                            <div id="buyCollapse" className="accordion-collapse collapse" data-bs-parent="#bundleTypesAccordion">
                                <div className="accordion-body">
                                    <small className="text-muted">
                                        Execute simultaneous buy orders across multiple wallets for existing tokens.
                                    </small>
                                </div>
                            </div>
                        </div>

                        <div className="accordion-item">
                            <h2 className="accordion-header" id="sellHeading">
                                <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#sellCollapse">
                                    Multi-Wallet Sell
                                </button>
                            </h2>
                            <div id="sellCollapse" className="accordion-collapse collapse" data-bs-parent="#bundleTypesAccordion">
                                <div className="accordion-body">
                                    <small className="text-muted">
                                        Execute coordinated sell orders across multiple wallets.
                                    </small>
                                </div>
                            </div>
                        </div>

                        <div className="accordion-item">
                            <h2 className="accordion-header" id="lpHeading">
                                <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#lpCollapse">
                                    Create LP + First Buy
                                </button>
                            </h2>
                            <div id="lpCollapse" className="accordion-collapse collapse" data-bs-parent="#bundleTypesAccordion">
                                <div className="accordion-body">
                                    <small className="text-muted">
                                        Create liquidity pool and execute first buy transaction in the same bundle.
                                    </small>
                                </div>
                            </div>
                        </div>

                        <div className="accordion-item">
                            <h2 className="accordion-header" id="distributeHeading">
                                <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#distributeCollapse">
                                    Token Distribution
                                </button>
                            </h2>
                            <div id="distributeCollapse" className="accordion-collapse collapse" data-bs-parent="#bundleTypesAccordion">
                                <div className="accordion-body">
                                    <small className="text-muted">
                                        Distribute tokens to multiple wallets in a single transaction bundle.
                                    </small>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="alert alert-info">
                    <i className="fas fa-info-circle me-2"></i>
                    <small>All transactions are executed with MEV protection and stealth capabilities.</small>
                </div>
            </div>
        </div>
    );
}

window.BundlingOptions = BundlingOptions;
