/**
 * Main Bundle Configuration Component
 * Comprehensive interface for configuring BNB Smart Chain bundler operations
 */

import React, { useState, useEffect } from 'react';
import { useConfigStore } from '../../store/config';
import { usePresetStore } from '../../store/presets';
import { useWalletStore } from '../../store/wallets';
import { useSessionStore } from '../../store/session';
import { TokenConfig } from './TokenConfig';
import { TransactionSettings } from './TransactionSettings';
import { ExecutionParams } from './ExecutionParams';
import { BundlePreview } from './BundlePreview';
import { PresetManager } from './PresetManager';
import type { EnhancedBundleConfig } from '../../types/bundle-config';
import './BundleConfig.css';

interface TabConfig {
  id: string;
  label: string;
  icon: string;
  component: React.ComponentType<any>;
  badge?: string | number;
}

export const BundleConfig: React.FC = () => {
  // Store state
  const { 
    currentConfig, 
    updateConfig, 
    validateConfig, 
    isValidConfig,
    validationErrors,
    isDirty 
  } = useConfigStore();
  const { isUnlocked } = useSessionStore();
  const { wallets, selectedWallets } = useWalletStore();
  const { presets } = usePresetStore();

  // Local state
  const [activeTab, setActiveTab] = useState<string>('token');
  const [showPresetManager, setShowPresetManager] = useState(false);
  const [configProgress, setConfigProgress] = useState(0);
  const [lastValidation, setLastValidation] = useState<Date | null>(null);

  // Calculate configuration progress
  useEffect(() => {
    const requiredFields = [
      'token.address',
      'token.name', 
      'token.symbol',
      'purchaseAmount.totalBnb',
      'purchaseAmount.allocation',
      'transactionSettings.gasConfiguration',
      'executionParams.safetyFeatures'
    ];

    const completedFields = requiredFields.filter(field => {
      const keys = field.split('.');
      let value: any = currentConfig;
      
      for (const key of keys) {
        value = value?.[key];
        if (value === undefined || value === null || value === '') {
          return false;
        }
      }
      return true;
    });

    setConfigProgress(Math.round((completedFields.length / requiredFields.length) * 100));
  }, [currentConfig]);

  // Auto-validation
  useEffect(() => {
    if (isDirty) {
      const timer = setTimeout(() => {
        validateConfig();
        setLastValidation(new Date());
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [currentConfig, isDirty, validateConfig]);

  // Tab configuration
  const tabs: TabConfig[] = [
    {
      id: 'token',
      label: 'Token & Allocation',
      icon: 'fas fa-coins',
      component: TokenConfig,
      badge: currentConfig.token?.address ? '✓' : '',
    },
    {
      id: 'transaction',
      label: 'Transaction Settings',
      icon: 'fas fa-cogs',
      component: TransactionSettings,
      badge: currentConfig.transactionSettings?.gasConfiguration ? '✓' : '',
    },
    {
      id: 'execution',
      label: 'Execution Parameters',
      icon: 'fas fa-play-circle',
      component: ExecutionParams,
      badge: currentConfig.executionParams?.staggerSettings ? '✓' : '',
    },
    {
      id: 'preview',
      label: 'Preview & Validate',
      icon: 'fas fa-eye',
      component: BundlePreview,
      badge: isValidConfig ? '✓' : validationErrors.length > 0 ? validationErrors.length : '',
    },
  ];

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component || TokenConfig;

  // Handle configuration update
  const handleConfigUpdate = (updates: Partial<EnhancedBundleConfig>) => {
    updateConfig(updates as any);
  };

  // Session check
  if (!isUnlocked) {
    return (
      <div className="bundle-config">
        <div className="config-locked-state">
          <div className="lock-container">
            <div className="lock-icon">
              <i className="fas fa-lock"></i>
            </div>
            <h3>Session Locked</h3>
            <p>Please unlock your session to configure bundle parameters.</p>
            <div className="security-note">
              <i className="fas fa-shield-alt"></i>
              <span>Bundle configuration requires secure session authentication</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bundle-config">
      {/* Header Section */}
      <div className="bundle-config-header">
        <div className="header-content">
          <h2 className="bundle-config-title">
            <i className="fas fa-sliders-h"></i>
            Bundle Configuration
          </h2>
          <div className="bundle-config-actions">
            <button
              className="config-button secondary"
              onClick={() => setShowPresetManager(true)}
            >
              <i className="fas fa-save"></i>
              Presets
            </button>
            <div className="status-indicator info">
              <i className="fas fa-chart-line"></i>
              <span>{configProgress}% Complete</span>
            </div>
          </div>
        </div>

        {/* Configuration Progress */}
        <div className="config-progress">
          {tabs.map((tab, index) => (
            <div 
              key={tab.id}
              className={`progress-step ${
                activeTab === tab.id ? 'active' : 
                tab.badge === '✓' ? 'completed' : ''
              }`}
            >
              <div className="progress-step-number">
                {tab.badge === '✓' ? '✓' : index + 1}
              </div>
              <span>{tab.label}</span>
            </div>
          ))}
        </div>

        {/* Validation Status */}
        {lastValidation && (
          <div className="validation-summary">
            {isValidConfig ? (
              <div className="status-indicator success">
                <i className="fas fa-check-circle"></i>
                <span>Configuration valid - ready for execution</span>
              </div>
            ) : validationErrors.length > 0 ? (
              <div className="status-indicator error">
                <i className="fas fa-exclamation-triangle"></i>
                <span>{validationErrors.length} validation error{validationErrors.length !== 1 ? 's' : ''}</span>
              </div>
            ) : (
              <div className="status-indicator warning">
                <i className="fas fa-clock"></i>
                <span>Configuration incomplete</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="bundle-config-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`bundle-config-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <i className={tab.icon}></i>
            <span>{tab.label}</span>
            {tab.badge && (
              <span className={`tab-badge ${tab.badge === '✓' ? 'success' : 'info'}`}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bundle-config-content">
        <ActiveComponent 
          config={currentConfig as Partial<EnhancedBundleConfig>}
          onUpdate={handleConfigUpdate}
          wallets={wallets}
          selectedWallets={selectedWallets}
          validationErrors={validationErrors}
          isValid={isValidConfig}
        />
      </div>

      {/* Preset Manager Dialog */}
      {showPresetManager && (
        <PresetManager 
          isOpen={showPresetManager}
          onClose={() => setShowPresetManager(false)}
          currentConfig={currentConfig as EnhancedBundleConfig}
          onLoadConfig={handleConfigUpdate}
        />
      )}

      {/* Quick Stats Footer */}
      <div className="bundle-config-footer">
        <div className="config-stats">
          <div className="stat-item">
            <span className="stat-label">Total Wallets</span>
            <span className="stat-value">{wallets.length}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Selected</span>
            <span className="stat-value">{selectedWallets.length}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Total BNB Required</span>
            <span className="stat-value">
              {currentConfig.purchaseAmount?.totalBnb || 0} BNB
            </span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Saved Presets</span>
            <span className="stat-value">{presets.length}</span>
          </div>
        </div>

        {isDirty && (
          <div className="unsaved-changes-indicator">
            <i className="fas fa-circle"></i>
            <span>Unsaved changes</span>
          </div>
        )}
      </div>
    </div>
  );
};