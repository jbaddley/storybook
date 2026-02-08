/**
 * RecoveryTool Component
 * Shows file backups and allows restoring from them
 */

import React, { useState, useEffect } from 'react';
import { useBookStore } from '../stores/bookStore';
import { fileService } from '../services/fileService';

interface BackupInfo {
  path: string;
  number: number;
  modified: Date;
  size: number;
}

interface RecoveryToolProps {
  onClose: () => void;
}

// Check if running in Electron
const isElectron = () => typeof window !== 'undefined' && window.electronAPI !== undefined;

export const RecoveryTool: React.FC<RecoveryToolProps> = ({ onClose }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const [restoring, setRestoring] = useState(false);
  
  const { ui, setBook, setDirty } = useBookStore();
  const currentFilePath = ui.currentFilePath;

  useEffect(() => {
    loadBackups();
  }, [currentFilePath]);

  const loadBackups = async () => {
    setIsLoading(true);
    setError(null);
    
    if (!isElectron() || !currentFilePath) {
      setIsLoading(false);
      return;
    }
    
    try {
      const backupList = await window.electronAPI.listBackups(currentFilePath);
      // Convert date strings back to Date objects
      const backupsWithDates = backupList.map(b => ({
        ...b,
        modified: new Date(b.modified),
      }));
      setBackups(backupsWithDates);
    } catch (err) {
      console.error('Error loading backups:', err);
      setError('Could not load backups');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async (backup: BackupInfo) => {
    if (!currentFilePath) return;
    
    const confirmRestore = confirm(
      `Restore from backup ${backup.number}?\n\n` +
      `This will replace your current file with the version from:\n` +
      `${backup.modified.toLocaleString()}\n\n` +
      `Your current version will be saved as a backup first.`
    );
    
    if (!confirmRestore) return;
    
    setRestoring(true);
    setError(null);
    
    try {
      // Restore the backup (returns the file data)
      const restoredData = await window.electronAPI.restoreBackup(backup.path, currentFilePath);
      
      // Load the restored data into the app
      const loadedBook = await fileService.loadBook(restoredData);
      setBook(loadedBook);
      setDirty(false);
      
      setRestored(true);
      
      // Reload backup list
      await loadBackups();
    } catch (err) {
      console.error('Error restoring backup:', err);
      setError('Failed to restore backup');
    } finally {
      setRestoring(false);
    }
  };

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatRelativeTime = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSeconds < 60) {
      return 'just now';
    } else if (diffMinutes < 60) {
      return `${diffMinutes} min ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else if (diffDays === 1) {
      return 'yesterday';
    } else {
      return `${diffDays} days ago`;
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="dialog-overlay" onClick={handleOverlayClick}>
      <div className="dialog" style={{ width: '500px' }} onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h2 className="dialog-title">📂 File Backups</h2>
          <button className="dialog-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="dialog-content">
          {!isElectron() ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              <p>Backups are only available in the desktop app.</p>
            </div>
          ) : !currentFilePath ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}>💾</div>
              <h3 style={{ marginBottom: '8px', color: 'var(--text-muted)' }}>No File Saved Yet</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                Save your book first (⌘S) to enable automatic backups.
              </p>
            </div>
          ) : isLoading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <p>Loading backups...</p>
            </div>
          ) : error && !restored ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#f87171' }}>
              <p>{error}</p>
              <button className="btn-secondary" onClick={loadBackups} style={{ marginTop: '16px' }}>
                Try Again
              </button>
            </div>
          ) : restored ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
              <h3 style={{ marginBottom: '8px' }}>Backup Restored!</h3>
              <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
                Your file has been restored from the backup.
              </p>
              <button className="btn-primary" onClick={onClose}>
                Close
              </button>
            </div>
          ) : backups.length > 0 ? (
            <>
              <div style={{ 
                background: 'rgba(137, 180, 250, 0.1)', 
                border: '1px solid rgba(137, 180, 250, 0.3)',
                borderRadius: '8px',
                padding: '12px 16px',
                marginBottom: '20px',
                fontSize: '13px',
              }}>
                <strong>💡 Smart backups</strong>
                <p style={{ margin: '8px 0 0 0', color: 'var(--text-muted)' }}>
                  Backups are created automatically when you make significant changes. 
                  Up to 20 versions are stored, with a minimum of 5 minutes between backups.
                </p>
              </div>

              <div style={{ marginBottom: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                Current file: <strong>{currentFilePath.split('/').pop()}</strong>
              </div>

              <div style={{ 
                background: 'var(--bg-secondary)',
                borderRadius: '8px',
                overflow: 'hidden',
              }}>
                {backups.map((backup, index) => (
                  <div 
                    key={backup.number}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      borderBottom: index < backups.length - 1 ? '1px solid var(--border-color)' : 'none',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 500, marginBottom: '4px' }}>
                        Backup {backup.number}
                        {backup.number === 1 && (
                          <span style={{ 
                            marginLeft: '8px', 
                            fontSize: '11px', 
                            background: 'rgba(74, 222, 128, 0.2)',
                            color: '#4ade80',
                            padding: '2px 6px',
                            borderRadius: '4px',
                          }}>
                            Most Recent
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {formatRelativeTime(backup.modified)} • {formatSize(backup.size)}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {backup.modified.toLocaleString()}
                      </div>
                    </div>
                    <button
                      className="btn-secondary"
                      onClick={() => handleRestore(backup)}
                      disabled={restoring}
                      style={{ fontSize: '12px', padding: '6px 12px' }}
                    >
                      {restoring ? 'Restoring...' : 'Restore'}
                    </button>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}>📭</div>
              <h3 style={{ marginBottom: '8px', color: 'var(--text-muted)' }}>No Backups Yet</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '16px' }}>
                Backups are created automatically each time you save.
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                Save your file a few times to create backup versions.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
