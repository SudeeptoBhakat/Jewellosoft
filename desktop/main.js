const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const os = require('os');
const { autoUpdater } = require('electron-updater');
const electronLog = require('electron-log');

// Single Instance Lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit();
}

// Silence noisy Chromium console warnings automatically in development
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

let mainWindow;
let splashWindow;
let djangoProcess;
let djangoPort = 8000;
let isDev = !app.isPackaged;

// ─────────────────────────────────────────────────────────────────
// Production-Grade Date-wise Logging System
// ─────────────────────────────────────────────────────────────────

const userDataPath = path.join(app.getPath('userData'), 'JewelloSoft_Data');
if (!fs.existsSync(userDataPath)) {
  fs.mkdirSync(userDataPath, { recursive: true });
}

const logBasePath = path.join(userDataPath, 'logs');
if (!fs.existsSync(logBasePath)) {
  fs.mkdirSync(logBasePath, { recursive: true });
}

/**
 * Returns today's date string in YYYY-MM-DD format.
 */
function getDateStamp() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Returns the log directory for today, creating it if needed.
 * Structure: logs/2026-04-02/
 */
function getTodayLogDir() {
  const dir = path.join(logBasePath, getDateStamp());
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Get the full path for a specific log file for today.
 * @param {string} name - e.g. 'electron', 'backend-stdout', 'backend-stderr', 'crash'
 * @returns {string} Full path to the log file
 */
function getLogFile(name) {
  return path.join(getTodayLogDir(), `${name}.log`);
}

/**
 * Append a timestamped message to a specific log file.
 * @param {string} logName - Name of the log category
 * @param {string} msg - Message to log
 */
function logTo(logName, msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}\n`;
  try {
    fs.appendFileSync(getLogFile(logName), line);
  } catch (e) {
    // Last resort — if we can't even write a log, try console
    console.error(`Failed to write to ${logName} log:`, e.message);
  }
  console.log(`[${logName}] ${msg}`);
}

/** Shorthand for the main electron process log */
function log(msg) {
  logTo('electron', msg);
}

/**
 * Capture a full crash diagnostic snapshot and write to crash log.
 * Returns the snapshot text so crash.html can display it.
 */
function writeCrashDiagnostic(reason, error) {
  const diag = [];
  diag.push('═══════════════════════════════════════════════════════');
  diag.push('  JEWELLOSOFT CRASH DIAGNOSTIC REPORT');
  diag.push('═══════════════════════════════════════════════════════');
  diag.push(`  Timestamp     : ${new Date().toISOString()}`);
  diag.push(`  App Version   : ${app.getVersion()}`);
  diag.push(`  Environment   : ${isDev ? 'DEVELOPMENT' : 'PRODUCTION'}`);
  diag.push(`  Platform      : ${process.platform} ${os.release()} (${os.arch()})`);
  diag.push(`  Node Version  : ${process.version}`);
  diag.push(`  Electron      : ${process.versions.electron}`);
  diag.push(`  User Data     : ${userDataPath}`);
  diag.push(`  Resources Path: ${process.resourcesPath || 'N/A'}`);
  diag.push('───────────────────────────────────────────────────────');
  diag.push(`  Failure Reason: ${reason}`);

  if (error) {
    diag.push(`  Error Message : ${error.message || error}`);
    if (error.stack) {
      diag.push(`  Stack Trace   :`);
      error.stack.split('\n').forEach(l => diag.push(`    ${l.trim()}`));
    }
    if (error.code) diag.push(`  Error Code    : ${error.code}`);
    if (error.errno) diag.push(`  Errno         : ${error.errno}`);
    if (error.syscall) diag.push(`  Syscall       : ${error.syscall}`);
    if (error.path) diag.push(`  Path          : ${error.path}`);
  }

  // Check backend exe existence
  const backendExePath = isDev
    ? path.join(__dirname, '../backend/dist/backend/backend.exe')
    : path.join(process.resourcesPath, 'backend', 'backend.exe');
  diag.push('───────────────────────────────────────────────────────');
  diag.push(`  Backend Path  : ${backendExePath}`);
  diag.push(`  Backend Exists: ${fs.existsSync(backendExePath)}`);

  // Check resources directory contents
  try {
    const resDir = isDev ? path.join(__dirname, '..') : process.resourcesPath;
    const contents = fs.readdirSync(resDir);
    diag.push(`  Resources Dir : ${resDir}`);
    diag.push(`  Dir Contents  : ${contents.join(', ')}`);
  } catch (e) {
    diag.push(`  Resources Dir : ERROR reading — ${e.message}`);
  }

  diag.push('───────────────────────────────────────────────────────');
  diag.push(`  Django Port   : ${djangoPort}`);
  diag.push(`  Log Dir       : ${getTodayLogDir()}`);
  diag.push('═══════════════════════════════════════════════════════');

  const text = diag.join('\n');
  logTo('crash', text);
  return text;
}

/**
 * Purge logs older than 14 days to prevent disk bloat.
 */
function purgeOldLogs() {
  try {
    const entries = fs.readdirSync(logBasePath, { withFileTypes: true });
    const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      // Only process date-format dirs like 2026-04-02
      if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.name)) continue;
      const dirDate = new Date(entry.name + 'T00:00:00');
      if (isNaN(dirDate.getTime())) continue;
      if (dirDate.getTime() < cutoff) {
        const dirPath = path.join(logBasePath, entry.name);
        fs.rmSync(dirPath, { recursive: true, force: true });
        log(`Purged old log directory: ${entry.name}`);
      }
    }
  } catch (e) {
    log(`Log purge failed (non-critical): ${e.message}`);
  }
}

// ─────────────────────────────────────────────────────────────────
// System diagnostics logged once at startup
// ─────────────────────────────────────────────────────────────────

function logSystemInfo() {
  log('──── JewelloSoft Startup ────');
  log(`App Version   : ${app.getVersion()}`);
  log(`Environment   : ${isDev ? 'DEVELOPMENT' : 'PRODUCTION'}`);
  log(`Platform      : ${process.platform} ${os.release()} (${os.arch()})`);
  log(`Node          : ${process.version}`);
  log(`Electron      : ${process.versions.electron}`);
  log(`User Data Path: ${userDataPath}`);
  log(`Resources     : ${process.resourcesPath || 'N/A (dev)'}`);
  log(`Working Dir   : ${process.cwd()}`);
  log(`Exe Path      : ${app.getPath('exe')}`);
  log(`Log Directory : ${getTodayLogDir()}`);
  log('─────────────────────────────');
}

// ─────────────────────────────────────────────────────────────────
// Splash Screen (shown while backend starts)
// ─────────────────────────────────────────────────────────────────

function createSplash() {
  splashWindow = new BrowserWindow({
    width: 420,
    height: 320,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  const splashPath = path.join(__dirname, 'splash.html');
  if (fs.existsSync(splashPath)) {
    splashWindow.loadFile(splashPath);
  } else {
    // Inline fallback if splash.html not bundled
    splashWindow.loadURL(`data:text/html;charset=utf-8,
      <html>
      <body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;
        background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);font-family:Segoe UI,sans-serif;
        border-radius:16px;overflow:hidden;-webkit-app-region:drag;">
        <div style="text-align:center;color:white;">
          <div style="font-size:28px;font-weight:700;letter-spacing:1px;margin-bottom:12px;">JewelloSoft</div>
          <div style="font-size:13px;color:#94a3b8;">Starting services...</div>
          <div style="margin-top:20px;width:40px;height:40px;border:3px solid #334155;border-top-color:#3b82f6;
            border-radius:50%;animation:spin 0.8s linear infinite;margin-left:auto;margin-right:auto;"></div>
        </div>
      </body>
      <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
      </html>
    `);
  }

  splashWindow.center();
}

function closeSplash() {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close();
    splashWindow = null;
  }
}

// ─────────────────────────────────────────────────────────────────
// Networking Helpers
// ─────────────────────────────────────────────────────────────────

function findOpenPort(startPort) {
  return new Promise((resolve, reject) => {
    const server = require('net').createServer();
    server.listen(startPort, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(findOpenPort(startPort + 1));
      } else {
        reject(err);
      }
    });
  });
}

function waitForBackend(port, retries = 30) {
  return new Promise((resolve, reject) => {
    let attempt = 0;
    const check = () => {
      attempt++;
      log(`Health check attempt ${attempt}/${retries + attempt - 1} → http://127.0.0.1:${port}/api/health/`);
      http.get(`http://127.0.0.1:${port}/api/health/`, (res) => {
        if (res.statusCode === 200) {
          log(`Backend health check PASSED (status 200)`);
          resolve();
        } else {
          log(`Backend health check returned status ${res.statusCode}`);
          retry();
        }
      }).on('error', (err) => {
        log(`Health check error: ${err.message}`);
        retry();
      });
    };

    const retry = () => {
      if (retries <= 0) {
        const msg = `Backend did not respond after ${attempt} health check attempts (30s timeout)`;
        log(msg);
        reject(new Error(msg));
        return;
      }
      retries--;
      setTimeout(check, 1000);
    };

    check();
  });
}

// ─────────────────────────────────────────────────────────────────
// Window Creation
// ─────────────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    show: false,
    icon: isDev
      ? path.join(__dirname, '../frontend/src/assets/icons/b503ee48-1ece-4256-8ef5-72c1d9f0a8de.png')
      : path.join(__dirname, 'build/icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.removeMenu();

  const indexPath = isDev
    ? path.join(__dirname, '../frontend/dist/index.html')
    : path.join(process.resourcesPath, 'frontend/index.html');

  log(`Loading frontend from: ${indexPath}`);
  log(`Frontend exists: ${fs.existsSync(indexPath)}`);

  mainWindow.loadFile(indexPath);

  mainWindow.once('ready-to-show', () => {
    closeSplash();
    mainWindow.maximize();
    mainWindow.show();
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ─────────────────────────────────────────────────────────────────
// Backend (Django) Lifecycle
// ─────────────────────────────────────────────────────────────────

let backendRetries = 0;
const MAX_BACKEND_RETRIES = 2;

function startDjango() {
  log(`Starting backend. Environment: ${isDev ? 'DEV' : 'PROD'}`);
  return findOpenPort(8000).then(port => {
    djangoPort = port;
    log(`Selected Django Port: ${djangoPort}`);

    const backendPath = isDev
      ? path.join(__dirname, '../backend/dist/backend/backend.exe')
      : path.join(process.resourcesPath, 'backend', 'backend.exe')

    log(`Resolved backend path: ${backendPath}`);

    // FAIL-SAFE: Startup validation
    if (!fs.existsSync(backendPath)) {
      const msg = `Backend executable NOT FOUND at: ${backendPath}`;
      log(msg);
      writeCrashDiagnostic('Backend executable missing', new Error(msg));
      dialog.showErrorBox(
        "Startup Error",
        `Backend service missing at:\n${backendPath}\n\nPlease reinstall the application.\n\nCheck logs at:\n${getTodayLogDir()}`
      );
      app.quit();
      return Promise.reject(new Error(msg));
    }

    // Log file size to verify it's a real binary
    try {
      const stat = fs.statSync(backendPath);
      log(`Backend file size: ${(stat.size / 1024 / 1024).toFixed(2)} MB`);
    } catch (e) {
      log(`Could not stat backend: ${e.message}`);
    }

    // Environment variables for Django
    const env = {
      ...process.env,
      'JEWELLOSOFT_DESKTOP': '1',
      'JEWELLOSOFT_DATA_PATH': userDataPath,
      'PYTHONIOENCODING': 'utf-8'
    };

    log(`Starting backend process: "${backendPath}" ${djangoPort}`);
    log(`Backend CWD: ${path.dirname(backendPath)}`);
    log(`JEWELLOSOFT_DATA_PATH: ${userDataPath}`);

    // Create separate write streams for backend stdout and stderr
    const stdoutStream = fs.createWriteStream(getLogFile('backend-stdout'), { flags: 'a' });
    const stderrStream = fs.createWriteStream(getLogFile('backend-stderr'), { flags: 'a' });

    const header = `\n${'='.repeat(60)}\n  Backend started at ${new Date().toISOString()}\n  Port: ${djangoPort}\n${'='.repeat(60)}\n`;
    stdoutStream.write(header);
    stderrStream.write(header);

    djangoProcess = spawn(backendPath, [djangoPort.toString()], {
      cwd: path.dirname(backendPath),
      windowsHide: true,
      env: env
    });

    log(`Backend process spawned with PID: ${djangoProcess.pid}`);

    // Pipe to both log files and capture in electron log
    djangoProcess.stdout.on('data', (data) => {
      const text = data.toString().trim();
      if (text) {
        logTo('electron', `[backend:stdout] ${text}`);
        stdoutStream.write(`[${new Date().toISOString()}] ${text}\n`);
      }
    });

    djangoProcess.stderr.on('data', (data) => {
      const text = data.toString().trim();
      if (text) {
        logTo('electron', `[backend:stderr] ${text}`);
        stderrStream.write(`[${new Date().toISOString()}] ${text}\n`);
      }
    });

    djangoProcess.on('error', (err) => {
      const msg = `Backend spawn error: ${err.message} (code: ${err.code || 'N/A'})`;
      log(msg);
      writeCrashDiagnostic('Backend spawn failed', err);
    });

    djangoProcess.on('close', (code, signal) => {
      log(`Backend process exited — code: ${code}, signal: ${signal}`);
      stdoutStream.end();
      stderrStream.end();

      if (code !== 0 && code !== null) {
        writeCrashDiagnostic(
          `Backend crashed with exit code ${code}`,
          new Error(`Process terminated unexpectedly. Exit code: ${code}, Signal: ${signal}`)
        );

        // Auto-retry logic
        if (backendRetries < MAX_BACKEND_RETRIES) {
          backendRetries++;
          log(`Auto-retrying backend start (attempt ${backendRetries}/${MAX_BACKEND_RETRIES})...`);
          startDjango()
            .then(() => {
              log(`Backend recovered on retry ${backendRetries}`);
            })
            .catch((retryErr) => {
              log(`Backend retry ${backendRetries} failed: ${retryErr.message}`);
              showCrashWindow(`Backend failed after ${backendRetries} retries`);
            });
          return;
        }

        showCrashWindow(`Backend crashed with exit code ${code}`);
      }
    });

    return waitForBackend(djangoPort);
  });
}

/**
 * Show crash.html with diagnostic info embedded.
 */
function showCrashWindow(reason) {
  const todayDir = getTodayLogDir();
  const crashLogPath = getLogFile('crash');
  const electronLogPath = getLogFile('electron');
  const stderrLogPath = getLogFile('backend-stderr');

  // Read the last few lines of logs for display
  let recentErrors = '';
  try {
    if (fs.existsSync(stderrLogPath)) {
      const content = fs.readFileSync(stderrLogPath, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());
      recentErrors = lines.slice(-30).join('\n');
    }
  } catch (e) { /* ignore */ }

  let recentElectronLog = '';
  try {
    if (fs.existsSync(electronLogPath)) {
      const content = fs.readFileSync(electronLogPath, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());
      recentElectronLog = lines.slice(-30).join('\n');
    }
  } catch (e) { /* ignore */ }

  // If mainWindow exists, navigate it. Otherwise create a new one.
  const targetWindow = mainWindow || new BrowserWindow({
    width: 800,
    height: 650,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  if (!mainWindow) mainWindow = targetWindow;

  targetWindow.loadFile(path.join(__dirname, 'crash.html'));
  targetWindow.show();
  targetWindow.center();

  // Send diagnostic data to crash page once it loads
  targetWindow.webContents.on('did-finish-load', () => {
    targetWindow.webContents.executeJavaScript(`
      try {
        document.getElementById('crash-reason').textContent = ${JSON.stringify(reason)};
        document.getElementById('log-dir').textContent = ${JSON.stringify(todayDir)};
        document.getElementById('stderr-log').textContent = ${JSON.stringify(recentErrors || 'No stderr output captured')};
        document.getElementById('electron-log').textContent = ${JSON.stringify(recentElectronLog || 'No electron log captured')};
        document.getElementById('diagnostics').style.display = 'block';
      } catch(e) { console.error('Crash page injection error', e); }
    `);
  });
}

// ─────────────────────────────────────────────────────────────────
// App Lifecycle
// ─────────────────────────────────────────────────────────────────

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.on('ready', async () => {
  logSystemInfo();
  purgeOldLogs();

  createSplash();

  try {
    await startDjango();
    createWindow();

    // ─── Electron-level CSP override (production-safe) ───────────
    const { session } = require('electron');
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      const csp = [
        "default-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com https://cdnjs.cloudflare.com",
        "script-src 'self' 'unsafe-inline'",
        "connect-src 'self' http://127.0.0.1:* ws://localhost:* https://*.supabase.co",
        "img-src 'self' data: https: http://127.0.0.1:*",
        "font-src 'self' data: https://fonts.gstatic.com https://cdnjs.cloudflare.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com"
      ].join('; ');

      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [csp]
        }
      });
    });

    if (!isDev) {
      autoUpdater.checkForUpdatesAndNotify();
    }

    log('Application started successfully');
  } catch (err) {
    log(`Fatal Error starting app: ${err.message}`);
    if (err.stack) log(`Stack: ${err.stack}`);
    writeCrashDiagnostic('Fatal startup error', err);
    closeSplash();
    showCrashWindow(err.message);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  log('Application shutting down...');
  if (djangoProcess) {
    log(`Killing backend process tree (PID: ${djangoProcess.pid})`);
    killProcessTree(djangoProcess.pid);
  }
  log('Shutdown complete');
});

// Catch uncaught exceptions and unhandled rejections
process.on('uncaughtException', (err) => {
  logTo('crash', `UNCAUGHT EXCEPTION: ${err.message}\n${err.stack}`);
  writeCrashDiagnostic('Uncaught Exception', err);
});

process.on('unhandledRejection', (reason) => {
  const errMsg = reason instanceof Error ? `${reason.message}\n${reason.stack}` : String(reason);
  logTo('crash', `UNHANDLED REJECTION: ${errMsg}`);
  writeCrashDiagnostic('Unhandled Promise Rejection', reason instanceof Error ? reason : new Error(String(reason)));
});

// Windows specific tree killer for child processes
function killProcessTree(pid) {
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', pid, '/f', '/t']);
  } else {
    process.kill(-pid, 'SIGKILL');
  }
}

// ─────────────────────────────────────────────────────────────────
// Auto Updater Configurations & Handlers
// ─────────────────────────────────────────────────────────────────

electronLog.transports.file.resolvePathFn = () => path.join(getTodayLogDir(), 'electron-updater.log');
autoUpdater.logger = electronLog;
autoUpdater.logger.transports.file.level = 'info';
autoUpdater.autoDownload = true;

autoUpdater.on('update-available', (info) => {
  electronLog.info('Update available.');
  log(`Update available: ${JSON.stringify(info)}`);
  if (mainWindow) mainWindow.webContents.send('update-available', info);
});

autoUpdater.on('download-progress', (progressObj) => {
  if (mainWindow) mainWindow.webContents.send('download-progress', progressObj);
});

autoUpdater.on('update-downloaded', (info) => {
  electronLog.info('Update downloaded.');
  log(`Update downloaded: ${JSON.stringify(info)}`);
  if (mainWindow) mainWindow.webContents.send('update-downloaded', info);
});

autoUpdater.on('error', (err) => {
  electronLog.error(`AutoUpdater Error: ${err.message}`);
  log(`AutoUpdater Error: ${err.message}`);
});

ipcMain.on('install-update', () => {
  autoUpdater.quitAndInstall();
});

// ─────────────────────────────────────────────────────────────────
// IPC API Handlers
// ─────────────────────────────────────────────────────────────────

ipcMain.handle('get-api-url', () => {
  return `http://127.0.0.1:${djangoPort}/api`;
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('get-log-path', () => {
  return getTodayLogDir();
});

ipcMain.handle('open-log-folder', () => {
  const dir = getTodayLogDir();
  shell.openPath(dir);
  return dir;
});

// PDF Generation using native electron webContents
ipcMain.handle('print-to-pdf', async (event, filename) => {
  try {
    const win = BrowserWindow.fromWebContents(event.sender);
    const pdfData = await win.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: { top: 0, bottom: 0, left: 0, right: 0 }
    });

    const defaultPath = path.join(app.getPath('documents'), filename || 'Invoice.pdf');
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: 'Save PDF',
      defaultPath: defaultPath,
      filters: [{ name: 'PDF Documents', extensions: ['pdf'] }]
    });

    if (!canceled && filePath) {
      fs.writeFileSync(filePath, pdfData);
      shell.openPath(filePath);
      return { success: true, path: filePath };
    }
    return { success: false, reason: 'canceled' };
  } catch (error) {
    log(`PDF Print Error: ${error.message}`);
    return { success: false, error: error.message };
  }
});

// Backup System Setup (Offline-Friendly Feature)
ipcMain.handle('backup-db', async (event) => {
  try {
    const sourcePath = path.join(userDataPath, 'db.sqlite3');
    const defaultPath = path.join(app.getPath('downloads'), `JewelloSoft_Backup_${Date.now()}.sqlite3`);

    const win = BrowserWindow.fromWebContents(event.sender);
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: 'Export Database Backup',
      defaultPath: defaultPath,
      filters: [{ name: 'SQLite Database', extensions: ['sqlite3'] }]
    });

    if (!canceled && filePath) {
      fs.copyFileSync(sourcePath, filePath);
      return { success: true, path: filePath };
    }
    return { success: false, reason: 'canceled' };
  } catch (error) {
    log(`Backup Error: ${error.message}`);
    return { success: false, error: error.message };
  }
});
