/**
 * WalletTable Component
 * Main wallet management table with sorting, filtering, bulk selection, and all management operations
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useWalletStore } from '../../store/wallets';
import { useSessionStore } from '../../store/session';
import { useNetworkStore } from '../../store/network';
import { WalletRow } from './WalletRow';
import { GenerateWalletsDialog } from '../Dialogs/GenerateWalletsDialog';
import { ImportWalletsDialog } from '../Dialogs/ImportWalletsDialog';
import { ConfirmDialog } from '../Dialogs/ConfirmDialog';
import { ExportDialog } from './ExportDialog';
import type { Wallet, Role, ExportType } from '../../types';

type SortField = 'address' | 'role' | 'balance' | 'createdAt';
type SortDirection = 'asc' | 'desc';

interface TableFilters {
  search: string;
  role: Role | 'all';
  minBalance: number;
  maxBalance: number;
  showZeroBalance: boolean;
}

export const WalletTable: React.FC = () => {
  // Store state
  const {
    wallets,
    selectedWallets,
    isGenerating,
    error: walletError,
    selectWallet,
    deselectWallet,
    clearSelection,
    removeWallet,
    bulkSelectWallets,
    selectWalletsByRole,
    getWalletsByRole,
    updateAllBalances,
    balanceUpdateInProgress,
  } = useWalletStore();

  const { isUnlocked } = useSessionStore();
  const { isMainnet, currentNetwork } = useNetworkStore();

  // Local state
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [filters, setFilters] = useState<TableFilters>({
    search: '',
    role: 'all',
    minBalance: 0,
    maxBalance: Infinity,
    showZeroBalance: true,
  });
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  // Dialog state
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportType, setExportType] = useState<ExportType>('bulk');
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    isDangerous?: boolean;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    isDangerous: false,
  });

  // Filtered and sorted wallets
  const filteredAndSortedWallets = useMemo(() => {
    let filtered = wallets.filter(wallet => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesSearch = 
          wallet.address.toLowerCase().includes(searchLower) ||
          wallet.id.toLowerCase().includes(searchLower) ||
          wallet.role.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Role filter
      if (filters.role !== 'all' && wallet.role !== filters.role) {
        return false;
      }

      // Balance filters
      if (wallet.balance < filters.minBalance || wallet.balance > filters.maxBalance) {
        return false;
      }

      if (!filters.showZeroBalance && wallet.balance === 0) {
        return false;
      }

      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'address':
          aValue = a.address;
          bValue = b.address;
          break;
        case 'role':
          aValue = a.role;
          bValue = b.role;
          break;
        case 'balance':
          aValue = a.balance;
          bValue = b.balance;
          break;
        case 'createdAt':
          aValue = new Date(a.createdAt);
          bValue = new Date(b.createdAt);
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [wallets, filters, sortField, sortDirection]);

  // Table statistics
  const stats = useMemo(() => {
    const totalBalance = wallets.reduce((sum, wallet) => sum + wallet.balance, 0);
    const roleDistribution = wallets.reduce((acc, wallet) => {
      acc[wallet.role] = (acc[wallet.role] || 0) + 1;
      return acc;
    }, {} as Record<Role, number>);
    
    return {
      totalWallets: wallets.length,
      filteredWallets: filteredAndSortedWallets.length,
      selectedWallets: selectedWallets.length,
      totalBalance,
      roleDistribution,
      zeroBalanceCount: wallets.filter(w => w.balance === 0).length,
    };
  }, [wallets, filteredAndSortedWallets, selectedWallets]);

  // Handlers
  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }, [sortField]);

  const handleFilterChange = useCallback((newFilters: Partial<TableFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  const handleWalletSelect = useCallback((walletId: string, selected: boolean) => {
    if (selected) {
      selectWallet(walletId);
    } else {
      deselectWallet(walletId);
    }
  }, [selectWallet, deselectWallet]);

  const handleSelectAll = useCallback(() => {
    const allFilteredIds = filteredAndSortedWallets.map(w => w.id);
    bulkSelectWallets(allFilteredIds);
  }, [filteredAndSortedWallets, bulkSelectWallets]);

  const handleDeselectAll = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  const handleDeleteSelected = useCallback(() => {
    if (selectedWallets.length === 0) return;

    setConfirmDialog({
      isOpen: true,
      title: 'Delete Selected Wallets',
      message: `Are you sure you want to delete ${selectedWallets.length} wallet(s)? This will permanently remove them and their encrypted private keys.`,
      isDangerous: true,
      onConfirm: () => {
        selectedWallets.forEach(walletId => {
          removeWallet(walletId);
        });
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      },
    });
  }, [selectedWallets, removeWallet]);

  // Export handlers for ExportDialog
  const handleExportSelected = useCallback(() => {
    if (selectedWallets.length === 0) return;
    setExportType('bulk');
    setShowExportDialog(true);
  }, [selectedWallets]);

  const handleExportAll = useCallback(() => {
    setExportType('bulk');
    setShowExportDialog(true);
  }, []);

  const handleExportByRole = useCallback(() => {
    setExportType('by_role');
    setShowExportDialog(true);
  }, []);

  const getSortIcon = useCallback((field: SortField) => {
    if (sortField !== field) return '↕️';
    return sortDirection === 'asc' ? '↑' : '↓';
  }, [sortField, sortDirection]);

  // Faucet handlers
  const handleFaucetSuccess = useCallback((address: string, amount: number, txHash?: string) => {
    console.log(`Faucet success for ${address}: ${amount} BNB`);
    // Refresh balance for this specific wallet after a short delay
    setTimeout(() => {
      // This will trigger a balance update which will be handled by the wallet store
      updateAllBalances();
    }, 3000);
  }, [updateAllBalances]);

  const handleFaucetError = useCallback((address: string, error: string) => {
    console.error(`Faucet error for ${address}:`, error);
    // Error handling is managed by the FaucetButton component itself
  }, []);

  return (
    <div className="wallet-table-container">
      {/* Table Header Actions */}
      <div className="table-header">
        <div className="header-title">
          <h2>Wallet Manager</h2>
          <div className="wallet-stats">
            <span className="stat">
              <strong>{stats.totalWallets}</strong> wallets
            </span>
            <span className="stat">
              <strong>{stats.totalBalance.toFixed(4)}</strong> BNB total
            </span>
            {stats.selectedWallets > 0 && (
              <span className="stat selected">
                <strong>{stats.selectedWallets}</strong> selected
              </span>
            )}
          </div>
        </div>

        <div className="header-actions">
          <button
            className="btn-primary"
            onClick={() => setShowGenerateDialog(true)}
            disabled={!isUnlocked}
            title={!isUnlocked ? 'Unlock session to generate wallets' : 'Generate new wallets'}
          >
            ✨ Generate Wallets
          </button>
          
          <button
            className="btn-secondary"
            onClick={() => setShowImportDialog(true)}
            disabled={!isUnlocked}
            title={!isUnlocked ? 'Unlock session to import wallets' : 'Import existing wallets'}
          >
            📥 Import Wallets
          </button>

          <button
            className="btn-export"
            onClick={handleExportAll}
            disabled={wallets.length === 0}
            title={wallets.length === 0 ? 'No wallets to export' : 'Export all wallets'}
          >
            📤 Export All Wallets
          </button>

          <button
            className="btn-export-role"
            onClick={handleExportByRole}
            disabled={wallets.length === 0}
            title={wallets.length === 0 ? 'No wallets to export' : 'Export wallets by role'}
          >
            📋 Export by Role
          </button>

          <button
            className={`btn-selection ${isSelectionMode ? 'active' : ''}`}
            onClick={() => setIsSelectionMode(!isSelectionMode)}
          >
            {isSelectionMode ? '✓ Selection Mode' : '☐ Select'}
          </button>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="table-filters">
        <div className="search-section">
          <div className="search-input">
            <input
              type="text"
              placeholder="Search by address, ID, or role..."
              value={filters.search}
              onChange={(e) => handleFilterChange({ search: e.target.value })}
              className="filter-input"
            />
            <span className="search-icon">🔍</span>
          </div>
        </div>

        <div className="filter-section">
          <select
            value={filters.role}
            onChange={(e) => handleFilterChange({ role: e.target.value as Role | 'all' })}
            className="filter-select"
          >
            <option value="all">All Roles</option>
            <option value="dev">👨‍💻 Developer</option>
            <option value="mev">🤖 MEV Bot</option>
            <option value="funder">💰 Funder</option>
            <option value="numbered">🔢 Numbered</option>
          </select>

          <div className="balance-filter">
            <input
              type="number"
              placeholder="Min balance"
              value={filters.minBalance === 0 ? '' : filters.minBalance}
              onChange={(e) => handleFilterChange({ minBalance: parseFloat(e.target.value) || 0 })}
              className="filter-input small"
              step="0.0001"
            />
            <span>to</span>
            <input
              type="number"
              placeholder="Max balance"
              value={filters.maxBalance === Infinity ? '' : filters.maxBalance}
              onChange={(e) => handleFilterChange({ maxBalance: parseFloat(e.target.value) || Infinity })}
              className="filter-input small"
              step="0.0001"
            />
          </div>

          <label className="checkbox-filter">
            <input
              type="checkbox"
              checked={filters.showZeroBalance}
              onChange={(e) => handleFilterChange({ showZeroBalance: e.target.checked })}
            />
            Show zero balance
          </label>
        </div>
      </div>

      {/* Selection Actions */}
      {isSelectionMode && (
        <div className="selection-actions">
          <div className="selection-controls">
            <button
              className="btn-ghost"
              onClick={handleSelectAll}
              disabled={filteredAndSortedWallets.length === 0}
            >
              Select All ({filteredAndSortedWallets.length})
            </button>
            
            <button
              className="btn-ghost"
              onClick={handleDeselectAll}
              disabled={selectedWallets.length === 0}
            >
              Deselect All
            </button>

            <select
              className="role-select-all"
              onChange={(e) => {
                if (e.target.value !== '') {
                  selectWalletsByRole(e.target.value as Role);
                  e.target.value = '';
                }
              }}
              value=""
            >
              <option value="">Select by Role...</option>
              <option value="dev">👨‍💻 All Developers</option>
              <option value="mev">🤖 All MEV Bots</option>
              <option value="funder">💰 All Funders</option>
              <option value="numbered">🔢 All Numbered</option>
            </select>
          </div>

          <div className="bulk-actions">
            <button
              className="btn-secondary"
              onClick={handleExportSelected}
              disabled={selectedWallets.length === 0}
            >
              📄 Export Selected ({selectedWallets.length})
            </button>
            
            <button
              className="btn-danger"
              onClick={handleDeleteSelected}
              disabled={selectedWallets.length === 0}
            >
              🗑️ Delete Selected ({selectedWallets.length})
            </button>
          </div>
        </div>
      )}

      {/* Error Display */}
      {walletError && (
        <div className="table-error">
          <span className="error-icon">⚠️</span>
          {walletError}
        </div>
      )}

      {/* Loading State */}
      {isGenerating && (
        <div className="table-loading">
          <span className="loading-spinner"></span>
          Generating wallets...
        </div>
      )}

      {/* Main Table */}
      <div className="table-wrapper">
        <table className="wallet-table">
          <thead>
            <tr>
              {isSelectionMode && (
                <th className="selection-header">
                  <input
                    type="checkbox"
                    checked={selectedWallets.length === filteredAndSortedWallets.length && filteredAndSortedWallets.length > 0}
                    onChange={(e) => e.target.checked ? handleSelectAll() : handleDeselectAll()}
                  />
                </th>
              )}
              
              <th
                className="sortable-header"
                onClick={() => handleSort('address')}
              >
                Wallet Address {getSortIcon('address')}
              </th>
              
              <th
                className="sortable-header"
                onClick={() => handleSort('role')}
              >
                Role {getSortIcon('role')}
              </th>
              
              <th
                className="sortable-header"
                onClick={() => handleSort('balance')}
              >
                BNB Balance {getSortIcon('balance')}
              </th>
              
              <th className="private-key-header">
                Private Key
              </th>
              
              {!isMainnet && currentNetwork.chainId === 97 && (
                <th className="faucet-header">
                  🚰 Test BNB
                </th>
              )}
              
              <th className="actions-header">
                Actions
              </th>
              
              <th
                className="sortable-header"
                onClick={() => handleSort('createdAt')}
              >
                Status {getSortIcon('createdAt')}
              </th>
            </tr>
          </thead>
          
          <tbody>
            {filteredAndSortedWallets.length === 0 ? (
              <tr className="empty-row">
                <td colSpan={isSelectionMode ? 7 : 6} className="empty-message">
                  {wallets.length === 0 ? (
                    <div className="empty-state">
                      <span className="empty-icon">👛</span>
                      <h3>No wallets yet</h3>
                      <p>Generate or import wallets to get started</p>
                      <button
                        className="btn-primary"
                        onClick={() => setShowGenerateDialog(true)}
                        disabled={!isUnlocked}
                      >
                        Generate Your First Wallets
                      </button>
                    </div>
                  ) : (
                    <div className="no-results">
                      <span className="no-results-icon">🔍</span>
                      <p>No wallets match your current filters</p>
                      <button
                        className="btn-ghost"
                        onClick={() => setFilters({
                          search: '',
                          role: 'all',
                          minBalance: 0,
                          maxBalance: Infinity,
                          showZeroBalance: true,
                        })}
                      >
                        Clear Filters
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ) : (
              filteredAndSortedWallets.map((wallet) => (
                <WalletRow
                  key={wallet.id}
                  wallet={wallet}
                  isSelected={selectedWallets.includes(wallet.id)}
                  onSelect={handleWalletSelect}
                  isSelectionMode={isSelectionMode}
                  showPrivateKeys={true}
                  showFaucetButton={!isMainnet() && currentNetwork.chainId === 97}
                  onFaucetSuccess={handleFaucetSuccess}
                  onFaucetError={handleFaucetError}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Table Footer */}
      <div className="table-footer">
        <div className="footer-stats">
          <span>
            Showing {filteredAndSortedWallets.length} of {stats.totalWallets} wallets
          </span>
          {stats.filteredWallets !== stats.totalWallets && (
            <span className="filtered-note">
              ({stats.totalWallets - stats.filteredWallets} filtered out)
            </span>
          )}
        </div>
        
        <div className="footer-actions">
          <span className="session-status">
            {isUnlocked ? '🔓 Session Unlocked' : '🔒 Session Locked'}
          </span>
        </div>
      </div>

      {/* Dialogs */}
      <GenerateWalletsDialog
        isOpen={showGenerateDialog}
        onClose={() => setShowGenerateDialog(false)}
        onSuccess={(count) => {
          console.log(`Successfully generated ${count} wallets`);
        }}
      />
      
      <ImportWalletsDialog
        isOpen={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        onSuccess={(count) => {
          console.log(`Successfully imported ${count} wallets`);
        }}
      />
      
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        isDangerous={confirmDialog.isDangerous}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
      />
      
      <ExportDialog
        isOpen={showExportDialog}
        onClose={() => setShowExportDialog(false)}
        selectedWallets={exportType === 'bulk' && selectedWallets.length > 0 ? selectedWallets : []}
        exportType={exportType}
      />
    </div>
  );
};