import type { VercelRequest, VercelResponse } from '@vercel/node';

const DEFAULT_SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const DEFAULT_SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const { account_id, matches, persona_name, avatar_url, user_id } = req.body || {};
  if (!account_id) {
    return res.status(400).json({ error: 'Missing account_id in request body' });
  }

  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_KEY;

  try {
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
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ success: false, error: errText });
    }

    const data = await response.json();
    return res.status(200).json({ success: true, count: payload.matches?.length || 0, data });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Proxy push failed' });
  }
}
