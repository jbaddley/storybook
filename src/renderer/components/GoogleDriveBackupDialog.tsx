import React, { useState, useEffect } from 'react';
import { googleDocsService, GoogleDriveFile } from '../services/googleDocsService';
import { googleAuthService } from '../services/googleAuthService';
import { fileService } from '../services/fileService';
import { useBookStore } from '../stores/bookStore';

interface GoogleDriveBackupDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

type Tab = 'backup' | 'restore';

export const GoogleDriveBackupDialog: React.FC<GoogleDriveBackupDialogProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('backup');
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [sbkFiles, setSbkFiles] = useState<GoogleDriveFile[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  const { book, ui, setBook } = useBookStore();
  const currentFilePath = ui.currentFilePath;

  useEffect(() => {
    if (isOpen) {
      // Check authentication
      const hasTokens = googleAuthService.loadTokens();
      setIsAuthenticated(hasTokens && googleAuthService.isAuthenticated());
      setError('');
      setSuccess('');
      setProgress('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && activeTab === 'restore' && isAuthenticated) {
      loadSbkFiles();
    }
  }, [isOpen, activeTab, isAuthenticated]);

  const loadSbkFiles = async () => {
    setIsLoading(true);
    setError('');
    try {
      const files = await googleDocsService.listSbkFiles();
      setSbkFiles(files);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to list backup files');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackup = async () => {
    if (!book) {
      setError('No book loaded to backup');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');
    setProgress('Preparing backup...');

    try {
      // Get or create the backup folder
      setProgress('Finding backup folder...');
      const folderId = await googleDocsService.getOrCreateBackupFolder();

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const fileName = `${book.title || 'Untitled'} - ${timestamp}.sbk`;

      // Save book to base64
      setProgress('Compressing book data...');
      const base64Data = await fileService.saveBook(book);

      // Upload to Drive
      const result = await googleDocsService.uploadSbkFile(
        base64Data,
        fileName,
        folderId,
        undefined,
        setProgress
      );

      setSuccess(`Backup saved to Google Drive!\n\nFile: ${fileName}`);
      setProgress('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Backup failed');
      setProgress('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async (file: GoogleDriveFile) => {
    if (!confirm(`Restore "${file.name}"?\n\nThis will replace your current book with the backup.`)) {
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');
    setProgress('Downloading backup...');

    try {
      const base64Data = await googleDocsService.downloadSbkFile(file.id);
      
      setProgress('Loading book data...');
      const loadedBook = await fileService.loadBook(base64Data);
      
      setBook(loadedBook);
      setSuccess(`Restored "${file.name}" successfully!`);
      setProgress('');
      
      // Close dialog after short delay
      setTimeout(() => onClose(), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Restore failed');
      setProgress('');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatSize = (size: number | string | undefined) => {
    if (!size) return 'Unknown size';
    const bytes = typeof size === 'string' ? parseInt(size, 10) : size;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!isOpen) return null;

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div 
        className="dialog google-drive-backup-dialog" 
        onClick={(e) => e.stopPropagation()}
        style={{ width: '550px', maxHeight: '80vh' }}
      >
        <div className="dialog-header">
          <h2>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '8px', verticalAlign: 'middle' }}>
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
            Google Drive Backup
          </h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        {!isAuthenticated ? (
          <div className="dialog-content" style={{ textAlign: 'center', padding: '40px 20px' }}>
            <p style={{ marginBottom: '20px', color: '#a1a1aa' }}>
              Please sign in with Google first using the Google Docs import/export feature.
            </p>
            <button className="btn btn-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        ) : (
          <>
            <div className="dialog-tabs" style={{ display: 'flex', borderBottom: '1px solid #3f3f46', marginBottom: '16px' }}>
              <button
                className={`tab-button ${activeTab === 'backup' ? 'active' : ''}`}
                onClick={() => setActiveTab('backup')}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: activeTab === 'backup' ? '#3f3f46' : 'transparent',
                  border: 'none',
                  color: activeTab === 'backup' ? '#fff' : '#a1a1aa',
                  cursor: 'pointer',
                  borderRadius: '4px 4px 0 0',
                }}
              >
                ⬆️ Backup to Drive
              </button>
              <button
                className={`tab-button ${activeTab === 'restore' ? 'active' : ''}`}
                onClick={() => setActiveTab('restore')}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: activeTab === 'restore' ? '#3f3f46' : 'transparent',
                  border: 'none',
                  color: activeTab === 'restore' ? '#fff' : '#a1a1aa',
                  cursor: 'pointer',
                  borderRadius: '4px 4px 0 0',
                }}
              >
                ⬇️ Restore from Drive
              </button>
            </div>

            <div className="dialog-content" style={{ padding: '0 20px 20px', minHeight: '300px', maxHeight: '400px', overflowY: 'auto' }}>
              {error && (
                <div style={{ 
                  background: '#dc262620', 
                  border: '1px solid #dc2626', 
                  borderRadius: '8px', 
                  padding: '12px', 
                  marginBottom: '16px',
                  color: '#fca5a5'
                }}>
                  {error}
                </div>
              )}

              {success && (
                <div style={{ 
                  background: '#16a34a20', 
                  border: '1px solid #16a34a', 
                  borderRadius: '8px', 
                  padding: '12px', 
                  marginBottom: '16px',
                  color: '#86efac',
                  whiteSpace: 'pre-wrap'
                }}>
                  {success}
                </div>
              )}

              {progress && (
                <div style={{ 
                  background: '#3b82f620', 
                  border: '1px solid #3b82f6', 
                  borderRadius: '8px', 
                  padding: '12px', 
                  marginBottom: '16px',
                  color: '#93c5fd',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}>
                  <div className="spinner" style={{ width: '16px', height: '16px' }} />
                  {progress}
                </div>
              )}

              {activeTab === 'backup' && (
                <div>
                  <p style={{ color: '#a1a1aa', marginBottom: '20px' }}>
                    Save your entire book file (.sbk) to Google Drive for safekeeping. 
                    Backups are stored in a "Storybook Backups" folder.
                  </p>
                  
                  <div style={{ 
                    background: '#27272a', 
                    borderRadius: '8px', 
                    padding: '16px', 
                    marginBottom: '20px' 
                  }}>
                    <div style={{ marginBottom: '8px' }}>
                      <strong>Current Book:</strong> {book?.title || 'Untitled'}
                    </div>
                    <div style={{ color: '#a1a1aa', fontSize: '14px' }}>
                      {book?.chapters.length || 0} chapters • {currentFilePath ? 'Saved locally' : 'Not saved locally'}
                    </div>
                  </div>

                  <button
                    className="btn btn-primary"
                    onClick={handleBackup}
                    disabled={isLoading || !book}
                    style={{ width: '100%', padding: '14px' }}
                  >
                    {isLoading ? 'Backing up...' : '⬆️ Backup to Google Drive'}
                  </button>
                </div>
              )}

              {activeTab === 'restore' && (
                <div>
                  <p style={{ color: '#a1a1aa', marginBottom: '20px' }}>
                    Restore a previous backup from Google Drive.
                  </p>

                  {isLoading && !sbkFiles.length ? (
                    <div style={{ textAlign: 'center', padding: '40px' }}>
                      <div className="spinner" style={{ margin: '0 auto 16px' }} />
                      Loading backups...
                    </div>
                  ) : sbkFiles.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#71717a' }}>
                      No .sbk backup files found in Google Drive.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {sbkFiles.map((file) => (
                        <div
                          key={file.id}
                          style={{
                            background: '#27272a',
                            borderRadius: '8px',
                            padding: '12px 16px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            cursor: 'pointer',
                            transition: 'background 0.2s',
                          }}
                          onClick={() => !isLoading && handleRestore(file)}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#3f3f46'}
                          onMouseLeave={(e) => e.currentTarget.style.background = '#27272a'}
                        >
                          <div>
                            <div style={{ fontWeight: 500, marginBottom: '4px' }}>
                              📄 {file.name}
                            </div>
                            <div style={{ fontSize: '12px', color: '#71717a' }}>
                              {formatDate(file.modifiedTime)} • {formatSize((file as any).size)}
                            </div>
                          </div>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '6px 12px', fontSize: '13px' }}
                            disabled={isLoading}
                          >
                            Restore
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    className="btn btn-secondary"
                    onClick={loadSbkFiles}
                    disabled={isLoading}
                    style={{ marginTop: '16px', width: '100%' }}
                  >
                    🔄 Refresh List
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
