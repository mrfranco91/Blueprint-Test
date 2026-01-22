import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function SquareCallback() {
  const hasRun = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    // Create abort controller for this effect to cancel pending requests if unmounted
    abortControllerRef.current = new AbortController();

    const parseResponse = async (res: Response) => {
      const text = await res.text();
      if (!text) return {};
      try {
        return JSON.parse(text);
      } catch {
        return { message: text };
      }
    };

    const runCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const state = params.get('state');

      if (!code) {
        setError('Missing authorization code from Square.');
        return;
      }

      if (!state) {
        setError('Missing state parameter from Square. Possible CSRF attack.');
        return;
      }

      const tokenRes = await fetch('/api/square/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal: abortControllerRef.current?.signal,
        body: JSON.stringify({ code, state }),
      });
      const tokenData = await parseResponse(tokenRes);
      if (!tokenRes.ok) {
        console.error('[SQUARE CALLBACK] Token endpoint failed:', {
          status: tokenRes.status,
          data: tokenData,
        });
        throw new Error(tokenData?.message || `Square login failed (${tokenRes.status})`);
      }
      console.log('[SQUARE CALLBACK] Token exchange successful:', { merchantId: tokenData?.merchant_id });

      const merchantId = tokenData?.merchant_id;

      if (!merchantId) {
        throw new Error('Square login failed. Missing merchant ID.');
      }

      // Token is now stored in secure HTTP-only cookie by the server

      const email = `${merchantId}@square-oauth.blueprint`;
      const password = merchantId;
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        throw new Error(
          signInError.message ||
            'Failed to establish a session after Square OAuth.'
        );
      }

      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();
      const sessionToken = sessionData?.session?.access_token;

      if (sessionError || !sessionToken) {
        throw new Error(
          sessionError?.message || 'Missing Supabase session token.'
        );
      }

      const syncHeaders = {
        Authorization: `Bearer ${sessionToken}`,
        'Content-Type': 'application/json',
      };

      const clientsRes = await fetch('/api/square/clients', {
        method: 'POST',
        headers: syncHeaders,
      });
      if (!clientsRes.ok) {
        const clientsData = await parseResponse(clientsRes);
        throw new Error(
          clientsData?.message || 'Square client sync failed.'
        );
      }

      const teamRes = await fetch('/api/square/team', {
        method: 'POST',
        headers: syncHeaders,
      });
      if (!teamRes.ok) {
        const teamData = await parseResponse(teamRes);
        throw new Error(teamData?.message || 'Square team sync failed.');
      }

      // Force full reload so app reads persisted data
      window.location.replace('/admin');
    };

    runCallback().catch((err) => {
      // Ignore abort errors (expected when component unmounts)
      if (err.name === 'AbortError') {
        console.log('[SQUARE CALLBACK] Request cancelled (component unmounted)');
        return;
      }
      console.error('Square OAuth callback failed:', err);
      setError(
        'Square login failed. Please return to the app and try connecting again.'
      );
    });

    // Cleanup: abort pending requests if component unmounts
    return () => {
      abortControllerRef.current?.abort();
    };
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
