/**
 * ActionButtons Component
 * Buy, Sell, and Fund buttons for individual wallet operations
 */

import React, { useState, useCallback } from 'react';
import { useSessionStore } from '../../store/session';
import { apiClient } from '../../api/client';
import type { Wallet } from '../../types';

interface ActionButtonsProps {
  wallet: Wallet;
  onAction?: (action: 'buy' | 'sell' | 'fund', walletId: string) => void;
  disabled?: boolean;
}

interface ActionState {
  isLoading: boolean;
  lastAction: string | null;
  error: string | null;
}

export const ActionButtons: React.FC<ActionButtonsProps> = ({ 
  wallet, 
  onAction, 
  disabled = false 
}) => {
  const [actionState, setActionState] = useState<ActionState>({
    isLoading: false,
    lastAction: null,
    error: null,
  });

  const { isUnlocked } = useSessionStore();

  const handleAction = useCallback(async (action: 'buy' | 'sell' | 'fund') => {
    // No authentication required once logged in with access key

    if (actionState.isLoading) return;

    setActionState({
      isLoading: true,
      lastAction: action,
      error: null,
    });

    try {
      // Notify parent component
      onAction?.(action, wallet.id);

      // Simulate action based on type
      switch (action) {
        case 'buy':
          // In a real implementation, this would open a buy dialog or execute a buy order
          console.log(`Initiating buy action for wallet ${wallet.address}`);
          break;
          
        case 'sell':
          // In a real implementation, this would open a sell dialog or execute a sell order
          console.log(`Initiating sell action for wallet ${wallet.address}`);
          break;
          
        case 'fund':
          // In a real implementation, this would fund the wallet
          console.log(`Initiating fund action for wallet ${wallet.address}`);
          // Example funding call (commented out for mock):
          // await apiClient.fundWallets({
          //   wallets: [wallet.address],
          //   amount: 0.1,
          //   currency: 'BNB'
          // });
          break;
      }

      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 1500));

      setActionState({
        isLoading: false,
        lastAction: action,
        error: null,
      });

      // Clear success state after a delay
      setTimeout(() => {
        setActionState(prev => ({ ...prev, lastAction: null }));
      }, 3000);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : `Failed to ${action}`;
      setActionState({
        isLoading: false,
        lastAction: null,
        error: errorMessage,
      });

      // Clear error after a delay
      setTimeout(() => {
        setActionState(prev => ({ ...prev, error: null }));
      }, 5000);
    }
  }, [isUnlocked, actionState.isLoading, onAction, wallet.id, wallet.address]);

  const getButtonClass = useCallback((action: string) => {
    const baseClass = 'action-btn';
    const actionClass = `btn-${action}`;
    const loadingClass = actionState.isLoading && actionState.lastAction === action ? 'loading' : '';
    const successClass = !actionState.isLoading && actionState.lastAction === action ? 'success' : '';
    const disabledClass = disabled ? 'disabled' : '';
    
    return [baseClass, actionClass, loadingClass, successClass, disabledClass]
      .filter(Boolean)
      .join(' ');
  }, [actionState.isLoading, actionState.lastAction, disabled, isUnlocked]);

  const getButtonContent = useCallback((action: string, defaultIcon: string, defaultText: string) => {
    if (actionState.isLoading && actionState.lastAction === action) {
      return (
        <>
          <span className="action-icon">⏳</span>
          <span className="action-text">Processing...</span>
        </>
      );
    }

    if (!actionState.isLoading && actionState.lastAction === action) {
      return (
        <>
          <span className="action-icon">✓</span>
          <span className="action-text">Success!</span>
        </>
      );
    }

    return (
      <>
        <span className="action-icon">{defaultIcon}</span>
        <span className="action-text">{defaultText}</span>
      </>
    );
  }, [actionState.isLoading, actionState.lastAction]);

  const isButtonDisabled = useCallback((action: string) => {
    return disabled || (actionState.isLoading && actionState.lastAction !== action);
  }, [disabled, actionState.isLoading, actionState.lastAction]);

  return (
    <div className="action-buttons">
      <div className="button-group">
        <button
          className={getButtonClass('buy')}
          onClick={() => handleAction('buy')}
          disabled={isButtonDisabled('buy')}
          title="Buy tokens with this wallet"
        >
          {getButtonContent('buy', '🛒', 'Buy')}
        </button>

        <button
          className={getButtonClass('sell')}
          onClick={() => handleAction('sell')}
          disabled={isButtonDisabled('sell')}
          title="Sell tokens from this wallet"
        >
          {getButtonContent('sell', '💰', 'Sell')}
        </button>

        <button
          className={getButtonClass('fund')}
          onClick={() => handleAction('fund')}
          disabled={isButtonDisabled('fund')}
          title="Fund this wallet with BNB"
        >
          {getButtonContent('fund', '⚡', 'Fund')}
        </button>
      </div>

      {actionState.error && (
        <div className="action-error">
          <small>{actionState.error}</small>
        </div>
      )}

    </div>
  );
};