/**
 * Google OAuth2 Authentication Service
 * Handles authentication flow for Google Docs/Drive access
 * Uses Desktop app OAuth flow with loopback redirect
 * Token exchange happens in main process to avoid CORS issues
 */

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';

// Scopes needed for Google Docs import and export
const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',      // Create/edit files created by this app
  'https://www.googleapis.com/auth/drive.readonly',  // Read all files
  'https://www.googleapis.com/auth/documents',       // Read/write Google Docs
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

class GoogleAuthService {
  private credentials: GoogleCredentials | null = null;
  private tokens: GoogleTokens | null = null;

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
    this.tokens = null;
  }
}

export const googleAuthService = new GoogleAuthService();

