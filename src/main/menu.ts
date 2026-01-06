import { Menu, BrowserWindow, MenuItemConstructorOptions, app } from 'electron';

export function createApplicationMenu(mainWindow: BrowserWindow): Menu {
  const isMac = process.platform === 'darwin';

  const template: MenuItemConstructorOptions[] = [
    // App menu (macOS only)
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              {
                label: 'Settings...',
                accelerator: 'CmdOrCtrl+,',
                click: () => mainWindow.webContents.send('menu:settings'),
              },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),

    // File menu
    {
      label: 'File',
      submenu: [
        {
          label: 'New',
          accelerator: 'CmdOrCtrl+N',
          click: () => mainWindow.webContents.send('menu:new'),
        },
        {
          label: 'Open...',
          accelerator: 'CmdOrCtrl+O',
          click: () => mainWindow.webContents.send('menu:open'),
        },
        { type: 'separator' },
        {
          label: 'Import',
          submenu: [
            {
              label: 'Import from Google Docs...',
              click: () => mainWindow.webContents.send('menu:import-google-docs'),
            },
          ],
        },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow.webContents.send('menu:save'),
        },
        {
          label: 'Save As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => mainWindow.webContents.send('menu:save-as'),
        },
        { type: 'separator' },
        {
          label: 'Export',
          submenu: [
            {
              label: 'Export to Google Docs...',
              click: () => mainWindow.webContents.send('menu:export-google-docs'),
            },
            { type: 'separator' },
            {
              label: 'Export as DOCX...',
              click: () => mainWindow.webContents.send('menu:export-docx'),
            },
            {
              label: 'Export as PDF...',
              click: () => mainWindow.webContents.send('menu:export-pdf'),
            },
          ],
        },
        { type: 'separator' },
        {
          label: 'Sync with Google Docs...',
          accelerator: 'CmdOrCtrl+Shift+G',
          click: () => mainWindow.webContents.send('menu:sync-google-docs'),
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },

    // Edit menu
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(isMac
          ? [
              { role: 'pasteAndMatchStyle' as const },
              { role: 'delete' as const },
              { role: 'selectAll' as const },
            ]
          : [
              { role: 'delete' as const },
              { type: 'separator' as const },
              { role: 'selectAll' as const },
            ]),
        { type: 'separator' },
        {
          label: 'Find',
          accelerator: 'CmdOrCtrl+F',
          click: () => mainWindow.webContents.send('menu:find'),
        },
        {
          label: 'Replace',
          accelerator: 'CmdOrCtrl+H',
          click: () => mainWindow.webContents.send('menu:replace'),
        },
      ],
    },

    // View menu
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        {
          label: 'Zoom In',
          accelerator: 'CmdOrCtrl+Plus',
          click: () => mainWindow.webContents.send('menu:zoom-in'),
        },
        {
          label: 'Zoom Out',
          accelerator: 'CmdOrCtrl+-',
          click: () => mainWindow.webContents.send('menu:zoom-out'),
        },
        {
          label: 'Reset Zoom',
          accelerator: 'CmdOrCtrl+0',
          click: () => mainWindow.webContents.send('menu:zoom-reset'),
        },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { type: 'separator' },
        {
          label: 'Toggle Chapters Panel',
          accelerator: 'CmdOrCtrl+1',
          click: () => mainWindow.webContents.send('menu:toggle-chapters'),
        },
        {
          label: 'Toggle AI Panel',
          accelerator: 'CmdOrCtrl+2',
          click: () => mainWindow.webContents.send('menu:toggle-ai'),
        },
      ],
    },

    // AI menu
    {
      label: 'AI',
      submenu: [
        {
          label: 'Analyze Chapter',
          click: () => mainWindow.webContents.send('menu:ai-analyze'),
        },
        {
          label: 'Summarize Chapter',
          click: () => mainWindow.webContents.send('menu:ai-summarize'),
        },
        { type: 'separator' },
        {
          label: 'Extract Characters',
          click: () => mainWindow.webContents.send('menu:ai-extract-characters'),
        },
        {
          label: 'Extract Locations',
          click: () => mainWindow.webContents.send('menu:ai-extract-locations'),
        },
        {
          label: 'Extract Timeline',
          click: () => mainWindow.webContents.send('menu:ai-extract-timeline'),
        },
        { type: 'separator' },
        {
          label: 'Check Grammar & Style',
          click: () => mainWindow.webContents.send('menu:ai-grammar'),
        },
      ],
    },

    // Window menu
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? [
              { type: 'separator' as const },
              { role: 'front' as const },
              { type: 'separator' as const },
              { role: 'window' as const },
            ]
          : [{ role: 'close' as const }]),
      ],
    },

    // Help menu
    {
      role: 'help',
      submenu: [
        {
          label: 'Documentation',
          click: async () => {
            const { shell } = await import('electron');
            await shell.openExternal('https://github.com/your-repo/storybook-editor');
          },
        },
      ],
    },
  ];

  return Menu.buildFromTemplate(template);
}

