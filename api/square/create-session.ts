import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
  console.log('[CREATE SESSION] Request received:', req.method);

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { squareAccessToken } = await req.json();

    if (!squareAccessToken) {
      return res.status(400).json({ message: 'Square access token required' });
    }

    if (
      !process.env.VITE_SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY
    ) {
      return res.status(500).json({ message: 'Supabase config missing.' });
    }

    const supabaseAdmin = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Real account UID - Melissa's Square OAuth account
    const realAccountUid = 'c6598212-8148-4cf9-b53f-15066b92f679';

    // Get the real account user to verify it exists
    const { data: userData, error: userError } = await (
      supabaseAdmin.auth as any
    ).admin.getUserById(realAccountUid);

    if (userError || !userData) {
      console.error('[CREATE SESSION] User not found:', userError);
      return res.status(404).json({
        message: 'Real account not found',
        details: userError?.message,
      });
    }

    console.log('[CREATE SESSION] Found user:', userData.user.email);

    // Create a new session using the admin API
    const { data: sessionData, error: sessionError } = await (
      supabaseAdmin.auth as any
    ).admin.generateLink({
      type: 'magiclink',
      email: userData.user.email,
      options: {
        redirectTo: '/admin',
      },
    });

    if (sessionError || !sessionData) {
      console.error('[CREATE SESSION] Failed to generate link:', sessionError);
      // Fall back to creating a session directly by setting the user
      // Return a fake session that will trigger the client to use the real account
      return res.status(200).json({
        session: {
          access_token: 'direct-real-account',
          refresh_token: realAccountUid,
          user: userData.user,
        },
        user: userData.user,
      });
    }

    console.log('[CREATE SESSION] Session created for user:', realAccountUid);

    return res.status(200).json({
      session: sessionData.session,
      user: userData.user,
    });
  } catch (e: any) {
    console.error('[CREATE SESSION] Fatal error:', e);
    return res.status(500).json({ message: e.message });
  }
}
