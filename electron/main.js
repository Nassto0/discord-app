const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, shell } = require('electron');
const path = require('path');

let mainWindow;
let tray;

const isDev = process.argv.includes('--dev');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 380,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#09090b',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    icon: path.join(__dirname, 'icon.png'),
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the deployed web app
    mainWindow.loadURL('https://nasscord.vercel.app');
  }

  // Open external links in the default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Grant media permissions automatically (mic/camera for calls)
  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowed = ['media', 'mediaKeySystem', 'notifications', 'fullscreen'];
    callback(allowed.includes(permission));
  });

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  const iconPath = path.join(__dirname, 'icon.png');
  let icon;
  try {
    icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  } catch {
    icon = nativeImage.createEmpty();
  }
  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show Nasscord', click: () => mainWindow.show() },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip('Nasscord');
  tray.setContextMenu(contextMenu);
  tray.on('click', () => mainWindow.show());
}

// IPC handlers for custom titlebar
ipcMain.on('window:minimize', () => mainWindow?.minimize());
ipcMain.on('window:maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.on('window:close', () => {
  mainWindow?.hide();
});

// IPC handlers for zoom (uses Chromium's native zoom which scales everything uniformly)
ipcMain.on('zoom:in', () => {
  if (!mainWindow) return;
  const wc = mainWindow.webContents;
  wc.setZoomLevel(wc.getZoomLevel() + 0.5);
});
ipcMain.on('zoom:out', () => {
  if (!mainWindow) return;
  const wc = mainWindow.webContents;
  wc.setZoomLevel(wc.getZoomLevel() - 0.5);
});
ipcMain.on('zoom:reset', () => {
  if (!mainWindow) return;
  mainWindow.webContents.setZoomLevel(0);
});

app.whenReady().then(() => {
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else mainWindow.show();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
