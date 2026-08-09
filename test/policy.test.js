'use strict';

const assert = require('assert');
const {
  DEFAULT_ALLOWED_SITES,
  normalizeHostname,
  isAllowedNavigationUrl,
  isAllowedRequestUrl,
  isGoogleAuthUrl
} = require('../src/policy');

assert.strictEqual(normalizeHostname('https://www.github.com/path?q=1'), 'github.com');
assert.strictEqual(normalizeHostname(' gemini.google.com '), 'gemini.google.com');
assert.strictEqual(isAllowedNavigationUrl('https://arena.ai/', DEFAULT_ALLOWED_SITES), true);
assert.strictEqual(isAllowedNavigationUrl('https://www.leetcode.com/problemset/', DEFAULT_ALLOWED_SITES), true);
assert.strictEqual(isAllowedNavigationUrl('https://gist.github.com/', DEFAULT_ALLOWED_SITES), true);
assert.strictEqual(isAllowedNavigationUrl('https://youtube.com/', DEFAULT_ALLOWED_SITES), false);
assert.strictEqual(isAllowedNavigationUrl('https://chat.z.ai/', DEFAULT_ALLOWED_SITES), false);
assert.strictEqual(isAllowedRequestUrl('data:text/plain,hello', DEFAULT_ALLOWED_SITES), true);
assert.strictEqual(isAllowedRequestUrl('file:///etc/passwd', DEFAULT_ALLOWED_SITES), false);
assert.strictEqual(isGoogleAuthUrl('https://accounts.google.com/o/oauth2/v2/auth'), true);
assert.strictEqual(isGoogleAuthUrl('https://login.accounts.google.com/signin'), true);
assert.strictEqual(isGoogleAuthUrl('https://accounts.google.com./signin'), true);
assert.strictEqual(isGoogleAuthUrl('https://accounts.google.com.evil.example/signin'), false);
assert.strictEqual(isGoogleAuthUrl('http://accounts.google.com/signin'), false);
assert.strictEqual(isGoogleAuthUrl('https://gemini.google.com/'), false);

console.log('Policy tests passed.');
