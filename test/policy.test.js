'use strict';

const assert = require('assert');
const {
  DEFAULT_ALLOWED_SITES,
  normalizeHostname,
  normalizeAllowedList,
  isAllowedNavigationUrl,
  isAllowedRequestUrl,
  isAllowedMainFrameUrl,
  isGoogleAuthUrl,
  isGoogleAuthNavigationUrl,
  isGoogleImportHost,
  GOOGLE_AUTH_DOMAINS,
  GOOGLE_CHALLENGE_DOMAINS,
  GOOGLE_IMPORT_DOMAINS
} = require('../src/policy');

assert.strictEqual(normalizeHostname('https://www.github.com/path?q=1'), 'github.com');
assert.strictEqual(normalizeHostname(' gemini.google.com '), 'gemini.google.com');
assert.strictEqual(normalizeAllowedList(['leetcode.com', 'github.com', 'github.com']).length, 2);

assert.strictEqual(isAllowedNavigationUrl('https://arena.ai/', DEFAULT_ALLOWED_SITES), true);
assert.strictEqual(isAllowedNavigationUrl('https://www.leetcode.com/problemset/', DEFAULT_ALLOWED_SITES), true);
assert.strictEqual(isAllowedNavigationUrl('https://gist.github.com/', DEFAULT_ALLOWED_SITES), true);
assert.strictEqual(isAllowedNavigationUrl('https://youtube.com/', DEFAULT_ALLOWED_SITES), false);
assert.strictEqual(isAllowedNavigationUrl('https://chat.z.ai/', DEFAULT_ALLOWED_SITES), false);
assert.strictEqual(isAllowedRequestUrl('data:text/plain,hello', DEFAULT_ALLOWED_SITES), true);
assert.strictEqual(isAllowedRequestUrl('file:///etc/passwd', DEFAULT_ALLOWED_SITES), false);

// Google account/OAuth hosts (https only for the strict check).
assert.strictEqual(isGoogleAuthUrl('https://accounts.google.com/o/oauth2/v2/auth'), true);
assert.strictEqual(isGoogleAuthUrl('https://login.accounts.google.com/signin'), true);
assert.strictEqual(isGoogleAuthUrl('https://accounts.google.com./signin'), true);
assert.strictEqual(isGoogleAuthUrl('https://accounts.google.com.evil.example/signin'), false);
assert.strictEqual(isGoogleAuthUrl('http://accounts.google.com/signin'), false);
assert.strictEqual(isGoogleAuthUrl('https://gemini.google.com/'), false);

// Google auth + challenge domains stay usable for sign-in redirects and popups.
assert.deepStrictEqual(GOOGLE_AUTH_DOMAINS.includes('accounts.google.com'), true);
assert.deepStrictEqual(GOOGLE_CHALLENGE_DOMAINS.includes('google.com'), true);
assert.strictEqual(isGoogleAuthNavigationUrl('https://accounts.google.com/o/oauth2/v2/auth'), true);
assert.strictEqual(isGoogleAuthNavigationUrl('https://accounts.youtube.com/accounts/'), true);
assert.strictEqual(isGoogleAuthNavigationUrl('https://oauth.googleusercontent.com/'), true);
assert.strictEqual(isGoogleAuthNavigationUrl('https://google.com/sorry/index'), true);
assert.strictEqual(isGoogleAuthNavigationUrl('https://www.google.com/recaptcha/enterprise'), true);
assert.strictEqual(isGoogleAuthNavigationUrl('https://recaptcha.net/recaptcha/api.js'), true);
assert.strictEqual(isGoogleAuthNavigationUrl('https://www.gstatic.com/recaptcha/'), true);
assert.strictEqual(isGoogleAuthNavigationUrl('https://youtube.com/'), false);
assert.strictEqual(isGoogleAuthNavigationUrl('http://google.com.evil.example/'), false);
assert.strictEqual(isGoogleAuthNavigationUrl('https://google.com.evil.example/sorry'), false);

// One-time import domains: cookie hosts that belong to a Google session.
assert.deepStrictEqual(GOOGLE_IMPORT_DOMAINS.includes('google.com'), true);
assert.strictEqual(isGoogleImportHost('accounts.google.com'), true);
assert.strictEqual(isGoogleImportHost('.google.com'), true);
assert.strictEqual(isGoogleImportHost('mail.google.com'), true);
assert.strictEqual(isGoogleImportHost('gemini.google.com'), true);
assert.strictEqual(isGoogleImportHost('gstatic.com'), true);
assert.strictEqual(isGoogleImportHost('googleusercontent.com'), true);
assert.strictEqual(isGoogleImportHost('googleapis.com'), true);
assert.strictEqual(isGoogleImportHost('gmail.com'), false);
assert.strictEqual(isGoogleImportHost('google.com.evil.example'), false);

// Main-frame rule: allowlist OR Google sign-in/challenge, plus internal protocols.
assert.strictEqual(isAllowedMainFrameUrl('https://arena.ai/', DEFAULT_ALLOWED_SITES), true);
assert.strictEqual(isAllowedMainFrameUrl('https://gist.github.com/', DEFAULT_ALLOWED_SITES), true);
assert.strictEqual(isAllowedMainFrameUrl('https://accounts.google.com/', DEFAULT_ALLOWED_SITES), true);
assert.strictEqual(isAllowedMainFrameUrl('https://google.com/sorry/', DEFAULT_ALLOWED_SITES), true);
assert.strictEqual(isAllowedMainFrameUrl('https://youtube.com/', DEFAULT_ALLOWED_SITES), false);
assert.strictEqual(isAllowedMainFrameUrl('about:blank', DEFAULT_ALLOWED_SITES), true);
assert.strictEqual(isAllowedMainFrameUrl('data:text/plain,hello', DEFAULT_ALLOWED_SITES), true);
assert.strictEqual(isAllowedMainFrameUrl('file:///etc/passwd', DEFAULT_ALLOWED_SITES), false);

console.log('Policy tests passed.');
