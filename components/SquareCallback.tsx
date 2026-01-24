import { useEffect, useRef, useState } from 'react';

export default function SquareCallback() {
  const hasRun = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (!code) {
      setError('Missing authorization code from Square.');
      return;
    }

    (async () => {
      try {
        // Step 1: Exchange OAuth code for Square access token
        const tokenRes = await fetch('/api/square/oauth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });

        const tokenData = await tokenRes.json();
        if (!tokenRes.ok) {
          throw new Error(tokenData?.message || 'Square login failed');
        }

        const { access_token: squareToken, merchant_id } = tokenData;

        if (!squareToken) {
          throw new Error('No Square access token received');
        }

        // Step 2: Sign in with Supabase to get a session token
        const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
        const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseAnonKey) {
          throw new Error('Supabase config missing');
        }

        const { supabase } = await import('../lib/supabase');

        // The OAuth token handler creates a user with email: {merchant_id}@square-oauth.blueprint
        // and password: merchant_id
        const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
          email: `${merchant_id}@square-oauth.blueprint`,
          password: merchant_id,
        });

        if (authErr || !authData?.session?.access_token) {
          throw new Error(authErr?.message || 'Failed to sign in');
        }

        const jwtToken = authData.session.access_token;

        // Step 3: Sync data via Supabase Edge Functions with Bearer token
        const edgeFunctionBase = `${supabaseUrl}/functions/v1`;

        try {
          const teamRes = await fetch(`${edgeFunctionBase}/sync-team-members`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${jwtToken}`,
            },
            body: JSON.stringify({ squareAccessToken: squareToken }),
          });

          if (!teamRes.ok) {
            console.warn(`Team sync failed with status ${teamRes.status}`);
          }
        } catch (syncErr) {
          console.warn('Team sync error:', syncErr);
        }

        try {
          const clientRes = await fetch(`${edgeFunctionBase}/sync-clients`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${jwtToken}`,
            },
            body: JSON.stringify({ squareAccessToken: squareToken }),
          });

          if (!clientRes.ok) {
            console.warn(`Client sync failed with status ${clientRes.status}`);
          }
        } catch (syncErr) {
          console.warn('Client sync error:', syncErr);
        }

        // Step 4: Redirect to admin dashboard
        window.location.replace('/admin');
      } catch (err) {
        console.error('Square OAuth callback failed:', err);
        setError(
          err instanceof Error ? err.message : 'Square login failed. Please return to the app and try connecting again.'
        );
      }
    })();
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <h2>Connecting Square…</h2>
      <p>Please wait. This may take a moment.</p>
      {error && (
        <p style={{ color: 'red', marginTop: 16 }}>
          {error}
        </p>
      )}
    </div>
  );
}
