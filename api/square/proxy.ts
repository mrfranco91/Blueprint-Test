import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
  try {
    // The client sends:
    // - query: ?path=/v2/.... (required)
    // - method: uses req.method
    // - body: forwarded
    // - optional header: x-square-access-token (if client has it)
    //
    // If x-square-access-token is not provided, we attempt to load it from merchant_settings
    // using the Supabase user JWT in Authorization: Bearer <supabase_access_token>.

    const path = typeof req.query?.path === 'string' ? req.query.path : '';
    if (!path || !path.startsWith('/')) {
      return res.status(400).json({ message: "Missing or invalid 'path' query param. Example: /api/square/proxy?path=/v2/customers" });
    }

    const env = (process.env.VITE_SQUARE_ENV || 'production').toLowerCase();
    const squareBase =
      env === 'sandbox'
        ? 'https://connect.squareupsandbox.com'
        : 'https://connect.squareup.com';

    let squareAccessToken: string | undefined =
      (req.headers['x-square-access-token'] as string | undefined) ||
      (req.headers['x-square-access-token'.toLowerCase()] as string | undefined);

    // If no token provided by client, try Supabase merchant_settings lookup
    if (!squareAccessToken) {
      const authHeader = req.headers['authorization'] as string | undefined;
      const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

      if (bearer && process.env.VITE_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
        const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

        const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(bearer);
        const userId = userData?.user?.id;

        if (!userErr && userId) {
          const { data: ms } = await supabaseAdmin
            .from('merchant_settings')
            .select('settings')
            .eq('supabase_user_id', userId)
            .maybeSingle();

          // In merchant_settings table, we store the connection status in the 'settings' blob normally,
          // but based on the OAuth handler logic, we might also check for specific columns.
          // Adjusting to check for oauth-related fields if persisted.
          
          // Re-checking the merchant_settings upsert logic from oauth handler:
          // it saves integration_provider, square_connected, square_merchant_id.
          // Note: In some environments, the access token might be stored in the settings blob.
          
          const settings = (ms as any)?.settings;
          if (settings?.square_access_token) {
              squareAccessToken = settings.square_access_token;
          }
        }
      }
    }

    if (!squareAccessToken) {
      // Fallback: check if we have a static token for development
      squareAccessToken = process.env.VITE_SQUARE_ACCESS_TOKEN;
    }

    if (!squareAccessToken) {
      return res.status(401).json({
        message: 'Square access token not available for proxy request. Reconnect Square in Settings and try again.',
      });
    }

    const url = `${squareBase}${path}`;

    // Forward method + body. Only include body for non-GET/HEAD.
    const method = (req.method || 'GET').toUpperCase();
    const hasBody = method !== 'GET' && method !== 'HEAD' && method !== 'DELETE';

    const squareResp = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${squareAccessToken}`,
        'Content-Type': 'application/json',
        'Square-Version': '2023-10-20',
      },
      body: hasBody ? JSON.stringify(req.body ?? {}) : undefined,
    });

    const text = await squareResp.text();
    let payload: any;
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      payload = { raw: text };
    }

    return res.status(squareResp.status).json(payload);
  } catch (e: any) {
    console.error('Square proxy error:', e);
    return res.status(500).json({ message: e?.message || 'Square proxy failed' });
  }
}