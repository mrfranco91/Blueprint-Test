import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const code = body?.code;

    if (!code) {
      return res.status(400).json({ message: 'Missing OAuth code.' });
    }

    const clientId =
      process.env.SQUARE_APPLICATION_ID ||
      process.env.VITE_SQUARE_APPLICATION_ID ||
      process.env.VITE_SQUARE_CLIENT_ID;

    const clientSecret =
      process.env.SQUARE_APPLICATION_SECRET ||
      process.env.VITE_SQUARE_APPLICATION_SECRET ||
      process.env.VITE_SQUARE_CLIENT_SECRET;

    const redirectUri =
      process.env.SQUARE_REDIRECT_URI ||
      process.env.VITE_SQUARE_REDIRECT_URI;

    const env = (process.env.SQUARE_ENV || process.env.VITE_SQUARE_ENV || 'production').toLowerCase();

    if (!clientId || !clientSecret || !redirectUri) {
      return res.status(500).json({
        message: 'Missing Square OAuth server configuration (client id/secret/redirect uri).',
      });
    }

    const tokenUrl =
      env === 'sandbox'
        ? 'https://connect.squareupsandbox.com/oauth2/token'
        : 'https://connect.squareup.com/oauth2/token';

    const resp = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      return res.status(resp.status).json({
        message: data?.error_description || data?.error || 'Square token exchange failed.',
        details: data,
      });
    }

    return res.status(200).json(data);
  } catch (e: any) {
    return res.status(500).json({ message: e?.message || 'Square token exchange failed.' });
  }
}