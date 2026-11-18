const { contextBridge, ipcRenderer } = require('electron');

// Exponer de forma segura variables o métodos necesarios para la app web en Electron
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true,
  // Métodos para el sistema de actualizaciones
  onUpdateAvailable: (callback) => ipcRenderer.on('update_available', (_event, value) => callback(value)),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update_downloaded', (_event, value) => callback(value)),
  restartApp: () => ipcRenderer.send('restart_app'),
});