/**
 * Drafts List Component
 * Shows saved token drafts in a clean list format
 */

import React from 'react';
import { useLaunchStore } from '../store/launches';
import './DraftsList.css';

export const DraftsList: React.FC = () => {
  const { drafts, loadDraft, deleteDraft } = useLaunchStore();

  // Show default draft layout to match screenshot
  const defaultDraft = {
    id: 'default',
    projectName: 'Untitled',
    symbol: '',
    status: 'draft' as const,
  };
  
  const displayDrafts = drafts.length === 0 ? [defaultDraft] : drafts;

  return (
    <div className="drafts-list">
      <div className="drafts-header">
        <h3>Saved Drafts</h3>
        <span className="drafts-count">{displayDrafts.length}</span>
      </div>

      <div className="drafts-items">
        {displayDrafts.map((draft, index) => (
          <div key={draft.id} className="draft-item">
            <div className="draft-number">{index + 1}.</div>
            <div className="draft-content">
              <div className="draft-info">
                <div className="draft-title">
                  {draft.projectName || 'Untitled'}
                </div>
                <div className="draft-subtitle">
                  {draft.symbol || 'No symbol'}
                </div>
              </div>
              <div className="draft-status">
                <span className={`status-badge ${draft.status}`}>
                  {draft.status === 'draft' ? 'DRAFT' : 'SAVED'}
                </span>
              </div>
            </div>
            {draft.id !== 'default' && (
              <div className="draft-actions">
                <button
                  className="edit-btn"
                  onClick={() => loadDraft(draft.id)}
                  title="Edit draft"
                >
                  Edit
                </button>
                <button
                  className="delete-btn"
                  onClick={() => deleteDraft(draft.id)}
                  title="Delete draft"
                >
                  ×
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};