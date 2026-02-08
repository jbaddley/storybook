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
  
  // Backup operations
  listBackups: (filePath: string) => ipcRenderer.invoke('file:list-backups', filePath),
  restoreBackup: (backupPath: string, originalPath: string) => 
    ipcRenderer.invoke('file:restore-backup', backupPath, originalPath),
  
  // Export operations
  exportDocx: (data: string, defaultFileName?: string) => ipcRenderer.invoke('file:export-docx', data, defaultFileName),
  exportPdf: (html: string, bookTitle: string, options?: { margins?: { top: number; right: number; bottom: number; left: number }; pageWidthIn: number; pageHeightIn: number }) => ipcRenderer.invoke('file:export-pdf', html, bookTitle, options),
  exportPdfViaDocx: (docxBase64: string, bookTitle: string) => ipcRenderer.invoke('file:export-pdf-via-docx', docxBase64, bookTitle),
  libreofficeAvailable: () => ipcRenderer.invoke('file:libreoffice-available') as Promise<boolean>,
  exportPdfPreview: (html: string, bookTitle: string, options?: { margins?: { top: number; right: number; bottom: number; left: number }; pageWidthIn: number; pageHeightIn: number }) => ipcRenderer.invoke('file:export-pdf-preview', html, bookTitle, options),
  exportPdfFile: (pdfBase64: string) => ipcRenderer.invoke('file:export-pdf-file', pdfBase64),
  exportMp3: (data: string, defaultName?: string) => 
    ipcRenderer.invoke('file:export-mp3', data, defaultName),
  pickDirAndCreateSubfolder: (suggestedFolderName: string) =>
    ipcRenderer.invoke('file:pick-dir-and-create-subfolder', suggestedFolderName) as Promise<string | null>,
  writeMp3ToPath: (data: string, folderPath: string, fileName: string) =>
    ipcRenderer.invoke('file:write-mp3-to-path', data, folderPath, fileName) as Promise<string | null>,
  getAudioPlaybackUrl: (filePath: string) =>
    ipcRenderer.invoke('audio:get-playback-url', filePath) as Promise<string>,

  // Dialog operations
  openFileDialog: (options: Electron.OpenDialogOptions) => 
    ipcRenderer.invoke('dialog:open-file', options),
  saveFileDialog: (options: Electron.SaveDialogOptions) => 
    ipcRenderer.invoke('dialog:save-file', options),
  
  // Clipboard (main process can read image when renderer paste has no image data)
  clipboardHasImage: () => ipcRenderer.invoke('clipboard:has-image') as Promise<boolean>,
  clipboardReadImage: () => ipcRenderer.invoke('clipboard:read-image') as Promise<string | null>,

  // Store operations (for settings like API keys)
  storeGet: (key: string) => ipcRenderer.invoke('store:get', key),
  storeSet: (key: string, value: unknown) => 
    ipcRenderer.invoke('store:set', key, value),
  
  // App info
  getVersion: () => ipcRenderer.invoke('app:get-version'),

  // Spell checker (Electron built-in; only in Electron)
  replaceMisspelling: (suggestion: string) => ipcRenderer.invoke('spell:replace-misspelling', suggestion),
  addWordToSpellCheckerDictionary: (word: string) => ipcRenderer.invoke('spell:add-to-dictionary', word),
  // Editor context menu: ask main to show native menu (sentence, coords, spell data from main's editor-context-menu-show)
  sendEditorContextMenuBuild: (data: { sentence: string; x: number; y: number; misspelledWord?: string; dictionarySuggestions?: string[] }) => {
    ipcRenderer.send('editor-context-menu-build', data);
  },
  onEditorContextMenuShow: (callback: (data: { x: number; y: number; misspelledWord: string; dictionarySuggestions: string[] }) => void) => {
    const handler = (_: Electron.IpcRendererEvent, data: { x: number; y: number; misspelledWord: string; dictionarySuggestions: string[] }) => callback(data);
    ipcRenderer.on('editor-context-menu-show', handler);
    return () => ipcRenderer.removeListener('editor-context-menu-show', handler);
  },
  onEditorContextMenuAddToChat: (callback: (sentence: string) => void) => {
    const handler = (_: Electron.IpcRendererEvent, sentence: string) => callback(sentence);
    ipcRenderer.on('editor-context-menu-add-to-chat', handler);
    return () => ipcRenderer.removeListener('editor-context-menu-add-to-chat', handler);
  },

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
  onMenuExportAllAudio: (callback: () => void) => {
    ipcRenderer.on('menu:export-all-audio', callback);
    return () => ipcRenderer.removeListener('menu:export-all-audio', callback);
  },
  onMenuFormatDocument: (callback: () => void) => {
    ipcRenderer.on('menu:format-document', callback);
    return () => ipcRenderer.removeListener('menu:format-document', callback);
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
  
  // Google OAuth: Get credentials from environment
  googleGetCredentials: () => 
    ipcRenderer.invoke('google:get-credentials') as Promise<{ clientId: string; clientSecret: string } | null>,
  
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
  
  // Google API: Upload file to Drive
  googleApiUploadFile: (params: { 
    accessToken: string; 
    fileName: string; 
    base64Data: string; 
    mimeType: string;
    folderId?: string;
    fileId?: string;
  }) => ipcRenderer.invoke('google:api-upload-file', params),
  
  // Google API: Download file from Drive
  googleApiDownloadFile: (params: { accessToken: string; fileId: string }) =>
    ipcRenderer.invoke('google:api-download-file', params),
  
  // ===========================================
  // Database Operations (Prisma)
  // ===========================================
  
  // Database: Check connection status
  dbCheckConnection: () => ipcRenderer.invoke('db:check-connection'),
  
  // Database: Find or create user by Google info
  dbFindOrCreateUserByGoogle: (params: { 
    googleId: string; 
    email: string; 
    name: string; 
    picture?: string;
  }) => ipcRenderer.invoke('db:find-or-create-user-by-google', params),
  
  // Database: Get user by ID
  dbGetUserById: (userId: string) => ipcRenderer.invoke('db:get-user-by-id', userId),
  
  // Database: Get all books for a user
  dbGetBooksByUser: (userId: string) => ipcRenderer.invoke('db:get-books-by-user', userId),
  
  // Database: Get a single book by ID
  dbGetBookById: (bookId: string) => ipcRenderer.invoke('db:get-book-by-id', bookId),
  
  // Database: Create a new book
  dbCreateBook: (params: { userId: string; book: unknown }) => 
    ipcRenderer.invoke('db:create-book', params),
  
  // Database: Update an existing book
  dbUpdateBook: (params: { bookId: string; book: unknown }) => 
    ipcRenderer.invoke('db:update-book', params),
  
  // Database: Delete a book
  dbDeleteBook: (bookId: string) => ipcRenderer.invoke('db:delete-book', bookId),
  
  // Database: Get book's updatedAt timestamp
  dbGetBookUpdatedAt: (bookId: string) => ipcRenderer.invoke('db:get-book-updated-at', bookId),
  
  // Database: Check if book exists
  dbBookExists: (bookId: string) => ipcRenderer.invoke('db:book-exists', bookId),
  
  // Database: Get chapter timestamps for conflict detection
  dbGetChapterTimestamps: (bookId: string) => ipcRenderer.invoke('db:get-chapter-timestamps', bookId),
  
  // Database: Delete story craft feedback for a chapter
  dbDeleteStoryCraftFeedback: (chapterId: string) =>
    ipcRenderer.invoke('db:delete-story-craft-feedback', chapterId) as Promise<boolean>,
  
  // Database: Sync entire book to database
  dbSyncBookToDatabase: (params: { userId: string; book: unknown }) => 
    ipcRenderer.invoke('db:sync-book-to-database', params),
  
  // Database: Load book from database in app format
  dbLoadBookFromDatabase: (bookId: string) => ipcRenderer.invoke('db:load-book-from-database', bookId),
  
  // Database: Detect chapter conflicts
  dbDetectChapterConflicts: (params: { bookId: string; localChapters: unknown[] }) => 
    ipcRenderer.invoke('db:detect-chapter-conflicts', params),

  // Database: Chapter variations (DB-only)
  dbGetVariationsForChapter: (chapterId: string) =>
    ipcRenderer.invoke('db:get-variations-for-chapter', chapterId),
  dbAddChapterVariation: (chapterId: string, variation: unknown) =>
    ipcRenderer.invoke('db:add-chapter-variation', chapterId, variation),
  dbDeleteChapterVariation: (variationId: string) =>
    ipcRenderer.invoke('db:delete-chapter-variation', variationId),
});

// Type definitions are in src/shared/electron-api.d.ts
// This file is imported by the renderer process for type checking

