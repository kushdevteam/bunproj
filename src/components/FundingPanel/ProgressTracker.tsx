/**
 * ProgressTracker - Real-time operation status component
 * Shows live progress of funding and treasury operations
 */

import React, { useMemo } from 'react';
import { useFundingStore } from '../../store/funding';
import { useTreasuryStore } from '../../store/treasury';

// Transaction status type
type TransactionStatus = 'pending' | 'confirmed' | 'failed';

// Combined transaction interface for display
interface DisplayTransaction {
  id: string;
  walletAddress: string;
  amount: number;
  status: TransactionStatus;
  txHash?: string;
  error?: string;
  timestamp: string;
  type: 'funding' | 'treasury';
}

export const ProgressTracker: React.FC = () => {
  // Store state
  const { 
    currentOperation: fundingOperation,
    isExecuting: isFundingExecuting,
    cancelOperation: cancelFundingOperation
  } = useFundingStore();
  
  const {
    currentOperation: treasuryOperation,
    isExecuting: isTreasuryExecuting,
    cancelTreasuryOperation
  } = useTreasuryStore();

  // Real-time updates happen through store state changes
  // No need for manual timers as the store updates trigger re-renders

  // Combine transactions from both operations
  const allTransactions: DisplayTransaction[] = useMemo(() => {
    const transactions: DisplayTransaction[] = [];

    // Add funding transactions
    if (fundingOperation && fundingOperation.transactions) {
      fundingOperation.transactions.forEach(tx => {
        transactions.push({
          ...tx,
          type: 'funding',
        });
      });
    }

    // Add treasury transactions
    if (treasuryOperation && treasuryOperation.transactions) {
      treasuryOperation.transactions.forEach(tx => {
        transactions.push({
          ...tx,
          type: 'treasury',
        });
      });
    }

    // Sort by timestamp (newest first)
    return transactions.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [fundingOperation, treasuryOperation]);

  // Calculate progress statistics
  const progressStats = useMemo(() => {
    const currentOp = fundingOperation || treasuryOperation;
    if (!currentOp) return null;

    const transactions = allTransactions;
    const totalTransactions = transactions.length;
    const completedTransactions = transactions.filter(tx => tx.status === 'confirmed').length;
    const failedTransactions = transactions.filter(tx => tx.status === 'failed').length;
    const pendingTransactions = transactions.filter(tx => tx.status === 'pending').length;

    const progressPercentage = totalTransactions > 0 
      ? ((completedTransactions + failedTransactions) / totalTransactions) * 100 
      : 0;

    const operationType = 'distributionPlan' in currentOp ? 'funding' : 'treasury';
    const operationTitle = operationType === 'funding' 
      ? `${(currentOp as any).method} distribution`
      : `${(currentOp as any).type.replace('withdraw_', '')} withdrawal`;

    return {
      operationType,
      operationTitle,
      totalTransactions,
      completedTransactions,
      failedTransactions,
      pendingTransactions,
      progressPercentage,
      status: currentOp.status,
      startedAt: currentOp.startedAt,
      estimatedCompletion: currentOp.startedAt 
        ? new Date(new Date(currentOp.startedAt).getTime() + (totalTransactions * 2000)).toISOString()
        : null,
    };
  }, [fundingOperation, treasuryOperation, allTransactions]);

  // Handle operation cancellation
  const handleCancelOperation = () => {
    const confirmMessage = 'Are you sure you want to cancel the ongoing operation? Completed transactions cannot be reversed.';
    if (!window.confirm(confirmMessage)) return;

    if (fundingOperation) {
      cancelFundingOperation(fundingOperation.id);
    }
    if (treasuryOperation) {
      cancelTreasuryOperation(treasuryOperation.id);
    }
  };

  // Format time display
  const formatTimeAgo = (timestamp: string): string => {
    const diff = Date.now() - new Date(timestamp).getTime();
    const seconds = Math.floor(diff / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  // Format balance
  const formatBalance = (balance: number): string => {
    if (balance < 0.001) return balance.toFixed(6);
    if (balance < 1) return balance.toFixed(4);
    return balance.toFixed(2);
  };

  // Get status icon
  const getStatusIcon = (status: TransactionStatus): string => {
    switch (status) {
      case 'pending':
        return 'fas fa-spinner fa-spin';
      case 'confirmed':
        return 'fas fa-check-circle';
      case 'failed':
        return 'fas fa-times-circle';
      default:
        return 'fas fa-question-circle';
    }
  };

  // Get status color class
  const getStatusColorClass = (status: TransactionStatus): string => {
    switch (status) {
      case 'pending':
        return 'status-pending';
      case 'confirmed':
        return 'status-confirmed';
      case 'failed':
        return 'status-failed';
      default:
        return 'status-unknown';
    }
  };

  // Show nothing if no operations are active
  if (!progressStats || (!isFundingExecuting && !isTreasuryExecuting)) {
    return null;
  }

  return (
    <div className="progress-tracker">
      {/* Header */}
      <div className="tracker-header">
        <div className="header-info">
          <h4>
            <i className={`fas ${progressStats.operationType === 'funding' ? 'fa-coins' : 'fa-university'}`}></i>
            {progressStats.operationTitle}
          </h4>
          <div className="operation-status">
            <span className={`status-badge ${progressStats.status}`}>
              {progressStats.status.toUpperCase()}
            </span>
            {progressStats.startedAt && (
              <span className="started-time">
                Started {formatTimeAgo(progressStats.startedAt)}
              </span>
            )}
          </div>
        </div>
        
        <div className="header-actions">
          <button
            className="cancel-btn"
            onClick={handleCancelOperation}
            disabled={progressStats.status !== 'executing'}
            title="Cancel operation"
          >
            <i className="fas fa-stop"></i>
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="progress-section">
        <div className="progress-info">
          <div className="progress-stats">
            <span className="stat">
              <i className="fas fa-tasks"></i>
              {progressStats.completedTransactions + progressStats.failedTransactions} / {progressStats.totalTransactions} completed
            </span>
            {progressStats.failedTransactions > 0 && (
              <span className="stat failed">
                <i className="fas fa-exclamation-triangle"></i>
                {progressStats.failedTransactions} failed
              </span>
            )}
            <span className="stat">
              {progressStats.progressPercentage.toFixed(0)}%
            </span>
          </div>
        </div>
        
        <div className="progress-bar">
          <div 
            className="progress-fill"
            style={{ width: `${progressStats.progressPercentage}%` }}
          >
            <div className="progress-shine"></div>
          </div>
        </div>
        
        {progressStats.estimatedCompletion && progressStats.progressPercentage < 100 && (
          <div className="estimated-completion">
            <small>
              <i className="fas fa-clock"></i>
              Est. completion: {new Date(progressStats.estimatedCompletion).toLocaleTimeString()}
            </small>
          </div>
        )}
      </div>

      {/* Transaction List */}
      <div className="transaction-progress-list">
        <div className="list-header">
          <h5>
            <i className="fas fa-list"></i>
            Recent Transactions
          </h5>
          <div className="status-legend">
            <span className="legend-item pending">
              <i className="fas fa-spinner fa-spin"></i>
              Pending
            </span>
            <span className="legend-item confirmed">
              <i className="fas fa-check-circle"></i>
              Confirmed
            </span>
            <span className="legend-item failed">
              <i className="fas fa-times-circle"></i>
              Failed
            </span>
          </div>
        </div>

        <div className="transaction-items">
          {allTransactions.slice(0, 8).map((transaction) => (
            <div
              key={transaction.id}
              className={`transaction-progress-item ${getStatusColorClass(transaction.status)}`}
            >
              <div className="transaction-status">
                <i className={getStatusIcon(transaction.status)}></i>
              </div>
              
              <div className="transaction-details">
                <div className="transaction-primary">
                  <span className="wallet-address">
                    {transaction.walletAddress.slice(0, 6)}...{transaction.walletAddress.slice(-4)}
                  </span>
                  <span className={`amount ${transaction.type === 'treasury' ? 'withdrawal' : 'funding'}`}>
                    {transaction.type === 'treasury' ? '-' : '+'}{formatBalance(transaction.amount)} BNB
                  </span>
                </div>
                
                <div className="transaction-secondary">
                  <span className="transaction-time">
                    {formatTimeAgo(transaction.timestamp)}
                  </span>
                  
                  {transaction.txHash && (
                    <span className="tx-hash">
                      <i className="fas fa-external-link-alt"></i>
                      {transaction.txHash.slice(0, 10)}...
                    </span>
                  )}
                  
                  {transaction.error && (
                    <span className="error-indicator" title={transaction.error}>
                      <i className="fas fa-exclamation-triangle"></i>
                      Error
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          {allTransactions.length === 0 && (
            <div className="no-transactions">
              <i className="fas fa-hourglass-half"></i>
              <span>Preparing transactions...</span>
            </div>
          )}
          
          {allTransactions.length > 8 && (
            <div className="transaction-more">
              <i className="fas fa-ellipsis-h"></i>
              +{allTransactions.length - 8} more transactions
            </div>
          )}
        </div>
      </div>

      {/* Operation Summary */}
      <div className="operation-summary">
        <div className="summary-stats">
          <div className="stat-item">
            <span className="stat-label">Total Amount:</span>
            <span className="stat-value">
              {progressStats.operationType === 'treasury' ? '-' : '+'}
              {formatBalance(allTransactions.reduce((sum, tx) => sum + tx.amount, 0))} BNB
            </span>
          </div>
          
          <div className="stat-item">
            <span className="stat-label">Success Rate:</span>
            <span className="stat-value">
              {progressStats.totalTransactions > 0 
                ? ((progressStats.completedTransactions / progressStats.totalTransactions) * 100).toFixed(1)
                : 0}%
            </span>
          </div>
          
          <div className="stat-item">
            <span className="stat-label">Est. Gas Cost:</span>
            <span className="stat-value">~0.001 BNB</span>
          </div>
        </div>
      </div>
    </div>
  );
};