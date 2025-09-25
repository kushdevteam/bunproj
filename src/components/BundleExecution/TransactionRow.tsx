/**
 * Transaction Row Component
 * Individual transaction status display with detailed information and actions
 */

import React, { useState } from 'react';
import { BSCScanButton } from '../BSCScanButton';
import type { EnhancedTransaction } from '../../store/transactions';

interface TransactionRowProps {
  transaction: EnhancedTransaction;
  index: number;
  isInQueue: boolean;
  isActive: boolean;
  queuePosition: number;
  onRetry: () => void;
  onCancel: () => void;
}

export const TransactionRow: React.FC<TransactionRowProps> = ({
  transaction,
  index,
  isInQueue,
  isActive,
  queuePosition,
  onRetry,
  onCancel,
}) => {
  const [expanded, setExpanded] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'queued': return '#9e9e9e';
      case 'pending': return '#ff9800';
      case 'submitted': return '#2196f3';
      case 'confirming': return '#03a9f4';
      case 'confirmed': return '#4caf50';
      case 'failed': return '#f44336';
      case 'cancelled': return '#607d8b';
      default: return '#9e9e9e';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return '#f44336';
      case 'high': return '#ff9800';
      case 'normal': return '#2196f3';
      case 'low': return '#4caf50';
      default: return '#9e9e9e';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'buy': return '🟢';
      case 'sell': return '🔴';
      case 'approve': return '✅';
      case 'transfer': return '↔️';
      case 'funding': return '💰';
      default: return '📝';
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDuration = (startTime: string, endTime?: string) => {
    const start = new Date(startTime).getTime();
    const end = endTime ? new Date(endTime).getTime() : Date.now();
    const duration = end - start;
    
    if (duration < 1000) return `${duration}ms`;
    if (duration < 60000) return `${Math.round(duration / 1000)}s`;
    return `${Math.round(duration / 60000)}m`;
  };

  const canRetry = transaction.status === 'failed' && transaction.retryCount < transaction.maxRetries;
  const canCancel = ['queued', 'pending'].includes(transaction.status);

  return (
    <div className={`transaction-row ${expanded ? 'expanded' : ''} ${isActive ? 'active' : ''}`}>
      <div className="transaction-main" onClick={() => setExpanded(!expanded)}>
        {/* Queue Position */}
        {isInQueue && (
          <div className="queue-position">
            #{queuePosition}
          </div>
        )}

        {/* Transaction Type Icon */}
        <div className="transaction-icon">
          {getTypeIcon(transaction.type)}
        </div>

        {/* Basic Information */}
        <div className="transaction-basic">
          <div className="transaction-id">
            <span className="id-label">TX:</span>
            <span className="id-value">{transaction.id.substring(0, 8)}...</span>
          </div>
          <div className="transaction-type">
            {transaction.type.toUpperCase()}
          </div>
        </div>

        {/* Status */}
        <div className="transaction-status">
          <div 
            className="status-indicator" 
            style={{ backgroundColor: getStatusColor(transaction.status) }}
          ></div>
          <span className="status-text">{transaction.status}</span>
          {transaction.confirmations > 0 && (
            <span className="confirmations">
              {transaction.confirmations}/{transaction.requiredConfirmations}
            </span>
          )}
        </div>

        {/* Priority */}
        <div className="transaction-priority">
          <div 
            className="priority-dot" 
            style={{ backgroundColor: getPriorityColor(transaction.priority) }}
          ></div>
          <span className="priority-text">{transaction.priority}</span>
        </div>

        {/* Value */}
        <div className="transaction-value">
          {parseFloat(transaction.value).toFixed(4)} BNB
        </div>

        {/* Gas */}
        <div className="transaction-gas">
          {transaction.gasUsedActual || transaction.gasLimit} gas
        </div>

        {/* Timing */}
        <div className="transaction-timing">
          <div className="queued-time">{formatTime(transaction.queuedAt)}</div>
          {transaction.submittedAt && (
            <div className="duration">
              {formatDuration(transaction.queuedAt, transaction.submittedAt)}
            </div>
          )}
        </div>

        {/* Expand Icon */}
        <div className="expand-icon">
          {expanded ? '▼' : '▶'}
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="transaction-details">
          <div className="details-grid">
            {/* Transaction Details */}
            <div className="detail-section">
              <h4>Transaction Details</h4>
              <div className="detail-rows">
                <div className="detail-row">
                  <span className="detail-label">Hash:</span>
                  <span className="detail-value monospace">
                    {transaction.hash ? transaction.hash.substring(0, 20) + '...' : 'Pending'}
                    {transaction.hash && (
                      <BSCScanButton
                        txHash={transaction.hash}
                        type="transaction"
                        variant="icon"
                        className="detail-bscscan-btn"
                      />
                    )}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">From:</span>
                  <span className="detail-value monospace">
                    {transaction.from.substring(0, 10)}...{transaction.from.slice(-8)}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">To:</span>
                  <span className="detail-value monospace">
                    {transaction.to.substring(0, 10)}...{transaction.to.slice(-8)}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Nonce:</span>
                  <span className="detail-value">{transaction.nonce || 'TBD'}</span>
                </div>
              </div>
            </div>

            {/* Gas Details */}
            <div className="detail-section">
              <h4>Gas Information</h4>
              <div className="detail-rows">
                <div className="detail-row">
                  <span className="detail-label">Gas Limit:</span>
                  <span className="detail-value">{transaction.gasLimit}</span>
                </div>
                {transaction.maxFeePerGas && (
                  <div className="detail-row">
                    <span className="detail-label">Max Fee:</span>
                    <span className="detail-value">{transaction.maxFeePerGas} gwei</span>
                  </div>
                )}
                {transaction.effectiveGasPrice && (
                  <div className="detail-row">
                    <span className="detail-label">Effective Price:</span>
                    <span className="detail-value">{transaction.effectiveGasPrice} gwei</span>
                  </div>
                )}
                {transaction.gasUsedActual && (
                  <div className="detail-row">
                    <span className="detail-label">Gas Used:</span>
                    <span className="detail-value">{transaction.gasUsedActual}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Timing Details */}
            <div className="detail-section">
              <h4>Timing Information</h4>
              <div className="detail-rows">
                <div className="detail-row">
                  <span className="detail-label">Queued:</span>
                  <span className="detail-value">{formatTime(transaction.queuedAt)}</span>
                </div>
                {transaction.submittedAt && (
                  <div className="detail-row">
                    <span className="detail-label">Submitted:</span>
                    <span className="detail-value">{formatTime(transaction.submittedAt)}</span>
                  </div>
                )}
                {transaction.confirmedAt && (
                  <div className="detail-row">
                    <span className="detail-label">Confirmed:</span>
                    <span className="detail-value">{formatTime(transaction.confirmedAt)}</span>
                  </div>
                )}
                {transaction.staggerDelay && (
                  <div className="detail-row">
                    <span className="detail-label">Stagger Delay:</span>
                    <span className="detail-value">{transaction.staggerDelay}ms</span>
                  </div>
                )}
              </div>
            </div>

            {/* Error Information */}
            {transaction.error && (
              <div className="detail-section error-section">
                <h4>Error Information</h4>
                <div className="error-message">
                  {transaction.error}
                </div>
                <div className="retry-info">
                  Retry {transaction.retryCount} of {transaction.maxRetries}
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="transaction-actions">
            {canRetry && (
              <button onClick={onRetry} className="action-button retry-button">
                🔄 Retry Transaction
              </button>
            )}
            {canCancel && (
              <button onClick={onCancel} className="action-button cancel-button">
                ❌ Cancel Transaction
              </button>
            )}
            {transaction.hash && (
              <BSCScanButton
                txHash={transaction.hash}
                type="transaction"
                variant="text"
                customText="🔍 View on BSCScan"
                className="action-button explorer-button"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};