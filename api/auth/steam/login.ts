import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:1420';
  const baseUrl = `${proto}://${host}`;

  const returnToQuery = (req.query.return_to as string) || '/';
  const source = (req.query.source as string) || 'web';
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
  return res.redirect(302, steamOpenIdUrl);
}
