import React, { useState, useEffect, useCallback } from 'react';
import { googleAuthService, GoogleCredentials } from '../services/googleAuthService';
import { googleDocsService, GoogleDriveFile } from '../services/googleDocsService';
import { useBookStore } from '../stores/bookStore';
import { generateId, Chapter } from '../../shared/types';

interface GoogleDocsImportDialogProps {
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

const DocIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
    <polyline points="10 9 9 9 8 9"/>
  </svg>
);

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8"/>
    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);

const LoadingSpinner = () => (
  <div className="spinner" style={{ width: '20px', height: '20px' }} />
);

type DialogStep = 'credentials' | 'auth' | 'select' | 'confirm' | 'importing';

export const GoogleDocsImportDialog: React.FC<GoogleDocsImportDialogProps> = ({ onClose }) => {
  const { importFromGoogleDocs, book } = useBookStore();
  
  const [step, setStep] = useState<DialogStep>('credentials');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [files, setFiles] = useState<GoogleDriveFile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFile, setSelectedFile] = useState<GoogleDriveFile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>();
  const [importProgress, setImportProgress] = useState('');

  // Check for existing credentials and tokens on mount
  useEffect(() => {
    const loadSavedCredentials = async () => {
      try {
        let creds: GoogleCredentials | null = null;
        
        // Try environment credentials first (via main process)
        if (window.electronAPI?.googleGetCredentials) {
          creds = await window.electronAPI.googleGetCredentials();
        }
        
        // Try Electron store (persists across sessions)
        if (!creds && window.electronAPI?.storeGet) {
          creds = await window.electronAPI.storeGet('google_credentials') as GoogleCredentials | null;
        }
        
        // Fallback to localStorage
        if (!creds) {
          const savedCredentials = localStorage.getItem('google_credentials');
          if (savedCredentials) {
            creds = JSON.parse(savedCredentials);
          }
        }
        
        if (creds?.clientId && creds?.clientSecret) {
          setClientId(creds.clientId);
          setClientSecret(creds.clientSecret);
          googleAuthService.setCredentials(creds);
          
          // Check if we have valid tokens
          if (googleAuthService.loadTokens() && googleAuthService.isAuthenticated()) {
            setStep('select');
            loadFiles();
          } else if (googleAuthService.hasCredentials()) {
            setStep('auth');
          }
        }
      } catch (e) {
        console.error('Failed to load saved credentials:', e);
      }
    };
    
    loadSavedCredentials();
  }, []);

  // Load files from Google Drive
  const loadFiles = useCallback(async (pageToken?: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await googleDocsService.listDocuments(pageToken);
      if (pageToken) {
        setFiles(prev => [...prev, ...result.files]);
      } else {
        setFiles(result.files);
      }
      setNextPageToken(result.nextPageToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load files');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Search files
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      loadFiles();
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const results = await googleDocsService.searchDocuments(searchQuery);
      setFiles(results);
      setNextPageToken(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, loadFiles]);

  // Save credentials and proceed to auth
  const handleSaveCredentials = async () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      setError('Please enter both Client ID and Client Secret');
      return;
    }

    const credentials: GoogleCredentials = {
      clientId: clientId.trim(),
      clientSecret: clientSecret.trim(),
    };

    // Save to Electron store (persists) and localStorage (fallback)
    if (window.electronAPI?.storeSet) {
      await window.electronAPI.storeSet('google_credentials', credentials);
    }
    localStorage.setItem('google_credentials', JSON.stringify(credentials));
    
    googleAuthService.setCredentials(credentials);
    setStep('auth');
    setError(null);
  };

  // Handle OAuth code received
  const handleOAuthCode = useCallback(async (code: string) => {
    try {
      setIsLoading(true);
      await googleAuthService.exchangeCodeForTokens(code);
      googleAuthService.saveTokens();
      setStep('select');
      loadFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  }, [loadFiles]);

  // Listen for OAuth callback from main process (Electron)
  useEffect(() => {
    if (step !== 'auth') return;
    
    const isElectron = typeof window !== 'undefined' && window.electronAPI?.onGoogleOAuthCallback;
    if (!isElectron) return;

    const cleanup = window.electronAPI.onGoogleOAuthCallback((code: string) => {
      handleOAuthCode(code);
    });

    return cleanup;
  }, [step, handleOAuthCode]);

  // Start OAuth flow
  const handleStartAuth = () => {
    const authUrl = googleAuthService.getAuthUrl();
    
    // Open auth window
    const authWindow = window.open(authUrl, 'Google Auth', 'width=500,height=600');
    
    // Listen for the OAuth callback via postMessage (browser fallback)
    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'google-oauth-callback' && event.data?.code) {
        window.removeEventListener('message', handleMessage);
        handleOAuthCode(event.data.code);
      }
    };
    
    window.addEventListener('message', handleMessage);
    
    // Also check periodically if the window was closed
    const checkClosed = setInterval(() => {
      if (authWindow?.closed) {
        clearInterval(checkClosed);
        window.removeEventListener('message', handleMessage);
      }
    }, 500);
  };

  // Handle manual code entry (for Electron where popup may not work)
  const [manualCode, setManualCode] = useState('');
  
  const handleManualCodeSubmit = async () => {
    if (!manualCode.trim()) return;
    
    try {
      setIsLoading(true);
      await googleAuthService.exchangeCodeForTokens(manualCode.trim());
      googleAuthService.saveTokens();
      setStep('select');
      loadFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Import selected file - replaces all existing content
  const handleImport = async () => {
    if (!selectedFile) return;
    
    setStep('importing');
    setImportProgress('Fetching document...');
    setError(null);
    
    try {
      // Import the document, splitting by page breaks
      const importResult = await googleDocsService.importDocument(selectedFile);
      
      setImportProgress(`Converting ${importResult.chapters.length} chapter(s)...`);
      
      // Create Chapter objects from the imported content
      const now = new Date().toISOString();
      const chapters: Chapter[] = importResult.chapters.map((ch, index) => ({
        id: `chapter-${generateId()}`,
        title: ch.title,
        content: ch.content,
        order: index + 1,
        wordCount: 0, // Will be calculated
        comments: [],
        notes: [],
        createdAt: now,
        updatedAt: now,
      }));
      
      setImportProgress('Importing book...');
      
      // Import as a complete book, replacing existing chapters
      importFromGoogleDocs(chapters, {
        documentId: importResult.documentId,
        documentName: importResult.documentName,
      });
      
      // Autosave will automatically save to .sbk file when changes are detected
      console.log('[Import] Imported from Google Docs - autosave will save to .sbk');
      
      // Close dialog on success
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setStep('select');
    }
  };

  // Sign out and reset
  const handleSignOut = () => {
    googleAuthService.signOut();
    googleAuthService.clearStoredTokens();
    setStep('auth');
    setFiles([]);
    setSelectedFile(null);
  };

  // Clear credentials
  const handleClearCredentials = async () => {
    // Clear from Electron store and localStorage
    if (window.electronAPI?.storeSet) {
      await window.electronAPI.storeSet('google_credentials', null);
    }
    localStorage.removeItem('google_credentials');
    
    googleAuthService.signOut();
    googleAuthService.clearStoredTokens();
    setClientId('');
    setClientSecret('');
    setStep('credentials');
    setFiles([]);
    setSelectedFile(null);
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="dialog-overlay" onClick={handleOverlayClick}>
      <div className="dialog" style={{ width: '600px', maxHeight: '80vh' }} onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <GoogleIcon />
            <h2 className="dialog-title">Import from Google Docs</h2>
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

          {/* Step 1: Enter Credentials */}
          {step === 'credentials' && (
            <>
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '15px', marginBottom: '8px' }}>Google Cloud Credentials</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  To import from Google Docs, you need to create a Google Cloud project and enable the Google Docs API.
                </p>
              </div>

              <div style={{ 
                padding: '16px', 
                background: 'var(--bg-input)', 
                borderRadius: '8px',
                marginBottom: '20px',
                fontSize: '12px',
                color: 'var(--text-secondary)'
              }}>
                <strong style={{ color: 'var(--text-primary)' }}>Setup Instructions:</strong>
                <ol style={{ paddingLeft: '20px', marginTop: '8px', lineHeight: 1.8 }}>
                  <li>Go to <a href="https://console.cloud.google.com" target="_blank" rel="noopener" style={{ color: 'var(--accent-primary)' }}>Google Cloud Console</a></li>
                  <li>Create a new project or select an existing one</li>
                  <li>Enable the "Google Docs API" and "Google Drive API"</li>
                  <li>Go to "Credentials" and create an "OAuth 2.0 Client ID"</li>
                  <li>Set application type to <strong>"Desktop app"</strong></li>
                  <li>Copy the Client ID and Client Secret below</li>
                </ol>
                <p style={{ marginTop: '12px', fontSize: '11px', color: 'var(--text-muted)' }}>
                  Note: Desktop apps use loopback redirects which don't need to be registered.
                </p>
              </div>

              <div className="form-group">
                <label className="form-label">Client ID</label>
                <input
                  type="text"
                  className="form-input"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="Enter your Google Cloud Client ID"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Client Secret</label>
                <input
                  type="password"
                  className="form-input"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  placeholder="Enter your Google Cloud Client Secret"
                />
              </div>
            </>
          )}

          {/* Step 2: Authenticate */}
          {step === 'auth' && (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <GoogleIcon />
              <h3 style={{ fontSize: '16px', marginTop: '16px', marginBottom: '8px' }}>
                Connect to Google
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
                Sign in with your Google account to access your documents.
              </p>
              
              <button 
                className="btn btn-primary" 
                onClick={handleStartAuth}
                disabled={isLoading}
                style={{ marginBottom: '20px' }}
              >
                {isLoading ? <LoadingSpinner /> : <GoogleIcon />}
                <span style={{ marginLeft: '8px' }}>Sign in with Google</span>
              </button>

              <div style={{ 
                borderTop: '1px solid var(--border-color)', 
                paddingTop: '20px',
                marginTop: '20px'
              }}>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  If the popup doesn't work, copy the authorization code here:
                </p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    className="form-input"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    placeholder="Paste authorization code"
                    style={{ flex: 1 }}
                  />
                  <button 
                    className="btn btn-secondary" 
                    onClick={handleManualCodeSubmit}
                    disabled={!manualCode.trim() || isLoading}
                  >
                    Submit
                  </button>
                </div>
              </div>

              <button 
                onClick={handleClearCredentials}
                style={{ 
                  marginTop: '24px',
                  fontSize: '12px', 
                  color: 'var(--text-muted)',
                  textDecoration: 'underline',
                  cursor: 'pointer'
                }}
              >
                Change credentials
              </button>
            </div>
          )}

          {/* Step 3: Select File */}
          {step === 'select' && (
            <>
              <div style={{ 
                display: 'flex', 
                gap: '8px', 
                marginBottom: '16px',
                alignItems: 'center'
              }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <SearchIcon />
                  <input
                    type="text"
                    className="form-input"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="Search documents..."
                    style={{ paddingLeft: '32px' }}
                  />
                </div>
                <button className="btn btn-secondary" onClick={handleSearch} disabled={isLoading}>
                  Search
                </button>
                <button 
                  onClick={handleSignOut}
                  className="btn btn-secondary"
                  title="Sign out"
                >
                  Sign Out
                </button>
              </div>

              <div style={{ 
                maxHeight: '350px', 
                overflowY: 'auto',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
              }}>
                {isLoading && files.length === 0 ? (
                  <div style={{ 
                    padding: '40px', 
                    textAlign: 'center',
                    color: 'var(--text-muted)'
                  }}>
                    <LoadingSpinner />
                    <p style={{ marginTop: '12px' }}>Loading documents...</p>
                  </div>
                ) : files.length === 0 ? (
                  <div style={{ 
                    padding: '40px', 
                    textAlign: 'center',
                    color: 'var(--text-muted)'
                  }}>
                    <DocIcon />
                    <p style={{ marginTop: '12px' }}>No documents found</p>
                  </div>
                ) : (
                  <>
                    {files.map((file) => (
                      <div
                        key={file.id}
                        onClick={() => setSelectedFile(file)}
                        style={{
                          padding: '12px 16px',
                          cursor: 'pointer',
                          borderBottom: '1px solid var(--border-color)',
                          background: selectedFile?.id === file.id 
                            ? 'var(--accent-primary-alpha, rgba(99, 102, 241, 0.1))' 
                            : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={(e) => {
                          if (selectedFile?.id !== file.id) {
                            e.currentTarget.style.background = 'var(--bg-hover)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (selectedFile?.id !== file.id) {
                            e.currentTarget.style.background = 'transparent';
                          }
                        }}
                      >
                        <div style={{ color: '#4285F4' }}>
                          <DocIcon />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ 
                            fontWeight: 500, 
                            fontSize: '14px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}>
                            {file.name}
                          </div>
                          <div style={{ 
                            fontSize: '12px', 
                            color: 'var(--text-muted)',
                            marginTop: '2px'
                          }}>
                            Modified {formatDate(file.modifiedTime)}
                          </div>
                        </div>
                        {selectedFile?.id === file.id && (
                          <div style={{ color: 'var(--accent-primary)' }}>✓</div>
                        )}
                      </div>
                    ))}
                    
                    {nextPageToken && (
                      <button
                        onClick={() => loadFiles(nextPageToken)}
                        disabled={isLoading}
                        style={{
                          width: '100%',
                          padding: '12px',
                          background: 'var(--bg-input)',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '13px',
                          color: 'var(--accent-primary)',
                        }}
                      >
                        {isLoading ? 'Loading...' : 'Load more'}
                      </button>
                    )}
                  </>
                )}
              </div>

              {selectedFile && (
                <div style={{ 
                  marginTop: '16px',
                  padding: '12px 16px',
                  background: 'var(--bg-input)',
                  borderRadius: '8px',
                  fontSize: '13px',
                }}>
                  <strong>Selected:</strong> {selectedFile.name}
                </div>
              )}
            </>
          )}

          {/* Step 4: Confirm */}
          {step === 'confirm' && selectedFile && (
            <div style={{ padding: '20px 0' }}>
              <div style={{
                padding: '16px',
                background: 'var(--warning-bg, rgba(245, 158, 11, 0.1))',
                border: '1px solid var(--warning-border, rgba(245, 158, 11, 0.3))',
                borderRadius: '8px',
                marginBottom: '20px',
              }}>
                <h4 style={{ 
                  fontSize: '14px', 
                  fontWeight: 600, 
                  marginBottom: '8px',
                  color: 'var(--warning-text, #f59e0b)'
                }}>
                  ⚠️ This will replace existing content
                </h4>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                  Importing from Google Docs will replace all existing chapters with the content 
                  from the selected document. Page breaks in the document will create new chapters.
                </p>
              </div>

              <div style={{ 
                padding: '16px',
                background: 'var(--bg-input)',
                borderRadius: '8px',
              }}>
                <div style={{ marginBottom: '12px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Document to import:</span>
                  <div style={{ fontWeight: 500, marginTop: '4px' }}>{selectedFile.name}</div>
                </div>
                
                {book.chapters.length > 0 && (
                  <div style={{ 
                    fontSize: '12px', 
                    color: 'var(--text-muted)',
                    padding: '8px 12px',
                    background: 'var(--bg-hover)',
                    borderRadius: '4px',
                  }}>
                    Current book has <strong>{book.chapters.length}</strong> chapter(s) that will be replaced.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 5: Importing */}
          {step === 'importing' && (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <LoadingSpinner />
              <p style={{ marginTop: '16px', color: 'var(--text-secondary)' }}>
                {importProgress}
              </p>
            </div>
          )}
        </div>

        <div className="dialog-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          
          {step === 'credentials' && (
            <button 
              className="btn btn-primary" 
              onClick={handleSaveCredentials}
              disabled={!clientId.trim() || !clientSecret.trim()}
            >
              Continue
            </button>
          )}
          
          {step === 'select' && (
            <button 
              className="btn btn-primary" 
              onClick={() => setStep('confirm')}
              disabled={!selectedFile || isLoading}
            >
              Import Book
            </button>
          )}
          
          {step === 'confirm' && (
            <>
              <button 
                className="btn btn-secondary" 
                onClick={() => setStep('select')}
              >
                Back
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleImport}
                style={{ background: 'var(--accent-warning, #f59e0b)' }}
              >
                Replace & Import
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

