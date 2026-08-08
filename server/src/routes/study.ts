import { Router, Response } from 'express';
import crypto from 'crypto';
import { db } from '../config/db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/study/sessions
router.get('/sessions', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const sessionsRes = await db.query(
      'SELECT id, title, duration_seconds, started_at, ended_at FROM study_sessions WHERE user_id = $1 ORDER BY started_at DESC LIMIT 50',
      [userId]
    );
    res.json({ sessions: sessionsRes.rows });
  } catch (err: any) {
    console.error('Get sessions error:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// POST /api/study/sessions
router.post('/sessions', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { title, durationSeconds, startedAt, endedAt } = req.body;
    const sessionId = `sess-${crypto.randomUUID()}`;

    await db.query(
      `INSERT INTO study_sessions (id, user_id, title, duration_seconds, started_at, ended_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        sessionId,
        userId,
        title || 'Focus Session',
        durationSeconds || 1500,
        startedAt || new Date().toISOString(),
        endedAt || new Date().toISOString()
      ]
    );

    res.status(201).json({ success: true, sessionId });
  } catch (err: any) {
    console.error('Create session error:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// GET /api/study/logs
router.get('/logs', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const logsRes = await db.query(
      'SELECT id, requested_url, hostname, status, timestamp FROM navigation_logs WHERE user_id = $1 ORDER BY timestamp DESC LIMIT 50',
      [userId]
    );
    res.json({ logs: logsRes.rows });
  } catch (err: any) {
    console.error('Get logs error:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// POST /api/study/logs
router.post('/logs', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { url, hostname, status } = req.body;
    const logId = `log-${crypto.randomUUID()}`;

    await db.query(
      `INSERT INTO navigation_logs (id, user_id, requested_url, hostname, status)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        logId,
        userId,
        url || '',
        hostname || '',
        status === 'ALLOWED' ? 'ALLOWED' : 'BLOCKED'
      ]
    );

    res.status(201).json({ success: true, logId });
  } catch (err: any) {
    console.error('Create log error:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// GET /api/study/notes
router.get('/notes', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const notesRes = await db.query(
      'SELECT content, updated_at FROM user_notes WHERE user_id = $1',
      [userId]
    );
    const content = notesRes.rows.length > 0 ? notesRes.rows[0].content : '';
    res.json({ content });
  } catch (err: any) {
    console.error('Get notes error:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// PUT /api/study/notes
router.put('/notes', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { content } = req.body;

    await db.query(
      `INSERT INTO user_notes (user_id, content, updated_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id)
       DO UPDATE SET content = EXCLUDED.content, updated_at = CURRENT_TIMESTAMP`,
      [userId, content || '']
    );

    res.json({ success: true });
  } catch (err: any) {
    console.error('Put notes error:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

export default router;
