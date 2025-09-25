/**
 * Main App component for JustJewIt Multi-Wallet Bundler
 * Foundation Phase implementation with theme system and basic structure
 */

import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { applyThemeVariables } from './theme';
import { useSessionStore, startSessionMonitoring, setupActivityListeners } from './store/session';
import { useWalletStore, startBalanceMonitoring } from './store/wallets';
import { useConfigStore } from './store/config';
import { useNetworkStore } from './store/network';
import { useUserStore } from './store/users';
import { NetworkSwitcher } from './components/NetworkSwitcher';
import { apiClient } from './api/client';
import { WalletTable } from './components/WalletTable/WalletTable';
import { FundingPanel } from './components/FundingPanel/FundingPanel';
import { BundleConfig } from './components/BundleConfig/BundleConfig';
import { BundleExecution } from './components/BundleExecution/BundleExecution';
import { LoginForm } from './components/LoginForm';
import { AdminPanel } from './components/AdminPanel';
import { bscScanButtonStyles } from './components/BSCScanButton';
import { AnalyticsDashboard } from './components/Analytics/AnalyticsDashboard';
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
  } = useUserStore();

  // Legacy session store for backward compatibility
  const initializeSession = useSessionStore(state => state.initialize);
  const isUnlocked = useSessionStore(state => state.isUnlocked);
  const isInitialized = useSessionStore(state => state.isInitialized);
  const sessionError = useSessionStore(state => state.error);
  
  // Network store state
  const initializeNetwork = useNetworkStore(state => state.initialize);
  const currentNetwork = useNetworkStore(state => state.currentNetwork);
  const isNetworkConnected = useNetworkStore(state => state.isConnected);
  
  const wallets = useWalletStore(state => state.wallets);
  const isGenerating = useWalletStore(state => state.isGenerating);
  
  const currentConfig = useConfigStore(state => state.currentConfig);
  const isValidConfig = useConfigStore(state => state.isValidConfig);
  
  // Active tab state for navigation
  const [activeSection, setActiveSection] = React.useState<'dashboard' | 'bundler' | 'config' | 'execution' | 'analytics'>('dashboard');

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
          <p>Initializing JustJewIt...</p>
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

  // Authentication flow - show LoginForm if not logged in
  if (!isUserLoggedIn()) {
    return <LoginForm />;
  }

  // Admin Panel - show for admin users
  if (isAdmin()) {
    return <AdminPanel />;
  }

  // Get current user for session context
  const currentUser = getCurrentUser();
  if (!currentUser) {
    return <LoginForm />;
  }

  // Main app for authenticated regular users (non-admin)
  return (
    <QueryClientProvider client={queryClient}>
      <div className="app-container" data-user-id={currentUser.id} data-user-role={currentUser.role}>
        {/* User Context Info (hidden, for debugging) */}
        <div style={{ display: 'none' }} id="user-context">
          User: {currentUser.username} | Session: {currentSession?.sessionId} | Role: {currentUser.role}
        </div>
        
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="logo">
            <i className="fas fa-gem"></i>
            <h1>JustJewIt</h1>
            <span className="version">v1.0</span>
          </div>

          <div className="search-bar">
            <i className="fas fa-search"></i>
            <input type="text" placeholder="Search" />
            <span className="shortcut">⌘K</span>
          </div>

          <nav>
            <div className="nav-section">
              <div 
                className={`nav-item ${activeSection === 'dashboard' ? 'active' : ''}`}
                onClick={() => setActiveSection('dashboard')}
              >
                <i className="fas fa-chart-bar"></i>
                <span>Dashboard</span>
              </div>
              <div 
                className={`nav-item ${activeSection === 'bundler' ? 'active' : ''}`}
                onClick={() => setActiveSection('bundler')}
              >
                <i className="fas fa-layer-group"></i>
                <span>Bundler</span>
              </div>
              <div 
                className={`nav-item ${activeSection === 'config' ? 'active' : ''}`}
                onClick={() => setActiveSection('config')}
              >
                <i className="fas fa-sliders-h"></i>
                <span>Bundle Config</span>
              </div>
              <div 
                className={`nav-item ${activeSection === 'execution' ? 'active' : ''}`}
                onClick={() => setActiveSection('execution')}
              >
                <i className="fas fa-play-circle"></i>
                <span>Bundle Execution</span>
              </div>
              <div 
                className={`nav-item ${activeSection === 'analytics' ? 'active' : ''}`}
                onClick={() => setActiveSection('analytics')}
              >
                <i className="fas fa-chart-line"></i>
                <span>Analytics</span>
              </div>
            </div>

            <div className="nav-section">
              <h3>Features</h3>
              <div className="nav-item">
                <i className="fas fa-wallet"></i>
                <span>Wallets</span>
                <span className="badge">{wallets.length}</span>
              </div>
              <div className="nav-item">
                <i className="fas fa-shield-alt"></i>
                <span>Security</span>
                <span className="status">{isUnlocked ? 'Unlocked' : 'Locked'}</span>
              </div>
              <div className="nav-item">
                <i className="fas fa-cog"></i>
                <span>Config</span>
                <span className="status">{isValidConfig ? 'Valid' : 'Invalid'}</span>
              </div>
            </div>
          </nav>

          <button className="create-launch-btn">
            Create new Launch
          </button>
        </aside>

        {/* Main Content */}
        <main className="main-content">
          <header className="page-header">
            <div className="page-header-left">
              <h1 className="page-title">JustJewIt - Multi-Wallet Bundler</h1>
              <div className="status-indicators">
                <div className="status-dot"></div>
                <span>
                  {activeSection === 'dashboard' ? 'Wallet Manager Ready' :
                   activeSection === 'bundler' ? 'Funding Panel Active' :
                   activeSection === 'config' ? 'Bundle Configuration UI' :
                   activeSection === 'execution' ? 'Bundle Execution Interface' :
                   activeSection === 'analytics' ? 'Advanced Analytics Dashboard' :
                   'Auto-Sell Planner System'}
                </span>
              </div>
            </div>
            
            <div className="page-header-right">
              <NetworkSwitcher 
                compact={true}
                showDetails={false}
                className="header-network-switcher"
              />
            </div>
          </header>

          {/* Quick Stats Grid */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value green">{wallets.length}</div>
              <div className="stat-label">Total Wallets</div>
            </div>
            <div className="stat-card">
              <div className="stat-value orange">{isUnlocked ? 'Unlocked' : 'Locked'}</div>
              <div className="stat-label">Session Status</div>
            </div>
            <div className="stat-card">
              <div className="stat-value blue">
                {wallets.reduce((sum, wallet) => sum + wallet.balance, 0).toFixed(4)}
              </div>
              <div className="stat-label">Total BNB Balance</div>
            </div>
            <div className="stat-card">
              <div className="stat-value green">{isValidConfig ? 'Valid' : 'Invalid'}</div>
              <div className="stat-label">Configuration</div>
            </div>
          </div>

          {/* Dynamic Content Based on Active Section */}
          {activeSection === 'dashboard' && (
            <>
              {/* Wallet Management Table */}
              <WalletTable />
            </>
          )}

          {activeSection === 'bundler' && (
            <>
              {/* Funding Management Panel */}
              <FundingPanel />
            </>
          )}

          {activeSection === 'config' && (
            <>
              {/* Bundle Configuration UI */}
              <BundleConfig />
            </>
          )}

          {activeSection === 'execution' && (
            <>
              {/* Bundle Execution Interface */}
              <BundleExecution onClose={() => setActiveSection('config')} />
            </>
          )}


          {activeSection === 'analytics' && (
            <>
              {/* Advanced Analytics Dashboard */}
              <AnalyticsDashboard />
            </>
          )}

        </main>
      </div>
    </QueryClientProvider>
  );
};

export default App;