import { Router, Response } from 'express';
import { db } from '../config/db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { hostnameMatchesAllowed } from '../utils/policy';

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
// Professional reverse-proxy for official study websites
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

    // Log navigation attempt
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

    // Attempt to fetch the official website from targetUrl
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const remoteRes = await fetch(targetUrl, {
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 DFBrowse/1.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const contentType = remoteRes.headers.get('content-type') || '';
      if (remoteRes.ok && contentType.includes('text/html')) {
        let html = await remoteRes.text();
        const baseUrl = new URL(targetUrl).origin;

        // Strip any iframe-breaking meta tags from html
        html = html.replace(/<meta[^>]*http-equiv=["']?X-Frame-Options["']?[^>]*>/gi, '');
        html = html.replace(/<meta[^>]*http-equiv=["']?Content-Security-Policy["']?[^>]*>/gi, '');

        // Inject base tag and navigation interceptor script into <head>
        const injection = `
          <base href="${baseUrl}/">
          <script>
            // Ensure clicks on hyperlinks navigate within the DFBrowse study proxy
            document.addEventListener('click', function(e) {
              const link = e.target.closest('a');
              if (link && link.href && !link.href.startsWith('javascript:')) {
                e.preventDefault();
                window.location.href = '/api/proxy/view?url=' + encodeURIComponent(link.href);
              }
            }, true);
          </script>
        `;
        html = html.replace(/<head[^>]*>/i, `$&${injection}`);

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.send(html);
        return;
      }
    } catch (fetchErr: any) {
      console.warn(`[DFBrowse Proxy] Could not fetch official website ${targetUrl}:`, fetchErr.message);
    }

    // ALWAYS return HTTP 200 OK so Cloudflare does NOT show a 502 Bad Gateway error page!
    // Display official study launcher screen for the verified allowlisted domain
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <title>${hostname} - Official Study Website</title>
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            padding: 40px 20px;
            background: #07101d;
            color: #e6edf7;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 80vh;
          }
          .card {
            max-width: 640px;
            width: 100%;
            background: #0d1b2d;
            border: 1px solid rgba(87, 166, 255, 0.3);
            border-radius: 16px;
            padding: 36px;
            box-shadow: 0 22px 60px rgba(0, 0, 0, 0.4);
            text-align: center;
          }
          .badge {
            display: inline-block;
            padding: 6px 14px;
            border-radius: 999px;
            font-size: 12px;
            font-weight: 600;
            background: rgba(34, 197, 94, 0.16);
            color: #22c55e;
            margin-bottom: 20px;
          }
          h1 {
            color: #fff;
            font-size: 26px;
            font-weight: 700;
            margin: 0 0 10px;
          }
          .url-sub {
            color: #57a6ff;
            font-family: monospace;
            font-size: 14px;
            margin-bottom: 24px;
            word-break: break-all;
          }
          p {
            line-height: 1.6;
            color: #94a3b8;
            font-size: 15px;
            margin: 0 0 28px;
            max-width: 520px;
            margin-left: auto;
            margin-right: auto;
          }
          .btn-row {
            display: flex;
            gap: 14px;
            justify-content: center;
            flex-wrap: wrap;
          }
          a.btn-primary {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 14px 28px;
            border-radius: 10px;
            font-size: 15px;
            font-weight: 600;
            cursor: pointer;
            text-decoration: none;
            transition: all 0.2s;
            background: linear-gradient(135deg, #2563eb, #57a6ff);
            color: #fff;
            box-shadow: 0 8px 20px rgba(37, 99, 235, 0.35);
          }
          a.btn-primary:hover {
            filter: brightness(1.1);
            transform: translateY(-2px);
          }
          button.btn-secondary {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 14px 22px;
            border-radius: 10px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            background: #10233a;
            color: #e6edf7;
            border: 1px solid rgba(148, 163, 184, 0.25);
          }
          button.btn-secondary:hover {
            background: #1e3a5f;
            border-color: #57a6ff;
          }
          .info-box {
            margin-top: 32px;
            padding: 16px;
            border-radius: 10px;
            background: rgba(16, 35, 58, 0.8);
            border: 1px solid rgba(148, 163, 184, 0.15);
            font-size: 13px;
            color: #94a3b8;
            text-align: left;
            line-height: 1.5;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="badge">✓ ALLOWLIST VERIFIED STUDY DOMAIN</div>
          <h1>${hostname}</h1>
          <div class="url-sub">${targetUrl}</div>
          <p>
            You are browsing <strong>${hostname}</strong> in DFBrowse Focus Allowlist Mode.
            Click below to open the official website directly in your active study tab.
          </p>
          <div class="btn-row">
            <a href="${targetUrl}" target="_blank" rel="noopener noreferrer" class="btn-primary">
              ↗ Open Official ${hostname} Website
            </a>
            <button onclick="window.location.reload()" class="btn-secondary">
              ↻ Retry Proxy Stream
            </button>
          </div>
          <div class="info-box">
            <strong>Professional Browser Mode:</strong>
            In standard web browsers and cloud preview environments, official third-party websites (${hostname}) use strict CORS and frame-security headers.
            To browse ${hostname} directly inside an integrated tab without popouts, run DFBrowse in Desktop Electron Mode (<code>npm run start:electron</code>).
          </div>
        </div>
      </body>
      </html>
    `);
  } catch (err: any) {
    console.error('Proxy view error:', err);
    res.status(500).send('Error rendering study view.');
  }
});

export default router;
