import { app, BrowserWindow, Menu, nativeImage } from 'electron';
import * as path from 'path';
import * as http from 'http';
import * as url from 'url';
import { setupIpcHandlers } from './ipc-handlers';
import { createApplicationMenu } from './menu';

let mainWindow: BrowserWindow | null = null;
let oauthServer: http.Server | null = null;

const isDev = process.env.NODE_ENV === 'development';

function createWindow(): void {
  // Get icon path - works for both dev and production
  const iconPath = isDev 
    ? path.join(__dirname, '../../assets/icon.png')
    : path.join(process.resourcesPath, 'assets/icon.png');

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 15, y: 15 },
    show: false,
  });

  // Set up the application menu
  const menu = createApplicationMenu(mainWindow);
  Menu.setApplicationMenu(menu);

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Set up IPC handlers
setupIpcHandlers();

// Start OAuth callback server
function startOAuthServer(): void {
  if (oauthServer) return; // Already running

  oauthServer = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url || '', true);
    
    if (parsedUrl.pathname === '/oauth2callback') {
      const code = parsedUrl.query.code as string;
      const error = parsedUrl.query.error as string;

      // Send response to browser
      res.writeHead(200, { 'Content-Type': 'text/html' });
      
      if (error) {
        res.end(`
          <html>
            <head><title>Authentication Failed</title></head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #1e1e2e; color: #cdd6f4;">
              <div style="text-align: center;">
                <h1 style="color: #f38ba8;">Authentication Failed</h1>
                <p>Error: ${error}</p>
                <p>You can close this window.</p>
              </div>
            </body>
          </html>
        `);
      } else if (code) {
        console.log('[OAuth] Received auth code, length:', code.length);
        
        res.end(`
          <html>
            <head><title>Authentication Successful</title></head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #1e1e2e; color: #cdd6f4;">
              <div style="text-align: center;">
                <h1 style="color: #a6e3a1;">✓ Authentication Successful</h1>
                <p>You can close this window and return to Storybook.</p>
                <script>
                  console.log('[OAuth Popup] Sending postMessage to opener');
                  // Try to send the code to the opener window
                  if (window.opener) {
                    window.opener.postMessage({ type: 'google-oauth-callback', code: '${code}' }, '*');
                    setTimeout(() => window.close(), 1000);
                  } else {
                    console.log('[OAuth Popup] No opener window found');
                  }
                </script>
              </div>
            </body>
          </html>
        `);

        // Send the code to ALL windows via IPC (more robust)
        const { BrowserWindow } = require('electron');
        const allWindows = BrowserWindow.getAllWindows();
        console.log('[OAuth] Sending code to', allWindows.length, 'window(s) via IPC');
        allWindows.forEach((win: any, index: number) => {
          if (!win.isDestroyed()) {
            console.log(`[OAuth] Sending to window ${index}`);
            win.webContents.send('google-oauth-callback', code);
          }
        });
        console.log('[OAuth] IPC messages sent');
      } else {
        res.end('<html><body>Invalid callback</body></html>');
      }
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  oauthServer.listen(4000, '127.0.0.1', () => {
    console.log('OAuth callback server listening on http://127.0.0.1:4000');
  });

  oauthServer.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.log('OAuth server port 4000 already in use, assuming another instance is handling callbacks');
    } else {
      console.error('OAuth server error:', err);
    }
  });
}

app.whenReady().then(() => {
  // Set dock icon on macOS
  if (process.platform === 'darwin') {
    const iconPath = isDev 
      ? path.join(__dirname, '../../assets/icon.png')
      : path.join(process.resourcesPath, 'assets/icon.png');
    
    console.log('Icon path:', iconPath);
    console.log('Icon exists:', require('fs').existsSync(iconPath));
    
    try {
      const icon = nativeImage.createFromPath(iconPath);
      console.log('Icon empty?', icon.isEmpty());
      console.log('Icon size:', icon.getSize());
      if (!icon.isEmpty()) {
        app.dock.setIcon(icon);
        console.log('Dock icon set successfully');
      } else {
        console.log('Icon is empty, file may not exist or be invalid');
      }
    } catch (e) {
      console.log('Could not set dock icon:', e);
    }
  }

  createWindow();
  startOAuthServer();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  // Clean up OAuth server
  if (oauthServer) {
    oauthServer.close();
    oauthServer = null;
  }
});

// Export for use in other modules
export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

