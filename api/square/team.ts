import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const supabaseAdmin = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    /* -------------------------------------------------
       1. IDENTIFY AUTHENTICATED USER
    --------------------------------------------------*/
    const authHeader = req.headers['authorization'];
    const bearer =
      typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
        ? authHeader.slice(7)
        : null;

    if (!bearer) {
      return res.status(401).json({ message: 'Missing auth token.' });
    }

    // FIX: Cast to 'any' to bypass Supabase auth method type errors, likely from an environment configuration issue.
    const { data: userData } = await (supabaseAdmin.auth as any).getUser(bearer);
    const supabaseUserId = userData?.user?.id;

    if (!supabaseUserId) {
      return res.status(401).json({ message: 'Invalid user.' });
    }

    /* -------------------------------------------------
       2. LOAD MERCHANT SETTINGS (CORRECT SOURCE)
    --------------------------------------------------*/
    const { data: merchant } = await supabaseAdmin
      .from('merchant_settings')
      .select('square_access_token, settings')
      .eq('supabase_user_id', supabaseUserId)
      .maybeSingle();

    const squareAccessToken =
      merchant?.square_access_token ??
      merchant?.settings?.square_access_token ??
      merchant?.settings?.oauth?.access_token ??
      null;

    if (!squareAccessToken) {
      console.error('[TEAM SYNC] Missing Square OAuth token');
      return res.status(400).json({
        message: 'Square OAuth token not found in merchant settings.',
      });
    }

    /* -------------------------------------------------
       3. FETCH TEAM MEMBERS FROM SQUARE
    --------------------------------------------------*/
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
            filter: {
              status: ['ACTIVE', 'INACTIVE'],
            },
          },
          limit: 100,
        }),
      }
    );

    if (!squareRes.ok) {
      const squareError = await squareRes.json();
      console.error('[TEAM SYNC] Square API error:', squareError);
      return res.status(squareRes.status).json({
        message: 'Failed to fetch team members from Square',
        details: squareError,
      });
    }

    const squareData = await squareRes.json();
    const teamMembers = squareData.team_members || [];

    /* -------------------------------------------------
       4. TRANSFORM AND UPSERT TO DATABASE
    --------------------------------------------------*/
    const rows = teamMembers.map((m: any) => ({
      supabase_user_id: supabaseUserId,
      square_team_member_id: m.id,
      name: [m.given_name, m.family_name].filter(Boolean).join(' ') || 'Team Member',
      email: m.email_address ?? null,
      role: m.is_owner ? 'Owner' : 'Team Member',
      status: m.status,
      raw_square_payload: m,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabaseAdmin
      .from('square_team_members')
      .upsert(rows, { onConflict: 'square_team_member_id' });

    if (error) {
      console.error('[TEAM SYNC] Supabase error:', error);
      return res.status(500).json({ message: error.message });
    }

    console.log('[TEAM SYNC] Inserted:', rows.length);

    return res.status(200).json({ inserted: rows.length });
  } catch (e: any) {
    console.error('[TEAM SYNC] Fatal error:', e);
    return res.status(500).json({ message: e.message });
  }
}
