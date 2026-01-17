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
    },
    body: options.body,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.errors?.[0]?.detail || 'Square API request failed');
  }
  return data;
};

// Fire-and-forget background sync: never throw to caller
const syncSquareDataBestEffort = async (params: {
  supabaseUrl: string;
  serviceRoleKey: string;
  supabaseUserId: string;
  squareMerchantId: string;
  squareAccessToken: string;
  squareBaseUrl: string;
}) => {
  const {
    supabaseUrl,
    serviceRoleKey,
    supabaseUserId,
    squareMerchantId,
    squareAccessToken,
    squareBaseUrl,
  } = params;

  try {
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // ---- Sync Clients (Square Customers -> clients)
    try {
      const customersJson: any = await squareApiFetch(
        `${squareBaseUrl}/v2/customers`,
        squareAccessToken
      );

      const customers = customersJson?.customers || [];
      const clientRows = customers.map((c: any) => ({
        supabase_user_id: supabaseUserId,
        name: [c.given_name, c.family_name].filter(Boolean).join(' ') || 'Client',
        email: c.email_address || null,
        phone: c.phone_number || null,
        avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(
          [c.given_name, c.family_name].filter(Boolean).join(' ') || 'C'
        )}&background=random`,
        external_id: c.id,
      }));

      if (clientRows.length > 0) {
        const { error } = await supabaseAdmin
          .from('clients')
          .upsert(clientRows, { onConflict: 'external_id' });

        if (error) {
          console.error('[OAUTH SYNC] Clients upsert failed:', error);
        } else {
          console.log('[OAUTH SYNC] Clients upserted:', clientRows.length);
        }
      } else {
        console.log('[OAUTH SYNC] Clients: 0');
      }
    } catch (e: any) {
      console.error('[OAUTH SYNC] Clients sync failed:', e?.message || e);
    }

    // ---- Sync Team (Square Team Members -> square_team_members)
    try {
      const teamJson: any = await squareApiFetch(
        `${squareBaseUrl}/v2/team-members/search`,
        squareAccessToken,
        {
          method: 'POST',
          body: JSON.stringify({ limit: 100 }),
        }
      );

      const members = teamJson?.team_members || [];
      const teamRows = members.map((m: any) => ({
        merchant_id: squareMerchantId,
        square_team_member_id: m.id,
        name: [m.given_name, m.family_name].filter(Boolean).join(' ') || 'Team',
        email: m.email_address || null,
        phone: m.phone_number || null,
        role: m.is_owner ? 'Owner' : 'Team Member',
        raw: m,
        updated_at: new Date().toISOString(),
      }));

      if (teamRows.length > 0) {
        const { error } = await supabaseAdmin
          .from('square_team_members')
          .upsert(teamRows, { onConflict: 'square_team_member_id' });

        if (error) {
          console.error('[OAUTH SYNC] Team upsert failed:', error);
        } else {
          console.log('[OAUTH SYNC] Team upserted:', teamRows.length);
        }
      } else {
        console.log('[OAUTH SYNC] Team: 0');
      }
    } catch (e: any) {
      console.error('[OAUTH SYNC] Team sync failed:', e?.message || e);
    }
  } catch (e: any) {
    console.error('[OAUTH SYNC] Fatal background sync error:', e?.message || e);
  }
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

    // Keep current behavior as-is
    const basicAuth = btoa(
      `${process.env.VITE_SQUARE_APPLICATION_ID}:${process.env.VITE_SQUARE_APPLICATION_SECRET}`
    );

    const tokenRes = await fetch(`${baseUrl}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${basicAuth}`,
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
      console.error('Square OAuth Token Error:', tokenData);
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

    // Fire-and-forget: do NOT await, do NOT fail OAuth response
    void syncSquareDataBestEffort({
      supabaseUrl: process.env.VITE_SUPABASE_URL!,
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      supabaseUserId: user.id,
      squareMerchantId: merchant_id,
      squareAccessToken: access_token,
      squareBaseUrl: baseUrl,
    });

    // Keep response shape as-is for frontend bootstrap
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
