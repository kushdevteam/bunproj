/**
 * Transaction Queue Component  
 * Queue management and monitoring interface for bundle execution
 */

import React, { useState, useMemo } from 'react';
import type { EnhancedTransaction, TransactionQueue as ITransactionQueue } from '../../store/transactions';
import { TransactionRow } from './TransactionRow';

interface TransactionQueueProps {
  transactions: EnhancedTransaction[];
  queue: ITransactionQueue;
  onRetryTransaction: (txId: string) => void;
  onCancelTransaction: (txId: string) => void;
}

export const TransactionQueue: React.FC<TransactionQueueProps> = ({
  transactions,
  queue,
  onRetryTransaction,
  onCancelTransaction,
}) => {
  const [filter, setFilter] = useState<'all' | 'queued' | 'pending' | 'confirmed' | 'failed'>('all');
  const [sortBy, setSortBy] = useState<'time' | 'status' | 'priority'>('time');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const filteredAndSortedTransactions = useMemo(() => {
    let filtered = transactions;

    // Apply status filter
    if (filter !== 'all') {
      filtered = transactions.filter(tx => tx.status === filter);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'time':
          comparison = new Date(a.queuedAt).getTime() - new Date(b.queuedAt).getTime();
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'priority':
          const priorityOrder = { critical: 4, high: 3, normal: 2, low: 1 };
          comparison = priorityOrder[a.priority] - priorityOrder[b.priority];
          break;
        default:
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [transactions, filter, sortBy, sortOrder]);

  const getQueueStats = () => {
    const stats = {
      total: transactions.length,
      queued: transactions.filter(tx => tx.status === 'queued').length,
      pending: transactions.filter(tx => tx.status === 'pending').length,
      confirmed: transactions.filter(tx => tx.status === 'confirmed').length,
      failed: transactions.filter(tx => tx.status === 'failed').length,
    };
    return stats;
  };

  const stats = getQueueStats();

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return '#f44336';
      case 'high': return '#ff9800';
      case 'normal': return '#2196f3';
      case 'low': return '#4caf50';
      default: return '#9e9e9e';
    }
  };

  return (
    <div className="transaction-queue">
      {/* Queue Header */}
      <div className="queue-header">
        <div className="queue-stats">
          <div className="stat-item">
            <span className="stat-label">Total</span>
            <span className="stat-value">{stats.total}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Queued</span>
            <span className="stat-value queued">{stats.queued}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Pending</span>
            <span className="stat-value pending">{stats.pending}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Confirmed</span>
            <span className="stat-value confirmed">{stats.confirmed}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Failed</span>
            <span className="stat-value failed">{stats.failed}</span>
          </div>
        </div>

        <div className="queue-controls">
          <div className="control-group">
            <label>Filter:</label>
            <select value={filter} onChange={(e) => setFilter(e.target.value as any)}>
              <option value="all">All Transactions</option>
              <option value="queued">Queued</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          <div className="control-group">
            <label>Sort by:</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
              <option value="time">Time</option>
              <option value="status">Status</option>
              <option value="priority">Priority</option>
            </select>
          </div>

          <div className="control-group">
            <label>Order:</label>
            <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value as any)}>
              <option value="desc">Newest First</option>
              <option value="asc">Oldest First</option>
            </select>
          </div>
        </div>
      </div>

      {/* Queue Status */}
      {queue.isPaused && (
        <div className="queue-status paused">
          <div className="status-icon">⏸️</div>
          <div className="status-message">
            <span className="status-title">Queue Paused</span>
            <span className="status-description">Transaction processing is temporarily stopped</span>
          </div>
        </div>
      )}

      {queue.activeTransactions.length > 0 && (
        <div className="queue-status active">
          <div className="status-icon">⚡</div>
          <div className="status-message">
            <span className="status-title">Processing {queue.activeTransactions.length} transactions</span>
            <span className="status-description">
              Current position: {queue.currentIndex + 1} of {queue.transactions.length}
            </span>
          </div>
        </div>
      )}

      {/* Transaction List */}
      <div className="transaction-list">
        {filteredAndSortedTransactions.length === 0 ? (
          <div className="empty-queue">
            <div className="empty-icon">📝</div>
            <div className="empty-message">
              <span className="empty-title">No transactions found</span>
              <span className="empty-description">
                {filter === 'all' ? 'The queue is currently empty' : `No ${filter} transactions`}
              </span>
            </div>
          </div>
        ) : (
          <div className="transaction-rows">
            {filteredAndSortedTransactions.map((transaction, index) => (
              <TransactionRow
                key={transaction.id}
                transaction={transaction}
                index={index}
                isInQueue={queue.transactions.includes(transaction.id)}
                isActive={queue.activeTransactions.includes(transaction.id)}
                queuePosition={queue.transactions.indexOf(transaction.id) + 1}
                onRetry={() => onRetryTransaction(transaction.id)}
                onCancel={() => onCancelTransaction(transaction.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Queue Progress */}
      {queue.transactions.length > 0 && (
        <div className="queue-progress">
          <div className="progress-header">
            <span className="progress-label">Queue Progress</span>
            <span className="progress-fraction">
              {queue.currentIndex} / {queue.transactions.length}
            </span>
          </div>
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ 
                width: `${(queue.currentIndex / queue.transactions.length) * 100}%` 
              }}
            ></div>
          </div>
          <div className="progress-details">
            <span>Concurrent Limit: {queue.concurrentLimit}</span>
            <span>Active: {queue.activeTransactions.length}</span>
          </div>
        </div>
      )}
    </div>
  );
};