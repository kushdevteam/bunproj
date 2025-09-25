/**
 * Bundle Preview Component
 * Displays configuration summary, validation results, cost estimation, and risk assessment
 */

import React, { useState, useEffect } from 'react';
import { useWalletStore } from '../../store/wallets';
import type { 
  EnhancedBundleConfig,
  ConfigurationSummary
} from '../../types/bundle-config';

interface BundlePreviewProps {
  config: Partial<EnhancedBundleConfig>;
  onUpdate: (updates: Partial<EnhancedBundleConfig>) => void;
  validationErrors: string[];
  isValid: boolean;
}

export const BundlePreview: React.FC<BundlePreviewProps> = ({
  config,
  onUpdate,
  validationErrors,
  isValid
}) => {
  const { wallets } = useWalletStore();
  
  const [configSummary, setConfigSummary] = useState<ConfigurationSummary | null>(null);
  const [estimatedCosts, setEstimatedCosts] = useState({
    totalGasCost: 0,
    totalInvestment: 0,
    estimatedTokens: 0,
    networkFees: 0,
  });
  const [riskLevel, setRiskLevel] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');

  // Calculate configuration summary
  useEffect(() => {
    const calculateSummary = () => {
      const activeWallets = wallets.filter(w => w.isActive);
      const totalBnbRequired = config.purchaseAmount?.totalBnb || 0;
      
      // Gas cost estimation
      const baseGasPrice = parseInt(config.transactionSettings?.gasConfiguration?.baseGasPrice || '5000000000');
      const priorityFee = parseInt(config.transactionSettings?.gasConfiguration?.priorityFee || '2000000000');
      const gasLimit = parseInt(config.transactionSettings?.gasConfiguration?.gasLimit || '100000');
      const gasMultiplier = config.transactionSettings?.gasConfiguration?.gasMultiplier || 1.1;
      
      const totalGasPrice = (baseGasPrice + priorityFee) * gasMultiplier;
      const gasCostPerTx = (gasLimit * totalGasPrice) / 1e18;
      const totalGasCost = gasCostPerTx * activeWallets.length;
      
      // Execution time estimation
      const staggerEnabled = config.executionParams?.staggerSettings?.enabled;
      const avgDelay = staggerEnabled 
        ? ((config.executionParams?.staggerSettings?.delayMin || 2000) + 
           (config.executionParams?.staggerSettings?.delayMax || 8000)) / 2 
        : 0;
      const batchSize = config.executionParams?.batchConfiguration?.batchSize || 5;
      const pauseBetweenBatches = config.executionParams?.batchConfiguration?.pauseBetweenBatches || 2;
      
      const batchCount = Math.ceil(activeWallets.length / batchSize);
      const executionTime = (avgDelay * activeWallets.length / 1000) + (pauseBetweenBatches * batchCount);

      // Risk assessment
      const riskFactors = [];
      if (!staggerEnabled) riskFactors.push('Immediate execution');
      if (totalBnbRequired > 5) riskFactors.push('High investment amount');
      if (!config.transactionSettings?.mevProtection?.enabled) riskFactors.push('No MEV protection');
      if ((config.transactionSettings?.slippageSettings?.tolerance || 0) > 5) riskFactors.push('High slippage tolerance');
      if (!config.executionParams?.safetyFeatures?.emergencyStopEnabled) riskFactors.push('No emergency stop');

      let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
      if (riskFactors.length >= 4) riskLevel = 'critical';
      else if (riskFactors.length >= 3) riskLevel = 'high';
      else if (riskFactors.length >= 2) riskLevel = 'medium';

      const summary: ConfigurationSummary = {
        totalWallets: activeWallets.length,
        totalBnbRequired,
        estimatedGasCost: totalGasCost,
        estimatedDuration: Math.round(executionTime),
        riskAssessment: {
          level: riskLevel,
          factors: riskFactors,
        },
        validationStatus: {
          isValid,
          errors: validationErrors.map(error => ({ 
            field: 'general', 
            message: error, 
            severity: 'error' as const 
          })),
          warnings: [],
          riskLevel,
        },
      };

      setConfigSummary(summary);
      setEstimatedCosts({
        totalGasCost,
        totalInvestment: totalBnbRequired,
        estimatedTokens: 0, // Would need token price data
        networkFees: totalGasCost,
      });
      setRiskLevel(riskLevel);
    };

    calculateSummary();
  }, [config, wallets, validationErrors, isValid]);

  // Validation categories
  const getValidationsByCategory = () => {
    const categories = {
      token: validationErrors.filter(error => 
        error.includes('token') || error.includes('address') || error.includes('contract')
      ),
      amounts: validationErrors.filter(error => 
        error.includes('amount') || error.includes('BNB') || error.includes('allocation')
      ),
      transaction: validationErrors.filter(error => 
        error.includes('gas') || error.includes('slippage') || error.includes('network')
      ),
      execution: validationErrors.filter(error => 
        error.includes('execution') || error.includes('stagger') || error.includes('batch')
      ),
      safety: validationErrors.filter(error => 
        error.includes('safety') || error.includes('limit') || error.includes('timeout')
      ),
    };

    return categories;
  };

  const validationCategories = getValidationsByCategory();

  // Risk level styling
  const getRiskLevelStyle = (level: string) => {
    switch (level) {
      case 'low': return 'success';
      case 'medium': return 'warning';
      case 'high': return 'error';
      case 'critical': return 'error';
      default: return 'info';
    }
  };

  if (!configSummary) {
    return (
      <div className="bundle-preview loading">
        <div className="loading-spinner"></div>
        <span>Calculating configuration summary...</span>
      </div>
    );
  }

  return (
    <div className="bundle-preview">
      {/* Configuration Overview */}
      <div className="config-section">
        <div className="config-section-header">
          <h3 className="config-section-title">
            <i className="fas fa-eye"></i>
            Configuration Overview
          </h3>
          <div className={`overall-status ${isValid ? 'success' : 'error'}`}>
            <i className={`fas ${isValid ? 'fa-check-circle' : 'fa-exclamation-circle'}`}></i>
            <span>{isValid ? 'Ready for Execution' : 'Configuration Issues'}</span>
          </div>
        </div>

        <div className="overview-grid">
          <div className="overview-card">
            <div className="card-header">
              <h4>Token Information</h4>
              <i className="fas fa-coins"></i>
            </div>
            <div className="card-content">
              {config.token ? (
                <>
                  <div className="info-row">
                    <span>Token:</span>
                    <span className="token-name">{config.token.name} ({config.token.symbol})</span>
                  </div>
                  <div className="info-row">
                    <span>Address:</span>
                    <span className="address">{config.token.address}</span>
                  </div>
                  <div className="info-row">
                    <span>Verified:</span>
                    <span className={`status ${config.token.contractValidated ? 'success' : 'warning'}`}>
                      {config.token.contractValidated ? 'Yes' : 'No'}
                    </span>
                  </div>
                </>
              ) : (
                <div className="no-config">
                  <i className="fas fa-info-circle"></i>
                  <span>No token selected</span>
                </div>
              )}
            </div>
          </div>

          <div className="overview-card">
            <div className="card-header">
              <h4>Investment Details</h4>
              <i className="fas fa-chart-line"></i>
            </div>
            <div className="card-content">
              <div className="info-row">
                <span>Total Investment:</span>
                <span className="investment-amount">{estimatedCosts.totalInvestment} BNB</span>
              </div>
              <div className="info-row">
                <span>Active Wallets:</span>
                <span className="wallet-count">{configSummary.totalWallets}</span>
              </div>
              <div className="info-row">
                <span>Avg per Wallet:</span>
                <span className="per-wallet">
                  {configSummary.totalWallets > 0 
                    ? (estimatedCosts.totalInvestment / configSummary.totalWallets).toFixed(3)
                    : '0'} BNB
                </span>
              </div>
            </div>
          </div>

          <div className="overview-card">
            <div className="card-header">
              <h4>Execution Plan</h4>
              <i className="fas fa-play-circle"></i>
            </div>
            <div className="card-content">
              <div className="info-row">
                <span>Strategy:</span>
                <span className="strategy">
                  {config.executionParams?.staggerSettings?.enabled ? 'Staggered' : 'Immediate'}
                  {config.executionParams?.stealthMode?.enabled && ' + Stealth'}
                </span>
              </div>
              <div className="info-row">
                <span>Duration:</span>
                <span className="duration">
                  ~{Math.floor(configSummary.estimatedDuration / 60)}m {configSummary.estimatedDuration % 60}s
                </span>
              </div>
              <div className="info-row">
                <span>Batch Size:</span>
                <span className="batch-size">
                  {config.executionParams?.batchConfiguration?.batchSize || 'N/A'}
                </span>
              </div>
            </div>
          </div>

          <div className="overview-card">
            <div className="card-header">
              <h4>Cost Estimation</h4>
              <i className="fas fa-calculator"></i>
            </div>
            <div className="card-content">
              <div className="info-row">
                <span>Gas Fees:</span>
                <span className="gas-cost">{estimatedCosts.totalGasCost.toFixed(6)} BNB</span>
              </div>
              <div className="info-row">
                <span>Network Fees:</span>
                <span className="network-fees">{estimatedCosts.networkFees.toFixed(6)} BNB</span>
              </div>
              <div className="info-row total">
                <span>Total Cost:</span>
                <span className="total-cost">
                  {(estimatedCosts.totalInvestment + estimatedCosts.totalGasCost).toFixed(6)} BNB
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Risk Assessment */}
      <div className="config-section">
        <div className="config-section-header">
          <h3 className="config-section-title">
            <i className="fas fa-shield-alt"></i>
            Risk Assessment
          </h3>
          <div className={`risk-level ${getRiskLevelStyle(riskLevel)}`}>
            <i className="fas fa-exclamation-triangle"></i>
            <span>{riskLevel.toUpperCase()} RISK</span>
          </div>
        </div>

        <div className="risk-analysis">
          <div className="risk-summary">
            <div className="risk-indicator">
              <div className={`risk-circle ${riskLevel}`}>
                <span className="risk-score">
                  {configSummary.riskAssessment.factors.length}
                </span>
              </div>
              <div className="risk-description">
                <h4>Risk Level: {riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1)}</h4>
                <p>{configSummary.riskAssessment.factors.length} risk factor(s) identified</p>
              </div>
            </div>
          </div>

          {configSummary.riskAssessment.factors.length > 0 && (
            <div className="risk-factors">
              <h4>Risk Factors</h4>
              <div className="risk-list">
                {configSummary.riskAssessment.factors.map((factor, index) => (
                  <div key={index} className="risk-item">
                    <i className="fas fa-exclamation-triangle"></i>
                    <span>{factor}</span>
                    <div className="risk-impact">
                      {factor.includes('High') ? 'High Impact' : 
                       factor.includes('No') ? 'Medium Impact' : 'Low Impact'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="risk-recommendations">
            <h4>Recommendations</h4>
            <div className="recommendation-list">
              {riskLevel === 'critical' && (
                <div className="recommendation critical">
                  <i className="fas fa-exclamation-circle"></i>
                  <span>Critical risk detected. Review configuration before proceeding.</span>
                </div>
              )}
              {riskLevel === 'high' && (
                <div className="recommendation high">
                  <i className="fas fa-exclamation-triangle"></i>
                  <span>High risk configuration. Consider reducing investment amount or enabling safety features.</span>
                </div>
              )}
              {!config.transactionSettings?.mevProtection?.enabled && (
                <div className="recommendation">
                  <i className="fas fa-shield-alt"></i>
                  <span>Enable MEV protection for safer execution</span>
                </div>
              )}
              {!config.executionParams?.staggerSettings?.enabled && (
                <div className="recommendation">
                  <i className="fas fa-clock"></i>
                  <span>Consider enabling staggered execution to reduce MEV risk</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Validation Results */}
      {!isValid && (
        <div className="config-section">
          <div className="config-section-header">
            <h3 className="config-section-title">
              <i className="fas fa-exclamation-triangle"></i>
              Validation Issues
            </h3>
            <div className="error-count">
              <span>{validationErrors.length} issue(s) found</span>
            </div>
          </div>

          <div className="validation-results">
            {Object.entries(validationCategories).map(([category, errors]) => 
              errors.length > 0 && (
                <div key={category} className="validation-category">
                  <h4 className="category-title">
                    {category.charAt(0).toUpperCase() + category.slice(1)} Issues
                  </h4>
                  <div className="error-list">
                    {errors.map((error, index) => (
                      <div key={index} className="error-item">
                        <i className="fas fa-times-circle"></i>
                        <span>{error}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* Configuration Details */}
      <div className="config-section">
        <div className="config-section-header">
          <h3 className="config-section-title">
            <i className="fas fa-list-alt"></i>
            Detailed Configuration
          </h3>
        </div>

        <div className="collapsible-sections">
          {/* Token Configuration Details */}
          <div className="collapsible-section">
            <div className="collapsible-header">
              <span>Token & Allocation Settings</span>
              <i className="fas fa-chevron-down"></i>
            </div>
            <div className="collapsible-content">
              <div className="config-details-grid">
                <div className="detail-item">
                  <span>Token Address:</span>
                  <span className="code">{config.token?.address || 'Not set'}</span>
                </div>
                <div className="detail-item">
                  <span>Total BNB:</span>
                  <span>{config.purchaseAmount?.totalBnb || 0} BNB</span>
                </div>
                <div className="detail-item">
                  <span>Buy Strategy:</span>
                  <span>{config.strategy?.buyStrategy || 'Not set'}</span>
                </div>
                <div className="detail-item">
                  <span>Sell Strategy:</span>
                  <span>{config.strategy?.sellStrategy || 'Not set'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Transaction Settings Details */}
          <div className="collapsible-section">
            <div className="collapsible-header">
              <span>Transaction Settings</span>
              <i className="fas fa-chevron-down"></i>
            </div>
            <div className="collapsible-content">
              <div className="config-details-grid">
                <div className="detail-item">
                  <span>Gas Price:</span>
                  <span>
                    {config.transactionSettings?.gasConfiguration?.baseGasPrice 
                      ? `${parseInt(config.transactionSettings.gasConfiguration.baseGasPrice) / 1e9} Gwei`
                      : 'Not set'}
                  </span>
                </div>
                <div className="detail-item">
                  <span>Slippage:</span>
                  <span>{config.transactionSettings?.slippageSettings?.tolerance || 0}%</span>
                </div>
                <div className="detail-item">
                  <span>MEV Protection:</span>
                  <span className={config.transactionSettings?.mevProtection?.enabled ? 'success' : 'warning'}>
                    {config.transactionSettings?.mevProtection?.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <div className="detail-item">
                  <span>Network:</span>
                  <span>
                    BSC {config.transactionSettings?.networkSettings?.chainId === 56 ? 'Mainnet' : 'Testnet'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Execution Parameters Details */}
          <div className="collapsible-section">
            <div className="collapsible-header">
              <span>Execution Parameters</span>
              <i className="fas fa-chevron-down"></i>
            </div>
            <div className="collapsible-content">
              <div className="config-details-grid">
                <div className="detail-item">
                  <span>Stagger Enabled:</span>
                  <span className={config.executionParams?.staggerSettings?.enabled ? 'success' : 'warning'}>
                    {config.executionParams?.staggerSettings?.enabled ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="detail-item">
                  <span>Stealth Mode:</span>
                  <span className={config.executionParams?.stealthMode?.enabled ? 'success' : 'info'}>
                    {config.executionParams?.stealthMode?.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <div className="detail-item">
                  <span>Batch Size:</span>
                  <span>{config.executionParams?.batchConfiguration?.batchSize || 'Not set'}</span>
                </div>
                <div className="detail-item">
                  <span>Emergency Stop:</span>
                  <span className={config.executionParams?.safetyFeatures?.emergencyStopEnabled ? 'success' : 'warning'}>
                    {config.executionParams?.safetyFeatures?.emergencyStopEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="config-section">
        <div className="preview-actions">
          <button 
            className={`config-button ${isValid ? 'success' : 'secondary'}`}
            disabled={!isValid}
          >
            <i className="fas fa-play"></i>
            {isValid ? 'Execute Bundle' : 'Fix Issues First'}
          </button>
          
          <button className="config-button secondary">
            <i className="fas fa-save"></i>
            Save Configuration
          </button>
          
          <button className="config-button secondary">
            <i className="fas fa-download"></i>
            Export Configuration
          </button>

          <button className="config-button secondary">
            <i className="fas fa-copy"></i>
            Copy Configuration
          </button>
        </div>
      </div>
    </div>
  );
};