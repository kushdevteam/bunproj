/**
 * OperationPreview - Transaction preview dialog component
 * Shows detailed preview of funding or treasury operations before execution
 */

import React, { useState, useMemo } from 'react';
import { useFundingStore } from '../../store/funding';
import { useTreasuryStore } from '../../store/treasury';
import { useSessionStore } from '../../store/session';
import { useWalletStore } from '../../store/wallets';
import type { FundingOperation, TreasuryOperation } from '../../types';

interface Props {
  operation: FundingOperation | TreasuryOperation;
  onClose: () => void;
  onConfirm: () => void;
}

// Type guard to check if operation is a funding operation
const isFundingOperation = (operation: FundingOperation | TreasuryOperation): operation is FundingOperation => {
  return 'distributionPlan' in operation;
};

export const OperationPreview: React.FC<Props> = ({ operation, onClose, onConfirm }) => {
  // Store state
  const { executeFundingOperation } = useFundingStore();
  const { executeTreasuryOperation } = useTreasuryStore();
  const { isUnlocked } = useSessionStore();
  const { wallets } = useWalletStore();

  // Local state
  const [passphrase, setPassphrase] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [showPassphraseInput, setShowPassphraseInput] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate operation details
  const operationDetails = useMemo(() => {
    if (isFundingOperation(operation)) {
      const totalAmount = operation.distributionPlan.reduce((sum, plan) => sum + plan.plannedAmount, 0);
      const walletsToFund = operation.distributionPlan.filter(plan => plan.requiresFunding);
      const avgAmount = walletsToFund.length > 0 ? totalAmount / walletsToFund.length : 0;

      return {
        type: 'funding',
        title: 'Funding Operation Preview',
        totalAmount,
        affectedWallets: walletsToFund.length,
        avgAmount,
        method: operation.method,
        transactions: walletsToFund,
        gasEstimate: operation.gasEstimate,
        estimatedCost: operation.estimatedCost,
      };
    } else {
      const totalWithdrawal = Object.values(operation.withdrawalAmounts).reduce((sum, amount) => sum + amount, 0);
      const affectedWallets = Object.keys(operation.withdrawalAmounts).filter(walletId => operation.withdrawalAmounts[walletId] > 0);

      return {
        type: 'treasury',
        title: 'Treasury Operation Preview',
        totalAmount: totalWithdrawal,
        affectedWallets: affectedWallets.length,
        avgAmount: affectedWallets.length > 0 ? totalWithdrawal / affectedWallets.length : 0,
        operationType: operation.type,
        treasuryAddress: operation.treasuryAddress,
        withdrawalAmounts: operation.withdrawalAmounts,
        gasEstimate: operation.gasEstimate,
        estimatedCost: operation.estimatedCost,
      };
    }
  }, [operation]);

  // Handle confirmation
  const handleConfirm = async () => {
    if (!isUnlocked) {
      setError('Session must be unlocked to execute operations');
      return;
    }

    // For large operations or treasury operations, require passphrase
    const requiresPassphrase = 
      operationDetails.totalAmount > 1.0 || 
      (operationDetails.type === 'treasury' && operationDetails.operationType !== 'withdraw_partial') ||
      operationDetails.affectedWallets > 10;

    if (requiresPassphrase && !showPassphraseInput) {
      setShowPassphraseInput(true);
      return;
    }

    if (requiresPassphrase && !passphrase) {
      setError('Passphrase is required for this operation');
      return;
    }

    try {
      setIsExecuting(true);
      setError(null);

      if (operationDetails.type === 'funding') {
        await executeFundingOperation(operation.id, passphrase || '');
      } else {
        await executeTreasuryOperation(operation.id, passphrase || '');
      }

      onConfirm();
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Operation failed');
      setIsExecuting(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    setPassphrase('');
    setShowPassphraseInput(false);
    setError(null);
    onClose();
  };

  // Format balance display
  const formatBalance = (balance: number): string => {
    if (balance < 0.001) return balance.toFixed(6);
    if (balance < 1) return balance.toFixed(4);
    return balance.toFixed(2);
  };

  // Get operation risk level
  const getRiskLevel = (): 'low' | 'medium' | 'high' => {
    if (operationDetails.type === 'treasury') {
      if (operationDetails.operationType === 'withdraw_emergency') return 'high';
      if (operationDetails.totalAmount > 10) return 'high';
      if (operationDetails.totalAmount > 1) return 'medium';
    } else {
      if (operationDetails.totalAmount > 10) return 'high';
      if (operationDetails.totalAmount > 1 || operationDetails.affectedWallets > 20) return 'medium';
    }
    return 'low';
  };

  const riskLevel = getRiskLevel();

  return (
    <div className="operation-preview-overlay">
      <div className={`operation-preview-dialog ${riskLevel}-risk`}>
        {/* Header */}
        <div className="preview-header">
          <h3>
            <i className={`fas ${operationDetails.type === 'funding' ? 'fa-coins' : 'fa-university'}`}></i>
            {operationDetails.title}
          </h3>
          <button className="close-btn" onClick={handleCancel}>
            <i className="fas fa-times"></i>
          </button>
        </div>

        {/* Risk Warning */}
        {riskLevel !== 'low' && (
          <div className={`risk-warning ${riskLevel}-risk`}>
            <i className="fas fa-exclamation-triangle"></i>
            <div>
              <strong>{riskLevel.toUpperCase()} RISK OPERATION</strong>
              <p>
                {riskLevel === 'high' 
                  ? 'This operation involves large amounts or critical functions. Please review carefully.'
                  : 'This operation requires attention. Please verify all details before proceeding.'
                }
              </p>
            </div>
          </div>
        )}

        {/* Operation Summary */}
        <div className="operation-summary">
          <div className="summary-grid">
            <div className="summary-item">
              <div className="item-label">
                {operationDetails.type === 'funding' ? 'Total Distribution' : 'Total Withdrawal'}
              </div>
              <div className="item-value">
                {operationDetails.type === 'funding' ? '+' : '-'}{formatBalance(operationDetails.totalAmount)} BNB
              </div>
            </div>

            <div className="summary-item">
              <div className="item-label">Affected Wallets</div>
              <div className="item-value">{operationDetails.affectedWallets}</div>
            </div>

            <div className="summary-item">
              <div className="item-label">Average per Wallet</div>
              <div className="item-value">{formatBalance(operationDetails.avgAmount)} BNB</div>
            </div>

            <div className="summary-item">
              <div className="item-label">Estimated Gas Cost</div>
              <div className="item-value">{formatBalance(operationDetails.estimatedCost)} BNB</div>
            </div>
          </div>

          {operationDetails.type === 'funding' && (
            <div className="operation-details">
              <p><strong>Method:</strong> {operationDetails.method ? (operationDetails.method.charAt(0).toUpperCase() + operationDetails.method.slice(1)) : 'Unknown'}</p>
            </div>
          )}

          {operationDetails.type === 'treasury' && (
            <div className="operation-details">
              <p><strong>Operation Type:</strong> {operationDetails.operationType?.replace('withdraw_', '').replace('_', ' ').toUpperCase() || 'Unknown'}</p>
              <p><strong>Treasury Address:</strong> {operationDetails.treasuryAddress || 'Not specified'}</p>
            </div>
          )}
        </div>

        {/* Transaction List */}
        <div className="transaction-list">
          <h4>
            <i className="fas fa-list"></i>
            {operationDetails.type === 'funding' ? 'Funding Transactions' : 'Withdrawal Transactions'}
            ({operationDetails.affectedWallets})
          </h4>
          <div className="transaction-items">
            {operationDetails.type === 'funding' && isFundingOperation(operation) && 
              operation.distributionPlan.filter(plan => plan.requiresFunding).slice(0, 10).map((plan) => (
                <div key={plan.walletId} className="transaction-item">
                  <div className="wallet-info">
                    <span className="address">{plan.address.slice(0, 6)}...{plan.address.slice(-4)}</span>
                    <span className="role">{plan.role.toUpperCase()}</span>
                  </div>
                  <div className="amount-change">
                    <span className="current">{formatBalance(plan.currentBalance)} BNB</span>
                    <i className="fas fa-arrow-right"></i>
                    <span className="final">{formatBalance(plan.finalBalance)} BNB</span>
                    <span className="change">+{formatBalance(plan.plannedAmount)}</span>
                  </div>
                </div>
              ))
            }
            
            {operationDetails.type === 'treasury' && !isFundingOperation(operation) &&
              Object.entries(operationDetails.withdrawalAmounts || {}).slice(0, 10).map(([walletId, amount]) => {
                const wallet = wallets.find(w => w.id === walletId);
                if (!wallet || amount <= 0) return null;
                
                return (
                  <div key={walletId} className="transaction-item">
                    <div className="wallet-info">
                      <span className="address">{wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}</span>
                      <span className="role">{wallet.role.toUpperCase()}</span>
                    </div>
                    <div className="amount-change">
                      <span className="current">{formatBalance(wallet.balance)} BNB</span>
                      <i className="fas fa-arrow-right"></i>
                      <span className="final">{formatBalance(Math.max(0, wallet.balance - amount))} BNB</span>
                      <span className="change withdrawal">-{formatBalance(amount)}</span>
                    </div>
                  </div>
                );
              })
            }
            
            {operationDetails.affectedWallets > 10 && (
              <div className="transaction-more">
                +{operationDetails.affectedWallets - 10} more transactions
              </div>
            )}
          </div>
        </div>

        {/* Passphrase Input */}
        {showPassphraseInput && (
          <div className="passphrase-section">
            <h4>
              <i className="fas fa-key"></i>
              Security Confirmation Required
            </h4>
            <p>Please enter your passphrase to authorize this {riskLevel}-risk operation:</p>
            <input
              type="password"
              className="passphrase-input"
              placeholder="Enter your passphrase"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleConfirm()}
              autoFocus
            />
            {error && (
              <div className="error-message">
                <i className="fas fa-exclamation-triangle"></i>
                {error}
              </div>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="preview-footer">
          <div className="footer-info">
            <small>
              <i className="fas fa-info-circle"></i>
              This operation will be executed immediately and cannot be undone
            </small>
          </div>
          
          <div className="footer-actions">
            <button
              className="btn btn-secondary"
              onClick={handleCancel}
              disabled={isExecuting}
            >
              <i className="fas fa-times"></i>
              Cancel
            </button>
            
            <button
              className={`btn ${riskLevel === 'high' ? 'btn-danger' : 'btn-primary'}`}
              onClick={handleConfirm}
              disabled={isExecuting || !isUnlocked}
            >
              {isExecuting ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i>
                  Executing...
                </>
              ) : showPassphraseInput ? (
                <>
                  <i className="fas fa-check"></i>
                  Confirm & Execute
                </>
              ) : (
                <>
                  <i className={`fas ${operationDetails.type === 'funding' ? 'fa-coins' : 'fa-university'}`}></i>
                  {riskLevel === 'high' ? 'Execute High-Risk Operation' : 'Execute Operation'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};