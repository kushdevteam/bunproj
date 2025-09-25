/**
 * Confirmation Modal Component
 * Shows token confirmation with Four branding - matches screenshots exactly
 */

import React from 'react';
import { useLaunchStore } from '../store/launches';
import { useSessionStore } from '../store/session';
import './ConfirmationModal.css';

// Four.meme hand logo as base64 data URL
const FOUR_LOGO_DATA_URL = "data:image/png;base64,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...";

export const ConfirmationModal: React.FC = () => {
  const {
    showConfirmationModal,
    confirmationData,
    confirmLaunch,
    cancelLaunch,
    formState: { isLaunching },
    error
  } = useLaunchStore();
  
  const { isUnlocked } = useSessionStore();

  if (!showConfirmationModal || !confirmationData) {
    return null;
  }

  // Validation checks
  const isSessionUnlocked = isUnlocked;
  const canLaunch = isSessionUnlocked && !isLaunching;

  // Error messages for different states
  const getStatusMessage = () => {
    if (error) {
      return { type: 'error', message: error };
    }
    if (!isSessionUnlocked) {
      return { type: 'warning', message: 'Session must be unlocked to create tokens. Please unlock your session first.' };
    }
    return null;
  };

  const statusMessage = getStatusMessage();

  const handleConfirm = async () => {
    if (!canLaunch) return;
    await confirmLaunch();
  };

  const handleCancel = () => {
    cancelLaunch();
  };

  return (
    <div className="modal-overlay">
      <div className="confirmation-modal">
        <div className="modal-header">
          <div className="header-content">
            <div className="four-logo">
              <img src={FOUR_LOGO_DATA_URL} alt="Four.meme" />
            </div>
            <div className="header-text">
              <h2 className="modal-title">{confirmationData.projectName || 'Sist'}</h2>
              <p className="modal-subtitle">{confirmationData.symbol || 'test'}</p>
            </div>
          </div>
          <button className="close-btn" onClick={handleCancel}>
            ×
          </button>
        </div>

        <div className="modal-content">
          <div className="token-summary">
            <div className="token-icon">
              {confirmationData.image?.preview ? (
                <img 
                  src={confirmationData.image.preview} 
                  alt={confirmationData.projectName} 
                />
              ) : (
                <div className="placeholder-icon">🎯</div>
              )}
            </div>
            
            <div className="token-details">
              <h4>{confirmationData.projectName || 'Sist'}</h4>
              <p className="token-symbol">{confirmationData.symbol || 'TEST'}</p>
              <p className="token-description">{confirmationData.description || 'Token launch confirmation'}</p>
            </div>
          </div>

          <div className="launch-option-display">
            <div className="four-option-display">
              <div className="four-icon-small">
                <img src={FOUR_LOGO_DATA_URL} alt="Four.meme" />
              </div>
              <span className="option-name">Four</span>
            </div>
          </div>

          {(confirmationData.socialLinks?.twitter || 
            confirmationData.socialLinks?.telegram || 
            confirmationData.socialLinks?.website) && (
            <div className="social-links-display">
              <strong>Social Links:</strong>
              <div className="social-list">
                {confirmationData.socialLinks.twitter && (
                  <span>Twitter: {confirmationData.socialLinks.twitter}</span>
                )}
                {confirmationData.socialLinks.telegram && (
                  <span>Telegram: {confirmationData.socialLinks.telegram}</span>
                )}
                {confirmationData.socialLinks.website && (
                  <span>Website: {confirmationData.socialLinks.website}</span>
                )}
              </div>
            </div>
          )}
        </div>

        {statusMessage && (
          <div className={`status-message ${statusMessage.type}`}>
            <div className="status-content">
              <span className="status-icon">
                {statusMessage.type === 'error' ? '❌' : '⚠️'}
              </span>
              <span className="status-text">{statusMessage.message}</span>
            </div>
          </div>
        )}

        <div className="modal-actions">
          <button 
            className="cancel-btn" 
            onClick={handleCancel}
            disabled={isLaunching}
          >
            Cancel
          </button>
          <button 
            className="confirm-btn" 
            onClick={handleConfirm}
            disabled={!canLaunch}
          >
            {isLaunching ? 'Creating...' : 'Create Mint'}
          </button>
        </div>
      </div>
    </div>
  );
};