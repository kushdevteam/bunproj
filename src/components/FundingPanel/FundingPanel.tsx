/**
 * FundingPanel - Main funding management interface
 * Provides comprehensive BNB distribution and treasury management functionality
 */

import React, { useState, useEffect } from 'react';
import { useWalletStore } from '../../store/wallets';
import { useFundingStore } from '../../store/funding';
import { useTreasuryStore } from '../../store/treasury';
import { useSessionStore } from '../../store/session';
import { useNetworkStore } from '../../store/network';
import { BalanceDashboard } from './BalanceDashboard';
import { DistributionForm } from './DistributionForm';
import { TreasuryManager } from './TreasuryManager';
import { OperationPreview } from './OperationPreview';
import { ProgressTracker } from './ProgressTracker';
import { BulkFaucet } from '../BulkFaucet';
import { StealthFunding } from '../StealthFunding';
import type { DistributionMethod, FundingOperation, TreasuryOperation } from '../../types';
import './FundingPanel.css';

interface TabConfig {
  id: string;
  label: string;
  icon: string;
  badge?: string | number;
}

export const FundingPanel: React.FC = () => {
  // Store state
  const { wallets, selectedWallets, updateAllBalances, balanceUpdateInProgress } = useWalletStore();
  const { 
    currentOperation: fundingOperation, 
    isExecuting: isFundingExecuting,
    error: fundingError,
    clearError: clearFundingError
  } = useFundingStore();
  const { 
    currentOperation: treasuryOperation,
    isExecuting: isTreasuryExecuting,
    error: treasuryError,
    clearError: clearTreasuryError
  } = useTreasuryStore();
  const { isUnlocked } = useSessionStore();
  const { isMainnet, currentNetwork } = useNetworkStore();

  // Local state
  const [activeTab, setActiveTab] = useState<'overview' | 'distribution' | 'stealth' | 'treasury' | 'history'>('overview');
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [previewOperation, setPreviewOperation] = useState<FundingOperation | TreasuryOperation | null>(null);

  // Calculate dashboard statistics
  const stats = React.useMemo(() => {
    const totalBalance = wallets.reduce((sum, wallet) => sum + wallet.balance, 0);
    const selectedBalance = wallets
      .filter(wallet => selectedWallets.includes(wallet.id))
      .reduce((sum, wallet) => sum + wallet.balance, 0);
    const avgBalance = wallets.length > 0 ? totalBalance / wallets.length : 0;
    const zeroBalanceCount = wallets.filter(wallet => wallet.balance === 0).length;
    
    return {
      totalBalance,
      selectedBalance,
      avgBalance,
      zeroBalanceCount,
      totalWallets: wallets.length,
      selectedWallets: selectedWallets.length,
    };
  }, [wallets, selectedWallets]);

  // Tab configuration
  const tabs: TabConfig[] = [
    {
      id: 'overview',
      label: 'Overview',
      icon: 'fas fa-chart-pie',
      badge: stats.totalWallets,
    },
    {
      id: 'distribution',
      label: 'Distribution',
      icon: 'fas fa-share-alt',
      badge: selectedWallets.length > 0 ? selectedWallets.length : undefined,
    },
    {
      id: 'stealth',
      label: 'Stealth Funding',
      icon: 'fas fa-user-secret',
      badge: selectedWallets.length > 0 ? `${selectedWallets.length} Ready` : undefined,
    },
    {
      id: 'treasury',
      label: 'Treasury',
      icon: 'fas fa-university',
      badge: stats.totalBalance > 0 ? stats.totalBalance.toFixed(2) : undefined,
    },
    {
      id: 'history',
      label: 'History',
      icon: 'fas fa-history',
    },
  ];

  // Auto-refresh balances
  useEffect(() => {
    const interval = setInterval(() => {
      if (isUnlocked && !balanceUpdateInProgress) {
        updateAllBalances();
      }
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [isUnlocked, balanceUpdateInProgress, updateAllBalances]);

  // Handle preview dialog
  const handleShowPreview = (operation: FundingOperation | TreasuryOperation) => {
    setPreviewOperation(operation);
    setShowPreviewDialog(true);
  };

  const handleClosePreview = () => {
    setShowPreviewDialog(false);
    setPreviewOperation(null);
  };

  // Handle errors
  const handleClearErrors = () => {
    clearFundingError();
    clearTreasuryError();
  };

  // Check if any operation is in progress
  const isOperationInProgress = isFundingExecuting || isTreasuryExecuting;
  const hasActiveOperation = fundingOperation?.status === 'executing' || treasuryOperation?.status === 'executing';

  // Session check
  if (!isUnlocked) {
    return (
      <div className="funding-panel-locked">
        <div className="lock-container">
          <div className="lock-icon">
            <i className="fas fa-lock"></i>
          </div>
          <h3>Session Locked</h3>
          <p>Please unlock your session to access funding operations.</p>
          <div className="security-note">
            <i className="fas fa-shield-alt"></i>
            <span>Funding operations require secure session authentication</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="funding-panel">
      {/* Header Section */}
      <div className="funding-panel-header">
        <div className="header-content">
          <h2 className="panel-title">
            <i className="fas fa-coins"></i>
            Funding Management
          </h2>
          <div className="header-actions">
            <button
              className="refresh-btn"
              onClick={() => updateAllBalances()}
              disabled={balanceUpdateInProgress}
            >
              <i className={`fas fa-sync-alt ${balanceUpdateInProgress ? 'fa-spin' : ''}`}></i>
              Refresh Balances
            </button>
            {(fundingError || treasuryError) && (
              <button className="clear-errors-btn" onClick={handleClearErrors}>
                <i className="fas fa-times"></i>
                Clear Errors
              </button>
            )}
          </div>
        </div>

        {/* Status Indicators */}
        <div className="status-indicators">
          <div className={`status-indicator ${isUnlocked ? 'unlocked' : 'locked'}`}>
            <i className={`fas ${isUnlocked ? 'fa-unlock' : 'fa-lock'}`}></i>
            <span>{isUnlocked ? 'Unlocked' : 'Locked'}</span>
          </div>
          {isOperationInProgress && (
            <div className="status-indicator executing">
              <i className="fas fa-spinner fa-spin"></i>
              <span>Operation in Progress</span>
            </div>
          )}
          {selectedWallets.length > 0 && (
            <div className="status-indicator selected">
              <i className="fas fa-check-circle"></i>
              <span>{selectedWallets.length} Selected</span>
            </div>
          )}
        </div>
      </div>

      {/* Error Display */}
      {(fundingError || treasuryError) && (
        <div className="error-banner">
          <div className="error-content">
            <i className="fas fa-exclamation-triangle"></i>
            <div className="error-messages">
              {fundingError && <p><strong>Funding Error:</strong> {fundingError}</p>}
              {treasuryError && <p><strong>Treasury Error:</strong> {treasuryError}</p>}
            </div>
            <button className="error-close" onClick={handleClearErrors}>
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="funding-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id as any)}
          >
            <i className={tab.icon}></i>
            <span>{tab.label}</span>
            {tab.badge && <span className="tab-badge">{tab.badge}</span>}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'overview' && (
          <div className="overview-tab">
            <BalanceDashboard />
            {hasActiveOperation && (
              <div className="active-operations">
                <h3>
                  <i className="fas fa-tasks"></i>
                  Active Operations
                </h3>
                <ProgressTracker />
              </div>
            )}
          </div>
        )}

        {activeTab === 'distribution' && (
          <div className="distribution-tab">
            <DistributionForm onShowPreview={handleShowPreview} />
            
            {!isMainnet && currentNetwork.chainId === 97 && (
              <div className="faucet-section">
                <BulkFaucet
                  onComplete={(result) => {
                    console.log('Bulk faucet completed:', result);
                    // Refresh balances after successful bulk operation
                    if (result.success && result.successfulWallets.length > 0) {
                      setTimeout(() => updateAllBalances(), 3000);
                    }
                  }}
                  onError={(error) => {
                    console.error('Bulk faucet error:', error);
                  }}
                />
              </div>
            )}
          </div>
        )}

        {activeTab === 'stealth' && (
          <div className="stealth-tab">
            <StealthFunding
              onOperationComplete={(result) => {
                console.log('Stealth funding completed:', result);
                // Refresh balances after successful stealth operation
                setTimeout(() => updateAllBalances(), 3000);
              }}
              onError={(error) => {
                console.error('Stealth funding error:', error);
              }}
            />
          </div>
        )}

        {activeTab === 'treasury' && (
          <div className="treasury-tab">
            <TreasuryManager onShowPreview={handleShowPreview} />
          </div>
        )}

        {activeTab === 'history' && (
          <div className="history-tab">
            <div className="history-content">
              <h3>
                <i className="fas fa-history"></i>
                Operation History
              </h3>
              <p className="coming-soon">
                Transaction history and analytics coming soon...
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Operation Preview Dialog */}
      {showPreviewDialog && previewOperation && (
        <OperationPreview
          operation={previewOperation}
          onClose={handleClosePreview}
          onConfirm={() => {
            // This will be handled by the specific operation components
            handleClosePreview();
          }}
        />
      )}

      {/* Global Progress Overlay */}
      {isOperationInProgress && (
        <div className="operation-overlay">
          <div className="operation-progress">
            <div className="progress-spinner">
              <i className="fas fa-spinner fa-spin"></i>
            </div>
            <h4>Operation in Progress</h4>
            <p>Please wait while we process your request...</p>
            <div className="progress-details">
              {fundingOperation && (
                <small>
                  Funding {fundingOperation.distributionPlan?.filter(p => p.requiresFunding).length || 0} wallets
                </small>
              )}
              {treasuryOperation && (
                <small>
                  {treasuryOperation.type === 'withdraw_emergency' ? 'Emergency withdrawal' : 'Treasury operation'} in progress
                </small>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};