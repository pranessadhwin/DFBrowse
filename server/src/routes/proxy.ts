import { Router, Response } from 'express';
import { db } from '../config/db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { hostnameMatchesAllowed } from '../utils/policy';
import { generateStudyWebpage } from '../utils/studyPageGenerators';

const router = Router();

// GET /api/proxy/check
// Check if a URL or hostname is allowed by the user's allowlist
router.get('/check', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const urlParam = (req.query.url as string) || '';
    if (!urlParam) {
      res.status(400).json({ error: 'URL is required' });
      return;
    }

    let hostname = '';
    let targetUrl = urlParam;
    try {
      if (targetUrl.includes('://')) {
        const parsed = new URL(targetUrl);
        hostname = parsed.hostname;
      } else {
        hostname = targetUrl.split('/')[0];
        targetUrl = 'https://' + targetUrl;
      }
    } catch {
      res.status(400).json({ error: 'Invalid URL structure' });
      return;
    }

    // Get user's allowlist
    const sitesRes = await db.query(
      'SELECT hostname FROM allowed_sites WHERE user_id = $1',
      [userId]
    );
    const allowedHostnames = sitesRes.rows.map(row => row.hostname);

    const allowed = hostnameMatchesAllowed(hostname, allowedHostnames);

    // Record navigation attempt in logs
    const logId = `log-${Date.now()}`;
    await db.query(
      `INSERT INTO navigation_logs (id, user_id, requested_url, hostname, status)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        logId,
        userId || 'demo',
        targetUrl,
        hostname,
        allowed ? 'ALLOWED' : 'BLOCKED'
      ]
    );

    res.json({
      allowed,
      hostname,
      targetUrl,
      reason: allowed ? 'Hostname matches study allowlist' : 'This website is not on your study allowlist.'
    });
  } catch (err: any) {
    console.error('Proxy check error:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// GET /api/proxy/view
// Serves a proxied or simulated study view for allowed websites
router.get('/view', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const urlParam = (req.query.url as string) || '';
    if (!urlParam) {
      res.status(400).send('URL is required.');
      return;
    }

    let hostname = '';
    let targetUrl = urlParam;
    try {
      if (targetUrl.includes('://')) {
        const parsed = new URL(targetUrl);
        hostname = parsed.hostname;
      } else {
        hostname = targetUrl.split('/')[0];
        targetUrl = 'https://' + targetUrl;
      }
    } catch {
      res.status(400).send('Invalid URL structure.');
      return;
    }

    // Get user's allowlist
    const sitesRes = await db.query(
      'SELECT hostname FROM allowed_sites WHERE user_id = $1',
      [userId]
    );
    const allowedHostnames = sitesRes.rows.map(row => row.hostname);
    const allowed = hostnameMatchesAllowed(hostname, allowedHostnames);

    // Log attempt
    const logId = `log-${Date.now()}`;
    await db.query(
      `INSERT INTO navigation_logs (id, user_id, requested_url, hostname, status)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        logId,
        userId || 'demo',
        targetUrl,
        hostname,
        allowed ? 'ALLOWED' : 'BLOCKED'
      ]
    );

    if (!allowed) {
      res.status(403).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Website Blocked - DFBrowse Focus</title>
          <style>
            body {
              margin: 0;
              padding: 40px;
              background: #07101d;
              color: #e6edf7;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 80vh;
            }
            .card {
              background: #0d1b2d;
              border: 1px solid rgba(251, 113, 133, 0.3);
              border-radius: 12px;
              padding: 32px;
              max-width: 480px;
              text-align: center;
              box-shadow: 0 22px 60px rgba(0,0,0,0.4);
            }
            .icon { font-size: 48px; margin-bottom: 16px; }
            h2 { margin: 0 0 12px; color: #fb7185; }
            p { color: #94a3b8; line-height: 1.5; margin-bottom: 24px; }
            .domain {
              background: #10233a;
              color: #e6edf7;
              padding: 8px 16px;
              border-radius: 6px;
              font-family: monospace;
              display: inline-block;
              margin-bottom: 20px;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="icon">⛔</div>
            <h2>Website blocked</h2>
            <div class="domain">${hostname}</div>
            <p>This website is not on your study allowlist. Stay focused on your approved study resources.</p>
          </div>
        </body>
        </html>
      `);
      return;
    }

    // Try fetching the remote HTML directly (when internet is available)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const remoteRes = await fetch(targetUrl, {
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 DFBrowse/1.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const contentType = remoteRes.headers.get('content-type') || '';
      if (remoteRes.ok && contentType.includes('text/html')) {
        let html = await remoteRes.text();
        const baseUrl = new URL(targetUrl).origin;
        html = html.replace(/<head>/i, `<head>\n<base href="${baseUrl}/">\n<style>body { font-family: sans-serif; }</style>`);

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.send(html);
        return;
      }
    } catch {
      // Offline / sandbox firewall fallback -> generate interactive study webpage directly
    }

    // Directly serve interactive study webpage (no intermediate card or button!)
    const studyHtml = generateStudyWebpage(hostname, targetUrl);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(studyHtml);
  } catch (err: any) {
    console.error('Proxy view error:', err);
    res.status(500).send('Error rendering study view.');
  }
});

export default router;
