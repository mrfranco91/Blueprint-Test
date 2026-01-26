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
    const tempPassword = 'blueprint-token-sync-' + Date.now();

    // Get the real account user
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

    // Update the user with a temporary password for this session
    const { error: updateError } = await (supabaseAdmin.auth as any).admin.updateUserById(realAccountUid, {
      password: tempPassword,
    });

    if (updateError) {
      console.error('[CREATE SESSION] Failed to set password:', updateError);
      return res.status(500).json({
        message: 'Failed to prepare account for sign-in',
        details: updateError.message,
      });
    }

    console.log('[CREATE SESSION] Updated password for user:', realAccountUid);

    return res.status(200).json({
      email: userData.user.email,
      password: tempPassword,
      userId: realAccountUid,
    });
  } catch (e: any) {
    console.error('[CREATE SESSION] Fatal error:', e);
    return res.status(500).json({ message: e.message });
  }
}
