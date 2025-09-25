/**
 * Bundle Execution Component
 * Main interface for executing bundle configurations with real-time monitoring
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useExecutionStore } from '../../store/execution';
import { useTransactionStore } from '../../store/transactions';
import { useConfigStore } from '../../store/config';
import { useWalletStore } from '../../store/wallets';
import { useSessionStore } from '../../store/session';
import type { EnhancedBundleConfig } from '../../types/bundle-config';
import { executionEngine } from '../../services/execution-engine';
import { transactionManager } from '../../services/transaction-manager';
import { gasManager } from '../../services/gas-manager';
import { stealthManager } from '../../services/stealth-manager';
import { ExecutionControls } from './ExecutionControls';
import { StatusDashboard } from './StatusDashboard';
import { TransactionQueue } from './TransactionQueue';
import { ExecutionSummary } from './ExecutionSummary';
import type { ExecutionPlan } from '../../services/execution-engine';
import './BundleExecution.css';

interface BundleExecutionProps {
  onClose: () => void;
}

export const BundleExecution: React.FC<BundleExecutionProps> = ({ onClose }) => {
  // Use individual store selectors to avoid infinite loops
  const status = useExecutionStore(state => state.status);
  const currentSession = useExecutionStore(state => state.currentSession);
  const progress = useExecutionStore(state => state.progress);
  const statistics = useExecutionStore(state => state.statistics);
  const control = useExecutionStore(state => state.control);
  const initializeExecution = useExecutionStore(state => state.initializeExecution);
  const authenticateSession = useExecutionStore(state => state.authenticateSession);
  const startExecution = useExecutionStore(state => state.startExecution);
  const pauseExecution = useExecutionStore(state => state.pauseExecution);
  const stopExecution = useExecutionStore(state => state.stopExecution);
  const abortExecution = useExecutionStore(state => state.abortExecution);
  const updateProgress = useExecutionStore(state => state.updateProgress);
  const updateStatistics = useExecutionStore(state => state.updateStatistics);

  // Session store selectors for authentication
  const isUnlocked = useSessionStore(state => state.isUnlocked);
  const sessionUnlock = useSessionStore(state => state.unlock);
  const isSessionValid = useSessionStore(state => state.isSessionValid);
  const sessionInitialize = useSessionStore(state => state.initialize);

  const currentConfig = useConfigStore(state => state.currentConfig);
  const isValidConfig = useConfigStore(state => state.isValidConfig);
  const validateConfig = useConfigStore(state => state.validateConfig);
  const selectedWallets = useWalletStore(state => state.selectedWallets);
  // Use individual selectors for transaction store as well
  const transactions = useTransactionStore(state => state.transactions);
  const queue = useTransactionStore(state => state.queue);
  const metrics = useTransactionStore(state => state.metrics);
  const gasTracker = useTransactionStore(state => state.gasTracker);
  const startMonitoring = useTransactionStore(state => state.startMonitoring);
  const stopMonitoring = useTransactionStore(state => state.stopMonitoring);

  const [executionPlan, setExecutionPlan] = useState<ExecutionPlan | null>(null);
  const [passphrase, setPassphrase] = useState('');
  const [passphraseVisible, setPassphraseVisible] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [isCreatingPlan, setIsCreatingPlan] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'queue' | 'summary'>('dashboard');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [riskAssessment, setRiskAssessment] = useState<{
    level: 'low' | 'medium' | 'high';
    factors: string[];
    recommendations: string[];
  } | null>(null);

  // Initialize services and session
  useEffect(() => {
    const initializeServices = async () => {
      try {
        // Initialize session store
        await sessionInitialize();
        
        // Start monitoring services
        gasManager.startMonitoring();
        transactionManager.startMonitoring();
      } catch (error) {
        console.error('Failed to initialize services:', error);
        setValidationErrors(['Failed to initialize security services']);
      }
    };
    
    initializeServices();
    
    return () => {
      gasManager.stopMonitoring();
      transactionManager.stopMonitoring();
    };
  }, [sessionInitialize]);

  // Initialize stealth manager with current config
  useEffect(() => {
    if (currentConfig) {
      stealthManager.initialize(currentConfig as EnhancedBundleConfig);
    }
  }, [currentConfig]);

  // Validate prerequisites
  const validatePrerequisites = async (): Promise<boolean> => {
    if (!currentConfig) {
      setValidationErrors(['No bundle configuration found']);
      return false;
    }

    if (selectedWallets.length === 0) {
      setValidationErrors(['No wallets selected for execution']);
      return false;
    }

    if (!passphrase) {
      setValidationErrors(['Passphrase is required for execution']);
      return false;
    }

    // Check session authentication
    if (!isUnlocked || !isSessionValid()) {
      setValidationErrors(['Session must be unlocked and authenticated']);
      return false;
    }

    setIsValidating(true);
    setValidationErrors([]);

    try {
      const validation = await executionEngine.validateExecution(
        currentConfig as EnhancedBundleConfig,
        selectedWallets,
        passphrase
      );

      if (!validation.valid) {
        setValidationErrors(validation.errors);
        setIsValidating(false);
        return false;
      }

      setIsValidating(false);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Validation failed';
      setValidationErrors([errorMessage]);
      setIsValidating(false);
      return false;
    }
  };

  // Create execution plan
  const createExecutionPlan = async (): Promise<boolean> => {
    if (!currentConfig) return false;

    setIsCreatingPlan(true);

    try {
      const plan = await executionEngine.createExecutionPlan(
        currentConfig as EnhancedBundleConfig,
        selectedWallets
      );

      setExecutionPlan(plan);
      
      // Perform risk assessment
      const totalValue = parseFloat(plan.totalValue);
      const factors: string[] = [];
      let riskLevel: 'low' | 'medium' | 'high' = 'low';
      const recommendations: string[] = [];

      if (totalValue > 10) {
        factors.push(`High total value: ${totalValue.toFixed(2)} BNB`);
        riskLevel = 'medium';
      }

      if (plan.totalTransactions > 50) {
        factors.push(`Large number of transactions: ${plan.totalTransactions}`);
        if (riskLevel === 'medium') riskLevel = 'high';
        else riskLevel = 'medium';
      }

      if (currentConfig.transactionSettings?.mevProtection?.enabled === false) {
        factors.push('MEV protection is disabled');
        recommendations.push('Consider enabling MEV protection for safer execution');
      }

      if (currentConfig.executionParams?.stealthMode?.enabled === false) {
        factors.push('Stealth mode is disabled');
        recommendations.push('Enable stealth mode to reduce detection risk');
      }

      setRiskAssessment({ level: riskLevel, factors, recommendations });
      setIsCreatingPlan(false);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create execution plan';
      setValidationErrors([errorMessage]);
      setIsCreatingPlan(false);
      return false;
    }
  };

  // Handle execution start
  const handleStartExecution = async () => {
    if (!executionPlan || !currentConfig) return;

    try {
      // First unlock the session if not already unlocked
      if (!isUnlocked || !isSessionValid()) {
        const unlocked = await sessionUnlock(passphrase);
        if (!unlocked) {
          setValidationErrors(['Failed to authenticate session with provided passphrase']);
          return;
        }
      }
      
      // Initialize execution session
      await initializeExecution(currentConfig as EnhancedBundleConfig, selectedWallets, passphrase);
      await authenticateSession(passphrase);
      
      // Start transaction monitoring
      startMonitoring();
      
      // Execute the plan
      const result = await executionEngine.executeBundlePlan(
        executionPlan,
        passphrase,
        {
          batchSize: currentConfig.executionParams?.batchConfiguration?.batchSize || 5,
          concurrentLimit: currentConfig.executionParams?.batchConfiguration?.concurrentLimit || 3,
          maxRetries: 3,
        }
      );
      
      console.log('Execution completed:', result);
      
    } catch (error) {
      console.error('Execution failed:', error);
      await abortExecution();
    }
  };

  // Handle execution pause
  const handlePauseExecution = async () => {
    await pauseExecution();
    transactionManager.pauseQueue();
  };

  // Handle execution resume
  const handleResumeExecution = async () => {
    await startExecution();
    transactionManager.resumeQueue();
  };

  // Handle execution stop
  const handleStopExecution = async () => {
    await stopExecution();
    transactionManager.stopMonitoring();
    stopMonitoring();
  };

  // Handle emergency abort
  const handleEmergencyAbort = async () => {
    await abortExecution();
    transactionManager.emergencyStop();
    stopMonitoring();
  };

  // Prepare for execution
  const prepareExecution = async () => {
    const isValid = await validatePrerequisites();
    if (!isValid) return;

    const planCreated = await createExecutionPlan();
    if (!planCreated) return;

    setShowConfirmation(true);
  };

  // Confirm and start execution
  const confirmExecution = async () => {
    setShowConfirmation(false);
    await handleStartExecution();
  };

  // Get execution statistics for display (memoized to prevent infinite loops)
  const executionStats = useMemo(() => {
    const totalTransactions = Object.keys(transactions).length;
    const completedTransactions = Object.values(transactions).filter(
      tx => tx.status === 'confirmed'
    ).length;
    const failedTransactions = Object.values(transactions).filter(
      tx => tx.status === 'failed'
    ).length;
    
    return {
      total: totalTransactions,
      completed: completedTransactions,
      failed: failedTransactions,
      pending: totalTransactions - completedTransactions - failedTransactions,
      successRate: totalTransactions > 0 ? (completedTransactions / totalTransactions) * 100 : 0,
    };
  }, [transactions]);

  return (
    <div className="bundle-execution">
      <div className="execution-header">
        <div className="header-title">
          <h2>Bundle Execution</h2>
          <div className="execution-status">
            <div className={`status-indicator status-${status}`}></div>
            <span className="status-text">{status.toUpperCase()}</span>
          </div>
        </div>
        <button onClick={onClose} className="close-button">
          ✕
        </button>
      </div>

      <div className="execution-content">
        {/* Pre-execution Setup */}
        {status === 'idle' && (
          <div className="pre-execution">
            <div className="config-summary">
              <h3>Configuration Summary</h3>
              {currentConfig ? (
                <div className="config-details">
                  <div className="config-item">
                    <label>Token:</label>
                    <span>{currentConfig.token?.symbol} ({currentConfig.token?.name})</span>
                  </div>
                  <div className="config-item">
                    <label>Total Investment:</label>
                    <span>{currentConfig.purchaseAmount?.totalBnb} BNB</span>
                  </div>
                  <div className="config-item">
                    <label>Selected Wallets:</label>
                    <span>{selectedWallets.length} wallets</span>
                  </div>
                  <div className="config-item">
                    <label>Strategy:</label>
                    <span>{currentConfig.strategy?.sellStrategy || 'Hold'}</span>
                  </div>
                </div>
              ) : (
                <div className="no-config">
                  <p>No configuration selected. Please configure your bundle first.</p>
                </div>
              )}
            </div>

            {currentConfig && (
              <div className="passphrase-section">
                <h3>Authentication Required</h3>
                <div className="passphrase-input">
                  <label htmlFor="passphrase">Enter passphrase to decrypt wallets:</label>
                  <div className="input-group">
                    <input
                      type={passphraseVisible ? 'text' : 'password'}
                      id="passphrase"
                      value={passphrase}
                      onChange={(e) => setPassphrase(e.target.value)}
                      placeholder="Enter your secure passphrase"
                      className={validationErrors.length > 0 ? 'error' : ''}
                    />
                    <button
                      type="button"
                      onClick={() => setPassphraseVisible(!passphraseVisible)}
                      className="toggle-visibility"
                    >
                      {passphraseVisible ? '👁️' : '👁️‍🗨️'}
                    </button>
                  </div>
                </div>

                {validationErrors.length > 0 && (
                  <div className="validation-errors">
                    <h4>⚠️ Validation Errors:</h4>
                    <ul>
                      {validationErrors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="execution-actions">
                  <button
                    onClick={prepareExecution}
                    disabled={!passphrase || isValidating || isCreatingPlan || (!isUnlocked || !isSessionValid()) || !isValidConfig}
                    className="primary-button start-button"
                    title={
                      (!isUnlocked || !isSessionValid()) ? 'Session must be authenticated to start execution' :
                      !isValidConfig ? 'Bundle configuration must be valid to start execution' : ''
                    }
                  >
                    {isValidating ? 'Validating...' : isCreatingPlan ? 'Creating Plan...' : 'Prepare Execution'}
                  </button>
                  
                  {(!isUnlocked || !isSessionValid()) && (
                    <div className="authentication-warning">
                      <span className="warning-icon">⚠️</span>
                      <span>Session authentication required. Please unlock your session first.</span>
                    </div>
                  )}
                  
                  {!isValidConfig && (
                    <div className="configuration-warning">
                      <span className="warning-icon">⚠️</span>
                      <span>Bundle configuration is invalid. Please complete configuration in the Bundle Config tab.</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Execution Confirmation */}
        {showConfirmation && executionPlan && riskAssessment && (
          <div className="execution-confirmation">
            <div className="confirmation-content">
              <h3>⚠️ Confirm Execution</h3>
              
              <div className="execution-plan-summary">
                <h4>Execution Plan Summary</h4>
                <div className="plan-details">
                  <div className="plan-item">
                    <label>Total Transactions:</label>
                    <span>{executionPlan.totalTransactions}</span>
                  </div>
                  <div className="plan-item">
                    <label>Estimated Duration:</label>
                    <span>{Math.ceil(executionPlan.estimatedDuration / 60000)} minutes</span>
                  </div>
                  <div className="plan-item">
                    <label>Estimated Gas Cost:</label>
                    <span>{(parseFloat(executionPlan.estimatedGasCost) / 1e18).toFixed(6)} BNB</span>
                  </div>
                  <div className="plan-item">
                    <label>Total Value:</label>
                    <span>{executionPlan.totalValue} BNB</span>
                  </div>
                </div>
              </div>

              <div className={`risk-assessment risk-${riskAssessment.level}`}>
                <h4>Risk Assessment: {riskAssessment.level.toUpperCase()}</h4>
                {riskAssessment.factors.length > 0 && (
                  <div className="risk-factors">
                    <label>Risk Factors:</label>
                    <ul>
                      {riskAssessment.factors.map((factor, index) => (
                        <li key={index}>{factor}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {riskAssessment.recommendations.length > 0 && (
                  <div className="recommendations">
                    <label>Recommendations:</label>
                    <ul>
                      {riskAssessment.recommendations.map((rec, index) => (
                        <li key={index}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="confirmation-actions">
                <button
                  onClick={() => setShowConfirmation(false)}
                  className="secondary-button"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmExecution}
                  className="primary-button danger-button"
                >
                  Start Execution
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Active Execution Interface */}
        {(['executing', 'paused', 'completed', 'failed', 'aborted'].includes(status)) && (
          <div className="execution-interface">
            {/* Execution Controls */}
            <ExecutionControls
              status={status}
              canStart={control.canStart}
              canPause={control.canPause}
              canStop={control.canStop}
              canAbort={control.canAbort}
              onStart={handleResumeExecution}
              onPause={handlePauseExecution}
              onStop={handleStopExecution}
              onAbort={handleEmergencyAbort}
            />

            {/* Tab Navigation */}
            <div className="tab-navigation">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={activeTab === 'dashboard' ? 'active' : ''}
              >
                Dashboard
                <span className="tab-badge">{progress.overallProgress?.toFixed(1) || 0}%</span>
              </button>
              <button
                onClick={() => setActiveTab('queue')}
                className={activeTab === 'queue' ? 'active' : ''}
              >
                Transaction Queue
                <span className="tab-badge">{queue.transactions.length}</span>
              </button>
              <button
                onClick={() => setActiveTab('summary')}
                className={activeTab === 'summary' ? 'active' : ''}
              >
                Summary
                <span className="tab-badge">{executionStats.completed}/{executionStats.total}</span>
              </button>
            </div>

            {/* Tab Content */}
            <div className="tab-content">
              {activeTab === 'dashboard' && (
                <StatusDashboard
                  status={status}
                  progress={progress}
                  statistics={statistics}
                  gasTracker={gasTracker}
                  executionPlan={executionPlan}
                />
              )}
              
              {activeTab === 'queue' && (
                <TransactionQueue
                  transactions={Object.values(transactions)}
                  queue={queue}
                  onRetryTransaction={(txId: string) => {
                    // Handle retry logic
                    console.log('Retry transaction:', txId);
                  }}
                  onCancelTransaction={(txId: string) => {
                    // Handle cancel logic
                    console.log('Cancel transaction:', txId);
                  }}
                />
              )}
              
              {activeTab === 'summary' && (
                <ExecutionSummary
                  status={status}
                  statistics={statistics}
                  transactions={Object.values(transactions)}
                  executionPlan={executionPlan}
                  gasTracker={gasTracker}
                  onExportReport={() => {
                    // Handle export logic
                    console.log('Export report');
                  }}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BundleExecution;