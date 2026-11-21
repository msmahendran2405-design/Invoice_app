const { contextBridge } = require('electron');

// Expose minimal API to renderer
contextBridge.exposeInMainWorld('electron', {
  platform: process.platform,
});
