/**
 * FaucetButton Component
 * Individual wallet faucet button with cooldown tracking and status display
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useFaucetStore } from '../store/faucet';
import { useNetworkStore } from '../store/network';
import { useSessionStore } from '../store/session';
import type { Wallet } from '../types';

interface FaucetButtonProps {
  wallet: Wallet;
  onSuccess?: (amount: number, txHash?: string) => void;
  onError?: (error: string) => void;
  compact?: boolean; // For use in table rows
  disabled?: boolean;
}

interface FaucetState {
  isRequesting: boolean;
  cooldownSeconds: number;
  lastSuccess: boolean;
  error: string | null;
  amount: number | null;
  txHash: string | null;
}

export const FaucetButton: React.FC<FaucetButtonProps> = ({
  wallet,
  onSuccess,
  onError,
  compact = false,
  disabled = false,
}) => {
  const [faucetState, setFaucetState] = useState<FaucetState>({
    isRequesting: false,
    cooldownSeconds: 0,
    lastSuccess: false,
    error: null,
    amount: null,
    txHash: null,
  });

  const [countdownTimer, setCountdownTimer] = useState<NodeJS.Timeout | null>(null);

  const {
    isEnabled,
    requestBNB,
    canRequestFromFaucet,
    getCooldownInfo,
    hasAvailableFaucets,
    estimateSuccessProbability,
    refreshFaucetData,
  } = useFaucetStore();

  const { isUnlocked } = useSessionStore();
  const { isMainnet, currentNetwork } = useNetworkStore();

  // Check cooldown status on mount and when wallet changes
  useEffect(() => {
    if (!wallet.address || !isEnabled) return;

    const updateCooldownInfo = () => {
      // Check all faucets to find the earliest available time
      const faucetConfigs = useFaucetStore.getState().faucetConfigs;
      let minCooldown = 0;
      
      for (const faucet of faucetConfigs) {
        const cooldownInfo = getCooldownInfo(wallet.address, faucet.id);
        if (cooldownInfo.isInCooldown && cooldownInfo.remainingSeconds > minCooldown) {
          minCooldown = cooldownInfo.remainingSeconds;
        }
      }

      setFaucetState(prev => ({ ...prev, cooldownSeconds: minCooldown }));
    };

    updateCooldownInfo();
    refreshFaucetData();
  }, [wallet.address, isEnabled, getCooldownInfo, refreshFaucetData]);

  // Countdown timer
  useEffect(() => {
    if (faucetState.cooldownSeconds > 0) {
      const timer = setInterval(() => {
        setFaucetState(prev => {
          const newCooldown = Math.max(0, prev.cooldownSeconds - 1);
          if (newCooldown === 0) {
            // Cooldown ended, refresh data
            refreshFaucetData();
          }
          return { ...prev, cooldownSeconds: newCooldown };
        });
      }, 1000);

      setCountdownTimer(timer);
      return () => clearInterval(timer);
    } else if (countdownTimer) {
      clearInterval(countdownTimer);
      setCountdownTimer(null);
    }
  }, [faucetState.cooldownSeconds, refreshFaucetData]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (countdownTimer) {
        clearInterval(countdownTimer);
      }
    };
  }, [countdownTimer]);

  const handleFaucetRequest = useCallback(async () => {
    if (!isUnlocked || !isEnabled || faucetState.isRequesting || faucetState.cooldownSeconds > 0) {
      return;
    }

    setFaucetState(prev => ({
      ...prev,
      isRequesting: true,
      error: null,
      lastSuccess: false,
    }));

    try {
      console.log(`🚰 Requesting test BNB for wallet ${wallet.address}`);
      
      const result = await requestBNB(wallet.address);

      if (result.success) {
        setFaucetState(prev => ({
          ...prev,
          isRequesting: false,
          lastSuccess: true,
          amount: result.totalAmount,
          txHash: result.results.find(r => r.response.txHash)?.response.txHash || null,
          error: null,
        }));

        // Notify parent
        onSuccess?.(result.totalAmount, result.results.find(r => r.response.txHash)?.response.txHash);

        // Clear success state after delay
        setTimeout(() => {
          setFaucetState(prev => ({ ...prev, lastSuccess: false }));
        }, 5000);

      } else {
        const errorMessage = result.finalError || 'Failed to request test BNB';
        setFaucetState(prev => ({
          ...prev,
          isRequesting: false,
          error: errorMessage,
        }));

        onError?.(errorMessage);

        // Clear error after delay
        setTimeout(() => {
          setFaucetState(prev => ({ ...prev, error: null }));
        }, 8000);
      }

      // Refresh data after request
      refreshFaucetData();

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Faucet request failed:', error);
      
      setFaucetState(prev => ({
        ...prev,
        isRequesting: false,
        error: errorMessage,
      }));

      onError?.(errorMessage);

      // Clear error after delay
      setTimeout(() => {
        setFaucetState(prev => ({ ...prev, error: null }));
      }, 8000);
    }
  }, [isUnlocked, isEnabled, faucetState.isRequesting, faucetState.cooldownSeconds, requestBNB, wallet.address, onSuccess, onError, refreshFaucetData]);

  const formatCooldownTime = useCallback((seconds: number): string => {
    if (seconds === 0) return '';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }, []);

  const getButtonClass = useCallback(() => {
    const baseClass = compact ? 'faucet-btn compact' : 'faucet-btn';
    const classes = [baseClass];

    if (faucetState.isRequesting) classes.push('requesting');
    if (faucetState.lastSuccess) classes.push('success');
    if (faucetState.error) classes.push('error');
    if (faucetState.cooldownSeconds > 0) classes.push('cooldown');
    if (disabled || !isUnlocked || !isEnabled || isMainnet() || currentNetwork.chainId !== 97) {
      classes.push('disabled');
    }
    if (!hasAvailableFaucets(wallet.address) && faucetState.cooldownSeconds === 0) {
      classes.push('unavailable');
    }

    return classes.join(' ');
  }, [compact, faucetState, disabled, isUnlocked, isEnabled, isMainnet, currentNetwork.chainId, hasAvailableFaucets, wallet.address]);

  const getButtonContent = useCallback(() => {
    // Error state
    if (faucetState.error) {
      return (
        <>
          <span className="faucet-icon">❌</span>
          {!compact && <span className="faucet-text">Failed</span>}
        </>
      );
    }

    // Success state
    if (faucetState.lastSuccess) {
      return (
        <>
          <span className="faucet-icon">✅</span>
          {!compact && <span className="faucet-text">Success!</span>}
        </>
      );
    }

    // Requesting state
    if (faucetState.isRequesting) {
      return (
        <>
          <span className="faucet-icon">⏳</span>
          {!compact && <span className="faucet-text">Getting BNB...</span>}
        </>
      );
    }

    // Cooldown state
    if (faucetState.cooldownSeconds > 0) {
      return (
        <>
          <span className="faucet-icon">⏰</span>
          {!compact && <span className="faucet-text">{formatCooldownTime(faucetState.cooldownSeconds)}</span>}
          {compact && <span className="faucet-text">{formatCooldownTime(faucetState.cooldownSeconds)}</span>}
        </>
      );
    }

    // Default state
    return (
      <>
        <span className="faucet-icon">🚰</span>
        {!compact && <span className="faucet-text">Get Test BNB</span>}
        {compact && <span className="faucet-text">Faucet</span>}
      </>
    );
  }, [faucetState, compact, formatCooldownTime]);

  const getTooltipText = useCallback(() => {
    if (!isUnlocked) {
      return 'Unlock session to request test BNB';
    }

    if (!isEnabled || isMainnet() || currentNetwork.chainId !== 97) {
      return 'Faucets only available on BSC Testnet';
    }

    if (faucetState.error) {
      return `Error: ${faucetState.error}`;
    }

    if (faucetState.lastSuccess && faucetState.amount) {
      const txText = faucetState.txHash ? ` (TX: ${faucetState.txHash.substring(0, 10)}...)` : '';
      return `Successfully received ${faucetState.amount.toFixed(4)} BNB${txText}`;
    }

    if (faucetState.isRequesting) {
      return 'Requesting test BNB from available faucets...';
    }

    if (faucetState.cooldownSeconds > 0) {
      return `Cooldown active. Next request available in ${formatCooldownTime(faucetState.cooldownSeconds)}`;
    }

    if (!hasAvailableFaucets(wallet.address)) {
      return 'No faucets available (all in cooldown or daily limit reached)';
    }

    const successProbability = estimateSuccessProbability(wallet.address);
    return `Request test BNB for ${wallet.address.substring(0, 8)}... (${Math.round(successProbability * 100)}% success rate)`;
  }, [isUnlocked, isEnabled, isMainnet, currentNetwork.chainId, faucetState, formatCooldownTime, hasAvailableFaucets, wallet.address, estimateSuccessProbability]);

  const isButtonDisabled = useCallback(() => {
    return (
      disabled ||
      !isUnlocked ||
      !isEnabled ||
      isMainnet() ||
      currentNetwork.chainId !== 97 ||
      faucetState.isRequesting ||
      faucetState.cooldownSeconds > 0 ||
      (!hasAvailableFaucets(wallet.address) && faucetState.cooldownSeconds === 0)
    );
  }, [disabled, isUnlocked, isEnabled, isMainnet, currentNetwork.chainId, faucetState.isRequesting, faucetState.cooldownSeconds, hasAvailableFaucets, wallet.address]);

  const shouldShowDetails = !compact && (faucetState.error || faucetState.lastSuccess);

  return (
    <div className="faucet-button-container">
      <button
        className={getButtonClass()}
        onClick={handleFaucetRequest}
        disabled={isButtonDisabled() as boolean}
        title={getTooltipText()}
      >
        {getButtonContent()}
      </button>

      {shouldShowDetails && (
        <div className="faucet-details">
          {faucetState.error && (
            <div className="faucet-error">
              <small>{faucetState.error}</small>
            </div>
          )}

          {faucetState.lastSuccess && faucetState.amount && (
            <div className="faucet-success">
              <small>
                +{faucetState.amount.toFixed(4)} BNB
                {faucetState.txHash && (
                  <span className="tx-hash"> • TX: {faucetState.txHash.substring(0, 10)}...</span>
                )}
              </small>
            </div>
          )}
        </div>
      )}

      {!isEnabled && !compact && (
        <div className="faucet-disabled">
          <small>🔒 Testnet only</small>
        </div>
      )}
    </div>
  );
};

// CSS styles would be added to the appropriate CSS file
export const faucetButtonStyles = `
.faucet-button-container {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.faucet-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  color: white;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 120px;
  justify-content: center;
}

.faucet-btn.compact {
  padding: 6px 8px;
  font-size: 12px;
  min-width: 80px;
}

.faucet-btn:hover:not(.disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(79, 172, 254, 0.3);
}

.faucet-btn.requesting {
  background: linear-gradient(135deg, #ffeaa7 0%, #fab1a0 100%);
  animation: pulse 2s infinite;
}

.faucet-btn.success {
  background: linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%);
}

.faucet-btn.error {
  background: linear-gradient(135deg, #fd79a8 0%, #e84393 100%);
}

.faucet-btn.cooldown {
  background: linear-gradient(135deg, #74b9ff 0%, #0984e3 100%);
  cursor: not-allowed;
}

.faucet-btn.disabled {
  background: #cbd5e0;
  color: #a0aec0;
  cursor: not-allowed;
  opacity: 0.6;
}

.faucet-btn.unavailable {
  background: #e2e8f0;
  color: #718096;
  cursor: not-allowed;
}

.faucet-icon {
  font-size: 16px;
  line-height: 1;
}

.faucet-text {
  font-weight: 500;
}

.faucet-details {
  margin-top: 4px;
}

.faucet-error {
  color: #e53e3e;
  font-size: 12px;
}

.faucet-success {
  color: #38a169;
  font-size: 12px;
}

.faucet-disabled {
  color: #718096;
  font-size: 12px;
}

.tx-hash {
  color: #4299e1;
  font-family: monospace;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
`;

export default FaucetButton;