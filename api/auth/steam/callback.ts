import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const STEAM_BASE_64 = BigInt('76561197960265728');
const STEAM_OPENID_VERIFY_URL = 'https://steamcommunity.com/openid/login';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:1420';
  const baseUrl = `${proto}://${host}`;

  const query = req.query as Record<string, string>;
  const returnTo = query.return_to || '/';
  const source = query.source || 'web';

  // 1. Verify that Steam returned a valid response mode
  if (query['openid.mode'] !== 'id_res') {
    return res.redirect(302, `${baseUrl}${returnTo}?error=steam_auth_cancelled`);
  }

  // 2. Validate OpenID 2.0 signature with Valve servers
  try {
    const validationParams = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (key !== 'return_to' && key !== 'source') {
        validationParams.append(key, value);
      }
    }
    validationParams.set('openid.mode', 'check_authentication');

    const verifyResponse = await fetch(STEAM_OPENID_VERIFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: validationParams.toString(),
    });

    const verifyText = await verifyResponse.text();
    const isValid = verifyText.includes('is_valid:true');

    if (!isValid) {
      console.error('Steam OpenID signature verification failed:', verifyText);
      return res.redirect(302, `${baseUrl}${returnTo}?error=steam_verification_failed`);
    }

    // 3. Extract SteamID64 and compute 32-bit Account ID
    const claimedId = query['openid.claimed_id'] || '';
    const match = claimedId.match(/\/id\/(\d+)$/);
    if (!match) {
      return res.redirect(302, `${baseUrl}${returnTo}?error=invalid_claimed_id`);
    }

    const steamId64 = match[1];
    const accountId = Number(BigInt(steamId64) - STEAM_BASE_64);

    // 4. Fetch player profile details (nickname, avatar) from Deadlock API
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
          if (p.avatarfull || p.avatarmedium || p.avatar) {
            avatarUrl = p.avatarfull || p.avatarmedium || p.avatar;
          }
          if (p.profileurl) profileUrl = p.profileurl;
        }
      }
    } catch (e) {
      console.warn('Could not fetch player details from Deadlock API:', e);
    }

    // 5. Authenticate or create user in Supabase if Service Role Key is available
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    let tokenHash: string | undefined;

    if (supabaseUrl && serviceRoleKey) {
      try {
        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        const email = `steam_${steamId64}@deadlock.internal`;
        const userMetadata = {
          steam_id_64: steamId64,
          account_id: accountId,
          persona_name: personaName,
          avatar_url: avatarUrl,
          profile_url: profileUrl,
        };

        // Check if user exists or create them
        const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = usersData?.users?.find(
          (u) => u.email === email || u.user_metadata?.steam_id_64 === steamId64
        );

        if (!existingUser) {
          const { error: createError } = await supabaseAdmin.auth.admin.createUser({
            email,
            email_confirm: true,
            user_metadata: userMetadata,
          });
          if (createError) {
            console.error('Failed to create Supabase user:', createError);
          }
        } else {
          await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
            user_metadata: userMetadata,
          });
        }

        // Generate magiclink / verification token for client session
        const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
          type: 'magiclink',
          email,
        });

        if (!linkError && linkData?.properties?.hashed_token) {
          tokenHash = linkData.properties.hashed_token;
        }
      } catch (sbErr) {
        console.error('Supabase admin authentication error:', sbErr);
      }
    }

    // 6. Handle desktop completion response
    if (source === 'desktop') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(`<!DOCTYPE html>
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
    }

    // 7. Web redirect with hash
    const redirectParams: Record<string, string> = {
      steam_auth: 'success',
      account_id: String(accountId),
      persona_name: personaName,
      avatar_url: avatarUrl,
      profile_url: profileUrl,
    };
    if (tokenHash) {
      redirectParams.token_hash = tokenHash;
      redirectParams.type = 'magiclink';
    }

    const redirectHash = new URLSearchParams(redirectParams).toString();
    return res.redirect(302, `${baseUrl}${returnTo}#${redirectHash}`);
  } catch (err: any) {
    console.error('Steam callback general error:', err);
    return res.redirect(302, `${baseUrl}${returnTo}?error=steam_callback_exception`);
  }
}
