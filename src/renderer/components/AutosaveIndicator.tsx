/**
 * AutosaveIndicator Component
 * Shows autosave status and recovery dialog
 */

import React from 'react';
import { AutosaveStatus } from '../hooks/useAutosave';

// Icons
const CloudIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
    <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const LoaderIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14" className="spin">
    <line x1="12" y1="2" x2="12" y2="6"/>
    <line x1="12" y1="18" x2="12" y2="22"/>
    <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/>
    <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/>
    <line x1="2" y1="12" x2="6" y2="12"/>
    <line x1="18" y1="12" x2="22" y2="12"/>
    <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/>
    <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>
  </svg>
);

const AlertIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);

interface AutosaveIndicatorProps {
  status: AutosaveStatus;
  lastSaved: Date | null;
  storageType?: 'indexeddb' | 'localstorage' | null;
  saveSize?: number | null;
}

export const AutosaveIndicator: React.FC<AutosaveIndicatorProps> = ({ status, lastSaved, storageType, saveSize }) => {
  const getStatusIcon = () => {
    switch (status) {
      case 'saving':
        return <LoaderIcon />;
      case 'saved':
        return <CheckIcon />;
      case 'error':
        return <AlertIcon />;
      default:
        return <CloudIcon />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'saving':
        return 'Saving...';
      case 'saved':
        return 'Saved';
      case 'error':
        return 'Save failed';
      default:
        if (lastSaved) {
          return formatRelativeTime(lastSaved);
        }
        return 'Autosave on';
    }
  };

  const getStatusClass = () => {
    switch (status) {
      case 'saving':
        return 'autosave-saving';
      case 'saved':
        return 'autosave-saved';
      case 'error':
        return 'autosave-error';
      default:
        return '';
    }
  };

  const getTooltip = () => {
    const parts: string[] = [];
    if (lastSaved) {
      parts.push(`Last saved: ${lastSaved.toLocaleString()}`);
    }
    if (storageType) {
      parts.push(`Storage: ${storageType === 'indexeddb' ? 'IndexedDB' : 'localStorage'}`);
    }
    if (saveSize) {
      parts.push(`Size: ${formatSize(saveSize)}`);
    }
    return parts.length > 0 ? parts.join('\n') : 'Autosave enabled';
  };

  return (
    <div className={`autosave-indicator ${getStatusClass()}`} title={getTooltip()}>
      {getStatusIcon()}
      <span className="autosave-text">{getStatusText()}</span>
    </div>
  );
};

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

interface RecoveryDialogProps {
  timestamp: Date | null;
  onRecover: () => void;
  onDiscard: () => void;
}

export const RecoveryDialog: React.FC<RecoveryDialogProps> = ({ timestamp, onRecover, onDiscard }) => {
  return (
    <div className="recovery-dialog-overlay">
      <div className="recovery-dialog">
        <div className="recovery-dialog-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="48" height="48">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <path d="M12 18v-6"/>
            <path d="M9 15l3 3 3-3"/>
          </svg>
        </div>
        <h2>Recover Unsaved Work?</h2>
        <p>
          We found autosaved work from{' '}
          <strong>{timestamp ? formatRelativeTime(timestamp) : 'a previous session'}</strong>.
        </p>
        <p className="recovery-dialog-detail">
          {timestamp && `Last saved: ${timestamp.toLocaleString()}`}
        </p>
        <div className="recovery-dialog-actions">
          <button className="btn-secondary" onClick={onDiscard}>
            Start Fresh
          </button>
          <button className="btn-primary" onClick={onRecover}>
            Recover Work
          </button>
        </div>
      </div>
    </div>
  );
};

// Helper function to format relative time
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) {
    return 'just now';
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays === 1) {
    return 'yesterday';
  } else {
    return `${diffDays} days ago`;
  }
}

