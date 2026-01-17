import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
  try {
    if (
      !process.env.VITE_SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY ||
      !process.env.SQUARE_ACCESS_TOKEN
    ) {
      return res.status(500).json({
        message: 'Missing server configuration.',
      });
    }

    const supabaseAdmin = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    /* -----------------------------------------
       1. FETCH TEAM MEMBERS FROM SQUARE
    ------------------------------------------*/
    const squareRes = await fetch(
      'https://connect.squareup.com/v2/team-members/search',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
          'Square-Version': '2023-10-20',
        },
        body: JSON.stringify({
          query: {
            filter: {
              status: 'ACTIVE',
            },
          },
        }),
      }
    );

    const squareJson = await squareRes.json();

    if (!squareRes.ok) {
      console.error('[TEAM SYNC] Square API error:', squareJson);
      return res.status(squareRes.status).json(squareJson);
    }

    const members = squareJson.team_members ?? [];

    if (members.length === 0) {
      console.warn('[TEAM SYNC] No team members returned from Square.');
      return res.status(200).json({ inserted: 0 });
    }

    /* -----------------------------------------
       2. NORMALIZE DATA FOR SUPABASE
    ------------------------------------------*/
    const rows = members.map((m: any) => ({
      square_team_member_id: m.id,
      name: [m.given_name, m.family_name].filter(Boolean).join(' ') || 'Team Member',
      email: m.email_address ?? null,
      role: m.is_owner ? 'Owner' : 'Team Member',
      status: m.status,
      raw_square_payload: m,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    /* -----------------------------------------
       3. UPSERT INTO SUPABASE
    ------------------------------------------*/
    const { error } = await supabaseAdmin
      .from('square_team_members')
      .upsert(rows, {
        onConflict: 'square_team_member_id',
      });

    if (error) {
      console.error('[TEAM SYNC] Supabase upsert failed:', error);
      return res.status(500).json({ message: error.message });
    }

    console.log(`[TEAM SYNC] Successfully upserted ${rows.length} team members`);

    return res.status(200).json({ inserted: rows.length });
  } catch (err: any) {
    console.error('[TEAM SYNC] Fatal error:', err);
    return res.status(500).json({ message: err.message });
  }
}
