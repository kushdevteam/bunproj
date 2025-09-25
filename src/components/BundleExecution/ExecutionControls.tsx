/**
 * Execution Controls Component
 * Provides start, pause, stop, and emergency abort controls for bundle execution
 */

import React, { useState } from 'react';
import type { ExecutionStatus } from '../../store/execution';

interface ExecutionControlsProps {
  status: ExecutionStatus;
  canStart: boolean;
  canPause: boolean;
  canStop: boolean;
  canAbort: boolean;
  onStart: () => void;
  onPause: () => void;
  onStop: () => void;
  onAbort: () => void;
}

export const ExecutionControls: React.FC<ExecutionControlsProps> = ({
  status,
  canStart,
  canPause,
  canStop,
  canAbort,
  onStart,
  onPause,
  onStop,
  onAbort,
}) => {
  const [showAbortConfirm, setShowAbortConfirm] = useState(false);
  const [showStopConfirm, setShowStopConfirm] = useState(false);

  const handleAbortClick = () => {
    setShowAbortConfirm(true);
  };

  const confirmAbort = () => {
    setShowAbortConfirm(false);
    onAbort();
  };

  const handleStopClick = () => {
    setShowStopConfirm(true);
  };

  const confirmStop = () => {
    setShowStopConfirm(false);
    onStop();
  };

  const getStatusMessage = () => {
    switch (status) {
      case 'idle':
        return 'Ready to start execution';
      case 'preparing':
        return 'Preparing execution environment...';
      case 'executing':
        return 'Execution in progress';
      case 'paused':
        return 'Execution paused - ready to resume';
      case 'completed':
        return 'Execution completed successfully';
      case 'failed':
        return 'Execution failed';
      case 'aborted':
        return 'Execution aborted by user';
      case 'stopping':
        return 'Stopping execution...';
      default:
        return 'Unknown status';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'executing':
        return '#4caf50'; // Green
      case 'paused':
        return '#ff9800'; // Orange
      case 'completed':
        return '#2196f3'; // Blue
      case 'failed':
      case 'aborted':
        return '#f44336'; // Red
      case 'stopping':
        return '#9e9e9e'; // Gray
      default:
        return '#757575'; // Light gray
    }
  };

  return (
    <div className="execution-controls">
      <div className="controls-header">
        <h3>Execution Controls</h3>
        <div className="status-message" style={{ color: getStatusColor() }}>
          {getStatusMessage()}
        </div>
      </div>

      <div className="controls-grid">
        {/* Start/Resume Button */}
        {(status === 'idle' || status === 'paused') && (
          <button
            onClick={onStart}
            disabled={!canStart}
            className="control-button start-button"
            title={status === 'paused' ? 'Resume execution' : 'Start execution'}
          >
            <div className="button-icon">▶️</div>
            <div className="button-content">
              <span className="button-title">
                {status === 'paused' ? 'Resume' : 'Start'}
              </span>
              <span className="button-subtitle">
                {status === 'paused' ? 'Continue execution' : 'Begin bundle execution'}
              </span>
            </div>
          </button>
        )}

        {/* Pause Button */}
        {status === 'executing' && (
          <button
            onClick={onPause}
            disabled={!canPause}
            className="control-button pause-button"
            title="Pause execution"
          >
            <div className="button-icon">⏸️</div>
            <div className="button-content">
              <span className="button-title">Pause</span>
              <span className="button-subtitle">Pause current execution</span>
            </div>
          </button>
        )}

        {/* Stop Button */}
        {(['executing', 'paused'].includes(status)) && (
          <button
            onClick={handleStopClick}
            disabled={!canStop}
            className="control-button stop-button"
            title="Stop execution gracefully"
          >
            <div className="button-icon">⏹️</div>
            <div className="button-content">
              <span className="button-title">Stop</span>
              <span className="button-subtitle">Complete current transactions and stop</span>
            </div>
          </button>
        )}

        {/* Emergency Abort Button */}
        {(['executing', 'paused', 'stopping'].includes(status)) && (
          <button
            onClick={handleAbortClick}
            disabled={!canAbort}
            className="control-button abort-button"
            title="Emergency abort - immediate stop"
          >
            <div className="button-icon">🛑</div>
            <div className="button-content">
              <span className="button-title">Emergency Abort</span>
              <span className="button-subtitle">Immediately halt all operations</span>
            </div>
          </button>
        )}
      </div>

      {/* Control Status Indicators */}
      <div className="control-status">
        <div className="status-indicators">
          <div className={`indicator ${canStart ? 'enabled' : 'disabled'}`}>
            <span className="indicator-dot"></span>
            <span>Can Start</span>
          </div>
          <div className={`indicator ${canPause ? 'enabled' : 'disabled'}`}>
            <span className="indicator-dot"></span>
            <span>Can Pause</span>
          </div>
          <div className={`indicator ${canStop ? 'enabled' : 'disabled'}`}>
            <span className="indicator-dot"></span>
            <span>Can Stop</span>
          </div>
          <div className={`indicator ${canAbort ? 'enabled' : 'disabled'}`}>
            <span className="indicator-dot"></span>
            <span>Emergency Available</span>
          </div>
        </div>
      </div>

      {/* Safety Features */}
      <div className="safety-features">
        <h4>Safety Controls</h4>
        <div className="safety-items">
          <div className="safety-item">
            <span className="safety-icon">🔒</span>
            <div className="safety-content">
              <span className="safety-title">Secure Session</span>
              <span className="safety-description">Private keys encrypted in memory</span>
            </div>
          </div>
          <div className="safety-item">
            <span className="safety-icon">⏱️</span>
            <div className="safety-content">
              <span className="safety-title">Timeout Protection</span>
              <span className="safety-description">Auto-abort on execution timeout</span>
            </div>
          </div>
          <div className="safety-item">
            <span className="safety-icon">💰</span>
            <div className="safety-content">
              <span className="safety-title">Spending Limits</span>
              <span className="safety-description">Enforced maximum spend protection</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stop Confirmation Modal */}
      {showStopConfirm && (
        <div className="confirmation-overlay">
          <div className="confirmation-modal">
            <div className="modal-header">
              <h3>⚠️ Confirm Stop Execution</h3>
            </div>
            <div className="modal-content">
              <p>
                This will gracefully stop the execution after completing current transactions.
                No new transactions will be started.
              </p>
              <div className="warning-box">
                <strong>Note:</strong> Partially completed batches will finish before stopping.
              </div>
            </div>
            <div className="modal-actions">
              <button
                onClick={() => setShowStopConfirm(false)}
                className="secondary-button"
              >
                Cancel
              </button>
              <button
                onClick={confirmStop}
                className="primary-button stop-button"
              >
                Stop Execution
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Abort Confirmation Modal */}
      {showAbortConfirm && (
        <div className="confirmation-overlay">
          <div className="confirmation-modal">
            <div className="modal-header">
              <h3>🛑 Confirm Emergency Abort</h3>
            </div>
            <div className="modal-content">
              <p>
                This will immediately halt all execution operations. Current transactions
                may be left in an incomplete state.
              </p>
              <div className="danger-box">
                <strong>Warning:</strong> This action cannot be undone. Use only in emergency situations.
              </div>
              <ul>
                <li>All pending transactions will be cancelled</li>
                <li>Current transactions may fail or remain pending</li>
                <li>Manual intervention may be required to resolve issues</li>
              </ul>
            </div>
            <div className="modal-actions">
              <button
                onClick={() => setShowAbortConfirm(false)}
                className="secondary-button"
              >
                Cancel
              </button>
              <button
                onClick={confirmAbort}
                className="primary-button abort-button"
              >
                Emergency Abort
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExecutionControls;