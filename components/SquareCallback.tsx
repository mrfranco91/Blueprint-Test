import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function SquareCallback() {
  const hasRun = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

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

      if (!code) {
        setError('Missing authorization code from Square.');
        return;
      }

      const tokenRes = await fetch('/api/square/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const tokenData = await parseResponse(tokenRes);
      if (!tokenRes.ok) {
        throw new Error(tokenData?.message || 'Square login failed');
      }

      const squareToken = tokenData?.access_token;
      const merchantId = tokenData?.merchant_id;

      if (!squareToken || !merchantId) {
        throw new Error('Square login failed. Missing access token or merchant.');
      }

      localStorage.setItem('square_access_token', squareToken);

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
        'x-square-access-token': squareToken,
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
      console.error('Square OAuth callback failed:', err);
      setError(
        'Square login failed. Please return to the app and try connecting again.'
      );
    });
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
