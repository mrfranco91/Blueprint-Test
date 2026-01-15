
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const squareApiFetch = async (url: string, accessToken: string, options: RequestInit = {}) => {
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Square-Version': '2023-10-20',
        },
        ...options,
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.errors?.[0]?.detail || 'Square API request failed');
    }
    return data;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const missingVars: string[] = [];
  if (!process.env.VITE_SUPABASE_URL) missingVars.push('VITE_SUPABASE_URL');
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missingVars.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!process.env.VITE_SQUARE_APPLICATION_ID) missingVars.push('VITE_SQUARE_APPLICATION_ID');
  if (!process.env.VITE_SQUARE_APPLICATION_SECRET) missingVars.push('VITE_SQUARE_APPLICATION_SECRET');
  if (!process.env.VITE_SQUARE_REDIRECT_URI) missingVars.push('VITE_SQUARE_REDIRECT_URI');

  if (missingVars.length > 0) {
    const errorMessage = `Square Login Failed. Server configuration is missing. Missing env var(s): ${missingVars.join(', ')}. Fix: Add these in Vercel → Project → Settings → Environment Variables (Production + Preview) and redeploy.`;
    console.error(errorMessage);
    return res.status(500).json({ message: errorMessage });
  }
  
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ message: 'Missing OAuth code.' });
    }

    const clientId = process.env.VITE_SQUARE_APPLICATION_ID;
    const clientSecret = process.env.VITE_SQUARE_APPLICATION_SECRET;
    const redirectUri = process.env.VITE_SQUARE_REDIRECT_URI;
    const env = (process.env.VITE_SQUARE_ENV || 'production').toLowerCase();
    
    // 1. Exchange code for token
    const tokenUrl = env === 'sandbox'
        ? 'https://connect.squareupsandbox.com/oauth2/token'
        : 'https://connect.squareup.com/oauth2/token';

    const tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) return res.status(500).json(tokenData);

    const { access_token, merchant_id } = tokenData;

    // 2. Get business name
    const merchantUrl = env === 'sandbox' ? `https://connect.squareupsandbox.com/v2/merchants/${merchant_id}` : `https://connect.squareup.com/v2/merchants/${merchant_id}`;
    const merchantResp = await fetch(merchantUrl, { headers: { 'Authorization': `Bearer ${access_token}` } });
    const merchantData = await merchantResp.json();
    const business_name = merchantData?.merchant?.business_name || 'Admin';

    // 3. Initialize Supabase Admin Client
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    const supabaseAdmin = createClient(supabaseUrl!, supabaseServiceKey!);

    // 4. Sign up or Sign in user on server
    const email = `${merchant_id}@square-oauth.blueprint`;
    const password = merchant_id;

    let { data: { user: authUser }, error: signInError } = await supabaseAdmin.auth.signInWithPassword({ email, password });

    if (signInError && signInError.message.includes('Invalid login credentials')) {
        const { data: { user: newAuthUser }, error: signUpError } = await supabaseAdmin.auth.signUp({
            email,
            password,
            options: { data: { role: 'admin', merchant_id, business_name } }
        });
        if (signUpError) throw signUpError;
        authUser = newAuthUser;
    } else if (signInError) {
        throw signInError;
    }
    if (!authUser) throw new Error("Could not sign up or sign in Supabase user on server.");

    // 5. SYNC TEAM from Square
    const teamData = await squareApiFetch(`https://connect.${env === 'sandbox' ? 'squareupsandbox.com' : 'squareup.com'}/v2/team-members/search`, access_token, { body: JSON.stringify({ query: { filter: { status: 'ACTIVE' } } }) });
    
    if (teamData.team_members) {
      const teamRecords = teamData.team_members.map((m: any) => ({
        supabase_user_id: authUser.id,
        square_team_member_id: m.id,
        name: `${m.given_name || ''} ${m.family_name || ''}`.trim(),
        email: m.email_address || null,
        role: m.is_owner ? 'Owner' : 'Team Member',
      }));
      await supabaseAdmin.from('square_team_members').upsert(teamRecords, { onConflict: 'square_team_member_id' });
    }

    // 6. SYNC CUSTOMERS from Square (with pagination)
    let cursor;
    do {
      const listUrl = `https://connect.${env === 'sandbox' ? 'squareupsandbox.com' : 'squareup.com'}/v2/customers/list${cursor ? `?cursor=${cursor}` : ''}`;
      const customerData = await squareApiFetch(listUrl, access_token, { method: 'GET' });

      if (customerData.customers) {
        const clientRecords = customerData.customers.map((c: any) => ({
          external_id: c.id,
          name: `${c.given_name || ''} ${c.family_name || ''}`.trim() || c.email_address || 'Unnamed Client',
          email: c.email_address || null,
          phone: c.phone_number || null,
          avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(`${c.given_name || ''} ${c.family_name || ''}`.trim() || 'UC')}&background=random`,
          source: 'square',
        }));
        if(clientRecords.length > 0) {
            await supabaseAdmin.from('clients').upsert(clientRecords, { onConflict: 'external_id', ignoreDuplicates: false });
        }
      }
      cursor = customerData.cursor;
    } while (cursor);


    // 7. Return success response to client for session creation
    return res.status(200).json({
      access_token,
      merchant_id,
      email,
      business_name,
    });

  } catch (e: any) {
    console.error('OAuth Token/Sync Error:', e);
    return res.status(500).json({ message: e?.message || 'Square token exchange and data sync failed.' });
  }
}
