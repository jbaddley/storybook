/**
 * Type definitions for Electron IPC API
 * Shared between main and renderer processes
 */

export interface GoogleTokenResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}

export interface BackupInfo {
  path: string;
  number: number;
  modified: Date;
  size: number;
}

// Database types
export interface DbUser {
  id: string;
  googleId: string;
  email: string;
  name: string | null;
  picture?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DbBookSummary {
  id: string;
  title: string;
  author: string;
  updatedAt: Date;
  createdAt: Date;
}

export interface ChapterConflict {
  chapterId: string;
  chapterTitle: string;
  type: 'deleted_locally' | 'deleted_in_db' | 'both_modified';
  localTimestamp?: Date;
  dbTimestamp?: Date;
}

export interface PdfExportOptions {
  margins?: { top: number; right: number; bottom: number; left: number };
  pageWidthIn: number;
  pageHeightIn: number;
  bodyFontSize?: number;
  bodyFont?: string;
  titleFontSize?: number;
  titleFont?: string;
}

export interface ElectronAPI {
  // File operations
  newFile: () => Promise<void>;
  openFile: () => Promise<{ data: string; filePath: string } | null>;
  readFile: (filePath: string) => Promise<string | null>;
  saveFile: (data: string, filePath?: string) => Promise<string | null>;
  saveFileAs: (data: string) => Promise<string | null>;
  listBackups: (filePath: string) => Promise<BackupInfo[]>;
  restoreBackup: (backupPath: string, originalPath: string) => Promise<string>;
  
  // Export operations
  exportDocx: (data: string, defaultFileName?: string) => Promise<string | null>;
  exportPdf: (html: string, bookTitle: string, options?: PdfExportOptions) => Promise<string | null>;
  exportPdfViaDocx: (docxBase64: string, bookTitle: string) => Promise<string | null>;
  libreofficeAvailable: () => Promise<boolean>;
  exportPdfPreview: (html: string, bookTitle: string, options?: PdfExportOptions) => Promise<string | null>;
  exportPdfFile: (pdfBase64: string) => Promise<string | null>; // Save already-generated PDF
  exportMp3: (data: string, defaultName?: string) => Promise<string | null>;
  pickDirAndCreateSubfolder: (suggestedFolderName: string) => Promise<string | null>;
  writeMp3ToPath: (data: string, folderPath: string, fileName: string) => Promise<string | null>;
  getAudioPlaybackUrl: (filePath: string) => Promise<string>;

  // Dialog operations
  openFileDialog: (options: any) => Promise<any>;
  saveFileDialog: (options: any) => Promise<any>;
  
  // Clipboard (image from system clipboard when renderer paste has no image)
  clipboardHasImage: () => Promise<boolean>;
  clipboardReadImage: () => Promise<string | null>;

  // Store operations
  storeGet: (key: string) => Promise<unknown>;
  storeSet: (key: string, value: unknown) => Promise<void>;
  
  // App info
  getVersion: () => Promise<string>;

  // Spell checker (Electron built-in; only available in Electron)
  replaceMisspelling?: (suggestion: string) => Promise<void>;
  addWordToSpellCheckerDictionary?: (word: string) => Promise<void>;
  sendEditorContextMenuBuild?: (data: { sentence: string; x: number; y: number; misspelledWord?: string; dictionarySuggestions?: string[] }) => void;
  onEditorContextMenuShow?: (callback: (data: { x: number; y: number; misspelledWord: string; dictionarySuggestions: string[] }) => void) => () => void;
  onEditorContextMenuAddToChat?: (callback: (sentence: string) => void) => () => void;

  // Menu event listeners
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
  onMenuExportAllAudio: (callback: () => void) => () => void;
  onMenuFormatDocument: (callback: () => void) => () => void;
  
  // Google OAuth
  onGoogleOAuthCallback: (callback: (code: string) => void) => () => void;
  googleGetCredentials: () => Promise<{ clientId: string; clientSecret: string } | null>;
  googleExchangeToken: (params: { code: string; clientId: string; clientSecret: string }) => Promise<GoogleTokenResponse>;
  googleRefreshToken: (params: { refreshToken: string; clientId: string; clientSecret: string }) => Promise<GoogleTokenResponse>;
  
  // Google API
  googleApiGet: <T = unknown>(params: { url: string; accessToken: string }) => Promise<T>;
  googleApiPost: <T = unknown>(params: { url: string; accessToken: string; body: string; contentType?: string }) => Promise<T>;
  googleApiPatch: <T = unknown>(params: { url: string; accessToken: string; body: string; contentType?: string }) => Promise<T>;
  googleApiUploadFile: (params: { 
    accessToken: string; 
    fileName: string; 
    base64Data: string; 
    mimeType: string;
    folderId?: string;
    fileId?: string;
  }) => Promise<{ id: string; webViewLink?: string }>;
  googleApiDownloadFile: (params: { accessToken: string; fileId: string }) => Promise<string>;
  
  // Database operations
  dbCheckConnection: () => Promise<boolean>;
  dbFindOrCreateUserByGoogle: (params: { 
    googleId: string; 
    email: string; 
    name: string; 
    picture?: string;
  }) => Promise<DbUser>;
  dbGetUserById: (userId: string) => Promise<DbUser | null>;
  dbGetBooksByUser: (userId: string) => Promise<DbBookSummary[]>;
  dbGetBookById: (bookId: string) => Promise<unknown>;
  dbCreateBook: (params: { userId: string; book: unknown }) => Promise<unknown>;
  dbUpdateBook: (params: { bookId: string; book: unknown }) => Promise<unknown>;
  dbDeleteBook: (bookId: string) => Promise<boolean>;
  dbGetBookUpdatedAt: (bookId: string) => Promise<Date | null>;
  dbBookExists: (bookId: string) => Promise<boolean>;
  dbGetChapterTimestamps: (bookId: string) => Promise<Record<string, string>>;
  dbGetPlotErrorAnalysis: (bookId: string) => Promise<unknown>;
  dbDeleteStoryCraftFeedback: (chapterId: string) => Promise<boolean>;
  dbSyncBookToDatabase: (params: { userId: string; book: unknown }) => Promise<unknown>;
  dbLoadBookFromDatabase: (bookId: string) => Promise<unknown>;
  dbDetectChapterConflicts: (params: { bookId: string; localChapters: unknown[] }) => Promise<ChapterConflict[]>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
