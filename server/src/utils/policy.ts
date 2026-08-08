export const DEFAULT_ALLOWED_SITES: readonly string[] = Object.freeze([
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

export const SAFE_INTERNAL_PROTOCOLS = new Set([
  'about:',
  'blob:',
  'data:',
  'devtools:',
  'chrome:',
  'chrome-error:'
]);

export function normalizeHostname(input: string): string {
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

export function normalizeAllowedList(sites: string[]): string[] {
  return [...new Set((sites || []).map(s => {
    try {
      return normalizeHostname(s);
    } catch {
      return null;
    }
  }).filter((s): s is string => s !== null))].sort((a, b) => a.localeCompare(b));
}

export function hostnameMatchesAllowed(hostname: string, allowedSites: string[]): boolean {
  if (!hostname) return false;
  const host = hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
  const sites = normalizeAllowedList(allowedSites);
  return sites.some(site => host === site || host.endsWith(`.${site}`));
}

export function isAllowedNavigationUrl(url: string, allowedSites: string[]): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    return hostnameMatchesAllowed(parsed.hostname, allowedSites);
  } catch {
    return false;
  }
}

export function isAllowedRequestUrl(url: string, allowedSites: string[]): boolean {
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
