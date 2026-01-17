import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers['authorization'];
    const bearer =
      authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.slice(7)
        : null;

    if (!bearer) {
      return res.status(401).json({ message: 'Missing Supabase auth token' });
    }

    const supabaseAdmin = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: userData, error: userErr } =
      await supabaseAdmin.auth.getUser(bearer);

    if (userErr || !userData?.user) {
      return res.status(401).json({ message: 'Invalid Supabase session' });
    }

    const supabaseUserId = userData.user.id;

    const { data: ms, error: msErr } = await supabaseAdmin
      .from('merchant_settings')
      .select('square_access_token, square_merchant_id')
      .eq('supabase_user_id', supabaseUserId)
      .single();

    if (msErr || !ms?.square_access_token || !ms?.square_merchant_id) {
      return res.status(401).json({
        message: 'Square connection missing for user',
      });
    }

    const squareAccessToken = ms.square_access_token;
    const merchantId = ms.square_merchant_id;

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
          limit: 100,
        }),
      }
    );

    const squareJson = await squareRes.json();

    if (!squareRes.ok) {
      console.error('[TEAM SYNC] Square error:', squareJson);
      return res.status(squareRes.status).json(squareJson);
    }

    const members = squareJson.team_members || [];

    console.log('[TEAM SYNC] Square members:', members.length);

    if (members.length === 0) {
      return res.status(200).json({ inserted: 0 });
    }

    const rows = members.map((m: any) => ({
      merchant_id: merchantId,
      square_team_member_id: m.id,
      name: [m.given_name, m.family_name].filter(Boolean).join(' ') || 'Team',
      email: m.email_address || null,
      phone: m.phone_number || null,
      role: m.is_owner ? 'Owner' : 'Team Member',
      raw: m,
      updated_at: new Date().toISOString(),
    }));

    const { error: insertErr } = await supabaseAdmin
      .from('square_team_members')
      .upsert(rows, {
        onConflict: 'square_team_member_id',
      });

    if (insertErr) {
      console.error('[TEAM SYNC] Insert failed:', insertErr);
      return res.status(500).json({ message: insertErr.message });
    }

    console.log('[TEAM SYNC] Inserted:', rows.length);

    return res.status(200).json({
      inserted: rows.length,
    });
  } catch (e: any) {
    console.error('[TEAM SYNC] Fatal error:', e);
    return res.status(500).json({ message: e.message });
  }
}
