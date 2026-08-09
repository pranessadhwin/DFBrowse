'use strict';

const $ = selector => document.querySelector(selector);

const state = {
  config: null,
  token: null,
  timerSeconds: Number(localStorage.getItem('timerSeconds')) || 25 * 60,
  timerMode: localStorage.getItem('timerMode') || 'Focus',
  timerRunning: false,
  timerId: null,
  currentUrl: null,
  externalAuthUrl: null,
  externalAuthTargetUrl: null
};

const els = {
  shell: $('.shell'),
  sidebarToggle: $('#sidebarToggle'),
  siteList: $('#siteList'),
  quickLinks: $('#quickLinks'),
  contentArea: $('#contentArea'),
  webview: $('#webview'),
  homeScreen: $('#homeScreen'),
  blockedScreen: $('#blockedScreen'),
  blockedMessage: $('#blockedMessage'),
  authScreen: $('#authScreen'),
  authMessage: $('#authMessage'),
  openAuthInBrowser: $('#openAuthInBrowser'),
  backFromAuth: $('#backFromAuth'),
  addressForm: $('#addressForm'),
  addressInput: $('#addressInput'),
  statusPill: $('#statusPill'),
  backBtn: $('#backBtn'),
  forwardBtn: $('#forwardBtn'),
  reloadBtn: $('#reloadBtn'),
  homeBtn: $('#homeBtn'),
  manageSites: $('#manageSites'),
  openManagerFromBlocked: $('#openManagerFromBlocked'),
  backToHome: $('#backToHome'),
  modalBackdrop: $('#modalBackdrop'),
  closeModal: $('#closeModal'),
  modalTitle: $('#modalTitle'),
  modalSubtitle: $('#modalSubtitle'),
  modalError: $('#modalError'),
  passwordSetup: $('#passwordSetup'),
  newPassword: $('#newPassword'),
  confirmPassword: $('#confirmPassword'),
  createPassword: $('#createPassword'),
  unlockSection: $('#unlockSection'),
  passwordInput: $('#passwordInput'),
  unlockButton: $('#unlockButton'),
  managerSection: $('#managerSection'),
  siteInput: $('#siteInput'),
  addSite: $('#addSite'),
  managerList: $('#managerList'),
  lockManager: $('#lockManager'),
  toggleChangePassword: $('#toggleChangePassword'),
  changePasswordForm: $('#changePasswordForm'),
  currentPassword: $('#currentPassword'),
  changeNewPassword: $('#changeNewPassword'),
  changeConfirmPassword: $('#changeConfirmPassword'),
  submitChangePassword: $('#submitChangePassword'),
  cancelChangePassword: $('#cancelChangePassword'),
  changePasswordMessage: $('#changePasswordMessage'),
  timerDisplay: $('#timerDisplay'),
  timerMode: $('#timerMode'),
  timerStart: $('#timerStart'),
  timerPause: $('#timerPause'),
  timerReset: $('#timerReset'),
  focus25: $('#focus25'),
  break5: $('#break5'),
  notes: $('#notes'),
  clearNotes: $('#clearNotes'),
  defaultBanner: $('#defaultBrowserBanner'),
  setDefaultBtn: $('#setDefaultBrowser'),
  dismissDefaultBtn: $('#dismissDefaultBrowser')
};

function show(element) {
  element.classList.remove('hidden');
}

function hide(element) {
  element.classList.add('hidden');
}

function syncWebviewSize() {
  // Electron's <webview> guest view sometimes gets "stuck" rendering at a
  // stale, smaller size instead of tracking its container's percentage-based
  // width/height — most noticeably right after it's unhidden or the window
  // resizes, which leaves most of the page blank below a small rendered strip.
  // Explicitly pinning pixel dimensions from the real container box keeps the
  // guest compositor in sync regardless of when that happens.
  if (!els.contentArea || els.webview.classList.contains('hidden')) return;
  const rect = els.contentArea.getBoundingClientRect();
  const w = `${Math.round(rect.width)}px`;
  const h = `${Math.round(rect.height)}px`;
  els.webview.style.width = w;
  els.webview.style.height = h;

  // Double-RAF: the first rAF fires before the compositor, the second fires
  // after layout has been committed, catching stale-measurement edge cases
  // (e.g. right after unhiding the element).
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (els.webview.classList.contains('hidden')) return;
      const rect2 = els.contentArea.getBoundingClientRect();
      els.webview.style.width = `${Math.round(rect2.width)}px`;
      els.webview.style.height = `${Math.round(rect2.height)}px`;
    });
  });
}

function setStatus(text, blocked = false) {
  els.statusPill.textContent = text;
  els.statusPill.classList.toggle('blocked', blocked);
}

function iconFor(site) {
  return site.split('.').find(Boolean)?.slice(0, 1) || 'S';
}

function displayName(site) {
  return site.replace(/\.com$/, '').replace(/\.ai$/, '').replace(/\.org$/, '');
}

function renderSites() {
  const sites = state.config.allowedSites;
  els.siteList.innerHTML = '';
  els.quickLinks.innerHTML = '';

  for (const site of sites) {
    const chip = document.createElement('button');
    chip.className = 'site-chip';
    chip.innerHTML = `<span>${site}</span><small>Open</small>`;
    chip.addEventListener('click', () => loadUrl(`https://${site}`));
    els.siteList.appendChild(chip);

    const quick = document.createElement('button');
    quick.className = 'quick-link';
    quick.innerHTML = `
      <span class="favicon-dot">${iconFor(site)}</span>
      <span><strong>${displayName(site)}</strong><span>https://${site}</span></span>
    `;
    quick.addEventListener('click', () => loadUrl(`https://${site}`));
    els.quickLinks.appendChild(quick);
  }
}

function renderManagerList() {
  els.managerList.innerHTML = '';
  for (const site of state.config.allowedSites) {
    const row = document.createElement('div');
    row.className = 'manager-item';

    const name = document.createElement('strong');
    name.textContent = site;

    const homeButton = document.createElement('button');
    homeButton.className = 'ghost';
    homeButton.textContent = state.config.homeSite === site ? 'Home ✓' : 'Make home';
    homeButton.disabled = state.config.homeSite === site;
    homeButton.addEventListener('click', async () => {
      await runManagerAction(() => window.studyBrowser.setHome(state.token, site));
    });

    const remove = document.createElement('button');
    remove.className = 'ghost danger-text';
    remove.textContent = 'Remove';
    remove.addEventListener('click', async () => {
      if (confirm(`Remove ${site} from allowed websites?`)) {
        await runManagerAction(() => window.studyBrowser.removeSite(state.token, site));
      }
    });

    row.append(name, homeButton, remove);
    els.managerList.appendChild(row);
  }
}

function inputToUrl(input) {
  const value = input.trim();
  if (!value) return null;

  try {
    const parsed = new URL(value);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.toString();
    return null;
  } catch {
    // Continue below.
  }

  if (/^[a-z0-9.-]+(?::\d+)?(?:\/.*)?$/i.test(value) && value.includes('.')) {
    return `https://${value}`;
  }

  return null;
}

function isAllowedUrlLocally(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
    return state.config.allowedSites.some(site => host === site || host.endsWith(`.${site}`));
  } catch {
    return false;
  }
}

function isGoogleAuthUrlLocally(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase().replace(/\.$/, '');
    return host === 'accounts.google.com' || host.endsWith('.accounts.google.com');
  } catch {
    return false;
  }
}

function showHome() {
  hide(els.webview);
  hide(els.blockedScreen);
  hide(els.authScreen);
  show(els.homeScreen);
  state.externalAuthUrl = null;
  state.externalAuthTargetUrl = null;
  els.addressInput.value = '';
  setStatus('Ready');
}

function showBlocked(url) {
  hide(els.webview);
  hide(els.homeScreen);
  hide(els.authScreen);
  show(els.blockedScreen);
  els.blockedMessage.textContent = `${url || 'That address'} is not on the study allowlist.`;
  els.addressInput.value = url || '';
  setStatus('Blocked', true);
}

function showExternalAuth({ authUrl, targetUrl, opened = true, error = '' } = {}) {
  state.externalAuthUrl = authUrl || state.externalAuthUrl;
  state.externalAuthTargetUrl = targetUrl || state.externalAuthTargetUrl;
  hide(els.webview);
  hide(els.homeScreen);
  hide(els.blockedScreen);
  show(els.authScreen);

  if (opened) {
    els.authMessage.textContent = 'Google does not allow passwords to be entered inside embedded browsers. DFBrowse opened this sign-in in your system browser instead. Finish signing in there; Google will keep your account session in that browser. For security, DFBrowse cannot copy browser cookies back into its embedded view.';
    setStatus('Sign-in opened in browser');
  } else {
    els.authMessage.textContent = error || 'DFBrowse could not open your system browser. Open the sign-in again or choose Chrome, Edge, or Firefox as your default browser.';
    setStatus('Sign-in unavailable', true);
  }
  els.addressInput.value = state.externalAuthTargetUrl || state.externalAuthUrl || '';
}

async function requestGoogleAuthExternally(authUrl, sourceUrl = state.currentUrl) {
  if (!isGoogleAuthUrlLocally(authUrl)) return false;
  try {
    const result = await window.studyBrowser.openGoogleAuthExternally(authUrl, sourceUrl);
    showExternalAuth(result);
    return true;
  } catch (error) {
    showExternalAuth({ authUrl, targetUrl: sourceUrl, opened: false, error: error.message || String(error) });
    return false;
  }
}

async function loadUrl(raw) {
  const url = inputToUrl(raw);
  if (!url) {
    showBlocked(raw || 'Invalid address');
    return;
  }

  const allowed = await window.studyBrowser.canNavigate(url);
  if (!allowed) {
    showBlocked(url);
    return;
  }

  hide(els.homeScreen);
  hide(els.blockedScreen);
  hide(els.authScreen);
  show(els.webview);
  syncWebviewSize();
  setStatus('Loading…');
  els.addressInput.value = url;
  state.currentUrl = url;
  els.webview.src = url;
  // Electron's guest compositor sometimes needs a few frames to initialise
  // after the src changes; re-sync at staggered intervals to be safe.
  setTimeout(syncWebviewSize, 50);
  setTimeout(syncWebviewSize, 150);
}

async function loadHomeSite() {
  const homeSite = state.config.homeSite || state.config.allowedSites[0];
  if (homeSite) await loadUrl(`https://${homeSite}`);
  else showHome();
}

function updateNavState() {
  try {
    els.backBtn.disabled = !els.webview.canGoBack();
    els.forwardBtn.disabled = !els.webview.canGoForward();
  } catch {
    els.backBtn.disabled = true;
    els.forwardBtn.disabled = true;
  }
}

function openModal() {
  els.modalError.textContent = '';
  show(els.modalBackdrop);
  if (!state.config.passwordEnabled) {
    els.modalTitle.textContent = 'Create feature password';
    els.modalSubtitle.textContent = 'This password will be required before sites can be added or removed.';
    show(els.passwordSetup);
    hide(els.unlockSection);
    hide(els.managerSection);
    els.newPassword.focus();
  } else if (!state.token) {
    els.modalTitle.textContent = 'Unlock site manager';
    els.modalSubtitle.textContent = 'Enter the feature password to add or remove websites.';
    hide(els.passwordSetup);
    show(els.unlockSection);
    hide(els.managerSection);
    els.passwordInput.focus();
  } else {
    showManager();
  }
}

function closeModal() {
  hide(els.modalBackdrop);
  els.modalError.textContent = '';
  resetChangePasswordForm();
}

function showManager() {
  els.modalTitle.textContent = 'Manage allowed websites';
  els.modalSubtitle.textContent = 'Only these websites can load in the study browser.';
  hide(els.passwordSetup);
  hide(els.unlockSection);
  show(els.managerSection);
  renderManagerList();
  resetChangePasswordForm();
  els.siteInput.focus();
}

function resetChangePasswordForm() {
  hide(els.changePasswordForm);
  els.currentPassword.value = '';
  els.changeNewPassword.value = '';
  els.changeConfirmPassword.value = '';
  els.changePasswordMessage.textContent = '';
  els.changePasswordMessage.className = 'change-password-msg';
  if (els.toggleChangePassword) els.toggleChangePassword.textContent = 'Change';
}

async function refreshConfig(nextConfig) {
  state.config = nextConfig || await window.studyBrowser.getConfig();
  renderSites();
  if (!state.config.allowedSites.includes(state.config.homeSite)) {
    state.config.homeSite = state.config.allowedSites[0];
  }
}

async function runManagerAction(action) {
  try {
    els.modalError.textContent = '';
    const updatedConfig = await action();
    await refreshConfig(updatedConfig);
    renderManagerList();
  } catch (error) {
    els.modalError.textContent = error.message || String(error);
  }
}

function updateTimerDisplay() {
  const minutes = Math.floor(state.timerSeconds / 60).toString().padStart(2, '0');
  const seconds = (state.timerSeconds % 60).toString().padStart(2, '0');
  els.timerDisplay.textContent = `${minutes}:${seconds}`;
  els.timerMode.textContent = state.timerMode;
  localStorage.setItem('timerSeconds', String(state.timerSeconds));
  localStorage.setItem('timerMode', state.timerMode);
}

function startTimer() {
  if (state.timerRunning) return;
  state.timerRunning = true;
  state.timerId = setInterval(() => {
    state.timerSeconds -= 1;
    if (state.timerSeconds <= 0) {
      clearInterval(state.timerId);
      state.timerRunning = false;
      state.timerSeconds = state.timerMode === 'Focus' ? 5 * 60 : 25 * 60;
      state.timerMode = state.timerMode === 'Focus' ? 'Break' : 'Focus';
      setStatus(`${state.timerMode} timer ready`);
    }
    updateTimerDisplay();
  }, 1000);
}

function pauseTimer() {
  clearInterval(state.timerId);
  state.timerRunning = false;
}

function resetTimer(seconds = state.timerMode === 'Focus' ? 25 * 60 : 5 * 60, mode = state.timerMode) {
  pauseTimer();
  state.timerSeconds = seconds;
  state.timerMode = mode;
  updateTimerDisplay();
}

function toggleSidebar() {  const isHidden = els.shell.classList.toggle('sidebar-hidden');
  els.sidebarToggle.textContent = isHidden ? '\u2630' : '\u2715';
  localStorage.setItem('sidebarHidden', isHidden ? '1' : '0');
  // After sidebar animates, re-sync the webview size.
  setTimeout(syncWebviewSize, 320);
}

function initSidebarState() {
  const savedState = localStorage.getItem('sidebarHidden');
  // Default to hidden (sidebar-hidden is already in the HTML).
  const shouldHide = savedState === null || savedState === '1';
  els.shell.classList.toggle('sidebar-hidden', shouldHide);
  els.sidebarToggle.textContent = shouldHide ? '\u2630' : '\u2715';
}

async function setupDefaultBrowserBanner() {
  if (!els.defaultBanner || typeof window.studyBrowser.isDefaultBrowser !== 'function') return;
  try {
    const isDefault = await window.studyBrowser.isDefaultBrowser();
    if (isDefault) return;
    show(els.defaultBanner);
  } catch {
    // Not Windows or unsupported — keep the banner hidden.
  }
}

function bindEvents() {
  els.sidebarToggle.addEventListener('click', toggleSidebar);

  els.addressForm.addEventListener('submit', event => {
    event.preventDefault();
    loadUrl(els.addressInput.value);
  });

  els.backBtn.addEventListener('click', () => {
    if (els.webview.canGoBack()) els.webview.goBack();
  });
  els.forwardBtn.addEventListener('click', () => {
    if (els.webview.canGoForward()) els.webview.goForward();
  });
  els.reloadBtn.addEventListener('click', () => {
    if (!els.webview.classList.contains('hidden')) els.webview.reload();
  });
  els.homeBtn.addEventListener('click', loadHomeSite);
  els.backToHome.addEventListener('click', showHome);
  els.backFromAuth.addEventListener('click', showHome);
  els.openAuthInBrowser.addEventListener('click', () => {
    if (state.externalAuthUrl) {
      requestGoogleAuthExternally(state.externalAuthUrl, state.externalAuthTargetUrl || state.currentUrl);
    }
  });
  els.manageSites.addEventListener('click', openModal);
  els.openManagerFromBlocked.addEventListener('click', openModal);
  els.closeModal.addEventListener('click', closeModal);

  els.setDefaultBtn.addEventListener('click', async () => {
    try {
      await window.studyBrowser.setDefaultBrowser();
    } catch {
      // Registration failed or settings page unavailable — hide the banner.
    }
    hide(els.defaultBanner);
  });
  els.dismissDefaultBtn.addEventListener('click', () => {
    hide(els.defaultBanner);
  });

  els.createPassword.addEventListener('click', async () => {
    const password = els.newPassword.value;
    const confirmPassword = els.confirmPassword.value;
    if (password !== confirmPassword) {
      els.modalError.textContent = 'Passwords do not match.';
      return;
    }
    try {
      const result = await window.studyBrowser.setPassword(password);
      state.token = result.token;
      await refreshConfig(result.config);
      showManager();
    } catch (error) {
      els.modalError.textContent = error.message || String(error);
    }
  });

  els.unlockButton.addEventListener('click', async () => {
    try {
      const result = await window.studyBrowser.unlock(els.passwordInput.value);
      state.token = result.token;
      await refreshConfig(result.config);
      els.passwordInput.value = '';
      showManager();
    } catch (error) {
      els.modalError.textContent = error.message || String(error);
    }
  });

  els.addSite.addEventListener('click', async () => {
    const site = els.siteInput.value.trim();
    if (!site) return;
    await runManagerAction(() => window.studyBrowser.addSite(state.token, site));
    els.siteInput.value = '';
  });

  els.siteInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') els.addSite.click();
  });

  els.lockManager.addEventListener('click', async () => {
    if (state.token) await window.studyBrowser.lock(state.token);
    state.token = null;
    closeModal();
  });

  els.toggleChangePassword.addEventListener('click', () => {
    if (els.changePasswordForm.classList.contains('hidden')) {
      show(els.changePasswordForm);
      els.toggleChangePassword.textContent = 'Hide';
      els.currentPassword.focus();
    } else {
      resetChangePasswordForm();
    }
  });

  els.cancelChangePassword.addEventListener('click', () => {
    resetChangePasswordForm();
  });

  els.submitChangePassword.addEventListener('click', async () => {
    const oldPw = els.currentPassword.value;
    const newPw = els.changeNewPassword.value;
    const confirmPw = els.changeConfirmPassword.value;

    els.changePasswordMessage.textContent = '';
    els.changePasswordMessage.className = 'change-password-msg';

    if (!oldPw) {
      els.changePasswordMessage.textContent = 'Enter your current password.';
      els.changePasswordMessage.classList.add('error');
      return;
    }
    if (newPw.length < 4) {
      els.changePasswordMessage.textContent = 'New password must be at least 4 characters.';
      els.changePasswordMessage.classList.add('error');
      return;
    }
    if (newPw !== confirmPw) {
      els.changePasswordMessage.textContent = 'New passwords do not match.';
      els.changePasswordMessage.classList.add('error');
      return;
    }

    try {
      const result = await window.studyBrowser.changePassword(state.token, oldPw, newPw);
      await refreshConfig(result.config);
      els.changePasswordMessage.textContent = 'Password updated successfully!';
      els.changePasswordMessage.classList.add('success');
      els.currentPassword.value = '';
      els.changeNewPassword.value = '';
      els.changeConfirmPassword.value = '';
    } catch (error) {
      els.changePasswordMessage.textContent = error.message || String(error);
      els.changePasswordMessage.classList.add('error');
    }
  });

  els.modalBackdrop.addEventListener('click', event => {
    if (event.target === els.modalBackdrop) closeModal();
  });

  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'l') {
      event.preventDefault();
      els.addressInput.focus();
      els.addressInput.select();
    }
    if (event.key === 'Escape' && !els.modalBackdrop.classList.contains('hidden')) closeModal();
  });

  els.webview.addEventListener('will-navigate', event => {
    if (!isGoogleAuthUrlLocally(event.url)) return;
    event.preventDefault();
    requestGoogleAuthExternally(event.url, state.currentUrl || els.webview.getURL());
  });
  els.webview.addEventListener('did-start-loading', () => {
    setStatus('Loading…');
    syncWebviewSize();
  });
  els.webview.addEventListener('dom-ready', syncWebviewSize);
  els.webview.addEventListener('did-stop-loading', () => {
    // Show whether the current page is on the allowlist (informational).
    const url = els.webview.getURL();
    const onAllowlist = isAllowedUrlLocally(url);
    setStatus(onAllowlist ? 'Allowed' : 'Browsing', !onAllowlist);
    syncWebviewSize();
    updateNavState();
  });
  els.webview.addEventListener('did-navigate', event => {
    state.currentUrl = event.url;
    els.addressInput.value = event.url;
    updateNavState();
  });
  els.webview.addEventListener('did-navigate-in-page', event => {
    state.currentUrl = event.url;
    els.addressInput.value = event.url;
    updateNavState();
  });
  els.webview.addEventListener('did-fail-load', event => {
    if (event.errorCode === -3) return;
    if (event.isMainFrame) {
      const failedUrl = event.validatedURL || state.currentUrl || '';
      showBlocked(failedUrl);
    }
  });
  els.webview.addEventListener('new-window', event => {
    event.preventDefault();
    if (!event.url) return;

    if (isGoogleAuthUrlLocally(event.url)) {
      // The main process normally handles this before the event arrives. This
      // is a renderer-side fallback for Electron versions that emit new-window
      // without a matching webRequest main-frame callback.
      requestGoogleAuthExternally(event.url, state.currentUrl || els.webview.getURL());
      return;
    }

    // Load ordinary popup URLs directly — sign-in/OAuth URLs are handled above
    // so Google credentials never appear in the embedded webview.
    hide(els.homeScreen);
    hide(els.blockedScreen);
    hide(els.authScreen);
    show(els.webview);
    syncWebviewSize();
    els.addressInput.value = event.url;
    state.currentUrl = event.url;
    els.webview.src = event.url;
  });

  els.timerStart.addEventListener('click', startTimer);
  els.timerPause.addEventListener('click', pauseTimer);
  els.timerReset.addEventListener('click', () => resetTimer());
  els.focus25.addEventListener('click', () => resetTimer(25 * 60, 'Focus'));
  els.break5.addEventListener('click', () => resetTimer(5 * 60, 'Break'));

  els.notes.value = localStorage.getItem('studyNotes') || '';
  els.notes.addEventListener('input', () => localStorage.setItem('studyNotes', els.notes.value));
  els.clearNotes.addEventListener('click', () => {
    if (confirm('Clear local study notes?')) {
      els.notes.value = '';
      localStorage.removeItem('studyNotes');
    }
  });
}

async function init() {
  // Register before the first await so URLs arriving during startup are not
  // missed (main process queues them until the shell has loaded).
  window.studyBrowser.onGoogleAuthExternalized(payload => showExternalAuth(payload));
  window.studyBrowser.onOpenUrl(url => loadUrl(url));
  setupDefaultBrowserBanner();

  state.config = await window.studyBrowser.getConfig();
  renderSites();
  bindEvents();
  initSidebarState();
  updateTimerDisplay();
  showHome();
  updateNavState();

  // Keep the webview's pixel dimensions pinned to the content area at all
  // times, including on window resize. ResizeObserver also fires once
  // immediately on observe(), so this sets the correct initial size too.
  const contentAreaResizeObserver = new ResizeObserver(() => syncWebviewSize());
  contentAreaResizeObserver.observe(els.contentArea);

  // Extra safety net: window resize events that ResizeObserver might miss.
  window.addEventListener('resize', syncWebviewSize);
}

init().catch(error => {
  document.body.innerHTML = `<pre style="color:white;padding:24px">Failed to start: ${error.message || error}</pre>`;
});