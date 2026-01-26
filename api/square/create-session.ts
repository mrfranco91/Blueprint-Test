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

    // Create a session for the real account using the service role
    // This allows us to generate a valid JWT for the real account
    const { data: sessionData, error: sessionError } = await (
      supabaseAdmin.auth as any
    ).admin.createSession(realAccountUid);

    if (sessionError || !sessionData) {
      console.error('[CREATE SESSION] Failed to create session:', sessionError);
      return res.status(500).json({
        message: 'Failed to create session for real account',
        details: sessionError?.message,
      });
    }

    console.log('[CREATE SESSION] Session created for user:', realAccountUid);

    return res.status(200).json({
      session: sessionData.session,
      user: sessionData.user,
    });
  } catch (e: any) {
    console.error('[CREATE SESSION] Fatal error:', e);
    return res.status(500).json({ message: e.message });
  }
}
