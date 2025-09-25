/**
 * DistributionForm - BNB distribution controls component
 * Handles all distribution methods: equal, weighted, custom, and smart
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useWalletStore } from '../../store/wallets';
import { useFundingStore } from '../../store/funding';
import { useSessionStore } from '../../store/session';
import type { DistributionMethod, FundingOperation, DistributionPlan, Role } from '../../types';

interface DistributionFormData {
  method: DistributionMethod;
  totalAmount: number;
  customAmounts: Record<string, number>;
  smartThreshold: number;
  targetRole?: Role;
}

interface Props {
  onShowPreview: (operation: FundingOperation) => void;
}

export const DistributionForm: React.FC<Props> = ({ onShowPreview }) => {
  // Store state
  const { wallets, selectedWallets } = useWalletStore();
  const { 
    calculateDistribution,
    createFundingOperation,
    currentOperation,
    isCalculating,
    error,
    preferences,
    updatePreferences
  } = useFundingStore();
  const { isUnlocked } = useSessionStore();

  // Local state
  const [previewPlan, setPreviewPlan] = useState<DistributionPlan[] | null>(null);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  // Form setup
  const { control, watch, handleSubmit, setValue, reset, formState: { errors } } = useForm<DistributionFormData>({
    defaultValues: {
      method: preferences.defaultMethod,
      totalAmount: 1.0,
      customAmounts: {},
      smartThreshold: preferences.smartDistributionThreshold,
      targetRole: undefined,
    },
  });

  const method = watch('method');
  const totalAmount = watch('totalAmount');
  const customAmounts = watch('customAmounts');

  // Get selected wallets
  const selectedWalletData = useMemo(() => {
    return wallets.filter(wallet => selectedWallets.includes(wallet.id));
  }, [wallets, selectedWallets]);

  // Calculate preview on form changes
  const handleCalculatePreview = useCallback(async () => {
    if (!totalAmount || totalAmount <= 0 || selectedWallets.length === 0) {
      setPreviewPlan(null);
      return;
    }

    try {
      const plan = await calculateDistribution(method, totalAmount, selectedWallets, method === 'custom' ? customAmounts : undefined);
      setPreviewPlan(plan);
    } catch (error) {
      console.error('Failed to calculate preview:', error);
      setPreviewPlan(null);
    }
  }, [method, totalAmount, selectedWallets, customAmounts, calculateDistribution]);

  // Auto-calculate preview when form changes
  React.useEffect(() => {
    const timer = setTimeout(handleCalculatePreview, 300);
    return () => clearTimeout(timer);
  }, [handleCalculatePreview]);

  // Form submission
  const onSubmit = async (data: DistributionFormData) => {
    if (!isUnlocked) {
      alert('Session must be unlocked to create funding operations');
      return;
    }

    if (selectedWallets.length === 0) {
      alert('Please select wallets to fund');
      return;
    }

    try {
      await createFundingOperation(
        data.method,
        data.totalAmount,
        selectedWallets,
        data.method === 'custom' ? data.customAmounts : undefined
      );

      if (currentOperation) {
        onShowPreview(currentOperation);
      }
    } catch (error) {
      console.error('Failed to create funding operation:', error);
    }
  };

  // Custom amount handlers
  const handleCustomAmountChange = (walletId: string, amount: string) => {
    const numAmount = parseFloat(amount) || 0;
    setValue(`customAmounts.${walletId}`, numAmount);
  };

  const setEqualCustomAmounts = () => {
    if (selectedWalletData.length === 0) return;
    
    const equalAmount = totalAmount / selectedWalletData.length;
    const amounts: Record<string, number> = {};
    
    selectedWalletData.forEach(wallet => {
      amounts[wallet.id] = equalAmount;
    });
    
    setValue('customAmounts', amounts);
  };

  // Format balance display
  const formatBalance = (balance: number): string => {
    if (balance < 0.001) return balance.toFixed(6);
    if (balance < 1) return balance.toFixed(4);
    return balance.toFixed(2);
  };

  // Get method description
  const getMethodDescription = (method: DistributionMethod): string => {
    switch (method) {
      case 'equal':
        return 'Distribute the total amount equally across all selected wallets';
      case 'weighted':
        return 'Distribute based on wallet roles (DEV: 2x, MEV: 3x, FUNDER: 1x, NUMBERED: 1x)';
      case 'custom':
        return 'Manually specify the amount for each wallet';
      case 'smart':
        return 'Only fund wallets that have balance below the threshold';
      default:
        return '';
    }
  };

  return (
    <div className="distribution-form">
      <div className="form-header">
        <h3>
          <i className="fas fa-share-alt"></i>
          BNB Distribution
        </h3>
        <p className="form-description">
          Distribute BNB across your selected wallets using various methods
        </p>
      </div>

      {/* Selection Status */}
      <div className="selection-status">
        <div className="status-item">
          <span className="label">Selected Wallets:</span>
          <span className="value">{selectedWallets.length}</span>
        </div>
        <div className="status-item">
          <span className="label">Total Balance:</span>
          <span className="value">
            {formatBalance(selectedWalletData.reduce((sum, w) => sum + w.balance, 0))} BNB
          </span>
        </div>
        {method === 'smart' && previewPlan && (
          <div className="status-item">
            <span className="label">Needs Funding:</span>
            <span className="value">{previewPlan.filter(p => p.requiresFunding).length}</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="distribution-form-content">
        {/* Distribution Method Selection */}
        <div className="form-group">
          <label className="form-label">Distribution Method</label>
          <Controller
            name="method"
            control={control}
            render={({ field }) => (
              <div className="method-selector">
                {(['equal', 'weighted', 'custom', 'smart'] as DistributionMethod[]).map((methodOption) => (
                  <label
                    key={methodOption}
                    className={`method-option ${field.value === methodOption ? 'selected' : ''}`}
                  >
                    <input
                      type="radio"
                      value={methodOption}
                      checked={field.value === methodOption}
                      onChange={() => field.onChange(methodOption)}
                    />
                    <div className="method-content">
                      <div className="method-name">
                        {methodOption.charAt(0).toUpperCase() + methodOption.slice(1)}
                      </div>
                      <div className="method-description">
                        {getMethodDescription(methodOption)}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          />
        </div>

        {/* Total Amount */}
        <div className="form-group">
          <label className="form-label" htmlFor="totalAmount">
            Total Amount (BNB)
            {method === 'custom' && (
              <small> - Will be calculated from custom amounts</small>
            )}
          </label>
          <Controller
            name="totalAmount"
            control={control}
            rules={{
              required: method !== 'custom' ? 'Total amount is required' : false,
              min: { value: 0.000001, message: 'Amount must be greater than 0' },
              max: { value: 1000, message: 'Amount cannot exceed 1000 BNB' },
            }}
            render={({ field }) => (
              <input
                {...field}
                type="number"
                step="0.000001"
                min="0.000001"
                max="1000"
                className={`form-input ${errors.totalAmount ? 'error' : ''}`}
                placeholder="Enter BNB amount"
                disabled={method === 'custom'}
                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
              />
            )}
          />
          {errors.totalAmount && (
            <span className="error-message">{errors.totalAmount.message}</span>
          )}
        </div>

        {/* Smart Distribution Threshold */}
        {method === 'smart' && (
          <div className="form-group">
            <label className="form-label" htmlFor="smartThreshold">
              Minimum Balance Threshold (BNB)
            </label>
            <Controller
              name="smartThreshold"
              control={control}
              render={({ field }) => (
                <input
                  {...field}
                  type="number"
                  step="0.000001"
                  min="0"
                  className="form-input"
                  placeholder="0.01"
                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                />
              )}
            />
            <small className="form-hint">
              Only wallets with balance below this threshold will be funded
            </small>
          </div>
        )}

        {/* Custom Amounts */}
        {method === 'custom' && (
          <div className="form-group">
            <div className="custom-amounts-header">
              <label className="form-label">Custom Amounts per Wallet</label>
              <button
                type="button"
                className="equal-amounts-btn"
                onClick={setEqualCustomAmounts}
              >
                <i className="fas fa-balance-scale"></i>
                Set Equal Amounts
              </button>
            </div>
            <div className="custom-amounts-list">
              {selectedWalletData.map((wallet) => (
                <div key={wallet.id} className="custom-amount-item">
                  <div className="wallet-info">
                    <div className="wallet-address">
                      {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
                    </div>
                    <div className="wallet-details">
                      <span className="wallet-role">{wallet.role.toUpperCase()}</span>
                      <span className="wallet-balance">
                        {formatBalance(wallet.balance)} BNB
                      </span>
                    </div>
                  </div>
                  <input
                    type="number"
                    step="0.000001"
                    min="0"
                    className="amount-input"
                    placeholder="0.00"
                    value={customAmounts[wallet.id] || ''}
                    onChange={(e) => handleCustomAmountChange(wallet.id, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Advanced Options */}
        <div className="form-group">
          <button
            type="button"
            className="toggle-advanced"
            onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
          >
            <i className={`fas fa-chevron-${showAdvancedOptions ? 'up' : 'down'}`}></i>
            Advanced Options
          </button>
          
          {showAdvancedOptions && (
            <div className="advanced-options">
              <div className="option-item">
                <label>
                  <input
                    type="checkbox"
                    checked={preferences.confirmLargeOperations}
                    onChange={(e) => updatePreferences({ confirmLargeOperations: e.target.checked })}
                  />
                  Require confirmation for large operations
                </label>
              </div>
              <div className="option-item">
                <label>Auto-approval limit (BNB):</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={preferences.autoApprovalLimit}
                  onChange={(e) => updatePreferences({ autoApprovalLimit: parseFloat(e.target.value) || 0 })}
                  className="form-input small"
                />
              </div>
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="error-banner">
            <i className="fas fa-exclamation-triangle"></i>
            <span>{error}</span>
          </div>
        )}

        {/* Preview Section */}
        {previewPlan && (
          <div className="distribution-preview">
            <h4>
              <i className="fas fa-eye"></i>
              Distribution Preview
            </h4>
            <div className="preview-summary">
              <div className="summary-item">
                <span className="label">Total Amount:</span>
                <span className="value">{formatBalance(previewPlan.reduce((sum, p) => sum + p.plannedAmount, 0))} BNB</span>
              </div>
              <div className="summary-item">
                <span className="label">Wallets to Fund:</span>
                <span className="value">{previewPlan.filter(p => p.requiresFunding).length}</span>
              </div>
              <div className="summary-item">
                <span className="label">Average Amount:</span>
                <span className="value">
                  {previewPlan.length > 0 
                    ? formatBalance(previewPlan.reduce((sum, p) => sum + p.plannedAmount, 0) / previewPlan.length)
                    : '0'} BNB
                </span>
              </div>
            </div>

            <div className="preview-list">
              {previewPlan.filter(p => p.requiresFunding).slice(0, 5).map((plan) => (
                <div key={plan.walletId} className="preview-item">
                  <div className="wallet-info">
                    <span className="address">{plan.address.slice(0, 6)}...{plan.address.slice(-4)}</span>
                    <span className="role">{plan.role.toUpperCase()}</span>
                  </div>
                  <div className="amount-info">
                    <span className="current">{formatBalance(plan.currentBalance)} BNB</span>
                    <i className="fas fa-arrow-right"></i>
                    <span className="final">{formatBalance(plan.finalBalance)} BNB</span>
                    <span className="planned">+{formatBalance(plan.plannedAmount)}</span>
                  </div>
                </div>
              ))}
              {previewPlan.filter(p => p.requiresFunding).length > 5 && (
                <div className="preview-more">
                  +{previewPlan.filter(p => p.requiresFunding).length - 5} more wallets
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="form-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => reset()}
          >
            <i className="fas fa-undo"></i>
            Reset
          </button>
          
          <button
            type="button"
            className="btn btn-outline"
            onClick={handleCalculatePreview}
            disabled={isCalculating || selectedWallets.length === 0}
          >
            <i className={`fas ${isCalculating ? 'fa-spinner fa-spin' : 'fa-calculator'}`}></i>
            {isCalculating ? 'Calculating...' : 'Recalculate'}
          </button>
          
          <button
            type="submit"
            className="btn btn-primary"
            disabled={
              isCalculating ||
              !isUnlocked ||
              selectedWallets.length === 0 ||
              !previewPlan ||
              previewPlan.filter(p => p.requiresFunding).length === 0
            }
          >
            <i className="fas fa-coins"></i>
            Create Funding Operation
          </button>
        </div>
      </form>

      {/* Help Section */}
      <div className="distribution-help">
        <h4>
          <i className="fas fa-info-circle"></i>
          Distribution Methods Guide
        </h4>
        <div className="help-content">
          <div className="help-item">
            <strong>Equal:</strong> Divides the total amount equally among all selected wallets
          </div>
          <div className="help-item">
            <strong>Weighted:</strong> Distributes based on wallet roles with predefined multipliers
          </div>
          <div className="help-item">
            <strong>Custom:</strong> Allows you to specify exact amounts for each wallet
          </div>
          <div className="help-item">
            <strong>Smart:</strong> Only funds wallets below a certain balance threshold
          </div>
        </div>
      </div>
    </div>
  );
};