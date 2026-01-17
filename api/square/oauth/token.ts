import { createClient } from '@supabase/supabase-js';

const squareApiFetch = async (
  url: string,
  accessToken: string,
  options: RequestInit = {}
) => {
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Square-Version': '2023-10-20',
    },
    body: options.body,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.errors?.[0]?.detail || 'Square API request failed');
  }
  return data;
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        body = undefined;
      }
    }

    let code =
      body?.code ??
      (typeof req.query?.code === 'string' ? req.query.code : undefined);

    if (!code && typeof req.headers?.referer === 'string') {
      try {
        const refUrl = new URL(req.headers.referer);
        code = refUrl.searchParams.get('code') ?? undefined;
      } catch {}
    }

    if (!code) {
      return res.status(400).json({ message: 'Missing OAuth code.' });
    }

    const env = (process.env.VITE_SQUARE_ENV || 'production').toLowerCase();
    const baseUrl =
      env === 'sandbox'
        ? 'https://connect.squareupsandbox.com'
        : 'https://connect.squareup.com';

    const basicAuth = btoa(
      `${process.env.VITE_SQUARE_APPLICATION_ID}:${process.env.VITE_SQUARE_APPLICATION_SECRET}`
    );

    const tokenRes = await fetch(`${baseUrl}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${basicAuth}`,
      },
      body: JSON.stringify({
        client_id: process.env.VITE_SQUARE_APPLICATION_ID,
        client_secret: process.env.VITE_SQUARE_APPLICATION_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.VITE_SQUARE_REDIRECT_URI,
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok) {
      return res.status(tokenRes.status).json({
        message: 'Failed to exchange Square OAuth token.',
        square_error: tokenData,
      });
    }

    const { access_token, merchant_id } = tokenData;

    const merchantData: any = await squareApiFetch(
      `${baseUrl}/v2/merchants/${merchant_id}`,
      access_token
    );

    const business_name =
      merchantData?.merchant?.business_name || 'Admin';

    const supabaseAdmin = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const email = `${merchant_id}@square-oauth.blueprint`;
    const password = merchant_id;

    let {
      data: { user },
      error,
    } = await supabaseAdmin.auth.signInWithPassword({ email, password });

    if (error) {
      const signUp = await supabaseAdmin.auth.signUp({
        email,
        password,
        options: {
          data: { role: 'admin', merchant_id, business_name },
        },
      });
      if (signUp.error) throw signUp.error;
      user = signUp.data.user;
    }

    if (!user) throw new Error('Supabase auth failed');

    await supabaseAdmin
      .from('merchant_settings')
      .upsert(
        {
          supabase_user_id: user.id,
          square_merchant_id: merchant_id,
          square_access_token: access_token,
          square_connected_at: new Date().toISOString(),
        },
        { onConflict: 'supabase_user_id' }
      );

    // -------- BLOCKING INITIAL SYNC --------

    // Clients
    const customersJson: any = await squareApiFetch(
      `${baseUrl}/v2/customers`,
      access_token
    );

    const customers = customersJson?.customers || [];
    if (customers.length > 0) {
      const clientRows = customers.map((c: any) => ({
        supabase_user_id: user.id,
        name: [c.given_name, c.family_name].filter(Boolean).join(' ') || 'Client',
        email: c.email_address || null,
        phone: c.phone_number || null,
        avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(
          [c.given_name, c.family_name].filter(Boolean).join(' ') || 'C'
        )}&background=random`,
        external_id: c.id,
      }));

      await supabaseAdmin
        .from('clients')
        .upsert(clientRows, { onConflict: 'external_id' });
    }

    // Team (0 members is valid and successful)
    const teamJson: any = await squareApiFetch(
      `${baseUrl}/v2/team-members/search`,
      access_token,
      {
        method: 'POST',
        body: JSON.stringify({ limit: 100 }),
      }
    );

    const members = teamJson?.team_members || [];
    if (members.length > 0) {
      const teamRows = members.map((m: any) => ({
        merchant_id: merchant_id,
        square_team_member_id: m.id,
        name: [m.given_name, m.family_name].filter(Boolean).join(' ') || 'Team',
        email: m.email_address || null,
        phone: m.phone_number || null,
        role: m.is_owner ? 'Owner' : 'Team Member',
        raw: m,
        updated_at: new Date().toISOString(),
      }));

      await supabaseAdmin
        .from('square_team_members')
        .upsert(teamRows, { onConflict: 'square_team_member_id' });
    }

    // -------- END BLOCKING SYNC --------

    return res.status(200).json({
      merchant_id,
      business_name,
      access_token,
    });

  } catch (e: any) {
    console.error('OAuth Token/Sync Error:', e);
    return res.status(500).json({ message: e.message });
  }
}
