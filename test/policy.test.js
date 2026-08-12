'use strict';

const assert = require('assert');
const {
  DEFAULT_ALLOWED_SITES,
  normalizeHostname,
  isAllowedNavigationUrl,
  isAllowedRequestUrl,
  isGoogleAuthUrl,
  normalizeEmailAddress
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

// Stored sign-in identities (email only — never passwords).
assert.strictEqual(normalizeEmailAddress('  User@Example.COM '), 'user@example.com');
assert.strictEqual(normalizeEmailAddress('a.b+c@sub.example.co.uk'), 'a.b+c@sub.example.co.uk');
assert.throws(() => normalizeEmailAddress(''), /cannot be empty/i);
assert.throws(() => normalizeEmailAddress('not-an-email'), /valid email/i);
assert.throws(() => normalizeEmailAddress('a@b'), /valid email/i);
assert.throws(() => normalizeEmailAddress(null), /must be text/i);

console.log('Policy tests passed.');
