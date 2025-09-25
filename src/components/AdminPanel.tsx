/**
 * AdminPanel Component
 * Administrative interface for user creation and management
 */

import React, { useState, useEffect } from 'react';
import { useUserStore } from '../store/users';
import type { User, CreateUserRequest, UserRole } from '../store/users';
import './AdminPanel.css';

interface UserFormData {
  username: string;
  pin: string;
  confirmPin: string;
  role: UserRole;
}

export const AdminPanel: React.FC = () => {
  const {
    getAllUsers,
    createUser,
    updateUser,
    deleteUser,
    toggleUserStatus,
    getCurrentUser,
    isAdmin,
    logout,
    error,
    isLoading,
  } = useUserStore();

  const [users, setUsers] = useState<User[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<UserFormData>({
    username: '',
    pin: '',
    confirmPin: '',
    role: 'user',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'users' | 'settings' | 'logs'>('users');

  const currentUser = getCurrentUser();

  const refreshUsers = async () => {
    try {
      // First try to fetch from API
      const response = await fetch('/api/users');
      if (response.ok) {
        const apiResponse = await response.json();
        console.log('Fetched users from API:', apiResponse);
        
        // Extract users array from API response
        if (apiResponse.success && apiResponse.data && Array.isArray(apiResponse.data.users)) {
          setUsers(apiResponse.data.users);
        } else {
          console.warn('Unexpected API response format, falling back to local users');
          const allUsers = getAllUsers();
          setUsers(allUsers);
        }
      } else {
        // Fallback to local users
        const allUsers = getAllUsers();
        setUsers(allUsers);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      // Fallback to local users
      const allUsers = getAllUsers();
      setUsers(allUsers);
    }
  };

  // Load users on mount and refresh
  useEffect(() => {
    refreshUsers();
  }, []); // Only run once on mount

  // Handle form input changes
  const handleFormChange = (field: keyof UserFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setFormError(null);
  };

  // Validate form
  const validateForm = (): boolean => {
    if (!formData.username.trim()) {
      setFormError('Username is required');
      return false;
    }

    if (formData.username.length < 3 || formData.username.length > 20) {
      setFormError('Username must be 3-20 characters');
      return false;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(formData.username)) {
      setFormError('Username can only contain letters, numbers, underscore, and dash');
      return false;
    }

    if (!formData.pin) {
      setFormError('PIN is required');
      return false;
    }

    if (formData.pin.length !== 6) {
      setFormError('PIN must be exactly 6 digits');
      return false;
    }

    if (!/^\d+$/.test(formData.pin)) {
      setFormError('PIN can only contain numbers');
      return false;
    }

    if (formData.pin !== formData.confirmPin) {
      setFormError('PINs do not match');
      return false;
    }

    return true;
  };

  // Handle user creation
  const handleCreateUser = async () => {
    if (!validateForm()) return;

    const request: CreateUserRequest = {
      username: formData.username.trim().toLowerCase(),
      pin: formData.pin,
      role: formData.role,
    };

    const success = await createUser(request);
    if (success) {
      setFormData({ username: '', pin: '', confirmPin: '', role: 'user' });
      setShowCreateForm(false);
      // Wait a moment for the backend to process, then refresh
      setTimeout(() => {
        refreshUsers();
      }, 500);
      console.log('User created successfully');
    }
  };

  // Handle user deletion
  const handleDeleteUser = async (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;

    if (window.confirm(`Are you sure you want to delete user "${user.username}"? This action cannot be undone.`)) {
      const success = await deleteUser(userId);
      if (success) {
        refreshUsers();
        console.log('User deleted successfully');
      }
    }
  };

  // Handle user status toggle
  const handleToggleStatus = async (userId: string) => {
    const success = await toggleUserStatus(userId);
    if (success) {
      refreshUsers();
    }
  };

  // Clear form
  const clearForm = () => {
    setFormData({ username: '', pin: '', confirmPin: '', role: 'user' });
    setFormError(null);
    setShowCreateForm(false);
    setEditingUser(null);
  };

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
          <p>User Management & System Administration</p>
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
          className={`tab ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          👥 Users ({users.length})
        </button>
        <button
          className={`tab ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          ⚙️ Settings
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
        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="users-section">
            <div className="section-header">
              <h2>User Management</h2>
              <button
                onClick={() => setShowCreateForm(true)}
                className="create-button"
                disabled={isLoading}
              >
                ➕ Create User
              </button>
            </div>

            {/* Create User Form */}
            {showCreateForm && (
              <div className="create-form">
                <div className="form-header">
                  <h3>Create New User</h3>
                  <button onClick={clearForm} className="close-button">×</button>
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label>Username</label>
                    <input
                      type="text"
                      value={formData.username}
                      onChange={(e) => handleFormChange('username', e.target.value)}
                      placeholder="Enter username"
                      maxLength={20}
                    />
                  </div>

                  <div className="form-group">
                    <label>Role</label>
                    <select
                      value={formData.role}
                      onChange={(e) => handleFormChange('role', e.target.value as UserRole)}
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>6-Digit PIN</label>
                    <input
                      type="password"
                      value={formData.pin}
                      onChange={(e) => handleFormChange('pin', e.target.value)}
                      placeholder="Enter 6-digit PIN"
                      maxLength={6}
                      pattern="[0-9]*"
                    />
                  </div>

                  <div className="form-group">
                    <label>Confirm PIN</label>
                    <input
                      type="password"
                      value={formData.confirmPin}
                      onChange={(e) => handleFormChange('confirmPin', e.target.value)}
                      placeholder="Confirm PIN"
                      maxLength={6}
                      pattern="[0-9]*"
                    />
                  </div>
                </div>

                {formError && (
                  <div className="form-error">
                    ⚠️ {formError}
                  </div>
                )}

                {error && (
                  <div className="form-error">
                    ⚠️ {error}
                  </div>
                )}

                <div className="form-actions">
                  <button
                    onClick={handleCreateUser}
                    className="submit-button"
                    disabled={isLoading}
                  >
                    {isLoading ? 'Creating...' : 'Create User'}
                  </button>
                  <button onClick={clearForm} className="cancel-button">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Users List */}
            <div className="users-list">
              {users.length === 0 ? (
                <div className="empty-state">
                  <h3>No Users Found</h3>
                  <p>Create your first user to get started.</p>
                </div>
              ) : (
                <div className="users-table">
                  <div className="table-header">
                    <div className="col">Username</div>
                    <div className="col">Role</div>
                    <div className="col">Status</div>
                    <div className="col">Created</div>
                    <div className="col">Last Login</div>
                    <div className="col">Actions</div>
                  </div>

                  {users.map((user) => (
                    <div key={user.id} className="table-row">
                      <div className="col">
                        <div className="user-info">
                          <span className="username">{user.username}</span>
                          {user.role === 'admin' && <span className="admin-badge">👑</span>}
                        </div>
                      </div>
                      <div className="col">
                        <span className={`role-badge ${user.role}`}>
                          {user.role === 'admin' ? '👑 Admin' : '👤 User'}
                        </span>
                      </div>
                      <div className="col">
                        <span className={`status-badge ${user.isActive ? 'active' : 'inactive'}`}>
                          {user.isActive ? '🟢 Active' : '🔴 Inactive'}
                        </span>
                      </div>
                      <div className="col">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </div>
                      <div className="col">
                        {user.lastLoginAt 
                          ? new Date(user.lastLoginAt).toLocaleDateString()
                          : 'Never'
                        }
                      </div>
                      <div className="col">
                        <div className="action-buttons">
                          <button
                            onClick={() => handleToggleStatus(user.id)}
                            className={`action-button ${user.isActive ? 'deactivate' : 'activate'}`}
                            disabled={isLoading || user.role === 'admin'}
                            title={user.isActive ? 'Deactivate User' : 'Activate User'}
                          >
                            {user.isActive ? '⏸️' : '▶️'}
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            className="action-button delete"
                            disabled={isLoading || user.role === 'admin'}
                            title="Delete User"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="settings-section">
            <h2>System Settings</h2>
            <div className="settings-grid">
              <div className="setting-item">
                <h3>🔐 Security Settings</h3>
                <p>Configure authentication and security policies</p>
                <button className="setting-button">Configure</button>
              </div>
              <div className="setting-item">
                <h3>📊 System Monitoring</h3>
                <p>View system performance and health metrics</p>
                <button className="setting-button">View Metrics</button>
              </div>
              <div className="setting-item">
                <h3>🔄 Data Management</h3>
                <p>Backup, restore, and manage application data</p>
                <button className="setting-button">Manage Data</button>
              </div>
            </div>
          </div>
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
      </div>

    </div>
  );
};