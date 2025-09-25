/**
 * ImportWalletsDialog Component
 * Dialog for importing existing wallets via private keys with validation
 */

import React, { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { useWalletStore } from '../../store/wallets';
import { useSessionStore } from '../../store/session';
import { encryptPrivateKey, secureStore } from '../../utils/crypto';
import { Role } from '../../types';

interface ImportWalletEntry {
  privateKey: string;
  role: Role;
  label?: string;
}

interface ImportWalletsFormData {
  importMethod: 'single' | 'bulk' | 'csv';
  passphrase: string;
  confirmPassphrase: string;
  wallets: ImportWalletEntry[];
  csvContent?: string;
}

interface ImportWalletsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (count: number) => void;
}

export const ImportWalletsDialog: React.FC<ImportWalletsDialogProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const addWallets = useWalletStore(state => state.addWallets);
  const { isUnlocked } = useSessionStore();

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    reset,
  } = useForm<ImportWalletsFormData>({
    defaultValues: {
      importMethod: 'single',
      passphrase: '',
      confirmPassphrase: '',
      wallets: [{ privateKey: '', role: Role.NUMBERED, label: '' }],
      csvContent: '',
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'wallets',
  });

  const watchImportMethod = watch('importMethod');

  const validatePrivateKey = useCallback((privateKey: string): boolean => {
    // Basic validation for Ethereum-style private keys
    const cleanKey = privateKey.trim();
    
    // Check if it's a valid hex string of correct length
    if (!/^(0x)?[a-fA-F0-9]{64}$/.test(cleanKey)) {
      return false;
    }
    
    return true;
  }, []);

  const deriveAddressFromPrivateKey = useCallback((privateKey: string): string => {
    // In a real implementation, this would use ethers.js to derive the address
    // For now, we'll create a mock address based on the private key
    const cleanKey = privateKey.replace('0x', '');
    const hash = Array.from(cleanKey).reduce((acc, char) => {
      return ((acc << 5) - acc + char.charCodeAt(0)) & 0xffffffff;
    }, 0);
    
    return `0x${Math.abs(hash).toString(16).padStart(40, '0')}`;
  }, []);

  const parseCsvContent = useCallback((csvContent: string): ImportWalletEntry[] => {
    const lines = csvContent.trim().split('\n');
    const entries: ImportWalletEntry[] = [];
    const errors: string[] = [];

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.startsWith('#')) return; // Skip empty lines and comments

      const parts = trimmedLine.split(',').map(part => part.trim());
      
      if (parts.length < 1) {
        errors.push(`Line ${index + 1}: Missing private key`);
        return;
      }

      const privateKey = parts[0];
      const role = (parts[1] as Role) || Role.NUMBERED;
      const label = parts[2] || '';

      if (!validatePrivateKey(privateKey)) {
        errors.push(`Line ${index + 1}: Invalid private key format`);
        return;
      }

      entries.push({ privateKey, role, label });
    });

    setValidationErrors(errors);
    return entries;
  }, [validatePrivateKey]);

  const handleClose = useCallback(() => {
    if (isImporting) return;
    reset();
    setError(null);
    setValidationErrors([]);
    onClose();
  }, [isImporting, reset, onClose]);

  const onSubmit = useCallback(async (data: ImportWalletsFormData) => {
    if (!isUnlocked) {
      setError('Session must be unlocked to import wallets');
      return;
    }

    setIsImporting(true);
    setError(null);
    setValidationErrors([]);

    try {
      let walletsToImport: ImportWalletEntry[] = [];

      if (data.importMethod === 'csv' && data.csvContent) {
        walletsToImport = parseCsvContent(data.csvContent);
      } else {
        walletsToImport = data.wallets.filter(w => w.privateKey.trim());
      }

      // Validate all private keys
      const invalidKeys: string[] = [];
      walletsToImport.forEach((wallet, index) => {
        if (!validatePrivateKey(wallet.privateKey)) {
          invalidKeys.push(`Wallet ${index + 1}: Invalid private key format`);
        }
      });

      if (invalidKeys.length > 0) {
        setValidationErrors(invalidKeys);
        return;
      }

      if (walletsToImport.length === 0) {
        setError('No valid wallets to import');
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

      // Process and encrypt wallets
      const processedWallets = [];

      for (let i = 0; i < walletsToImport.length; i++) {
        const walletData = walletsToImport[i];
        
        // Derive address from private key
        const address = deriveAddressFromPrivateKey(walletData.privateKey);
        
        // Generate unique wallet ID
        const walletId = `imported_${Date.now()}_${i}`;
        
        // Encrypt and store private key with user-provided passphrase (NO DEFAULT)
        const encryptedPrivateKey = await encryptPrivateKey(walletData.privateKey, data.passphrase);
        await secureStore(`wallet_${walletId}_pk`, encryptedPrivateKey);
        
        // Create wallet object (without private key in memory)
        processedWallets.push({
          id: walletId,
          publicKey: address, // In real implementation, derive public key
          address,
          balance: 0, // Will be updated by balance polling
          role: walletData.role,
          createdAt: new Date().toISOString(),
          isActive: true,
        });
      }

      // Add wallets to store
      addWallets(processedWallets);
      
      onSuccess?.(processedWallets.length);
      handleClose();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to import wallets';
      setError(errorMessage);
    } finally {
      setIsImporting(false);
    }
  }, [isUnlocked, parseCsvContent, validatePrivateKey, deriveAddressFromPrivateKey, addWallets, onSuccess, handleClose]);

  const handleOverlayClick = useCallback((event: React.MouseEvent) => {
    if (event.target === event.currentTarget) {
      handleClose();
    }
  }, [handleClose]);

  const addWalletEntry = useCallback(() => {
    append({ privateKey: '', role: Role.NUMBERED, label: '' });
  }, [append]);

  const removeWalletEntry = useCallback((index: number) => {
    remove(index);
  }, [remove]);

  const handleCsvUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setValue('csvContent', content);
    };
    reader.readAsText(file);
  }, [setValue]);

  if (!isOpen) return null;

  const dialogContent = (
    <div className="import-wallets-overlay" onClick={handleOverlayClick}>
      <div className="import-wallets-dialog">
        <div className="dialog-header">
          <h3 className="dialog-title">
            <span className="title-icon">📥</span>
            Import Existing Wallets
          </h3>
          {!isImporting && (
            <button 
              className="dialog-close"
              onClick={handleClose}
              aria-label="Close dialog"
            >
              ✕
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="import-form">
          <div className="form-content">
            {/* Security Warning */}
            <div className="security-warning">
              <div className="warning-icon">🔒</div>
              <div className="warning-content">
                <strong>Security Notice:</strong> Enter your encryption passphrase to securely import and encrypt these private keys.
              </div>
            </div>

            {/* Passphrase */}
            <div className="form-group">
              <label htmlFor="passphrase" className="form-label">
                Encryption Passphrase
                <span className="form-hint">Same passphrase used to encrypt your other wallets</span>
              </label>
              <input
                {...register('passphrase', {
                  required: 'Passphrase is required',
                  minLength: { value: 8, message: 'Passphrase must be at least 8 characters' }
                })}
                type="password"
                id="passphrase"
                className="form-input"
                placeholder="Enter your passphrase"
                disabled={isImporting}
              />
              {errors.passphrase && (
                <span className="form-error">{errors.passphrase.message}</span>
              )}
            </div>

            {/* Confirm Passphrase */}
            <div className="form-group">
              <label htmlFor="confirmPassphrase" className="form-label">
                Confirm Passphrase
              </label>
              <input
                {...register('confirmPassphrase', {
                  required: 'Please confirm your passphrase',
                  validate: (value) => value === watch('passphrase') || 'Passphrases do not match'
                })}
                type="password"
                id="confirmPassphrase"
                className="form-input"
                placeholder="Confirm your passphrase"
                disabled={isImporting}
              />
              {errors.confirmPassphrase && (
                <span className="form-error">{errors.confirmPassphrase.message}</span>
              )}
            </div>

            {/* Import Method Selection */}
            <div className="form-group">
              <label className="form-label">Import Method</label>
              <div className="method-selector">
                <label className="method-option">
                  <input
                    {...register('importMethod')}
                    type="radio"
                    value="single"
                    disabled={isImporting}
                  />
                  <span className="method-label">
                    <strong>Single Entry</strong>
                    <small>Import one wallet at a time</small>
                  </span>
                </label>
                
                <label className="method-option">
                  <input
                    {...register('importMethod')}
                    type="radio"
                    value="bulk"
                    disabled={isImporting}
                  />
                  <span className="method-label">
                    <strong>Multiple Entries</strong>
                    <small>Import several wallets manually</small>
                  </span>
                </label>
                
                <label className="method-option">
                  <input
                    {...register('importMethod')}
                    type="radio"
                    value="csv"
                    disabled={isImporting}
                  />
                  <span className="method-label">
                    <strong>CSV Upload</strong>
                    <small>Import from CSV file</small>
                  </span>
                </label>
              </div>
            </div>

            {/* CSV Upload */}
            {watchImportMethod === 'csv' && (
              <div className="csv-import">
                <div className="form-group">
                  <label htmlFor="csv-upload" className="form-label">
                    Upload CSV File
                    <span className="form-hint">
                      Format: private_key, role, label (one wallet per line)
                    </span>
                  </label>
                  <input
                    type="file"
                    id="csv-upload"
                    accept=".csv,.txt"
                    onChange={handleCsvUpload}
                    className="form-file"
                    disabled={isImporting}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="csv-content" className="form-label">
                    CSV Content Preview
                  </label>
                  <textarea
                    {...register('csvContent')}
                    id="csv-content"
                    className="form-textarea"
                    rows={8}
                    placeholder="0x1234567890abcdef..., dev, Development Wallet
0x9876543210fedcba..., mev, MEV Bot Wallet
# Lines starting with # are comments"
                    disabled={isImporting}
                  />
                </div>
              </div>
            )}

            {/* Manual Entry */}
            {(watchImportMethod === 'single' || watchImportMethod === 'bulk') && (
              <div className="manual-import">
                <div className="wallet-entries">
                  {fields.map((field, index) => (
                    <div key={field.id} className="wallet-entry">
                      <div className="entry-header">
                        <h4>Wallet {index + 1}</h4>
                        {watchImportMethod === 'bulk' && fields.length > 1 && (
                          <button
                            type="button"
                            className="remove-entry"
                            onClick={() => removeWalletEntry(index)}
                            disabled={isImporting}
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      <div className="entry-fields">
                        <div className="form-group">
                          <label className="form-label">Private Key</label>
                          <input
                            {...register(`wallets.${index}.privateKey`, {
                              required: 'Private key is required',
                              validate: (value) => validatePrivateKey(value) || 'Invalid private key format',
                            })}
                            type="password"
                            className="form-input"
                            placeholder="0x1234567890abcdef..."
                            disabled={isImporting}
                          />
                          {errors.wallets?.[index]?.privateKey && (
                            <span className="form-error">
                              {errors.wallets[index]?.privateKey?.message}
                            </span>
                          )}
                        </div>

                        <div className="form-row">
                          <div className="form-group">
                            <label className="form-label">Role</label>
                            <select
                              {...register(`wallets.${index}.role`)}
                              className="form-select"
                              disabled={isImporting}
                            >
                              <option value={Role.NUMBERED}>🔢 Numbered</option>
                              <option value={Role.DEV}>👨‍💻 Developer</option>
                              <option value={Role.MEV}>🤖 MEV Bot</option>
                              <option value={Role.FUNDER}>💰 Funder</option>
                            </select>
                          </div>

                          <div className="form-group">
                            <label className="form-label">Label (Optional)</label>
                            <input
                              {...register(`wallets.${index}.label`)}
                              type="text"
                              className="form-input"
                              placeholder="My wallet"
                              disabled={isImporting}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {watchImportMethod === 'bulk' && (
                  <button
                    type="button"
                    className="add-wallet-btn"
                    onClick={addWalletEntry}
                    disabled={isImporting}
                  >
                    + Add Another Wallet
                  </button>
                )}
              </div>
            )}

            {/* Validation Errors */}
            {validationErrors.length > 0 && (
              <div className="validation-errors">
                <h4>Validation Errors:</h4>
                <ul>
                  {validationErrors.map((error, index) => (
                    <li key={index} className="validation-error">
                      {error}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="form-error-banner">
                <span className="error-icon">⚠️</span>
                {error}
              </div>
            )}

            {/* Security Warning */}
            <div className="security-warning">
              <span className="warning-icon">🔒</span>
              <div className="warning-content">
                <strong>Security Notice:</strong>
                <p>Private keys will be encrypted and stored locally. Never share your private keys.</p>
              </div>
            </div>

            {/* Session Status */}
            {!isUnlocked && (
              <div className="session-warning">
                <span className="warning-icon">🔒</span>
                Session must be unlocked to import wallets
              </div>
            )}
          </div>

          <div className="dialog-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={handleClose}
              disabled={isImporting}
            >
              Cancel
            </button>
            
            <button
              type="submit"
              className="btn-primary"
              disabled={isImporting || !isUnlocked}
            >
              {isImporting ? (
                <>
                  <span className="loading-spinner"></span>
                  Importing wallets...
                </>
              ) : (
                <>
                  📥 Import Wallets
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