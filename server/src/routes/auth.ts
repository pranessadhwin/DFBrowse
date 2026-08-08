import { Router, Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db } from '../config/db';
import { hashPassword, verifyPassword } from '../utils/password';
import { authMiddleware, AuthRequest, JWT_SECRET } from '../middleware/auth';
import { DEFAULT_ALLOWED_SITES } from '../utils/policy';

const router = Router();

// POST /api/auth/register
router.post('/register', async (req, res: Response): Promise<void> => {
  try {
    const { email, name, password, featurePassword } = req.body;
    if (!email || !password || !name) {
      res.status(400).json({ error: 'Email, name, and password are required.' });
      return;
    }

    const check = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (check.rows.length > 0) {
      res.status(409).json({ error: 'A user with this email already exists.' });
      return;
    }

    const userId = `user-${crypto.randomUUID()}`;
    const pwHash = hashPassword(password);
    const fpwHash = featurePassword ? hashPassword(featurePassword) : null;

    await db.query(
      `INSERT INTO users (id, email, name, password_hash, feature_password_hash)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, email.toLowerCase().trim(), name.trim(), pwHash, fpwHash]
    );

    // Seed default allowed sites
    for (const hostname of DEFAULT_ALLOWED_SITES) {
      const siteId = `site-${crypto.randomUUID()}`;
      await db.query(
        `INSERT INTO allowed_sites (id, user_id, hostname, is_default)
         VALUES ($1, $2, $3, $4)`,
        [siteId, userId, hostname, true]
      );
    }

    // Seed notes
    await db.query(
      `INSERT INTO user_notes (user_id, content) VALUES ($1, $2)`,
      [userId, `Welcome to DFBrowse, ${name}!\n- Strictly focused study browser\n- Allowlists protected by feature password`]
    );

    const token = jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({
      token,
      user: {
        id: userId,
        email: email.toLowerCase().trim(),
        name: name.trim(),
        hasFeaturePassword: Boolean(fpwHash)
      }
    });
  } catch (err: any) {
    console.error('Register error:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const userRes = await db.query(
      'SELECT id, email, name, password_hash, feature_password_hash FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );
    if (userRes.rows.length === 0) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const u = userRes.rows[0];
    if (!verifyPassword(password, u.password_hash)) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const token = jwt.sign({ id: u.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({
      token,
      user: {
        id: u.id,
        email: u.email,
        name: u.name,
        hasFeaturePassword: Boolean(u.feature_password_hash)
      }
    });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  res.json({ user: req.user });
});

// POST /api/auth/feature-password/set
router.post('/feature-password/set', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!newPassword || newPassword.length < 4) {
      res.status(400).json({ error: 'Feature password must be at least 4 characters long.' });
      return;
    }

    const userRes = await db.query(
      'SELECT feature_password_hash FROM users WHERE id = $1',
      [userId]
    );
    const u = userRes.rows[0];

    if (u.feature_password_hash) {
      if (!currentPassword) {
        res.status(400).json({ error: 'Current feature password is required.' });
        return;
      }
      if (!verifyPassword(currentPassword, u.feature_password_hash)) {
        res.status(403).json({ error: 'Incorrect current feature password.' });
        return;
      }
    }

    const newHash = hashPassword(newPassword);
    await db.query(
      'UPDATE users SET feature_password_hash = $1 WHERE id = $2',
      [newHash, userId]
    );

    res.json({ success: true, message: 'Feature password updated successfully.' });
  } catch (err: any) {
    console.error('Feature password set error:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// POST /api/auth/feature-password/verify
router.post('/feature-password/verify', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { password } = req.body;
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const userRes = await db.query(
      'SELECT feature_password_hash FROM users WHERE id = $1',
      [userId]
    );
    const u = userRes.rows[0];

    if (!u.feature_password_hash) {
      // No feature password set yet, unlock immediately
      const unlockToken = jwt.sign({ userId, unlocked: true }, JWT_SECRET, { expiresIn: '15m' });
      res.json({ unlocked: true, unlockToken, hasPassword: false });
      return;
    }

    if (!password) {
      res.status(400).json({ error: 'Please enter your feature password to unlock.' });
      return;
    }

    if (!verifyPassword(password, u.feature_password_hash)) {
      res.status(403).json({ error: 'Incorrect feature password.' });
      return;
    }

    const unlockToken = jwt.sign({ userId, unlocked: true }, JWT_SECRET, { expiresIn: '15m' });
    res.json({ unlocked: true, unlockToken, hasPassword: true });
  } catch (err: any) {
    console.error('Feature password verify error:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

export default router;
