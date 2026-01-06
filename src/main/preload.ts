import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // File operations
  newFile: () => ipcRenderer.invoke('file:new'),
  openFile: () => ipcRenderer.invoke('file:open'),
  readFile: (filePath: string) => ipcRenderer.invoke('file:read', filePath),
  saveFile: (data: string, filePath?: string) => 
    ipcRenderer.invoke('file:save', data, filePath),
  saveFileAs: (data: string) => 
    ipcRenderer.invoke('file:save-as', data),
  
  // Export operations
  exportDocx: (data: string) => ipcRenderer.invoke('file:export-docx', data),
  exportPdf: (data: string) => ipcRenderer.invoke('file:export-pdf', data),
  
  // Dialog operations
  openFileDialog: (options: Electron.OpenDialogOptions) => 
    ipcRenderer.invoke('dialog:open-file', options),
  saveFileDialog: (options: Electron.SaveDialogOptions) => 
    ipcRenderer.invoke('dialog:save-file', options),
  
  // Store operations (for settings like API keys)
  storeGet: (key: string) => ipcRenderer.invoke('store:get', key),
  storeSet: (key: string, value: unknown) => 
    ipcRenderer.invoke('store:set', key, value),
  
  // App info
  getVersion: () => ipcRenderer.invoke('app:get-version'),
  
  // Menu event listeners
  onMenuNew: (callback: () => void) => {
    ipcRenderer.on('menu:new', callback);
    return () => ipcRenderer.removeListener('menu:new', callback);
  },
  onMenuOpen: (callback: () => void) => {
    ipcRenderer.on('menu:open', callback);
    return () => ipcRenderer.removeListener('menu:open', callback);
  },
  onMenuSave: (callback: () => void) => {
    ipcRenderer.on('menu:save', callback);
    return () => ipcRenderer.removeListener('menu:save', callback);
  },
  onMenuSaveAs: (callback: () => void) => {
    ipcRenderer.on('menu:save-as', callback);
    return () => ipcRenderer.removeListener('menu:save-as', callback);
  },
  onMenuExportDocx: (callback: () => void) => {
    ipcRenderer.on('menu:export-docx', callback);
    return () => ipcRenderer.removeListener('menu:export-docx', callback);
  },
  onMenuExportPdf: (callback: () => void) => {
    ipcRenderer.on('menu:export-pdf', callback);
    return () => ipcRenderer.removeListener('menu:export-pdf', callback);
  },
  onMenuSettings: (callback: () => void) => {
    ipcRenderer.on('menu:settings', callback);
    return () => ipcRenderer.removeListener('menu:settings', callback);
  },
  onMenuImportGoogleDocs: (callback: () => void) => {
    ipcRenderer.on('menu:import-google-docs', callback);
    return () => ipcRenderer.removeListener('menu:import-google-docs', callback);
  },
  onMenuExportGoogleDocs: (callback: () => void) => {
    ipcRenderer.on('menu:export-google-docs', callback);
    return () => ipcRenderer.removeListener('menu:export-google-docs', callback);
  },
  onMenuSyncGoogleDocs: (callback: () => void) => {
    ipcRenderer.on('menu:sync-google-docs', callback);
    return () => ipcRenderer.removeListener('menu:sync-google-docs', callback);
  },
  
  // Google OAuth callback listener
  onGoogleOAuthCallback: (callback: (code: string) => void) => {
    console.log('[Preload] Registering google-oauth-callback listener');
    const handler = (_event: Electron.IpcRendererEvent, code: string) => {
      console.log('[Preload] Received google-oauth-callback, code length:', code?.length);
      callback(code);
    };
    ipcRenderer.on('google-oauth-callback', handler);
    return () => {
      console.log('[Preload] Removing google-oauth-callback listener');
      ipcRenderer.removeListener('google-oauth-callback', handler);
    };
  },
  
  // Google OAuth: Exchange code for tokens (via main process to avoid CORS)
  googleExchangeToken: (params: { code: string; clientId: string; clientSecret: string }) =>
    ipcRenderer.invoke('google:exchange-token', params),
  
  // Google OAuth: Refresh token (via main process to avoid CORS)
  googleRefreshToken: (params: { refreshToken: string; clientId: string; clientSecret: string }) =>
    ipcRenderer.invoke('google:refresh-token', params),
  
  // Google API: Make authenticated GET request (via main process to avoid CORS)
  googleApiGet: (params: { url: string; accessToken: string }) =>
    ipcRenderer.invoke('google:api-get', params),
  
  // Google API: Make authenticated POST request (via main process to avoid CORS)
  googleApiPost: (params: { url: string; accessToken: string; body: string; contentType?: string }) =>
    ipcRenderer.invoke('google:api-post', params),
  
  // Google API: Make authenticated PATCH request (via main process to avoid CORS)
  googleApiPatch: (params: { url: string; accessToken: string; body: string; contentType?: string }) =>
    ipcRenderer.invoke('google:api-patch', params),
});

// Type definitions for the exposed API
export interface GoogleTokenResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}

export interface ElectronAPI {
  newFile: () => Promise<void>;
  openFile: () => Promise<{ data: string; filePath: string } | null>;
  readFile: (filePath: string) => Promise<string | null>;
  saveFile: (data: string, filePath?: string) => Promise<string | null>;
  saveFileAs: (data: string) => Promise<string | null>;
  exportDocx: (data: string) => Promise<string | null>;
  exportPdf: (data: string) => Promise<string | null>;
  openFileDialog: (options: Electron.OpenDialogOptions) => Promise<Electron.OpenDialogReturnValue>;
  saveFileDialog: (options: Electron.SaveDialogOptions) => Promise<Electron.SaveDialogReturnValue>;
  storeGet: (key: string) => Promise<unknown>;
  storeSet: (key: string, value: unknown) => Promise<void>;
  getVersion: () => Promise<string>;
  onMenuNew: (callback: () => void) => () => void;
  onMenuOpen: (callback: () => void) => () => void;
  onMenuSave: (callback: () => void) => () => void;
  onMenuSaveAs: (callback: () => void) => () => void;
  onMenuExportDocx: (callback: () => void) => () => void;
  onMenuExportPdf: (callback: () => void) => () => void;
  onMenuSettings: (callback: () => void) => () => void;
  onMenuImportGoogleDocs: (callback: () => void) => () => void;
  onMenuExportGoogleDocs: (callback: () => void) => () => void;
  onMenuSyncGoogleDocs: (callback: () => void) => () => void;
  onGoogleOAuthCallback: (callback: (code: string) => void) => () => void;
  googleExchangeToken: (params: { code: string; clientId: string; clientSecret: string }) => Promise<GoogleTokenResponse>;
  googleRefreshToken: (params: { refreshToken: string; clientId: string; clientSecret: string }) => Promise<GoogleTokenResponse>;
  googleApiGet: <T = unknown>(params: { url: string; accessToken: string }) => Promise<T>;
  googleApiPost: <T = unknown>(params: { url: string; accessToken: string; body: string; contentType?: string }) => Promise<T>;
  googleApiPatch: <T = unknown>(params: { url: string; accessToken: string; body: string; contentType?: string }) => Promise<T>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

