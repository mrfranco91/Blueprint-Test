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

const parseJsonResponse = async (response: Response) => {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
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

    // CSRF State Validation
    let state = body?.state;
    if (!state && typeof req.headers?.referer === 'string') {
      try {
        const refUrl = new URL(req.headers.referer);
        state = refUrl.searchParams.get('state') ?? undefined;
      } catch {}
    }

    if (!state) {
      return res.status(400).json({ message: 'Missing OAuth state parameter.' });
    }

    // Extract state from cookies
    const cookies = req.headers.cookie?.split(';').reduce((acc: any, cookie: string) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = decodeURIComponent(value);
      return acc;
    }, {}) || {};

    const storedState = cookies.square_oauth_state;
    if (!storedState || storedState !== state) {
      return res.status(403).json({ message: 'Invalid OAuth state parameter. Possible CSRF attack.' });
    }

    // Clear the state cookie
    res.setHeader('Set-Cookie', 'square_oauth_state=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0');

    const env = (process.env.VITE_SQUARE_ENV || 'production').toLowerCase();
    const baseUrl =
      env === 'sandbox'
        ? 'https://connect.squareupsandbox.com'
        : 'https://connect.squareup.com';

    if (
      !process.env.VITE_SQUARE_APPLICATION_ID ||
      !process.env.SQUARE_APPLICATION_SECRET
    ) {
      return res.status(500).json({
        message: 'Square OAuth environment variables are not configured on the server.',
      });
    }

    const rawAuth = `${process.env.VITE_SQUARE_APPLICATION_ID}:${process.env.SQUARE_APPLICATION_SECRET}`;
    const basicAuth =
      typeof Buffer !== 'undefined'
        ? Buffer.from(rawAuth).toString('base64')
        : (globalThis as any).btoa(rawAuth);

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

    const tokenData = await parseJsonResponse(tokenRes);

    if (!tokenRes.ok) {
      console.error('Square OAuth Token Error:', tokenData);
      return res.status(tokenRes.status).json({
        message: 'Failed to exchange Square OAuth token.',
        square_error: tokenData,
      });
    }

    const { access_token, merchant_id } = tokenData;
    if (!access_token || !merchant_id) {
      return res.status(500).json({
        message: 'Square OAuth response missing access token or merchant id.',
        square_error: tokenData,
      });
    }

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
    // Generate secure random password
    const password = crypto.randomBytes(32).toString('hex');

    const signInResult = await (supabaseAdmin.auth as any).signInWithPassword({
      email,
      password,
    });
    let user = signInResult.data?.user;
    const signInError = signInResult.error;

    if (signInError) {
      const signUp = await (supabaseAdmin.auth as any).signUp({
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

    // ✅ RESTORED: payload frontend expects to bootstrap app state
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
