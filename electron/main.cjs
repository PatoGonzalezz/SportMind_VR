const { app, BrowserWindow, shell, Menu, dialog, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('node:path');
const fs = require('node:fs');

// Configuración opcional de logs para electron-updater
autoUpdater.logger = require('electron-log');
autoUpdater.logger.transports.file.level = 'info';

// Evitar múltiples instancias que colisionen en el mismo puerto local
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

const isDev = process.env.NODE_ENV === 'development' || (!app.isPackaged && process.env.ELECTRON_DEV === '1');
const PREFERRED_PORT = 43123;
let localServerPort = PREFERRED_PORT;

function findFreePort(startPort) {
  return new Promise((resolve, reject) => {
    const net = require('node:net');
    const server = net.createServer();
    server.unref();
    server.on('error', () => resolve(findFreePort(startPort + 1)));
    server.listen(startPort, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

function getDistDirectory() {
  if (!app.isPackaged) {
    return path.join(__dirname, '..', 'dist');
  }
  const unpackedDist = path.join(process.resourcesPath, 'app.asar.unpacked', 'dist');
  if (fs.existsSync(unpackedDist)) {
    return unpackedDist;
  }
  return path.join(app.getAppPath(), 'dist');
}

function getAppIcon() {
  const candidates = [
    path.join(__dirname, '..', 'public', 'icon.ico'),
    path.join(__dirname, '..', 'public', 'icon.png'),
    path.join(getDistDirectory(), 'client', 'icon.ico'),
    path.join(getDistDirectory(), 'client', 'icon.png'),
  ];
  return candidates.find((p) => fs.existsSync(p));
}

async function waitForLocalServer(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.status >= 200 && res.status < 500) {
        return;
      }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error(`El servidor interno en ${url} no respondió en ${timeoutMs / 1000}s.`);
}

async function startAstroServer() {
  const distDirectory = getDistDirectory();
  const serverEntry = path.join(distDirectory, 'server', 'entry.mjs');

  if (!fs.existsSync(serverEntry)) {
    throw new Error(`No se encontró el servidor de Astro en: ${serverEntry}`);
  }

  process.env.HOST = '127.0.0.1';
  localServerPort = await findFreePort(PREFERRED_PORT);
  process.env.PORT = String(localServerPort);
  process.env.SPORTMIND_DIST_DIR = distDirectory;

  if (app.isPackaged) {
    const unpackedModules = path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules');
    if (fs.existsSync(unpackedModules)) {
      process.env.NODE_PATH = process.env.NODE_PATH
        ? `${unpackedModules}${path.delimiter}${process.env.NODE_PATH}`
        : unpackedModules;
      try {
        require('node:module').Module._initPaths();
      } catch { }
    }
  }

  await import(`${require('node:url').pathToFileURL(serverEntry).href}?${Date.now()}`);
  await waitForLocalServer(`http://127.0.0.1:${localServerPort}/`);
}

function createWindow() {
  const iconPath = getAppIcon();

  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 960,
    minHeight: 640,
    title: 'SportMind',
    backgroundColor: '#0b1120',
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    autoHideMenuBar: true,
    show: true,
  });

  mainWindow.setMenuBarVisibility(false);
  Menu.setApplicationMenu(null);

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error(`Fallo al cargar ${validatedURL}: [${errorCode}] ${errorDescription}`);
    if (!isDev && validatedURL.includes(String(localServerPort))) {
      setTimeout(() => {
        if (!mainWindow.isDestroyed()) {
          mainWindow.loadURL(`http://127.0.0.1:${localServerPort}/`);
        }
      }, 1000);
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    if (targetUrl.startsWith('http:') || targetUrl.startsWith('https:')) {
      shell.openExternal(targetUrl);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  if (isDev && process.env.ELECTRON_START_URL) {
    mainWindow.loadURL(process.env.ELECTRON_START_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadURL(`http://127.0.0.1:${localServerPort}/`);
  }
}

app.on('second-instance', () => {
  const win = BrowserWindow.getAllWindows()[0];
  if (win) {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  }
});

app.whenReady().then(async () => {
  try {
    if (!(isDev && process.env.ELECTRON_START_URL)) {
      await startAstroServer();
    }
    createWindow();

    // 🚀 Buscar actualizaciones automáticamente al iniciar en producción
    if (!isDev) {
      autoUpdater.checkForUpdatesAndNotify();
    }
  } catch (err) {
    console.error('Error crítico al iniciar:', err);
    dialog.showErrorBox(
      'Error al iniciar SportMind',
      `No se pudo iniciar el servicio interno de la aplicación:\n\n${err?.message || err}`
    );
    app.quit();
    return;
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Eventos de autoUpdater para notificar a la interfaz
autoUpdater.on('update-available', () => {
  const win = BrowserWindow.getAllWindows()[0];
  if (win) {
    win.webContents.send('update_available');
  }
});

autoUpdater.on('update-downloaded', () => {
  const win = BrowserWindow.getAllWindows()[0];
  if (win) {
    win.webContents.send('update_downloaded');
  }
});

// Escuchar la orden del frontend para reiniciar la app e instalar la actualización
ipcMain.on('restart_app', () => {
  autoUpdater.quitAndInstall();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});