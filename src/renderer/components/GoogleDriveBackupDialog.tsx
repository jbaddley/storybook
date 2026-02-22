import React, { useState, useEffect, useCallback } from 'react';
import { googleDocsService, GoogleDriveFile } from '../services/googleDocsService';
import { googleAuthService } from '../services/googleAuthService';
import { fileService } from '../services/fileService';
import { databaseService } from '../services/databaseService';
import { useBookStore } from '../stores/bookStore';

interface GoogleDriveBackupDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

type Tab = 'backup' | 'restore';

interface FolderPathItem {
  id: string;
  name: string;
}

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

  // Folder picker for backup destination
  const [folderPath, setFolderPath] = useState<FolderPathItem[]>([{ id: 'root', name: 'My Drive' }]);
  const [backupFolders, setBackupFolders] = useState<GoogleDriveFile[]>([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  
  const { book, ui, setBook } = useBookStore();
  const currentFilePath = ui.currentFilePath;

  const currentFolderId = folderPath.length > 0 ? folderPath[folderPath.length - 1].id : 'root';
  const backupFolderIdForSave = currentFolderId === 'root' ? null : currentFolderId;

  useEffect(() => {
    if (isOpen) {
      // Check authentication
      const hasTokens = googleAuthService.loadTokens();
      setIsAuthenticated(hasTokens && googleAuthService.isAuthenticated());
      setError('');
      setSuccess('');
      setProgress('');
      setFolderPath([{ id: 'root', name: 'My Drive' }]);
      setNewFolderName('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && activeTab === 'restore' && isAuthenticated) {
      loadSbkFiles();
    }
  }, [isOpen, activeTab, isAuthenticated]);

  const loadBackupFolders = useCallback(async (parentId?: string) => {
    setIsLoadingFolders(true);
    setError('');
    try {
      const list = await googleDocsService.listFolders(parentId === 'root' ? undefined : parentId);
      setBackupFolders(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load folders');
      setBackupFolders([]);
    } finally {
      setIsLoadingFolders(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && activeTab === 'backup' && isAuthenticated) {
      loadBackupFolders(currentFolderId === 'root' ? undefined : currentFolderId);
    }
  }, [isOpen, activeTab, isAuthenticated, currentFolderId, loadBackupFolders]);

  const handleNavigateIntoFolder = (folder: GoogleDriveFile) => {
    setFolderPath(prev => [...prev, { id: folder.id, name: folder.name }]);
    loadBackupFolders(folder.id);
  };

  const handleNavigateUp = () => {
    if (folderPath.length <= 1) return;
    const newPath = folderPath.slice(0, -1);
    setFolderPath(newPath);
    const parentId = newPath[newPath.length - 1].id;
    loadBackupFolders(parentId === 'root' ? undefined : parentId);
  };

  const handleNavigateToBreadcrumb = (index: number) => {
    const newPath = folderPath.slice(0, index + 1);
    setFolderPath(newPath);
    const targetId = newPath[newPath.length - 1].id;
    loadBackupFolders(targetId === 'root' ? undefined : targetId);
  };

  const handleCreateFolder = async () => {
    const name = newFolderName.trim() || 'Storybook Backups';
    if (!name) return;
    setIsCreatingFolder(true);
    setError('');
    try {
      const parentId = backupFolderIdForSave || undefined;
      const { folderId } = await googleDocsService.createFolder(name, parentId);
      setNewFolderName('');
      setFolderPath(prev => [...prev, { id: folderId, name }]);
      loadBackupFolders(folderId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create folder');
    } finally {
      setIsCreatingFolder(false);
    }
  };

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
      // Use selected folder or default "Storybook Backups"
      let folderId: string;
      if (backupFolderIdForSave) {
        folderId = backupFolderIdForSave;
        setProgress('Using selected folder...');
      } else {
        setProgress('Finding backup folder...');
        folderId = await googleDocsService.getOrCreateBackupFolder();
      }

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
      const revisionData = await databaseService.getRevisionDataForBook(loadedBook.id);
      const bookToSet = revisionData
        ? { ...loadedBook, revisionPasses: revisionData.revisionPasses, chapterRevisionCompletions: revisionData.chapterRevisionCompletions }
        : loadedBook;
      setBook(bookToSet);
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
                  <p style={{ color: '#a1a1aa', marginBottom: '12px' }}>
                    Choose a folder for the backup, or use the default &quot;Storybook Backups&quot; folder. You can create a new folder below.
                  </p>

                  {/* Breadcrumb */}
                  <div style={{ marginBottom: '10px', fontSize: '13px', color: '#a1a1aa', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px' }}>
                    {folderPath.map((item, index) => (
                      <span key={item.id}>
                        <button
                          type="button"
                          onClick={() => handleNavigateToBreadcrumb(index)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: index === folderPath.length - 1 ? '#fff' : '#a1a1aa',
                            cursor: 'pointer',
                            padding: 0,
                            textDecoration: index === folderPath.length - 1 ? 'none' : 'underline',
                          }}
                        >
                          {item.name}
                        </button>
                        {index < folderPath.length - 1 && <span style={{ marginLeft: '4px' }}>›</span>}
                      </span>
                    ))}
                  </div>

                  {/* Folder list */}
                  <div style={{
                    background: '#27272a',
                    borderRadius: '8px',
                    padding: '12px',
                    marginBottom: '12px',
                    maxHeight: '160px',
                    overflowY: 'auto',
                  }}>
                    {folderPath.length > 1 && (
                      <button
                        type="button"
                        onClick={handleNavigateUp}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          width: '100%',
                          padding: '8px 12px',
                          marginBottom: '6px',
                          background: '#3f3f46',
                          border: 'none',
                          borderRadius: '6px',
                          color: '#fff',
                          cursor: 'pointer',
                          fontSize: '14px',
                          textAlign: 'left',
                        }}
                      >
                        ↩ Up
                      </button>
                    )}
                    {isLoadingFolders ? (
                      <div style={{ padding: '16px', textAlign: 'center', color: '#71717a' }}>Loading folders…</div>
                    ) : backupFolders.length === 0 ? (
                      <div style={{ padding: '16px', textAlign: 'center', color: '#71717a' }}>
                        No folders here. Create one below or backup to this location.
                      </div>
                    ) : (
                      backupFolders.map((folder) => (
                        <button
                          type="button"
                          key={folder.id}
                          onClick={() => handleNavigateIntoFolder(folder)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            width: '100%',
                            padding: '8px 12px',
                            marginBottom: '4px',
                            background: 'transparent',
                            border: 'none',
                            borderRadius: '6px',
                            color: '#fff',
                            cursor: 'pointer',
                            fontSize: '14px',
                            textAlign: 'left',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = '#3f3f46'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                        >
                          📁 {folder.name}
                        </button>
                      ))
                    )}
                  </div>

                  {/* Create new folder */}
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                    <input
                      type="text"
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      placeholder="New folder name"
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        background: '#27272a',
                        border: '1px solid #3f3f46',
                        borderRadius: '6px',
                        color: '#fff',
                        fontSize: '14px',
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleCreateFolder}
                      disabled={isCreatingFolder}
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      {isCreatingFolder ? 'Creating…' : '+ Add folder'}
                    </button>
                  </div>

                  <div style={{ background: '#27272a', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
                    <div style={{ marginBottom: '4px' }}>
                      <strong>Current Book:</strong> {book?.title || 'Untitled'}
                    </div>
                    <div style={{ color: '#a1a1aa', fontSize: '13px' }}>
                      {book?.chapters.length || 0} chapters • {currentFilePath ? 'Saved locally' : 'Not saved locally'}
                    </div>
                    {backupFolderIdForSave && (
                      <div style={{ color: '#71717a', fontSize: '12px', marginTop: '6px' }}>
                        Backup destination: {folderPath.map(p => p.name).join(' › ')}
                      </div>
                    )}
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
