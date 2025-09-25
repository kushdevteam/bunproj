/**
 * LoginForm Component
 * Username + PIN authentication interface replacing the old PIN-only QuickUnlock
 */

import React, { useState, useRef, useEffect } from 'react';
import { useUserStore } from '../store/users';
import './LoginForm.css';

export const LoginForm: React.FC = () => {
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [isLogging, setIsLogging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [showDemo, setShowDemo] = useState(true);
  
  const { login, error: userError, isLoading } = useUserStore();
  const usernameInputRef = useRef<HTMLInputElement>(null);
  const pinInputRefs = useRef<HTMLInputElement[]>([]);

  // Focus username input on mount
  useEffect(() => {
    usernameInputRef.current?.focus();
  }, []);

  // Handle username change
  const handleUsernameChange = (value: string) => {
    setUsername(value.toLowerCase().trim());
    setError(null);
  };

  // Handle PIN input with auto-focus next field
  const handlePinChange = (index: number, value: string) => {
    if (value.length > 1) return; // Only allow single digits
    
    const newPin = pin.split('');
    newPin[index] = value;
    const updatedPin = newPin.join('');
    
    setPin(updatedPin);
    setError(null);
    
    // Auto-focus next input
    if (value && index < 5) {
      pinInputRefs.current[index + 1]?.focus();
    }
  };

  // Handle backspace to focus previous field
  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      pinInputRefs.current[index - 1]?.focus();
    }
    
    if (e.key === 'Enter' && username && pin.length === 6) {
      handleLogin();
    }
  };

  // Handle username input enter key
  const handleUsernameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && username) {
      pinInputRefs.current[0]?.focus();
    }
  };

  // Handle login submission
  const handleLogin = async () => {
    if (!username || pin.length !== 6) {
      setError('Please enter username and 6-digit PIN');
      return;
    }

    if (isLocked) {
      setError('Account locked. Please try again later.');
      return;
    }

    setIsLogging(true);
    setError(null);

    try {
      const success = await login({ username, pin });
      
      if (success) {
        console.log('Login successful!');
        // Component will unmount as user is now authenticated
      } else {
        setAttempts(prev => prev + 1);
        
        if (attempts >= 4) {
          setIsLocked(true);
          setError('Too many failed attempts. Account locked for security.');
          // In production, implement proper lockout logic
          setTimeout(() => {
            setIsLocked(false);
            setAttempts(0);
          }, 30000); // 30 second lockout for demo
        } else {
          setError(userError || `Login failed. ${5 - attempts} attempts remaining.`);
        }
        
        // Clear form on failure
        setPin('');
        setUsername('');
        usernameInputRef.current?.focus();
      }
    } catch (error) {
      setError('Login failed. Please try again.');
      setPin('');
      setUsername('');
      usernameInputRef.current?.focus();
    } finally {
      setIsLogging(false);
    }
  };

  // Handle demo login
  const handleDemoAdmin = () => {
    setUsername('walshadmin');
    setPin('612599');
    setTimeout(() => handleLogin(), 100);
  };

  const handleDemoUser = () => {
    setUsername('demo');
    setPin('123456');
    setTimeout(() => handleLogin(), 100);
  };

  // Clear form
  const clearForm = () => {
    setUsername('');
    setPin('');
    setError(null);
    usernameInputRef.current?.focus();
  };

  return (
    <div className="login-container">
      <div className="login-form">
        {/* Header */}
        <div className="login-header">
          <div className="logo-section">
            <div className="logo">💎</div>
            <h1>JustJewIt</h1>
            <p>Multi-Wallet Bundler Pro</p>
          </div>
        </div>

        {/* Authentication Form */}
        <div className="auth-form">
          <h2>Sign In</h2>
          
          {/* Username Input */}
          <div className="input-group">
            <label htmlFor="username">Username</label>
            <input
              ref={usernameInputRef}
              id="username"
              type="text"
              value={username}
              onChange={(e) => handleUsernameChange(e.target.value)}
              onKeyDown={handleUsernameKeyDown}
              placeholder="Enter your username"
              className={`username-input ${error ? 'error' : ''}`}
              disabled={isLogging || isLoading}
              autoComplete="username"
              maxLength={20}
            />
          </div>

          {/* PIN Input */}
          <div className="input-group">
            <label htmlFor="pin">6-Digit PIN</label>
            <div className="pin-input-container">
              {Array.from({ length: 6 }, (_, index) => (
                <input
                  key={index}
                  ref={(el) => {
                    if (el) {
                      pinInputRefs.current[index] = el;
                    }
                  }}
                  type="password"
                  inputMode="numeric"
                  value={pin[index] || ''}
                  onChange={(e) => handlePinChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className={`pin-digit ${error ? 'error' : ''}`}
                  disabled={isLogging || isLoading}
                  maxLength={1}
                  pattern="[0-9]*"
                />
              ))}
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="error-message">
              ⚠️ {error}
            </div>
          )}

          {/* Login Button */}
          <button
            onClick={handleLogin}
            disabled={!username || pin.length !== 6 || isLogging || isLoading || isLocked}
            className={`login-button ${(!username || pin.length !== 6) ? 'disabled' : ''}`}
          >
            {isLogging || isLoading ? (
              <>
                <span className="spinner">⏳</span>
                Signing In...
              </>
            ) : (
              'Sign In'
            )}
          </button>

          {/* Clear Button */}
          <button
            onClick={clearForm}
            className="clear-button"
            disabled={isLogging || isLoading}
          >
            Clear
          </button>
        </div>

        {/* Demo Section */}
        {showDemo && (
          <div className="demo-section">
            <div className="demo-header">
              <h3>Quick Demo Access</h3>
              <button 
                className="demo-toggle"
                onClick={() => setShowDemo(false)}
                title="Hide demo options"
              >
                ×
              </button>
            </div>
            
            <div className="demo-buttons">
              <button
                onClick={handleDemoAdmin}
                className="demo-button admin"
                disabled={isLogging || isLoading}
              >
                👑 Admin Login
                <small>walshadmin / 612599</small>
              </button>
              
              <button
                onClick={handleDemoUser}
                className="demo-button user"
                disabled={isLogging || isLoading}
              >
                👤 Demo User
                <small>demo / 123456</small>
              </button>
            </div>
            
            <p className="demo-note">
              Demo accounts for testing purposes. In production, create your own users.
            </p>
          </div>
        )}

        {/* Help Section */}
        <div className="help-section">
          <h4>Need Help?</h4>
          <ul>
            <li>Username: 3-20 characters, letters, numbers, underscore, dash</li>
            <li>PIN: Exactly 6 digits (numbers only)</li>
            <li>Admin access: Contact system administrator</li>
            <li>Forgot credentials: Use account recovery options</li>
          </ul>
        </div>

        {/* Status Indicators */}
        <div className="status-indicators">
          <div className="indicator">
            <span className="status-dot online"></span>
            System Online
          </div>
          <div className="indicator">
            <span className="status-dot secure"></span>
            Secure Connection
          </div>
        </div>
      </div>

    </div>
  );
};