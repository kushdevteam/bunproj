/**
 * Preset Manager Component
 * Handles saving, loading, and managing bundle configuration presets
 */

import React, { useState, useEffect } from 'react';
import { usePresetStore } from '../../store/presets';
import type { EnhancedBundleConfig, ConfigurationPreset, ConfigurationTemplate } from '../../types/bundle-config';

interface PresetManagerProps {
  isOpen: boolean;
  onClose: () => void;
  currentConfig: EnhancedBundleConfig;
  onLoadConfig: (config: Partial<EnhancedBundleConfig>) => void;
}

export const PresetManager: React.FC<PresetManagerProps> = ({
  isOpen,
  onClose,
  currentConfig,
  onLoadConfig
}) => {
  const { 
    presets, 
    templates, 
    favoritePresets, 
    recentlyUsed,
    savePreset,
    loadPreset,
    deletePreset,
    duplicatePreset,
    addToFavorites,
    removeFromFavorites,
    getTemplate,
    createFromTemplate,
    exportPreset,
    importPreset,
    searchPresets
  } = usePresetStore();

  // Local state
  const [activeTab, setActiveTab] = useState<'presets' | 'templates' | 'import-export'>('presets');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveForm, setSaveForm] = useState({ name: '', description: '' });
  const [importText, setImportText] = useState('');
  const [exportText, setExportText] = useState('');

  // Filter presets based on search query
  const filteredPresets = searchQuery 
    ? searchPresets(searchQuery)
    : presets;

  // Sort presets (favorites first, then recently used, then by creation date)
  const sortedPresets = filteredPresets.sort((a, b) => {
    const aIsFavorite = favoritePresets.includes(a.id);
    const bIsFavorite = favoritePresets.includes(b.id);
    const aRecentIndex = recentlyUsed.indexOf(a.id);
    const bRecentIndex = recentlyUsed.indexOf(b.id);

    if (aIsFavorite && !bIsFavorite) return -1;
    if (!aIsFavorite && bIsFavorite) return 1;
    if (aRecentIndex !== -1 && bRecentIndex !== -1) return aRecentIndex - bRecentIndex;
    if (aRecentIndex !== -1) return -1;
    if (bRecentIndex !== -1) return 1;
    
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  // Handle saving current configuration
  const handleSavePreset = async () => {
    if (!saveForm.name.trim()) return;

    try {
      await savePreset(saveForm.name, saveForm.description, currentConfig);
      setSaveForm({ name: '', description: '' });
      setShowSaveDialog(false);
    } catch (error) {
      console.error('Failed to save preset:', error);
    }
  };

  // Handle loading a preset
  const handleLoadPreset = (presetId: string) => {
    const preset = loadPreset(presetId);
    if (preset) {
      onLoadConfig(preset.config);
      onClose();
    }
  };

  // Handle creating from template
  const handleCreateFromTemplate = (templateId: ConfigurationTemplate) => {
    const config = createFromTemplate(templateId);
    onLoadConfig(config);
    onClose();
  };

  // Handle preset deletion
  const handleDeletePreset = (presetId: string) => {
    if (window.confirm('Are you sure you want to delete this preset?')) {
      deletePreset(presetId);
    }
  };

  // Handle preset duplication
  const handleDuplicatePreset = (presetId: string) => {
    const originalPreset = presets.find(p => p.id === presetId);
    if (originalPreset) {
      const newName = `${originalPreset.name} (Copy)`;
      duplicatePreset(presetId, newName);
    }
  };

  // Handle import
  const handleImport = () => {
    if (importText.trim()) {
      const success = importPreset(importText);
      if (success) {
        setImportText('');
        alert('Preset imported successfully!');
      } else {
        alert('Failed to import preset. Please check the format.');
      }
    }
  };

  // Handle export
  const handleExport = (presetId: string) => {
    try {
      const exported = exportPreset(presetId);
      setExportText(exported);
    } catch (error) {
      alert('Failed to export preset.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="preset-manager-overlay">
      <div className="preset-manager">
        {/* Header */}
        <div className="preset-manager-header">
          <h2 className="preset-manager-title">
            <i className="fas fa-save"></i>
            Preset Manager
          </h2>
          <button className="close-button" onClick={onClose}>
            <i className="fas fa-times"></i>
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="preset-tabs">
          <button 
            className={`preset-tab ${activeTab === 'presets' ? 'active' : ''}`}
            onClick={() => setActiveTab('presets')}
          >
            <i className="fas fa-bookmark"></i>
            My Presets ({presets.length})
          </button>
          <button 
            className={`preset-tab ${activeTab === 'templates' ? 'active' : ''}`}
            onClick={() => setActiveTab('templates')}
          >
            <i className="fas fa-star"></i>
            Templates ({templates.length})
          </button>
          <button 
            className={`preset-tab ${activeTab === 'import-export' ? 'active' : ''}`}
            onClick={() => setActiveTab('import-export')}
          >
            <i className="fas fa-exchange-alt"></i>
            Import/Export
          </button>
        </div>

        {/* Tab Content */}
        <div className="preset-content">
          {/* My Presets Tab */}
          {activeTab === 'presets' && (
            <div className="presets-tab">
              <div className="presets-controls">
                <div className="search-bar">
                  <i className="fas fa-search"></i>
                  <input
                    type="text"
                    placeholder="Search presets..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="preset-search-input"
                  />
                </div>
                <button 
                  className="config-button"
                  onClick={() => setShowSaveDialog(true)}
                >
                  <i className="fas fa-plus"></i>
                  Save Current
                </button>
              </div>

              <div className="presets-list">
                {sortedPresets.length === 0 ? (
                  <div className="no-presets">
                    <i className="fas fa-info-circle"></i>
                    <p>No presets found. Save your current configuration to get started.</p>
                  </div>
                ) : (
                  sortedPresets.map(preset => (
                    <div 
                      key={preset.id} 
                      className={`preset-item ${selectedPreset === preset.id ? 'selected' : ''}`}
                    >
                      <div className="preset-info">
                        <div className="preset-header">
                          <h4 className="preset-name">
                            {favoritePresets.includes(preset.id) && (
                              <i className="fas fa-star favorite-star"></i>
                            )}
                            {preset.name}
                            {recentlyUsed.includes(preset.id) && (
                              <span className="recent-badge">Recent</span>
                            )}
                          </h4>
                          <div className="preset-actions">
                            <button
                              className="action-button"
                              onClick={() => favoritePresets.includes(preset.id) 
                                ? removeFromFavorites(preset.id)
                                : addToFavorites(preset.id)
                              }
                              title={favoritePresets.includes(preset.id) ? 'Remove from favorites' : 'Add to favorites'}
                            >
                              <i className={`fas ${favoritePresets.includes(preset.id) ? 'fa-star' : 'fa-star-o'}`}></i>
                            </button>
                            <button
                              className="action-button"
                              onClick={() => handleDuplicatePreset(preset.id)}
                              title="Duplicate preset"
                            >
                              <i className="fas fa-copy"></i>
                            </button>
                            <button
                              className="action-button"
                              onClick={() => handleExport(preset.id)}
                              title="Export preset"
                            >
                              <i className="fas fa-download"></i>
                            </button>
                            <button
                              className="action-button danger"
                              onClick={() => handleDeletePreset(preset.id)}
                              title="Delete preset"
                            >
                              <i className="fas fa-trash"></i>
                            </button>
                          </div>
                        </div>
                        <p className="preset-description">{preset.description}</p>
                        <div className="preset-metadata">
                          <div className="metadata-item">
                            <span>Created:</span>
                            <span>{new Date(preset.createdAt).toLocaleDateString()}</span>
                          </div>
                          <div className="metadata-item">
                            <span>Used:</span>
                            <span>{preset.usage} times</span>
                          </div>
                          <div className="preset-tags">
                            {preset.config.tags.map(tag => (
                              <span key={tag} className="preset-tag">{tag}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="preset-preview">
                        <div className="preview-item">
                          <span>Investment:</span>
                          <span>{preset.config.purchaseAmount?.totalBnb || 0} BNB</span>
                        </div>
                        <div className="preview-item">
                          <span>Strategy:</span>
                          <span>{preset.config.strategy?.buyStrategy || 'N/A'}</span>
                        </div>
                        <div className="preview-item">
                          <span>Stagger:</span>
                          <span>{preset.config.executionParams?.staggerSettings?.enabled ? 'Yes' : 'No'}</span>
                        </div>
                      </div>
                      <button 
                        className="load-preset-button"
                        onClick={() => handleLoadPreset(preset.id)}
                      >
                        Load Preset
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Templates Tab */}
          {activeTab === 'templates' && (
            <div className="templates-tab">
              <div className="templates-grid">
                {templates.map(template => (
                  <div key={template.id} className="template-card">
                    <div className="template-header">
                      <h4 className="template-name">{template.name}</h4>
                      <div className={`risk-badge ${template.riskLevel}`}>
                        {template.riskLevel.toUpperCase()} RISK
                      </div>
                    </div>
                    <p className="template-description">{template.description}</p>
                    
                    <div className="template-features">
                      <div className="feature-item">
                        <span>Investment:</span>
                        <span>{template.config.purchaseAmount?.totalBnb || 0} BNB</span>
                      </div>
                      <div className="feature-item">
                        <span>Stagger:</span>
                        <span>{template.config.executionParams?.staggerSettings?.enabled ? 'Yes' : 'No'}</span>
                      </div>
                      <div className="feature-item">
                        <span>Stealth:</span>
                        <span>{template.config.executionParams?.stealthMode?.enabled ? 'Yes' : 'No'}</span>
                      </div>
                      <div className="feature-item">
                        <span>MEV Protection:</span>
                        <span>{template.config.transactionSettings?.mevProtection?.enabled ? 'Yes' : 'No'}</span>
                      </div>
                    </div>

                    <button 
                      className="config-button"
                      onClick={() => handleCreateFromTemplate(template.id)}
                    >
                      Use Template
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Import/Export Tab */}
          {activeTab === 'import-export' && (
            <div className="import-export-tab">
              <div className="import-section">
                <h4>Import Preset</h4>
                <p>Paste a preset configuration JSON below to import it:</p>
                <textarea
                  className="import-textarea"
                  placeholder="Paste preset JSON here..."
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  rows={10}
                />
                <div className="import-actions">
                  <button 
                    className="config-button"
                    onClick={handleImport}
                    disabled={!importText.trim()}
                  >
                    <i className="fas fa-upload"></i>
                    Import Preset
                  </button>
                  <button 
                    className="config-button secondary"
                    onClick={() => setImportText('')}
                  >
                    Clear
                  </button>
                </div>
              </div>

              {exportText && (
                <div className="export-section">
                  <h4>Export Result</h4>
                  <p>Copy the JSON below to share your preset:</p>
                  <textarea
                    className="export-textarea"
                    value={exportText}
                    readOnly
                    rows={10}
                  />
                  <div className="export-actions">
                    <button 
                      className="config-button"
                      onClick={() => {
                        navigator.clipboard.writeText(exportText);
                        alert('Copied to clipboard!');
                      }}
                    >
                      <i className="fas fa-copy"></i>
                      Copy to Clipboard
                    </button>
                    <button 
                      className="config-button secondary"
                      onClick={() => setExportText('')}
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Save Dialog */}
      {showSaveDialog && (
        <div className="save-dialog-overlay">
          <div className="save-dialog">
            <h3>Save Configuration Preset</h3>
            <div className="save-form">
              <div className="config-input-group">
                <label className="config-label">Preset Name</label>
                <input
                  type="text"
                  className="config-input"
                  placeholder="Enter preset name..."
                  value={saveForm.name}
                  onChange={(e) => setSaveForm(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="config-input-group">
                <label className="config-label">Description (Optional)</label>
                <textarea
                  className="config-textarea"
                  placeholder="Describe this preset..."
                  value={saveForm.description}
                  onChange={(e) => setSaveForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                />
              </div>
            </div>
            <div className="save-dialog-actions">
              <button 
                className="config-button"
                onClick={handleSavePreset}
                disabled={!saveForm.name.trim()}
              >
                <i className="fas fa-save"></i>
                Save Preset
              </button>
              <button 
                className="config-button secondary"
                onClick={() => {
                  setShowSaveDialog(false);
                  setSaveForm({ name: '', description: '' });
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};