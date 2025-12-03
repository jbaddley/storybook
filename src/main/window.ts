import { BrowserWindow } from 'electron';
import * as path from 'path';

export function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false, // Don't show until ready
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Open DevTools to see any errors
  mainWindow.webContents.openDevTools();

  if (process.env.NODE_ENV === 'development') {
    // In development, load from webpack-dev-server
    mainWindow.loadURL('http://localhost:3000').catch((err) => {
      console.error('Failed to load from dev server:', err);
      // Fallback to file if dev server isn't ready
      setTimeout(() => {
        mainWindow?.loadURL('http://localhost:3000');
      }, 1000);
    });
  } else {
    const htmlPath = path.join(__dirname, '../renderer/index.html');
    console.log('Loading HTML from:', htmlPath);
    mainWindow.loadFile(htmlPath).catch((err) => {
      console.error('Error loading file:', err);
    });
  }

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription);
  });

  mainWindow.once('ready-to-show', () => {
    console.log('Window ready to show');
    mainWindow.show();
  });

  return mainWindow;
}
