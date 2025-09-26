/**
 * Token Creation Launchpad Form Component
 * Matches the exact design from user screenshots
 */

import React, { useRef, useState, useCallback } from 'react';
import { useLaunchStore } from '../store/launches';
import './LaunchpadForm.css';

interface LaunchpadFormProps {
  onNavigateToLaunchPlan?: () => void;
  isEditingMode?: boolean;
}

export const LaunchpadForm: React.FC<LaunchpadFormProps> = ({ onNavigateToLaunchPlan, isEditingMode = false }) => {
  const {
    formState,
    updateFormField,
    setImage,
    setSocialLink,
    selectLaunchOption,
    validateForm,
    saveDraft,
    createDraft,
  } = useLaunchStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const { currentDraft, validationErrors, isSaving } = formState;

  // Initialize draft if none exists (only when not in editing mode)
  React.useEffect(() => {
    if (!currentDraft.id && !isEditingMode) {
      createDraft();
    }
  }, [currentDraft.id, createDraft, isEditingMode]);

  // Auto-select "Four" option on load if none selected
  React.useEffect(() => {
    if (!currentDraft.launchOptions?.selectedOption) {
      selectLaunchOption('Four');
    }
  }, [currentDraft.launchOptions?.selectedOption, selectLaunchOption]);

  // Handle drag events
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  // Handle drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        setImage(file);
      }
    }
  }, [setImage]);

  // Handle file input change
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type.startsWith('image/')) {
        setImage(file);
      }
    }
  }, [setImage]);

  // Handle mint - now triggers launch plan generation first
  const handleMint = useCallback(async () => {
    if (validateForm()) {
      const success = await saveDraft();
      if (success) {
        // Navigate to launch plan generation instead of showing confirmation modal
        if (onNavigateToLaunchPlan) {
          onNavigateToLaunchPlan();
        }
      }
    }
  }, [validateForm, saveDraft, onNavigateToLaunchPlan]);

  return (
    <div className="launchpad-form">
      {/* Header */}
      <div className="form-header">
        <h1>Create Token</h1>
        <span className="launchpad-badge">Launchpad</span>
      </div>

      {/* Launchpad Section */}
      <div className="launchpad-section">
        <h3>Launchpad</h3>
        <div className="launchpad-option">
          <div className="four-option selected">
            <div className="four-icon">
              <span className="four-text">🎯</span>
            </div>
            <span className="option-label">Four</span>
          </div>
        </div>
      </div>

      {/* Form Fields */}
      <div className="form-fields">
        {/* Project Name and Symbol */}
        <div className="form-row">
          <div className="form-group">
            <label>Project Name*</label>
            <input
              type="text"
              value={currentDraft.projectName || ''}
              onChange={(e) => updateFormField('projectName', e.target.value)}
              placeholder="Proxima"
              className={validationErrors.projectName ? 'error' : ''}
            />
            {validationErrors.projectName && (
              <div className="error-text">{validationErrors.projectName}</div>
            )}
          </div>

          <div className="form-group">
            <label>Symbol*</label>
            <input
              type="text"
              value={currentDraft.symbol || ''}
              onChange={(e) => updateFormField('symbol', e.target.value.toUpperCase())}
              placeholder="PXM"
              maxLength={10}
              className={validationErrors.symbol ? 'error' : ''}
            />
            {validationErrors.symbol && (
              <div className="error-text">{validationErrors.symbol}</div>
            )}
          </div>
        </div>

        {/* Description */}
        <div className="form-group">
          <label>Description*</label>
          <textarea
            value={currentDraft.description || ''}
            onChange={(e) => updateFormField('description', e.target.value)}
            placeholder="Proxima is a bundler tool..."
            rows={3}
            className={validationErrors.description ? 'error' : ''}
          />
          {validationErrors.description && (
            <div className="error-text">{validationErrors.description}</div>
          )}
        </div>

        {/* Image Upload */}
        <div className="form-group">
          <label>Image*</label>
          <div className="image-upload-container">
            <div
              className={`image-upload-area ${dragActive ? 'drag-active' : ''}`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              {currentDraft.image?.preview ? (
                <img 
                  src={currentDraft.image.preview} 
                  alt="Uploaded" 
                  className="uploaded-image"
                />
              ) : (
                <div className="upload-content">
                  <div className="upload-icon">📁</div>
                  <div className="upload-text">
                    <strong>Drag & Drop or Choose file</strong> to upload
                  </div>
                  <div className="upload-formats">.jpg or .png (Max 2 MB)</div>
                </div>
              )}
            </div>

            <div className="preview-panel">
              <h4>Preview</h4>
              <div className="preview-grid">
                <div className="preview-item">
                  <div className="preview-box size-large">
                    {currentDraft.image?.preview && (
                      <img src={currentDraft.image.preview} alt="128x128" />
                    )}
                  </div>
                  <span>128×128</span>
                </div>
                <div className="preview-item">
                  <div className="preview-box size-medium">
                    {currentDraft.image?.preview && (
                      <img src={currentDraft.image.preview} alt="64x64" />
                    )}
                  </div>
                  <span>64×64</span>
                </div>
                <div className="preview-item">
                  <div className="preview-box size-small">
                    {currentDraft.image?.preview && (
                      <img src={currentDraft.image.preview} alt="32x32" />
                    )}
                  </div>
                  <span>32×32</span>
                </div>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </div>
        </div>

        {/* Social Links */}
        <div className="social-links">
          <div className="form-group">
            <label>X/Twitter</label>
            <input
              type="text"
              value={currentDraft.socialLinks?.twitter || ''}
              onChange={(e) => setSocialLink('twitter', e.target.value)}
              placeholder="x.com/proxima (optional)"
            />
          </div>

          <div className="form-group">
            <label>Telegram</label>
            <input
              type="text"
              value={currentDraft.socialLinks?.telegram || ''}
              onChange={(e) => setSocialLink('telegram', e.target.value)}
              placeholder="t.me/proxima (optional)"
            />
          </div>

          <div className="form-group">
            <label>Website</label>
            <input
              type="text"
              value={currentDraft.socialLinks?.website || ''}
              onChange={(e) => setSocialLink('website', e.target.value)}
              placeholder="proxima.io (optional)"
            />
          </div>
        </div>
      </div>

      {/* Mint Button */}
      <div className="form-bottom">
        <button
          className="mint-button"
          onClick={handleMint}
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : 'Mint'}
        </button>
      </div>
    </div>
  );
};