'use strict';

const assert = require('assert');
const {
  DEFAULT_ALLOWED_SITES,
  normalizeHostname,
  isAllowedNavigationUrl,
  isAllowedRequestUrl
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

console.log('Policy tests passed.');
