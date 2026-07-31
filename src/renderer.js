'use strict';

const $ = selector => document.querySelector(selector);

const state = {
  config: null,
  token: null,
  timerSeconds: Number(localStorage.getItem('timerSeconds')) || 25 * 60,
  timerMode: localStorage.getItem('timerMode') || 'Focus',
  timerRunning: false,
  timerId: null,
  currentUrl: null
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
  timerDisplay: $('#timerDisplay'),
  timerMode: $('#timerMode'),
  timerStart: $('#timerStart'),
  timerPause: $('#timerPause'),
  timerReset: $('#timerReset'),
  focus25: $('#focus25'),
  break5: $('#break5'),
  notes: $('#notes'),
  clearNotes: $('#clearNotes')
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

function showHome() {
  hide(els.webview);
  hide(els.blockedScreen);
  show(els.homeScreen);
  els.addressInput.value = '';
  setStatus('Ready');
}

function showBlocked(url) {
  hide(els.webview);
  hide(els.homeScreen);
  show(els.blockedScreen);
  els.blockedMessage.textContent = `${url || 'That address'} is not on the study allowlist.`;
  els.addressInput.value = url || '';
  setStatus('Blocked', true);
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
}

function showManager() {
  els.modalTitle.textContent = 'Manage allowed websites';
  els.modalSubtitle.textContent = 'Only these websites can load in the study browser.';
  hide(els.passwordSetup);
  hide(els.unlockSection);
  show(els.managerSection);
  renderManagerList();
  els.siteInput.focus();
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
  els.manageSites.addEventListener('click', openModal);
  els.openManagerFromBlocked.addEventListener('click', openModal);
  els.closeModal.addEventListener('click', closeModal);

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
    // Load popup URLs directly — sign-in/OAuth flows open new windows that
    // must not be blocked by the address-bar allowlist.
    if (event.url) {
      hide(els.homeScreen);
      hide(els.blockedScreen);
      show(els.webview);
      syncWebviewSize();
      els.addressInput.value = event.url;
      state.currentUrl = event.url;
      els.webview.src = event.url;
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

async function init() {
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