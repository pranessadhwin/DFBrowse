'use strict';

const { app, BrowserWindow, ipcMain, session } = require('electron');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  DEFAULT_ALLOWED_SITES,
  normalizeHostname,
  normalizeAllowedList,
  isAllowedNavigationUrl,
  isAllowedRequestUrl
} = require('./policy');

app.commandLine.appendSwitch('disable-extensions');
app.commandLine.appendSwitch('disable-component-extensions-with-background-pages');
// Disable Chromium's Client Hints delegation so Electron-branded Sec-CH-UA
// headers are never generated — our onBeforeSendHeaders overwrites them, but
// this prevents any race with the network stack.
app.commandLine.appendSwitch('disable-features', 'UserAgentClientHint,ReduceUserAgentMinorVersion');

const STUDY_PARTITION = 'persist:study';
const TOKEN_TTL_MS = 15 * 60 * 1000;

let config;
let configPath;
const authTokens = new Map();

function now() {
  return Date.now();
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

  // ── Make the webview indistinguishable from Chrome ──────────────────
  // Arena.ai (and similar sites) check multiple browser-identifying headers:
  //   • User-Agent        – HTTP header AND navigator.userAgent
  //   • Sec-CH-UA         – Client Hints "brand list"
  //   • Sec-CH-UA-Mobile  – mobile flag
  //   • Sec-CH-UA-Platform – OS name
  // Electron's defaults expose "Electron" in all of these, causing API
  // endpoints to reject requests.  We rewrite every outgoing request so the
  // webview is 100% indistinguishable from real Chrome on Windows.

  const CHROME_VERSION = '126';
  const CHROME_UA = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_VERSION}.0.0.0 Safari/537.36`;
  const CHROME_SEC_CH_UA = `"Chromium";v="${CHROME_VERSION}", "Google Chrome";v="${CHROME_VERSION}", "Not-A.Brand";v="8"`;

  // Set User-Agent on the session (affects navigator.userAgent in JS).
  studySession.setUserAgent(CHROME_UA);

  // Rewrite outgoing HTTP headers on every single request.
  studySession.webRequest.onBeforeSendHeaders((details, callback) => {
    const h = details.requestHeaders;
    h['User-Agent'] = CHROME_UA;

    // Overwrite Client Hints so the server never sees "Electron".
    h['Sec-CH-UA'] = CHROME_SEC_CH_UA;
    h['Sec-CH-UA-Mobile'] = '?0';
    h['Sec-CH-UA-Platform'] = '"Windows"';
    h['Sec-CH-UA-Full-Version-List'] = CHROME_SEC_CH_UA;

    // Remove any header that Electron adds but Chrome doesn't.
    delete h['X-Electron-Is-Dev'];

    callback({ requestHeaders: h });
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
    title: 'Arena Study Browser',
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

  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  win.webContents.on('will-navigate', (event, targetUrl) => {
    if (!targetUrl.startsWith('file://')) {
      event.preventDefault();
    }
  });
}

app.whenReady().then(() => {
  config = readConfig();
  registerStudySessionGuards();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('web-contents-created', (event, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    const isStudyView = typeof contents.getType === 'function' && contents.getType() === 'webview';

    if (isStudyView) {
      // Keep focus mode in one controlled browser surface.  Many Sign-in/up
      // buttons use target="_blank" or window.open(); load every popup URL in
      // the same webview so OAuth flows, account creation, CAPTCHAs, etc. all
      // work exactly like opening a new tab in Chrome/Brave.
      setImmediate(() => {
        if (!contents.isDestroyed()) contents.loadURL(url);
      });
    }

    return { action: 'deny' };
  });
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
