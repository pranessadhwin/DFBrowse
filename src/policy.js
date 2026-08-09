'use strict';

const DEFAULT_ALLOWED_SITES = Object.freeze([
  'arena.ai',
  'artificialanalysis.ai',
  'claude.ai',
  'geeksforgeeks.org',
  'gemini.google.com',
  'github.com',
  'grok.com',
  'kimi.com',
  'leetcode.com',
  'notebooklm.google.com'
]);

const SAFE_INTERNAL_PROTOCOLS = new Set([
  'about:',
  'blob:',
  'data:',
  'devtools:',
  'chrome:',
  'chrome-error:'
]);

// Hosts that belong to the Google account / OAuth sign-in flow.  Google
// sign-in is kept inside DFBrowse (the study view presents itself as Chrome),
// so these hosts must be able to load even though they are not on the study
// allowlist.  Subdomains match automatically (accounts.google.com covers
// login.accounts.google.com, etc.).
const GOOGLE_AUTH_DOMAINS = Object.freeze([
  'accounts.google.com',
  'accounts.youtube.com',
  'oauth.googleusercontent.com'
]);

// Google's anti-abuse / challenge pages (CAPTCHA, "unusual traffic",
// account recovery, recaptcha) live on these hosts and can appear in the
// middle of an otherwise normal sign-in redirect chain.
const GOOGLE_CHALLENGE_DOMAINS = Object.freeze([
  'google.com',
  'googleusercontent.com',
  'gstatic.com',
  'recaptcha.net'
]);

function normalizeHostname(input) {
  if (typeof input !== 'string') {
    throw new Error('Site must be text.');
  }

  let value = input.trim().toLowerCase();
  if (!value) {
    throw new Error('Site cannot be empty.');
  }

  if (value.includes('://')) {
    const parsed = new URL(value);
    value = parsed.hostname;
  } else {
    value = value.split('/')[0].split('?')[0].split('#')[0];
    if (value.includes('@')) {
      throw new Error('Enter a domain name, not a username/password URL.');
    }
    if (value.startsWith('[') || value.includes(']')) {
      throw new Error('IP literals are not supported in the focus allowlist.');
    }
    value = value.split(':')[0];
  }

  value = value.replace(/^www\./, '').replace(/^\.+|\.+$/g, '');

  if (!value.includes('.')) {
    throw new Error('Enter a full domain, for example example.com.');
  }

  if (!/^[a-z0-9.-]+$/.test(value)) {
    throw new Error('Use letters, numbers, hyphens, and dots only.');
  }

  const labels = value.split('.');
  if (labels.some(label => !label || label.length > 63 || label.startsWith('-') || label.endsWith('-'))) {
    throw new Error('Invalid domain label.');
  }

  return value;
}

function normalizeAllowedList(sites) {
  return [...new Set((sites || []).map(normalizeHostname))].sort((a, b) => a.localeCompare(b));
}

function hostnameMatchesAllowed(hostname, allowedSites) {
  if (!hostname) return false;
  const host = hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
  const sites = normalizeAllowedList(allowedSites);
  return sites.some(site => host === site || host.endsWith(`.${site}`));
}

function hostnameMatchesDomains(hostname, domains) {
  if (!hostname) return false;
  const host = String(hostname).toLowerCase().replace(/\.$/, '');
  return domains.some(domain => host === domain || host.endsWith(`.${domain}`));
}

function isAllowedNavigationUrl(url, allowedSites) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    return hostnameMatchesAllowed(parsed.hostname, allowedSites);
  } catch {
    return false;
  }
}

function isAllowedRequestUrl(url, allowedSites) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return hostnameMatchesAllowed(parsed.hostname, allowedSites);
    }
    return SAFE_INTERNAL_PROTOCOLS.has(parsed.protocol);
  } catch {
    return false;
  }
}

// Google deliberately rejects OAuth and account sign-in requests made from
// embedded browsers such as Electron webviews.  Keeping this check in the
// policy module means the main process and the tests use exactly the same
// hostname rules (and avoids accidentally treating accounts.google.com.evil.com
// as a Google host).
function isGoogleAuthUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    return hostnameMatchesDomains(parsed.hostname, GOOGLE_AUTH_DOMAINS);
  } catch {
    return false;
  }
}

// Broader check used for redirects, popups, and top-level loads: any Google
// sign-in host OR any Google challenge/anti-abuse host.  This keeps the
// whole sign-in flow (including CAPTCHA and "verify it's you" pages) inside
// DFBrowse instead of bouncing the user out of the app.
function isGoogleAuthNavigationUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    return (
      hostnameMatchesDomains(parsed.hostname, GOOGLE_AUTH_DOMAINS) ||
      hostnameMatchesDomains(parsed.hostname, GOOGLE_CHALLENGE_DOMAINS)
    );
  } catch {
    return false;
  }
}

// Full rule for a top-level (main-frame) load inside the study view: the
// study allowlist, the Google sign-in/challenge carve-out, or Chromium's own
// internal protocols (about:blank, data:, blob:, chrome-error:, …).
function isAllowedMainFrameUrl(url, allowedSites) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return isAllowedNavigationUrl(url, allowedSites) || isGoogleAuthNavigationUrl(url);
    }
    return SAFE_INTERNAL_PROTOCOLS.has(parsed.protocol);
  } catch {
    return false;
  }
}

module.exports = {
  DEFAULT_ALLOWED_SITES,
  GOOGLE_AUTH_DOMAINS,
  GOOGLE_CHALLENGE_DOMAINS,
  SAFE_INTERNAL_PROTOCOLS,
  normalizeHostname,
  normalizeAllowedList,
  hostnameMatchesAllowed,
  isAllowedNavigationUrl,
  isAllowedRequestUrl,
  isAllowedMainFrameUrl,
  isGoogleAuthUrl,
  isGoogleAuthNavigationUrl
};
