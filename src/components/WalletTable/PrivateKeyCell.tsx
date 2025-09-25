/**
 * PrivateKeyCell Component
 * Secure private key display with toggle visibility and copy functionality
 * Includes security warnings and session-based access control
 */

import React, { useState, useCallback } from 'react';
import { useSessionStore } from '../../store/session';
import { decryptPrivateKey, secureRetrieve } from '../../utils/crypto';
import type { Wallet } from '../../types';

interface PrivateKeyCellProps {
  wallet: Wallet;
  onCopy?: (address: string) => void;
}

export const PrivateKeyCell: React.FC<PrivateKeyCellProps> = ({ wallet, onCopy }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [privateKey, setPrivateKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showWarning, setShowWarning] = useState(false);
  const [showPassphrasePrompt, setShowPassphrasePrompt] = useState(false);
  const [passphraseInput, setPassphraseInput] = useState('');

  const { isUnlocked } = useSessionStore();

  const toggleVisibility = useCallback(async () => {
    if (!isUnlocked) {
      setError('Session must be unlocked to view private keys');
      return;
    }

    if (!isVisible) {
      // Show security warning first
      setShowWarning(true);
      return;
    }

    // Hide private key
    setIsVisible(false);
    setPrivateKey(null);
    setError(null);
  }, [isVisible, isUnlocked]);

  const confirmReveal = useCallback(() => {
    setShowWarning(false);
    setShowPassphrasePrompt(true);
  }, []);

  const decryptWithPassphrase = useCallback(async (passphrase: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // Validate passphrase
      if (!passphrase || passphrase.length < 8) {
        throw new Error('Invalid passphrase - must be at least 8 characters');
      }

      // Retrieve encrypted private key from secure storage
      const encryptedKey = await secureRetrieve(`wallet_${wallet.id}_pk`);
      
      if (!encryptedKey) {
        throw new Error('Private key not found in secure storage');
      }

      // Decrypt using user-provided passphrase (NO DEFAULT FALLBACK)
      const decryptedKey = await decryptPrivateKey(encryptedKey, passphrase);
      
      setPrivateKey(decryptedKey);
      setIsVisible(true);
      setShowPassphrasePrompt(false);
      setPassphraseInput('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to decrypt private key - check your passphrase');
    } finally {
      setIsLoading(false);
    }
  }, [wallet.id]);

  const copyToClipboard = useCallback(async () => {
    if (!privateKey) return;

    try {
      await navigator.clipboard.writeText(privateKey);
      onCopy?.(wallet.address);
      
      // Show success feedback briefly
      const button = document.querySelector(`[data-wallet="${wallet.id}"] .copy-btn`);
      if (button) {
        button.textContent = '✓ Copied';
        setTimeout(() => {
          button.textContent = 'Copy';
        }, 2000);
      }
    } catch (err) {
      setError('Failed to copy to clipboard');
    }
  }, [privateKey, wallet.address, wallet.id, onCopy]);

  const cancelWarning = useCallback(() => {
    setShowWarning(false);
  }, []);

  const cancelPassphrasePrompt = useCallback(() => {
    setShowPassphrasePrompt(false);
    setPassphraseInput('');
    setError(null);
  }, []);

  const handlePassphraseSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    decryptWithPassphrase(passphraseInput);
  }, [passphraseInput, decryptWithPassphrase]);

  if (showWarning) {
    return (
      <div className="private-key-warning" data-wallet={wallet.id}>
        <div className="warning-content">
          <div className="warning-icon">⚠️</div>
          <div className="warning-text">
            <strong>Security Warning</strong>
            <p>Private keys provide full access to your wallet. Only reveal in secure environments.</p>
          </div>
          <div className="warning-actions">
            <button 
              className="btn-danger btn-sm" 
              onClick={confirmReveal}
              disabled={isLoading}
            >
              {isLoading ? 'Decrypting...' : 'I Understand, Show Key'}
            </button>
            <button 
              className="btn-secondary btn-sm" 
              onClick={cancelWarning}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showPassphrasePrompt) {
    return (
      <div className="passphrase-prompt" data-wallet={wallet.id}>
        <div className="prompt-content">
          <div className="prompt-icon">🔐</div>
          <div className="prompt-text">
            <strong>Enter Passphrase</strong>
            <p>Enter your encryption passphrase to decrypt this private key.</p>
          </div>
          <form onSubmit={handlePassphraseSubmit} className="passphrase-form">
            <input
              type="password"
              value={passphraseInput}
              onChange={(e) => setPassphraseInput(e.target.value)}
              placeholder="Enter your passphrase"
              className="passphrase-input"
              disabled={isLoading}
              autoFocus
            />
            <div className="prompt-actions">
              <button 
                type="submit"
                className="btn-primary btn-sm" 
                disabled={isLoading || !passphraseInput}
              >
                {isLoading ? 'Decrypting...' : 'Decrypt'}
              </button>
              <button 
                type="button"
                className="btn-secondary btn-sm" 
                onClick={cancelPassphrasePrompt}
                disabled={isLoading}
              >
                Cancel
              </button>
            </div>
          </form>
          {error && (
            <div className="prompt-error">
              <small>{error}</small>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="private-key-cell" data-wallet={wallet.id}>
      <div className="key-display">
        {!isVisible ? (
          <span className="key-hidden">
            {'•'.repeat(42)}
          </span>
        ) : isLoading ? (
          <span className="key-loading">
            Decrypting...
          </span>
        ) : privateKey ? (
          <code className="key-revealed">
            {privateKey}
          </code>
        ) : (
          <span className="key-error">
            Error loading key
          </span>
        )}
      </div>
      
      <div className="key-actions">
        <button
          className="toggle-btn"
          onClick={toggleVisibility}
          disabled={isLoading || !isUnlocked}
          title={!isUnlocked ? 'Unlock session to view private keys' : isVisible ? 'Hide private key' : 'Show private key'}
        >
          {isVisible ? '🙈' : '👁️'}
        </button>
        
        {isVisible && privateKey && (
          <button
            className="copy-btn"
            onClick={copyToClipboard}
            title="Copy private key to clipboard"
          >
            📋
          </button>
        )}
      </div>

      {error && (
        <div className="key-error-message">
          <small>{error}</small>
        </div>
      )}
      
      {!isUnlocked && (
        <div className="key-locked-message">
          <small>🔒 Session locked</small>
        </div>
      )}
    </div>
  );
};