import { ipcMain, dialog, app, clipboard, Menu, BrowserWindow, protocol } from 'electron';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { execSync, spawnSync } from 'child_process';
import Store from 'electron-store';
import * as https from 'https';
import * as db from './database';

// Helper to find Chrome/Chromium executable for puppeteer
function findChromeExecutable(): string | undefined {
  const platform = process.platform;
  
  if (platform === 'darwin') {
    // macOS - try common locations
    const possiblePaths = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    ];
    for (const chromePath of possiblePaths) {
      try {
        if (fsSync.existsSync(chromePath)) {
          return chromePath;
        }
      } catch {
        // Continue searching
      }
    }
  } else if (platform === 'win32') {
    // Windows - try common locations
    const possiblePaths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      (process.env.LOCALAPPDATA || '') + '\\Google\\Chrome\\Application\\chrome.exe',
    ];
    for (const chromePath of possiblePaths) {
      try {
        if (fsSync.existsSync(chromePath)) {
          return chromePath;
        }
      } catch {
        // Continue searching
      }
    }
  } else if (platform === 'linux') {
    // Linux - try common commands
    const possibleCommands = ['google-chrome', 'chromium', 'chromium-browser', 'google-chrome-stable'];
    for (const cmd of possibleCommands) {
      try {
        execSync(`which ${cmd}`, { stdio: 'ignore' });
        return cmd;
      } catch {
        // Continue searching
      }
    }
  }
  
  return undefined;
}

/** Find LibreOffice executable for headless DOCX→PDF conversion. */
function findLibreOffice(): string | undefined {
  const platform = process.platform;
  if (platform === 'darwin') {
    const p = '/Applications/LibreOffice.app/Contents/MacOS/soffice';
    if (fsSync.existsSync(p)) return p;
  } else if (platform === 'win32') {
    const possible = [
      'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
      'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
    ];
    for (const p of possible) {
      if (fsSync.existsSync(p)) return p;
    }
  } else if (platform === 'linux') {
    try {
      execSync('which soffice', { stdio: 'ignore' });
      return 'soffice';
    } catch {
      try {
        execSync('which libreoffice', { stdio: 'ignore' });
        return 'libreoffice';
      } catch {
        // continue
      }
    }
  }
  return undefined;
}

/** Sanitize book title for use as export filename (remove path and invalid chars). */
function sanitizeExportFileName(title: string): string {
  const sanitized = String(title || '')
    .replace(/[/\\:*?"<>|]/g, '')
    .trim();
  return sanitized || 'manuscript';
}

const store = new Store();

// Number of backup versions to keep
const MAX_BACKUPS = 20;

// Minimum time between backups in milliseconds (5 minutes)
const MIN_BACKUP_INTERVAL_MS = 5 * 60 * 1000;

// Minimum size difference (in bytes) to consider a change "significant"
const MIN_SIGNIFICANT_CHANGE_BYTES = 100;

// Track last backup time per file
const lastBackupTimes = new Map<string, number>();

// Token -> file path for app-audio:// playback (renderer gets URL, we serve file by token)
const audioPlaybackTokenToPath = new Map<string, string>();
const AUDIO_PLAYBACK_TOKEN_TTL_MS = 5 * 60 * 1000;

/**
 * Check if a backup should be created based on:
 * 1. Time since last backup (minimum 5 minutes)
 * 2. Whether the content has changed significantly
 */
async function shouldCreateBackup(filePath: string, newData: ArrayBuffer): Promise<boolean> {
  try {
    // Check time since last backup
    const lastBackupTime = lastBackupTimes.get(filePath) || 0;
    const timeSinceLastBackup = Date.now() - lastBackupTime;
    
    if (timeSinceLastBackup < MIN_BACKUP_INTERVAL_MS) {
      console.log(`[Backup] Skipping - only ${Math.round(timeSinceLastBackup / 1000)}s since last backup (need ${MIN_BACKUP_INTERVAL_MS / 1000}s)`);
      return false;
    }
    
    // Check if file exists
    await fs.access(filePath);
    
    // Get current file size
    const currentStats = await fs.stat(filePath);
    const currentSize = currentStats.size;
    const newSize = newData.byteLength;
    
    // Calculate size difference
    const sizeDiff = Math.abs(newSize - currentSize);
    
    // If size difference is significant, create backup
    if (sizeDiff >= MIN_SIGNIFICANT_CHANGE_BYTES) {
      console.log(`[Backup] Significant change detected: ${sizeDiff} bytes difference`);
      return true;
    }
    
    // For small size changes, compare actual content with most recent backup
    const backup1Path = `${filePath}.backup1`;
    try {
      await fs.access(backup1Path);
      const backup1Stats = await fs.stat(backup1Path);
      
      // If the current file is very similar in size to the latest backup, skip
      const backupSizeDiff = Math.abs(newSize - backup1Stats.size);
      if (backupSizeDiff < MIN_SIGNIFICANT_CHANGE_BYTES) {
        console.log(`[Backup] Skipping - new content similar to latest backup (${backupSizeDiff} bytes diff)`);
        return false;
      }
    } catch (e) {
      // No backup1 exists, this is the first backup
      return true;
    }
    
    console.log(`[Backup] Creating backup - changes detected`);
    return true;
  } catch (e) {
    // Original file doesn't exist, this is a new file
    return true;
  }
}

/**
 * Create a backup of the file before saving
 * Rotates backups: .backup20 gets deleted, .backup19 -> .backup20, etc.
 * Only creates backup if changes are significant
 */
async function createBackup(filePath: string, newData?: ArrayBuffer): Promise<void> {
  try {
    // Check if file exists
    await fs.access(filePath);
    
    // If we have the new data, check if backup is needed
    if (newData) {
      const shouldBackup = await shouldCreateBackup(filePath, newData);
      if (!shouldBackup) {
        return;
      }
    }
    
    // Rotate existing backups (delete oldest, shift others)
    for (let i = MAX_BACKUPS; i >= 1; i--) {
      const backupPath = `${filePath}.backup${i}`;
      const prevBackupPath = i === 1 ? filePath : `${filePath}.backup${i - 1}`;
      
      try {
        if (i === MAX_BACKUPS) {
          // Delete the oldest backup
          await fs.unlink(backupPath).catch(() => {});
        }
        
        if (i > 1) {
          // Rename previous backup to current slot
          await fs.access(prevBackupPath);
          await fs.rename(prevBackupPath, backupPath);
        } else {
          // Copy current file to backup1
          await fs.copyFile(filePath, backupPath);
        }
      } catch (e) {
        // Backup file doesn't exist, skip
      }
    }
    
    // Update last backup time
    lastBackupTimes.set(filePath, Date.now());
    
    console.log(`[Backup] Created backup for ${path.basename(filePath)}`);
  } catch (e) {
    // Original file doesn't exist, no backup needed
  }
}

/**
 * List available backups for a file
 */
async function listBackups(filePath: string): Promise<Array<{ path: string; number: number; modified: Date; size: number }>> {
  const backups: Array<{ path: string; number: number; modified: Date; size: number }> = [];
  
  for (let i = 1; i <= MAX_BACKUPS; i++) {
    const backupPath = `${filePath}.backup${i}`;
    try {
      const stats = await fs.stat(backupPath);
      backups.push({
        path: backupPath,
        number: i,
        modified: stats.mtime,
        size: stats.size,
      });
    } catch (e) {
      // Backup doesn't exist
    }
  }
  
  return backups;
}

// Google OAuth Token URL
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const OAUTH_PORT = 4000;
const REDIRECT_URI = `http://127.0.0.1:${OAUTH_PORT}/oauth2callback`;

export function setupIpcHandlers(): void {
  // Clipboard: check if system clipboard has an image (MIME or macOS UTI formats)
  ipcMain.handle('clipboard:has-image', () => {
    const formats = clipboard.availableFormats();
    const hasImageFormat = formats.some(
      (f) =>
        f === 'image/png' ||
        f === 'image/jpeg' ||
        f === 'image/jpg' ||
        f.startsWith('image/') ||
        f === 'public.png' ||
        f === 'public.jpeg' ||
        f === 'public.jpg' ||
        f === 'public.tiff' ||
        f === 'PNG' ||
        f === 'JPEG'
    );
    if (hasImageFormat) return true;
    // On some systems formats don't list image; try reading and check isEmpty
    try {
      const image = clipboard.readImage('clipboard');
      return image && !image.isEmpty();
    } catch {
      return false;
    }
  });
  // Clipboard: read image from system clipboard (for paste-in-document)
  ipcMain.handle('clipboard:read-image', async () => {
    try {
      const image = clipboard.readImage('clipboard');
      if (!image || image.isEmpty()) return null;
      return image.toDataURL();
    } catch {
      return null;
    }
  });

  // File: New
  ipcMain.handle('file:new', async () => {
    return null; // Signal to create new book in renderer
  });

  // File: Open
  ipcMain.handle('file:open', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Storybook Files', extensions: ['sbk'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const filePath = result.filePaths[0];
    try {
      const data = await fs.readFile(filePath);
      return { 
        data: data.toString('base64'), 
        filePath 
      };
    } catch (error) {
      console.error('Error reading file:', error);
      throw error;
    }
  });

  // File: Read (by path, for reopening last file)
  ipcMain.handle('file:read', async (_event, filePath: string) => {
    try {
      // Check if file exists first
      await fs.access(filePath);
      const data = await fs.readFile(filePath);
      return data.toString('base64');
    } catch (error) {
      console.error('Error reading file:', error);
      return null;
    }
  });

  // File: Save
  ipcMain.handle('file:save', async (_event, data: string, filePath?: string) => {
    if (!filePath) {
      // If no path provided, trigger Save As
      return await saveFileAs(data);
    }

    try {
      // ATOMIC WRITE: Write to temp file first, then rename
      // This prevents corruption if the write is interrupted
      const tempPath = `${filePath}.tmp.${Date.now()}`;
      const buffer = Buffer.from(data, 'base64');
      
      // Create backup before saving (pass buffer for intelligent backup decision)
      await createBackup(filePath, buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
      
      // Write to temp file
      await fs.writeFile(tempPath, buffer);
      
      // Verify the temp file was written completely by checking size
      const stats = await fs.stat(tempPath);
      if (stats.size !== buffer.length) {
        await fs.unlink(tempPath).catch(() => {});
        throw new Error('File write verification failed - size mismatch');
      }
      
      // Atomic rename (this is atomic on most file systems)
      await fs.rename(tempPath, filePath);
      
      console.log(`[Save] Saved ${path.basename(filePath)} (${buffer.length} bytes)`);
      return filePath;
    } catch (error) {
      console.error('Error saving file:', error);
      throw error;
    }
  });
  
  // File: List Backups
  ipcMain.handle('file:list-backups', async (_event, filePath: string) => {
    return await listBackups(filePath);
  });
  
  // File: Restore from Backup
  ipcMain.handle('file:restore-backup', async (_event, backupPath: string, originalPath: string) => {
    try {
      // First, backup the current file (in case they want to undo the restore)
      await createBackup(originalPath);
      
      // Copy backup to original location
      await fs.copyFile(backupPath, originalPath);
      
      // Read and return the restored file data
      const data = await fs.readFile(originalPath);
      return data.toString('base64');
    } catch (error) {
      console.error('Error restoring backup:', error);
      throw error;
    }
  });

  // File: Save As
  ipcMain.handle('file:save-as', async (_event, data: string) => {
    return await saveFileAs(data);
  });

  // Export: DOCX
  ipcMain.handle('file:export-docx', async (_event, data: string, defaultName?: string) => {
    const base = sanitizeExportFileName(defaultName || 'manuscript');
    const result = await dialog.showSaveDialog({
      filters: [
        { name: 'Word Document', extensions: ['docx'] },
      ],
      defaultPath: `${base}.docx`,
    });

    if (result.canceled || !result.filePath) {
      return null;
    }

    try {
      const buffer = Buffer.from(data, 'base64');
      await fs.writeFile(result.filePath, buffer);
      return result.filePath;
    } catch (error) {
      console.error('Error exporting DOCX:', error);
      throw error;
    }
  });

  // Export: PDF via DOCX (LibreOffice) for better typography
  ipcMain.handle('file:export-pdf-via-docx', async (_event, docxBase64: string, bookTitle: string = '') => {
    const soffice = findLibreOffice();
    if (!soffice) {
      throw new Error(
        'LibreOffice not found. Install LibreOffice to use "Export via DOCX" for better PDF formatting. ' +
        'On macOS: install from https://www.libreoffice.org. Then try again, or use the direct PDF export instead.'
      );
    }
    const os = require('os');
    const tmpDir = path.join(os.tmpdir(), `storybook-pdf-${Date.now()}`);
    const docxPath = path.join(tmpDir, 'manuscript.docx');
    const outDir = tmpDir;
    try {
      await fs.mkdir(tmpDir, { recursive: true });
      const buffer = Buffer.from(docxBase64, 'base64');
      await fs.writeFile(docxPath, buffer);
      const resultSync = spawnSync(soffice, ['--headless', '--convert-to', 'pdf', '--outdir', outDir, docxPath], {
        encoding: 'utf8',
        timeout: 120000,
      });
      if (resultSync.status !== 0) {
        const stderr = (resultSync.stderr || resultSync.error?.message || '') as string;
        throw new Error(`LibreOffice conversion failed: ${stderr || 'unknown error'}`);
      }
      const pdfPath = path.join(outDir, 'manuscript.pdf');
      const pdfBuffer = await fs.readFile(pdfPath);
      const pdfBase = sanitizeExportFileName(bookTitle || 'manuscript');
      const result = await dialog.showSaveDialog({
        filters: [{ name: 'PDF Document', extensions: ['pdf'] }],
        defaultPath: `${pdfBase}.pdf`,
      });
      if (result.canceled || !result.filePath) return null;
      await fs.writeFile(result.filePath, pdfBuffer);
      return result.filePath;
    } finally {
      try {
        await fs.rm(tmpDir, { recursive: true, force: true });
      } catch {
        // ignore cleanup errors
      }
    }
  });

  // Check if LibreOffice is available (for UI to show/hide "Export via DOCX" option)
  ipcMain.handle('file:libreoffice-available', async () => {
    return !!findLibreOffice();
  });

  // Helper: generate PDF buffer from HTML (optional pageRanges e.g. '1-5' for preview)
  type PdfOptions = {
    margins?: { top: number; right: number; bottom: number; left: number };
    pageWidthIn: number;
    pageHeightIn: number;
    bodyFontSize?: number;
    bodyFont?: string;
    titleFontSize?: number;
    titleFont?: string;
  };
  async function generatePdfBuffer(
    html: string,
    bookTitle: string,
    options: PdfOptions | undefined,
    pageRanges?: string
  ): Promise<Buffer> {
    const puppeteer = require('puppeteer-core');
    const executablePath = findChromeExecutable();
    if (!executablePath) {
      throw new Error('Chrome or Chromium not found. Please install Google Chrome or Chromium to export PDFs.');
    }
    const escapedTitle = String(bookTitle || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    const m = options?.margins || { top: 1, right: 1, bottom: 1, left: 1 };
    const w = options?.pageWidthIn ?? 8.5;
    const h = options?.pageHeightIn ?? 11;
    // Use zero margin for PDF so our HTML controls the full page (avoids Chromium scaling content into a margin box).
    // Header/footer are disabled; page numbers can be added in-app later if needed.
    const topIn = '0in';
    const bottomIn = '0in';
    const leftIn = '0in';
    const rightIn = '0in';

    const bodyFontSizePt = Math.max(1, Math.round(Number(options?.bodyFontSize) || 12));
    const bodyFontFamily = (options?.bodyFont && String(options.bodyFont).trim())
      ? (String(options.bodyFont).includes(' ') ? `"${String(options.bodyFont).trim()}"` : String(options.bodyFont).trim())
      : 'serif';
    // Use px (96dpi): Chromium print can ignore pt
    const bodyFontSizePx = Math.round((bodyFontSizePt * 96) / 72);
    if (process.env.NODE_ENV !== 'production') {
      console.log('[PDF Export] font:', bodyFontSizePt, 'pt =', bodyFontSizePx, 'px, family:', bodyFontFamily);
    }

    // Inject font override into HTML so it's in the document from first load
    const fontOverrideStyle = `<style id="pdf-font-override">body,body p,body li,body blockquote,.title-page-author,.settings-page,.settings-page p,.settings-page li,.chapter p,.chapter li,.chapter blockquote{font-size:${bodyFontSizePx}px !important;font-family:${bodyFontFamily},serif !important;}</style>`;
    html = html.replace(/\s*<\/head\s*>/i, fontOverrideStyle + '\n</head>');

    const browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    try {
      const page = await browser.newPage();
      await page.emulateMediaType('print');
      await page.setViewport({
        width: Math.round(w * 96),
        height: Math.round(h * 96),
        deviceScaleFactor: 1,
      });
      await page.setContent(html, { waitUntil: 'networkidle0' });

      // Force font onto every text element via inline style (highest specificity, survives print).
      // Skip .settings-demo-title and .settings-demo-body so the settings page can show actual title/body sizes.
      await page.evaluate(
        (args: { sizePx: number; fontFamily: string }) => {
          const selector = 'body, body p, body li, body blockquote, .title-page-author, .settings-page, .settings-page p, .settings-page li, .chapter p, .chapter li, .chapter blockquote';
          document.querySelectorAll(selector).forEach((el) => {
            if ((el as HTMLElement).classList.contains('settings-demo-title') || (el as HTMLElement).classList.contains('settings-demo-body')) return;
            const style = (el as HTMLElement).style;
            style.setProperty('font-size', `${args.sizePx}px`, 'important');
            style.setProperty('font-family', `${args.fontFamily}, serif`, 'important');
          });
        },
        { sizePx: bodyFontSizePx, fontFamily: bodyFontFamily }
      );

      const pdfBuffer = await page.pdf({
        printBackground: true,
        width: w + 'in',
        height: h + 'in',
        scale: 1,
        preferCSSPageSize: true,
        displayHeaderFooter: false,
        margin: { top: topIn, bottom: bottomIn, left: leftIn, right: rightIn },
        ...(pageRanges ? { pageRanges } : {}),
      });
      return pdfBuffer;
    } finally {
      await browser.close();
    }
  }

  // Export: PDF (full document, show save dialog)
  ipcMain.handle('file:export-pdf', async (_event, html: string, bookTitle: string = '', options?: PdfOptions) => {
    try {
      const pdfBuffer = await generatePdfBuffer(html, bookTitle, options);
      if (process.env.PDF_EXPORT_TEST === '1') {
        const testOutDir = path.join(process.cwd(), 'scripts', 'output');
        const testOutPath = path.join(testOutDir, 'app-export-test.pdf');
        await fs.mkdir(testOutDir, { recursive: true }).catch(() => {});
        await fs.writeFile(testOutPath, pdfBuffer);
        console.log('[PDF Export] Wrote test PDF to', testOutPath);
      }
      const pdfBase = sanitizeExportFileName(bookTitle || 'manuscript');
      const result = await dialog.showSaveDialog({
        filters: [{ name: 'PDF Document', extensions: ['pdf'] }],
        defaultPath: `${pdfBase}.pdf`,
      });
      if (result.canceled || !result.filePath) return null;
      await fs.writeFile(result.filePath, pdfBuffer);
      return result.filePath;
    } catch (error) {
      console.error('Error exporting PDF:', error);
      throw error;
    }
  });

  // Export: PDF preview (first 5 pages only, return base64 for display)
  ipcMain.handle('file:export-pdf-preview', async (_event, html: string, bookTitle: string = '', options?: PdfOptions) => {
    try {
      const pdfBuffer = await generatePdfBuffer(html, bookTitle, options, '1-5');
      return pdfBuffer.toString('base64');
    } catch (error) {
      console.error('Error generating PDF preview:', error);
      throw error;
    }
  });

  // Export: PDF File (for saving already-generated PDF)
  ipcMain.handle('file:export-pdf-file', async (_event, pdfBase64: string) => {
    const result = await dialog.showSaveDialog({
      filters: [
        { name: 'PDF Document', extensions: ['pdf'] },
      ],
      defaultPath: 'manuscript.pdf',
    });

    if (result.canceled || !result.filePath) {
      return null;
    }

    try {
      const buffer = Buffer.from(pdfBase64, 'base64');
      await fs.writeFile(result.filePath, buffer);
      return result.filePath;
    } catch (error) {
      console.error('Error saving PDF file:', error);
      throw error;
    }
  });

  // Export: MP3 Audio
  ipcMain.handle('file:export-mp3', async (_event, data: string, defaultName?: string) => {
    const result = await dialog.showSaveDialog({
      filters: [
        { name: 'MP3 Audio', extensions: ['mp3'] },
      ],
      defaultPath: defaultName || 'chapter.mp3',
    });

    if (result.canceled || !result.filePath) {
      return null;
    }

    try {
      const buffer = Buffer.from(data, 'base64');
      await fs.writeFile(result.filePath, buffer);
      return result.filePath;
    } catch (error) {
      console.error('Error exporting MP3:', error);
      throw error;
    }
  });

  // Pick directory, create a subfolder with the suggested name (e.g. "Book Title_2025-02-03_143052"), return its path
  ipcMain.handle('file:pick-dir-and-create-subfolder', async (_event, suggestedFolderName: string) => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: 'Choose location for export folder',
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    const parentDir = result.filePaths[0];
    const safeName = (suggestedFolderName || 'Audio_Export')
      .replace(/[<>:"/\\|?*]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 100) || 'Audio_Export';
    const folderPath = path.join(parentDir, safeName);
    try {
      await fs.mkdir(folderPath, { recursive: true });
      return folderPath;
    } catch (error) {
      console.error('Error creating export folder:', error);
      throw error;
    }
  });

  // Write MP3 data to a specific path (folderPath + fileName). Creates parent dir if needed. Returns full path or null.
  ipcMain.handle('file:write-mp3-to-path', async (_event, data: string, folderPath: string, fileName: string) => {
    const fullPath = path.join(folderPath, fileName);
    try {
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      const buffer = Buffer.from(data, 'base64');
      await fs.writeFile(fullPath, buffer);
      return fullPath as string;
    } catch (error) {
      console.error('Error writing MP3 to path:', error);
      throw error;
    }
  });

  // Audio playback: return a URL the renderer can use in <audio src>. Main serves the file via app-audio:// protocol.
  ipcMain.handle('audio:get-playback-url', async (_event, filePath: string) => {
    const token = `t${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    audioPlaybackTokenToPath.set(token, filePath);
    setTimeout(() => audioPlaybackTokenToPath.delete(token), AUDIO_PLAYBACK_TOKEN_TTL_MS);
    return `app-audio://play/${token}`;
  });

  // Dialog: Open File
  ipcMain.handle('dialog:open-file', async (_event, options) => {
    return await dialog.showOpenDialog(options);
  });

  // Dialog: Save File
  ipcMain.handle('dialog:save-file', async (_event, options) => {
    return await dialog.showSaveDialog(options);
  });

  // Store: Get
  ipcMain.handle('store:get', async (_event, key: string) => {
    return store.get(key);
  });

  // Store: Set
  ipcMain.handle('store:set', async (_event, key: string, value: unknown) => {
    store.set(key, value);
  });

  // App: Get Version
  ipcMain.handle('app:get-version', async () => {
    return app.getVersion();
  });

  // Spell checker (Electron built-in): replace misspelling and add word to dictionary
  ipcMain.handle('spell:replace-misspelling', (_event, suggestion: string) => {
    if (typeof suggestion === 'string' && suggestion) {
      _event.sender.replaceMisspelling(suggestion);
    }
  });
  ipcMain.handle('spell:add-to-dictionary', (_event, word: string) => {
    if (typeof word === 'string' && word) {
      _event.sender.session.addWordToSpellCheckerDictionary(word);
    }
  });

  // Editor context menu: build native menu (spell suggestions + Add to dictionary + Add to chat)
  // Renderer sends sentence, coords, and spell data (from main's editor-context-menu-show)
  ipcMain.on('editor-context-menu-build', (
    event,
    data: { sentence: string; x: number; y: number; misspelledWord?: string; dictionarySuggestions?: string[] }
  ) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || !data) return;
    const misspelledWord = data.misspelledWord ?? '';
    const dictionarySuggestions = data.dictionarySuggestions ?? [];
    const x = data.x;
    const y = data.y;
    const sentence = data.sentence ?? '';
    const template: Electron.MenuItemConstructorOptions[] = [];
    if (dictionarySuggestions?.length) {
      for (const suggestion of dictionarySuggestions) {
        template.push({
          label: `Correct spelling: ${suggestion}`,
          click: () => event.sender.replaceMisspelling(suggestion),
        });
      }
    }
    if (misspelledWord) {
      template.push({
        label: 'Add to dictionary',
        click: () => event.sender.session.addWordToSpellCheckerDictionary(misspelledWord),
      });
    }
    if (template.length) template.push({ type: 'separator' });
    template.push({
      label: 'Add to chat',
      click: () => event.sender.send('editor-context-menu-add-to-chat', sentence),
    });
    const menu = Menu.buildFromTemplate(template);
    menu.popup({ window: win, x, y });
  });

  // Google OAuth: Get credentials from environment
  ipcMain.handle('google:get-credentials', async () => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    
    if (clientId && clientSecret) {
      return { clientId, clientSecret };
    }
    return null;
  });

  // Google OAuth: Exchange code for tokens
  ipcMain.handle('google:exchange-token', async (_event, params: {
    code: string;
    clientId: string;
    clientSecret: string;
  }) => {
    return new Promise((resolve, reject) => {
      const postData = new URLSearchParams({
        client_id: params.clientId,
        client_secret: params.clientSecret,
        code: params.code,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI,
      }).toString();

      const url = new URL(GOOGLE_TOKEN_URL);
      
      const req = https.request({
        hostname: url.hostname,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData),
        },
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve({
                accessToken: json.access_token,
                refreshToken: json.refresh_token,
                expiresIn: json.expires_in,
              });
            } else {
              reject(new Error(json.error_description || json.error || 'Token exchange failed'));
            }
          } catch (e) {
            reject(new Error(`Failed to parse response: ${data}`));
          }
        });
      });

      req.on('error', (e) => {
        reject(new Error(`Request failed: ${e.message}`));
      });

      req.write(postData);
      req.end();
    });
  });

  // Google OAuth: Refresh token
  ipcMain.handle('google:refresh-token', async (_event, params: {
    refreshToken: string;
    clientId: string;
    clientSecret: string;
  }) => {
    return new Promise((resolve, reject) => {
      const postData = new URLSearchParams({
        client_id: params.clientId,
        client_secret: params.clientSecret,
        refresh_token: params.refreshToken,
        grant_type: 'refresh_token',
      }).toString();

      const url = new URL(GOOGLE_TOKEN_URL);
      
      const req = https.request({
        hostname: url.hostname,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData),
        },
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve({
                accessToken: json.access_token,
                expiresIn: json.expires_in,
              });
            } else {
              reject(new Error(json.error_description || json.error || 'Token refresh failed'));
            }
          } catch (e) {
            reject(new Error(`Failed to parse response: ${data}`));
          }
        });
      });

      req.on('error', (e) => {
        reject(new Error(`Request failed: ${e.message}`));
      });

      req.write(postData);
      req.end();
    });
  });

  // Google API: Make authenticated GET request (to avoid CORS)
  ipcMain.handle('google:api-get', async (_event, params: {
    url: string;
    accessToken: string;
  }) => {
    return new Promise((resolve, reject) => {
      const url = new URL(params.url);
      
      const req = https.request({
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${params.accessToken}`,
        },
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve(json);
            } else {
              reject(new Error(json.error?.message || json.error || `Request failed with status ${res.statusCode}`));
            }
          } catch (e) {
            // If not JSON, return as text
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve(data);
            } else {
              reject(new Error(`Request failed: ${data}`));
            }
          }
        });
      });

      req.on('error', (e) => {
        reject(new Error(`Request failed: ${e.message}`));
      });

      req.end();
    });
  });

  // Google API: Make authenticated POST request (to avoid CORS)
  ipcMain.handle('google:api-post', async (_event, params: {
    url: string;
    accessToken: string;
    body: string;
    contentType?: string;
  }) => {
    return new Promise((resolve, reject) => {
      const url = new URL(params.url);
      const bodyBuffer = Buffer.from(params.body, 'utf-8');
      
      const req = https.request({
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${params.accessToken}`,
          'Content-Type': params.contentType || 'application/json',
          'Content-Length': bodyBuffer.length,
        },
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve(json);
            } else {
              reject(new Error(json.error?.message || json.error || `Request failed with status ${res.statusCode}`));
            }
          } catch (e) {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve(data);
            } else {
              reject(new Error(`Request failed: ${data}`));
            }
          }
        });
      });

      req.on('error', (e) => {
        reject(new Error(`Request failed: ${e.message}`));
      });

      req.write(bodyBuffer);
      req.end();
    });
  });

  // Google API: Upload file to Drive (multipart upload)
  ipcMain.handle('google:api-upload-file', async (_event, params: {
    accessToken: string;
    fileName: string;
    base64Data: string;
    mimeType: string;
    folderId?: string;
    fileId?: string; // For updates
  }) => {
    return new Promise((resolve, reject) => {
      const fileBuffer = Buffer.from(params.base64Data, 'base64');
      
      // Build metadata
      const metadata: any = {
        name: params.fileName,
        mimeType: params.mimeType,
      };
      
      if (params.folderId && !params.fileId) {
        metadata.parents = [params.folderId];
      }

      const metadataString = JSON.stringify(metadata);
      const boundary = '-------314159265358979323846';
      
      // Build multipart body
      const bodyParts = [
        `--${boundary}`,
        'Content-Type: application/json; charset=UTF-8',
        '',
        metadataString,
        `--${boundary}`,
        `Content-Type: ${params.mimeType}`,
        'Content-Transfer-Encoding: base64',
        '',
        params.base64Data,
        `--${boundary}--`,
      ];
      
      const body = bodyParts.join('\r\n');
      const bodyBuffer = Buffer.from(body, 'utf-8');
      
      // Determine URL based on create vs update
      let uploadPath: string;
      let method: string;
      
      if (params.fileId) {
        // Update existing file
        uploadPath = `/upload/drive/v3/files/${params.fileId}?uploadType=multipart`;
        method = 'PATCH';
      } else {
        // Create new file
        uploadPath = '/upload/drive/v3/files?uploadType=multipart';
        method = 'POST';
      }
      
      const req = https.request({
        hostname: 'www.googleapis.com',
        path: uploadPath,
        method,
        headers: {
          'Authorization': `Bearer ${params.accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
          'Content-Length': bodyBuffer.length,
        },
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve(json);
            } else {
              reject(new Error(json.error?.message || json.error || `Upload failed with status ${res.statusCode}`));
            }
          } catch (e) {
            reject(new Error(`Failed to parse response: ${data}`));
          }
        });
      });

      req.on('error', (e) => {
        reject(new Error(`Upload failed: ${e.message}`));
      });

      req.write(bodyBuffer);
      req.end();
    });
  });

  // Google API: Download file from Drive
  ipcMain.handle('google:api-download-file', async (_event, params: {
    accessToken: string;
    fileId: string;
  }) => {
    return new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'www.googleapis.com',
        path: `/drive/v3/files/${params.fileId}?alt=media`,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${params.accessToken}`,
        },
      }, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => { chunks.push(chunk); });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            const buffer = Buffer.concat(chunks);
            resolve(buffer.toString('base64'));
          } else {
            const data = Buffer.concat(chunks).toString('utf-8');
            try {
              const json = JSON.parse(data);
              reject(new Error(json.error?.message || `Download failed with status ${res.statusCode}`));
            } catch (e) {
              reject(new Error(`Download failed with status ${res.statusCode}`));
            }
          }
        });
      });

      req.on('error', (e) => {
        reject(new Error(`Download failed: ${e.message}`));
      });

      req.end();
    });
  });

  // ===========================================
  // Database Operations (Prisma)
  // ===========================================

  // Database: Check connection status
  ipcMain.handle('db:check-connection', async () => {
    try {
      const database = db.getDatabase();
      return database !== null;
    } catch (error) {
      return false;
    }
  });

  // Database: Find or create user by Google info
  ipcMain.handle('db:find-or-create-user-by-google', async (_event, params: {
    googleId: string;
    email: string;
    name: string;
    picture?: string;
  }) => {
    try {
      const user = await db.findOrCreateUserByGoogle(params);
      return user;
    } catch (error) {
      console.error('[DB] Error in find-or-create-user:', error);
      throw error;
    }
  });

  // Database: Get user by ID
  ipcMain.handle('db:get-user-by-id', async (_event, userId: string) => {
    try {
      return await db.getUserById(userId);
    } catch (error) {
      console.error('[DB] Error getting user:', error);
      throw error;
    }
  });

  // Database: Get all books for a user
  ipcMain.handle('db:get-books-by-user', async (_event, userId: string) => {
    try {
      const dbBooks = await db.getBooksByUser(userId);
      // Convert to Book format (for summaries, we only need basic info)
      return dbBooks.map(b => ({
        id: b.id,
        title: b.title,
        author: b.author,
        description: b.description,
        updatedAt: b.updatedAt.toISOString(),
      }));
    } catch (error) {
      console.error('[DB] Error getting books:', error);
      throw error;
    }
  });

  // Database: Get a single book by ID
  ipcMain.handle('db:get-book-by-id', async (_event, bookId: string) => {
    try {
      const dbBook = await db.getBookById(bookId);
      if (!dbBook) return null;
      return await db.dbBookToAppBook(dbBook);
    } catch (error) {
      console.error('[DB] Error getting book:', error);
      throw error;
    }
  });

  // Database: Create a new book
  ipcMain.handle('db:create-book', async (_event, params: {
    userId: string;
    book: any;
  }) => {
    try {
      return await db.createBook(params.userId, params.book);
    } catch (error) {
      console.error('[DB] Error creating book:', error);
      throw error;
    }
  });

  // Database: Update an existing book
  ipcMain.handle('db:update-book', async (_event, params: {
    bookId: string;
    book: any;
  }) => {
    try {
      return await db.updateBook(params.bookId, params.book);
    } catch (error) {
      console.error('[DB] Error updating book:', error);
      throw error;
    }
  });

  // Database: Delete a book
  ipcMain.handle('db:delete-book', async (_event, bookId: string) => {
    try {
      await db.deleteBook(bookId);
      return true;
    } catch (error) {
      console.error('[DB] Error deleting book:', error);
      throw error;
    }
  });

  // Database: Get plot error analysis
  ipcMain.handle('db:get-plot-error-analysis', async (_event, bookId: string) => {
    try {
      return await db.getPlotErrorAnalysis(bookId);
    } catch (error) {
      console.error('[DB] Error getting plot error analysis:', error);
      throw error;
    }
  });

  // Database: Delete story craft feedback for a chapter
  ipcMain.handle('db:delete-story-craft-feedback', async (_event, chapterId: string) => {
    try {
      await db.deleteStoryCraftFeedback(chapterId);
      return true;
    } catch (error) {
      console.error('[DB] Error deleting story craft feedback:', error);
      throw error;
    }
  });

  // Database: Get book outline (returns null if table not migrated or error)
  ipcMain.handle('db:get-book-outline', async (_event, bookId: string) => {
    try {
      return await db.getBookOutline(bookId);
    } catch (error) {
      console.error('[DB] Error getting book outline:', error);
      return null;
    }
  });

  // Database: Upsert book outline (no-op if table not migrated)
  ipcMain.handle('db:upsert-book-outline', async (_event, bookId: string, content: string) => {
    try {
      return await db.upsertBookOutline(bookId, content);
    } catch (error) {
      console.error('[DB] Error upserting book outline:', error);
      return null;
    }
  });

  // Database: Get book's updatedAt timestamp
  ipcMain.handle('db:get-book-updated-at', async (_event, bookId: string) => {
    try {
      return await db.getBookUpdatedAt(bookId);
    } catch (error) {
      console.error('[DB] Error getting book timestamp:', error);
      throw error;
    }
  });

  // Database: Check if book exists
  ipcMain.handle('db:book-exists', async (_event, bookId: string) => {
    try {
      return await db.bookExists(bookId);
    } catch (error) {
      console.error('[DB] Error checking book existence:', error);
      throw error;
    }
  });

  // Database: Get chapter timestamps for conflict detection
  ipcMain.handle('db:get-chapter-timestamps', async (_event, bookId: string) => {
    try {
      return await db.getChapterTimestamps(bookId);
    } catch (error) {
      console.error('[DB] Error getting chapter timestamps:', error);
      throw error;
    }
  });

  // Database: Sync entire book to database
  ipcMain.handle('db:sync-book-to-database', async (_event, params: {
    userId: string;
    book: any;
  }) => {
    try {
      return await db.syncBookToDatabase(params.userId, params.book);
    } catch (error) {
      console.error('[DB] Error syncing book:', error);
      throw error;
    }
  });

  // Database: Load book from database in app format
  ipcMain.handle('db:load-book-from-database', async (_event, bookId: string) => {
    try {
      return await db.loadBookFromDatabase(bookId);
    } catch (error) {
      console.error('[DB] Error loading book from database:', error);
      throw error;
    }
  });

  // Database: Get revision passes and completions for a book (e.g. after loading from file)
  ipcMain.handle('db:get-revision-data-for-book', async (_event, bookId: string) => {
    try {
      return await db.getRevisionDataForBook(bookId);
    } catch (error) {
      console.error('[DB] Error getting revision data for book:', error);
      throw error;
    }
  });

  // Database: Detect chapter conflicts
  ipcMain.handle('db:detect-chapter-conflicts', async (_event, params: {
    bookId: string;
    localChapters: any[];
  }) => {
    try {
      return await db.detectChapterConflicts(params.bookId, params.localChapters);
    } catch (error) {
      console.error('[DB] Error detecting conflicts:', error);
      throw error;
    }
  });

  // Database: Get variations for a chapter
  ipcMain.handle('db:get-variations-for-chapter', async (_event, chapterId: string) => {
    try {
      return await db.getVariationsForChapter(chapterId);
    } catch (error) {
      console.error('[DB] Error getting variations for chapter:', error);
      throw error;
    }
  });

  // Database: Add a chapter variation
  ipcMain.handle('db:add-chapter-variation', async (_event, chapterId: string, variation: any) => {
    try {
      await db.addChapterVariation(chapterId, variation);
    } catch (error) {
      console.error('[DB] Error adding chapter variation:', error);
      throw error;
    }
  });

  // Database: Delete a chapter variation
  ipcMain.handle('db:delete-chapter-variation', async (_event, variationId: string) => {
    try {
      await db.deleteChapterVariation(variationId);
    } catch (error) {
      console.error('[DB] Error deleting chapter variation:', error);
      throw error;
    }
  });

  // Database: Create revision pass
  ipcMain.handle('db:create-revision-pass', async (_event, params: { bookId: string; title: string; date: string }) => {
    try {
      return await db.createRevisionPass(params.bookId, {
        title: params.title,
        date: new Date(params.date),
      });
    } catch (error) {
      console.error('[DB] Error creating revision pass:', error);
      throw error;
    }
  });

  // Database: Set chapter completed for revision
  ipcMain.handle('db:set-chapter-completed-for-revision', async (_event, params: { chapterId: string; revisionId: string }) => {
    try {
      await db.setChapterCompletedForRevision(params.chapterId, params.revisionId);
    } catch (error) {
      console.error('[DB] Error setting chapter completed for revision:', error);
      throw error;
    }
  });

  // Database: Unset chapter completed for revision
  ipcMain.handle('db:unset-chapter-completed-for-revision', async (_event, params: { chapterId: string; revisionId: string }) => {
    try {
      await db.unsetChapterCompletedForRevision(params.chapterId, params.revisionId);
    } catch (error) {
      console.error('[DB] Error unsetting chapter completed for revision:', error);
      throw error;
    }
  });

  // Google API: Make authenticated PATCH request (to avoid CORS)
  ipcMain.handle('google:api-patch', async (_event, params: {
    url: string;
    accessToken: string;
    body: string;
    contentType?: string;
  }) => {
    return new Promise((resolve, reject) => {
      const url = new URL(params.url);
      const bodyBuffer = Buffer.from(params.body, 'utf-8');
      
      const req = https.request({
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${params.accessToken}`,
          'Content-Type': params.contentType || 'application/json',
          'Content-Length': bodyBuffer.length,
        },
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve(json);
            } else {
              reject(new Error(json.error?.message || json.error || `Request failed with status ${res.statusCode}`));
            }
          } catch (e) {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve(data);
            } else {
              reject(new Error(`Request failed: ${data}`));
            }
          }
        });
      });

      req.on('error', (e) => {
        reject(new Error(`Request failed: ${e.message}`));
      });

      req.write(bodyBuffer);
      req.end();
    });
  });
}

async function saveFileAs(data: string): Promise<string | null> {
  const result = await dialog.showSaveDialog({
    filters: [
      { name: 'Storybook Files', extensions: ['sbk'] },
    ],
    defaultPath: 'untitled.sbk',
  });

  if (result.canceled || !result.filePath) {
    return null;
  }

  try {
    // ATOMIC WRITE: Write to temp file first, then rename
    const tempPath = `${result.filePath}.tmp.${Date.now()}`;
    const buffer = Buffer.from(data, 'base64');
    
    // Create backup if overwriting an existing file (pass buffer for intelligent backup decision)
    await createBackup(result.filePath, buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
    
    // Write to temp file
    await fs.writeFile(tempPath, buffer);
    
    // Verify the temp file was written completely
    const stats = await fs.stat(tempPath);
    if (stats.size !== buffer.length) {
      await fs.unlink(tempPath).catch(() => {});
      throw new Error('File write verification failed - size mismatch');
    }
    
    // Atomic rename
    await fs.rename(tempPath, result.filePath);
    
    console.log(`[SaveAs] Saved ${path.basename(result.filePath)} (${buffer.length} bytes)`);
    return result.filePath;
  } catch (error) {
    console.error('Error saving file:', error);
    throw error;
  }
}

/**
 * Register app-audio:// protocol so the renderer can play exported MP3 files.
 * Call from main.ts in app.whenReady().
 */
export function registerAudioPlaybackProtocol(): void {
  protocol.registerBufferProtocol('app-audio', async (request, callback) => {
    try {
      const url = request.url;
      const match = /^app-audio:\/\/play\/([^/]+)/.exec(url);
      const token = match?.[1];
      if (!token) {
        callback({ error: -2 }); // NET_ERR_INVALID_URL
        return;
      }
      const filePath = audioPlaybackTokenToPath.get(token);
      if (!filePath) {
        callback({ error: -2 });
        return;
      }
      const buffer = await fs.readFile(filePath);
      callback({ mimeType: 'audio/mpeg', data: buffer });
    } catch (err) {
      console.error('[app-audio] Protocol error:', err);
      callback({ error: -2 });
    }
  });
}
