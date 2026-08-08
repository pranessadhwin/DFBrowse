import { Router, Response } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { db } from '../config/db';
import { authMiddleware, AuthRequest, JWT_SECRET } from '../middleware/auth';
import { normalizeHostname, DEFAULT_ALLOWED_SITES } from '../utils/policy';

const router = Router();

function verifyUnlockToken(token: string | undefined, userId: string): boolean {
  if (!token) return false;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; unlocked: boolean };
    return decoded.userId === userId && decoded.unlocked === true;
  } catch {
    return false;
  }
}

// GET /api/allowlist
router.get('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const sitesRes = await db.query(
      'SELECT id, hostname, is_default, added_at FROM allowed_sites WHERE user_id = $1 ORDER BY hostname ASC',
      [userId]
    );
    res.json({ sites: sitesRes.rows });
  } catch (err: any) {
    console.error('Get allowlist error:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// POST /api/allowlist
router.post('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { site, unlockToken } = req.body;
    const tokenHeader = req.headers['x-unlock-token'] as string;
    const token = unlockToken || tokenHeader;

    // Check if user has a feature password
    const userRes = await db.query('SELECT feature_password_hash FROM users WHERE id = $1', [userId]);
    const u = userRes.rows[0];
    if (u.feature_password_hash) {
      if (!verifyUnlockToken(token, userId)) {
        res.status(403).json({ error: 'Allowlist manager locked. Please verify your feature password first.' });
        return;
      }
    }

    let normalized: string;
    try {
      normalized = normalizeHostname(site);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
      return;
    }

    const dupCheck = await db.query(
      'SELECT id FROM allowed_sites WHERE user_id = $1 AND hostname = $2',
      [userId, normalized]
    );
    if (dupCheck.rows.length > 0) {
      res.status(409).json({ error: `${normalized} is already on your allowlist.` });
      return;
    }

    const siteId = `site-${crypto.randomUUID()}`;
    await db.query(
      `INSERT INTO allowed_sites (id, user_id, hostname, is_default)
       VALUES ($1, $2, $3, $4)`,
      [siteId, userId, normalized, false]
    );

    const updatedRes = await db.query(
      'SELECT id, hostname, is_default, added_at FROM allowed_sites WHERE user_id = $1 ORDER BY hostname ASC',
      [userId]
    );

    res.status(201).json({ success: true, site: { id: siteId, hostname: normalized, is_default: false }, sites: updatedRes.rows });
  } catch (err: any) {
    console.error('Add allowlist error:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// DELETE /api/allowlist/:id
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const tokenHeader = req.headers['x-unlock-token'] as string;
    const token = (req.query.unlockToken as string) || tokenHeader;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const userRes = await db.query('SELECT feature_password_hash FROM users WHERE id = $1', [userId]);
    const u = userRes.rows[0];
    if (u.feature_password_hash) {
      if (!verifyUnlockToken(token, userId)) {
        res.status(403).json({ error: 'Allowlist manager locked. Please verify your feature password first.' });
        return;
      }
    }

    const deleteRes = await db.query(
      'DELETE FROM allowed_sites WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (deleteRes.rows.length === 0) {
      res.status(404).json({ error: 'Site not found.' });
      return;
    }

    const updatedRes = await db.query(
      'SELECT id, hostname, is_default, added_at FROM allowed_sites WHERE user_id = $1 ORDER BY hostname ASC',
      [userId]
    );

    res.json({ success: true, deletedId: id, sites: updatedRes.rows });
  } catch (err: any) {
    console.error('Delete allowlist error:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// POST /api/allowlist/reset
router.post('/reset', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const tokenHeader = req.headers['x-unlock-token'] as string;
    const token = req.body.unlockToken || tokenHeader;

    const userRes = await db.query('SELECT feature_password_hash FROM users WHERE id = $1', [userId]);
    const u = userRes.rows[0];
    if (u.feature_password_hash) {
      if (!verifyUnlockToken(token, userId)) {
        res.status(403).json({ error: 'Allowlist manager locked. Please verify your feature password first.' });
        return;
      }
    }

    await db.query('DELETE FROM allowed_sites WHERE user_id = $1', [userId]);

    for (const hostname of DEFAULT_ALLOWED_SITES) {
      const siteId = `site-${crypto.randomUUID()}`;
      await db.query(
        `INSERT INTO allowed_sites (id, user_id, hostname, is_default)
         VALUES ($1, $2, $3, $4)`,
        [siteId, userId, hostname, true]
      );
    }

    const updatedRes = await db.query(
      'SELECT id, hostname, is_default, added_at FROM allowed_sites WHERE user_id = $1 ORDER BY hostname ASC',
      [userId]
    );

    res.json({ success: true, sites: updatedRes.rows });
  } catch (err: any) {
    console.error('Reset allowlist error:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

export default router;
