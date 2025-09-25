/**
 * BalanceCell Component
 * Real-time balance display with refresh functionality and TanStack Query integration
 */

import React, { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { useWalletStore } from '../../store/wallets';
import type { Wallet } from '../../types';

interface BalanceCellProps {
  wallet: Wallet;
  showRefreshButton?: boolean;
  autoRefreshInterval?: number; // seconds
  onBalanceUpdate?: (address: string, balance: number) => void;
}

export const BalanceCell: React.FC<BalanceCellProps> = ({ 
  wallet, 
  showRefreshButton = true,
  autoRefreshInterval = 30,
  onBalanceUpdate 
}) => {
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const queryClient = useQueryClient();
  const updateWalletBalance = useWalletStore(state => state.updateWalletBalance);

  // Query for wallet balance using TanStack Query
  const {
    data: balanceData,
    isLoading,
    isError,
    error,
    dataUpdatedAt,
    refetch
  } = useQuery({
    queryKey: ['walletBalance', wallet.address],
    queryFn: async () => {
      const response = await apiClient.getWalletBalances([wallet.address]);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch balance');
      }
      return response.data[0] || { address: wallet.address, balance: 0 };
    },
    refetchInterval: autoRefreshInterval * 1000, // Convert to milliseconds
    refetchOnWindowFocus: true,
    staleTime: 10 * 1000, // 10 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Update wallet store when balance changes
  React.useEffect(() => {
    if (balanceData && balanceData.balance !== wallet.balance) {
      updateWalletBalance(wallet.address, balanceData.balance);
      onBalanceUpdate?.(wallet.address, balanceData.balance);
    }
  }, [balanceData, wallet.address, wallet.balance, updateWalletBalance, onBalanceUpdate]);

  const handleManualRefresh = useCallback(async () => {
    setIsManualRefreshing(true);
    try {
      await refetch();
      // Show success feedback briefly
      setTimeout(() => {
        setIsManualRefreshing(false);
      }, 1000);
    } catch (err) {
      setIsManualRefreshing(false);
      console.error('Manual refresh failed:', err);
    }
  }, [refetch]);

  const formatBalance = useCallback((balance: number): string => {
    if (balance === 0) return '0.0000';
    if (balance < 0.0001) return '<0.0001';
    if (balance < 1) return balance.toFixed(6);
    if (balance < 1000) return balance.toFixed(4);
    return balance.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }, []);

  const getBalanceStatus = useCallback((balance: number): 'high' | 'medium' | 'low' | 'zero' => {
    if (balance === 0) return 'zero';
    if (balance < 0.01) return 'low';
    if (balance < 1) return 'medium';
    return 'high';
  }, []);

  const getTimeSinceUpdate = useCallback((): string => {
    if (!dataUpdatedAt) return '';
    
    const now = Date.now();
    const diff = now - dataUpdatedAt;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    
    if (seconds < 60) return `${seconds}s ago`;
    if (minutes < 60) return `${minutes}m ago`;
    return `${Math.floor(minutes / 60)}h ago`;
  }, [dataUpdatedAt]);

  const currentBalance = balanceData?.balance ?? wallet.balance ?? 0;
  const balanceStatus = getBalanceStatus(currentBalance);

  return (
    <div className="balance-cell">
      <div className="balance-display">
        <div className={`balance-value ${balanceStatus}`}>
          {isLoading ? (
            <span className="balance-loading">
              <span className="loading-dots">•••</span>
            </span>
          ) : isError ? (
            <span className="balance-error" title={error?.message || 'Failed to load balance'}>
              Error
            </span>
          ) : (
            <>
              <span className="balance-amount">
                {formatBalance(currentBalance)}
              </span>
              <span className="balance-currency">BNB</span>
            </>
          )}
        </div>
        
        {!isLoading && !isError && dataUpdatedAt && (
          <div className="balance-meta">
            <small className="last-updated">
              {getTimeSinceUpdate()}
            </small>
          </div>
        )}
      </div>

      <div className="balance-actions">
        {showRefreshButton && (
          <button
            className={`refresh-btn ${isManualRefreshing ? 'refreshing' : ''}`}
            onClick={handleManualRefresh}
            disabled={isLoading || isManualRefreshing}
            title="Refresh balance"
          >
            <span className="refresh-icon">
              {isManualRefreshing ? '⏳' : '🔄'}
            </span>
          </button>
        )}
        
        {/* Balance status indicator */}
        <div className={`balance-indicator ${balanceStatus}`} title={`Balance status: ${balanceStatus}`}>
          <div className="indicator-dot"></div>
        </div>
      </div>

      {/* Auto-refresh indicator */}
      {autoRefreshInterval > 0 && (
        <div className="auto-refresh-indicator">
          <small>Auto-refresh: {autoRefreshInterval}s</small>
        </div>
      )}
    </div>
  );
};