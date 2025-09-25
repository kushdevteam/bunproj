/**
 * Execution Parameters Component
 * Handles stagger settings, stealth mode, batch configuration, and safety features
 */

import React, { useState, useEffect } from 'react';
import type { 
  EnhancedBundleConfig,
  ExecutionParameters
} from '../../types/bundle-config';

interface ExecutionParamsProps {
  config: Partial<EnhancedBundleConfig>;
  onUpdate: (updates: Partial<EnhancedBundleConfig>) => void;
  validationErrors: string[];
  isValid: boolean;
}

export const ExecutionParams: React.FC<ExecutionParamsProps> = ({
  config,
  onUpdate,
  validationErrors,
  isValid
}) => {
  // Local state for execution parameters
  const [staggerSettings, setStaggerSettings] = useState({
    enabled: config.executionParams?.staggerSettings?.enabled !== false,
    delayMin: config.executionParams?.staggerSettings?.delayMin || 2000,
    delayMax: config.executionParams?.staggerSettings?.delayMax || 8000,
    randomization: config.executionParams?.staggerSettings?.randomization !== false,
  });

  const [stealthMode, setStealthMode] = useState({
    enabled: config.executionParams?.stealthMode?.enabled || false,
    randomTiming: config.executionParams?.stealthMode?.randomTiming || false,
    variationPercent: config.executionParams?.stealthMode?.variationPercent || 20,
    proxyUsage: config.executionParams?.stealthMode?.proxyUsage || false,
  });

  const [batchConfiguration, setBatchConfiguration] = useState({
    batchSize: config.executionParams?.batchConfiguration?.batchSize || 5,
    concurrentLimit: config.executionParams?.batchConfiguration?.concurrentLimit || 3,
    pauseBetweenBatches: config.executionParams?.batchConfiguration?.pauseBetweenBatches || 2,
  });

  const [safetyFeatures, setSafetyFeatures] = useState({
    maxTotalSpend: config.executionParams?.safetyFeatures?.maxTotalSpend || 2.0,
    emergencyStopEnabled: config.executionParams?.safetyFeatures?.emergencyStopEnabled !== false,
    maxFailureRate: config.executionParams?.safetyFeatures?.maxFailureRate || 15,
    timeoutPerTx: config.executionParams?.safetyFeatures?.timeoutPerTx || 60,
  });

  // Update parent config when local state changes
  useEffect(() => {
    const executionParams: ExecutionParameters = {
      staggerSettings,
      stealthMode,
      batchConfiguration,
      safetyFeatures,
    };

    onUpdate({ executionParams });
  }, [staggerSettings, stealthMode, batchConfiguration, safetyFeatures, onUpdate]);

  // Calculate execution estimates
  const calculateExecutionEstimates = () => {
    const avgDelay = staggerSettings.enabled 
      ? (staggerSettings.delayMin + staggerSettings.delayMax) / 2 
      : 0;
    const totalTransactions = batchConfiguration.batchSize * Math.ceil(10 / batchConfiguration.batchSize); // Assume 10 wallets
    const batchCount = Math.ceil(totalTransactions / batchConfiguration.batchSize);
    const totalTime = (avgDelay * totalTransactions) + (batchConfiguration.pauseBetweenBatches * batchCount * 1000);
    
    return {
      totalTime: Math.round(totalTime / 1000), // in seconds
      avgDelayPerTx: avgDelay / 1000,
      batchCount,
      totalTransactions
    };
  };

  const estimates = calculateExecutionEstimates();

  // Preset configurations
  const executionPresets = [
    {
      name: 'Conservative',
      description: 'Safe settings for beginners',
      settings: {
        stagger: { enabled: true, delayMin: 5000, delayMax: 15000, randomization: true },
        stealth: { enabled: false, randomTiming: false, variationPercent: 10, proxyUsage: false },
        batch: { batchSize: 3, concurrentLimit: 2, pauseBetweenBatches: 5 },
        safety: { maxTotalSpend: 1.0, emergencyStopEnabled: true, maxFailureRate: 10, timeoutPerTx: 90 }
      }
    },
    {
      name: 'Aggressive',
      description: 'Fast execution for experienced users',
      settings: {
        stagger: { enabled: false, delayMin: 500, delayMax: 1500, randomization: true },
        stealth: { enabled: false, randomTiming: false, variationPercent: 0, proxyUsage: false },
        batch: { batchSize: 10, concurrentLimit: 8, pauseBetweenBatches: 1 },
        safety: { maxTotalSpend: 5.0, emergencyStopEnabled: true, maxFailureRate: 25, timeoutPerTx: 30 }
      }
    },
    {
      name: 'Stealth',
      description: 'Maximum anonymity and randomization',
      settings: {
        stagger: { enabled: true, delayMin: 10000, delayMax: 30000, randomization: true },
        stealth: { enabled: true, randomTiming: true, variationPercent: 40, proxyUsage: true },
        batch: { batchSize: 2, concurrentLimit: 1, pauseBetweenBatches: 10 },
        safety: { maxTotalSpend: 2.0, emergencyStopEnabled: true, maxFailureRate: 15, timeoutPerTx: 120 }
      }
    }
  ];

  const applyPreset = (preset: typeof executionPresets[0]) => {
    setStaggerSettings(preset.settings.stagger);
    setStealthMode(preset.settings.stealth);
    setBatchConfiguration(preset.settings.batch);
    setSafetyFeatures(preset.settings.safety);
  };

  return (
    <div className="execution-params">
      {/* Execution Presets */}
      <div className="config-section">
        <div className="config-section-header">
          <h3 className="config-section-title">
            <i className="fas fa-magic"></i>
            Execution Presets
          </h3>
        </div>
        <p className="config-section-description">
          Quick configurations for different execution strategies
        </p>

        <div className="preset-cards">
          {executionPresets.map(preset => (
            <div key={preset.name} className="preset-card">
              <div className="preset-header">
                <h4 className="preset-name">{preset.name}</h4>
                <button 
                  className="config-button secondary"
                  onClick={() => applyPreset(preset)}
                >
                  Apply
                </button>
              </div>
              <p className="preset-description">{preset.description}</p>
              <div className="preset-details">
                <div className="preset-detail">
                  <span>Stagger:</span>
                  <span>{preset.settings.stagger.enabled ? 'Enabled' : 'Disabled'}</span>
                </div>
                <div className="preset-detail">
                  <span>Stealth:</span>
                  <span>{preset.settings.stealth.enabled ? 'Enabled' : 'Disabled'}</span>
                </div>
                <div className="preset-detail">
                  <span>Batch Size:</span>
                  <span>{preset.settings.batch.batchSize}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stagger Settings */}
      <div className="config-section">
        <div className="config-section-header">
          <h3 className="config-section-title">
            <i className="fas fa-clock"></i>
            Stagger Settings
          </h3>
        </div>
        <p className="config-section-description">
          Configure timing delays between transactions for controlled execution
        </p>

        <div className="config-checkbox-group">
          <div className="config-checkbox">
            <input
              type="checkbox"
              id="enable-stagger"
              checked={staggerSettings.enabled}
              onChange={(e) => setStaggerSettings(prev => ({ ...prev, enabled: e.target.checked }))}
            />
            <div className="checkbox-mark"></div>
          </div>
          <label htmlFor="enable-stagger" className="config-checkbox-label">
            <strong>Enable Staggered Execution</strong>
            <span className="option-description">Add delays between transactions</span>
          </label>
        </div>

        {staggerSettings.enabled && (
          <div className="stagger-controls">
            <div className="config-form-grid">
              <div className="config-input-group">
                <label className="config-label">Minimum Delay</label>
                <div className="input-with-unit">
                  <input
                    type="number"
                    className="config-input"
                    value={staggerSettings.delayMin}
                    onChange={(e) => setStaggerSettings(prev => ({ ...prev, delayMin: Number(e.target.value) }))}
                    min="100"
                    step="100"
                  />
                  <span className="input-unit">ms</span>
                </div>
                <div className="field-help">
                  Minimum delay between transactions
                </div>
              </div>

              <div className="config-input-group">
                <label className="config-label">Maximum Delay</label>
                <div className="input-with-unit">
                  <input
                    type="number"
                    className="config-input"
                    value={staggerSettings.delayMax}
                    onChange={(e) => setStaggerSettings(prev => ({ ...prev, delayMax: Number(e.target.value) }))}
                    min={staggerSettings.delayMin}
                    step="100"
                  />
                  <span className="input-unit">ms</span>
                </div>
                <div className="field-help">
                  Maximum delay between transactions
                </div>
              </div>
            </div>

            <div className="delay-visualization">
              <div className="delay-range">
                <span>Delay Range: {staggerSettings.delayMin}ms - {staggerSettings.delayMax}ms</span>
                <span>Average: {((staggerSettings.delayMin + staggerSettings.delayMax) / 2).toFixed(0)}ms</span>
              </div>
            </div>

            <div className="config-checkbox-group">
              <div className="config-checkbox">
                <input
                  type="checkbox"
                  id="randomize-timing"
                  checked={staggerSettings.randomization}
                  onChange={(e) => setStaggerSettings(prev => ({ ...prev, randomization: e.target.checked }))}
                />
                <div className="checkbox-mark"></div>
              </div>
              <label htmlFor="randomize-timing" className="config-checkbox-label">
                <strong>Randomize Timing</strong>
                <span className="option-description">Use random delays within the specified range</span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Stealth Mode */}
      <div className="config-section">
        <div className="config-section-header">
          <h3 className="config-section-title">
            <i className="fas fa-user-secret"></i>
            Stealth Mode
          </h3>
        </div>
        <p className="config-section-description">
          Advanced anonymization and pattern obfuscation features
        </p>

        <div className="config-checkbox-group">
          <div className="config-checkbox">
            <input
              type="checkbox"
              id="enable-stealth"
              checked={stealthMode.enabled}
              onChange={(e) => setStealthMode(prev => ({ ...prev, enabled: e.target.checked }))}
            />
            <div className="checkbox-mark"></div>
          </div>
          <label htmlFor="enable-stealth" className="config-checkbox-label">
            <strong>Enable Stealth Mode</strong>
            <span className="option-description">Activate advanced anonymization features</span>
          </label>
        </div>

        {stealthMode.enabled && (
          <div className="stealth-controls">
            <div className="config-checkbox-group">
              <div className="config-checkbox">
                <input
                  type="checkbox"
                  id="random-timing"
                  checked={stealthMode.randomTiming}
                  onChange={(e) => setStealthMode(prev => ({ ...prev, randomTiming: e.target.checked }))}
                />
                <div className="checkbox-mark"></div>
              </div>
              <label htmlFor="random-timing" className="config-checkbox-label">
                <strong>Random Timing Variations</strong>
                <span className="option-description">Add unpredictable timing patterns</span>
              </label>
            </div>

            <div className="config-input-group">
              <label className="config-label">Timing Variation</label>
              <div className="range-input-group">
                <input
                  type="range"
                  className="config-range"
                  min="0"
                  max="50"
                  step="5"
                  value={stealthMode.variationPercent}
                  onChange={(e) => setStealthMode(prev => ({ ...prev, variationPercent: Number(e.target.value) }))}
                />
                <div className="range-labels">
                  <span>0%</span>
                  <span className="range-value">{stealthMode.variationPercent}% variation</span>
                  <span>50%</span>
                </div>
              </div>
              <div className="field-help">
                Percentage of timing randomization applied
              </div>
            </div>

            <div className="config-checkbox-group">
              <div className="config-checkbox">
                <input
                  type="checkbox"
                  id="proxy-usage"
                  checked={stealthMode.proxyUsage}
                  onChange={(e) => setStealthMode(prev => ({ ...prev, proxyUsage: e.target.checked }))}
                />
                <div className="checkbox-mark"></div>
              </div>
              <label htmlFor="proxy-usage" className="config-checkbox-label">
                <strong>Proxy Usage</strong>
                <span className="option-description">Route transactions through proxy services</span>
              </label>
            </div>

            <div className="stealth-warning">
              <div className="status-indicator warning">
                <i className="fas fa-exclamation-triangle"></i>
                <span>Stealth mode may increase execution time and costs</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Batch Configuration */}
      <div className="config-section">
        <div className="config-section-header">
          <h3 className="config-section-title">
            <i className="fas fa-layer-group"></i>
            Batch Configuration
          </h3>
        </div>
        <p className="config-section-description">
          Configure transaction batching and concurrency limits
        </p>

        <div className="config-form-grid">
          <div className="config-input-group">
            <label className="config-label">Batch Size</label>
            <input
              type="number"
              className="config-input"
              value={batchConfiguration.batchSize}
              onChange={(e) => setBatchConfiguration(prev => ({ ...prev, batchSize: Number(e.target.value) }))}
              min="1"
              max="20"
              step="1"
            />
            <div className="field-help">
              Number of transactions per batch
            </div>
          </div>

          <div className="config-input-group">
            <label className="config-label">Concurrent Limit</label>
            <input
              type="number"
              className="config-input"
              value={batchConfiguration.concurrentLimit}
              onChange={(e) => setBatchConfiguration(prev => ({ ...prev, concurrentLimit: Number(e.target.value) }))}
              min="1"
              max={batchConfiguration.batchSize}
              step="1"
            />
            <div className="field-help">
              Maximum simultaneous transactions
            </div>
          </div>

          <div className="config-input-group">
            <label className="config-label">Pause Between Batches</label>
            <div className="input-with-unit">
              <input
                type="number"
                className="config-input"
                value={batchConfiguration.pauseBetweenBatches}
                onChange={(e) => setBatchConfiguration(prev => ({ ...prev, pauseBetweenBatches: Number(e.target.value) }))}
                min="0"
                step="1"
              />
              <span className="input-unit">sec</span>
            </div>
            <div className="field-help">
              Delay between completing batches
            </div>
          </div>
        </div>

        <div className="batch-visualization">
          <div className="batch-info">
            <div className="batch-stat">
              <span className="stat-label">Estimated Batches</span>
              <span className="stat-value">{estimates.batchCount}</span>
            </div>
            <div className="batch-stat">
              <span className="stat-label">Total Transactions</span>
              <span className="stat-value">{estimates.totalTransactions}</span>
            </div>
            <div className="batch-stat">
              <span className="stat-label">Execution Time</span>
              <span className="stat-value">{Math.floor(estimates.totalTime / 60)}m {estimates.totalTime % 60}s</span>
            </div>
          </div>
        </div>
      </div>

      {/* Safety Features */}
      <div className="config-section">
        <div className="config-section-header">
          <h3 className="config-section-title">
            <i className="fas fa-shield-alt"></i>
            Safety Features
          </h3>
        </div>
        <p className="config-section-description">
          Configure safety limits and emergency controls
        </p>

        <div className="config-form-grid">
          <div className="config-input-group">
            <label className="config-label">Max Total Spend</label>
            <div className="input-with-unit">
              <input
                type="number"
                className="config-input"
                value={safetyFeatures.maxTotalSpend}
                onChange={(e) => setSafetyFeatures(prev => ({ ...prev, maxTotalSpend: Number(e.target.value) }))}
                min="0.1"
                step="0.1"
              />
              <span className="input-unit">BNB</span>
            </div>
            <div className="field-help">
              Maximum total BNB that can be spent
            </div>
          </div>

          <div className="config-input-group">
            <label className="config-label">Max Failure Rate</label>
            <div className="input-with-unit">
              <input
                type="number"
                className="config-input"
                value={safetyFeatures.maxFailureRate}
                onChange={(e) => setSafetyFeatures(prev => ({ ...prev, maxFailureRate: Number(e.target.value) }))}
                min="0"
                max="100"
                step="5"
              />
              <span className="input-unit">%</span>
            </div>
            <div className="field-help">
              Stop execution if failure rate exceeds this
            </div>
          </div>

          <div className="config-input-group">
            <label className="config-label">Transaction Timeout</label>
            <div className="input-with-unit">
              <input
                type="number"
                className="config-input"
                value={safetyFeatures.timeoutPerTx}
                onChange={(e) => setSafetyFeatures(prev => ({ ...prev, timeoutPerTx: Number(e.target.value) }))}
                min="10"
                step="10"
              />
              <span className="input-unit">sec</span>
            </div>
            <div className="field-help">
              Timeout for individual transactions
            </div>
          </div>
        </div>

        <div className="config-checkbox-group">
          <div className="config-checkbox">
            <input
              type="checkbox"
              id="emergency-stop"
              checked={safetyFeatures.emergencyStopEnabled}
              onChange={(e) => setSafetyFeatures(prev => ({ ...prev, emergencyStopEnabled: e.target.checked }))}
            />
            <div className="checkbox-mark"></div>
          </div>
          <label htmlFor="emergency-stop" className="config-checkbox-label">
            <strong>Emergency Stop Function</strong>
            <span className="option-description">Enable manual emergency stop during execution</span>
          </label>
        </div>

        <div className="safety-summary">
          <div className="status-indicator success">
            <i className="fas fa-shield-check"></i>
            <span>Safety features configured</span>
          </div>
        </div>
      </div>

      {/* Execution Summary */}
      <div className="config-section">
        <div className="config-section-header">
          <h3 className="config-section-title">
            <i className="fas fa-chart-bar"></i>
            Execution Summary
          </h3>
        </div>

        <div className="execution-summary">
          <div className="summary-grid">
            <div className="summary-item">
              <span className="summary-label">Execution Strategy</span>
              <span className="summary-value">
                {staggerSettings.enabled ? 'Staggered' : 'Immediate'} 
                {stealthMode.enabled ? ' + Stealth' : ''}
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Average Delay</span>
              <span className="summary-value">{estimates.avgDelayPerTx.toFixed(1)}s</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Total Execution Time</span>
              <span className="summary-value">
                ~{Math.floor(estimates.totalTime / 60)}m {estimates.totalTime % 60}s
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Safety Level</span>
              <span className={`summary-value ${safetyFeatures.emergencyStopEnabled ? 'success' : 'warning'}`}>
                {safetyFeatures.emergencyStopEnabled ? 'Protected' : 'Basic'}
              </span>
            </div>
          </div>
        </div>

        <div className="risk-assessment">
          <div className="risk-factors">
            <h4>Risk Assessment</h4>
            <div className="risk-list">
              {!staggerSettings.enabled && (
                <div className="risk-item warning">
                  <i className="fas fa-exclamation-triangle"></i>
                  <span>Immediate execution increases MEV risk</span>
                </div>
              )}
              {safetyFeatures.maxTotalSpend > 5 && (
                <div className="risk-item error">
                  <i className="fas fa-exclamation-circle"></i>
                  <span>High spending limit - proceed with caution</span>
                </div>
              )}
              {batchConfiguration.concurrentLimit > 5 && (
                <div className="risk-item warning">
                  <i className="fas fa-exclamation-triangle"></i>
                  <span>High concurrency may trigger rate limits</span>
                </div>
              )}
              {stealthMode.enabled && (
                <div className="risk-item info">
                  <i className="fas fa-info-circle"></i>
                  <span>Stealth mode will increase execution time</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};