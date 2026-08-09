'use strict';

const { app, BrowserWindow, ipcMain, session, shell, webContents } = require('electron');
const { spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  DEFAULT_ALLOWED_SITES,
  normalizeHostname,
  normalizeAllowedList,
  isAllowedNavigationUrl,
  isAllowedRequestUrl,
  isGoogleAuthUrl
} = require('./policy');

app.commandLine.appendSwitch('disable-extensions');
app.commandLine.appendSwitch('disable-component-extensions-with-background-pages');

const STUDY_PARTITION = 'persist:study';
const TOKEN_TTL_MS = 15 * 60 * 1000;
// Matches the "appId" used by electron-builder so Windows groups the taskbar
// icon, notifications, and default-browser registration under one identity.
const APP_ID = 'com.dfbrowse.app';

let config;
let configPath;
const authTokens = new Map();

// URL handed to the OS (e.g. a clicked link) that still needs to be routed to
// the renderer once the shell window has finished loading.
let pendingExternalUrl = null;

function now() {
  return Date.now();
}

function extractUrlFromArgs(argv) {
  if (!Array.isArray(argv)) return null;
  for (const arg of argv) {
    if (typeof arg !== 'string') continue;
    const trimmed = arg.trim();
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
  }
  return null;
}

function focusMainWindow() {
  const win = BrowserWindow.getAllWindows()[0];
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

// Route an externally-opened URL (link click, command line) into the webview.
function routeExternalUrl(url) {
  if (!url) return;
  const win = BrowserWindow.getAllWindows()[0];
  if (!win || !win.webContents || win.webContents.isDestroyed()) {
    pendingExternalUrl = url;
    return;
  }
  const shellReady = win.webContents.getURL().startsWith('file://') && !win.webContents.isLoadingMainFrame();
  if (!shellReady) {
    pendingExternalUrl = url;
    return;
  }
  win.webContents.send('app:openUrl', url);
}

function sourceUrlForContents(contents) {
  try {
    if (contents && !contents.isDestroyed()) {
      const url = contents.getURL();
      if (url && /^https?:\/\//i.test(url)) return url;
    }
  } catch {
    // The guest contents can disappear while a popup is being created.
  }
  return null;
}

function externalAuthTarget(authUrl, sourceUrl) {
  // Opening the page that started the sign-in flow is more reliable than
  // opening Google's intermediate URL: the normal browser then creates its
  // own cookies and OAuth state before the user clicks Sign in.  Without this
  // step the state cookie would remain in the Electron partition and the
  // callback could fail even though Google sign-in itself succeeded.
  if (sourceUrl && !isGoogleAuthUrl(sourceUrl) && isAllowedNavigationUrl(sourceUrl, config.allowedSites)) {
    return sourceUrl;
  }
  return authUrl;
}

function isDfbrowseDefaultBrowser() {
  if (process.platform !== 'win32') return false;
  try {
    return app.isDefaultProtocolClient('http') && app.isDefaultProtocolClient('https');
  } catch {
    return false;
  }
}

function launchKnownWindowsBrowser(url) {
  if (process.platform !== 'win32') return false;

  const candidates = [
    path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env.PROGRAMFILES || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env['PROGRAMFILES(X86)'] || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(process.env.PROGRAMFILES || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(process.env['PROGRAMFILES(X86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(process.env.PROGRAMFILES || '', 'Mozilla Firefox', 'firefox.exe'),
    path.join(process.env['PROGRAMFILES(X86)'] || '', 'Mozilla Firefox', 'firefox.exe')
  ];

  const executable = candidates.find(candidate => candidate && fs.existsSync(candidate));
  if (!executable) return false;

  const child = spawn(executable, [url], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true
  });
  child.unref();
  return true;
}

async function openInSystemBrowser(url) {
  // If DFBrowse is itself the Windows default browser, shell.openExternal
  // would send the URL straight back to this app and repeat the interception.
  // Prefer an installed Chrome/Edge/Firefox executable in that case.
  if (isDfbrowseDefaultBrowser() && launchKnownWindowsBrowser(url)) return;
  if (isDfbrowseDefaultBrowser()) {
    throw new Error('DFBrowse is the default browser. Set Chrome, Edge, or Firefox as the default browser to sign in with Google.');
  }
  return shell.openExternal(url);
}

let lastExternalAuth = { targetUrl: null, openedAt: 0 };

function notifyGoogleAuthExternalized(payload) {
  const win = BrowserWindow.getAllWindows()[0];
  if (!win || !win.webContents || win.webContents.isDestroyed()) return;
  win.webContents.send('app:googleAuthExternalized', payload);
}

async function openGoogleAuthExternally(authUrl, sourceUrl = null) {
  if (!isGoogleAuthUrl(authUrl)) {
    throw new Error('Only Google sign-in URLs can be opened outside DFBrowse.');
  }

  const targetUrl = externalAuthTarget(authUrl, sourceUrl);
  const currentTime = now();
  const isDuplicate = lastExternalAuth.targetUrl === targetUrl && currentTime - lastExternalAuth.openedAt < 1500;
  if (!isDuplicate) {
    lastExternalAuth = { targetUrl, openedAt: currentTime };
    try {
      // Google intentionally does not permit credentials to be entered in an
      // embedded webview.  The system browser is the supported OAuth user
      // agent and also preserves the user's existing Google session.
      await openInSystemBrowser(targetUrl);
      notifyGoogleAuthExternalized({ authUrl, targetUrl, opened: true });
    } catch (error) {
      notifyGoogleAuthExternalized({
        authUrl,
        targetUrl,
        opened: false,
        error: error.message || 'Could not open the system browser.'
      });
      throw error;
    }
  }

  return { authUrl, targetUrl, opened: true };
}

function getConfigPath() {
  return path.join(app.getPath('userData'), 'study-browser-config.json');
}

function defaultConfig() {
  return {
    version: 1,
    allowedSites: normalizeAllowedList([...DEFAULT_ALLOWED_SITES]),
    homeSite: 'arena.ai',
    password: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function readConfig() {
  configPath = getConfigPath();
  try {
    if (fs.existsSync(configPath)) {
      const loaded = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return {
        ...defaultConfig(),
        ...loaded,
        allowedSites: normalizeAllowedList(loaded.allowedSites && loaded.allowedSites.length ? loaded.allowedSites : DEFAULT_ALLOWED_SITES)
      };
    }
  } catch (error) {
    console.error('Failed to read config. Recreating defaults.', error);
  }
  const fresh = defaultConfig();
  writeConfig(fresh);
  return fresh;
}

function writeConfig(nextConfig = config) {
  nextConfig.updatedAt = new Date().toISOString();
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(nextConfig, null, 2));
}

function publicConfig() {
  return {
    allowedSites: [...config.allowedSites],
    homeSite: config.homeSite,
    passwordEnabled: Boolean(config.password),
    configPath
  };
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 210000, 64, 'sha512').toString('hex');
  return { salt, hash, iterations: 210000, digest: 'sha512' };
}

function verifyPassword(password) {
  if (!config.password) return false;
  const { salt, hash, iterations, digest } = config.password;
  const candidate = crypto.pbkdf2Sync(password, salt, iterations, 64, digest).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(candidate, 'hex'), Buffer.from(hash, 'hex'));
}

function createToken() {
  const token = crypto.randomBytes(24).toString('hex');
  authTokens.set(token, now() + TOKEN_TTL_MS);
  return token;
}

function tokenIsValid(token) {
  const expiry = authTokens.get(token);
  if (!expiry || expiry < now()) {
    authTokens.delete(token);
    return false;
  }
  authTokens.set(token, now() + TOKEN_TTL_MS);
  return true;
}

function requireToken(token) {
  if (!tokenIsValid(token)) {
    throw new Error('Settings are locked. Enter the feature password again.');
  }
}

function requestComesFromAllowedPage(details) {
  const possibleParents = [details.referrer, details.initiator].filter(Boolean);
  return possibleParents.some(parentUrl => isAllowedNavigationUrl(parentUrl, config.allowedSites));
}

function registerStudySessionGuards() {
  const studySession = session.fromPartition(STUDY_PARTITION);

  // Google blocks OAuth authorization from embedded webviews. Do not try to
  // disguise Electron by rewriting the User-Agent or Client Hints: Google
  // explicitly requires browsers to identify themselves accurately and to not
  // rewrite their network traffic. Instead, cancel only top-level Google
  // account navigations and continue them in the user's real browser.
  studySession.webRequest.onBeforeRequest((details, callback) => {
    if (details.resourceType !== 'mainFrame' || !isGoogleAuthUrl(details.url)) {
      callback({ cancel: false });
      return;
    }

    callback({ cancel: true });
    let sourceContents = null;
    try {
      if (typeof details.webContentsId === 'number') {
        sourceContents = webContents.fromId(details.webContentsId);
      }
    } catch {
      // The guest contents may have been destroyed before the callback runs.
    }
    const contentsUrl = sourceUrlForContents(sourceContents);
    const sourceUrl = details.referrer && isAllowedNavigationUrl(details.referrer, config.allowedSites)
      ? details.referrer
      : contentsUrl;
    openGoogleAuthExternally(details.url, sourceUrl).catch(error => {
      console.error('Could not open Google sign-in in the system browser.', error);
    });
  });

  studySession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(true);
  });

  studySession.setPermissionCheckHandler(() => true);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 980,
    minHeight: 650,
    title: 'DFBrowse',
    backgroundColor: '#09111f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webviewTag: true
    }
  });

  win.loadFile(path.join(__dirname, 'index.html'));

  // Flush any URL the OS handed us (clicked link, command line) once the
  // shell has loaded and the renderer is listening for it.
  win.webContents.on('did-finish-load', () => {
    if (pendingExternalUrl) {
      const url = pendingExternalUrl;
      pendingExternalUrl = null;
      win.webContents.send('app:openUrl', url);
    }
  });

  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  win.webContents.on('will-navigate', (event, targetUrl) => {
    if (!targetUrl.startsWith('file://')) {
      event.preventDefault();
    }
  });
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // Another DFBrowse instance is already running — that instance will
  // receive the clicked URL through the 'second-instance' event.
  app.quit();
} else {
  // Windows launches a fresh process for every clicked link. Forward the URL
  // to the already-running instance and focus its window instead.
  app.on('second-instance', (event, commandLine) => {
    focusMainWindow();
    const url = extractUrlFromArgs(commandLine);
    if (url) routeExternalUrl(url);
  });

  // macOS: links handed to the app via the OS "open with" mechanism.
  app.on('open-url', (event, url) => {
    event.preventDefault();
    routeExternalUrl(url);
  });

  app.whenReady().then(() => {
    // Identifies the app to Windows (taskbar grouping, default apps).
    app.setAppUserModelId(APP_ID);

    config = readConfig();
    registerStudySessionGuards();
    createWindow();

    // First launch: if DFBrowse was launched with a URL (e.g. because it is
    // the default browser), route it into the webview.
    const startupUrl = extractUrlFromArgs(process.argv.slice(1));
    if (startupUrl) routeExternalUrl(startupUrl);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('web-contents-created', (event, contents) => {
  const isStudyView = () => typeof contents.getType === 'function' && contents.getType() === 'webview';

  contents.setWindowOpenHandler(({ url }) => {
    if (isStudyView() && isGoogleAuthUrl(url)) {
      // A popup is the most common way that "Sign in with Google" starts.
      // Do not load it into the guest view; hand it to the real browser.
      openGoogleAuthExternally(url, sourceUrlForContents(contents)).catch(error => {
        console.error('Could not open Google sign-in in the system browser.', error);
      });
    } else if (isStudyView()) {
      // Keep focus mode in one controlled browser surface. Many ordinary
      // links use target="_blank" or window.open(); load them in the same
      // webview rather than creating an uncontrolled popup window.
      setImmediate(() => {
        if (!contents.isDestroyed()) contents.loadURL(url);
      });
    }

    return { action: 'deny' };
  });

  // Some sites redirect the current frame to Google rather than opening a
  // popup. This listener covers that path as well as the webRequest guard.
  if (isStudyView()) {
    contents.on('will-navigate', (event, url) => {
      if (!isGoogleAuthUrl(url)) return;
      event.preventDefault();
      openGoogleAuthExternally(url, sourceUrlForContents(contents)).catch(error => {
        console.error('Could not open Google sign-in in the system browser.', error);
      });
    });
  }
});

ipcMain.handle('config:get', () => publicConfig());

ipcMain.handle('policy:canNavigate', (event, url) => isAllowedNavigationUrl(url, config.allowedSites));

ipcMain.handle('auth:setPassword', (event, password) => {
  if (config.password) throw new Error('A feature password already exists.');
  if (typeof password !== 'string' || password.length < 4) {
    throw new Error('Use at least 4 characters for the feature password.');
  }
  config.password = hashPassword(password);
  writeConfig();
  return { token: createToken(), config: publicConfig() };
});

ipcMain.handle('auth:unlock', (event, password) => {
  if (!config.password) throw new Error('Set a feature password first.');
  if (!verifyPassword(password)) throw new Error('Wrong feature password.');
  return { token: createToken(), config: publicConfig() };
});

ipcMain.handle('auth:changePassword', (event, token, oldPassword, newPassword) => {
  requireToken(token);
  if (!config.password) throw new Error('No feature password is set.');
  if (!verifyPassword(oldPassword)) throw new Error('Current password is incorrect.');
  if (typeof newPassword !== 'string' || newPassword.length < 4) {
    throw new Error('Use at least 4 characters for the new password.');
  }
  config.password = hashPassword(newPassword);
  writeConfig();
  return { config: publicConfig() };
});

ipcMain.handle('auth:lock', (event, token) => {
  authTokens.delete(token);
  return true;
});

ipcMain.handle('sites:add', (event, token, siteInput) => {
  requireToken(token);
  const site = normalizeHostname(siteInput);
  const nextSites = normalizeAllowedList([...config.allowedSites, site]);
  config.allowedSites = nextSites;
  if (!config.homeSite) config.homeSite = site;
  writeConfig();
  return publicConfig();
});

ipcMain.handle('sites:remove', (event, token, siteInput) => {
  requireToken(token);
  const site = normalizeHostname(siteInput);
  const nextSites = config.allowedSites.filter(item => item !== site);
  if (!nextSites.length) {
    throw new Error('Keep at least one allowed study site.');
  }
  config.allowedSites = nextSites;
  if (config.homeSite === site) {
    config.homeSite = config.allowedSites[0];
  }
  writeConfig();
  return publicConfig();
});

ipcMain.handle('sites:setHome', (event, token, siteInput) => {
  requireToken(token);
  const site = normalizeHostname(siteInput);
  if (!config.allowedSites.includes(site)) {
    throw new Error('Home site must be on the allowlist.');
  }
  config.homeSite = site;
  writeConfig();
  return publicConfig();
});

ipcMain.handle('app:studyPartition', () => STUDY_PARTITION);

ipcMain.handle('app:openGoogleAuthExternally', async (event, authUrl, sourceUrl) => {
  if (!isGoogleAuthUrl(authUrl)) {
    throw new Error('That is not a Google sign-in URL.');
  }
  if (sourceUrl && !isAllowedNavigationUrl(sourceUrl, config.allowedSites)) {
    sourceUrl = null;
  }
  return openGoogleAuthExternally(authUrl, sourceUrl);
});

ipcMain.handle('app:isDefaultBrowser', () => {
  if (process.platform !== 'win32') return true;
  try {
    return app.isDefaultProtocolClient('http') && app.isDefaultProtocolClient('https');
  } catch {
    return false;
  }
});

ipcMain.handle('app:setDefaultBrowser', async () => {
  if (process.platform !== 'win32') {
    return { registered: true, openedSettings: false };
  }
  let registered = false;
  try {
    registered = app.setAsDefaultProtocolClient('http') && app.setAsDefaultProtocolClient('https');
  } catch {
    registered = false;
  }
  try {
    // Open the Windows default-apps page so the user can confirm the choice.
    await shell.openExternal('ms-settings:defaultapps');
  } catch {
    // Settings page failed to open; the registration itself still succeeded.
  }
  return { registered, openedSettings: true };
});
