import { useEffect, useRef, useState } from 'react';

export default function SquareCallback() {
  const hasRun = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');

    if (!code) {
      setError('Missing authorization code from Square.');
      return;
    }

    // If this is a popup, send the authorization code back to the parent window
    if (window.opener && !window.opener.closed) {
      console.log('Popup mode: sending authorization code to parent window');

      // Send the authorization code and state to the parent window
      window.opener.postMessage(
        {
          type: 'SQUARE_OAUTH_SUCCESS',
          code,
          state,
        },
        window.location.origin
      );

      // Also use localStorage as backup
      try {
        localStorage.setItem('oauth-code', code);
        localStorage.setItem('oauth-state', state || '');
        console.log('Set oauth code in localStorage');
      } catch (e) {
        console.error('Could not set localStorage:', e);
      }

      setError(null);

      // Close the popup after a short delay
      setTimeout(() => {
        console.log('Closing popup window');
        window.close();
      }, 1000);
    } else {
      // Direct navigation (not a popup) - handle the full flow here
      console.log('Direct navigation mode: handling full OAuth flow');

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

          // Step 2: Sign in with Supabase
          const { supabase } = await import('../lib/supabase');

          const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
            email: `${merchant_id}@square-oauth.blueprint`,
            password: merchant_id,
          });

          if (authErr || !authData?.session?.access_token) {
            throw new Error(authErr?.message || 'Failed to sign in');
          }

          const jwtToken = authData.session.access_token;

          // Step 3: Sync team and clients
          await fetch('/api/square/team', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${jwtToken}`,
            },
            body: JSON.stringify({ squareAccessToken: squareToken }),
          });

          await fetch('/api/square/clients', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${jwtToken}`,
            },
            body: JSON.stringify({ squareAccessToken: squareToken }),
          });

          // Redirect to admin
          window.location.replace('/admin');
        } catch (err) {
          console.error('OAuth callback failed:', err);
          setError(err instanceof Error ? err.message : 'Authentication failed');
        }
      })();
    }
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
