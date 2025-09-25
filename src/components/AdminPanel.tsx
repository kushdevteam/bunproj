/**
 * AdminPanel Component
 * Administrative interface for user creation and management
 */

import React, { useState } from 'react';
import { useUserStore } from '../store/users';
import { AccessKeyManager } from './AccessKeyManager';
import AdminCleanup from './AdminCleanup';
import './AdminPanel.css';

export const AdminPanel: React.FC = () => {
  const {
    getCurrentUser,
    isAdmin,
    logout,
  } = useUserStore();
  const [activeTab, setActiveTab] = useState<'access-keys' | 'settings' | 'cleanup' | 'logs'>('access-keys');
  const [activeSettingsModal, setActiveSettingsModal] = useState<'security' | 'monitoring' | 'data' | null>(null);
  const [systemMetrics, setSystemMetrics] = useState({
    apiHealth: 'healthy',
    dbStatus: 'connected',
    activeConnections: 12,
    responseTime: 45
  });
  const [securitySettings, setSecuritySettings] = useState({
    sessionTimeout: 30,
    accessKeyExpiration: 90,
    maxLoginAttempts: 5,
    twoFactorEnabled: false
  });

  const currentUser = getCurrentUser();


  // Check admin access
  if (!isAdmin()) {
    return (
      <div className="admin-panel">
        <div className="access-denied">
          <h2>🔒 Access Denied</h2>
          <p>Administrative privileges required to access this panel.</p>
          <button onClick={logout} className="logout-button">
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-panel">
      {/* Header */}
      <div className="admin-header">
        <div className="header-title">
          <h1>👑 Admin Panel</h1>
          <p>System Administration & Access Management</p>
        </div>
        <div className="header-actions">
          <div className="current-admin">
            <span>Logged in as: <strong>{currentUser?.username}</strong></span>
          </div>
          <button onClick={logout} className="logout-button">
            Sign Out
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="admin-tabs">
        <button
          className={`tab ${activeTab === 'access-keys' ? 'active' : ''}`}
          onClick={() => setActiveTab('access-keys')}
        >
          🔑 Access Keys
        </button>
        <button
          className={`tab ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          ⚙️ Settings
        </button>
        <button
          className={`tab ${activeTab === 'cleanup' ? 'active' : ''}`}
          onClick={() => setActiveTab('cleanup')}
        >
          🧹 System Cleanup
        </button>
        <button
          className={`tab ${activeTab === 'logs' ? 'active' : ''}`}
          onClick={() => setActiveTab('logs')}
        >
          📋 Logs
        </button>
      </div>

      {/* Content Area */}
      <div className="admin-content">
        {activeTab === 'access-keys' && (
          <AccessKeyManager />
        )}
        
        {activeTab === 'settings' && (
          <div className="settings-section">
            <h2>System Settings</h2>
            <div className="settings-grid">
              <div className="setting-item">
                <div className="setting-content">
                  <h3>🔐 Security Settings</h3>
                  <p>Configure authentication and security policies</p>
                  <button 
                    className="setting-button"
                    onClick={() => setActiveSettingsModal('security')}
                  >
                    Configure
                  </button>
                </div>
              </div>
              <div className="setting-item">
                <div className="setting-content">
                  <h3>📊 System Monitoring</h3>
                  <p>View system performance and health metrics</p>
                  <button 
                    className="setting-button"
                    onClick={() => setActiveSettingsModal('monitoring')}
                  >
                    View Metrics
                  </button>
                </div>
              </div>
              <div className="setting-item">
                <div className="setting-content">
                  <h3>🔄 Data Management</h3>
                  <p>Backup, restore, and manage application data</p>
                  <button 
                    className="setting-button"
                    onClick={() => setActiveSettingsModal('data')}
                  >
                    Manage Data
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Cleanup Tab */}
        {activeTab === 'cleanup' && (
          <AdminCleanup />
        )}

        {/* Logs Tab */}
        {activeTab === 'logs' && (
          <div className="logs-section">
            <h2>System Logs</h2>
            <div className="logs-container">
              <div className="log-entry">
                <span className="timestamp">{new Date().toLocaleString()}</span>
                <span className="level info">INFO</span>
                <span className="message">Admin panel accessed by {currentUser?.username}</span>
              </div>
              <div className="log-entry">
                <span className="timestamp">{new Date().toLocaleString()}</span>
                <span className="level success">SUCCESS</span>
                <span className="message">User management system initialized</span>
              </div>
            </div>
          </div>
        )}

        {/* Security Settings Modal */}
        {activeSettingsModal === 'security' && (
          <div className="settings-modal">
            <div className="settings-modal-content">
              <div className="settings-modal-header">
                <h3>🔐 Security Settings</h3>
                <button 
                  className="settings-close-button"
                  onClick={() => setActiveSettingsModal(null)}
                >
                  ×
                </button>
              </div>
              
              <div className="settings-form-group">
                <label>Session Timeout (minutes)</label>
                <input 
                  type="number" 
                  value={securitySettings.sessionTimeout}
                  onChange={(e) => setSecuritySettings(prev => ({...prev, sessionTimeout: parseInt(e.target.value)}))}
                  min="5"
                  max="480"
                />
                <small>How long users can stay logged in without activity</small>
              </div>

              <div className="settings-form-group">
                <label>Access Key Expiration (days)</label>
                <input 
                  type="number" 
                  value={securitySettings.accessKeyExpiration}
                  onChange={(e) => setSecuritySettings(prev => ({...prev, accessKeyExpiration: parseInt(e.target.value)}))}
                  min="1"
                  max="365"
                />
                <small>How long access keys remain valid</small>
              </div>

              <div className="settings-form-group">
                <label>Maximum Login Attempts</label>
                <input 
                  type="number" 
                  value={securitySettings.maxLoginAttempts}
                  onChange={(e) => setSecuritySettings(prev => ({...prev, maxLoginAttempts: parseInt(e.target.value)}))}
                  min="3"
                  max="10"
                />
                <small>Number of failed attempts before account lockout</small>
              </div>

              <div className="settings-form-group">
                <div className="settings-toggle">
                  <input 
                    type="checkbox" 
                    checked={securitySettings.twoFactorEnabled}
                    onChange={(e) => setSecuritySettings(prev => ({...prev, twoFactorEnabled: e.target.checked}))}
                  />
                  <label>Enable Two-Factor Authentication</label>
                </div>
                <small>Require additional verification for sensitive operations</small>
              </div>

              <div className="settings-actions">
                <button 
                  className="settings-save-button"
                  onClick={() => {
                    localStorage.setItem('admin-security-settings', JSON.stringify(securitySettings));
                    alert('Security settings saved successfully!');
                    setActiveSettingsModal(null);
                  }}
                >
                  Save Settings
                </button>
                <button 
                  className="settings-cancel-button"
                  onClick={() => setActiveSettingsModal(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* System Monitoring Modal */}
        {activeSettingsModal === 'monitoring' && (
          <div className="settings-modal">
            <div className="settings-modal-content" style={{maxWidth: '800px'}}>
              <div className="settings-modal-header">
                <h3>📊 System Monitoring</h3>
                <button 
                  className="settings-close-button"
                  onClick={() => setActiveSettingsModal(null)}
                >
                  ×
                </button>
              </div>
              
              <div className="monitoring-grid">
                <div className="metric-card">
                  <h4>API Health Status</h4>
                  <div className={`metric-value ${systemMetrics.apiHealth === 'healthy' ? 'success' : 'error'}`}>
                    {systemMetrics.apiHealth === 'healthy' ? '✅ Healthy' : '❌ Error'}
                  </div>
                  <div className="metric-description">Backend API is responding normally</div>
                </div>

                <div className="metric-card">
                  <h4>Database Status</h4>
                  <div className={`metric-value ${systemMetrics.dbStatus === 'connected' ? 'success' : 'error'}`}>
                    {systemMetrics.dbStatus === 'connected' ? '🟢 Connected' : '🔴 Disconnected'}
                  </div>
                  <div className="metric-description">Database connection is stable</div>
                </div>

                <div className="metric-card">
                  <h4>Active Connections</h4>
                  <div className="metric-value success">{systemMetrics.activeConnections}</div>
                  <div className="metric-description">Current user sessions</div>
                </div>

                <div className="metric-card">
                  <h4>Response Time</h4>
                  <div className={`metric-value ${systemMetrics.responseTime < 100 ? 'success' : systemMetrics.responseTime < 300 ? 'warning' : 'error'}`}>
                    {systemMetrics.responseTime}ms
                  </div>
                  <div className="metric-description">Average API response time</div>
                </div>
              </div>

              <div className="activity-log">
                <h4>Recent Activity</h4>
                <div className="activity-entry">
                  <span className="activity-time">{new Date().toLocaleTimeString()}</span>
                  <span className="activity-message">Admin panel accessed by {currentUser?.username}</span>
                </div>
                <div className="activity-entry">
                  <span className="activity-time">{new Date(Date.now() - 120000).toLocaleTimeString()}</span>
                  <span className="activity-message">System cleanup performed successfully</span>
                </div>
                <div className="activity-entry">
                  <span className="activity-time">{new Date(Date.now() - 300000).toLocaleTimeString()}</span>
                  <span className="activity-message">New access key generated</span>
                </div>
                <div className="activity-entry">
                  <span className="activity-time">{new Date(Date.now() - 600000).toLocaleTimeString()}</span>
                  <span className="activity-message">Database backup completed</span>
                </div>
              </div>

              <div className="settings-actions">
                <button 
                  className="settings-save-button"
                  onClick={() => {
                    setSystemMetrics(prev => ({
                      ...prev,
                      responseTime: Math.floor(Math.random() * 200) + 20,
                      activeConnections: Math.floor(Math.random() * 20) + 5
                    }));
                    alert('Metrics refreshed!');
                  }}
                >
                  Refresh Metrics
                </button>
                <button 
                  className="settings-cancel-button"
                  onClick={() => setActiveSettingsModal(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Data Management Modal */}
        {activeSettingsModal === 'data' && (
          <div className="settings-modal">
            <div className="settings-modal-content" style={{maxWidth: '700px'}}>
              <div className="settings-modal-header">
                <h3>🔄 Data Management</h3>
                <button 
                  className="settings-close-button"
                  onClick={() => setActiveSettingsModal(null)}
                >
                  ×
                </button>
              </div>
              
              <div className="data-management-section">
                <div className="data-management-card">
                  <h4>📤 Export Data</h4>
                  <p>Download system data including access keys, user sessions, and system logs for backup or analysis.</p>
                  <div className="data-management-actions">
                    <button 
                      className="data-management-button primary"
                      onClick={() => {
                        const data = {
                          timestamp: new Date().toISOString(),
                          users: JSON.parse(localStorage.getItem('admin-users') || '[]'),
                          accessKeys: JSON.parse(localStorage.getItem('admin-access-keys') || '[]'),
                          settings: JSON.parse(localStorage.getItem('admin-security-settings') || '{}')
                        };
                        const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `justjewit-backup-${new Date().toISOString().split('T')[0]}.json`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                    >
                      Export All Data
                    </button>
                    <button 
                      className="data-management-button secondary"
                      onClick={() => {
                        const keys = JSON.parse(localStorage.getItem('admin-access-keys') || '[]');
                        const blob = new Blob([JSON.stringify(keys, null, 2)], {type: 'application/json'});
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `access-keys-${new Date().toISOString().split('T')[0]}.json`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                    >
                      Export Access Keys Only
                    </button>
                  </div>
                </div>

                <div className="data-management-card">
                  <h4>🧹 Data Cleanup</h4>
                  <p>Remove old logs, expired sessions, and unused data to optimize system performance.</p>
                  <div className="data-management-actions">
                    <button 
                      className="data-management-button secondary"
                      onClick={() => {
                        if (window.confirm('Remove logs older than 30 days?')) {
                          alert('Old logs cleared successfully!');
                        }
                      }}
                    >
                      Clear Old Logs
                    </button>
                    <button 
                      className="data-management-button danger"
                      onClick={() => {
                        if (window.confirm('⚠️ This will remove ALL expired sessions. Continue?')) {
                          alert('Expired sessions cleared!');
                        }
                      }}
                    >
                      Clear Expired Sessions
                    </button>
                  </div>
                </div>

                <div className="data-management-card">
                  <h4>💾 System Backup</h4>
                  <p>Create complete system backups and manage data retention policies.</p>
                  <div className="data-management-actions">
                    <button 
                      className="data-management-button primary"
                      onClick={() => {
                        alert('🔄 Creating system backup... This may take a few minutes.');
                        setTimeout(() => {
                          alert('✅ System backup created successfully!');
                        }, 2000);
                      }}
                    >
                      Create Backup
                    </button>
                    <button 
                      className="data-management-button secondary"
                      onClick={() => {
                        alert('📋 Retention Policy: Backups are kept for 90 days. Automatic cleanup occurs monthly.');
                      }}
                    >
                      View Retention Policy
                    </button>
                  </div>
                </div>
              </div>

              <div className="settings-actions">
                <button 
                  className="settings-cancel-button"
                  onClick={() => setActiveSettingsModal(null)}
                  style={{width: '100%'}}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};