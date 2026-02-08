/**
 * Google OAuth2 Authentication Service
 * Handles authentication flow for Google Docs/Drive access
 * Uses Desktop app OAuth flow with loopback redirect
 * Token exchange happens in main process to avoid CORS issues
 */

import { databaseService, DbUser } from './databaseService';
import { dbSyncService } from './dbSyncService';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

// Scopes needed for Google Docs import and export + user info
const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',      // Create/edit files created by this app
  'https://www.googleapis.com/auth/drive.readonly',  // Read all files
  'https://www.googleapis.com/auth/documents',       // Read/write Google Docs
  'https://www.googleapis.com/auth/userinfo.email',  // Get user email
  'https://www.googleapis.com/auth/userinfo.profile', // Get user profile
].join(' ');

// For Desktop OAuth, use 127.0.0.1 (loopback IP) - no need to register in Google Console
const OAUTH_PORT = 4000;
const REDIRECT_URI = `http://127.0.0.1:${OAUTH_PORT}/oauth2callback`;

export interface GoogleCredentials {
  clientId: string;
  clientSecret: string;
}

export interface GoogleTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

export interface GoogleUserInfo {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

class GoogleAuthService {
  private credentials: GoogleCredentials | null = null;
  private tokens: GoogleTokens | null = null;
  private userInfo: GoogleUserInfo | null = null;
  private dbUser: DbUser | null = null;

  /**
   * Set the Google Cloud credentials
   */
  setCredentials(credentials: GoogleCredentials) {
    this.credentials = credentials;
  }

  /**
   * Get the current credentials
   */
  getCredentials(): GoogleCredentials | null {
    return this.credentials;
  }

  /**
   * Check if credentials are configured
   */
  hasCredentials(): boolean {
    return this.credentials !== null && 
           !!this.credentials.clientId && 
           !!this.credentials.clientSecret;
  }

  /**
   * Check if we have valid tokens
   */
  isAuthenticated(): boolean {
    if (!this.tokens) return false;
    return Date.now() < this.tokens.expiresAt;
  }

  /**
   * Get current access token
   */
  getAccessToken(): string | null {
    if (!this.isAuthenticated()) return null;
    return this.tokens?.accessToken || null;
  }

  /**
   * Get the OAuth2 authorization URL
   * Uses loopback redirect for Desktop OAuth flow
   */
  getAuthUrl(): string {
    if (!this.credentials) {
      throw new Error('Google credentials not configured');
    }

    const params = new URLSearchParams({
      client_id: this.credentials.clientId,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: SCOPES,
      access_type: 'offline',
      prompt: 'consent',
    });

    return `${GOOGLE_AUTH_URL}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   * Uses IPC to main process to avoid CORS issues
   */
  async exchangeCodeForTokens(code: string): Promise<GoogleTokens> {
    if (!this.credentials) {
      throw new Error('Google credentials not configured');
    }

    if (!window.electronAPI?.googleExchangeToken) {
      throw new Error('Electron API not available');
    }

    const result = await window.electronAPI.googleExchangeToken({
      code,
      clientId: this.credentials.clientId,
      clientSecret: this.credentials.clientSecret,
    });
    
    this.tokens = {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresAt: Date.now() + (result.expiresIn * 1000),
    };

    return this.tokens;
  }

  /**
   * Refresh the access token
   * Uses IPC to main process to avoid CORS issues
   */
  async refreshAccessToken(): Promise<GoogleTokens> {
    if (!this.credentials || !this.tokens?.refreshToken) {
      throw new Error('Cannot refresh: no credentials or refresh token');
    }

    if (!window.electronAPI?.googleRefreshToken) {
      throw new Error('Electron API not available');
    }

    const result = await window.electronAPI.googleRefreshToken({
      refreshToken: this.tokens.refreshToken,
      clientId: this.credentials.clientId,
      clientSecret: this.credentials.clientSecret,
    });
    
    this.tokens = {
      accessToken: result.accessToken,
      refreshToken: this.tokens.refreshToken, // Keep existing refresh token
      expiresAt: Date.now() + (result.expiresIn * 1000),
    };

    return this.tokens;
  }

  /**
   * Clear tokens (sign out)
   */
  signOut() {
    this.tokens = null;
  }

  /**
   * Save tokens to storage
   */
  saveTokens(): void {
    if (this.tokens) {
      localStorage.setItem('google_tokens', JSON.stringify(this.tokens));
    }
  }

  /**
   * Load tokens from storage
   */
  loadTokens(): boolean {
    const stored = localStorage.getItem('google_tokens');
    if (stored) {
      try {
        this.tokens = JSON.parse(stored);
        return true;
      } catch (e) {
        console.error('Failed to load Google tokens:', e);
      }
    }
    return false;
  }

  /**
   * Clear stored tokens
   */
  clearStoredTokens(): void {
    localStorage.removeItem('google_tokens');
    localStorage.removeItem('google_user_info');
    this.tokens = null;
    this.userInfo = null;
    this.dbUser = null;
  }

  /**
   * Fetch user info from Google
   * Uses IPC to main process to avoid CSP issues
   */
  async fetchUserInfo(): Promise<GoogleUserInfo | null> {
    if (!this.tokens?.accessToken) {
      return null;
    }

    try {
      // Use IPC to main process to avoid CSP blocking the request
      if (!window.electronAPI?.googleApiGet) {
        console.error('Electron API not available for user info fetch');
        return null;
      }

      interface GoogleUserInfo {
        id: string;
        email: string;
        name?: string;
        picture?: string;
      }

      const data = await window.electronAPI.googleApiGet<GoogleUserInfo>({
        url: GOOGLE_USERINFO_URL,
        accessToken: this.tokens.accessToken,
      });

      this.userInfo = {
        id: data.id,
        email: data.email,
        name: data.name || data.email,
        picture: data.picture,
      };

      // Save to localStorage
      localStorage.setItem('google_user_info', JSON.stringify(this.userInfo));

      return this.userInfo;
    } catch (error) {
      console.error('Error fetching Google user info:', error);
      return null;
    }
  }

  /**
   * Get current user info
   */
  getUserInfo(): GoogleUserInfo | null {
    return this.userInfo;
  }

  /**
   * Load user info from storage
   */
  loadUserInfo(): boolean {
    const stored = localStorage.getItem('google_user_info');
    if (stored) {
      try {
        this.userInfo = JSON.parse(stored);
        return true;
      } catch (e) {
        console.error('Failed to load Google user info:', e);
      }
    }
    return false;
  }

  /**
   * Get the current database user
   */
  getDbUser(): DbUser | null {
    return this.dbUser;
  }

  /**
   * Get the current database user ID
   */
  getCurrentUserId(): string | null {
    return this.dbUser?.id || null;
  }

  /**
   * Register or update user in database after OAuth
   * Should be called after successful token exchange
   */
  async registerUserInDatabase(): Promise<DbUser | null> {
    if (!this.userInfo) {
      // Try to fetch user info first
      await this.fetchUserInfo();
    }

    if (!this.userInfo) {
      console.error('Cannot register user: no user info available');
      return null;
    }

    try {
      const user = await databaseService.findOrCreateUserByGoogle(
        this.userInfo.id,        // googleId
        this.userInfo.email,     // email
        this.userInfo.name,      // name
        this.userInfo.picture    // picture (optional)
      );

      if (user) {
        this.dbUser = user;
        // Update sync service with user ID
        dbSyncService.setCurrentUserId(user.id);
        console.log('[GoogleAuth] User registered in database:', user.id);
      }

      return user;
    } catch (error) {
      console.error('Failed to register user in database:', error);
      return null;
    }
  }

  /**
   * Complete sign-in flow
   * Fetches user info and registers in database
   */
  async completeSignIn(): Promise<boolean> {
    try {
      // Fetch user info from Google
      const userInfo = await this.fetchUserInfo();
      if (!userInfo) {
        return false;
      }

      // Register in database
      const dbUser = await this.registerUserInDatabase();
      if (!dbUser) {
        console.warn('[GoogleAuth] Could not register user in database (database may be unavailable)');
        // Still return true - user can work offline
      }

      // Save tokens
      this.saveTokens();

      return true;
    } catch (error) {
      console.error('Error completing sign in:', error);
      return false;
    }
  }

  /**
   * Restore session on app startup
   * Loads tokens and user info, verifies with database
   */
  async restoreSession(): Promise<boolean> {
    // Load tokens
    const hasTokens = this.loadTokens();
    if (!hasTokens) {
      return false;
    }

    // Load user info
    this.loadUserInfo();

    // Check if tokens are still valid
    if (!this.isAuthenticated()) {
      // Try to refresh
      try {
        await this.refreshAccessToken();
      } catch (error) {
        console.error('Failed to refresh token on session restore:', error);
        this.clearStoredTokens();
        return false;
      }
    }

    // Re-fetch user info to ensure it's current
    if (!this.userInfo) {
      await this.fetchUserInfo();
    }

    // Try to connect to database and get or create user
    if (this.userInfo) {
      try {
        // findOrCreateUserByGoogle will either find existing or create new user
        const user = await databaseService.findOrCreateUserByGoogle(
          this.userInfo.id,
          this.userInfo.email,
          this.userInfo.name,
          this.userInfo.picture
        );
        if (user) {
          this.dbUser = user;
          dbSyncService.setCurrentUserId(user.id);
        }
      } catch (error) {
        console.warn('[GoogleAuth] Database not available during session restore');
        // Continue without database - user can work offline
      }
    }

    return true;
  }

  /**
   * Full sign out - clears everything
   */
  fullSignOut(): void {
    this.tokens = null;
    this.userInfo = null;
    this.dbUser = null;
    this.clearStoredTokens();
    dbSyncService.clearState();
  }
}

export const googleAuthService = new GoogleAuthService();

