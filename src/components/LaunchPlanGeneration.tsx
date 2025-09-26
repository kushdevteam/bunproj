/**
 * Launch Plan Generation Component
 * Matches the "How to generate a launch plan" interface from screenshots
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useLaunchPlanStore, type GeneratedWallet } from '../store/launch-plans';
import { useLaunchStore } from '../store/launches';
import './LaunchPlanGeneration.css';

export const LaunchPlanGeneration: React.FC = () => {
  const {
    launchMode,
    devBuyPercent,
    supplyBuyPercent,
    disperseWalletsCount,
    staggerDelayMs,
    generatedWallets,
    isGenerating,
    error,
    currentPlan,
    setLaunchMode,
    setDevBuyPercent,
    setSupplyBuyPercent,
    setDisperseWalletsCount,
    setStaggerDelayMs,
    generateWallets,
    archivePlan,
    clearError,
    createNewPlan,
    savePlan,
  } = useLaunchPlanStore();

  // Get current draft from launches store and showConfirmation for modal
  const { formState, showConfirmation } = useLaunchStore();
  const { currentDraft } = formState;

  // Local state for initialization
  const [isInitializing, setIsInitializing] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [showSuccessNotification, setShowSuccessNotification] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Initialize launch plan when component mounts
  useEffect(() => {
    const initializeLaunchPlan = async () => {
      // Skip if already initializing or if we already have a plan
      if (isInitializing || currentPlan?.id) {
        return;
      }

      // Check if we have a valid current draft to work with
      if (!currentDraft?.id || !currentDraft.projectName || !currentDraft.symbol) {
        setInitError('No valid token draft found. Please create a token first.');
        return;
      }

      setIsInitializing(true);
      setInitError(null);

      try {
        // Create new launch plan connected to the current token draft
        const planId = createNewPlan(currentDraft.id);
        
        // Save the plan to backend
        const saveSuccess = await savePlan();
        
        if (!saveSuccess) {
          throw new Error('Failed to save launch plan to backend');
        }

        // Show success notification
        setSuccessMessage('Launch plan saved successfully');
        setShowSuccessNotification(true);
        setTimeout(() => setShowSuccessNotification(false), 3000);

        console.log('Launch plan initialized successfully:', planId);
      } catch (error) {
        console.error('Failed to initialize launch plan:', error);
        setInitError(error instanceof Error ? error.message : 'Failed to initialize launch plan');
      } finally {
        setIsInitializing(false);
      }
    };

    initializeLaunchPlan();
  }, [currentDraft?.id, currentPlan?.id, isInitializing, createNewPlan, savePlan]);

  // Calculate fresh and aged wallet counts for display
  const freshCount = generatedWallets.filter((w: GeneratedWallet) => w.type === 'fresh').length;
  const agedCount = generatedWallets.filter((w: GeneratedWallet) => w.type === 'aged').length;

  // BNB calculation based on configuration
  const calculateMinimumBnb = useCallback(() => {
    // Base calculation: Each wallet needs minimum 0.01 BNB for gas
    const baseGasPerWallet = 0.01;
    const totalGasCost = disperseWalletsCount * baseGasPerWallet;
    
    // Additional BNB needed for dev buy percentage
    const devBuyAmount = (devBuyPercent / 100) * 0.1; // Assume 0.1 BNB base for dev buy
    
    // Additional BNB for supply buy across all wallets
    const supplyBuyAmount = (supplyBuyPercent / 100) * 0.05 * disperseWalletsCount; // 0.05 BNB per wallet for supply buy
    
    // Total minimum BNB required
    return totalGasCost + devBuyAmount + supplyBuyAmount;
  }, [disperseWalletsCount, devBuyPercent, supplyBuyPercent]);

  const minimumBnb = calculateMinimumBnb();

  const handleLaunchModeSelect = useCallback((mode: 'quick' | 'organic') => {
    setLaunchMode(mode);
  }, [setLaunchMode]);

  const handleGenerate = useCallback(async () => {
    // Ensure we have a valid launch plan before generating wallets
    if (!currentPlan?.id) {
      setInitError('No launch plan found. Please refresh the page and try again.');
      return;
    }

    if (disperseWalletsCount === 0) {
      setInitError('Please set a valid wallet count (1-35)');
      return;
    }

    clearError();
    setInitError(null);
    
    try {
      await generateWallets();
    } catch (error) {
      console.error('Wallet generation failed:', error);
      setInitError(error instanceof Error ? error.message : 'Failed to generate wallets');
    }
  }, [disperseWalletsCount, generateWallets, currentPlan?.id, clearError]);

  const handleArchive = useCallback(() => {
    archivePlan();
  }, [archivePlan]);

  const handleDevBuyChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0));
    setDevBuyPercent(value);
  }, [setDevBuyPercent]);

  const handleSupplyBuyChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0));
    setSupplyBuyPercent(value);
  }, [setSupplyBuyPercent]);

  const handleDisperseWalletsChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.max(1, Math.min(35, parseInt(e.target.value) || 1));
    setDisperseWalletsCount(value);
  }, [setDisperseWalletsCount]);

  const handleStaggerDelayChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.max(0, Math.min(60000, parseInt(e.target.value) || 0));
    setStaggerDelayMs(value);
  }, [setStaggerDelayMs]);

  return (
    <div className="launch-plan-generation">
      <div className="launch-plan-header">
        <div className="header-content">
          <div className="plan-info">
            <div className="plan-title">
              {isInitializing ? 'Loading...' : (currentDraft?.projectName || 'No Project Name')}
            </div>
            <div className="plan-subtitle">
              {isInitializing ? 'Initializing...' : (currentDraft?.symbol || 'No Symbol')}
            </div>
          </div>
          <div className="mint-status">
            <span className="status-text">Token mint address is only available after launch</span>
            <div className="status-indicator">💎</div>
          </div>
        </div>
      </div>

      <div className="launch-plan-content">
        <h2 className="section-title">How to generate a launch plan.</h2>

        {/* Launch Mode Selection */}
        <div className="launch-mode-section">
          <h3 className="subsection-title">Launch Mode</h3>
          <div className="launch-mode-options">
            <div
              className={`launch-mode-card ${launchMode === 'quick' ? 'selected' : ''}`}
              onClick={() => handleLaunchModeSelect('quick')}
            >
              <div className="mode-header">
                <span className="mode-icon">⚡</span>
                <span className="mode-title">Quick Mode</span>
                <div className="mode-indicator"></div>
              </div>
              <div className="mode-icon-display">📱</div>
            </div>

            <div
              className={`launch-mode-card ${launchMode === 'organic' ? 'selected' : ''}`}
              onClick={() => handleLaunchModeSelect('organic')}
            >
              <div className="mode-header">
                <span className="mode-icon">🌱</span>
                <span className="mode-title">Organic Mode</span>
                <div className="mode-indicator"></div>
              </div>
              <div className="mode-icon-display">🌿</div>
            </div>
          </div>

          {launchMode === 'quick' && (
            <div className="mode-description">
              <div className="description-badge">
                ⚡ Quick Mode spreads as soon as possible across blocks.
              </div>
            </div>
          )}
          
          {launchMode === 'organic' && (
            <div className="mode-description">
              <div className="description-badge">
                🌱 Organic Mode spreads buys across multiple blocks, mimicking human behavior and making activity look organic. Best for low key launches.
              </div>
            </div>
          )}
        </div>

        {/* Configuration Form */}
        <div className="config-form">
          <div className="form-row">
            <div className="form-field">
              <label className="field-label">
                Dev Buy % <span className="optional">(optional)</span>
              </label>
              <input
                type="number"
                value={devBuyPercent}
                onChange={handleDevBuyChange}
                min="0"
                max="100"
                step="0.1"
                className="field-input"
                placeholder="0"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label className="field-label">
                Supply Buy % <span className="required">(Excluding dev)*</span>
                <span className="help-icon" title="Percentage of total supply to buy excluding dev allocation">
                  ?
                </span>
              </label>
              <input
                type="number"
                value={supplyBuyPercent}
                onChange={handleSupplyBuyChange}
                min="0"
                max="100"
                step="0.1"
                className="field-input"
                placeholder="0"
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label className="field-label">
                Disperse Wallets Count <span className="required">(1-35)*</span>
                <span className="help-icon" title="Number of wallets to generate for dispersed buying">
                  ?
                </span>
              </label>
              <input
                type="number"
                value={disperseWalletsCount}
                onChange={handleDisperseWalletsChange}
                min="1"
                max="35"
                className="field-input"
                placeholder="0"
                required
              />
            </div>
          </div>

          {launchMode === 'organic' && (
            <div className="form-row">
              <div className="form-field">
                <label className="field-label">
                  Stagger Delay <span className="required">(0ms - 60000ms)*</span>
                  <span className="help-icon" title="Delay between transactions in milliseconds for organic mode">
                    ?
                  </span>
                </label>
                <input
                  type="number"
                  value={staggerDelayMs}
                  onChange={handleStaggerDelayChange}
                  min="0"
                  max="60000"
                  className="field-input"
                  placeholder="0"
                  required
                />
              </div>
            </div>
          )}
        </div>

        {/* BNB Requirements Display */}
        <div className="bnb-requirements">
          <h3 className="subsection-title">BNB Requirements</h3>
          <div className="requirement-details">
            <div className="requirement-item">
              <span className="requirement-label">Gas fees ({disperseWalletsCount} wallets):</span>
              <span className="requirement-value">{(disperseWalletsCount * 0.01).toFixed(3)} BNB</span>
            </div>
            <div className="requirement-item">
              <span className="requirement-label">Dev buy ({devBuyPercent}%):</span>
              <span className="requirement-value">{((devBuyPercent / 100) * 0.1).toFixed(3)} BNB</span>
            </div>
            <div className="requirement-item">
              <span className="requirement-label">Supply buy ({supplyBuyPercent}%):</span>
              <span className="requirement-value">{((supplyBuyPercent / 100) * 0.05 * disperseWalletsCount).toFixed(3)} BNB</span>
            </div>
            <div className="requirement-total">
              <span className="total-label">Total minimum required:</span>
              <span className="total-value">{minimumBnb.toFixed(3)} BNB</span>
            </div>
          </div>
        </div>

        {/* Generate Button */}
        <div className="generate-section">
          <button
            className={`generate-btn ${isGenerating ? 'generating' : ''}`}
            onClick={handleGenerate}
            disabled={isGenerating || disperseWalletsCount === 0 || isInitializing || !currentPlan?.id}
          >
            {isGenerating ? (
              <>
                <span className="loading-spinner"></span>
                Generating...
              </>
            ) : (
              `Generate - ${freshCount} Fresh + ${agedCount} Aged`
            )}
          </button>

          {showSuccessNotification && (
            <div className="success-message">
              <span className="success-icon">✅</span>
              {successMessage}
              <button className="success-close" onClick={() => setShowSuccessNotification(false)}>×</button>
            </div>
          )}

          {(error || initError) && (
            <div className="error-message">
              <span className="error-icon">⚠️</span>
              {error || initError}
              <button className="error-close" onClick={() => { clearError(); setInitError(null); }}>×</button>
            </div>
          )}

          {isInitializing && (
            <div className="info-message">
              <span className="info-icon">ℹ️</span>
              Initializing launch plan for {currentDraft?.projectName || 'your token'}...
            </div>
          )}
        </div>

        {/* Generated Wallets Display */}
        {generatedWallets.length > 0 && (
          <div className="wallets-section">
            <h3 className="subsection-title">Generated Wallets</h3>
            <div className="wallets-table">
              <div className="table-header">
                <div className="header-cell">Address</div>
                <div className="header-cell">Token Buy %</div>
                <div className="header-cell">Funded</div>
                <div className="header-cell">Private Key</div>
                <div className="header-cell">Actions</div>
              </div>
              
              {generatedWallets.map((wallet: GeneratedWallet, index: number) => (
                <div key={wallet.id} className="table-row">
                  <div className="table-cell">
                    <div className="wallet-address">
                      {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
                    </div>
                  </div>
                  <div className="table-cell">
                    <div className="buy-percentage">{wallet.buyPercentage.toFixed(2)}%</div>
                  </div>
                  <div className="table-cell">
                    <div className={`funded-status ${wallet.funded ? 'funded' : 'unfunded'}`}>
                      {wallet.funded ? '✅' : '❌'}
                    </div>
                  </div>
                  <div className="table-cell">
                    <div className="private-key">
                      <span className="key-preview">•••••••••••••••••</span>
                      <button 
                        className="reveal-key-btn"
                        onClick={() => {/* TODO: Implement key reveal */}}
                        title="Reveal private key"
                      >
                        👁️
                      </button>
                    </div>
                  </div>
                  <div className="table-cell">
                    <div className="wallet-actions">
                      <button 
                        className="fund-btn"
                        disabled={wallet.funded}
                        onClick={() => {/* TODO: Implement funding */}}
                        title="Fund wallet"
                      >
                        Fund
                      </button>
                      <button 
                        className="withdraw-btn"
                        disabled={!wallet.funded}
                        onClick={() => {/* TODO: Implement withdrawal */}}
                        title="Withdraw funds"
                      >
                        Withdraw
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Proceed to Launch Button - only show after wallets are generated */}
        {generatedWallets.length > 0 && (
          <div className="proceed-section">
            <div className="proceed-info">
              <div className="proceed-message">
                <strong>Configuration Complete!</strong>
                <p>
                  {freshCount} fresh wallets and {agedCount} aged wallets have been generated.
                  Total BNB required: <strong>{minimumBnb.toFixed(3)} BNB</strong>
                </p>
              </div>
            </div>
            <button 
              className="proceed-btn"
              onClick={() => showConfirmation(currentDraft)}
              disabled={!currentDraft?.id}
            >
              🚀 Proceed to Launch
            </button>
          </div>
        )}

        {/* Archive Button */}
        <div className="archive-section">
          <button className="archive-btn" onClick={handleArchive}>
            📁 Archive
          </button>
        </div>
      </div>
    </div>
  );
};