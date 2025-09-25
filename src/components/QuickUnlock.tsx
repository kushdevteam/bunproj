/**
 * JustJewIt Landing Page with PIN-based Authentication
 * Professional dedicated landing page replacing the old popup overlay
 */

import React, { useState, useRef, useEffect } from 'react';
import { useSessionStore } from '../store/session';

const DEMO_PIN = '123456'; // Demo PIN for development

export const QuickUnlock: React.FC = () => {
  const [pin, setPin] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDemo, setShowDemo] = useState(true);
  const [attempts, setAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  
  const unlock = useSessionStore(state => state.unlock);
  const pinInputRefs = useRef<HTMLInputElement[]>([]);

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
    
    if (e.key === 'Enter' && pin.length === 6) {
      handleUnlock();
    }
  };

  // Handle PIN submission
  const handleUnlock = async () => {
    if (pin.length !== 6) {
      setError('PIN must be 6 digits');
      return;
    }

    if (isLocked) {
      setError('Account locked. Please try again later.');
      return;
    }

    setIsUnlocking(true);
    setError(null);

    try {
      // Convert PIN to passphrase format for existing session system
      const passphrase = pin === DEMO_PIN ? 'demo123' : pin;
      await unlock(passphrase);
      console.log('JustJewIt session unlocked successfully!');
    } catch (error) {
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
        setError(`Invalid PIN. ${5 - attempts} attempts remaining.`);
      }
      
      setPin('');
      pinInputRefs.current[0]?.focus();
    } finally {
      setIsUnlocking(false);
    }
  };

  // Handle demo unlock
  const handleDemoUnlock = () => {
    setPin(DEMO_PIN);
    setTimeout(() => handleUnlock(), 100);
  };

  // Auto-submit when PIN is complete
  useEffect(() => {
    if (pin.length === 6 && !isUnlocking) {
      handleUnlock();
    }
  }, [pin, isUnlocking]);

  // Clear PIN
  const clearPin = () => {
    setPin('');
    setError(null);
    pinInputRefs.current[0]?.focus();
  };

  return (
    <div className="unlock-landing-page">
      {/* Background with animated gradient */}
      <div className="unlock-background">
        <div className="gradient-orb orb-1"></div>
        <div className="gradient-orb orb-2"></div>
        <div className="gradient-orb orb-3"></div>
      </div>

      {/* Main Content */}
      <div className="unlock-container">
        {/* Header */}
        <div className="unlock-header">
          <div className="logo-large">
            <i className="fas fa-gem"></i>
            <h1>JustJewIt</h1>
          </div>
          <p className="tagline">Professional Multi-Wallet Bundler</p>
          <div className="version-badge">v1.0</div>
        </div>

        {/* PIN Entry Form */}
        <div className="unlock-form">
          <h2>Enter Your PIN</h2>
          <p className="form-description">
            {showDemo 
              ? 'Enter your 6-digit PIN or use the demo access below'
              : 'Enter your secure 6-digit PIN to access your account'
            }
          </p>

          {/* PIN Input Grid */}
          <div className="pin-input-container">
            <div className="pin-inputs">
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <input
                  key={index}
                  ref={(el) => {
                    if (el) pinInputRefs.current[index] = el;
                  }}
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]"
                  maxLength={1}
                  value={pin[index] || ''}
                  onChange={(e) => handlePinChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className={`pin-input ${error ? 'error' : ''} ${pin[index] ? 'filled' : ''}`}
                  disabled={isUnlocking || isLocked}
                  autoComplete="off"
                />
              ))}
            </div>

            {/* PIN Actions */}
            <div className="pin-actions">
              <button
                onClick={clearPin}
                className="btn-clear"
                disabled={isUnlocking || !pin}
              >
                <i className="fas fa-backspace"></i>
                Clear
              </button>
              
              <button
                onClick={handleUnlock}
                disabled={pin.length !== 6 || isUnlocking || isLocked}
                className="btn-unlock"
              >
                {isUnlocking ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i>
                    Unlocking...
                  </>
                ) : (
                  <>
                    <i className="fas fa-unlock"></i>
                    Unlock
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="error-message">
              <i className="fas fa-exclamation-triangle"></i>
              {error}
            </div>
          )}

          {/* Demo Access */}
          {showDemo && !isLocked && (
            <div className="demo-section">
              <div className="demo-divider">
                <span>Demo Access</span>
              </div>
              
              <button
                onClick={handleDemoUnlock}
                disabled={isUnlocking}
                className="btn-demo"
              >
                <i className="fas fa-play"></i>
                Try Demo (PIN: {DEMO_PIN})
              </button>
              
              <p className="demo-note">
                First time? The demo creates a temporary session for testing.
              </p>
            </div>
          )}

          {/* Security Notice */}
          <div className="security-notice">
            <div className="security-features">
              <div className="security-feature">
                <i className="fas fa-shield-alt"></i>
                <span>End-to-End Encrypted</span>
              </div>
              <div className="security-feature">
                <i className="fas fa-key"></i>
                <span>Your Keys, Your Control</span>
              </div>
              <div className="security-feature">
                <i className="fas fa-lock"></i>
                <span>Non-Custodial Security</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="unlock-footer">
          <p>© 2024 JustJewIt. Professional blockchain tools.</p>
          <div className="footer-links">
            <span>Secure</span>
            <span>•</span>
            <span>Private</span>
            <span>•</span>
            <span>Professional</span>
          </div>
        </div>
      </div>

      <style>{`
        .unlock-landing-page {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-primary, #0a0a0a);
          color: var(--text-primary, #fff);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          overflow: hidden;
        }

        .unlock-background {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          overflow: hidden;
        }

        .gradient-orb {
          position: absolute;
          border-radius: 50%;
          opacity: 0.3;
          animation: float 6s ease-in-out infinite;
          filter: blur(40px);
        }

        .orb-1 {
          width: 300px;
          height: 300px;
          background: linear-gradient(45deg, var(--accent-green, #00ff88), var(--accent-blue, #3b82f6));
          top: -150px;
          right: -150px;
          animation-delay: 0s;
        }

        .orb-2 {
          width: 200px;
          height: 200px;
          background: linear-gradient(45deg, var(--accent-orange, #ff6b35), var(--accent-green, #00ff88));
          bottom: -100px;
          left: -100px;
          animation-delay: 2s;
        }

        .orb-3 {
          width: 150px;
          height: 150px;
          background: linear-gradient(45deg, var(--accent-blue, #3b82f6), var(--accent-orange, #ff6b35));
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          animation-delay: 4s;
        }

        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          33% { transform: translateY(-20px) rotate(120deg); }
          66% { transform: translateY(10px) rotate(240deg); }
        }

        .unlock-container {
          position: relative;
          background: rgba(26, 26, 26, 0.9);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(51, 51, 51, 0.5);
          border-radius: 24px;
          padding: 48px;
          max-width: 480px;
          width: 90vw;
          text-align: center;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        }

        .unlock-header {
          margin-bottom: 40px;
        }

        .logo-large {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          margin-bottom: 12px;
        }

        .logo-large i {
          font-size: 42px;
          color: var(--accent-green, #00ff88);
          text-shadow: 0 0 20px rgba(0, 255, 136, 0.3);
        }

        .logo-large h1 {
          font-size: 36px;
          font-weight: 700;
          margin: 0;
          background: linear-gradient(45deg, var(--accent-green, #00ff88), var(--accent-blue, #3b82f6));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .tagline {
          font-size: 16px;
          color: var(--text-secondary, #888);
          margin: 0 0 16px 0;
        }

        .version-badge {
          display: inline-block;
          background: var(--accent-green, #00ff88);
          color: var(--bg-primary, #0a0a0a);
          padding: 4px 12px;
          border-radius: 16px;
          font-size: 12px;
          font-weight: 600;
        }

        .unlock-form h2 {
          font-size: 24px;
          font-weight: 600;
          margin: 0 0 8px 0;
        }

        .form-description {
          color: var(--text-secondary, #888);
          margin: 0 0 32px 0;
          line-height: 1.5;
        }

        .pin-input-container {
          margin-bottom: 32px;
        }

        .pin-inputs {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 12px;
          margin-bottom: 24px;
        }

        .pin-input {
          width: 100%;
          height: 64px;
          background: var(--bg-tertiary, #2a2a2a);
          border: 2px solid var(--border-color, #333);
          border-radius: 12px;
          font-size: 24px;
          font-weight: 600;
          text-align: center;
          color: var(--text-primary, #fff);
          transition: all 0.2s;
          outline: none;
        }

        .pin-input:focus {
          border-color: var(--accent-green, #00ff88);
          box-shadow: 0 0 0 4px rgba(0, 255, 136, 0.1);
        }

        .pin-input.filled {
          border-color: var(--accent-green, #00ff88);
          background: rgba(0, 255, 136, 0.1);
        }

        .pin-input.error {
          border-color: var(--accent-red, #ff4444);
          background: rgba(255, 68, 68, 0.1);
        }

        .pin-input:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .pin-actions {
          display: flex;
          gap: 16px;
          justify-content: center;
        }

        .btn-clear, .btn-unlock, .btn-demo {
          padding: 12px 24px;
          border: none;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .btn-clear {
          background: var(--bg-tertiary, #2a2a2a);
          color: var(--text-secondary, #888);
          border: 1px solid var(--border-color, #333);
        }

        .btn-clear:hover:not(:disabled) {
          background: #3a3a3a;
          color: var(--text-primary, #fff);
        }

        .btn-unlock {
          background: var(--accent-green, #00ff88);
          color: var(--bg-primary, #0a0a0a);
          min-width: 120px;
        }

        .btn-unlock:hover:not(:disabled) {
          background: #00e67a;
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(0, 255, 136, 0.3);
        }

        .btn-unlock:disabled {
          background: #333;
          color: #666;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }

        .error-message {
          background: rgba(255, 68, 68, 0.1);
          border: 1px solid var(--accent-red, #ff4444);
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 24px;
          color: var(--accent-red, #ff4444);
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
        }

        .demo-section {
          border-top: 1px solid var(--border-color, #333);
          padding-top: 32px;
          margin-top: 32px;
        }

        .demo-divider {
          position: relative;
          margin-bottom: 20px;
        }

        .demo-divider span {
          background: rgba(26, 26, 26, 0.9);
          padding: 0 16px;
          color: var(--text-secondary, #888);
          font-size: 14px;
          position: relative;
          z-index: 1;
        }

        .demo-divider::before {
          content: '';
          position: absolute;
          top: 50%;
          left: 0;
          right: 0;
          height: 1px;
          background: var(--border-color, #333);
        }

        .btn-demo {
          background: var(--accent-blue, #3b82f6);
          color: white;
          width: 100%;
          justify-content: center;
          margin-bottom: 12px;
        }

        .btn-demo:hover:not(:disabled) {
          background: #2563eb;
          transform: translateY(-1px);
        }

        .demo-note {
          font-size: 12px;
          color: var(--text-secondary, #888);
          margin: 0;
        }

        .security-notice {
          background: rgba(51, 51, 51, 0.3);
          border-radius: 12px;
          padding: 20px;
          margin-top: 32px;
        }

        .security-features {
          display: flex;
          justify-content: space-around;
          flex-wrap: wrap;
          gap: 16px;
        }

        .security-feature {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          color: var(--text-secondary, #888);
          font-size: 12px;
        }

        .security-feature i {
          font-size: 20px;
          color: var(--accent-green, #00ff88);
        }

        .unlock-footer {
          margin-top: 32px;
          padding-top: 24px;
          border-top: 1px solid rgba(51, 51, 51, 0.3);
        }

        .unlock-footer p {
          margin: 0 0 8px 0;
          font-size: 12px;
          color: var(--text-secondary, #888);
        }

        .footer-links {
          display: flex;
          justify-content: center;
          gap: 8px;
          font-size: 10px;
          color: var(--text-secondary, #888);
        }

        @media (max-width: 480px) {
          .unlock-container {
            padding: 32px 24px;
          }
          
          .pin-inputs {
            gap: 8px;
          }
          
          .pin-input {
            height: 56px;
            font-size: 20px;
          }
          
          .logo-large i {
            font-size: 32px;
          }
          
          .logo-large h1 {
            font-size: 28px;
          }
          
          .security-features {
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
};