/**
 * AutosaveIndicator Component
 * Shows autosave status in the title bar
 */

import React from 'react';
import { AutosaveStatus } from '../hooks/useAutosave';

// Icons
const SaveIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
    <polyline points="17 21 17 13 7 13 7 21"/>
    <polyline points="7 3 7 8 15 8"/>
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

const FileOffIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeDasharray="4 2"/>
    <polyline points="14 2 14 8 20 8"/>
  </svg>
);

interface AutosaveIndicatorProps {
  status: AutosaveStatus;
  lastSaved: Date | null;
  filePath?: string | null;
}

export const AutosaveIndicator: React.FC<AutosaveIndicatorProps> = ({ status, lastSaved, filePath }) => {
  const getStatusIcon = () => {
    switch (status) {
      case 'saving':
        return <LoaderIcon />;
      case 'saved':
        return <CheckIcon />;
      case 'error':
        return <AlertIcon />;
      case 'no-file':
        return <FileOffIcon />;
      default:
        return <SaveIcon />;
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
      case 'no-file':
        return 'Not saved';
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
      case 'no-file':
        return 'autosave-no-file';
      default:
        return '';
    }
  };

  const getTooltip = () => {
    if (status === 'no-file') {
      return 'Save your file (⌘S) to enable autosave';
    }
    const parts: string[] = [];
    if (filePath) {
      // Show just the filename
      const fileName = filePath.split('/').pop() || filePath;
      parts.push(`File: ${fileName}`);
    }
    if (lastSaved) {
      parts.push(`Last saved: ${lastSaved.toLocaleString()}`);
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

