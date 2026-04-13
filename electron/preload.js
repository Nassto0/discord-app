const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
  webContents: {
    zoomIn: () => ipcRenderer.send('zoom:in'),
    zoomOut: () => ipcRenderer.send('zoom:out'),
    zoomReset: () => ipcRenderer.send('zoom:reset'),
  },
});
