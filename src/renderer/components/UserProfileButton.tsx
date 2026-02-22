import React, { useState, useEffect, useRef, useCallback } from 'react';
import { googleAuthService, GoogleCredentials, GoogleUserInfo } from '../services/googleAuthService';

interface UserProfileButtonProps {
  onAuthStateChange?: (isAuthenticated: boolean) => void;
}

export const UserProfileButton: React.FC<UserProfileButtonProps> = ({ onAuthStateChange }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userInfo, setUserInfo] = useState<GoogleUserInfo | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [showCredentialsDialog, setShowCredentialsDialog] = useState(false);
  const [credentials, setCredentials] = useState<GoogleCredentials>({ clientId: '', clientSecret: '' });
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync state from auth service and ensure DB user is linked for Sync to DB
  const syncAuthState = useCallback(async () => {
    const authenticated = googleAuthService.isAuthenticated();
    const info = googleAuthService.getUserInfo();
    console.log('[UserProfileButton] Syncing auth state:', { authenticated, hasUserInfo: !!info, info });
    
    if (authenticated && info) {
      setIsAuthenticated(true);
      setUserInfo(info);
      onAuthStateChange?.(true);
      // Link Google account to database user so Sync to DB works
      await googleAuthService.ensureDbUserId();
      return true;
    }
    
    // Also check localStorage directly as fallback – restore into service so Sync to DB works
    const storedUserInfo = localStorage.getItem('google_user_info');
    const storedTokens = localStorage.getItem('google_tokens');
    if (storedUserInfo && storedTokens) {
      try {
        const parsedInfo = JSON.parse(storedUserInfo);
        const parsedTokens = JSON.parse(storedTokens);
        console.log('[UserProfileButton] Found stored auth data:', { 
          hasUserInfo: !!parsedInfo, 
          hasTokens: !!parsedTokens,
          tokenExpired: parsedTokens?.expiresAt < Date.now()
        });
        
        // Check if token is still valid
        if (parsedTokens.expiresAt > Date.now() && parsedInfo) {
          // Restore into auth service so isAuthenticated() and ensureDbUserId() work
          googleAuthService.loadTokens();
          googleAuthService.loadUserInfo();
          setIsAuthenticated(true);
          setUserInfo(parsedInfo);
          onAuthStateChange?.(true);
          // Link Google account to database user so Sync to DB works
          await googleAuthService.ensureDbUserId();
          return true;
        }
      } catch (e) {
        console.error('[UserProfileButton] Failed to parse stored auth data:', e);
      }
    }
    return false;
  }, [onAuthStateChange]);

  // Check auth state on mount and restore session
  useEffect(() => {
    const checkAuth = async () => {
      console.log('[UserProfileButton] Checking auth state on mount...');
      
      // First, try to sync from localStorage directly (fastest)
      if (await syncAuthState()) {
        console.log('[UserProfileButton] Already authenticated from localStorage');
        return;
      }
      
      // Try to load credentials from environment first (via main process)
      try {
        const envCreds = await window.electronAPI?.googleGetCredentials?.();
        if (envCreds) {
          googleAuthService.setCredentials(envCreds);
          setCredentials(envCreds);
        } else {
          // Fall back to stored credentials
          const storedCreds = localStorage.getItem('google_credentials');
          if (storedCreds) {
            try {
              const creds = JSON.parse(storedCreds);
              googleAuthService.setCredentials(creds);
              setCredentials(creds);
            } catch (e) {
              console.error('Failed to load credentials:', e);
            }
          }
        }
      } catch (e) {
        // Fall back to stored credentials if IPC fails
        const storedCreds = localStorage.getItem('google_credentials');
        if (storedCreds) {
          try {
            const creds = JSON.parse(storedCreds);
            googleAuthService.setCredentials(creds);
            setCredentials(creds);
          } catch (err) {
            console.error('Failed to load credentials:', err);
          }
        }
      }

      // Try to restore session via auth service
      const restored = await googleAuthService.restoreSession();
      console.log('[UserProfileButton] Session restore result:', restored);
      if (restored) {
        syncAuthState();
      }
    };

    checkAuth();
    
    // Also check periodically in case OAuth completed in background
    const interval = setInterval(async () => {
      if (!isAuthenticated) {
        const nowAuthenticated = await syncAuthState();
        if (nowAuthenticated) {
          console.log('[UserProfileButton] Detected auth state change via polling');
        }
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [syncAuthState, isAuthenticated]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Define OAuth callback handler before the useEffect that uses it
  const handleOAuthCallback = useCallback(async (code: string) => {
    console.log('[UserProfileButton] OAuth callback received, code length:', code?.length);
    try {
      await googleAuthService.exchangeCodeForTokens(code);
      console.log('[UserProfileButton] Token exchange complete');
      
      const success = await googleAuthService.completeSignIn();
      console.log('[UserProfileButton] Sign-in complete:', success);
      
      if (success) {
        const info = googleAuthService.getUserInfo();
        console.log('[UserProfileButton] User info:', info);
        setIsAuthenticated(true);
        setUserInfo(info);
        onAuthStateChange?.(true);
      }
    } catch (error) {
      console.error('[UserProfileButton] OAuth callback error:', error);
    } finally {
      setIsSigningIn(false);
    }
  }, [onAuthStateChange]);

  // Set up OAuth callback listener - always active
  useEffect(() => {
    const isElectron = typeof window !== 'undefined' && window.electronAPI?.onGoogleOAuthCallback;
    
    console.log('[UserProfileButton] Setting up OAuth callback listener, isElectron:', isElectron);
    
    if (isElectron) {
      const cleanup = window.electronAPI.onGoogleOAuthCallback(async (code: string) => {
        console.log('[UserProfileButton] Received OAuth callback from Electron');
        await handleOAuthCallback(code);
      });
      return cleanup;
    } else {
      // Web fallback - listen for postMessage
      const handleMessage = async (event: MessageEvent) => {
        if (event.data?.type === 'google-oauth-callback' && event.data?.code) {
          console.log('[UserProfileButton] Received OAuth callback via postMessage');
          await handleOAuthCallback(event.data.code);
        }
      };
      window.addEventListener('message', handleMessage);
      return () => window.removeEventListener('message', handleMessage);
    }
  }, [handleOAuthCallback]);

  const handleSignIn = () => {
    if (!googleAuthService.hasCredentials()) {
      setShowCredentialsDialog(true);
      return;
    }

    startOAuthFlow();
  };

  const startOAuthFlow = () => {
    setIsSigningIn(true);
    
    // Clear any existing tokens first
    googleAuthService.signOut();
    googleAuthService.clearStoredTokens();

    const authUrl = googleAuthService.getAuthUrl();
    window.open(authUrl, 'Google Auth', 'width=500,height=600');
  };

  const handleSignOut = () => {
    googleAuthService.fullSignOut();
    setIsAuthenticated(false);
    setUserInfo(null);
    setShowDropdown(false);
    onAuthStateChange?.(false);
  };

  const handleSaveCredentials = () => {
    if (!credentials.clientId || !credentials.clientSecret) {
      return;
    }

    googleAuthService.setCredentials(credentials);
    localStorage.setItem('google_credentials', JSON.stringify(credentials));
    setShowCredentialsDialog(false);
    startOAuthFlow();
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <>
      <div className="user-profile-container" ref={dropdownRef}>
        {isAuthenticated && userInfo ? (
          <button
            className="user-profile-btn authenticated"
            onClick={() => setShowDropdown(!showDropdown)}
            title={`Signed in as ${userInfo.name}`}
          >
            <div className="user-avatar-wrapper">
              {userInfo.picture ? (
                <img src={userInfo.picture} alt={userInfo.name} className="user-avatar" />
              ) : (
                <div className="user-avatar-placeholder">
                  {getInitials(userInfo.name)}
                </div>
              )}
              <span className="user-online-indicator" />
            </div>
            <span className="user-name-label">{userInfo.name.split(' ')[0]}</span>
          </button>
        ) : (
          <button
            className="user-profile-btn sign-in"
            onClick={handleSignIn}
            disabled={isSigningIn}
            title="Sign in with Google"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <span className="sign-in-text">Sign In</span>
          </button>
        )}

        {showDropdown && isAuthenticated && userInfo && (
          <div className="user-dropdown">
            <div className="user-dropdown-header">
              {userInfo.picture ? (
                <img src={userInfo.picture} alt={userInfo.name} className="dropdown-avatar" />
              ) : (
                <div className="dropdown-avatar-placeholder">
                  {getInitials(userInfo.name)}
                </div>
              )}
              <div className="user-dropdown-info">
                <div className="user-dropdown-name">{userInfo.name}</div>
                <div className="user-dropdown-email">{userInfo.email}</div>
              </div>
            </div>
            <div className="user-dropdown-divider" />
            <button className="user-dropdown-item" onClick={handleSignOut}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Sign Out
            </button>
          </div>
        )}
      </div>

      {/* Credentials Dialog */}
      {showCredentialsDialog && (
        <div className="modal-overlay" onClick={() => setShowCredentialsDialog(false)}>
          <div className="credentials-dialog" onClick={e => e.stopPropagation()}>
            <h3>Google OAuth Credentials</h3>
            <p className="credentials-help">
              Enter your Google Cloud OAuth credentials to sign in.
              You can create these in the <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer">Google Cloud Console</a>.
            </p>
            
            <div className="credentials-form">
              <label>
                Client ID
                <input
                  type="text"
                  value={credentials.clientId}
                  onChange={e => setCredentials({ ...credentials, clientId: e.target.value })}
                  placeholder="your-client-id.apps.googleusercontent.com"
                />
              </label>
              
              <label>
                Client Secret
                <input
                  type="password"
                  value={credentials.clientSecret}
                  onChange={e => setCredentials({ ...credentials, clientSecret: e.target.value })}
                  placeholder="Your client secret"
                />
              </label>
            </div>

            <div className="credentials-actions">
              <button className="btn-secondary" onClick={() => setShowCredentialsDialog(false)}>
                Cancel
              </button>
              <button 
                className="btn-primary"
                onClick={handleSaveCredentials}
                disabled={!credentials.clientId || !credentials.clientSecret}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
