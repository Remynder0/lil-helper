import type { VercelRequest, VercelResponse } from '@vercel/node';

const DEFAULT_SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const DEFAULT_SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const accountId = req.query.account_id as string | undefined;
  if (!accountId) {
    return res.status(400).json({ error: 'Missing account_id parameter' });
  }

  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_KEY;

  try {
    const targetUrl = `${url}/rest/v1/match_histories?select=matches,version,updated_at,persona_name,avatar_url&account_id=eq.${accountId}`;
    const response = await fetch(targetUrl, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: errText });
    }

    const rows = await response.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(200).json({ found: false, matches: [] });
    }

    const record = rows[0];
    return res.status(200).json({
      found: true,
      matches: Array.isArray(record.matches) ? record.matches : [],
      updatedAt: record.updated_at,
      personaName: record.persona_name,
      avatarUrl: record.avatar_url,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Proxy fetch failed' });
  }
}
