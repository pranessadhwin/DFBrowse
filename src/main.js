'use strict';

const { app, BrowserView, BrowserWindow, ipcMain, session, shell } = require('electron');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  DEFAULT_ALLOWED_SITES,
  normalizeHostname,
  normalizeAllowedList,
  isAllowedNavigationUrl,
  isAllowedMainFrameUrl,
  isGoogleAuthNavigationUrl
} = require('./policy');

app.commandLine.appendSwitch('disable-extensions');
app.commandLine.appendSwitch('disable-component-extensions-with-background-pages');
// Remove the automation fingerprint Chromium applies to navigator.webdriver
// when the renderer is controlled (CDP / debugging).
app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled');
// Disable Chromium's own Client Hints computation so Electron-branded
// Sec-CH-UA headers are never generated — we inject real Chrome hints in
// onBeforeSendHeaders instead.
app.commandLine.appendSwitch('disable-features', 'UserAgentClientHint,ReduceUserAgentMinorVersion');

// ── Chrome identity for the study view ─────────────────────────────────────
// Google's sign-in and anti-abuse checks reject sessions whose User-Agent,
// Client Hints, or automation fingerprint do not look like a real Chrome
// install.  DFBrowse keeps Google sign-in inside the app, so the study view
// presents itself as Chrome on Windows via four complementary layers:
//   1. app.userAgentFallback            – base UA for every renderer
//   2. Emulation.setUserAgentOverride   – CDP: JS-visible UA + Client Hint
//                                        metadata (no "Electron" suffix)
//   3. onBeforeSendHeaders              – authoritative Sec-CH-UA headers on
//                                        every outgoing request
//   4. New-document script              – hides navigator.webdriver and
//                                        restores window.chrome, plugins,
//                                        vendor, and languages
const CHROME_MAJOR = '126';
const CHROME_FULL_VERSION = `${CHROME_MAJOR}.0.6478.127`;
const CHROME_UA = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_FULL_VERSION} Safari/537.36`;
const CHROME_SEC_CH_UA = `"Not/A.Brand";v="8", "Chromium";v="${CHROME_MAJOR}", "Google Chrome";v="${CHROME_MAJOR}"`;
const CHROME_SEC_CH_UA_FULL = `"Not/A.Brand";v="8.0.0.0", "Chromium";v="${CHROME_FULL_VERSION}", "Google Chrome";v="${CHROME_FULL_VERSION}"`;
const CHROME_CLIENT_HINTS = {
  'Sec-CH-UA': CHROME_SEC_CH_UA,
  'Sec-CH-UA-Mobile': '?0',
  'Sec-CH-UA-Platform': '"Windows"',
  'Sec-CH-UA-Platform-Version': '"15.0.0"',
  'Sec-CH-UA-Full-Version-List': CHROME_SEC_CH_UA_FULL
};
const ACCEPT_LANGUAGE = 'en-US,en;q=0.9';

// The fallback every Electron renderer starts with (before CDP overrides it).
app.userAgentFallback = CHROME_UA;

// CDP: fully overrides navigator.userAgent / client-hint metadata so pages
// never see Electron's " Electron/31.x.x" suffix.
const CDP_UA_OVERRIDE = {
  userAgent: CHROME_UA,
  acceptLanguage: ACCEPT_LANGUAGE,
  platform: 'Win32',
  userAgentMetadata: {
    brands: [
      { brand: 'Not/A.Brand', version: '8' },
      { brand: 'Chromium', version: CHROME_MAJOR },
      { brand: 'Google Chrome', version: CHROME_MAJOR }
    ],
    fullVersionList: [
      { brand: 'Not/A.Brand', version: '8.0.0.0' },
      { brand: 'Chromium', version: CHROME_FULL_VERSION },
      { brand: 'Google Chrome', version: CHROME_FULL_VERSION }
    ],
    platform: 'Windows',
    platformVersion: '15.0.0',
    architecture: 'x86',
    model: '',
    mobile: false
  }
};

// Injected into every new document before any page script runs.
const CHROME_FINGERPRINT_SCRIPT = `
(() => {
  // navigator.webdriver is true whenever Chromium is under automation.
  // Google's sign-in checks treat it as proof the session is not a browser.
  try {
    Object.defineProperty(Navigator.prototype, 'webdriver', {
      get: () => undefined,
      configurable: true
    });
  } catch (error) { /* not critical */ }

  // window.chrome.* is used by countless Chrome-only feature detectors.
  try {
    if (!window.chrome) {
      window.chrome = {
        runtime: {},
        loadTimes: () => ({}),
        csi: () => ({})
      };
    }
    if (!window.chrome.runtime) window.chrome.runtime = {};
  } catch (error) { /* not critical */ }

  // Plugin list matching a default Chrome install (the PDF viewer entries).
  try {
    const pluginEntries = [
      { name: 'PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
      { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
      { name: 'Chromium PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
      { name: 'Microsoft Edge PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
      { name: 'WebKit built-in PDF', filename: 'internal-pdf-viewer', description: 'Portable Document Format' }
    ];
    Object.defineProperty(Navigator.prototype, 'plugins', {
      get: () => {
        const list = pluginEntries.slice();
        list.item = index => list[index] || null;
        list.namedItem = name => list.find(entry => entry.name === name) || null;
        list.refresh = () => {};
        return list;
      },
      configurable: true
    });
  } catch (error) { /* not critical */ }

  // Chrome reports these exactly like this on Windows.
  try {
    Object.defineProperty(Navigator.prototype, 'vendor', { get: () => 'Google Inc.', configurable: true });
    Object.defineProperty(Navigator.prototype, 'languages', { get: () => ['en-US', 'en'], configurable: true });
    Object.defineProperty(Navigator.prototype, 'language', { get: () => 'en-US', configurable: true });
  } catch (error) { /* not critical */ }
})();
`;

const STUDY_PARTITION = 'persist:study';
const TOKEN_TTL_MS = 15 * 60 * 1000;
// Matches the "appId" used by electron-builder so Windows groups the taskbar
// icon, notifications, and default-browser registration under one identity.
const APP_ID = 'com.dfbrowse.app';

let config;
let configPath;
let win = null;
let studyView = null;
let studyViewContents = null;
let viewBounds = null;
let viewVisible = false;
// Resolves once the study view's CDP configuration has been applied (or has
// failed); browser:navigate waits on it so the first page never loads with
// the Electron identity.
let viewReadyPromise = Promise.resolve();
const authTokens = new Map();

// URL handed to the OS (e.g. a clicked link) that still needs to be routed to
// the renderer once the shell window has finished loading.
let pendingExternalUrl = null;

// Deduplicate blocked-page notifications for the same URL.
let lastBlocked = { url: null, at: 0 };

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
  const window = BrowserWindow.getAllWindows()[0];
  if (!window) return;
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
}

function sendToShell(channel, payload) {
  if (win && !win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
    win.webContents.send(channel, payload);
  }
}

// Route an externally-opened URL (link click, command line) into the study view.
function routeExternalUrl(url) {
  if (!url) return;
  if (!win || !win.webContents || win.webContents.isDestroyed()) {
    pendingExternalUrl = url;
    return;
  }
  const shellReady = win.webContents.getURL().startsWith('file://') && !win.webContents.isLoadingMainFrame();
  if (!shellReady) {
    pendingExternalUrl = url;
    return;
  }
  sendToShell('app:openUrl', url);
}

function notifyBlocked(url) {
  const currentTime = now();
  if (lastBlocked.url === url && currentTime - lastBlocked.at < 2000) return;
  lastBlocked = { url, at: currentTime };
  sendToShell('browser:blocked', { url: url || '' });
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

// ── Study view (native BrowserView) ─────────────────────────────────────────

function broadcastViewState(url) {
  const currentUrl = url || (studyViewContents && !studyViewContents.isDestroyed() ? studyViewContents.getURL() : '') || '';
  let canGoBack = false;
  let canGoForward = false;
  if (studyViewContents && !studyViewContents.isDestroyed()) {
    try {
      canGoBack = studyViewContents.navigationHistory.canGoBack();
      canGoForward = studyViewContents.navigationHistory.canGoForward();
    } catch {
      canGoBack = false;
      canGoForward = false;
    }
  }
  sendToShell('browser:url-changed', { url: currentUrl, canGoBack, canGoForward });
}

function wireStudyContents(contents) {
  // Popups ("Sign in with Google", target=_blank links): keep them inside
  // DFBrowse by loading them in the same study view.  Allowed study sites
  // and Google sign-in/challenge hosts pass; everything else is denied.
  contents.setWindowOpenHandler(({ url }) => {
    if (url && (isAllowedNavigationUrl(url, config.allowedSites) || isGoogleAuthNavigationUrl(url))) {
      setImmediate(() => {
        if (!contents.isDestroyed()) contents.loadURL(url);
      });
    }
    return { action: 'deny' };
  });

  // Redirects initiated by the page itself (JS location changes, meta
  // refresh, server redirects) land here.  Block anything that is neither an
  // allowed study site nor a Google sign-in/challenge host.
  contents.on('will-navigate', (event, url) => {
    if (isAllowedMainFrameUrl(url, config.allowedSites)) return;
    event.preventDefault();
    notifyBlocked(url);
  });

  contents.on('did-start-loading', () => {
    sendToShell('browser:loading', { isLoading: true, url: contents.getURL() });
  });

  contents.on('did-stop-loading', () => {
    sendToShell('browser:loading', { isLoading: false, url: contents.getURL() });
    broadcastViewState(contents.getURL());
  });

  contents.on('did-navigate', (_event, url) => broadcastViewState(url));
  contents.on('did-navigate-in-page', (_event, url) => broadcastViewState(url));

  contents.on('did-fail-load', (_event, errorCode, _errorDescription, validatedURL, isMainFrame) => {
    // -3 (ERR_ABORTED) is a cancelled navigation (user action, redirect,
    // or our own will-navigate guard) — not a real failure.
    if (!isMainFrame || errorCode === -3) return;
    notifyBlocked(validatedURL || contents.getURL());
  });
}

async function configureChromeCompatibility(contents) {
  if (!contents || contents.isDestroyed()) return;
  try {
    contents.debugger.attach('1.3');
    try {
      await contents.debugger.sendCommand('Emulation.setUserAgentOverride', CDP_UA_OVERRIDE);
    } catch (error) {
      console.warn('Full CDP UA override (with Client Hints metadata) failed — falling back to UA string only.', error && error.message);
      await contents.debugger.sendCommand('Emulation.setUserAgentOverride', {
        userAgent: CHROME_UA,
        acceptLanguage: ACCEPT_LANGUAGE,
        platform: 'Win32'
      });
    }
    await contents.debugger.sendCommand('Page.addScriptToEvaluateOnNewDocument', {
      source: CHROME_FINGERPRINT_SCRIPT
    });
  } catch (error) {
    console.error('Could not configure Chrome compatibility via CDP.', error);
  }
}

function createStudyView() {
  const view = new BrowserView({
    webPreferences: {
      partition: STUDY_PARTITION,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      javascript: true
    }
  });
  studyViewContents = view.webContents;
  wireStudyContents(studyViewContents);
  viewReadyPromise = configureChromeCompatibility(studyViewContents);
  return view;
}

function ensureStudyView() {
  if (!studyView) studyView = createStudyView();
  return studyView;
}

function applyViewBounds() {
  if (!studyView || !win || win.isDestroyed() || !viewBounds) return;
  try {
    studyView.setBounds(viewBounds);
  } catch {
    // Window is mid-resize or the view was just detached; the renderer will
    // re-send bounds on the next layout tick.
  }
}

function showStudyView() {
  const view = ensureStudyView();
  if (!win || win.isDestroyed()) return;
  viewVisible = true;
  try {
    win.setBrowserView(view);
  } catch {
    // Already attached or window not ready.
  }
  applyViewBounds();
  if (studyViewContents && !studyViewContents.isDestroyed()) studyViewContents.focus();
}

function hideStudyView() {
  viewVisible = false;
  if (!win || win.isDestroyed() || !studyView) return;
  try {
    win.removeBrowserView(studyView);
  } catch {
    // Already detached.
  }
}

async function loadUrlInView(url) {
  const view = ensureStudyView();
  showStudyView();
  // Make sure the CDP configuration is in place before the first page loads.
  await Promise.race([viewReadyPromise, new Promise(resolve => setTimeout(resolve, 5000))]);
  if (!studyViewContents || studyViewContents.isDestroyed()) return;
  try {
    await studyViewContents.loadURL(url);
  } catch {
    // did-fail-load reports the actual failure; loadURL's rejection is
    // expected for aborted navigations.
  }
}

// ── Session guards (allowlist + Chrome headers) ─────────────────────────────

function registerStudySessionGuards() {
  const studySession = session.fromPartition(STUDY_PARTITION);

  // Authoritative request headers for every request the study view makes.
  // app.userAgentFallback and CDP shape what JavaScript sees; this layer
  // guarantees no request can leak an Electron-branded header.
  studySession.webRequest.onBeforeSendHeaders((details, callback) => {
    const headers = {
      ...details.requestHeaders,
      ...CHROME_CLIENT_HINTS
    };
    headers['User-Agent'] = CHROME_UA;
    headers['Accept-Language'] = ACCEPT_LANGUAGE;
    delete headers['X-Electron-Is-Dev'];
    callback({ requestHeaders: headers });
  });

  // Hard allowlist for top-level loads: allowed study sites, the Google
  // sign-in/challenge carve-out, and Chromium's internal protocols.  Anything
  // else is cancelled before it starts loading.
  studySession.webRequest.onBeforeRequest((details, callback) => {
    if (details.resourceType !== 'mainFrame' || isAllowedMainFrameUrl(details.url, config.allowedSites)) {
      callback({ cancel: false });
      return;
    }
    callback({ cancel: true });
    notifyBlocked(details.url);
  });

  studySession.setPermissionRequestHandler((contents, permission, callback) => {
    callback(true);
  });

  studySession.setPermissionCheckHandler(() => true);
}

// ── Shell window ────────────────────────────────────────────────────────────

function createWindow() {
  win = new BrowserWindow({
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
      webviewTag: false
    }
  });

  win.loadFile(path.join(__dirname, 'index.html'));

  win.on('closed', () => {
    if (studyViewContents && !studyViewContents.isDestroyed()) {
      try {
        studyViewContents.close();
      } catch {
        // Already destroyed.
      }
    }
    win = null;
    studyView = null;
    studyViewContents = null;
    viewBounds = null;
    viewVisible = false;
  });

  // Flush any URL the OS handed us (clicked link, command line) once the
  // shell has loaded and the renderer is listening for it.
  win.webContents.on('did-finish-load', () => {
    if (pendingExternalUrl) {
      const url = pendingExternalUrl;
      pendingExternalUrl = null;
      sendToShell('app:openUrl', url);
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
    // the default browser), route it into the study view.
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

// ── IPC: shell <-> main ─────────────────────────────────────────────────────

ipcMain.handle('config:get', () => publicConfig());

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

// ── BrowserView navigation IPC ──────────────────────────────────────────────

// The renderer reports where the study view should sit on screen (below the
// toolbar / banner, next to the sidebar) and whether it should be visible.
// BrowserViews render above the shell DOM, so the shell tells the main
// process exactly where to place it.
ipcMain.on('browser:setViewState', (event, state) => {
  const next = state || {};
  viewBounds = {
    x: Math.max(0, Math.round(Number(next.x) || 0)),
    y: Math.max(0, Math.round(Number(next.y) || 0)),
    width: Math.round(Number(next.width) || 0),
    height: Math.round(Number(next.height) || 0)
  };
  if (next.visible) showStudyView();
  else hideStudyView();
});

// Deliberate navigations (address bar, quick links, home): the study
// allowlist applies strictly here — the Google carve-out is only for
// redirects and popups that occur during an on-site sign-in flow.
ipcMain.handle('browser:navigate', async (event, rawUrl) => {
  const url = String(rawUrl || '').trim();
  if (!isAllowedNavigationUrl(url, config.allowedSites)) {
    return { ok: false, url, reason: 'not-allowed' };
  }
  await loadUrlInView(url);
  return { ok: true, url };
});

ipcMain.handle('browser:goHome', async () => {
  const homeSite = config.homeSite || config.allowedSites[0];
  const homeUrl = `https://${homeSite}`;
  if (!homeSite || !isAllowedNavigationUrl(homeUrl, config.allowedSites)) {
    return { ok: false, url: homeUrl };
  }
  await loadUrlInView(homeUrl);
  return { ok: true, url: homeUrl };
});

ipcMain.handle('browser:goBack', () => {
  if (studyViewContents && !studyViewContents.isDestroyed()) {
    try {
      if (studyViewContents.navigationHistory.canGoBack()) studyViewContents.navigationHistory.goBack();
    } catch {
      // History changed under us.
    }
  }
  return true;
});

ipcMain.handle('browser:goForward', () => {
  if (studyViewContents && !studyViewContents.isDestroyed()) {
    try {
      if (studyViewContents.navigationHistory.canGoForward()) studyViewContents.navigationHistory.goForward();
    } catch {
      // History changed under us.
    }
  }
  return true;
});

ipcMain.handle('browser:reload', () => {
  if (studyViewContents && !studyViewContents.isDestroyed()) studyViewContents.reload();
  return true;
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
