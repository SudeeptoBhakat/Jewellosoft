const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    getApiUrl: () => ipcRenderer.invoke('get-api-url'),
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    printToPDF: (filename) => ipcRenderer.invoke('print-to-pdf', filename),
    backupDB: () => ipcRenderer.invoke('backup-db'),
    getLogPath: () => ipcRenderer.invoke('get-log-path'),
    openLogFolder: () => ipcRenderer.invoke('open-log-folder'),
    
    // ─── Auto-Updater IPC ────────────────────────────────────────
    // Events FROM main → renderer  (listeners)
    onUpdateAvailable:    (cb) => ipcRenderer.on('update-available',     (_e, info) => cb(info)),
    onUpdateNotAvailable: (cb) => ipcRenderer.on('update-not-available', ()         => cb()),
    onDownloadProgress:   (cb) => ipcRenderer.on('download-progress',    (_e, info) => cb(info)),
    onUpdateDownloaded:   (cb) => ipcRenderer.on('update-downloaded',    (_e, info) => cb(info)),
    onUpdateError:        (cb) => ipcRenderer.on('update-error',         (_e, info) => cb(info)),

    // Actions FROM renderer → main  (user-initiated)
    startDownload:    () => ipcRenderer.send('start-download'),
    installUpdate:    () => ipcRenderer.send('install-update'),
    checkForUpdates:  () => ipcRenderer.send('check-for-updates'),
});
