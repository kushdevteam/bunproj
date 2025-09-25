/**
 * Admin Cleanup Component
 * Provides administrative functions to clear all user sessions and data
 * while preserving only the admin access key.
 */

import React, { useState } from 'react';
import { 
  performCompleteCleanup, 
  performSecureLogout, 
  verifyCleanupSuccess,
  DEFAULT_ADMIN_ACCESS_KEY 
} from '../utils/sessionCleanup';
import { useUserStore } from '../store/users';

const AdminCleanup: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string>('');
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');
  
  const userStore = useUserStore();
  const isAdmin = userStore.isAdmin();

  const showMessage = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => setMessage(''), 5000);
  };

  const handleCompleteCleanup = async () => {
    if (!window.confirm('⚠️ WARNING: This will clear ALL user sessions, data, and storage. Only the admin access key will be preserved. Continue?')) {
      return;
    }

    setIsLoading(true);
    try {
      await performCompleteCleanup();
      const verified = verifyCleanupSuccess();
      
      if (verified) {
        showMessage('✅ Complete cleanup successful! System reset to clean state.', 'success');
      } else {
        showMessage('⚠️ Cleanup completed but verification failed. Some data may remain.', 'error');
      }
    } catch (error) {
      console.error('Cleanup failed:', error);
      showMessage(`❌ Cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSecureLogout = async () => {
    setIsLoading(true);
    try {
      await performSecureLogout();
      showMessage('✅ Secure logout completed successfully.', 'success');
    } catch (error) {
      console.error('Secure logout failed:', error);
      showMessage(`❌ Secure logout failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCleanup = () => {
    const success = verifyCleanupSuccess();
    if (success) {
      showMessage('✅ System is clean! All session data cleared successfully.', 'success');
    } else {
      showMessage('⚠️ System still contains session data. Cleanup may be needed.', 'error');
    }
  };

  const handleTestAdminLogin = async () => {
    setIsLoading(true);
    try {
      const success = await userStore.loginWithAccessKey(DEFAULT_ADMIN_ACCESS_KEY);
      if (success) {
        showMessage('✅ Admin access key login successful!', 'success');
      } else {
        showMessage('❌ Admin access key login failed.', 'error');
      }
    } catch (error) {
      console.error('Admin login test failed:', error);
      showMessage(`❌ Admin login test failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="admin-cleanup-container">
        <h3>🔒 Access Denied</h3>
        <p>Admin access required to use cleanup utilities.</p>
        <div className="admin-login-section">
          <h4>Admin Access Key Login</h4>
          <p>Use the admin access key: <code>{DEFAULT_ADMIN_ACCESS_KEY}</code></p>
          <button onClick={handleTestAdminLogin} disabled={isLoading}>
            Login with Admin Key
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-cleanup-container">
      <h3>🧹 Admin System Cleanup</h3>
      <p><strong>Current Admin:</strong> {userStore.getCurrentUser()?.username || 'Unknown'}</p>
      <p><strong>Admin Access Key:</strong> <code>{DEFAULT_ADMIN_ACCESS_KEY}</code></p>
      
      {message && (
        <div className={`cleanup-message cleanup-message-${messageType}`}>
          {message}
        </div>
      )}

      <div className="cleanup-actions">
        
        <div className="action-group">
          <h4>🔐 Session Management</h4>
          <button 
            onClick={handleSecureLogout}
            disabled={isLoading}
            className="cleanup-button cleanup-button-secondary"
          >
            {isLoading ? '⏳ Processing...' : '🔐 Secure Logout'}
          </button>
          <small>Clear current session with proper crypto cleanup</small>
        </div>

        <div className="action-group">
          <h4>🧹 Complete System Reset</h4>
          <button 
            onClick={handleCompleteCleanup}
            disabled={isLoading}
            className="cleanup-button cleanup-button-danger"
          >
            {isLoading ? '⏳ Processing...' : '🧹 Complete Cleanup'}
          </button>
          <small>⚠️ WARNING: Clears ALL users, sessions, and data!</small>
        </div>

        <div className="action-group">
          <h4>✅ Verification</h4>
          <button 
            onClick={handleVerifyCleanup}
            disabled={isLoading}
            className="cleanup-button cleanup-button-secondary"
          >
            ✅ Verify Cleanup Status
          </button>
          <small>Check if system is in clean state</small>
        </div>

        <div className="action-group">
          <h4>🔑 Admin Access Test</h4>
          <button 
            onClick={handleTestAdminLogin}
            disabled={isLoading}
            className="cleanup-button cleanup-button-primary"
          >
            🔑 Test Admin Key Login
          </button>
          <small>Verify admin access key still works</small>
        </div>

      </div>

      <div className="cleanup-info-section">
        <h4>ℹ️ What does Complete Cleanup do?</h4>
        <ul className="cleanup-info-list">
          <li>✅ Clears all localStorage data (sessions, wallets, etc.)</li>
          <li>✅ Clears all IndexedDB encrypted data</li>
          <li>✅ Clears all in-memory session keys and passphrases</li>
          <li>✅ Resets all user accounts and sessions</li>
          <li>✅ Preserves ONLY the admin access key: {DEFAULT_ADMIN_ACCESS_KEY}</li>
          <li>✅ Fixes logout errors and session conflicts</li>
        </ul>
      </div>
    </div>
  );
};

export default AdminCleanup;