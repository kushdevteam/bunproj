/**
 * Main App component for JustJewIt Multi-Wallet Bundler
 * Complete UI rebuild to match JustJewIt design specifications
 */

import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { applyThemeVariables } from './theme';
import { useSessionStore, startSessionMonitoring, setupActivityListeners } from './store/session';
import { startBalanceMonitoring } from './store/wallets';
import { useNetworkStore } from './store/network';
import { useUserStore } from './store/users';
import { apiClient } from './api/client';
import { FundingPanel } from './components/FundingPanel/FundingPanel';
import { BundleConfig } from './components/BundleConfig/BundleConfig';
import { BundleExecution } from './components/BundleExecution/BundleExecution';
import { AccessKeyLogin } from './components/AccessKeyLogin';
import { AdminPanel } from './components/AdminPanel';
import { LaunchpadForm } from './components/LaunchpadForm';
import { LaunchPlanGeneration } from './components/LaunchPlanGeneration';
import { ConfirmationModal } from './components/ConfirmationModal';
import { LoadingScreen } from './components/LoadingScreen';
import { DraftsList } from './components/DraftsList';
import { bscScanButtonStyles } from './components/BSCScanButton';
import { AnalyticsDashboard } from './components/Analytics/AnalyticsDashboard';
import { NetworkSwitcher } from './components/NetworkSwitcher';
import { useLaunchStore } from './store/launches';
import './App.css';
import './components/WalletTable.css';

// Create QueryClient for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

// Foundation Phase App Component
const App: React.FC = () => {
  // User management state
  const {
    initialize: initializeUserStore,
    isUserLoggedIn,
    isAdmin,
    getCurrentUser,
    currentSession,
    updateSessionActivity,
    isInitialized: isUserStoreInitialized,
    error: userError,
    logout,
  } = useUserStore();

  // Legacy session store for backward compatibility
  const initializeSession = useSessionStore(state => state.initialize);
  const isInitialized = useSessionStore(state => state.isInitialized);
  const sessionError = useSessionStore(state => state.error);
  
  // Network store state
  const initializeNetwork = useNetworkStore(state => state.initialize);
  const currentNetwork = useNetworkStore(state => state.currentNetwork);
  const isNetworkConnected = useNetworkStore(state => state.isConnected);
  
  // Launch store state
  const { statistics, createDraft } = useLaunchStore();
  
  // Active tab state for navigation - updated to match new design
  const [activeSection, setActiveSection] = React.useState<'dashboard' | 'launchpad' | 'launchplan' | 'archived' | 'bundler' | 'config' | 'execution' | 'analytics' | 'account'>('dashboard');
  
  // Track if we're in editing mode (when user clicks Edit on a draft)
  const [isEditingMode, setIsEditingMode] = React.useState(false);

  // Initialize app on mount
  useEffect(() => {
    const initialize = async () => {
      try {
        // Apply theme variables to document
        applyThemeVariables();
        
        // Inject BSCScan button styles
        const styleElement = document.createElement('style');
        styleElement.textContent = bscScanButtonStyles;
        document.head.appendChild(styleElement);
        
        // Initialize user management store first
        await initializeUserStore();
        
        // Initialize legacy session store for backward compatibility
        await initializeSession();
        
        // Initialize and start network monitoring
        await initializeNetwork();
        
        // Start monitoring systems
        startSessionMonitoring();
        setupActivityListeners();
        startBalanceMonitoring();
        
        // Test API connection
        const isConnected = await apiClient.testConnection();
        console.log('API Connection:', isConnected ? 'Success' : 'Failed');
        
      } catch (error) {
        console.error('App initialization failed:', error);
      }
    };

    initialize();
    
    // Cleanup on unmount
    return () => {
      // Clean up monitoring systems when component unmounts
      // (cleanup functions would be called here in production)
    };
  }, [initializeUserStore, initializeSession, initializeNetwork]);

  // Activity tracking for user sessions
  useEffect(() => {
    if (isUserLoggedIn()) {
      const interval = setInterval(() => {
        updateSessionActivity();
      }, 30000); // Update every 30 seconds

      return () => clearInterval(interval);
    }
  }, [isUserLoggedIn, updateSessionActivity]);

  // Loading state during initialization
  if ((!isInitialized || !isUserStoreInitialized) && !sessionError && !userError) {
    return (
      <div className="app-loading">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Initializing Proxima...</p>
          <small>Setting up secure user management and crypto utilities...</small>
        </div>
      </div>
    );
  }

  // Error state
  if (sessionError || userError) {
    return (
      <div className="app-error">
        <div className="error-container">
          <div className="error-icon">⚠️</div>
          <h2>Initialization Error</h2>
          <p>{sessionError || userError}</p>
          <button 
            className="retry-button"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Authentication flow - show AccessKeyLogin if not logged in
  if (!isUserLoggedIn()) {
    return <AccessKeyLogin />;
  }

  // Admin Panel - show for admin users
  if (isAdmin()) {
    return <AdminPanel />;
  }

  // Get current user for session context
  const currentUser = getCurrentUser();
  if (!currentUser) {
    return <AccessKeyLogin />;
  }

  // Main app for authenticated regular users (non-admin)
  return (
    <QueryClientProvider client={queryClient}>
      <div className="app-container" data-user-id={currentUser.id} data-user-role={currentUser.role}>
        {/* User Context Info (hidden, for debugging) */}
        <div style={{ display: 'none' }} id="user-context">
          User: {currentUser.username} | Session: {currentSession?.sessionId} | Role: {currentUser.role}
        </div>
        
        {/* Header */}
        <header className="app-header">
          <div className="header-left">
            <div className="logo">
              <div className="logo-icon">
                <i className="fas fa-star"></i>
              </div>
              <h1>JustJewIt</h1>
            </div>
          </div>
          <div className="header-right">
            <NetworkSwitcher compact={true} showDetails={false} />
            <button className="logout-btn" onClick={logout}>
              <i className="fas fa-sign-out-alt"></i>
              <span>Logout</span>
            </button>
          </div>
        </header>

        {/* Sidebar */}
        <aside className="sidebar">
          <nav>
            {/* Navigation Items */}
            <div className="nav-section">
              <div 
                className={`nav-item ${activeSection === 'dashboard' ? 'active' : ''}`}
                onClick={() => setActiveSection('dashboard')}
              >
                <i className="fas fa-chart-bar"></i>
                <span>Statistics</span>
              </div>
              
              <div 
                className={`nav-item ${activeSection === 'archived' ? 'active' : ''}`}
                onClick={() => setActiveSection('archived')}
              >
                <i className="fas fa-archive"></i>
                <span>Archived</span>
                <span className="badge">1</span>
              </div>
            </div>
          </nav>

          <div className="sidebar-footer">
            <button 
              className="create-launch-btn"
              onClick={() => {
                setIsEditingMode(false); // Ensure we're not in editing mode for new drafts
                createDraft();
                setActiveSection('launchpad');
              }}
            >
              Create new Launch
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="main-content">
          {/* Statistics Dashboard */}
          {activeSection === 'dashboard' && (
            <>
              {/* Statistics Header */}
              <div className="statistics-header">
                <h1>Statistics</h1>
                <span className="time-period">All Time</span>
              </div>

              {/* Main Statistics Grid */}
              <div className="main-stats-grid">
                <div className="main-stat-card">
                  <div className="stat-value-large">0</div>
                  <div className="stat-label-large">Tokens Launched</div>
                </div>
                <div className="main-stat-card profits">
                  <div className="stat-value-large">
                    0.0
                    <div className="bnb-text">BNB</div>
                  </div>
                  <div className="stat-label-large">Profits</div>
                </div>
                <div className="main-stat-card">
                  <div className="stat-value-large">$</div>
                  <div className="stat-label-large">Last Launch</div>
                </div>
              </div>
            </>
          )}

          {/* Dynamic Content Based on Active Section */}
          {activeSection === 'dashboard' && (
            <>
              {/* Dashboard with Drafts */}
              <DraftsList 
                onEditDraft={() => {
                  setIsEditingMode(true);
                  setActiveSection('launchpad');
                }}
              />
            </>
          )}

          {activeSection === 'launchpad' && (
            <>
              {/* Token Creation Launchpad */}
              <LaunchpadForm 
                onNavigateToLaunchPlan={() => setActiveSection('launchplan')}
                isEditingMode={isEditingMode}
              />
            </>
          )}

          {activeSection === 'launchplan' && (
            <>
              {/* Launch Plan Generation */}
              <LaunchPlanGeneration />
            </>
          )}

          {activeSection === 'archived' && (
            <>
              {/* Archived/Launched Tokens */}
              <div className="archived-section">
                <div className="archived-header">
                  <h3>Archived Launches</h3>
                  <div className="archived-stats">
                    <span>{statistics.tokensLaunched} Launched</span>
                    <span>{statistics.totalProfitsBnb.toFixed(2)} BNB Profit</span>
                  </div>
                </div>
                
                {statistics.tokensLaunched === 0 ? (
                  <div className="empty-archived">
                    <div className="empty-icon">🏆</div>
                    <h4>No launches yet</h4>
                    <p>Your successful token launches will appear here</p>
                  </div>
                ) : (
                  <div className="archived-list">
                    {/* Future: List of launched tokens */}
                    <div className="archived-item">
                      <div className="launch-icon">💎</div>
                      <div className="launch-info">
                        <h4>Recent Launches</h4>
                        <p>Token launches and profits will be displayed here</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {activeSection === 'bundler' && (
            <>
              {/* Multi-Wallet Bundler (Legacy) */}
              <div className="bundler-section">
                <h3>Multi-Wallet Bundler</h3>
                <p className="section-description">
                  Manage funding across multiple wallets for token bundling operations
                </p>
                <FundingPanel />
              </div>
            </>
          )}

          {activeSection === 'config' && (
            <>
              {/* Bundle Configuration (Legacy) */}
              <div className="config-section">
                <h3>Bundle Configuration</h3>
                <p className="section-description">
                  Configure bundle parameters, gas settings, and execution strategies
                </p>
                <BundleConfig />
              </div>
            </>
          )}

          {activeSection === 'execution' && (
            <>
              {/* Bundle Execution (Legacy) */}
              <div className="execution-section">
                <h3>Bundle Execution</h3>
                <p className="section-description">
                  Execute configured bundles and monitor transaction progress
                </p>
                <BundleExecution onClose={() => setActiveSection('config')} />
              </div>
            </>
          )}

          {activeSection === 'analytics' && (
            <>
              {/* Advanced Analytics Dashboard (Legacy) */}
              <div className="analytics-section">
                <h3>Analytics Dashboard</h3>
                <p className="section-description">
                  View detailed analytics and performance metrics for your operations
                </p>
                <AnalyticsDashboard />
              </div>
            </>
          )}

          {activeSection === 'account' && (
            <>
              {/* Account & Settings Panel */}
              <div className="account-panel">
                <div className="account-header">
                  <h2>Account & Settings</h2>
                  <p>Manage your account settings and session</p>
                </div>

                <div className="account-grid">
                  <div className="account-card">
                    <h3>👤 Account Information</h3>
                    <div className="account-info">
                      <div className="info-row">
                        <label>User ID:</label>
                        <span>{currentUser.id}</span>
                      </div>
                      <div className="info-row">
                        <label>Username:</label>
                        <span>{currentUser.username}</span>
                      </div>
                      <div className="info-row">
                        <label>Role:</label>
                        <span className={`role-badge ${currentUser.role}`}>
                          {currentUser.role === 'admin' ? '👑 Admin' : '👤 User'}
                        </span>
                      </div>
                      <div className="info-row">
                        <label>Session ID:</label>
                        <span className="session-id">{currentSession?.sessionId}</span>
                      </div>
                      <div className="info-row">
                        <label>Login Time:</label>
                        <span>{currentSession?.loginAt ? new Date(currentSession.loginAt).toLocaleString() : 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="account-card">
                    <h3>🔐 Security & Session</h3>
                    <div className="security-actions">
                      <div className="action-item">
                        <div className="action-info">
                          <strong>Session Status</strong>
                          <p>Your current session is active and secure</p>
                        </div>
                        <div className="action-status">
                          <span className="status-dot active"></span>
                          <span>Active</span>
                        </div>
                      </div>
                      
                      <div className="action-item">
                        <div className="action-info">
                          <strong>Access Key Authentication</strong>
                          <p>You are logged in with a secure access key</p>
                        </div>
                        <div className="action-status">
                          <span className="status-dot secure"></span>
                          <span>Secure</span>
                        </div>
                      </div>

                      <div className="logout-section">
                        <h4>⚠️ Session Management</h4>
                        <p>Logging out will end your current session. You'll need your access key to log back in.</p>
                        <button 
                          className="logout-btn"
                          onClick={() => {
                            if (window.confirm('Are you sure you want to logout? You will need to re-enter your access key to login again.')) {
                              const { logout } = useUserStore.getState();
                              logout();
                            }
                          }}
                        >
                          🚪 Logout
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="account-card">
                    <h3>ℹ️ System Information</h3>
                    <div className="system-info">
                      <div className="info-row">
                        <label>Network:</label>
                        <span>BNB Smart Chain {currentNetwork?.name || 'Testnet'}</span>
                      </div>
                      <div className="info-row">
                        <label>Connection:</label>
                        <span className={`connection-status ${isNetworkConnected ? 'connected' : 'disconnected'}`}>
                          {isNetworkConnected ? '✅ Connected' : '❌ Disconnected'}
                        </span>
                      </div>
                      <div className="info-row">
                        <label>Version:</label>
                        <span>Proxima v0.7</span>
                      </div>
                      <div className="info-row">
                        <label>Features:</label>
                        <span>Token Launches, Multi-Wallet Bundling, Analytics</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

        </main>
        
        {/* Confirmation Modal - Global overlay */}
        <ConfirmationModal />
        
        {/* Loading Screen - Global overlay */}
        <LoadingScreen />
      </div>
    </QueryClientProvider>
  );
};

export default App;