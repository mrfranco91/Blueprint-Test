import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Team sync endpoint
app.post('/api/square/team', async (req, res) => {
  try {
    let squareAccessToken =
      req.headers['x-square-access-token'] ||
      req.headers['x-square-access-token'.toLowerCase()];

    if (!squareAccessToken) {
      return res.status(401).json({ message: 'Missing Square access token' });
    }

    const supabaseUserId = 'dev-user-' + Buffer.from(squareAccessToken).toString('base64').substring(0, 12);

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

    const rows = teamMembers.map((m) => ({
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
  } catch (e) {
    console.error('[TEAM SYNC] Fatal error:', e);
    return res.status(500).json({ message: e.message });
  }
});

// Clients sync endpoint
app.post('/api/square/clients', async (req, res) => {
  try {
    let squareAccessToken =
      req.headers['x-square-access-token'] ||
      req.headers['x-square-access-token'.toLowerCase()];

    if (!squareAccessToken) {
      return res.status(401).json({ message: 'Missing Square access token' });
    }

    const supabaseUserId = 'dev-user-' + Buffer.from(squareAccessToken).toString('base64').substring(0, 12);

    const squareRes = await fetch(
      'https://connect.squareup.com/v2/customers',
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${squareAccessToken}`,
          'Content-Type': 'application/json',
          'Square-Version': '2023-10-20',
        },
      }
    );

    const json = await squareRes.json();
    if (!squareRes.ok) {
      return res.status(squareRes.status).json(json);
    }

    const customers = json.customers || [];

    const rows = customers.map((c) => ({
      supabase_user_id: supabaseUserId,
      name: [c.given_name, c.family_name].filter(Boolean).join(' ') || 'Client',
      email: c.email_address || null,
      phone: c.phone_number || null,
      avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(
        [c.given_name, c.family_name].filter(Boolean).join(' ') || 'C'
      )}&background=random`,
      external_id: c.id,
    }));

    if (rows.length > 0) {
      const { error } = await supabaseAdmin
        .from('clients')
        .upsert(rows, { onConflict: 'external_id' });

      if (error) {
        console.error('[CLIENT SYNC] Insert failed:', error);
        return res.status(500).json({ message: error.message });
      }
    }

    return res.status(200).json({ inserted: rows.length });
  } catch (e) {
    console.error('[CLIENT SYNC] Fatal error:', e);
    return res.status(500).json({ message: e.message });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`✓ Dev server running on http://localhost:${PORT}`);
});
