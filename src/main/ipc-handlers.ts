import { ipcMain, dialog, app } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import Store from 'electron-store';
import * as https from 'https';

const store = new Store();

// Google OAuth Token URL
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const OAUTH_PORT = 4000;
const REDIRECT_URI = `http://127.0.0.1:${OAUTH_PORT}/oauth2callback`;

export function setupIpcHandlers(): void {
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
      const buffer = Buffer.from(data, 'base64');
      await fs.writeFile(filePath, buffer);
      return filePath;
    } catch (error) {
      console.error('Error saving file:', error);
      throw error;
    }
  });

  // File: Save As
  ipcMain.handle('file:save-as', async (_event, data: string) => {
    return await saveFileAs(data);
  });

  // Export: DOCX
  ipcMain.handle('file:export-docx', async (_event, data: string) => {
    const result = await dialog.showSaveDialog({
      filters: [
        { name: 'Word Document', extensions: ['docx'] },
      ],
      defaultPath: 'manuscript.docx',
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

  // Export: PDF
  ipcMain.handle('file:export-pdf', async (_event, data: string) => {
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
      const buffer = Buffer.from(data, 'base64');
      await fs.writeFile(result.filePath, buffer);
      return result.filePath;
    } catch (error) {
      console.error('Error exporting PDF:', error);
      throw error;
    }
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
    const buffer = Buffer.from(data, 'base64');
    await fs.writeFile(result.filePath, buffer);
    return result.filePath;
  } catch (error) {
    console.error('Error saving file:', error);
    throw error;
  }
}

