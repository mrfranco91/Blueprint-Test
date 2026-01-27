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

    // 🔍 First, check if this Square merchant already has settings
    console.log('[OAUTH TOKEN] Checking for existing merchant_settings with merchant_id:', merchant_id);

    const { data: existingSettings, error: settingsLookupError } = await supabaseAdmin
      .from('merchant_settings')
      .select('supabase_user_id')
      .eq('square_merchant_id', merchant_id)
      .maybeSingle();

    if (settingsLookupError) {
      console.error('[OAUTH TOKEN] Error looking up existing settings:', settingsLookupError);
      throw new Error(`Failed to check existing merchant settings: ${settingsLookupError.message}`);
    }

    // Standard OAuth user credentials (merchant_id based)
    const email = `${merchant_id}@square-oauth.blueprint`;
    const password = merchant_id;

    let user: any;

    // If merchant already has settings, try to use that existing user
    if (existingSettings?.supabase_user_id) {
      console.log('[OAUTH TOKEN] Found existing merchant_settings, checking user:', existingSettings.supabase_user_id);

      const { data: existingUserData, error: getUserError } = await (supabaseAdmin.auth as any).admin.getUserById(
        existingSettings.supabase_user_id
      );

      // If user exists, use it and update metadata
      if (existingUserData?.user && !getUserError) {
        console.log('[OAUTH TOKEN] Existing user found, updating metadata');
        user = existingUserData.user;

        // Update user metadata for existing user
        const { error: updateError } = await (supabaseAdmin.auth as any).admin.updateUserById(
          user.id,
          { user_metadata: { role: 'admin', merchant_id, business_name } }
        );

        if (updateError) {
          console.warn('[OAUTH TOKEN] Failed to update user metadata:', updateError.message);
          // Continue anyway - this is not critical
        }
      } else {
        // User was deleted but merchant_settings still exists - create new user
        console.log('[OAUTH TOKEN] Existing user not found (may have been deleted), creating new user');
        user = null; // Will be created below
      }
    }

    // Create new user if needed (either no settings found OR user was deleted)
    if (!user) {
      console.log('[OAUTH TOKEN] Creating or retrieving user by email:', email);
      console.log('[OAUTH TOKEN] Expected password:', password);

      // Strategy: Try to sign in first. If that works, user exists (even if soft-deleted).
      // This avoids the listUsers pagination and soft-delete issues.
      const signInClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false }
      });

      console.log('[OAUTH TOKEN] Attempting sign-in with email:', email);
      const { data: signInAttempt, error: signInAttemptError } = await signInClient.auth.signInWithPassword({
        email,
        password,
      });

      console.log('[OAUTH TOKEN] Sign-in attempt result:', {
        hasUser: !!signInAttempt?.user,
        userId: signInAttempt?.user?.id,
        hasSession: !!signInAttempt?.session,
        hasError: !!signInAttemptError,
        errorMessage: signInAttemptError?.message,
        errorStatus: (signInAttemptError as any)?.status,
      });

      if (signInAttempt?.user && !signInAttemptError) {
        // User exists and credentials work - use this user
        console.log('[OAUTH TOKEN] ✅ User found via sign-in:', {
          userId: signInAttempt.user.id,
          email: signInAttempt.user.email,
          emailConfirmed: signInAttempt.user.email_confirmed_at,
        });
        user = signInAttempt.user;

        // Update metadata for this existing user
        console.log('[OAUTH TOKEN] Updating metadata for existing user:', user.id);
        const { error: updateError } = await (supabaseAdmin.auth as any).admin.updateUserById(
          user.id,
          {
            email_confirm: true,
            user_metadata: { role: 'admin', merchant_id, business_name }
          }
        );

        if (updateError) {
          console.warn('[OAUTH TOKEN] ⚠️ Failed to update user metadata:', {
            userId: user.id,
            error: updateError.message,
          });
        } else {
          console.log('[OAUTH TOKEN] ✅ User metadata updated successfully');
        }
      } else {
        // User doesn't exist or credentials don't work - create new user
        console.log('[OAUTH TOKEN] Sign-in failed, proceeding to create new user:', {
          email,
          signInError: signInAttemptError?.message,
        });

        const { data: createData, error: createError } = await (supabaseAdmin.auth as any).admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { role: 'admin', merchant_id, business_name },
        });

        console.log('[OAUTH TOKEN] Create user result:', {
          success: !createError,
          userId: createData?.user?.id,
          email: createData?.user?.email,
          errorMessage: createError?.message,
        });

        if (createError) {
          console.error('[OAUTH TOKEN] ❌ Failed to create user:', {
            email,
            errorMessage: createError.message,
            errorCode: (createError as any)?.code,
          });

          // If creation failed due to existing email, the user might exist but password doesn't match
          // This could happen if merchant_id was reused or password changed
          if (createError.message?.includes('already been registered') || createError.message?.includes('already exists')) {
            console.log('[OAUTH TOKEN] 🔄 User email already exists, attempting password reset...');

            // Try to list users to find the existing one (one last attempt)
            console.log('[OAUTH TOKEN] Listing users to find existing user with email:', email);
            const { data: usersList } = await supabaseAdmin.auth.admin.listUsers({
              page: 1,
              perPage: 1000,
            });

            console.log('[OAUTH TOKEN] listUsers returned:', {
              totalUsers: usersList?.users?.length,
              searchingFor: email,
            });

            const existingUser = usersList?.users?.find((u: any) => u.email === email);

            if (existingUser) {
              console.log('[OAUTH TOKEN] ✅ Found existing user in list:', {
                userId: existingUser.id,
                email: existingUser.email,
              });

              // Update password to match expected password
              console.log('[OAUTH TOKEN] Updating password for existing user:', existingUser.id);
              const { error: passwordUpdateError } = await (supabaseAdmin.auth as any).admin.updateUserById(
                existingUser.id,
                {
                  password,
                  email_confirm: true,
                  user_metadata: { role: 'admin', merchant_id, business_name }
                }
              );

              if (passwordUpdateError) {
                console.error('[OAUTH TOKEN] ❌ Failed to update password:', {
                  userId: existingUser.id,
                  error: passwordUpdateError.message,
                });
                throw new Error(`Failed to update existing user password: ${passwordUpdateError.message}`);
              }

              console.log('[OAUTH TOKEN] ✅ Password updated successfully for user:', existingUser.id);
              user = existingUser;
            } else {
              // User exists according to Supabase but we can't find them - likely soft-deleted
              console.error('[OAUTH TOKEN] ❌ CRITICAL: User email is registered but cannot be found in listUsers', {
                email,
                userCount: usersList?.users?.length,
                likelyReason: 'Soft-deleted user or pagination issue',
              });
              throw new Error(
                'This account cannot be accessed. Please contact support to restore your account or use a different Square merchant account.'
              );
            }
          } else {
            throw new Error(`Failed to create user: ${createError.message}`);
          }
        } else {
          console.log('[OAUTH TOKEN] ✅ User created successfully:', {
            userId: createData?.user?.id,
            email: createData?.user?.email,
          });
          user = createData.user;
        }
      }
    }

    if (!user) {
      throw new Error('User creation/lookup failed');
    }

    console.log('[OAUTH TOKEN] Generating session for user:', user.id);

    // Create a new session for the user using admin API (without signing in the admin client)
    // Note: We'll use a separate client instance for this to avoid affecting the admin client
    const userClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: signInData, error: signInError } = await userClient.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      console.error('[OAUTH TOKEN] Failed to create session:', signInError);
      throw new Error(`Failed to create session: ${signInError.message}`);
    }

    const session = signInData.session;

    if (!session) {
      throw new Error('Failed to create session for user');
    }

    console.log('[OAUTH TOKEN] Session created successfully');

    console.log('[OAUTH TOKEN] Upserting merchant settings for user:', user.id);

    // Use upsert with square_merchant_id as conflict target since it's the unique business key
    const { data: upsertData, error: upsertError } = await supabaseAdmin
      .from('merchant_settings')
      .upsert(
        {
          supabase_user_id: user.id,
          square_merchant_id: merchant_id,
          square_access_token: access_token,
          square_connected_at: new Date().toISOString(),
        },
        { onConflict: 'square_merchant_id' }
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
