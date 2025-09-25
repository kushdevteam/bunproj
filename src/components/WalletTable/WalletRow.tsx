/**
 * WalletRow Component
 * Individual wallet row that integrates all cell components
 * Handles selection, interactions, and responsive layout
 */

import React, { useCallback, useMemo } from 'react';
import { PrivateKeyCell } from './PrivateKeyCell';
import { RoleSelector } from './RoleSelector';
import { BalanceCell } from './BalanceCell';
import { ActionButtons } from './ActionButtons';
import { FaucetButton } from '../FaucetButton';
import { BSCScanButton } from '../BSCScanButton';
import { useNetworkStore } from '../../store/network';
import type { Wallet, Role } from '../../types';

interface WalletRowProps {
  wallet: Wallet;
  isSelected: boolean;
  onSelect: (walletId: string, selected: boolean) => void;
  onRoleChange?: (walletId: string, newRole: Role) => void;
  onBalanceUpdate?: (address: string, balance: number) => void;
  onAction?: (action: 'buy' | 'sell' | 'fund', walletId: string) => void;
  onPrivateKeyCopy?: (address: string) => void;
  onFaucetSuccess?: (address: string, amount: number, txHash?: string) => void;
  onFaucetError?: (address: string, error: string) => void;
  showPrivateKeys?: boolean;
  showFaucetButton?: boolean;
  isSelectionMode?: boolean;
  disabled?: boolean;
}

export const WalletRow: React.FC<WalletRowProps> = ({
  wallet,
  isSelected,
  onSelect,
  onRoleChange,
  onBalanceUpdate,
  onAction,
  onPrivateKeyCopy,
  onFaucetSuccess,
  onFaucetError,
  showPrivateKeys = true,
  showFaucetButton = true,
  isSelectionMode = false,
  disabled = false,
}) => {
  const { isMainnet, currentNetwork } = useNetworkStore();
  const handleCheckboxChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    onSelect(wallet.id, event.target.checked);
  }, [wallet.id, onSelect]);

  const copyAddress = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(wallet.address);
      // Show success feedback briefly
      const button = document.querySelector(`[data-wallet-row="${wallet.id}"] .address-copy-btn`);
      if (button) {
        const originalText = button.textContent;
        button.textContent = '✓';
        setTimeout(() => {
          button.textContent = originalText;
        }, 2000);
      }
    } catch (error) {
      console.error('Failed to copy address:', error);
    }
  }, [wallet.address, wallet.id]);

  const handleFaucetSuccess = useCallback((amount: number, txHash?: string) => {
    console.log(`✅ Faucet success for ${wallet.address}: +${amount} BNB`);
    onFaucetSuccess?.(wallet.address, amount, txHash);
    // Trigger balance update if callback provided
    if (onBalanceUpdate) {
      setTimeout(() => {
        onBalanceUpdate(wallet.address, wallet.balance + amount);
      }, 2000); // Small delay to allow blockchain confirmation
    }
  }, [wallet.address, wallet.balance, onFaucetSuccess, onBalanceUpdate]);

  const handleFaucetError = useCallback((error: string) => {
    console.error(`❌ Faucet error for ${wallet.address}: ${error}`);
    onFaucetError?.(wallet.address, error);
  }, [wallet.address, onFaucetError]);

  const truncatedAddress = useMemo(() => {
    return `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`;
  }, [wallet.address]);

  const getRowClassName = useCallback(() => {
    const baseClass = 'wallet-row';
    const selectedClass = isSelected ? 'selected' : '';
    const disabledClass = disabled ? 'disabled' : '';
    const roleClass = `role-${wallet.role}`;
    const balanceClass = wallet.balance === 0 ? 'zero-balance' : wallet.balance < 0.01 ? 'low-balance' : '';
    
    return [baseClass, selectedClass, disabledClass, roleClass, balanceClass]
      .filter(Boolean)
      .join(' ');
  }, [isSelected, disabled, wallet.role, wallet.balance]);

  // Check if faucet should be shown (testnet only)
  const shouldShowFaucet = useMemo(() => {
    return showFaucetButton && !isMainnet && currentNetwork.chainId === 97;
  }, [showFaucetButton, isMainnet, currentNetwork.chainId]);

  return (
    <tr 
      className={getRowClassName()} 
      data-wallet-row={wallet.id}
      data-wallet-address={wallet.address}
    >
      {/* Selection Checkbox */}
      {isSelectionMode && (
        <td className="selection-cell">
          <div className="checkbox-wrapper">
            <input
              type="checkbox"
              id={`wallet-${wallet.id}`}
              checked={isSelected}
              onChange={handleCheckboxChange}
              disabled={disabled}
              className="wallet-checkbox"
            />
            <label htmlFor={`wallet-${wallet.id}`} className="checkbox-label">
              <span className="checkbox-icon">
                {isSelected ? '✓' : ''}
              </span>
            </label>
          </div>
        </td>
      )}

      {/* Wallet Address */}
      <td className="address-cell">
        <div className="address-display">
          <div className="address-text">
            <span className="address-truncated" title={wallet.address}>
              {truncatedAddress}
            </span>
            <button
              className="address-copy-btn"
              onClick={copyAddress}
              title="Copy full address"
            >
              📋
            </button>
            <BSCScanButton
              address={wallet.address}
              type="address"
              variant="icon"
              className="address-bscscan-btn"
            />
          </div>
          <div className="address-meta">
            <small className="address-id">ID: {wallet.id.slice(0, 8)}</small>
            <small className="address-created">
              {new Date(wallet.createdAt).toLocaleDateString()}
            </small>
          </div>
        </div>
      </td>

      {/* Role Assignment */}
      <td className="role-cell">
        <RoleSelector
          wallet={wallet}
          onRoleChange={onRoleChange}
          disabled={disabled}
        />
      </td>

      {/* BNB Balance */}
      <td className="balance-cell-container">
        <BalanceCell
          wallet={wallet}
          onBalanceUpdate={onBalanceUpdate}
          showRefreshButton={true}
          autoRefreshInterval={30}
        />
      </td>

      {/* Private Key */}
      {showPrivateKeys && (
        <td className="private-key-cell-container">
          <PrivateKeyCell
            wallet={wallet}
            onCopy={onPrivateKeyCopy}
          />
        </td>
      )}

      {/* Faucet Button */}
      {shouldShowFaucet && (
        <td className="faucet-cell">
          <FaucetButton
            wallet={wallet}
            onSuccess={handleFaucetSuccess}
            onError={handleFaucetError}
            compact={true}
            disabled={disabled}
          />
        </td>
      )}

      {/* Action Buttons */}
      <td className="actions-cell">
        <ActionButtons
          wallet={wallet}
          onAction={onAction}
          disabled={disabled}
        />
      </td>

      {/* Status Indicators */}
      <td className="status-cell">
        <div className="status-indicators">
          <div className={`activity-indicator ${wallet.isActive ? 'active' : 'inactive'}`}>
            <div className="indicator-dot"></div>
            <span className="indicator-label">
              {wallet.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
          
          {wallet.transactions && wallet.transactions.length > 0 && (
            <div className="transaction-count">
              <span className="tx-count">{wallet.transactions.length}</span>
              <span className="tx-label">txs</span>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
};