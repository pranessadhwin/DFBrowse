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
  // The native BrowserView is attached whenever a page is on screen. The
  // shell keeps this in sync with the visible screen (home / blocked hide it).
  viewVisible: false,
  viewWasVisible: false,
  // One-time Google account import flow.
  importPhase: 'idle'
};

const els = {
  shell: $('.shell'),
  sidebarToggle: $('#sidebarToggle'),
  siteList: $('#siteList'),
  quickLinks: $('#quickLinks'),
  contentArea: $('#contentArea'),
  homeScreen: $('#homeScreen'),
  blockedScreen: $('#blockedScreen'),
  blockedMessage: $('#blockedMessage'),
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
  dismissDefaultBtn: $('#dismissDefaultBrowser'),
  importBtn: $('#importBtn'),
  importAccountsBtn: $('#importAccountsBtn'),
  importOverlay: $('#importOverlay'),
  closeImport: $('#closeImport'),
  importSteps: $('#importSteps'),
  importStatus: $('#importStatus'),
  importFinishBtn: $('#importFinishBtn'),
  importMoreBtn: $('#importMoreBtn'),
  importRetryBtn: $('#importRetryBtn'),
  importCloseBtn: $('#importCloseBtn'),
  importCancelBtn: $('#importCancelBtn')
};

function show(element) {
  element.classList.remove('hidden');
}

function hide(element) {
  element.classList.add('hidden');
}

// The study view is a native BrowserView owned by the main process, so the
// shell reports where it should sit on screen (below the toolbar and banner,
// next to the sidebar) and whether it should be visible at all.
function syncViewState() {
  if (!state.viewVisible) {
    window.studyBrowser.setViewState({ visible: false });
    return;
  }
  const rect = els.contentArea.getBoundingClientRect();
  window.studyBrowser.setViewState({
    visible: true,
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height)
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

function showHome() {
  state.viewVisible = false;
  hide(els.blockedScreen);
  show(els.homeScreen);
  els.addressInput.value = '';
  setStatus('Ready');
  updateNavState(false, false);
  syncViewState();
}

function showBlocked(url) {
  state.viewVisible = false;
  hide(els.homeScreen);
  show(els.blockedScreen);
  els.blockedMessage.textContent = `${url || 'That address'} is not on the study allowlist.`;
  els.addressInput.value = url || '';
  setStatus('Blocked', true);
  syncViewState();
}

// Attach the BrowserView and hide the shell's overlay screens.
function showPage() {
  hide(els.homeScreen);
  hide(els.blockedScreen);
  state.viewVisible = true;
  syncViewState();
}

async function loadUrl(raw) {
  const url = inputToUrl(raw);
  if (!url) {
    showBlocked(raw || 'Invalid address');
    return;
  }

  const result = await window.studyBrowser.navigate(url);
  if (!result || !result.ok) {
    showBlocked(result && result.url ? result.url : url);
    return;
  }

  showPage();
  setStatus('Loading…');
  els.addressInput.value = url;
  state.currentUrl = url;
}

async function loadHomeSite() {
  const homeSite = state.config.homeSite || state.config.allowedSites[0];
  if (!homeSite) {
    showHome();
    return;
  }
  const result = await window.studyBrowser.navigate(`https://${homeSite}`);
  if (!result || !result.ok) {
    showHome();
    return;
  }
  showPage();
  setStatus('Loading…');
  els.addressInput.value = `https://${homeSite}`;
  state.currentUrl = `https://${homeSite}`;
}

function updateNavState(canGoBack = false, canGoForward = false) {
  els.backBtn.disabled = !canGoBack;
  els.forwardBtn.disabled = !canGoForward;
}

function openModal() {
  // The site-manager modal covers the whole window, so the BrowserView (which
  // renders above the shell DOM) must be detached while it is open.
  state.viewWasVisible = state.viewVisible;
  state.viewVisible = false;
  syncViewState();

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
  if (state.viewWasVisible) {
    state.viewVisible = true;
    state.viewWasVisible = false;
    syncViewState();
  }
}

// ── One-time Google account import ──────────────────────────────────────────

function setImportStep(step, done) {
  const item = els.importSteps.querySelector(`[data-step="${step}"]`);
  if (!item) return;
  item.classList.toggle('done', Boolean(done));
}

function resetImportUi() {
  setImportStep('open', false);
  setImportStep('signin', false);
  setImportStep('import', false);
}

function setImportButtons({ finish = false, more = false, retry = false, closeBtn = false, cancel = true }) {
  els.importFinishBtn.classList.toggle('hidden', !finish);
  els.importMoreBtn.classList.toggle('hidden', !more);
  els.importRetryBtn.classList.toggle('hidden', !retry);
  els.importCloseBtn.classList.toggle('hidden', !closeBtn);
  els.importCancelBtn.classList.toggle('hidden', !cancel);
}

function applyImportStatus(payload) {
  const phase = payload && payload.phase ? payload.phase : 'idle';
  state.importPhase = phase;
  els.importStatus.textContent = (payload && payload.message) || '';
  els.importStatus.classList.toggle('error', Boolean(payload && payload.error));
  els.importStatus.classList.toggle('success', phase === 'done');

  switch (phase) {
    case 'opening':
      resetImportUi();
      setImportStep('open', false);
      setImportButtons({ cancel: true });
      break;
    case 'needs-close':
    case 'waiting':
      resetImportUi();
      setImportStep('open', true);
      setImportButtons({ cancel: true });
      break;
    case 'signed-in':
      setImportStep('open', true);
      setImportStep('signin', true);
      setImportButtons({ finish: true, more: true, cancel: true });
      break;
    case 'importing':
      setImportStep('open', true);
      setImportStep('signin', true);
      setImportButtons({ cancel: true });
      break;
    case 'done':
      setImportStep('open', true);
      setImportStep('signin', true);
      setImportStep('import', true);
      setImportButtons({ closeBtn: true, cancel: false });
      break;
    case 'cancelled':
      setImportButtons({ retry: true, closeBtn: true, cancel: false });
      break;
    case 'error':
      setImportButtons({ retry: true, closeBtn: true, cancel: false });
      break;
    default:
      setImportButtons({ cancel: true });
  }
}

function openImportModal() {
  // The overlay covers the whole window, so the BrowserView (which renders
  // above the shell DOM) must be detached while it is open.
  state.viewWasVisible = state.viewVisible;
  state.viewVisible = false;
  syncViewState();

  resetImportUi();
  applyImportStatus({ phase: 'opening', message: 'Starting…' });
  show(els.importOverlay);

  window.studyBrowser.importAccounts().then(result => {
    if (result && result.started === false && !result.error) {
      applyImportStatus({ phase: 'error', message: 'Import could not start.', error: true });
    }
  }).catch(() => {
    applyImportStatus({ phase: 'error', message: 'Import could not start.', error: true });
  });
}

function closeImportModal(restoreView = true) {
  if (restoreView && state.viewWasVisible) {
    state.viewVisible = true;
    state.viewWasVisible = false;
    syncViewState();
    // Cookies may have changed during the import — refresh the open page so
    // the imported sessions take effect immediately.
    if (state.importPhase === 'done') window.studyBrowser.reload();
  }
  hide(els.importOverlay);
  state.importPhase = 'idle';
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

function toggleSidebar() {
  const isHidden = els.shell.classList.toggle('sidebar-hidden');
  els.sidebarToggle.textContent = isHidden ? '\u2630' : '\u2715';
  localStorage.setItem('sidebarHidden', isHidden ? '1' : '0');
  // After the sidebar animation finishes, re-position the BrowserView.
  setTimeout(syncViewState, 320);
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
    // The banner pushes the content area down, so the view must move too.
    syncViewState();
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
    if (state.viewVisible) window.studyBrowser.goBack();
  });
  els.forwardBtn.addEventListener('click', () => {
    if (state.viewVisible) window.studyBrowser.goForward();
  });
  els.reloadBtn.addEventListener('click', () => {
    if (state.viewVisible) window.studyBrowser.reload();
  });
  els.homeBtn.addEventListener('click', loadHomeSite);
  els.backToHome.addEventListener('click', showHome);
  els.manageSites.addEventListener('click', openModal);
  els.openManagerFromBlocked.addEventListener('click', openModal);
  els.closeModal.addEventListener('click', closeModal);

  // One-time Google account import.
  els.importBtn.addEventListener('click', openImportModal);
  els.importAccountsBtn.addEventListener('click', openImportModal);
  els.closeImport.addEventListener('click', () => {
    if (state.importPhase !== 'importing') {
      if (state.importPhase !== 'done' && state.importPhase !== 'cancelled' && state.importPhase !== 'error') {
        window.studyBrowser.cancelImport();
      }
      closeImportModal();
    }
  });
  els.importFinishBtn.addEventListener('click', () => window.studyBrowser.finishImport());
  els.importMoreBtn.addEventListener('click', () => window.studyBrowser.keepWaitingImport());
  els.importRetryBtn.addEventListener('click', () => {
    closeImportModal(false);
    setTimeout(openImportModal, 150);
  });
  els.importCloseBtn.addEventListener('click', () => closeImportModal());

  els.setDefaultBtn.addEventListener('click', async () => {
    try {
      await window.studyBrowser.setDefaultBrowser();
    } catch {
      // Registration failed or settings page unavailable — hide the banner.
    }
    hide(els.defaultBanner);
    syncViewState();
  });
  els.dismissDefaultBtn.addEventListener('click', () => {
    hide(els.defaultBanner);
    syncViewState();
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
    if (event.key === 'Escape' && !els.importOverlay.classList.contains('hidden') && state.importPhase !== 'importing') {
      if (state.importPhase !== 'done' && state.importPhase !== 'cancelled' && state.importPhase !== 'error') {
        window.studyBrowser.cancelImport();
      }
      closeImportModal();
    }
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

// State updates pushed from the main process (the BrowserView lives there).
function registerMainProcessEvents() {
  window.studyBrowser.onUrlChanged(({ url, canGoBack, canGoForward }) => {
    state.currentUrl = url || state.currentUrl;
    els.addressInput.value = url || '';
    updateNavState(canGoBack, canGoForward);
  });

  window.studyBrowser.onLoading(({ isLoading }) => {
    if (!state.viewVisible) return;
    if (isLoading) {
      setStatus('Loading…');
    } else {
      const onAllowlist = isAllowedUrlLocally(state.currentUrl || '');
      setStatus(onAllowlist ? 'Allowed' : 'Browsing', !onAllowlist);
      updateNavState();
    }
  });

  window.studyBrowser.onBlocked(({ url }) => {
    if (state.viewVisible) showBlocked(url || state.currentUrl || '');
  });

  window.studyBrowser.onImportStatus(payload => applyImportStatus(payload));
}

async function init() {
  // Register before the first await so URLs arriving during startup are not
  // missed (main process queues them until the shell has loaded).
  registerMainProcessEvents();
  window.studyBrowser.onOpenUrl(url => loadUrl(url));
  setupDefaultBrowserBanner();

  state.config = await window.studyBrowser.getConfig();
  renderSites();
  bindEvents();
  initSidebarState();
  updateTimerDisplay();
  showHome();
  updateNavState(false, false);

  // Keep the BrowserView pinned to the content area (toolbar/banner above it,
  // sidebar to its left) whenever the shell layout changes.
  const contentAreaResizeObserver = new ResizeObserver(() => syncViewState());
  contentAreaResizeObserver.observe(els.contentArea);

  // Extra safety net: window resize events that ResizeObserver might miss.
  window.addEventListener('resize', syncViewState);
}

init().catch(error => {
  document.body.innerHTML = `<pre style="color:white;padding:24px">Failed to start: ${error.message || error}</pre>`;
});
