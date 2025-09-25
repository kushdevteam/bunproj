/**
 * AccessKeyLogin Component
 * Modern access key authentication interface matching the Proxima design
 */

import React, { useState, useRef, useEffect } from 'react';
import { useUserStore } from '../store/users';
import './AccessKeyLogin.css';

export const AccessKeyLogin: React.FC = () => {
  const [accessKey, setAccessKey] = useState('');
  const [isLogging, setIsLogging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  
  const { loginWithAccessKey, error: userError, isLoading } = useUserStore();
  const accessKeyInputRef = useRef<HTMLInputElement>(null);

  // Focus access key input on mount
  useEffect(() => {
    accessKeyInputRef.current?.focus();
  }, []);

  // Handle access key change
  const handleAccessKeyChange = (value: string) => {
    setAccessKey(value.trim());
    setError(null);
  };

  // Handle enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && accessKey.length >= 10) {
      handleLogin();
    }
  };

  // Handle login submission
  const handleLogin = async () => {
    if (!accessKey || accessKey.length < 10) {
      setError('Please enter a valid access key');
      return;
    }

    if (isLocked) {
      setError('Access temporarily restricted. Please try again later.');
      return;
    }

    setIsLogging(true);
    setError(null);

    try {
      const success = await loginWithAccessKey(accessKey);
      
      if (success) {
        console.log('Access granted!');
        // Component will unmount as user is now authenticated
      } else {
        setAttempts(prev => prev + 1);
        
        if (attempts >= 4) {
          setIsLocked(true);
          setError('Too many failed attempts. Access restricted for security.');
          setTimeout(() => {
            setIsLocked(false);
            setAttempts(0);
          }, 60000); // 1 minute lockout
        } else {
          setError(userError || `Invalid access key. ${5 - attempts} attempts remaining.`);
        }
        
        // Clear form on failure
        setAccessKey('');
        accessKeyInputRef.current?.focus();
      }
    } catch (error) {
      setError('Authentication failed. Please check your access key.');
      setAccessKey('');
      accessKeyInputRef.current?.focus();
    } finally {
      setIsLogging(false);
    }
  };

  return (
    <div className="access-key-login-container">
      <div className="background-swirl"></div>
      
      <div className="login-card">
        <div className="login-header">
          <h1>Welcome to JustJewIt.</h1>
          <p>Enter your access key to start</p>
        </div>

        <div className="access-key-form">
          <div className="loading-dots">
            <div className="dot"></div>
            <div className="dot"></div>
            <div className="dot"></div>
          </div>
          
          <div className="access-key-input-container">
            <input
              ref={accessKeyInputRef}
              type="text"
              value={accessKey}
              onChange={(e) => handleAccessKeyChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="WLSFX-MTWWGD2nn0RukqMlLw"
              className={`access-key-input ${error ? 'error' : ''}`}
              disabled={isLogging || isLoading || isLocked}
              autoComplete="off"
              spellCheck="false"
              maxLength={50}
            />
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={!accessKey || accessKey.length < 10 || isLogging || isLoading || isLocked}
            className="enter-button"
          >
            {isLogging || isLoading ? 'Authenticating...' : 'Enter'}
          </button>
        </div>

        <div className="security-info">
          <a 
            href="https://t.me/wlsfx" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="telegram-link"
          >
            <span className="security-dot"></span>
            📱 @wlsfx
          </a>
        </div>
      </div>
    </div>
  );
};