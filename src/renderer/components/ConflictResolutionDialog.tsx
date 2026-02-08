import React, { useState } from 'react';
import { ConflictWithResolution, ConflictResolution } from '../services/dbSyncService';

interface ConflictResolutionDialogProps {
  conflicts: ConflictWithResolution[];
  onResolve: (resolutions: Map<string, ConflictResolution>) => void;
  onCancel: () => void;
}

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const WarningIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

const DatabaseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
    <ellipse cx="12" cy="5" rx="9" ry="3"/>
    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
  </svg>
);

const FileIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14,2 14,8 20,8"/>
  </svg>
);

export const ConflictResolutionDialog: React.FC<ConflictResolutionDialogProps> = ({
  conflicts,
  onResolve,
  onCancel,
}) => {
  const [resolutions, setResolutions] = useState<Map<string, ConflictResolution>>(() => {
    // Default to 'keep_file' for all conflicts
    const map = new Map<string, ConflictResolution>();
    conflicts.forEach(c => map.set(c.chapterId, 'keep_file'));
    return map;
  });

  const handleResolutionChange = (chapterId: string, resolution: ConflictResolution) => {
    setResolutions(prev => {
      const newMap = new Map(prev);
      newMap.set(chapterId, resolution);
      return newMap;
    });
  };

  const handleApplyAll = (resolution: ConflictResolution) => {
    const newMap = new Map<string, ConflictResolution>();
    conflicts.forEach(c => newMap.set(c.chapterId, resolution));
    setResolutions(newMap);
  };

  const handleResolve = () => {
    onResolve(resolutions);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Unknown';
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  const getConflictDescription = (conflict: ConflictWithResolution): string => {
    switch (conflict.type) {
      case 'deleted_locally':
        return 'This chapter exists in the database but was deleted locally.';
      case 'deleted_in_db':
        return 'This chapter exists locally but was deleted from the database.';
      case 'both_modified':
        return 'This chapter was modified in both locations.';
      default:
        return 'Unknown conflict type.';
    }
  };

  return (
    <div className="dialog-overlay" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="dialog conflict-resolution-dialog" style={{ width: '600px', maxWidth: '90vw' }}>
        <div className="dialog-header">
          <div className="dialog-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'var(--warning-color)' }}><WarningIcon /></span>
            Sync Conflicts Detected
          </div>
          <button className="dialog-close" onClick={onCancel}>
            <CloseIcon />
          </button>
        </div>

        <div className="dialog-content">
          <div className="conflict-intro" style={{ marginBottom: '16px', color: 'var(--text-secondary)' }}>
            <p style={{ margin: '0 0 8px 0' }}>
              There are differences between your local file and the database that need to be resolved.
              Choose which version to keep for each conflicting chapter.
            </p>
          </div>

          <div className="conflict-quick-actions" style={{ 
            display: 'flex', 
            gap: '8px', 
            marginBottom: '16px',
            paddingBottom: '16px',
            borderBottom: '1px solid var(--border-color)'
          }}>
            <span style={{ color: 'var(--text-secondary)', marginRight: '8px' }}>Apply to all:</span>
            <button 
              className="btn btn-secondary btn-sm"
              onClick={() => handleApplyAll('keep_file')}
              style={{ fontSize: '12px', padding: '4px 8px' }}
            >
              <FileIcon /> Keep Local
            </button>
            <button 
              className="btn btn-secondary btn-sm"
              onClick={() => handleApplyAll('keep_db')}
              style={{ fontSize: '12px', padding: '4px 8px' }}
            >
              <DatabaseIcon /> Keep Database
            </button>
            <button 
              className="btn btn-secondary btn-sm"
              onClick={() => handleApplyAll('keep_both')}
              style={{ fontSize: '12px', padding: '4px 8px' }}
            >
              Keep Both
            </button>
          </div>

          <div className="conflict-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {conflicts.map(conflict => (
              <div 
                key={conflict.chapterId} 
                className="conflict-item"
                style={{
                  background: 'var(--bg-secondary)',
                  borderRadius: '8px',
                  padding: '12px',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'flex-start',
                  marginBottom: '8px'
                }}>
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: '4px' }}>
                      {conflict.chapterTitle}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {getConflictDescription(conflict)}
                    </div>
                  </div>
                  <div style={{
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 500,
                    background: conflict.type === 'deleted_locally' ? 'var(--error-bg)' : 
                               conflict.type === 'deleted_in_db' ? 'var(--warning-bg)' : 
                               'var(--info-bg)',
                    color: conflict.type === 'deleted_locally' ? 'var(--error-color)' : 
                           conflict.type === 'deleted_in_db' ? 'var(--warning-color)' : 
                           'var(--info-color)',
                  }}>
                    {conflict.type === 'deleted_locally' ? 'Deleted Locally' :
                     conflict.type === 'deleted_in_db' ? 'Deleted in DB' :
                     'Both Modified'}
                  </div>
                </div>

                <div style={{ 
                  display: 'flex', 
                  gap: '16px', 
                  fontSize: '11px', 
                  color: 'var(--text-tertiary)',
                  marginBottom: '12px'
                }}>
                  {conflict.dbUpdatedAt && (
                    <span><DatabaseIcon /> DB: {formatDate(conflict.dbUpdatedAt)}</span>
                  )}
                  {conflict.localUpdatedAt && (
                    <span><FileIcon /> Local: {formatDate(conflict.localUpdatedAt)}</span>
                  )}
                </div>

                <div className="conflict-resolution-options" style={{ display: 'flex', gap: '8px' }}>
                  <label style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    background: resolutions.get(conflict.chapterId) === 'keep_file' 
                      ? 'var(--accent-color)' 
                      : 'transparent',
                    color: resolutions.get(conflict.chapterId) === 'keep_file'
                      ? 'white'
                      : 'var(--text-secondary)',
                    border: '1px solid var(--border-color)',
                    fontSize: '12px',
                  }}>
                    <input
                      type="radio"
                      name={`resolution-${conflict.chapterId}`}
                      checked={resolutions.get(conflict.chapterId) === 'keep_file'}
                      onChange={() => handleResolutionChange(conflict.chapterId, 'keep_file')}
                      style={{ display: 'none' }}
                    />
                    <FileIcon /> Keep Local
                  </label>

                  <label style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    background: resolutions.get(conflict.chapterId) === 'keep_db' 
                      ? 'var(--accent-color)' 
                      : 'transparent',
                    color: resolutions.get(conflict.chapterId) === 'keep_db'
                      ? 'white'
                      : 'var(--text-secondary)',
                    border: '1px solid var(--border-color)',
                    fontSize: '12px',
                  }}>
                    <input
                      type="radio"
                      name={`resolution-${conflict.chapterId}`}
                      checked={resolutions.get(conflict.chapterId) === 'keep_db'}
                      onChange={() => handleResolutionChange(conflict.chapterId, 'keep_db')}
                      style={{ display: 'none' }}
                    />
                    <DatabaseIcon /> Keep Database
                  </label>

                  <label style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    background: resolutions.get(conflict.chapterId) === 'keep_both' 
                      ? 'var(--accent-color)' 
                      : 'transparent',
                    color: resolutions.get(conflict.chapterId) === 'keep_both'
                      ? 'white'
                      : 'var(--text-secondary)',
                    border: '1px solid var(--border-color)',
                    fontSize: '12px',
                  }}>
                    <input
                      type="radio"
                      name={`resolution-${conflict.chapterId}`}
                      checked={resolutions.get(conflict.chapterId) === 'keep_both'}
                      onChange={() => handleResolutionChange(conflict.chapterId, 'keep_both')}
                      style={{ display: 'none' }}
                    />
                    Keep Both
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="dialog-footer">
          <button className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleResolve}>
            Apply Resolutions
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConflictResolutionDialog;
