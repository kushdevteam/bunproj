/**
 * Drafts List Component
 * Shows saved token drafts in a clean list format
 */

import React, { useState } from 'react';
import { useLaunchStore } from '../store/launches';
import './DraftsList.css';

interface DraftsListProps {
  onEditDraft?: () => void;
}

export const DraftsList: React.FC<DraftsListProps> = ({ onEditDraft }) => {
  const { drafts, loadDraft, deleteDraft, archiveDraft, unarchiveDraft } = useLaunchStore();
  const [showArchived, setShowArchived] = useState(false);

  // Filter drafts based on showArchived toggle
  const activeDrafts = drafts.filter(draft => draft.status !== 'archived');
  const archivedDrafts = drafts.filter(draft => draft.status === 'archived');
  const displayDrafts = showArchived ? archivedDrafts : activeDrafts;
  
  // Show default draft layout to match screenshot when no active drafts
  const defaultDraft = {
    id: 'default',
    projectName: 'Untitled',
    symbol: '',
    status: 'draft' as const,
  };
  
  const finalDisplayDrafts = (!showArchived && displayDrafts.length === 0) ? [defaultDraft] : displayDrafts;

  return (
    <div className="drafts-list">
      <div className="drafts-header">
        <div className="drafts-header-left">
          <h3>{showArchived ? 'Archived Drafts' : 'Saved Drafts'}</h3>
          <span className="drafts-count">{displayDrafts.length}</span>
        </div>
        <div className="drafts-header-controls">
          <button
            className={`archive-toggle ${showArchived ? 'active' : ''}`}
            onClick={() => setShowArchived(!showArchived)}
            title={showArchived ? 'Show active drafts' : 'Show archived drafts'}
          >
            {showArchived ? 'Show Active' : `Archived (${archivedDrafts.length})`}
          </button>
        </div>
      </div>

      <div className="drafts-items">
        {finalDisplayDrafts.map((draft, index) => (
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
                  {draft.status === 'draft' ? 'DRAFT' : draft.status === 'saved' ? 'SAVED' : 'ARCHIVED'}
                </span>
              </div>
            </div>
            {draft.id !== 'default' && (
              <div className="draft-actions">
                {!showArchived ? (
                  <>
                    <button
                      className="edit-btn"
                      onClick={() => {
                        loadDraft(draft.id);
                        if (onEditDraft) {
                          onEditDraft();
                        }
                      }}
                      title="Edit draft"
                      disabled={draft.status === 'archived'}
                    >
                      Edit
                    </button>
                    <button
                      className="archive-btn"
                      onClick={() => archiveDraft(draft.id)}
                      title="Archive draft"
                    >
                      Archive
                    </button>
                    <button
                      className="delete-btn"
                      onClick={() => deleteDraft(draft.id)}
                      title="Delete draft"
                    >
                      ×
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="unarchive-btn"
                      onClick={() => unarchiveDraft(draft.id)}
                      title="Unarchive draft"
                    >
                      Unarchive
                    </button>
                    <button
                      className="delete-btn"
                      onClick={() => deleteDraft(draft.id)}
                      title="Delete draft"
                    >
                      ×
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};