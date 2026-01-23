import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { createClient } from '@supabase/supabase-js';

const createApiMiddleware = () => {
  return async (req, res, next) => {
    if (!req.url.startsWith('/api')) {
      return next();
    }

    const supabaseAdmin = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    if (req.url === '/api/square/team' && req.method === 'POST') {
      try {
        let squareAccessToken =
          req.headers['x-square-access-token'] ||
          req.headers['x-square-access-token'.toLowerCase()];

        const authHeader = req.headers['authorization'];
        const bearer = authHeader?.startsWith('Bearer ')
          ? authHeader.slice(7)
          : null;

        let supabaseUserId;

        if (bearer) {
          const { data: userData } = await (supabaseAdmin.auth as any).getUser(bearer);
          supabaseUserId = userData?.user?.id;

          if (!supabaseUserId) {
            return res.writeHead(401).end(JSON.stringify({ message: 'Invalid user.' }));
          }
        } else if (squareAccessToken) {
          supabaseUserId = 'dev-user-' + Buffer.from(squareAccessToken).toString('base64').substring(0, 12);
        } else {
          return res.writeHead(401).end(JSON.stringify({ message: 'Missing auth token.' }));
        }

        if (!squareAccessToken) {
          const { data: merchant } = await supabaseAdmin
            .from('merchant_settings')
            .select('square_access_token, settings')
            .eq('supabase_user_id', supabaseUserId)
            .maybeSingle();

          squareAccessToken =
            merchant?.square_access_token ??
            merchant?.settings?.square_access_token ??
            merchant?.settings?.oauth?.access_token ??
            null;
        }

        if (!squareAccessToken) {
          console.error('[TEAM SYNC] Missing Square OAuth token');
          return res.writeHead(400).end(JSON.stringify({
            message: 'Square OAuth token not found in merchant settings.',
          }));
        }

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
          return res.writeHead(squareRes.status).end(JSON.stringify({
            message: 'Failed to fetch team members from Square',
            details: squareError,
          }));
        }

        const squareData = await squareRes.json();
        const teamMembers = squareData.team_members || [];

        const rows = teamMembers.map((m: any) => ({
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
          return res.writeHead(500).end(JSON.stringify({ message: error.message }));
        }

        console.log('[TEAM SYNC] Inserted:', rows.length);
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ inserted: rows.length }));
      } catch (e: any) {
        console.error('[TEAM SYNC] Fatal error:', e);
        return res.writeHead(500).end(JSON.stringify({ message: e.message }));
      }
    }

    if (req.url === '/api/square/clients' && req.method === 'POST') {
      try {
        let squareAccessToken =
          req.headers['x-square-access-token'] ||
          req.headers['x-square-access-token'.toLowerCase()];

        const authHeader = req.headers['authorization'];
        const bearer = authHeader?.startsWith('Bearer ')
          ? authHeader.slice(7)
          : null;

        let supabaseUserId;

        if (bearer) {
          const supabaseUser = createClient(
            process.env.VITE_SUPABASE_URL!,
            process.env.VITE_SUPABASE_ANON_KEY!,
            {
              global: {
                headers: {
                  Authorization: `Bearer ${bearer}`,
                },
              },
            }
          );

          const { data: userData, error: userErr } = await (supabaseUser.auth as any).getUser();

          if (userErr || !userData?.user) {
            console.error('[CLIENT SYNC] Invalid Supabase session:', userErr);
            return res.writeHead(401).end(JSON.stringify({ message: 'Invalid Supabase session.' }));
          }

          supabaseUserId = userData.user.id;
        } else if (squareAccessToken) {
          supabaseUserId = 'dev-user-' + Buffer.from(squareAccessToken).toString('base64').substring(0, 12);
        } else {
          return res.writeHead(401).end(JSON.stringify({ message: 'Missing auth token.' }));
        }

        if (!squareAccessToken) {
          const { data: ms, error: msErr } = await supabaseAdmin
            .from('merchant_settings')
            .select('square_access_token')
            .eq('supabase_user_id', supabaseUserId)
            .maybeSingle();

          if (msErr || !ms?.square_access_token) {
            console.error('[CLIENT SYNC] merchant_settings lookup failed:', msErr);
            return res.writeHead(401).end(JSON.stringify({
              message: 'Missing Square connection for user.',
            }));
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
          return res.writeHead(squareRes.status).end(JSON.stringify(json));
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
            return res.writeHead(500).end(JSON.stringify({ message: error.message }));
          }
        }

        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ inserted: rows.length }));
      } catch (e: any) {
        console.error('[CLIENT SYNC] Fatal error:', e);
        return res.writeHead(500).end(JSON.stringify({ message: e.message }));
      }
    }

    return next();
  };
};

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        middlewareMode: false,
        middleware: [createApiMiddleware()],
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      },
      resolve: {
        alias: {
          // FIX: Replaced `process.cwd()` with `'.'` to avoid "Property 'cwd' does not exist on type 'Process'" error in some TS environments.
          '@': path.resolve('.'),
        }
      }
    };
});
