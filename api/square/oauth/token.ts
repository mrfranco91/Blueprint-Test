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

    const supabaseAdmin = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const email = `${merchant_id}@square-oauth.blueprint`;
    const password = merchant_id;

    let user: any;
    let session: any;

    // Try to sign up first
    console.log('[OAUTH TOKEN] Attempting to create new user');
    const { data: signUpData, error: signUpError } = await supabaseAdmin.auth.signUp({
      email,
      password,
      options: {
        data: { role: 'admin', merchant_id, business_name },
      },
    });

    if (signUpError) {
      // If signUp failed, assume user already exists and try to update password + sign in
      console.log('[OAUTH TOKEN] SignUp failed, attempting sign in:', signUpError.message);

      // Update the password for existing user
      const { error: updateError } = await (supabaseAdmin.auth as any).admin.updateUserByEmail(email, {
        password,
      });

      if (updateError) {
        console.error('[OAUTH TOKEN] Failed to update password:', updateError);
        throw new Error(`User exists but password update failed: ${updateError.message}`);
      }

      // Now sign in with the updated credentials
      const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({ email, password });
      if (signInError) {
        console.error('[OAUTH TOKEN] Sign in failed after password update:', signInError);
        throw signInError;
      }
      user = signInData.user;
      session = signInData.session;
    } else {
      console.log('[OAUTH TOKEN] User created successfully');
      user = signUpData.user;
      session = signUpData.session;
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
