
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  const { code } = req.body;

  if (!code || typeof code !== 'string') {
    return res.status(400).json({ message: 'Authorization code is missing or invalid.' });
  }

  const {
    SQUARE_APPLICATION_ID,
    SQUARE_APPLICATION_SECRET,
    SQUARE_REDIRECT_URI,
    SQUARE_ENV,
  } = process.env;

  if (!SQUARE_APPLICATION_ID || !SQUARE_APPLICATION_SECRET || !SQUARE_REDIRECT_URI) {
    return res.status(500).json({ message: 'OAuth configuration is incomplete on the server.' });
  }

  const env = SQUARE_ENV || 'production';

  const tokenUrl = env === 'sandbox'
    ? 'https://connect.squareupsandbox.com/oauth2/token'
    : 'https://connect.squareup.com/oauth2/token';

  try {
    const squareResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        client_id: SQUARE_APPLICATION_ID,
        client_secret: SQUARE_APPLICATION_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: SQUARE_REDIRECT_URI,
      }),
    });

    const data = await squareResponse.json();

    if (!squareResponse.ok) {
      console.error('Square OAuth error:', data);
      return res.status(squareResponse.status).json(data);
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('Internal server error during token exchange:', error);
    return res.status(500).json({ message: 'An internal error occurred while contacting Square.' });
  }
}
