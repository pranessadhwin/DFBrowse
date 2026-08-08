import crypto from 'crypto';

/**
 * Hashes a plain text password using scrypt with a random salt.
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

/**
 * Verifies a plain text password against a stored hash.
 */
export function verifyPassword(password: string, hash: string): boolean {
  if (!hash || !hash.includes(':')) return false;
  const [salt, key] = hash.split(':');
  const keyBuffer = Buffer.from(key, 'hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(keyBuffer, derivedKey);
}
