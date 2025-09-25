/**
 * ConfirmDialog Component
 * General-purpose confirmation dialog for destructive actions
 */

import React, { useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDangerous?: boolean;
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  children?: React.ReactNode;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDangerous = false,
  isLoading = false,
  onConfirm,
  onCancel,
  children,
}) => {
  const handleConfirm = useCallback(async () => {
    if (isLoading) return;
    
    try {
      await onConfirm();
    } catch (error) {
      console.error('Confirmation action failed:', error);
      // In a real app, you'd show an error toast or message
    }
  }, [onConfirm, isLoading]);

  const handleCancel = useCallback(() => {
    if (isLoading) return;
    onCancel();
  }, [onCancel, isLoading]);

  const handleOverlayClick = useCallback((event: React.MouseEvent) => {
    if (event.target === event.currentTarget) {
      handleCancel();
    }
  }, [handleCancel]);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      handleCancel();
    } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      handleConfirm();
    }
  }, [handleCancel, handleConfirm]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
      
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = '';
      };
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const dialogContent = (
    <div className="confirm-dialog-overlay" onClick={handleOverlayClick}>
      <div className={`confirm-dialog ${isDangerous ? 'dangerous' : ''}`}>
        <div className="dialog-header">
          <h3 className="dialog-title">{title}</h3>
          {!isLoading && (
            <button 
              className="dialog-close"
              onClick={handleCancel}
              aria-label="Close dialog"
            >
              ✕
            </button>
          )}
        </div>
        
        <div className="dialog-content">
          <div className="dialog-message">
            {isDangerous && (
              <div className="warning-icon">⚠️</div>
            )}
            <p>{message}</p>
          </div>
          
          {children && (
            <div className="dialog-extra-content">
              {children}
            </div>
          )}
        </div>
        
        <div className="dialog-actions">
          <button
            className="btn-secondary"
            onClick={handleCancel}
            disabled={isLoading}
          >
            {cancelText}
          </button>
          
          <button
            className={`btn-primary ${isDangerous ? 'btn-danger' : ''}`}
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="loading-spinner"></span>
                Processing...
              </>
            ) : (
              confirmText
            )}
          </button>
        </div>
        
        {isDangerous && (
          <div className="dialog-warning">
            <small>⚠️ This action cannot be undone</small>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(dialogContent, document.body);
};