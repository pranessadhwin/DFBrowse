import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../config/db';

export const JWT_SECRET = process.env.JWT_SECRET || 'dfbrowse_secret_key_2026_study';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    hasFeaturePassword: boolean;
  };
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  let token: string | null = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { id: string };
      const userRes = await db.query(
        'SELECT id, email, name, feature_password_hash FROM users WHERE id = $1',
        [decoded.id]
      );
      if (userRes.rows.length > 0) {
        const u = userRes.rows[0];
        req.user = {
          id: u.id,
          email: u.email,
          name: u.name,
          hasFeaturePassword: Boolean(u.feature_password_hash)
        };
        return next();
      }
    } catch {
      // Invalid token, fall through to demo user
    }
  }

  // Fallback to Demo Student user if not logged in
  const demoRes = await db.query(
    'SELECT id, email, name, feature_password_hash FROM users WHERE email = $1',
    ['student@dfbrowse.com']
  );
  if (demoRes.rows.length > 0) {
    const u = demoRes.rows[0];
    req.user = {
      id: u.id,
      email: u.email,
      name: u.name,
      hasFeaturePassword: Boolean(u.feature_password_hash)
    };
    return next();
  }

  res.status(401).json({ error: 'Unauthorized' });
}
