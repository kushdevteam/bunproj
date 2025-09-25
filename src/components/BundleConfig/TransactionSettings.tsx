/**
 * Transaction Settings Component
 * Handles gas configuration, slippage settings, MEV protection, and network configuration
 */

import React, { useState, useEffect } from 'react';
import type { 
  EnhancedBundleConfig, 
  TransactionSettings as TransactionSettingsType
} from '../../types/bundle-config';

interface TransactionSettingsProps {
  config: Partial<EnhancedBundleConfig>;
  onUpdate: (updates: Partial<EnhancedBundleConfig>) => void;
  validationErrors: string[];
  isValid: boolean;
}

export const TransactionSettings: React.FC<TransactionSettingsProps> = ({
  config,
  onUpdate,
  validationErrors,
  isValid
}) => {
  // Local state for transaction settings
  const [gasSettings, setGasSettings] = useState({
    baseGasPrice: config.transactionSettings?.gasConfiguration?.baseGasPrice || '5000000000',
    priorityFee: config.transactionSettings?.gasConfiguration?.priorityFee || '2000000000',
    gasLimit: config.transactionSettings?.gasConfiguration?.gasLimit || '100000',
    gasMultiplier: config.transactionSettings?.gasConfiguration?.gasMultiplier || 1.1,
  });

  const [slippageSettings, setSlippageSettings] = useState({
    tolerance: config.transactionSettings?.slippageSettings?.tolerance || 2,
    autoAdjust: config.transactionSettings?.slippageSettings?.autoAdjust || true,
    maxSlippage: config.transactionSettings?.slippageSettings?.maxSlippage || 5,
  });

  const [mevProtection, setMevProtection] = useState({
    enabled: config.transactionSettings?.mevProtection?.enabled || true,
    frontrunningProtection: config.transactionSettings?.mevProtection?.frontrunningProtection || true,
    sandwichProtection: config.transactionSettings?.mevProtection?.sandwichProtection || true,
    usePrivateMempool: config.transactionSettings?.mevProtection?.usePrivateMempool || false,
  });

  const [networkSettings, setNetworkSettings] = useState({
    rpcEndpoint: config.transactionSettings?.networkSettings?.rpcEndpoint || 'https://bsc-dataseed1.binance.org/',
    chainId: config.transactionSettings?.networkSettings?.chainId || 56,
    fallbackRpc: config.transactionSettings?.networkSettings?.fallbackRpc || ['https://bsc-dataseed2.binance.org/'],
  });

  const [estimatedGasCost, setEstimatedGasCost] = useState(0);
  const [networkStatus, setNetworkStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');

  // Update parent config when local state changes
  useEffect(() => {
    const transactionSettings: TransactionSettingsType = {
      gasConfiguration: gasSettings,
      slippageSettings,
      mevProtection,
      networkSettings,
    };

    onUpdate({ transactionSettings });
  }, [gasSettings, slippageSettings, mevProtection, networkSettings, onUpdate]);

  // Estimate gas costs
  useEffect(() => {
    const estimateGas = () => {
      const baseGas = parseInt(gasSettings.gasLimit);
      const gasPrice = parseInt(gasSettings.baseGasPrice);
      const priorityFee = parseInt(gasSettings.priorityFee);
      const multiplier = gasSettings.gasMultiplier;
      
      const totalGasPrice = (gasPrice + priorityFee) * multiplier;
      const gasCostWei = baseGas * totalGasPrice;
      const gasCostBnb = gasCostWei / 1e18;
      
      setEstimatedGasCost(gasCostBnb);
    };

    estimateGas();
  }, [gasSettings]);

  // Test network connection
  const testNetworkConnection = async () => {
    setNetworkStatus('checking');
    try {
      const response = await fetch(networkSettings.rpcEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_blockNumber',
          params: [],
          id: 1,
        }),
      });
      
      if (response.ok) {
        setNetworkStatus('connected');
      } else {
        setNetworkStatus('disconnected');
      }
    } catch (error) {
      setNetworkStatus('disconnected');
    }
  };

  useEffect(() => {
    testNetworkConnection();
  }, [networkSettings.rpcEndpoint, testNetworkConnection]);

  // Handle gas setting updates
  const updateGasSettings = (field: keyof typeof gasSettings, value: string | number) => {
    setGasSettings(prev => ({ ...prev, [field]: value }));
  };

  // Handle slippage updates
  const updateSlippageSettings = (field: keyof typeof slippageSettings, value: number | boolean) => {
    setSlippageSettings(prev => ({ ...prev, [field]: value }));
  };

  // Handle MEV protection updates
  const updateMevProtection = (field: keyof typeof mevProtection, value: boolean) => {
    setMevProtection(prev => ({ ...prev, [field]: value }));
  };

  // Preset gas configurations
  const gasPresets = [
    { name: 'Slow', baseGasPrice: '3000000000', priorityFee: '1000000000', multiplier: 1.0 },
    { name: 'Standard', baseGasPrice: '5000000000', priorityFee: '2000000000', multiplier: 1.1 },
    { name: 'Fast', baseGasPrice: '8000000000', priorityFee: '5000000000', multiplier: 1.2 },
    { name: 'Instant', baseGasPrice: '12000000000', priorityFee: '8000000000', multiplier: 1.5 },
  ];

  const applyGasPreset = (preset: typeof gasPresets[0]) => {
    setGasSettings(prev => ({
      ...prev,
      baseGasPrice: preset.baseGasPrice,
      priorityFee: preset.priorityFee,
      gasMultiplier: preset.multiplier,
    }));
  };

  return (
    <div className="transaction-settings">
      {/* Gas Configuration Section */}
      <div className="config-section">
        <div className="config-section-header">
          <h3 className="config-section-title">
            <i className="fas fa-fire"></i>
            Gas Configuration
          </h3>
          <div className="gas-cost-display">
            <span className="gas-cost-label">Est. Gas Cost:</span>
            <span className="gas-cost-value">{estimatedGasCost.toFixed(6)} BNB</span>
          </div>
        </div>
        <p className="config-section-description">
          Configure gas prices and transaction fees for optimal execution speed
        </p>

        {/* Gas Presets */}
        <div className="gas-presets">
          <label className="config-label">Quick Presets</label>
          <div className="preset-buttons">
            {gasPresets.map(preset => (
              <button
                key={preset.name}
                className="config-button secondary"
                onClick={() => applyGasPreset(preset)}
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>

        <div className="config-form-grid">
          <div className="config-input-group">
            <label className="config-label">Base Gas Price</label>
            <div className="input-with-unit">
              <input
                type="number"
                className="config-input"
                value={parseInt(gasSettings.baseGasPrice) / 1e9}
                onChange={(e) => updateGasSettings('baseGasPrice', (Number(e.target.value) * 1e9).toString())}
                min="1"
                step="0.1"
              />
              <span className="input-unit">Gwei</span>
            </div>
            <div className="field-help">
              Current network average: ~5 Gwei
            </div>
          </div>

          <div className="config-input-group">
            <label className="config-label">Priority Fee</label>
            <div className="input-with-unit">
              <input
                type="number"
                className="config-input"
                value={parseInt(gasSettings.priorityFee) / 1e9}
                onChange={(e) => updateGasSettings('priorityFee', (Number(e.target.value) * 1e9).toString())}
                min="0.1"
                step="0.1"
              />
              <span className="input-unit">Gwei</span>
            </div>
            <div className="field-help">
              Tip to miners for faster inclusion
            </div>
          </div>

          <div className="config-input-group">
            <label className="config-label">Gas Limit</label>
            <input
              type="number"
              className="config-input"
              value={gasSettings.gasLimit}
              onChange={(e) => updateGasSettings('gasLimit', e.target.value)}
              min="21000"
              step="1000"
            />
            <div className="field-help">
              Standard DEX swap: ~100,000 gas
            </div>
          </div>

          <div className="config-input-group">
            <label className="config-label">Gas Multiplier</label>
            <div className="input-with-unit">
              <input
                type="number"
                className="config-input"
                value={gasSettings.gasMultiplier}
                onChange={(e) => updateGasSettings('gasMultiplier', Number(e.target.value))}
                min="1"
                max="3"
                step="0.1"
              />
              <span className="input-unit">x</span>
            </div>
            <div className="field-help">
              Safety multiplier for gas calculations
            </div>
          </div>
        </div>
      </div>

      {/* Slippage Configuration */}
      <div className="config-section">
        <div className="config-section-header">
          <h3 className="config-section-title">
            <i className="fas fa-chart-line"></i>
            Slippage Protection
          </h3>
        </div>
        <p className="config-section-description">
          Configure price slippage tolerance and automatic adjustments
        </p>

        <div className="config-form-grid">
          <div className="config-input-group">
            <label className="config-label">Slippage Tolerance</label>
            <div className="range-input-group">
              <input
                type="range"
                className="config-range"
                min="0.1"
                max="50"
                step="0.1"
                value={slippageSettings.tolerance}
                onChange={(e) => updateSlippageSettings('tolerance', Number(e.target.value))}
              />
              <div className="range-labels">
                <span>0.1%</span>
                <span className="range-value">{slippageSettings.tolerance}%</span>
                <span>50%</span>
              </div>
            </div>
            <div className={`field-help ${slippageSettings.tolerance > 5 ? 'warning' : ''}`}>
              {slippageSettings.tolerance > 5 ? 'High slippage - risk of MEV attacks' : 'Safe slippage range'}
            </div>
          </div>

          <div className="config-input-group">
            <label className="config-label">Maximum Slippage</label>
            <div className="input-with-unit">
              <input
                type="number"
                className="config-input"
                value={slippageSettings.maxSlippage}
                onChange={(e) => updateSlippageSettings('maxSlippage', Number(e.target.value))}
                min="0.1"
                max="100"
                step="0.1"
              />
              <span className="input-unit">%</span>
            </div>
            <div className="field-help">
              Transaction will revert if slippage exceeds this
            </div>
          </div>
        </div>

        <div className="config-checkbox-group">
          <div className="config-checkbox">
            <input
              type="checkbox"
              id="auto-adjust-slippage"
              checked={slippageSettings.autoAdjust}
              onChange={(e) => updateSlippageSettings('autoAdjust', e.target.checked)}
            />
            <div className="checkbox-mark"></div>
          </div>
          <label htmlFor="auto-adjust-slippage" className="config-checkbox-label">
            Auto-adjust slippage based on market conditions
          </label>
        </div>
      </div>

      {/* MEV Protection */}
      <div className="config-section">
        <div className="config-section-header">
          <h3 className="config-section-title">
            <i className="fas fa-shield-alt"></i>
            MEV Protection
          </h3>
        </div>
        <p className="config-section-description">
          Configure protection against front-running and sandwich attacks
        </p>

        <div className="protection-options">
          <div className="config-checkbox-group">
            <div className="config-checkbox">
              <input
                type="checkbox"
                id="enable-mev-protection"
                checked={mevProtection.enabled}
                onChange={(e) => updateMevProtection('enabled', e.target.checked)}
              />
              <div className="checkbox-mark"></div>
            </div>
            <label htmlFor="enable-mev-protection" className="config-checkbox-label">
              <strong>Enable MEV Protection</strong>
              <span className="option-description">Basic protection against MEV attacks</span>
            </label>
          </div>

          <div className="config-checkbox-group">
            <div className="config-checkbox">
              <input
                type="checkbox"
                id="frontrunning-protection"
                checked={mevProtection.frontrunningProtection}
                onChange={(e) => updateMevProtection('frontrunningProtection', e.target.checked)}
                disabled={!mevProtection.enabled}
              />
              <div className="checkbox-mark"></div>
            </div>
            <label htmlFor="frontrunning-protection" className="config-checkbox-label">
              <strong>Front-running Protection</strong>
              <span className="option-description">Prevent transactions from being front-run</span>
            </label>
          </div>

          <div className="config-checkbox-group">
            <div className="config-checkbox">
              <input
                type="checkbox"
                id="sandwich-protection"
                checked={mevProtection.sandwichProtection}
                onChange={(e) => updateMevProtection('sandwichProtection', e.target.checked)}
                disabled={!mevProtection.enabled}
              />
              <div className="checkbox-mark"></div>
            </div>
            <label htmlFor="sandwich-protection" className="config-checkbox-label">
              <strong>Sandwich Attack Protection</strong>
              <span className="option-description">Prevent sandwich attacks on transactions</span>
            </label>
          </div>

          <div className="config-checkbox-group">
            <div className="config-checkbox">
              <input
                type="checkbox"
                id="private-mempool"
                checked={mevProtection.usePrivateMempool}
                onChange={(e) => updateMevProtection('usePrivateMempool', e.target.checked)}
                disabled={!mevProtection.enabled}
              />
              <div className="checkbox-mark"></div>
            </div>
            <label htmlFor="private-mempool" className="config-checkbox-label">
              <strong>Private Mempool</strong>
              <span className="option-description">Route transactions through private mempool</span>
            </label>
          </div>
        </div>

        {mevProtection.enabled && (
          <div className="mev-protection-status">
            <div className="status-indicator success">
              <i className="fas fa-shield-check"></i>
              <span>MEV Protection Active</span>
            </div>
          </div>
        )}
      </div>

      {/* Network Settings */}
      <div className="config-section">
        <div className="config-section-header">
          <h3 className="config-section-title">
            <i className="fas fa-network-wired"></i>
            Network Configuration
          </h3>
          <div className={`network-status ${networkStatus}`}>
            <i className={`fas ${networkStatus === 'connected' ? 'fa-circle' : networkStatus === 'checking' ? 'fa-spinner fa-spin' : 'fa-times-circle'}`}></i>
            <span>{networkStatus === 'connected' ? 'Connected' : networkStatus === 'checking' ? 'Checking...' : 'Disconnected'}</span>
          </div>
        </div>
        <p className="config-section-description">
          Configure RPC endpoints and network settings for reliable connectivity
        </p>

        <div className="config-form-grid">
          <div className="config-input-group">
            <label className="config-label">Primary RPC Endpoint</label>
            <input
              type="url"
              className={`config-input ${networkStatus === 'connected' ? 'success' : networkStatus === 'disconnected' ? 'error' : ''}`}
              value={networkSettings.rpcEndpoint}
              onChange={(e) => setNetworkSettings(prev => ({ ...prev, rpcEndpoint: e.target.value }))}
              placeholder="https://bsc-dataseed1.binance.org/"
            />
            <div className="endpoint-actions">
              <button 
                className="config-button secondary"
                onClick={testNetworkConnection}
              >
                Test Connection
              </button>
            </div>
          </div>

          <div className="config-input-group">
            <label className="config-label">Chain ID</label>
            <select 
              className="config-select"
              value={networkSettings.chainId}
              onChange={(e) => setNetworkSettings(prev => ({ ...prev, chainId: Number(e.target.value) }))}
            >
              <option value={56}>BSC Mainnet (56)</option>
              <option value={97}>BSC Testnet (97)</option>
              <option value={1}>Ethereum Mainnet (1)</option>
            </select>
          </div>
        </div>

        <div className="config-input-group">
          <label className="config-label">Fallback RPC Endpoints</label>
          <div className="fallback-rpc-list">
            {networkSettings.fallbackRpc.map((rpc, index) => (
              <div key={index} className="fallback-rpc-item">
                <input
                  type="url"
                  className="config-input"
                  value={rpc}
                  onChange={(e) => {
                    const newFallbacks = [...networkSettings.fallbackRpc];
                    newFallbacks[index] = e.target.value;
                    setNetworkSettings(prev => ({ ...prev, fallbackRpc: newFallbacks }));
                  }}
                  placeholder="https://backup-rpc-endpoint.com/"
                />
                <button 
                  className="config-button danger"
                  onClick={() => {
                    const newFallbacks = networkSettings.fallbackRpc.filter((_, i) => i !== index);
                    setNetworkSettings(prev => ({ ...prev, fallbackRpc: newFallbacks }));
                  }}
                >
                  <i className="fas fa-trash"></i>
                </button>
              </div>
            ))}
            <button 
              className="config-button secondary"
              onClick={() => {
                setNetworkSettings(prev => ({
                  ...prev,
                  fallbackRpc: [...prev.fallbackRpc, '']
                }));
              }}
            >
              <i className="fas fa-plus"></i>
              Add Fallback RPC
            </button>
          </div>
        </div>
      </div>

      {/* Configuration Summary */}
      <div className="config-section">
        <div className="config-section-header">
          <h3 className="config-section-title">
            <i className="fas fa-clipboard-check"></i>
            Transaction Summary
          </h3>
        </div>

        <div className="transaction-summary">
          <div className="summary-grid">
            <div className="summary-item">
              <span className="summary-label">Gas Strategy</span>
              <span className="summary-value">
                {gasPresets.find(p => p.baseGasPrice === gasSettings.baseGasPrice)?.name || 'Custom'}
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Estimated Gas Cost</span>
              <span className="summary-value">{estimatedGasCost.toFixed(6)} BNB</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Slippage Tolerance</span>
              <span className={`summary-value ${slippageSettings.tolerance > 5 ? 'warning' : 'success'}`}>
                {slippageSettings.tolerance}%
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">MEV Protection</span>
              <span className={`summary-value ${mevProtection.enabled ? 'success' : 'warning'}`}>
                {mevProtection.enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Network</span>
              <span className={`summary-value ${networkStatus}`}>
                BSC {networkSettings.chainId === 56 ? 'Mainnet' : 'Testnet'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};