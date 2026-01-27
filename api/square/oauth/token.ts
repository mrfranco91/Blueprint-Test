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

    console.log('[OAUTH TOKEN] Request details:', {
      hasBody: !!body,
      bodyCode: body?.code,
      queryCode: req.query?.code,
      referer: req.headers?.referer,
      extractedCode: code,
    });

    if (!code) {
      console.error('[OAUTH TOKEN] Missing code after extraction');
      return res.status(400).json({ message: 'Missing OAuth code.' });
    }

    const env = (process.env.VITE_SQUARE_ENV || 'production').toLowerCase();
    const baseUrl =
      env === 'sandbox'
        ? 'https://connect.squareupsandbox.com'
        : 'https://connect.squareup.com';

    const appId = process.env.VITE_SQUARE_APPLICATION_ID;
    const appSecret = process.env.SQUARE_APPLICATION_SECRET;
    const redirectUri = process.env.VITE_SQUARE_REDIRECT_URI;

    console.log('[OAUTH TOKEN] Config check:', {
      env,
      hasAppId: !!appId,
      hasAppSecret: !!appSecret,
      hasRedirectUri: !!redirectUri,
      redirectUri: redirectUri,
    });

    if (!appId || !appSecret || !redirectUri) {
      console.error('[OAUTH TOKEN] Missing Square config', {
        appId,
        appSecret: appSecret ? '***' : 'MISSING',
        redirectUri,
      });
      return res.status(500).json({ message: 'Square OAuth credentials not configured on server.' });
    }

    const basicAuth = Buffer.from(
      `${appId}:${appSecret}`
    ).toString('base64');

    const tokenRes = await fetch(`${baseUrl}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${basicAuth}`,
      },
      body: JSON.stringify({
        client_id: appId,
        client_secret: appSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
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

    const merchantData = await squareApiFetch(
      `${baseUrl}/v2/merchants/${merchant_id}`,
      access_token
    );

    const business_name =
      merchantData?.merchant?.business_name || 'Admin';

    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('[OAUTH TOKEN] Missing Supabase credentials:', {
        hasUrl: !!supabaseUrl,
        hasServiceKey: !!serviceRoleKey,
      });
      return res.status(500).json({ message: 'Supabase credentials not configured on server.' });
    }

    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const email = `${merchant_id}@square-oauth.blueprint`;
    const password = merchant_id;

    let user: any;
    let session: any;

    console.log('[OAUTH TOKEN] Attempting to create/update user with email:', email);

    // Try to create user with admin API (pre-confirmed, no email verification required)
    try {
      const { data: createData, error: createError } = await (supabaseAdmin.auth as any).admin.createUser({
        email,
        password,
        email_confirm: true, // Pre-confirm email for OAuth users
        user_metadata: { role: 'admin', merchant_id, business_name },
      });

      if (createError) {
        // User might already exist - try to get it
        console.log('[OAUTH TOKEN] Admin user creation failed, attempting to find existing user:', createError.message);
        throw createError;
      }

      console.log('[OAUTH TOKEN] User created successfully via admin API:', createData.user?.id);
      user = createData.user;
    } catch (createErr: any) {
      console.log('[OAUTH TOKEN] Create user failed, looking up existing user...');

      // Try to sign in with the credentials - if user exists, this will work
      console.log('[OAUTH TOKEN] Attempting to sign in with existing credentials');

      const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        console.error('[OAUTH TOKEN] User creation and sign-in both failed:', {
          createError: createErr.message,
          signInError: signInError.message,
        });
        throw new Error(
          `Failed to create or authenticate user: ${signInError.message}`
        );
      }

      if (!signInData.user) {
        console.error('[OAUTH TOKEN] Sign in succeeded but no user returned');
        throw new Error('Failed to get user after sign-in');
      }

      console.log('[OAUTH TOKEN] Found and signed in existing user:', signInData.user.id);
      user = signInData.user;
      session = signInData.session;
    }

    // Now get a session for this user (if we don't already have one)
    if (!user) {
      throw new Error('User creation/lookup failed');
    }

    if (!session) {
      console.log('[OAUTH TOKEN] Getting session for user:', user.id);

      // Sign in to get a session
      const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        console.error('[OAUTH TOKEN] Sign in failed:', signInError);
        throw signInError;
      }

      session = signInData.session;

      if (!session) {
        console.error('[OAUTH TOKEN] Sign in succeeded but no session returned');
        throw new Error('Failed to create session for user');
      }
    } else {
      console.log('[OAUTH TOKEN] Already have session for user:', user.id);
    }

    if (!user) throw new Error('Supabase auth failed');
    if (!session) throw new Error('Failed to create session for user');

    console.log('[OAUTH TOKEN] Upserting merchant settings for user:', user.id);

    const { data: upsertData, error: upsertError } = await supabaseAdmin
      .from('merchant_settings')
      .upsert(
        {
          supabase_user_id: user.id,
          square_merchant_id: merchant_id,
          square_access_token: access_token,
          square_connected_at: new Date().toISOString(),
        },
        { onConflict: 'supabase_user_id' }
      )
      .select();

    if (upsertError) {
      console.error('[OAUTH TOKEN] Failed to upsert merchant_settings:', upsertError);
      throw new Error(`Failed to save merchant settings: ${upsertError.message}`);
    }

    console.log('[OAUTH TOKEN] Merchant settings upserted successfully:', upsertData);

    // ✅ Return session tokens so frontend can authenticate without re-signing-in
    return res.status(200).json({
      merchant_id,
      business_name,
      access_token,
      supabase_session: session
        ? {
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          }
        : null,
    });

  } catch (e: any) {
    console.error('OAuth Token/Sync Error:', e);
    return res.status(500).json({ message: e.message });
  }
}
