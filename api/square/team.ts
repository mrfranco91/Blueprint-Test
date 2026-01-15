import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const accessToken = process.env.SQUARE_ACCESS_TOKEN;

    if (!accessToken) {
      return res.status(500).json({ error: 'Square access token missing on server.' });
    }

    const squareRes = await fetch(
      'https://connect.squareup.com/v2/team-members/search',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Square-Version': '2023-10-20',
        },
        body: JSON.stringify({
          query: {
            filter: {
              status: 'ACTIVE',
            }
          }
        })
      }
    );

    const json = await squareRes.json();

    if (!squareRes.ok) {
      return res.status(squareRes.status).json(json);
    }

    return res.status(200).json(json);
  } catch (err: any) {
    console.error('Error in /api/square/team:', err);
    return res.status(500).json({ error: err.message });
  }
}
