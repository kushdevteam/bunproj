/**
 * GenerateWalletsDialog Component
 * Dialog for generating new BNB wallets with role assignment
 */

import React, { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useForm } from 'react-hook-form';
import { useWalletStore } from '../../store/wallets';
import { useSessionStore } from '../../store/session';
import { Role } from '../../types';

interface GenerateWalletsFormData {
  count: number;
  passphrase: string;
  confirmPassphrase: string;
  assignRoles: boolean;
  defaultRole: Role;
  customRoles: Role[];
}

interface GenerateWalletsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (count: number) => void;
}

export const GenerateWalletsDialog: React.FC<GenerateWalletsDialogProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const generateWallets = useWalletStore(state => state.generateWallets);
  const { isUnlocked } = useSessionStore();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    reset,
  } = useForm<GenerateWalletsFormData>({
    defaultValues: {
      count: 5,
      passphrase: '',
      confirmPassphrase: '',
      assignRoles: false,
      defaultRole: Role.NUMBERED,
      customRoles: [],
    },
  });

  const watchCount = watch('count');
  const watchAssignRoles = watch('assignRoles');
  const watchPassphrase = watch('passphrase');

  const roleOptions = [
    { value: Role.DEV, label: 'Developer', icon: '👨‍💻' },
    { value: Role.MEV, label: 'MEV Bot', icon: '🤖' },
    { value: Role.FUNDER, label: 'Funder', icon: '💰' },
    { value: Role.NUMBERED, label: 'Numbered', icon: '🔢' },
  ];

  const handleClose = useCallback(() => {
    if (isGenerating) return;
    reset();
    setError(null);
    setShowAdvanced(false);
    onClose();
  }, [isGenerating, reset, onClose]);

  const onSubmit = useCallback(async (data: GenerateWalletsFormData) => {
    if (!isUnlocked) {
      setError('Session must be unlocked to generate wallets');
      return;
    }

    // Validate passphrase
    if (!data.passphrase || data.passphrase.length < 8) {
      setError('Passphrase must be at least 8 characters long');
      return;
    }

    if (data.passphrase !== data.confirmPassphrase) {
      setError('Passphrases do not match');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      let roles: Role[] | undefined;
      
      if (data.assignRoles) {
        if (data.customRoles.length > 0) {
          // Use custom role distribution
          roles = [];
          for (let i = 0; i < data.count; i++) {
            roles.push(data.customRoles[i % data.customRoles.length]);
          }
        } else {
          // Use default role for all wallets
          roles = Array(data.count).fill(data.defaultRole);
        }
      }

      await generateWallets(data.count, data.passphrase, roles);
      
      onSuccess?.(data.count);
      handleClose();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate wallets';
      setError(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  }, [isUnlocked, generateWallets, onSuccess, handleClose]);

  const handleOverlayClick = useCallback((event: React.MouseEvent) => {
    if (event.target === event.currentTarget) {
      handleClose();
    }
  }, [handleClose]);

  const addCustomRole = useCallback((role: Role) => {
    const currentRoles = watch('customRoles');
    if (!currentRoles.includes(role)) {
      setValue('customRoles', [...currentRoles, role]);
    }
  }, [watch, setValue]);

  const removeCustomRole = useCallback((roleToRemove: Role) => {
    const currentRoles = watch('customRoles');
    setValue('customRoles', currentRoles.filter(role => role !== roleToRemove));
  }, [watch, setValue]);

  if (!isOpen) return null;

  const dialogContent = (
    <div className="generate-wallets-overlay" onClick={handleOverlayClick}>
      <div className="generate-wallets-dialog">
        <div className="dialog-header">
          <h3 className="dialog-title">
            <span className="title-icon">✨</span>
            Generate New Wallets
          </h3>
          {!isGenerating && (
            <button 
              className="dialog-close"
              onClick={handleClose}
              aria-label="Close dialog"
            >
              ✕
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="generate-form">
          <div className="form-content">
            {/* Wallet Count */}
            <div className="form-group">
              <label htmlFor="count" className="form-label">
                Number of Wallets
                <span className="form-hint">How many wallets to generate (1-100)</span>
              </label>
              <input
                {...register('count', {
                  required: 'Number of wallets is required',
                  min: { value: 1, message: 'Must generate at least 1 wallet' },
                  max: { value: 100, message: 'Cannot generate more than 100 wallets at once' },
                  valueAsNumber: true,
                })}
                type="number"
                id="count"
                className="form-input"
                min="1"
                max="100"
                disabled={isGenerating}
              />
              {errors.count && (
                <span className="form-error">{errors.count.message}</span>
              )}
            </div>

            {/* Security Warning */}
            <div className="security-warning">
              <div className="warning-icon">🔒</div>
              <div className="warning-content">
                <strong>Security Notice:</strong> Your passphrase encrypts all private keys. Choose a strong, memorable passphrase - it cannot be recovered if lost.
              </div>
            </div>

            {/* Passphrase */}
            <div className="form-group">
              <label htmlFor="passphrase" className="form-label">
                Encryption Passphrase
                <span className="form-hint">Minimum 8 characters - required for wallet security</span>
              </label>
              <input
                {...register('passphrase', {
                  required: 'Passphrase is required',
                  minLength: { value: 8, message: 'Passphrase must be at least 8 characters' },
                  pattern: {
                    value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/,
                    message: 'Passphrase must contain uppercase, lowercase and number'
                  }
                })}
                type="password"
                id="passphrase"
                className="form-input"
                placeholder="Enter a strong passphrase"
                disabled={isGenerating}
              />
              {errors.passphrase && (
                <span className="form-error">{errors.passphrase.message}</span>
              )}
            </div>

            {/* Confirm Passphrase */}
            <div className="form-group">
              <label htmlFor="confirmPassphrase" className="form-label">
                Confirm Passphrase
                <span className="form-hint">Re-enter your passphrase to confirm</span>
              </label>
              <input
                {...register('confirmPassphrase', {
                  required: 'Please confirm your passphrase',
                  validate: (value) => value === watchPassphrase || 'Passphrases do not match'
                })}
                type="password"
                id="confirmPassphrase"
                className="form-input"
                placeholder="Confirm your passphrase"
                disabled={isGenerating}
              />
              {errors.confirmPassphrase && (
                <span className="form-error">{errors.confirmPassphrase.message}</span>
              )}
            </div>

            {/* Role Assignment */}
            <div className="form-group">
              <div className="checkbox-group">
                <input
                  {...register('assignRoles')}
                  type="checkbox"
                  id="assignRoles"
                  className="form-checkbox"
                  disabled={isGenerating}
                />
                <label htmlFor="assignRoles" className="checkbox-label">
                  Assign specific roles to wallets
                  <span className="form-hint">Otherwise, all wallets will be numbered</span>
                </label>
              </div>
            </div>

            {/* Role Configuration */}
            {watchAssignRoles && (
              <div className="role-configuration">
                <div className="form-group">
                  <label className="form-label">Default Role</label>
                  <select
                    {...register('defaultRole')}
                    className="form-select"
                    disabled={isGenerating}
                  >
                    {roleOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.icon} {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="advanced-toggle">
                  <button
                    type="button"
                    className="toggle-advanced"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                  >
                    {showAdvanced ? '▼' : '▶'} Advanced Role Distribution
                  </button>
                </div>

                {showAdvanced && (
                  <div className="custom-roles">
                    <label className="form-label">
                      Custom Role Pattern
                      <span className="form-hint">
                        Roles will be assigned in the order you select, repeating as needed
                      </span>
                    </label>
                    
                    <div className="role-selector-grid">
                      {roleOptions.map(option => (
                        <button
                          key={option.value}
                          type="button"
                          className="role-option-btn"
                          onClick={() => addCustomRole(option.value)}
                          disabled={isGenerating}
                        >
                          {option.icon} {option.label}
                        </button>
                      ))}
                    </div>

                    {watch('customRoles').length > 0 && (
                      <div className="selected-roles">
                        <label className="form-label">Selected Pattern:</label>
                        <div className="role-tags">
                          {watch('customRoles').map((role, index) => (
                            <div key={`${role}-${index}`} className="role-tag">
                              <span>{roleOptions.find(opt => opt.value === role)?.icon} {role}</span>
                              <button
                                type="button"
                                className="remove-role"
                                onClick={() => removeCustomRole(role)}
                                disabled={isGenerating}
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Generation Preview */}
            <div className="generation-preview">
              <h4>Generation Preview</h4>
              <div className="preview-stats">
                <div className="preview-stat">
                  <strong>Wallets to generate:</strong> {watchCount}
                </div>
                <div className="preview-stat">
                  <strong>Role assignment:</strong> {watchAssignRoles ? 'Custom' : 'All numbered'}
                </div>
                <div className="preview-stat">
                  <strong>Security:</strong> Client-side encrypted private keys
                </div>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="form-error-banner">
                <span className="error-icon">⚠️</span>
                {error}
              </div>
            )}

            {/* Session Status */}
            {!isUnlocked && (
              <div className="session-warning">
                <span className="warning-icon">🔒</span>
                Session must be unlocked to generate wallets
              </div>
            )}
          </div>

          <div className="dialog-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={handleClose}
              disabled={isGenerating}
            >
              Cancel
            </button>
            
            <button
              type="submit"
              className="btn-primary"
              disabled={isGenerating || !isUnlocked}
            >
              {isGenerating ? (
                <>
                  <span className="loading-spinner"></span>
                  Generating {watchCount} wallets...
                </>
              ) : (
                <>
                  ✨ Generate {watchCount} Wallet{watchCount !== 1 ? 's' : ''}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(dialogContent, document.body);
};