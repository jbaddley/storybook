import React, { useState, useEffect, useCallback } from 'react';
import { useBookStore } from '../stores/bookStore';
import { googleAuthService, GoogleCredentials } from '../services/googleAuthService';
import { googleDocsService } from '../services/googleDocsService';
import { syncService } from '../services/syncService';

interface GoogleDocsSyncDialogProps {
  onClose: () => void;
}

type SyncDirection = 'none' | 'pull' | 'push';

// Google Icon
const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

export const GoogleDocsSyncDialog: React.FC<GoogleDocsSyncDialogProps> = ({ onClose }) => {
  const { book } = useBookStore();
  
  const [isChecking, setIsChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncDirection, setSyncDirection] = useState<SyncDirection>('none');
  const [googleModified, setGoogleModified] = useState<Date | null>(null);
  const [storybookModified, setStorybookModified] = useState<Date | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authTimeout, setAuthTimeout] = useState(false);

  const exportInfo = book.metadata.googleDocsExport;

  // Check for saved credentials
  useEffect(() => {
    const loadCredentials = async () => {
      let creds: GoogleCredentials | null = null;
      
      if (window.electronAPI?.storeGet) {
        creds = await window.electronAPI.storeGet('google_credentials') as GoogleCredentials | null;
      }
      
      if (creds?.clientId && creds?.clientSecret) {
        googleAuthService.setCredentials(creds);
      }
    };
    
    loadCredentials();
  }, []);

  useEffect(() => {
    if (!exportInfo) {
      setError('No previous export found. Please export to Google Docs first using File > Export > Export to Google Docs.');
      setIsChecking(false);
      return;
    }
    checkVersions();
  }, []);

  // Handle OAuth callback
  const handleOAuthCode = useCallback(async (code: string) => {
    console.log('[Sync Dialog] Received OAuth code');
    try {
      setIsAuthenticating(true);
      setError(null);
      await googleAuthService.exchangeCodeForTokens(code);
      googleAuthService.saveTokens();
      setNeedsAuth(false);
      // Re-check versions now that we're authenticated
      checkVersions();
    } catch (err) {
      console.error('[Sync Dialog] Error exchanging code:', err);
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setIsAuthenticating(false);
    }
  }, []);

  // Listen for OAuth callback via IPC
  useEffect(() => {
    if (!needsAuth && !isAuthenticating) return;
    
    const isElectron = typeof window !== 'undefined' && window.electronAPI?.onGoogleOAuthCallback;
    if (!isElectron) {
      console.log('[Sync Dialog] Not in Electron, skipping OAuth listener');
      return;
    }

    console.log('[Sync Dialog] Setting up OAuth callback listener');
    const cleanup = window.electronAPI.onGoogleOAuthCallback((code) => {
      console.log('[Sync Dialog] OAuth callback received via IPC!');
      handleOAuthCode(code);
    });
    
    return () => {
      console.log('[Sync Dialog] Cleaning up OAuth listener');
      cleanup();
    };
  }, [needsAuth, isAuthenticating, handleOAuthCode]);

  // Also listen for postMessage as fallback (from OAuth popup)
  useEffect(() => {
    if (!isAuthenticating) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'google-oauth-callback' && event.data?.code) {
        console.log('[Sync Dialog] OAuth callback received via postMessage!');
        handleOAuthCode(event.data.code);
      }
    };

    console.log('[Sync Dialog] Setting up postMessage listener');
    window.addEventListener('message', handleMessage);
    
    return () => {
      console.log('[Sync Dialog] Cleaning up postMessage listener');
      window.removeEventListener('message', handleMessage);
    };
  }, [isAuthenticating, handleOAuthCode]);

  const handleStartAuth = () => {
    if (!googleAuthService.hasCredentials()) {
      setError('No Google credentials configured. Please use Export to Google Docs first to set up credentials.');
      return;
    }
    
    setIsAuthenticating(true);
    setAuthTimeout(false);
    setError(null);
    
    const authUrl = googleAuthService.getAuthUrl();
    console.log('[Sync Dialog] Opening auth URL:', authUrl.substring(0, 100) + '...');
    const popup = window.open(authUrl, 'Google Auth', 'width=500,height=600');
    
    if (!popup) {
      setError('Popup was blocked. Please allow popups for this app.');
      setIsAuthenticating(false);
      return;
    }
    
    // Set a timeout to show retry option if auth takes too long
    setTimeout(() => {
      setAuthTimeout(true);
    }, 15000); // 15 seconds
  };
  
  const handleRetryAuth = () => {
    setIsAuthenticating(false);
    setAuthTimeout(false);
    setError(null);
  };

  const checkVersions = async () => {
    setIsChecking(true);
    setError(null);
    setNeedsAuth(false);

    try {
      // Check if we're authenticated
      if (!googleAuthService.isAuthenticated()) {
        // Try to restore tokens
        googleAuthService.loadTokens();
        if (!googleAuthService.isAuthenticated()) {
          setNeedsAuth(true);
          setIsChecking(false);
          return;
        }
      }

      if (!exportInfo?.documentId) {
        setError('No previous export found. Please export to Google Docs first.');
        setIsChecking(false);
        return;
      }

      // Get Google Doc metadata
      const googleFile = await googleDocsService.getFileMetadata(exportInfo.documentId);
      
      if (!googleFile) {
        setError('Could not find the Google Doc. It may have been deleted.');
        setIsChecking(false);
        return;
      }

      const googleDate = new Date(googleFile.modifiedTime);
      const storybookDate = new Date(book.updatedAt);

      setGoogleModified(googleDate);
      setStorybookModified(storybookDate);

      // Determine sync direction
      // Add a small buffer (5 seconds) for minor time differences
      const buffer = 5000;
      if (googleDate.getTime() > storybookDate.getTime() + buffer) {
        setSyncDirection('pull');
      } else if (storybookDate.getTime() > googleDate.getTime() + buffer) {
        setSyncDirection('push');
      } else {
        setSyncDirection('none');
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check versions');
    } finally {
      setIsChecking(false);
    }
  };

  const handlePull = () => {
    if (!exportInfo?.documentId) return;

    // Start background sync and close dialog
    syncService.pull(exportInfo.documentId, exportInfo.documentName);
    onClose();
  };

  const handlePush = () => {
    if (!exportInfo?.documentId) return;

    // Prepare chapters
    const chapters = book.chapters.map(chapter => ({
      title: chapter.title,
      content: chapter.content,
    }));

    // Prepare references (as strings)
    const charactersTab = book.documentTabs.find(t => t.tabType === 'characters');
    const locationsTab = book.documentTabs.find(t => t.tabType === 'locations');
    const timelineTab = book.documentTabs.find(t => t.tabType === 'timeline');
    const summariesTab = book.documentTabs.find(t => t.tabType === 'summaries');

    const references: { characters?: string; locations?: string; timeline?: string; summaries?: string } = {};
    if (charactersTab?.content && typeof charactersTab.content === 'string') {
      references.characters = charactersTab.content;
    }
    if (locationsTab?.content && typeof locationsTab.content === 'string') {
      references.locations = locationsTab.content;
    }
    if (timelineTab?.content && typeof timelineTab.content === 'string') {
      references.timeline = timelineTab.content;
    }
    if (summariesTab?.content && typeof summariesTab.content === 'string') {
      references.summaries = summariesTab.content;
    }

    const fontSettings = {
      titleFont: book.settings.titleFont,
      titleFontSize: book.settings.titleFontSize,
      bodyFont: book.settings.bodyFont,
      bodyFontSize: book.settings.bodyFontSize,
    };

    // Start background sync and close dialog
    syncService.push(
      exportInfo.documentId,
      exportInfo.documentName,
      book.title,
      chapters,
      references,
      fontSettings,
      exportInfo.folderId
    );
    onClose();
  };

  const formatDate = (date: Date | null) => {
    if (!date) return 'Unknown';
    return date.toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog google-docs-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h2>
            <svg viewBox="0 0 24 24" width="24" height="24" style={{ marginRight: '8px' }}>
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sync with Google Docs
          </h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="dialog-content">
          {isChecking ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <div className="loading-spinner" style={{ margin: '0 auto 16px' }}></div>
              <p style={{ color: 'var(--text-secondary)' }}>Checking versions...</p>
            </div>
          ) : needsAuth ? (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>🔐</div>
                <h3 style={{ marginBottom: '8px', color: 'var(--text-primary)' }}>Sign in Required</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                  Please sign in with Google to sync your book.
                </p>
              </div>
              
              {error && (
                <div className="error-message" style={{ marginBottom: '16px' }}>
                  {error}
                </div>
              )}
              
              {isAuthenticating ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className="loading-spinner" style={{ width: '24px', height: '24px' }}></div>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      Waiting for Google sign in...
                    </span>
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                    Complete sign in in the popup window
                  </p>
                  {authTimeout && (
                    <div style={{ marginTop: '8px' }}>
                      <p style={{ fontSize: '13px', color: 'var(--warning)', marginBottom: '12px' }}>
                        Taking longer than expected?
                      </p>
                      <button
                        className="secondary-btn"
                        onClick={handleRetryAuth}
                        style={{ marginRight: '8px' }}
                      >
                        Try Again
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  className="primary-btn"
                  onClick={handleStartAuth}
                  style={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: '8px',
                    padding: '12px 24px',
                  }}
                >
                  <GoogleIcon />
                  Sign in with Google
                </button>
              )}
            </div>
          ) : error ? (
            <div className="error-message" style={{ marginBottom: '16px' }}>
              {error}
            </div>
          ) : (
            <>
              {/* Version comparison */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr', 
                gap: '20px',
                marginBottom: '24px'
              }}>
                {/* Storybook version */}
                <div style={{
                  padding: '16px',
                  background: syncDirection === 'push' ? 'rgba(166, 227, 161, 0.1)' : 'var(--bg-input)',
                  borderRadius: '8px',
                  border: syncDirection === 'push' ? '2px solid var(--success)' : '1px solid var(--border-subtle)',
                }}>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px',
                    marginBottom: '12px'
                  }}>
                    <span style={{ fontSize: '20px' }}>📖</span>
                    <strong>Storybook</strong>
                    {syncDirection === 'push' && (
                      <span style={{ 
                        marginLeft: 'auto',
                        color: 'var(--success)',
                        fontSize: '12px',
                        fontWeight: 'bold'
                      }}>NEWER</span>
                    )}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    <div>Last modified:</div>
                    <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                      {formatDate(storybookModified)}
                    </div>
                  </div>
                </div>

                {/* Google Docs version */}
                <div style={{
                  padding: '16px',
                  background: syncDirection === 'pull' ? 'rgba(166, 227, 161, 0.1)' : 'var(--bg-input)',
                  borderRadius: '8px',
                  border: syncDirection === 'pull' ? '2px solid var(--success)' : '1px solid var(--border-subtle)',
                }}>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px',
                    marginBottom: '12px'
                  }}>
                    <svg viewBox="0 0 24 24" width="20" height="20">
                      <path fill="#4285F4" d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6z"/>
                      <path fill="#A1C2FA" d="M14 2v6h6"/>
                      <path fill="#FFF" d="M7 14h10v2H7zm0 4h7v2H7zm0-8h10v2H7z"/>
                    </svg>
                    <strong>Google Docs</strong>
                    {syncDirection === 'pull' && (
                      <span style={{ 
                        marginLeft: 'auto',
                        color: 'var(--success)',
                        fontSize: '12px',
                        fontWeight: 'bold'
                      }}>NEWER</span>
                    )}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    <div>Last modified:</div>
                    <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                      {formatDate(googleModified)}
                    </div>
                  </div>
                  <div style={{ 
                    marginTop: '8px', 
                    fontSize: '12px', 
                    color: 'var(--text-muted)',
                    wordBreak: 'break-all'
                  }}>
                    {exportInfo?.documentName}
                  </div>
                </div>
              </div>

              {/* Sync direction info */}
              <div style={{
                padding: '16px',
                background: 'var(--bg-input)',
                borderRadius: '8px',
                marginBottom: '24px',
                textAlign: 'center'
              }}>
                {syncDirection === 'pull' && (
                  <>
                    <div style={{ fontSize: '24px', marginBottom: '8px' }}>⬇️</div>
                    <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                      Google Docs is newer
                    </div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                      Pull changes from Google Docs to update Storybook
                    </div>
                  </>
                )}
                {syncDirection === 'push' && (
                  <>
                    <div style={{ fontSize: '24px', marginBottom: '8px' }}>⬆️</div>
                    <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                      Storybook is newer
                    </div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                      Push changes from Storybook to update Google Docs
                    </div>
                  </>
                )}
                {syncDirection === 'none' && (
                  <>
                    <div style={{ fontSize: '24px', marginBottom: '8px' }}>✓</div>
                    <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                      Already in sync
                    </div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                      Both versions have the same modification time
                    </div>
                  </>
                )}
              </div>

              {/* Info about background sync */}
              <div style={{
                padding: '12px 16px',
                background: 'rgba(137, 180, 250, 0.1)',
                borderRadius: '8px',
                marginBottom: '16px',
                fontSize: '13px',
                color: 'var(--text-secondary)',
                textAlign: 'center'
              }}>
                💡 Sync will run in the background. You can continue editing.
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                {syncDirection === 'pull' && (
                  <button
                    className="primary-btn"
                    onClick={handlePull}
                    style={{ minWidth: '200px' }}
                  >
                    ⬇️ Pull from Google Docs
                  </button>
                )}
                {syncDirection === 'push' && (
                  <button
                    className="primary-btn"
                    onClick={handlePush}
                    style={{ minWidth: '200px' }}
                  >
                    ⬆️ Push to Google Docs
                  </button>
                )}
                {syncDirection === 'none' && (
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                      className="secondary-btn"
                      onClick={handlePull}
                    >
                      ⬇️ Pull Anyway
                    </button>
                    <button
                      className="secondary-btn"
                      onClick={handlePush}
                    >
                      ⬆️ Push Anyway
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="dialog-footer">
          <button className="secondary-btn" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

