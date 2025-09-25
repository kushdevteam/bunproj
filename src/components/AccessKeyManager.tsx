/**
 * AccessKeyManager Component
 * Admin panel for creating and managing access keys
 */

import React, { useState } from 'react';
import { useUserStore, UserRole } from '../store/users';
import './AccessKeyManager.css';

export const AccessKeyManager: React.FC = () => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newKeyLabel, setNewKeyLabel] = useState('');
  const [newKeyRole, setNewKeyRole] = useState<UserRole>('user');
  const [createdKey, setCreatedKey] = useState<string>('');
  const [showKey, setShowKey] = useState<string>('');

  const { 
    accessKeys, 
    adminAccessKey,
    createAccessKey, 
    updateAccessKey, 
    deleteAccessKey, 
    toggleAccessKeyStatus,
    isLoading,
    error 
  } = useUserStore();

  const handleCreateKey = async () => {
    if (!newKeyLabel.trim()) {
      return;
    }

    const newKey = await createAccessKey(newKeyLabel, newKeyRole);
    
    if (newKey) {
      setCreatedKey(newKey);
      setNewKeyLabel('');
      setNewKeyRole('user');
      setShowCreateForm(false);
    }
  };

  const handleDeleteKey = async (keyId: string) => {
    if (window.confirm('Are you sure you want to delete this access key?')) {
      await deleteAccessKey(keyId);
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString() + ' ' + new Date(date).toLocaleTimeString();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      alert('Access key copied to clipboard!');
    });
  };

  const toggleKeyVisibility = (keyId: string) => {
    setShowKey(showKey === keyId ? '' : keyId);
  };

  return (
    <div className="access-key-manager">
      <div className="akm-header">
        <h2>Access Key Management</h2>
        <button 
          className="create-key-btn"
          onClick={() => setShowCreateForm(true)}
          disabled={isLoading}
        >
          + Create New Key
        </button>
      </div>

      {error && (
        <div className="akm-error">
          <span className="error-icon">⚠️</span>
          {error}
        </div>
      )}

      {/* Admin Master Key Section */}
      <div className="admin-key-section">
        <h3>Master Admin Key</h3>
        <div className="key-card admin-key">
          <div className="key-info">
            <div className="key-label">
              <strong>Master Admin Access</strong>
              <span className="key-role admin">Admin</span>
            </div>
            <div className="key-value">
              <code className="key-display">
                {showKey === 'admin' ? adminAccessKey : '••••••••••••••••••••••••••'}
              </code>
              <div className="key-actions">
                <button
                  className="action-btn toggle"
                  onClick={() => toggleKeyVisibility('admin')}
                  title={showKey === 'admin' ? 'Hide key' : 'Show key'}
                >
                  {showKey === 'admin' ? '👁️‍🗨️' : '👁️'}
                </button>
                <button
                  className="action-btn copy"
                  onClick={() => copyToClipboard(adminAccessKey)}
                  title="Copy to clipboard"
                >
                  📋
                </button>
              </div>
            </div>
            <div className="key-meta">
              <span className="status active">Always Active</span>
              <span className="created">System Generated</span>
            </div>
          </div>
        </div>
      </div>

      {/* Created Keys Section */}
      <div className="created-keys-section">
        <h3>Generated Access Keys ({accessKeys.length})</h3>
        
        {accessKeys.length === 0 ? (
          <div className="no-keys">
            <p>No access keys have been created yet.</p>
            <small>Create your first access key to get started.</small>
          </div>
        ) : (
          <div className="keys-list">
            {accessKeys.map((key) => (
              <div key={key.id} className={`key-card ${key.isActive ? 'active' : 'inactive'}`}>
                <div className="key-info">
                  <div className="key-label">
                    <strong>{key.label}</strong>
                    <span className={`key-role ${key.role}`}>{key.role}</span>
                  </div>
                  <div className="key-value">
                    <code className="key-display">
                      {showKey === key.id ? key.key : '••••••••••••••••••••••••••'}
                    </code>
                    <div className="key-actions">
                      <button
                        className="action-btn toggle"
                        onClick={() => toggleKeyVisibility(key.id)}
                        title={showKey === key.id ? 'Hide key' : 'Show key'}
                      >
                        {showKey === key.id ? '👁️‍🗨️' : '👁️'}
                      </button>
                      <button
                        className="action-btn copy"
                        onClick={() => copyToClipboard(key.key)}
                        title="Copy to clipboard"
                      >
                        📋
                      </button>
                      <button
                        className="action-btn toggle-status"
                        onClick={() => toggleAccessKeyStatus(key.id)}
                        title={key.isActive ? 'Deactivate key' : 'Activate key'}
                      >
                        {key.isActive ? '🔴' : '🟢'}
                      </button>
                      <button
                        className="action-btn delete"
                        onClick={() => handleDeleteKey(key.id)}
                        title="Delete key"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                  <div className="key-meta">
                    <span className={`status ${key.isActive ? 'active' : 'inactive'}`}>
                      {key.isActive ? 'Active' : 'Inactive'}
                    </span>
                    <span className="created">Created: {formatDate(key.createdAt)}</span>
                    {key.lastUsedAt && (
                      <span className="last-used">Last used: {formatDate(key.lastUsedAt)}</span>
                    )}
                    {key.expiresAt && (
                      <span className="expires">Expires: {formatDate(key.expiresAt)}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Key Modal */}
      {showCreateForm && (
        <div className="modal-overlay">
          <div className="create-key-modal">
            <div className="modal-header">
              <h3>Create New Access Key</h3>
              <button
                className="modal-close"
                onClick={() => setShowCreateForm(false)}
              >
                ×
              </button>
            </div>
            
            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="keyLabel">Key Label</label>
                <input
                  id="keyLabel"
                  type="text"
                  value={newKeyLabel}
                  onChange={(e) => setNewKeyLabel(e.target.value)}
                  placeholder="e.g., Client Access, API Key, etc."
                  maxLength={50}
                />
              </div>

              <div className="form-group">
                <label htmlFor="keyRole">Role</label>
                <select
                  id="keyRole"
                  value={newKeyRole}
                  onChange={(e) => setNewKeyRole(e.target.value as UserRole)}
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

            </div>

            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => setShowCreateForm(false)}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleCreateKey}
                disabled={!newKeyLabel.trim() || isLoading}
              >
                {isLoading ? 'Creating...' : 'Create Access Key'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal for New Key */}
      {createdKey && (
        <div className="modal-overlay">
          <div className="success-modal">
            <div className="modal-header">
              <h3>✅ Access Key Created</h3>
            </div>
            
            <div className="modal-body">
              <p><strong>Your new access key has been created successfully!</strong></p>
              <p>Please copy and save this key securely. You won't be able to see it again.</p>
              
              <div className="created-key-display">
                <code>{createdKey}</code>
                <button
                  className="copy-btn"
                  onClick={() => copyToClipboard(createdKey)}
                >
                  📋 Copy Key
                </button>
              </div>
              
              <div className="security-warning">
                ⚠️ <strong>Important:</strong> Store this key securely. Anyone with this key can access your system.
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn-primary"
                onClick={() => setCreatedKey('')}
              >
                I've Saved It
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};