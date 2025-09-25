/**
 * ExportDialog Component
 * Secure private key export interface with multiple confirmations
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useSessionStore } from '../../store/session';
import { useWalletStore } from '../../store/wallets';
import { decryptPrivateKey } from '../../utils/crypto';
import { ConfirmDialog } from '../Dialogs/ConfirmDialog';
import type { ExportFormat, ExportType, ExportedWallet, Wallet } from '../../types';
import { Role } from '../../types';

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedWallets?: string[];
  exportType: ExportType;
  defaultRole?: Role;
}

export const ExportDialog: React.FC<ExportDialogProps> = ({
  isOpen,
  onClose,
  selectedWallets = [],
  exportType,
  defaultRole,
}) => {
  // Store state
  const { isUnlocked } = useSessionStore();
  const { wallets, getWalletsByRole, getWalletById } = useWalletStore();

  // Local state
  const [format, setFormat] = useState<ExportFormat>('hex');
  const [includePrivateKeys, setIncludePrivateKeys] = useState(false);
  const [includeBalances, setIncludeBalances] = useState(true);
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [confirmationStep, setConfirmationStep] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [exportedData, setExportedData] = useState<string | null>(null);
  const [securityWarnings, setSecurityWarnings] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role>(defaultRole || Role.NUMBERED);

  // Get wallets to export based on type
  const getWalletsToExport = useCallback((): Wallet[] => {
    switch (exportType) {
      case 'single':
        return selectedWallets.map(id => getWalletById(id)).filter(Boolean) as Wallet[];
      case 'bulk':
        return wallets;
      case 'by_role':
        return getWalletsByRole(selectedRole);
      default:
        return [];
    }
  }, [exportType, selectedWallets, wallets, getWalletById, getWalletsByRole, selectedRole]);

  const walletsToExport = getWalletsToExport();

  // Generate security warnings
  useEffect(() => {
    const warnings: string[] = [];

    if (includePrivateKeys) {
      warnings.push('Private keys will be exported in plain text format');
      warnings.push('Never share private keys with anyone - they control your funds');
      warnings.push('Store exported data securely and delete when no longer needed');
      warnings.push('Anyone with access to private keys can steal your funds');
    }

    if (walletsToExport.length > 10) {
      warnings.push(`Exporting ${walletsToExport.length} wallets - ensure you need them all`);
    }

    if (format === 'json') {
      warnings.push('JSON format includes all wallet metadata');
    }

    setSecurityWarnings(warnings);
  }, [includePrivateKeys, walletsToExport.length, format]);

  // Handle export process
  const handleExport = async () => {
    if (!isUnlocked || !passphrase) {
      alert('Session must be unlocked and passphrase provided');
      return;
    }

    if (passphrase !== confirmPassphrase) {
      alert('Passphrases do not match');
      return;
    }

    setIsExporting(true);

    try {
      const exportedWallets: ExportedWallet[] = [];

      for (const wallet of walletsToExport) {
        const exportedWallet: ExportedWallet = {
          id: wallet.id,
          address: wallet.address,
          role: wallet.role,
          createdAt: wallet.createdAt,
        };

        if (includeBalances) {
          exportedWallet.balance = wallet.balance;
        }

        if (includePrivateKeys) {
          try {
            const privateKey = await decryptPrivateKey(`wallet_${wallet.id}_pk`, passphrase);
            exportedWallet.privateKey = privateKey;
          } catch (error) {
            console.error(`Failed to decrypt private key for wallet ${wallet.id}:`, error);
            alert(`Failed to decrypt private key for wallet ${wallet.address}`);
            setIsExporting(false);
            return;
          }
        }

        exportedWallets.push(exportedWallet);
      }

      // Format the exported data
      let formattedData: string;
      let filename: string;

      switch (format) {
        case 'hex':
          if (includePrivateKeys) {
            formattedData = exportedWallets
              .map(w => `${w.address}: ${w.privateKey}`)
              .join('\n');
            filename = `wallets-private-keys-${Date.now()}.txt`;
          } else {
            formattedData = exportedWallets
              .map(w => w.address)
              .join('\n');
            filename = `wallet-addresses-${Date.now()}.txt`;
          }
          break;

        case 'json':
          formattedData = JSON.stringify(exportedWallets, null, 2);
          filename = `wallets-export-${Date.now()}.json`;
          break;

        case 'csv':
          const headers = ['Address', 'Role', 'Created At'];
          if (includeBalances) headers.push('Balance (BNB)');
          if (includePrivateKeys) headers.push('Private Key');

          const csvData = [
            headers.join(','),
            ...exportedWallets.map(w => {
              const row = [w.address, w.role, w.createdAt];
              if (includeBalances) row.push(w.balance?.toString() || '0');
              if (includePrivateKeys) row.push(w.privateKey || '');
              return row.join(',');
            })
          ];
          formattedData = csvData.join('\n');
          filename = `wallets-export-${Date.now()}.csv`;
          break;

        default:
          throw new Error(`Unsupported format: ${format}`);
      }

      setExportedData(formattedData);
      
      // Download the file
      const blob = new Blob([formattedData], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log(`Successfully exported ${exportedWallets.length} wallets`);
      
      // Show completion message
      alert(`Successfully exported ${exportedWallets.length} wallets to ${filename}`);
      
      // Reset and close
      handleClose();

    } catch (error) {
      console.error('Export failed:', error);
      alert(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsExporting(false);
    }
  };

  // Handle close
  const handleClose = () => {
    setFormat('hex');
    setIncludePrivateKeys(false);
    setIncludeBalances(true);
    setPassphrase('');
    setConfirmPassphrase('');
    setConfirmationStep(0);
    setExportedData(null);
    onClose();
  };

  // Render confirmation steps
  const renderConfirmationStep = () => {
    switch (confirmationStep) {
      case 0:
        return (
          <div className="export-configuration">
            <h3>Export Configuration</h3>
            
            {/* Export Type Info */}
            <div className="export-info">
              <p><strong>Export Type:</strong> {exportType}</p>
              <p><strong>Wallets to Export:</strong> {walletsToExport.length}</p>
            </div>

            {/* Role Selection for by_role type */}
            {exportType === 'by_role' && (
              <div className="form-group">
                <label>Select Role:</label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as Role)}
                >
                  {Object.values(Role).map(role => (
                    <option key={role} value={role}>
                      {role.toUpperCase()} ({getWalletsByRole(role).length} wallets)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Export Format */}
            <div className="form-group">
              <label>Export Format:</label>
              <select value={format} onChange={(e) => setFormat(e.target.value as ExportFormat)}>
                <option value="hex">Plain Text (addresses/keys)</option>
                <option value="json">JSON (structured data)</option>
                <option value="csv">CSV (spreadsheet)</option>
              </select>
            </div>

            {/* Options */}
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={includeBalances}
                  onChange={(e) => setIncludeBalances(e.target.checked)}
                />
                Include wallet balances
              </label>
            </div>

            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={includePrivateKeys}
                  onChange={(e) => setIncludePrivateKeys(e.target.checked)}
                />
                Include private keys (DANGEROUS)
              </label>
            </div>

            {/* Security Warnings */}
            {securityWarnings.length > 0 && (
              <div className="security-warnings">
                <h4>⚠️ Security Warnings:</h4>
                <ul>
                  {securityWarnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="dialog-actions">
              <button onClick={handleClose} className="cancel-btn">
                Cancel
              </button>
              <button
                onClick={() => setConfirmationStep(1)}
                className="primary-btn"
                disabled={walletsToExport.length === 0}
              >
                Continue
              </button>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="passphrase-confirmation">
            <h3>🔐 Passphrase Required</h3>
            <p>Enter your session passphrase to decrypt and export wallet data:</p>

            <div className="form-group">
              <label>Passphrase:</label>
              <input
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Enter your session passphrase"
                autoFocus
              />
            </div>

            <div className="form-group">
              <label>Confirm Passphrase:</label>
              <input
                type="password"
                value={confirmPassphrase}
                onChange={(e) => setConfirmPassphrase(e.target.value)}
                placeholder="Confirm your passphrase"
              />
            </div>

            <div className="dialog-actions">
              <button onClick={() => setConfirmationStep(0)} className="back-btn">
                Back
              </button>
              <button
                onClick={() => setConfirmationStep(2)}
                className="primary-btn"
                disabled={!passphrase || passphrase !== confirmPassphrase}
              >
                Continue
              </button>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="final-confirmation">
            <h3>⚠️ Final Confirmation</h3>
            <div className="final-warning">
              <p><strong>You are about to export sensitive wallet data!</strong></p>
              
              <div className="export-summary">
                <p>• <strong>{walletsToExport.length}</strong> wallets will be exported</p>
                <p>• Format: <strong>{format.toUpperCase()}</strong></p>
                <p>• Include balances: <strong>{includeBalances ? 'YES' : 'NO'}</strong></p>
                <p>• Include private keys: <strong>{includePrivateKeys ? 'YES (DANGEROUS)' : 'NO'}</strong></p>
              </div>

              {includePrivateKeys && (
                <div className="critical-warning">
                  <p>🔴 <strong>CRITICAL WARNING:</strong></p>
                  <p>Private keys give COMPLETE CONTROL over wallet funds!</p>
                  <p>Keep the exported file secure and delete when no longer needed!</p>
                </div>
              )}
            </div>

            <div className="dialog-actions">
              <button onClick={() => setConfirmationStep(1)} className="back-btn">
                Back
              </button>
              <button
                onClick={handleExport}
                className={`export-btn ${includePrivateKeys ? 'dangerous' : 'primary'}`}
                disabled={isExporting}
              >
                {isExporting ? 'Exporting...' : `Export ${walletsToExport.length} Wallets`}
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="export-dialog-overlay">
      <div className="export-dialog">
        <div className="export-dialog-header">
          <h2>🔐 Export Wallets</h2>
          <button onClick={handleClose} className="close-btn">×</button>
        </div>
        
        <div className="export-dialog-content">
          {renderConfirmationStep()}
        </div>
      </div>
    </div>
  );
};

export default ExportDialog;