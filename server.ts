import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { initializeDatabase } from './server/db/database.ts';
import { apiRouter } from './server/routes/api.ts';
import { exchangeMetaCodeForToken, getAppBaseUrl, syncLiveMetaAccount } from './server/services/metaService.ts';
import { exchangeTikTokCodeForToken, syncLiveTikTokAccount } from './server/services/tiktokService.ts';

async function startServer() {
  initializeDatabase();

  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '2mb' }));

  // Mount REST API & Meta/TikTok Webhook routes
  app.use('/api', apiRouter);

  // Meta OAuth Popup Callback (handles both /auth/meta/callback and trailing slash)
  app.get(['/auth/meta/callback', '/auth/meta/callback/'], async (req: Request, res: Response) => {
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const errorMessage = typeof req.query.error_description === 'string' ? req.query.error_description : '';

    if (errorMessage || !code) {
      res.status(400).send(`
        <!doctype html>
        <html>
          <body style="font-family: Inter, sans-serif; background: #F9FBFF; color: #091F5C; padding: 32px;">
            <h2>Meta Authorization Incomplete</h2>
            <p>${errorMessage || 'Authorization code was not returned by Meta.'}</p>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_ERROR', provider: 'meta', error: ${JSON.stringify(errorMessage || 'Missing code')} }, '*');
                setTimeout(() => window.close(), 1200);
              }
            </script>
          </body>
        </html>
      `);
      return;
    }

    try {
      const baseUrl = getAppBaseUrl(`${req.protocol}://${req.get('host')}`);
      const redirectUri = `${baseUrl}/auth/meta/callback`;
      const { accessToken } = await exchangeMetaCodeForToken(code, redirectUri);
      await syncLiveMetaAccount(accessToken);

      res.send(`
        <!doctype html>
        <html>
          <body style="font-family: Inter, sans-serif; background: #F9FBFF; color: #091F5C; padding: 32px;">
            <h2>Meta Business Connected</h2>
            <p>Your Meta Ad Account and Pages are now synced with Clearline CRM. This window will close automatically.</p>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', provider: 'meta' }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
          </body>
        </html>
      `);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Meta token exchange failed';
      res.status(500).send(`
        <!doctype html>
        <html>
          <body style="font-family: Inter, sans-serif; background: #F9FBFF; color: #091F5C; padding: 32px;">
            <h2>Meta Connection Failed</h2>
            <p>${msg}</p>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_ERROR', provider: 'meta', error: ${JSON.stringify(msg)} }, '*');
              }
            </script>
          </body>
        </html>
      `);
    }
  });

  // TikTok Business OAuth Popup Callback
  app.get(['/auth/tiktok/callback', '/auth/tiktok/callback/'], async (req: Request, res: Response) => {
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const errorMessage = typeof req.query.error_description === 'string' ? req.query.error_description : '';

    if (errorMessage || !code) {
      res.status(400).send(`
        <!doctype html>
        <html>
          <body style="font-family: Inter, sans-serif; background: #F9FBFF; color: #091F5C; padding: 32px;">
            <h2>TikTok Authorization Incomplete</h2>
            <p>${errorMessage || 'Authorization code was not returned by TikTok.'}</p>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_ERROR', provider: 'tiktok', error: ${JSON.stringify(errorMessage || 'Missing code')} }, '*');
                setTimeout(() => window.close(), 1200);
              }
            </script>
          </body>
        </html>
      `);
      return;
    }

    try {
      const baseUrl = getAppBaseUrl(`${req.protocol}://${req.get('host')}`);
      const redirectUri = `${baseUrl}/auth/tiktok/callback`;
      const { accessToken } = await exchangeTikTokCodeForToken(code, redirectUri);
      await syncLiveTikTokAccount(accessToken);

      res.send(`
        <!doctype html>
        <html>
          <body style="font-family: Inter, sans-serif; background: #F9FBFF; color: #091F5C; padding: 32px;">
            <h2>TikTok Business Connected</h2>
            <p>Your TikTok Business Messages and Lead Ads are now synced with Clearline CRM. This window will close automatically.</p>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', provider: 'tiktok' }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
          </body>
        </html>
      `);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'TikTok token exchange failed';
      res.status(500).send(`
        <!doctype html>
        <html>
          <body style="font-family: Inter, sans-serif; background: #F9FBFF; color: #091F5C; padding: 32px;">
            <h2>TikTok Connection Failed</h2>
            <p>${msg}</p>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_ERROR', provider: 'tiktok', error: ${JSON.stringify(msg)} }, '*');
              }
            </script>
          </body>
        </html>
      `);
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req: Request, res: Response) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Clearline CRM server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
