import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
  try {
    let squareAccessToken: string | undefined =
      (req.headers['x-square-access-token'] as string | undefined) ||
      (req.headers['x-square-access-token'.toLowerCase()] as string | undefined);

    if (!squareAccessToken) {
      const authHeader = req.headers['authorization'] as string | undefined;
      const bearer = authHeader?.startsWith('Bearer ')
        ? authHeader.slice(7)
        : undefined;

      if (
        bearer &&
        process.env.VITE_SUPABASE_URL &&
        process.env.SUPABASE_SERVICE_ROLE_KEY
      ) {
        const supabaseAdmin = createClient(
          process.env.VITE_SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        const { data: userData } = await supabaseAdmin.auth.getUser(bearer);
        const userId = userData?.user?.id;

        if (userId) {
          const { data: ms } = await supabaseAdmin
            .from('merchant_settings')
            .select('square_access_token')
            .eq('supabase_user_id', userId)
            .maybeSingle();

          squareAccessToken = ms?.square_access_token;
        }
      }
    }

    if (!squareAccessToken) {
      return res.status(401).json({
        error: 'Square access token missing for team sync.',
      });
    }

    const squareRes = await fetch(
      'https://connect.squareup.com/v2/team-members/search',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${squareAccessToken}`,
          'Content-Type': 'application/json',
          'Square-Version': '2023-10-20',
        },
        body: JSON.stringify({
          query: {
            filter: { status: 'ACTIVE' },
          },
        }),
      }
    );

    const json = await squareRes.json();
    if (!squareRes.ok) return res.status(squareRes.status).json(json);

    return res.status(200).json(json);
  } catch (err: any) {
    console.error('Error in /api/square/oauth/team:', err);
    return res.status(500).json({ error: err.message });
  }
}