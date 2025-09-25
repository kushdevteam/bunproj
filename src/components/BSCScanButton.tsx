/**
 * BSCScanButton Component
 * Button to view wallet addresses and transactions on BSCScan
 */

import React from 'react';
import { useNetworkStore } from '../store/network';
import { bscScan } from '../utils/bscscan';

interface BSCScanButtonProps {
  address?: string;
  txHash?: string;
  type?: 'address' | 'transaction';
  variant?: 'icon' | 'text' | 'compact';
  className?: string;
  disabled?: boolean;
  customText?: string;
}

export const BSCScanButton: React.FC<BSCScanButtonProps> = ({
  address,
  txHash,
  type = 'address',
  variant = 'icon',
  className = '',
  disabled = false,
  customText,
}) => {
  const { currentNetwork } = useNetworkStore();
  
  const value = type === 'address' ? address : txHash;
  
  if (!value) {
    return null;
  }

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (disabled) return;
    
    if (type === 'address' && address) {
      bscScan.viewAddress(address, currentNetwork.chainId);
    } else if (type === 'transaction' && txHash) {
      bscScan.viewTransaction(txHash, currentNetwork.chainId);
    }
  };

  const getButtonContent = () => {
    if (customText) {
      return customText;
    }

    switch (variant) {
      case 'icon':
        return type === 'address' ? '👁️' : '🔗';
      case 'text':
        return type === 'address' ? 'View on BSCScan' : 'View Transaction';
      case 'compact':
        return type === 'address' 
          ? `${address?.substring(0, 6)}...` 
          : `TX: ${txHash?.substring(0, 8)}...`;
      default:
        return '👁️';
    }
  };

  const getTooltipText = () => {
    const networkName = currentNetwork.chainId === 56 ? 'BSC Mainnet' : 'BSC Testnet';
    const formattedValue = type === 'address' && address
      ? bscScan.formatLinkText('address', address)
      : bscScan.formatLinkText('transaction', txHash || '');
    
    return `View ${formattedValue} on ${networkName} BSCScan`;
  };

  const buttonClasses = [
    'bscscan-btn',
    variant,
    className,
    disabled ? 'disabled' : '',
    type
  ].filter(Boolean).join(' ');

  return (
    <button
      className={buttonClasses}
      onClick={handleClick}
      disabled={disabled}
      title={getTooltipText()}
      type="button"
    >
      {getButtonContent()}
    </button>
  );
};

// CSS styles for the BSCScan button
export const bscScanButtonStyles = `
.bscscan-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 8px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: linear-gradient(135deg, #f7c41f 0%, #fccc5c 100%);
  color: #2d3748;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  text-decoration: none;
  min-width: 24px;
  height: 24px;
}

.bscscan-btn.icon {
  padding: 4px;
  font-size: 14px;
}

.bscscan-btn.text {
  padding: 6px 12px;
  font-size: 12px;
  min-width: auto;
  height: auto;
}

.bscscan-btn.compact {
  padding: 2px 6px;
  font-size: 10px;
  font-family: monospace;
  min-width: auto;
  height: auto;
}

.bscscan-btn:hover:not(.disabled) {
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(247, 196, 31, 0.3);
  background: linear-gradient(135deg, #fccc5c 0%, #f7c41f 100%);
}

.bscscan-btn:active:not(.disabled) {
  transform: translateY(0);
  box-shadow: 0 1px 2px rgba(247, 196, 31, 0.2);
}

.bscscan-btn.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: #e2e8f0;
  color: #a0aec0;
}

.bscscan-btn.transaction {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  color: white;
}

.bscscan-btn.transaction:hover:not(.disabled) {
  background: linear-gradient(135deg, #00f2fe 0%, #4facfe 100%);
  box-shadow: 0 2px 4px rgba(79, 172, 254, 0.3);
}

/* Integration with existing table styles */
.wallet-table .bscscan-btn {
  margin-left: 4px;
}

.address-cell .bscscan-btn {
  margin-left: 8px;
}

.transaction-cell .bscscan-btn {
  margin-left: 6px;
}
`;

export default BSCScanButton;