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

module.exports = {
  DEFAULT_ALLOWED_SITES,
  normalizeHostname,
  normalizeAllowedList,
  hostnameMatchesAllowed,
  isAllowedNavigationUrl,
  isAllowedRequestUrl
};
