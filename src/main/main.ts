import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { createWindow } from './window';
import {
  saveProject,
  loadProject,
  showSaveDialog,
  showOpenDialog,
  ProjectData,
} from './file-handler';

let mainWindow: BrowserWindow | null = null;

// Hot reload for main process is handled by webpack watch mode
// When main process files change, webpack rebuilds and Electron needs to be restarted manually
// For automatic restart, use nodemon or similar tool

app.whenReady().then(() => {
  mainWindow = createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC handlers
ipcMain.handle('save-project', async (_, filePath: string, data: ProjectData) => {
  await saveProject(filePath, data);
});

ipcMain.handle('load-project', async (_, filePath: string) => {
  return await loadProject(filePath);
});

ipcMain.handle('show-save-dialog', async () => {
  return await showSaveDialog();
});

ipcMain.handle('show-open-dialog', async () => {
  return await showOpenDialog();
});
