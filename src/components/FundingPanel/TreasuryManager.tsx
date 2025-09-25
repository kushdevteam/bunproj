/**
 * TreasuryManager - Treasury withdrawal operations component
 * Handles BNB withdrawal from wallets back to treasury address
 */

import React, { useState, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useWalletStore } from '../../store/wallets';
import { useTreasuryStore } from '../../store/treasury';
import { useSessionStore } from '../../store/session';
import type { TreasuryOperationType, TreasuryOperation, Role } from '../../types';

interface TreasuryFormData {
  operationType: TreasuryOperationType;
  treasuryAddress: string;
  minimumBalance: number;
  withdrawalPercentage: number;
  targetRole?: Role;
  confirmEmergency: boolean;
}

interface Props {
  onShowPreview: (operation: TreasuryOperation) => void;
}

export const TreasuryManager: React.FC<Props> = ({ onShowPreview }) => {
  // Store state
  const { wallets, selectedWallets } = useWalletStore();
  const {
    calculateWithdrawal,
    createTreasuryOperation,
    currentOperation,
    isCalculating,
    error,
    settings,
    updateSettings
  } = useTreasuryStore();
  const { isUnlocked } = useSessionStore();

  // Local state
  const [withdrawalPreview, setWithdrawalPreview] = useState<Record<string, number> | null>(null);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  // Form setup
  const { control, watch, handleSubmit, setValue, reset, formState: { errors } } = useForm<TreasuryFormData>({
    defaultValues: {
      operationType: 'withdraw_partial',
      treasuryAddress: settings.defaultTreasuryAddress,
      minimumBalance: settings.minimumWalletBalance,
      withdrawalPercentage: settings.partialWithdrawalPercentage,
      confirmEmergency: false,
    },
  });

  const operationType = watch('operationType');
  const treasuryAddress = watch('treasuryAddress');
  const minimumBalance = watch('minimumBalance');
  const withdrawalPercentage = watch('withdrawalPercentage');
  const targetRole = watch('targetRole');

  // Get selected wallets data
  const selectedWalletData = useMemo(() => {
    return wallets.filter(wallet => selectedWallets.includes(wallet.id));
  }, [wallets, selectedWallets]);

  // Calculate withdrawal statistics
  const stats = useMemo(() => {
    const totalBalance = selectedWalletData.reduce((sum, wallet) => sum + wallet.balance, 0);
    const totalWithdrawable = selectedWalletData.reduce(
      (sum, wallet) => sum + Math.max(0, wallet.balance - minimumBalance), 
      0
    );
    const roleDistribution = selectedWalletData.reduce((acc, wallet) => {
      if (!acc[wallet.role]) {
        acc[wallet.role] = { count: 0, balance: 0, withdrawable: 0 };
      }
      acc[wallet.role].count++;
      acc[wallet.role].balance += wallet.balance;
      acc[wallet.role].withdrawable += Math.max(0, wallet.balance - minimumBalance);
      return acc;
    }, {} as Record<Role, { count: number; balance: number; withdrawable: number }>);

    return {
      totalBalance,
      totalWithdrawable,
      roleDistribution,
      averageBalance: selectedWalletData.length > 0 ? totalBalance / selectedWalletData.length : 0,
    };
  }, [selectedWalletData, minimumBalance]);

  // Calculate withdrawal preview
  const handleCalculatePreview = React.useCallback(async () => {
    if (selectedWallets.length === 0 || !treasuryAddress) {
      setWithdrawalPreview(null);
      return;
    }

    try {
      const preview = await calculateWithdrawal(
        operationType,
        selectedWallets,
        treasuryAddress,
        {
          minimumBalance,
          withdrawalPercentage,
          targetRole,
        }
      );
      setWithdrawalPreview(preview);
    } catch (error) {
      console.error('Failed to calculate withdrawal preview:', error);
      setWithdrawalPreview(null);
    }
  }, [
    operationType,
    selectedWallets,
    treasuryAddress,
    minimumBalance,
    withdrawalPercentage,
    targetRole,
    calculateWithdrawal,
  ]);

  // Auto-calculate preview when form changes
  React.useEffect(() => {
    const timer = setTimeout(handleCalculatePreview, 300);
    return () => clearTimeout(timer);
  }, [handleCalculatePreview]);

  // Form submission
  const onSubmit = async (data: TreasuryFormData) => {
    if (!isUnlocked) {
      alert('Session must be unlocked to create treasury operations');
      return;
    }

    if (selectedWallets.length === 0) {
      alert('Please select wallets for treasury operations');
      return;
    }

    if (!data.treasuryAddress) {
      alert('Treasury address is required');
      return;
    }

    // Extra confirmation for emergency withdrawals
    if (data.operationType === 'withdraw_emergency') {
      if (!data.confirmEmergency) {
        alert('Please confirm emergency withdrawal by checking the confirmation box');
        return;
      }
      
      const confirmMessage = `EMERGENCY WITHDRAWAL: This will drain ALL BNB from ${selectedWallets.length} wallets to the treasury address. This action cannot be undone. Are you absolutely sure?`;
      if (!window.confirm(confirmMessage)) {
        return;
      }
    }

    try {
      await createTreasuryOperation(
        data.operationType,
        selectedWallets,
        data.treasuryAddress,
        {
          minimumBalance: data.minimumBalance,
          withdrawalPercentage: data.withdrawalPercentage,
          targetRole: data.targetRole,
        }
      );

      if (currentOperation) {
        onShowPreview(currentOperation);
      }
    } catch (error) {
      console.error('Failed to create treasury operation:', error);
    }
  };

  // Format balance display
  const formatBalance = (balance: number): string => {
    if (balance < 0.001) return balance.toFixed(6);
    if (balance < 1) return balance.toFixed(4);
    return balance.toFixed(2);
  };

  // Get operation description
  const getOperationDescription = (type: TreasuryOperationType): string => {
    switch (type) {
      case 'withdraw_all':
        return 'Withdraw all available BNB while maintaining minimum balance';
      case 'withdraw_partial':
        return 'Withdraw a percentage of available BNB from each wallet';
      case 'withdraw_emergency':
        return 'Emergency drain: Withdraw ALL BNB including reserves';
      case 'withdraw_by_role':
        return 'Withdraw from wallets of a specific role only';
      default:
        return '';
    }
  };

  // Validate treasury address
  const validateTreasuryAddress = (address: string): string | true => {
    if (!address) return 'Treasury address is required';
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return 'Invalid Ethereum address format';
    return true;
  };

  return (
    <div className="treasury-manager">
      <div className="form-header">
        <h3>
          <i className="fas fa-university"></i>
          Treasury Management
        </h3>
        <p className="form-description">
          Withdraw BNB from wallets back to your treasury address
        </p>
      </div>

      {/* Treasury Statistics */}
      <div className="treasury-stats">
        <div className="stat-card">
          <div className="stat-header">
            <i className="fas fa-coins"></i>
            <span>Total Balance</span>
          </div>
          <div className="stat-value">{formatBalance(stats.totalBalance)} BNB</div>
          <div className="stat-subtitle">Across {selectedWalletData.length} wallets</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <i className="fas fa-arrow-up"></i>
            <span>Withdrawable</span>
          </div>
          <div className="stat-value">{formatBalance(stats.totalWithdrawable)} BNB</div>
          <div className="stat-subtitle">After minimum balance</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <i className="fas fa-chart-line"></i>
            <span>Average</span>
          </div>
          <div className="stat-value">{formatBalance(stats.averageBalance)} BNB</div>
          <div className="stat-subtitle">Per wallet</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <i className="fas fa-percentage"></i>
            <span>Utilization</span>
          </div>
          <div className="stat-value">
            {stats.totalBalance > 0 
              ? ((stats.totalWithdrawable / stats.totalBalance) * 100).toFixed(1)
              : '0'}%
          </div>
          <div className="stat-subtitle">Available to withdraw</div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="treasury-form">
        {/* Treasury Address */}
        <div className="form-group">
          <label className="form-label" htmlFor="treasuryAddress">
            Treasury Address
            <span className="required">*</span>
          </label>
          <Controller
            name="treasuryAddress"
            control={control}
            rules={{
              required: 'Treasury address is required',
              validate: validateTreasuryAddress,
            }}
            render={({ field }) => (
              <div className="address-input-container">
                <input
                  {...field}
                  type="text"
                  className={`form-input address-input ${errors.treasuryAddress ? 'error' : ''}`}
                  placeholder="0x..."
                />
                <button
                  type="button"
                  className="save-address-btn"
                  onClick={() => updateSettings({ defaultTreasuryAddress: field.value })}
                  disabled={!field.value}
                  title="Save as default treasury address"
                >
                  <i className="fas fa-save"></i>
                </button>
              </div>
            )}
          />
          {errors.treasuryAddress && (
            <span className="error-message">{errors.treasuryAddress.message}</span>
          )}
          <small className="form-hint">
            All withdrawn BNB will be sent to this address
          </small>
        </div>

        {/* Operation Type Selection */}
        <div className="form-group">
          <label className="form-label">Operation Type</label>
          <Controller
            name="operationType"
            control={control}
            render={({ field }) => (
              <div className="operation-selector">
                {(['withdraw_partial', 'withdraw_all', 'withdraw_by_role', 'withdraw_emergency'] as TreasuryOperationType[]).map((type) => (
                  <label
                    key={type}
                    className={`operation-option ${field.value === type ? 'selected' : ''} ${type === 'withdraw_emergency' ? 'danger' : ''}`}
                  >
                    <input
                      type="radio"
                      value={type}
                      checked={field.value === type}
                      onChange={() => field.onChange(type)}
                    />
                    <div className="operation-content">
                      <div className="operation-name">
                        {type.replace('withdraw_', '').replace('_', ' ').toUpperCase()}
                      </div>
                      <div className="operation-description">
                        {getOperationDescription(type)}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          />
        </div>

        {/* Partial Withdrawal Percentage */}
        {operationType === 'withdraw_partial' && (
          <div className="form-group">
            <label className="form-label" htmlFor="withdrawalPercentage">
              Withdrawal Percentage
            </label>
            <Controller
              name="withdrawalPercentage"
              control={control}
              render={({ field }) => (
                <div className="percentage-input-container">
                  <input
                    {...field}
                    type="range"
                    min="1"
                    max="100"
                    className="percentage-slider"
                    onChange={(e) => field.onChange(parseInt(e.target.value))}
                  />
                  <input
                    type="number"
                    min="1"
                    max="100"
                    className="percentage-number"
                    value={field.value}
                    onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                  />
                  <span className="percentage-symbol">%</span>
                </div>
              )}
            />
            <small className="form-hint">
              Withdraw {withdrawalPercentage}% of available balance from each wallet
            </small>
          </div>
        )}

        {/* Role Selection for Role-based Withdrawal */}
        {operationType === 'withdraw_by_role' && (
          <div className="form-group">
            <label className="form-label" htmlFor="targetRole">
              Target Role
            </label>
            <Controller
              name="targetRole"
              control={control}
              rules={{ required: 'Please select a role for role-based withdrawal' }}
              render={({ field }) => (
                <select
                  {...field}
                  className={`form-select ${errors.targetRole ? 'error' : ''}`}
                >
                  <option value="">Select a role...</option>
                  {Object.entries(stats.roleDistribution).map(([role, data]) => (
                    <option key={role} value={role}>
                      {role.toUpperCase()} ({data.count} wallets, {formatBalance(data.withdrawable)} BNB withdrawable)
                    </option>
                  ))}
                </select>
              )}
            />
            {errors.targetRole && (
              <span className="error-message">{errors.targetRole.message}</span>
            )}
          </div>
        )}

        {/* Minimum Balance */}
        {operationType !== 'withdraw_emergency' && (
          <div className="form-group">
            <label className="form-label" htmlFor="minimumBalance">
              Minimum Balance per Wallet (BNB)
            </label>
            <Controller
              name="minimumBalance"
              control={control}
              render={({ field }) => (
                <input
                  {...field}
                  type="number"
                  step="0.000001"
                  min="0"
                  className="form-input"
                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                />
              )}
            />
            <small className="form-hint">
              Leave at least this amount in each wallet after withdrawal
            </small>
          </div>
        )}

        {/* Emergency Confirmation */}
        {operationType === 'withdraw_emergency' && (
          <div className="form-group emergency-confirmation">
            <div className="warning-banner">
              <i className="fas fa-exclamation-triangle"></i>
              <div>
                <strong>WARNING: Emergency Withdrawal</strong>
                <p>This will drain ALL BNB from selected wallets, including reserves. This action cannot be undone.</p>
              </div>
            </div>
            <Controller
              name="confirmEmergency"
              control={control}
              render={({ field }) => (
                <label className="emergency-checkbox">
                  <input
                    type="checkbox"
                    checked={field.value}
                    onChange={field.onChange}
                  />
                  <span>I understand this is an emergency withdrawal and will drain all funds</span>
                </label>
              )}
            />
          </div>
        )}

        {/* Advanced Settings */}
        <div className="form-group">
          <button
            type="button"
            className="toggle-advanced"
            onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
          >
            <i className={`fas fa-chevron-${showAdvancedSettings ? 'up' : 'down'}`}></i>
            Advanced Settings
          </button>
          
          {showAdvancedSettings && (
            <div className="advanced-settings">
              <div className="setting-item">
                <label>Gas limit multiplier:</label>
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  value={settings.gasLimitMultiplier}
                  onChange={(e) => updateSettings({ gasLimitMultiplier: parseFloat(e.target.value) || 1 })}
                  className="form-input small"
                />
              </div>
              <div className="setting-item">
                <label>Retry attempts:</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={settings.retryAttempts}
                  onChange={(e) => updateSettings({ retryAttempts: parseInt(e.target.value) || 1 })}
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

        {/* Withdrawal Preview */}
        {withdrawalPreview && Object.keys(withdrawalPreview).length > 0 && (
          <div className="withdrawal-preview">
            <h4>
              <i className="fas fa-eye"></i>
              Withdrawal Preview
            </h4>
            <div className="preview-summary">
              <div className="summary-item">
                <span className="label">Total Withdrawal:</span>
                <span className="value">
                  {formatBalance(Object.values(withdrawalPreview).reduce((sum, amount) => sum + amount, 0))} BNB
                </span>
              </div>
              <div className="summary-item">
                <span className="label">Wallets Affected:</span>
                <span className="value">{Object.keys(withdrawalPreview).length}</span>
              </div>
              <div className="summary-item">
                <span className="label">Estimated Gas Cost:</span>
                <span className="value">~0.001 BNB</span>
              </div>
            </div>

            <div className="preview-list">
              {Object.entries(withdrawalPreview).slice(0, 5).map(([walletId, amount]) => {
                const wallet = wallets.find(w => w.id === walletId);
                if (!wallet) return null;
                
                return (
                  <div key={walletId} className="preview-item">
                    <div className="wallet-info">
                      <span className="address">{wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}</span>
                      <span className="role">{wallet.role.toUpperCase()}</span>
                    </div>
                    <div className="withdrawal-amount">
                      <span className="amount">-{formatBalance(amount)} BNB</span>
                      <span className="remaining">
                        Remaining: {formatBalance(Math.max(0, wallet.balance - amount))} BNB
                      </span>
                    </div>
                  </div>
                );
              })}
              {Object.keys(withdrawalPreview).length > 5 && (
                <div className="preview-more">
                  +{Object.keys(withdrawalPreview).length - 5} more wallets
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
            className={`btn ${operationType === 'withdraw_emergency' ? 'btn-danger' : 'btn-primary'}`}
            disabled={
              isCalculating ||
              !isUnlocked ||
              selectedWallets.length === 0 ||
              !withdrawalPreview ||
              Object.keys(withdrawalPreview).length === 0
            }
          >
            <i className="fas fa-university"></i>
            Create Treasury Operation
          </button>
        </div>
      </form>
    </div>
  );
};