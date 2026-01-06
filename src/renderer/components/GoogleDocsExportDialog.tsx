import React, { useState, useEffect, useCallback } from 'react';
import { googleAuthService, GoogleCredentials } from '../services/googleAuthService';
import { googleDocsService, GoogleDriveFile } from '../services/googleDocsService';
import { saveAutosave } from '../services/storageService';
import { useBookStore } from '../stores/bookStore';

interface GoogleDocsExportDialogProps {
  onClose: () => void;
}

// Icons
const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

const FolderIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
  </svg>
);

const BackIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);

const LoadingSpinner = () => (
  <div className="spinner" style={{ width: '20px', height: '20px' }} />
);

type DialogStep = 'auth' | 'configure' | 'exporting' | 'success';

interface FolderPath {
  id: string;
  name: string;
}

export const GoogleDocsExportDialog: React.FC<GoogleDocsExportDialogProps> = ({ onClose }) => {
  const { book, setGoogleDocsExport } = useBookStore();
  
  // Initialize with previous export location if available
  const previousExport = book.metadata.googleDocsExport;
  
  const [step, setStep] = useState<DialogStep>('auth');
  const [fileName, setFileName] = useState(previousExport?.documentName || book.title || 'Untitled Book');
  const [folders, setFolders] = useState<GoogleDriveFile[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<GoogleDriveFile | null>(null);
  const [folderPath, setFolderPath] = useState<FolderPath[]>([{ id: 'root', name: 'My Drive' }]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportProgress, setExportProgress] = useState('');
  const [exportResult, setExportResult] = useState<{ documentId: string; webViewLink: string } | null>(null);
  
  // Include references checkboxes
  const [includeCharacters, setIncludeCharacters] = useState(true);
  const [includeLocations, setIncludeLocations] = useState(true);
  const [includeTimeline, setIncludeTimeline] = useState(true);
  const [includeSummaries, setIncludeSummaries] = useState(true);

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      // Try to load saved credentials
      let creds: GoogleCredentials | null = null;
      
      if (window.electronAPI?.storeGet) {
        creds = await window.electronAPI.storeGet('google_credentials') as GoogleCredentials | null;
      }
      
      if (!creds) {
        const savedCredentials = localStorage.getItem('google_credentials');
        if (savedCredentials) {
          creds = JSON.parse(savedCredentials);
        }
      }

      if (creds?.clientId && creds?.clientSecret) {
        googleAuthService.setCredentials(creds);
        
        // Check if we have valid tokens
        if (googleAuthService.loadTokens() && googleAuthService.isAuthenticated()) {
          setStep('configure');
          loadFolders();
        }
      }
    };
    
    checkAuth();
  }, []);

  // Load folders
  const loadFolders = useCallback(async (parentId?: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const foldersResult = await googleDocsService.listFolders(parentId === 'root' ? undefined : parentId);
      setFolders(foldersResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load folders');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Navigate into a folder
  const handleNavigateIntoFolder = (folder: GoogleDriveFile) => {
    setFolderPath(prev => [...prev, { id: folder.id, name: folder.name }]);
    setSelectedFolder(folder);
    loadFolders(folder.id);
  };

  // Navigate back up
  const handleNavigateUp = () => {
    if (folderPath.length <= 1) return;
    
    const newPath = folderPath.slice(0, -1);
    setFolderPath(newPath);
    const parentId = newPath[newPath.length - 1].id;
    setSelectedFolder(newPath.length > 1 ? { id: parentId, name: newPath[newPath.length - 1].name } as GoogleDriveFile : null);
    loadFolders(parentId === 'root' ? undefined : parentId);
  };

  // Navigate to specific path item
  const handleNavigateToPath = (index: number) => {
    const newPath = folderPath.slice(0, index + 1);
    setFolderPath(newPath);
    const targetId = newPath[newPath.length - 1].id;
    setSelectedFolder(index > 0 ? { id: targetId, name: newPath[newPath.length - 1].name } as GoogleDriveFile : null);
    loadFolders(targetId === 'root' ? undefined : targetId);
  };

  // Helper to get chapter title from ID
  const getChapterTitle = (chapterId: string): string => {
    const chapter = book.chapters.find(ch => ch.id === chapterId);
    return chapter?.title || 'Unknown Chapter';
  };

  // Get reference content as plain text
  const getCharactersText = (): string => {
    const characters = book.extracted.characters;
    if (!characters || characters.length === 0) return '';
    
    return characters.map(char => {
      let text = `${char.name}`;
      if (char.aliases && char.aliases.length > 0) {
        text += ` (${char.aliases.join(', ')})`;
      }
      text += '\n';
      if (char.description) {
        text += `${char.description}\n`;
      }
      if (char.mentions && char.mentions.length > 0) {
        const chapterNames = char.mentions.map(m => getChapterTitle(m.chapterId));
        text += `Chapters: ${chapterNames.join(', ')}\n`;
      }
      return text;
    }).join('\n');
  };

  const getLocationsText = (): string => {
    const locations = book.extracted.locations;
    if (!locations || locations.length === 0) return '';
    
    return locations.map(loc => {
      let text = `${loc.name}\n`;
      if (loc.description) {
        text += `${loc.description}\n`;
      }
      if (loc.mentions && loc.mentions.length > 0) {
        const chapterNames = loc.mentions.map(m => getChapterTitle(m.chapterId));
        text += `Chapters: ${chapterNames.join(', ')}\n`;
      }
      return text;
    }).join('\n');
  };

  const getTimelineText = (): string => {
    const events = book.extracted.timeline;
    if (!events || events.length === 0) return '';
    
    return events.map(evt => {
      let text = '';
      if (evt.date) {
        text += `[${evt.date}] `;
      }
      text += `${evt.description}\n`;
      if (evt.chapterTitle) {
        text += `(${evt.chapterTitle})\n`;
      }
      return text;
    }).join('\n');
  };

  const getSummariesText = (): string => {
    const summaries = book.extracted.summaries;
    if (!summaries || summaries.length === 0) return '';
    
    return summaries.map(sum => {
      const chapterTitle = getChapterTitle(sum.chapterId);
      return `${chapterTitle}\n${sum.summary}\n`;
    }).join('\n');
  };

  // Handle export
  const handleExport = async () => {
    if (!fileName.trim()) {
      setError('Please enter a file name');
      return;
    }

    setStep('exporting');
    setError(null);

    try {
      // Prepare chapters
      const chapters = book.chapters.map(ch => ({
        title: ch.title,
        content: ch.content,
      }));

      // Prepare references
      const references: {
        characters?: string;
        locations?: string;
        timeline?: string;
        summaries?: string;
      } = {};

      if (includeCharacters) references.characters = getCharactersText();
      if (includeLocations) references.locations = getLocationsText();
      if (includeTimeline) references.timeline = getTimelineText();
      if (includeSummaries) references.summaries = getSummariesText();

      // Get the target folder ID
      const targetFolderId = folderPath.length > 1 
        ? folderPath[folderPath.length - 1].id 
        : undefined;

      // Export with font settings from book
      const result = await googleDocsService.exportBook(
        fileName.trim(),
        chapters,
        references,
        targetFolderId,
        setExportProgress,
        {
          titleFont: book.settings.titleFont,
          titleFontSize: book.settings.titleFontSize,
          bodyFont: book.settings.bodyFont,
          bodyFontSize: book.settings.bodyFontSize,
        }
      );

      setExportResult(result);
      
      // Save export location to book settings
      const currentFolderPath = folderPath.map(f => f.name).join(' / ');
      setGoogleDocsExport({
        documentId: result.documentId,
        documentName: fileName.trim(),
        webViewLink: result.webViewLink,
        folderId: targetFolderId,
        folderPath: currentFolderPath,
      });
      
      // Auto-save after export (to persist export metadata)
      setExportProgress('Saving...');
      const state = useBookStore.getState();
      await saveAutosave(
        state.book,
        { summaries: state.ai.summaries, suggestions: state.ai.suggestions },
        state.activeChapterId
      );
      console.log('[Export] Auto-saved after Google Docs export');
      
      setStep('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
      setStep('configure');
    }
  };

  // Handle OAuth code
  const handleOAuthCode = useCallback(async (code: string) => {
    console.log('[Export Dialog] Received OAuth code, length:', code.length);
    try {
      setIsLoading(true);
      setError(null);
      console.log('[Export Dialog] Exchanging code for tokens...');
      await googleAuthService.exchangeCodeForTokens(code);
      console.log('[Export Dialog] Tokens exchanged successfully');
      googleAuthService.saveTokens();
      console.log('[Export Dialog] Tokens saved, moving to configure step');
      setStep('configure');
      loadFolders();
    } catch (err) {
      console.error('[Export Dialog] OAuth error:', err);
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  }, [loadFolders]);

  // Handle OAuth for re-authentication with new scopes
  const handleStartAuth = () => {
    console.log('[Export Dialog] Starting OAuth flow...');
    // Clear existing tokens to force re-auth with new scopes
    googleAuthService.signOut();
    googleAuthService.clearStoredTokens();
    
    const authUrl = googleAuthService.getAuthUrl();
    console.log('[Export Dialog] Opening auth URL');
    
    // Open auth window
    const authWindow = window.open(authUrl, 'Google Auth', 'width=500,height=600');
    
    // Listen for the OAuth callback via postMessage (browser fallback)
    const handleMessage = async (event: MessageEvent) => {
      console.log('[Export Dialog] postMessage received:', event.data?.type);
      if (event.data?.type === 'google-oauth-callback' && event.data?.code) {
        console.log('[Export Dialog] Valid OAuth callback via postMessage');
        window.removeEventListener('message', handleMessage);
        handleOAuthCode(event.data.code);
      }
    };
    
    window.addEventListener('message', handleMessage);
    console.log('[Export Dialog] postMessage listener registered');
    
    // Also check periodically if the window was closed
    const checkClosed = setInterval(() => {
      if (authWindow?.closed) {
        console.log('[Export Dialog] Auth window was closed');
        clearInterval(checkClosed);
        window.removeEventListener('message', handleMessage);
      }
    }, 1000);
  };

  // Listen for OAuth callback from main process (Electron)
  useEffect(() => {
    console.log('[Export Dialog] Setting up OAuth callback listener, step:', step);
    if (step !== 'auth') {
      console.log('[Export Dialog] Not in auth step, skipping callback setup');
      return;
    }
    
    const isElectron = typeof window !== 'undefined' && window.electronAPI?.onGoogleOAuthCallback;
    console.log('[Export Dialog] Is Electron:', !!isElectron);
    if (!isElectron) return;

    console.log('[Export Dialog] Registering IPC callback listener');
    const cleanup = window.electronAPI.onGoogleOAuthCallback((code: string) => {
      console.log('[Export Dialog] IPC callback received with code length:', code.length);
      handleOAuthCode(code);
    });

    return () => {
      console.log('[Export Dialog] Cleaning up IPC callback listener');
      cleanup();
    };
  }, [step, handleOAuthCode]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="dialog-overlay" onClick={handleOverlayClick}>
      <div className="dialog" style={{ width: '600px', maxHeight: '80vh' }} onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <GoogleIcon />
            <h2 className="dialog-title">Export to Google Docs</h2>
          </div>
          <button className="dialog-close" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>

        <div className="dialog-content" style={{ minHeight: '300px' }}>
          {error && (
            <div className="error-message" style={{
              padding: '12px',
              background: 'var(--error-bg, rgba(255, 0, 0, 0.1))',
              color: 'var(--error-text, #ef4444)',
              borderRadius: '8px',
              marginBottom: '16px',
              fontSize: '13px',
            }}>
              {error}
            </div>
          )}

          {/* Auth Step */}
          {step === 'auth' && (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <GoogleIcon />
              <h3 style={{ fontSize: '16px', marginTop: '16px', marginBottom: '8px' }}>
                Connect to Google
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
                Sign in with your Google account to export your book.
                {googleAuthService.hasCredentials() && (
                  <span style={{ display: 'block', marginTop: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                    Note: You may need to re-authenticate to grant export permissions.
                  </span>
                )}
              </p>
              
              <button 
                className="btn btn-primary" 
                onClick={handleStartAuth}
                disabled={isLoading}
              >
                {isLoading ? <LoadingSpinner /> : <GoogleIcon />}
                <span style={{ marginLeft: '8px' }}>Sign in with Google</span>
              </button>

              {!googleAuthService.hasCredentials() && (
                <p style={{ marginTop: '24px', fontSize: '12px', color: 'var(--text-muted)' }}>
                  You need to set up Google credentials first. Use Import from Google Docs to configure.
                </p>
              )}
            </div>
          )}

          {/* Configure Step */}
          {step === 'configure' && (
            <>
              {/* File name */}
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label">Document Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  placeholder="Enter document name"
                />
              </div>

              {/* Folder selection */}
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label">Save Location</label>
                
                {/* Breadcrumb */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '4px',
                  marginBottom: '8px',
                  fontSize: '13px',
                  flexWrap: 'wrap',
                }}>
                  {folderPath.map((item, index) => (
                    <React.Fragment key={item.id}>
                      {index > 0 && <span style={{ color: 'var(--text-muted)' }}>/</span>}
                      <button
                        onClick={() => handleNavigateToPath(index)}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: '2px 4px',
                          cursor: 'pointer',
                          color: index === folderPath.length - 1 ? 'var(--text-primary)' : 'var(--accent-primary)',
                          fontWeight: index === folderPath.length - 1 ? 500 : 400,
                        }}
                      >
                        {item.name}
                      </button>
                    </React.Fragment>
                  ))}
                </div>

                {/* Folder list */}
                <div style={{
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  maxHeight: '200px',
                  overflowY: 'auto',
                }}>
                  {folderPath.length > 1 && (
                    <div
                      onClick={handleNavigateUp}
                      style={{
                        padding: '10px 12px',
                        cursor: 'pointer',
                        borderBottom: '1px solid var(--border-color)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '13px',
                        color: 'var(--text-secondary)',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <BackIcon />
                      <span>Go up</span>
                    </div>
                  )}

                  {isLoading ? (
                    <div style={{ padding: '20px', textAlign: 'center' }}>
                      <LoadingSpinner />
                    </div>
                  ) : folders.length === 0 ? (
                    <div style={{ 
                      padding: '20px', 
                      textAlign: 'center',
                      color: 'var(--text-muted)',
                      fontSize: '13px',
                    }}>
                      No folders here
                    </div>
                  ) : (
                    folders.map(folder => (
                      <div
                        key={folder.id}
                        onDoubleClick={() => handleNavigateIntoFolder(folder)}
                        style={{
                          padding: '10px 12px',
                          cursor: 'pointer',
                          borderBottom: '1px solid var(--border-color)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '13px',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <span style={{ color: '#FFC107' }}><FolderIcon /></span>
                        <span>{folder.name}</span>
                      </div>
                    ))
                  )}
                </div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Double-click a folder to open it. Document will be saved in the current location.
                </p>
              </div>

              {/* Include references */}
              <div className="form-group">
                <label className="form-label">Include Reference Documents</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={includeCharacters}
                      onChange={(e) => setIncludeCharacters(e.target.checked)}
                    />
                    Characters ({book.extracted.characters?.length || 0})
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={includeLocations}
                      onChange={(e) => setIncludeLocations(e.target.checked)}
                    />
                    Locations ({book.extracted.locations?.length || 0})
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={includeTimeline}
                      onChange={(e) => setIncludeTimeline(e.target.checked)}
                    />
                    Timeline ({book.extracted.timeline?.length || 0} events)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={includeSummaries}
                      onChange={(e) => setIncludeSummaries(e.target.checked)}
                    />
                    Chapter Summaries ({book.extracted.summaries?.length || 0})
                  </label>
                </div>
              </div>

              {/* Export info */}
              <div style={{
                marginTop: '20px',
                padding: '12px 16px',
                background: 'var(--bg-input)',
                borderRadius: '8px',
                fontSize: '13px',
              }}>
                <strong>Export will create:</strong>
                <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px', color: 'var(--text-secondary)' }}>
                  <li>{book.chapters.length} chapter(s) with page breaks</li>
                  {includeCharacters && book.extracted.characters?.length > 0 && <li>Characters reference section</li>}
                  {includeLocations && book.extracted.locations?.length > 0 && <li>Locations reference section</li>}
                  {includeTimeline && book.extracted.timeline?.length > 0 && <li>Timeline reference section</li>}
                  {includeSummaries && book.extracted.summaries?.length > 0 && <li>Chapter summaries section</li>}
                </ul>
              </div>
            </>
          )}

          {/* Exporting Step */}
          {step === 'exporting' && (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <LoadingSpinner />
              <p style={{ marginTop: '16px', color: 'var(--text-secondary)' }}>
                {exportProgress}
              </p>
            </div>
          )}

          {/* Success Step */}
          {step === 'success' && exportResult && (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <div style={{ 
                width: '60px', 
                height: '60px', 
                margin: '0 auto 20px',
                background: 'var(--success-bg, rgba(34, 197, 94, 0.1))',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '28px',
              }}>
                ✓
              </div>
              <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>Export Complete!</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
                Your book has been exported to Google Docs.
              </p>
              <a
                href={exportResult.webViewLink}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
              >
                <GoogleIcon />
                Open in Google Docs
              </a>
            </div>
          )}
        </div>

        <div className="dialog-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            {step === 'success' ? 'Close' : 'Cancel'}
          </button>
          
          {step === 'configure' && (
            <button 
              className="btn btn-primary" 
              onClick={handleExport}
              disabled={!fileName.trim() || isLoading}
            >
              Export to Google Docs
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

