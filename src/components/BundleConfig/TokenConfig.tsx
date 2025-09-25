/**
 * Token Configuration Component
 * Handles token selection, validation, allocation settings, and amount configuration
 */

import React, { useState, useCallback, useMemo } from 'react';
import { ethers } from 'ethers';
import { Role } from '../../types';
import type { 
  EnhancedBundleConfig, 
  TokenConfig as TokenConfigType, 
  AllocationConfig
} from '../../types/bundle-config';

interface TokenConfigProps {
  config: Partial<EnhancedBundleConfig>;
  onUpdate: (updates: Partial<EnhancedBundleConfig>) => void;
  wallets: any[];
  selectedWallets: string[];
  validationErrors: string[];
  isValid: boolean;
}

export const TokenConfig: React.FC<TokenConfigProps> = ({
  config,
  onUpdate,
  wallets,
  selectedWallets,
  validationErrors,
  isValid
}) => {
  // Local state
  const [tokenAddress, setTokenAddress] = useState(config.token?.address || '');
  const [isValidatingToken, setIsValidatingToken] = useState(false);
  const [tokenValidationError, setTokenValidationError] = useState<string | null>(null);
  const [tokenInfo, setTokenInfo] = useState<TokenConfigType | null>(config.token || null);
  const [allocationPercentages, setAllocationPercentages] = useState<AllocationConfig>(
    config.purchaseAmount?.allocation || {
      [Role.DEV]: 10,
      [Role.MEV]: 30,
      [Role.FUNDER]: 20,
      [Role.NUMBERED]: 40,
    }
  );
  const [totalBnb, setTotalBnb] = useState(config.purchaseAmount?.totalBnb || 1);
  const [perWalletMin, setPerWalletMin] = useState(config.purchaseAmount?.perWalletMin || 0.01);
  const [perWalletMax, setPerWalletMax] = useState(config.purchaseAmount?.perWalletMax || 0.1);

  // ERC-20 Token ABI (minimal interface for token info)
  const TOKEN_ABI = useMemo(() => [
    'function name() view returns (string)',
    'function symbol() view returns (string)', 
    'function decimals() view returns (uint8)',
    'function totalSupply() view returns (uint256)'
  ], []);

  // Validate token address format
  const isValidAddress = useCallback((address: string): boolean => {
    return ethers.isAddress(address);
  }, []);

  // Fetch token information from contract
  const validateToken = useCallback(async (address: string) => {
    if (!isValidAddress(address)) {
      setTokenValidationError('Invalid token address format');
      return;
    }

    try {
      setIsValidatingToken(true);
      setTokenValidationError(null);

      // Create a provider (you might want to get this from config)
      const provider = new ethers.JsonRpcProvider('https://bsc-dataseed1.binance.org/');
      const tokenContract = new ethers.Contract(address, TOKEN_ABI, provider);

      // Fetch token information
      const [name, symbol, decimals, totalSupply] = await Promise.all([
        tokenContract.name(),
        tokenContract.symbol(), 
        tokenContract.decimals(),
        tokenContract.totalSupply()
      ]);

      const tokenData: TokenConfigType = {
        address: address,
        name: name,
        symbol: symbol,
        decimals: Number(decimals),
        totalSupply: totalSupply.toString(),
        verified: false, // Would need additional verification logic
        contractValidated: true
      };

      setTokenInfo(tokenData);
      
      // Update main config
      onUpdate({
        token: tokenData
      });

    } catch (error) {
      console.error('Token validation error:', error);
      setTokenValidationError('Failed to fetch token information. Please verify the contract address.');
      setTokenInfo(null);
    } finally {
      setIsValidatingToken(false);
    }
  }, [isValidAddress, onUpdate, TOKEN_ABI]);

  // Handle token address change
  const handleTokenAddressChange = (address: string) => {
    setTokenAddress(address);
    
    if (address && isValidAddress(address)) {
      // Debounce validation
      const timer = setTimeout(() => {
        validateToken(address);
      }, 1000);
      
      return () => clearTimeout(timer);
    } else if (address) {
      setTokenValidationError('Invalid address format');
    } else {
      setTokenValidationError(null);
      setTokenInfo(null);
    }
  };

  // Handle allocation percentage change
  const handleAllocationChange = (role: Role, percentage: number) => {
    const newAllocations = {
      ...allocationPercentages,
      [role]: percentage
    };

    // Validate total doesn't exceed 100%
    const total = Object.values(newAllocations).reduce((sum, val) => sum + val, 0);
    
    if (total <= 100) {
      setAllocationPercentages(newAllocations);
      
      onUpdate({
        purchaseAmount: {
          ...config.purchaseAmount,
          totalBnb,
          perWalletMin,
          perWalletMax,
          allocation: newAllocations
        }
      });
    }
  };

  // Auto-balance remaining allocation
  const autoBalanceAllocation = () => {
    const currentTotal = Object.values(allocationPercentages).reduce((sum, val) => sum + val, 0);
    const remaining = 100 - currentTotal;
    
    if (remaining > 0) {
      // Distribute remaining percentage to NUMBERED role
      const balanced = {
        ...allocationPercentages,
        [Role.NUMBERED]: allocationPercentages[Role.NUMBERED] + remaining
      };
      
      setAllocationPercentages(balanced);
      
      onUpdate({
        purchaseAmount: {
          ...config.purchaseAmount,
          totalBnb,
          perWalletMin,
          perWalletMax,
          allocation: balanced
        }
      });
    }
  };

  // Calculate wallet distribution
  const calculateWalletDistribution = () => {
    const walletsByRole = {
      [Role.DEV]: wallets.filter(w => w.role === Role.DEV),
      [Role.MEV]: wallets.filter(w => w.role === Role.MEV),
      [Role.FUNDER]: wallets.filter(w => w.role === Role.FUNDER),
      [Role.NUMBERED]: wallets.filter(w => w.role === Role.NUMBERED),
    };

    const distribution = Object.entries(allocationPercentages).map(([role, percentage]) => {
      const roleWallets = walletsByRole[role as Role];
      const roleBnb = (totalBnb * percentage) / 100;
      const perWallet = roleWallets.length > 0 ? roleBnb / roleWallets.length : 0;

      return {
        role: role as Role,
        walletCount: roleWallets.length,
        totalBnb: roleBnb,
        perWallet,
        percentage
      };
    });

    return distribution;
  };

  // Handle amount changes
  const handleAmountChange = (field: 'totalBnb' | 'perWalletMin' | 'perWalletMax', value: number) => {
    const updates = { totalBnb, perWalletMin, perWalletMax, [field]: value };
    
    if (field === 'totalBnb') setTotalBnb(value);
    if (field === 'perWalletMin') setPerWalletMin(value);
    if (field === 'perWalletMax') setPerWalletMax(value);
    
    onUpdate({
      purchaseAmount: {
        ...config.purchaseAmount,
        ...updates,
        allocation: allocationPercentages
      }
    });
  };

  const distribution = calculateWalletDistribution();
  const totalAllocation = Object.values(allocationPercentages).reduce((sum, val) => sum + val, 0);

  return (
    <div className="token-config">
      {/* Token Selection Section */}
      <div className="config-section">
        <div className="config-section-header">
          <h3 className="config-section-title">
            <i className="fas fa-coins"></i>
            Token Selection
          </h3>
        </div>
        <p className="config-section-description">
          Enter the BEP-20 token contract address to configure bundle parameters
        </p>

        <div className="config-form-row">
          <div className="config-form-group">
            <label className="config-label">Token Contract Address</label>
            <div className="input-with-validation">
              <input
                type="text"
                className={`config-input ${tokenValidationError ? 'error' : tokenInfo ? 'success' : ''}`}
                placeholder="0x..."
                value={tokenAddress}
                onChange={(e) => handleTokenAddressChange(e.target.value)}
              />
              <div className="input-validation-icons">
                {isValidatingToken && <div className="loading-spinner"></div>}
                {tokenInfo && <i className="fas fa-check-circle text-success"></i>}
                {tokenValidationError && <i className="fas fa-exclamation-circle text-error"></i>}
              </div>
            </div>
            {tokenValidationError && (
              <div className="field-error">
                <i className="fas fa-exclamation-triangle"></i>
                {tokenValidationError}
              </div>
            )}
          </div>
        </div>

        {/* Token Information Display */}
        {tokenInfo && (
          <div className="token-info-display">
            <div className="token-info-grid">
              <div className="token-info-item">
                <span className="info-label">Name</span>
                <span className="info-value">{tokenInfo.name}</span>
              </div>
              <div className="token-info-item">
                <span className="info-label">Symbol</span>
                <span className="info-value">{tokenInfo.symbol}</span>
              </div>
              <div className="token-info-item">
                <span className="info-label">Decimals</span>
                <span className="info-value">{tokenInfo.decimals}</span>
              </div>
              <div className="token-info-item">
                <span className="info-label">Total Supply</span>
                <span className="info-value">
                  {Number(tokenInfo.totalSupply) / Math.pow(10, tokenInfo.decimals)} {tokenInfo.symbol}
                </span>
              </div>
            </div>
            
            <div className="token-status-indicators">
              <div className={`status-indicator ${tokenInfo.contractValidated ? 'success' : 'error'}`}>
                <i className={`fas ${tokenInfo.contractValidated ? 'fa-check' : 'fa-times'}`}></i>
                <span>Contract {tokenInfo.contractValidated ? 'Validated' : 'Invalid'}</span>
              </div>
              <div className={`status-indicator ${tokenInfo.verified ? 'success' : 'warning'}`}>
                <i className={`fas ${tokenInfo.verified ? 'fa-shield-alt' : 'fa-shield'}`}></i>
                <span>{tokenInfo.verified ? 'Verified' : 'Unverified'} Token</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Purchase Amount Configuration */}
      <div className="config-section">
        <div className="config-section-header">
          <h3 className="config-section-title">
            <i className="fas fa-calculator"></i>
            Purchase Amount Configuration
          </h3>
        </div>
        
        <div className="config-form-grid">
          <div className="config-input-group">
            <label className="config-label">Total BNB Amount</label>
            <div className="input-with-unit">
              <input
                type="number"
                className="config-input"
                min="0.01"
                step="0.01"
                value={totalBnb}
                onChange={(e) => handleAmountChange('totalBnb', Number(e.target.value))}
              />
              <span className="input-unit">BNB</span>
            </div>
          </div>

          <div className="config-input-group">
            <label className="config-label">Min Per Wallet</label>
            <div className="input-with-unit">
              <input
                type="number"
                className="config-input"
                min="0.001"
                step="0.001"
                value={perWalletMin}
                onChange={(e) => handleAmountChange('perWalletMin', Number(e.target.value))}
              />
              <span className="input-unit">BNB</span>
            </div>
          </div>

          <div className="config-input-group">
            <label className="config-label">Max Per Wallet</label>
            <div className="input-with-unit">
              <input
                type="number"
                className="config-input"
                min="0.001"
                step="0.001"
                value={perWalletMax}
                onChange={(e) => handleAmountChange('perWalletMax', Number(e.target.value))}
              />
              <span className="input-unit">BNB</span>
            </div>
          </div>
        </div>
      </div>

      {/* Allocation Settings */}
      <div className="config-section">
        <div className="config-section-header">
          <h3 className="config-section-title">
            <i className="fas fa-chart-pie"></i>
            Wallet Role Allocation
          </h3>
          <div className="allocation-summary">
            <span className={`total-allocation ${totalAllocation === 100 ? 'success' : 'warning'}`}>
              {totalAllocation}% of 100%
            </span>
            {totalAllocation < 100 && (
              <button 
                className="config-button secondary"
                onClick={autoBalanceAllocation}
              >
                Auto Balance
              </button>
            )}
          </div>
        </div>

        <div className="allocation-grid">
          {Object.entries(allocationPercentages).map(([role, percentage]) => {
            const roleInfo = distribution.find(d => d.role === role);
            return (
              <div key={role} className="allocation-item">
                <div className="allocation-header">
                  <div className="role-info">
                    <span className="role-name">{role.toUpperCase()}</span>
                    <span className="wallet-count">{roleInfo?.walletCount || 0} wallets</span>
                  </div>
                  <div className="allocation-percentage">
                    {percentage}%
                  </div>
                </div>

                <div className="allocation-controls">
                  <input
                    type="range"
                    className="config-range"
                    min="0"
                    max="100"
                    step="1"
                    value={percentage}
                    onChange={(e) => handleAllocationChange(role as Role, Number(e.target.value))}
                  />
                  <div className="range-labels">
                    <span>0%</span>
                    <span className="range-value">{percentage}%</span>
                    <span>100%</span>
                  </div>
                </div>

                <div className="allocation-details">
                  <div className="detail-item">
                    <span>Total BNB:</span>
                    <span className="detail-value">{roleInfo?.totalBnb.toFixed(3)} BNB</span>
                  </div>
                  <div className="detail-item">
                    <span>Per Wallet:</span>
                    <span className="detail-value">{roleInfo?.perWallet.toFixed(3)} BNB</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {totalAllocation !== 100 && (
          <div className="field-warning">
            <i className="fas fa-exclamation-triangle"></i>
            Allocation must total exactly 100%. Current total: {totalAllocation}%
          </div>
        )}
      </div>

      {/* Buy/Sell Strategy */}
      <div className="config-section">
        <div className="config-section-header">
          <h3 className="config-section-title">
            <i className="fas fa-exchange-alt"></i>
            Buy/Sell Strategy
          </h3>
        </div>

        <div className="config-form-grid">
          <div className="config-input-group">
            <label className="config-label">Buy Strategy</label>
            <select 
              className="config-select"
              value={config.strategy?.buyStrategy || 'staggered'}
              onChange={(e) => onUpdate({
                strategy: {
                  sellStrategy: 'gradual',
                  sellDelay: 300,
                  sellPercentage: 75,
                  retainPercentage: 25,
                  ...config.strategy,
                  buyStrategy: e.target.value as 'immediate' | 'staggered' | 'scaled'
                }
              })}
            >
              <option value="immediate">Immediate (All at once)</option>
              <option value="staggered">Staggered (Timed intervals)</option>
              <option value="scaled">Scaled (Size variation)</option>
            </select>
          </div>

          <div className="config-input-group">
            <label className="config-label">Sell Strategy</label>
            <select 
              className="config-select"
              value={config.strategy?.sellStrategy || 'gradual'}
              onChange={(e) => onUpdate({
                strategy: {
                  buyStrategy: 'staggered',
                  sellDelay: 300,
                  sellPercentage: 75,
                  retainPercentage: 25,
                  ...config.strategy,
                  sellStrategy: e.target.value as 'hold' | 'gradual' | 'dump'
                }
              })}
            >
              <option value="hold">Hold (No selling)</option>
              <option value="gradual">Gradual (Over time)</option>
              <option value="dump">Dump (All at once)</option>
            </select>
          </div>

          <div className="config-input-group">
            <label className="config-label">Sell Delay</label>
            <div className="input-with-unit">
              <input
                type="number"
                className="config-input"
                min="0"
                step="30"
                value={config.strategy?.sellDelay || 300}
                onChange={(e) => onUpdate({
                  strategy: {
                    buyStrategy: 'staggered',
                    sellStrategy: 'gradual',
                    sellPercentage: 75,
                    retainPercentage: 25,
                    ...config.strategy,
                    sellDelay: Number(e.target.value)
                  }
                })}
              />
              <span className="input-unit">sec</span>
            </div>
          </div>

          <div className="config-input-group">
            <label className="config-label">Sell Percentage</label>
            <div className="input-with-unit">
              <input
                type="number"
                className="config-input"
                min="0"
                max="100"
                step="5"
                value={config.strategy?.sellPercentage || 75}
                onChange={(e) => onUpdate({
                  strategy: {
                    buyStrategy: 'staggered',
                    sellStrategy: 'gradual',
                    sellDelay: 300,
                    ...config.strategy,
                    sellPercentage: Number(e.target.value),
                    retainPercentage: 100 - Number(e.target.value)
                  }
                })}
              />
              <span className="input-unit">%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Configuration Summary */}
      <div className="config-section">
        <div className="config-section-header">
          <h3 className="config-section-title">
            <i className="fas fa-clipboard-list"></i>
            Configuration Summary
          </h3>
        </div>

        <div className="summary-grid">
          <div className="summary-item">
            <span className="summary-label">Token</span>
            <span className="summary-value">
              {tokenInfo ? `${tokenInfo.symbol} (${tokenInfo.name})` : 'Not selected'}
            </span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Total Investment</span>
            <span className="summary-value">{totalBnb} BNB</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Active Wallets</span>
            <span className="summary-value">{wallets.length} total, {selectedWallets.length} selected</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Allocation Status</span>
            <span className={`summary-value ${totalAllocation === 100 ? 'success' : 'warning'}`}>
              {totalAllocation === 100 ? 'Complete' : 'Incomplete'} ({totalAllocation}%)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};