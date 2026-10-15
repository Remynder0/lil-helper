/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
// @ts-expect-error type error without @types/node package
import process from "node:process";
const host = process.env.TAURI_DEV_HOST;

function steamAuthDevPlugin() {
  const STEAM_BASE_64 = BigInt('76561197960265728');
  const STEAM_OPENID_VERIFY_URL = 'https://steamcommunity.com/openid/login';

  let latestDesktopAuth: {
    account_id: number;
    persona_name: string;
    avatar_url: string;
    profile_url: string;
    timestamp: number;
  } | null = null;

  return {
    name: 'steam-auth-dev',
    configureServer(server: any) {
      server.middlewares.use('/api/auth/steam/login', (req: any, res: any) => {
        const proto = req.headers['x-forwarded-proto'] || 'http';
        const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:1420';
        const baseUrl = `${proto}://${host}`;
        const url = new URL(req.url, baseUrl);
        const source = url.searchParams.get('source') || 'web';
        const returnToQuery = url.searchParams.get('return_to') || '/';
        const callbackUrl = `${baseUrl}/api/auth/steam/callback?return_to=${encodeURIComponent(returnToQuery)}&source=${source}`;

        const params = new URLSearchParams({
          'openid.ns': 'http://specs.openid.net/auth/2.0',
          'openid.mode': 'checkid_setup',
          'openid.return_to': callbackUrl,
          'openid.realm': `${baseUrl}/`,
          'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
          'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
        });

        const steamOpenIdUrl = `https://steamcommunity.com/openid/login?${params.toString()}`;
        res.writeHead(302, { Location: steamOpenIdUrl });
        res.end();
      });

      server.middlewares.use('/api/auth/steam/session', (req: any, res: any) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end(JSON.stringify({ session: latestDesktopAuth }));
      });

      function getSupabaseServerCredentials() {
        let url = process.env.VITE_SUPABASE_URL || '';
        let anonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
        let serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
        try {
          const fs = require('fs');
          const path = require('path');
          const envPath = path.resolve(process.cwd(), '.env');
          if (fs.existsSync(envPath)) {
            const raw = fs.readFileSync(envPath, 'utf8');
            const lines = raw.split(/\r?\n/);
            for (const line of lines) {
              const urlMatch = line.match(/^VITE_SUPABASE_URL\s*=\s*(.*)$/);
              if (urlMatch && !url) url = urlMatch[1].trim();
              const anonMatch = line.match(/^VITE_SUPABASE_ANON_KEY\s*=\s*(.*)$/);
              if (anonMatch && !anonKey) anonKey = anonMatch[1].trim();
              const serviceMatch = line.match(/^SUPABASE_SERVICE_ROLE_KEY\s*=\s*(.*)$/);
              if (serviceMatch && !serviceKey) serviceKey = serviceMatch[1].trim();
            }
          }
        } catch {}
        return {
          url: url || '',
          anonKey: anonKey || '',
          serviceKey: serviceKey || '',
        };
      }

      server.middlewares.use('/api/config/supabase', (req: any, res: any) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        const creds = getSupabaseServerCredentials();
        res.end(JSON.stringify({ url: creds.url, key: creds.anonKey }));
      });

      server.middlewares.use('/api/cloud/fetch', async (req: any, res: any) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          return res.end();
        }

        try {
          const proto = req.headers['x-forwarded-proto'] || 'http';
          const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:1420';
          const urlObj = new URL(req.url, `${proto}://${host}`);
          const accountId = urlObj.searchParams.get('account_id');

          if (!accountId) {
            res.statusCode = 400;
            return res.end(JSON.stringify({ error: 'Missing account_id parameter' }));
          }

          const { url, serviceKey } = getSupabaseServerCredentials();
          const targetUrl = `${url}/rest/v1/match_histories?select=matches,version,updated_at,persona_name,avatar_url&account_id=eq.${accountId}`;

          const response = await fetch(targetUrl, {
            headers: {
              apikey: serviceKey,
              Authorization: `Bearer ${serviceKey}`,
              Accept: 'application/json',
            },
          });

          if (!response.ok) {
            const errText = await response.text();
            res.statusCode = response.status;
            return res.end(JSON.stringify({ error: errText }));
          }

          const rows = await response.json();
          if (!Array.isArray(rows) || rows.length === 0) {
            return res.end(JSON.stringify({ found: false, matches: [] }));
          }

          const record = rows[0];
          return res.end(
            JSON.stringify({
              found: true,
              matches: Array.isArray(record.matches) ? record.matches : [],
              updatedAt: record.updated_at,
              personaName: record.persona_name,
              avatarUrl: record.avatar_url,
            })
          );
        } catch (err: any) {
          res.statusCode = 500;
          return res.end(JSON.stringify({ error: err?.message || 'Proxy fetch failed' }));
        }
      });

      server.middlewares.use('/api/cloud/push', async (req: any, res: any) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          return res.end();
        }

        try {
          let bodyStr = '';
          req.on('data', (chunk: any) => {
            bodyStr += chunk;
          });

          req.on('end', async () => {
            try {
              const body = JSON.parse(bodyStr || '{}');
              const { account_id, matches, persona_name, avatar_url, user_id } = body;

              if (!account_id) {
                res.statusCode = 400;
                return res.end(JSON.stringify({ error: 'Missing account_id in request body' }));
              }

              const { url, serviceKey } = getSupabaseServerCredentials();
              const targetUrl = `${url}/rest/v1/match_histories?on_conflict=account_id`;

              const payload: Record<string, unknown> = {
                account_id: Number(account_id),
                version: 2,
                updated_at: new Date().toISOString(),
                matches: Array.isArray(matches) ? matches : [],
              };
              if (persona_name) payload.persona_name = persona_name;
              if (avatar_url) payload.avatar_url = avatar_url;
              if (user_id) payload.user_id = user_id;

              const response = await fetch(targetUrl, {
                method: 'POST',
                headers: {
                  apikey: serviceKey,
                  Authorization: `Bearer ${serviceKey}`,
                  'Content-Type': 'application/json',
                  Prefer: 'resolution=merge-duplicates,return=representation',
                },
                body: JSON.stringify(payload),
              });

              if (!response.ok) {
                const errText = await response.text();
                res.statusCode = response.status;
                return res.end(JSON.stringify({ success: false, error: errText }));
              }

              const data = await response.json();
              return res.end(JSON.stringify({ success: true, count: payload.matches?.length || 0, data }));
            } catch (innerErr: any) {
              res.statusCode = 500;
              return res.end(JSON.stringify({ success: false, error: innerErr?.message || 'Server error' }));
            }
          });
        } catch (err: any) {
          res.statusCode = 500;
          return res.end(JSON.stringify({ success: false, error: err?.message || 'Proxy push failed' }));
        }
      });

      server.middlewares.use('/api/auth/steam/callback', async (req: any, res: any) => {
        const proto = req.headers['x-forwarded-proto'] || 'http';
        const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:1420';
        const baseUrl = `${proto}://${host}`;
        const url = new URL(req.url, baseUrl);
        const query = Object.fromEntries(url.searchParams.entries());
        const returnTo = query.return_to || '/';
        const source = query.source || 'web';

        if (query['openid.mode'] !== 'id_res') {
          res.writeHead(302, { Location: `${baseUrl}${returnTo}?error=steam_auth_cancelled` });
          return res.end();
        }

        try {
          const validationParams = new URLSearchParams();
          for (const [key, value] of Object.entries(query)) {
            if (key !== 'return_to' && key !== 'source') validationParams.append(key, value);
          }
          validationParams.set('openid.mode', 'check_authentication');

          const verifyResponse = await fetch(STEAM_OPENID_VERIFY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: validationParams.toString(),
          });
          const verifyText = await verifyResponse.text();
          if (!verifyText.includes('is_valid:true')) {
            res.writeHead(302, { Location: `${baseUrl}${returnTo}?error=steam_verification_failed` });
            return res.end();
          }

          const claimedId = query['openid.claimed_id'] || '';
          const match = claimedId.match(/\/id\/(\d+)$/);
          if (!match) {
            res.writeHead(302, { Location: `${baseUrl}${returnTo}?error=invalid_claimed_id` });
            return res.end();
          }

          const steamId64 = match[1];
          const accountId = Number(BigInt(steamId64) - STEAM_BASE_64);

          let personaName = `Account #${accountId}`;
          let avatarUrl = '';
          let profileUrl = `https://steamcommunity.com/profiles/${steamId64}/`;

          try {
            const playerRes = await fetch(`https://api.deadlock-api.com/v1/players/steam?account_ids=${accountId}&refresh=true`);
            if (playerRes.ok) {
              const playerData = await playerRes.json();
              if (Array.isArray(playerData) && playerData.length > 0) {
                const p = playerData[0];
                if (p.personaname) personaName = p.personaname;
                if (p.avatarfull || p.avatarmedium || p.avatar) avatarUrl = p.avatarfull || p.avatarmedium || p.avatar;
                if (p.profileurl) profileUrl = p.profileurl;
              }
            }
          } catch {}

          latestDesktopAuth = {
            account_id: accountId,
            persona_name: personaName,
            avatar_url: avatarUrl,
            profile_url: profileUrl,
            timestamp: Date.now(),
          };

          if (source === 'desktop') {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.end(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Steam Sign In - Deadlock Analyzer</title>
  <style>
    body { background: #0f141a; color: #e6e6e6; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .card { text-align: center; background: #18202c; padding: 40px; border-radius: 20px; border: 1px solid #e8c06a; max-width: 440px; box-shadow: 0 15px 40px rgba(0,0,0,0.8); }
    h2 { color: #66c0f4; margin: 0 0 12px; font-size: 22px; }
    p { font-size: 14px; color: #a0a0a0; line-height: 1.6; margin: 8px 0; }
    .badge { display: inline-block; background: rgba(102,192,244,0.15); color: #66c0f4; border: 1px solid rgba(102,192,244,0.3); border-radius: 8px; padding: 6px 14px; font-weight: bold; margin: 12px 0 20px; }
    .btn { display: inline-block; background: #e8c06a; color: #121212; padding: 12px 28px; border-radius: 12px; font-weight: bold; text-decoration: none; cursor: pointer; transition: 0.2s; }
    .btn:hover { background: #f0cc78; transform: translateY(-1px); }
  </style>
</head>
<body>
  <div class="card">
    <h2>Steam Sign-In Successful!</h2>
    <div class="badge">Connected as ${personaName}</div>
    <p>Your authentication has been synchronized with the <strong>Deadlock Analyzer Desktop App</strong>.</p>
    <p>You may now safely close this browser tab.</p>
    <div style="margin-top: 24px; display: flex; flex-direction: column; align-items: center; gap: 12px;">
      <button id="close-btn" onclick="attemptClose()" class="btn">Close Tab</button>
      <div id="manual-notice" style="display:none; background:rgba(232,192,106,0.12); border:1px solid rgba(232,192,106,0.4); border-radius:12px; padding:12px 16px; font-size:12px; color:#e8c06a; max-width:360px; line-height:1.5;">
        Browser security prevents scripts from auto-closing tabs. Please close this tab manually with <kbd style="background:#222; padding:2px 6px; border-radius:4px; border:1px solid #555; font-family:monospace; color:#fff;">Ctrl + W</kbd> and return to Deadlock Analyzer.
      </div>
    </div>
  </div>
  <script>
    function attemptClose() {
      try {
        window.open('', '_self', '');
        window.close();
      } catch(e) {}
      setTimeout(function() {
        var notice = document.getElementById('manual-notice');
        var btn = document.getElementById('close-btn');
        if (notice) notice.style.display = 'block';
        if (btn) {
          btn.innerText = 'Close tab (Ctrl + W)';
          btn.style.opacity = '0.7';
        }
      }, 350);
    }
    setTimeout(attemptClose, 800);
  </script>
</body>
</html>`);
            return;
          }

          const redirectHash = new URLSearchParams({
            steam_auth: 'success',
            account_id: String(accountId),
            persona_name: personaName,
            avatar_url: avatarUrl,
            profile_url: profileUrl,
          }).toString();

          res.writeHead(302, { Location: `${baseUrl}${returnTo}#${redirectHash}` });
          res.end();
        } catch {
          res.writeHead(302, { Location: `${baseUrl}${returnTo}?error=steam_callback_exception` });
          res.end();
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [react(), tailwindcss(), steamAuthDevPlugin()],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
  build: {
    target: process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome105" : ["es2021", "chrome105", "safari13"],
    minify: !process.env.TAURI_ENV_DEBUG,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/services/**', 'src/types/**'],
      exclude: ['src/test/**'],
    },
  },
}));
