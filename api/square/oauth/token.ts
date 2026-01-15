import { createClient } from '@supabase/supabase-js';

const squareApiFetch = async (
  url: string,
  accessToken: string,
  options: RequestInit = {}
) => {
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Square-Version': '2023-10-20',
      ...(options.headers || {}),
    },
    body: options.body,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.errors?.[0]?.detail || 'Square API request failed');
  }
  return data;
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const code =
      req.body?.code ??
      (typeof req.query?.code === 'string' ? req.query.code : undefined);

    if (!code) {
      return res.status(400).json({ message: 'Missing OAuth code.' });
    }

    const env = (process.env.VITE_SQUARE_ENV || 'production').toLowerCase();
    const baseUrl =
      env === 'sandbox'
        ? 'https://connect.squareupsandbox.com'
        : 'https://connect.squareup.com';

    // 1. EXCHANGE OAUTH CODE (Square requires client_id + client_secret IN BODY)
    const tokenRes = await fetch(`${baseUrl}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
      console.error('Square OAuth Token Error', tokenData);
      return res.status(tokenRes.status).json({
        message: 'Failed to exchange Square OAuth token.',
        square_error: tokenData,
      });
    }

    const { access_token, merchant_id } = tokenData;

    // 2. Merchant info
    const merchantData = await squareApiFetch(
      `${baseUrl}/v2/merchants/${merchant_id}`,
      access_token
    );

    const business_name =
      merchantData?.merchant?.business_name || 'Admin';

    // 3. Supabase admin client
    const supabaseAdmin = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const email = `${merchant_id}@square-oauth.blueprint`;
    const password = merchant_id;

    let { data: { user }, error } =
      await supabaseAdmin.auth.signInWithPassword({ email, password });

    if (error) {
      const signUp = await supabaseAdmin.auth.signUp({
        email,
        password,
        options: { data: { role: 'admin', merchant_id, business_name } }
      });
      if (signUp.error) throw signUp.error;
      user = signUp.data.user;
    }

    if (!user) throw new Error('Supabase auth failed');

    // 4. TEAM SYNC
    const teamData = await squareApiFetch(
      `${baseUrl}/v2/team-members/search`,
      access_token,
      {
        method: 'POST',
        body: JSON.stringify({ query: { filter: { status: 'ACTIVE' } } })
      }
    );

    if (teamData.team_members) {
      await supabaseAdmin
        .from('square_team_members')
        .upsert(
          teamData.team_members.map((m: any) => ({
            supabase_user_id: user.id,
            square_team_member_id: m.id,
            name: `${m.given_name || ''} ${m.family_name || ''}`.trim(),
            email: m.email_address || null,
            role: m.is_owner ? 'Owner' : 'Team Member',
          })),
          { onConflict: 'square_team_member_id' }
        );
    }

    // 5. CUSTOMER SYNC
    let cursor;
    do {
      const customerData = await squareApiFetch(
        `${baseUrl}/v2/customers${cursor ? `?cursor=${cursor}` : ''}`,
        access_token
      );

      if (customerData.customers?.length) {
        await supabaseAdmin.from('clients').upsert(
          customerData.customers.map((c: any) => ({
            external_id: c.id,
            name:
              `${c.given_name || ''} ${c.family_name || ''}`.trim() ||
              c.email_address ||
              'Unnamed Client',
            email: c.email_address || null,
            phone: c.phone_number || null,
            avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(
              `${c.given_name || ''} ${c.family_name || ''}`.trim() || 'UC'
            )}&background=random`,
            source: 'square',
          })),
          { onConflict: 'external_id', ignoreDuplicates: false }
        );
      }

      cursor = customerData.cursor;
    } while (cursor);

    // ✅ PERSIST SQUARE CONNECTION STATE in merchant_settings (FIX)
    await supabaseAdmin
      .from('merchant_settings')
      .upsert({
        supabase_user_id: user.id,
        integration_provider: 'square',
        square_connected: true,
        square_merchant_id: merchant_id,
        square_last_synced_at: new Date().toISOString(),
      }, {
        onConflict: 'supabase_user_id'
      });

    return res.status(200).json({ access_token, merchant_id, email, business_name });

  } catch (e: any) {
    console.error('OAuth Token/Sync Error:', e);
    return res.status(500).json({ message: e.message });
  }
}
