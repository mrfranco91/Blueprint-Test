import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

// Generate a deterministic UUID v4-like ID from a token
function generateUUIDFromToken(token: string): string {
  const hash = createHash('sha256').update(token).digest('hex');
  // Format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  return `${hash.substring(0, 8)}-${hash.substring(8, 12)}-${hash.substring(12, 16)}-${hash.substring(16, 20)}-${hash.substring(20, 32)}`;
}

export default async function handler(req: any, res: any) {
  try {
    let squareAccessToken: string | undefined =
      (req.headers['x-square-access-token'] as string | undefined) ||
      (req.headers['x-square-access-token'.toLowerCase()] as string | undefined);

    const authHeader = req.headers['authorization'] as string | undefined;
    const bearer = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : undefined;

    if (
      !process.env.VITE_SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY ||
      !process.env.VITE_SUPABASE_ANON_KEY
    ) {
      return res.status(500).json({ message: 'Supabase config missing.' });
    }

    let supabaseUserId: string | undefined;

    if (bearer) {
      // User-scoped Supabase client (identity only)
      const supabaseUser = createClient(
        process.env.VITE_SUPABASE_URL,
        process.env.VITE_SUPABASE_ANON_KEY,
        {
          global: {
            headers: {
              Authorization: `Bearer ${bearer}`,
            },
          },
        }
      );

      // FIX: Cast to 'any' to bypass Supabase auth method type errors, likely from an environment configuration issue.
      const { data: userData, error: userErr } =
        await (supabaseUser.auth as any).getUser();

      if (userErr || !userData?.user) {
        console.error('[CLIENT SYNC] Invalid Supabase session:', userErr);
        return res.status(401).json({ message: 'Invalid Supabase session.' });
      }

      supabaseUserId = userData.user.id;
    } else if (squareAccessToken) {
      // Development mode: use a UUID-formatted dev user ID when token is provided directly
      supabaseUserId = generateUUIDFromToken(squareAccessToken);
    } else {
      return res.status(401).json({ message: 'Missing auth token.' });
    }

    // Service-role Supabase client (DB access)
    const supabaseAdmin = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    if (!squareAccessToken) {
      const { data: ms, error: msErr } = await supabaseAdmin
        .from('merchant_settings')
        .select('square_access_token')
        .eq('supabase_user_id', supabaseUserId)
        .maybeSingle();

      if (msErr || !ms?.square_access_token) {
        console.error('[CLIENT SYNC] merchant_settings lookup failed:', msErr);
        return res.status(401).json({
          message: 'Missing Square connection for user.',
        });
      }

      squareAccessToken = ms.square_access_token;
    }

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

    const rows = customers.map((c: any) => ({
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
  } catch (e: any) {
    console.error('[CLIENT SYNC] Fatal error:', e);
    return res.status(500).json({ message: e.message });
  }
}
