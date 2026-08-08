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

    // When offline or firewalled, display a genuine Chromium network error page
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(502).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <title>${hostname} - This site can't be reached</title>
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            padding: 40px 20px;
            background: #202124;
            color: #bdc1c6;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 80vh;
          }
          .error-card {
            max-width: 600px;
            width: 100%;
            background: #292a2d;
            border: 1px solid #3c4043;
            border-radius: 12px;
            padding: 36px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          }
          .icon { font-size: 48px; margin-bottom: 20px; }
          h1 {
            color: #e8eaed;
            font-size: 24px;
            font-weight: 500;
            margin: 0 0 12px;
          }
          .error-code {
            color: #8ab4f8;
            font-family: monospace;
            font-size: 14px;
            margin: 0 0 20px;
            padding: 4px 10px;
            background: rgba(138, 180, 248, 0.12);
            border-radius: 6px;
            display: inline-block;
          }
          p {
            line-height: 1.6;
            color: #9aa0a6;
            font-size: 15px;
            margin: 0 0 24px;
          }
          ul {
            color: #9aa0a6;
            line-height: 1.6;
            margin: 0 0 28px 20px;
            padding: 0;
          }
          .btn-row {
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
          }
          button.btn-primary, a.btn-secondary {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 10px 20px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            text-decoration: none;
            transition: all 0.2s;
            border: none;
          }
          button.btn-primary {
            background: #8ab4f8;
            color: #202124;
          }
          button.btn-primary:hover {
            background: #aecbfa;
          }
          a.btn-secondary {
            background: #3c4043;
            color: #e8eaed;
            border: 1px solid #5f6368;
          }
          a.btn-secondary:hover {
            background: #4a4d51;
            border-color: #8ab4f8;
          }
        </style>
      </head>
      <body>
        <div class="error-card">
          <div class="icon">🦖</div>
          <h1>This site can't be reached</h1>
          <div class="error-code">ERR_CONNECTION_TIMED_OUT / ERR_NETWORK_FIREWALL</div>
          <p>
            The official website <strong>${hostname}</strong> (${targetUrl}) could not be loaded from this proxy server.
          </p>
          <p>Try the following:</p>
          <ul>
            <li>Check if your network or sandbox environment allows outbound HTTPS connections to external servers.</li>
            <li>If you are running DFBrowse in desktop Electron mode, official websites load natively without proxy restrictions.</li>
            <li>Click below to open the official website directly in your browser tab.</li>
          </ul>
          <div class="btn-row">
            <button onclick="window.location.reload()" class="btn-primary">↻ Reload Official Website</button>
            <a href="${targetUrl}" target="_blank" rel="noopener noreferrer" class="btn-secondary">↗ Open ${hostname} in Direct Tab</a>
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
