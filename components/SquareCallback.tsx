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

    fetch('/api/square/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.message || 'Square login failed');
        }
        return data;
      })
      .then(async (data) => {
        if (data.access_token) {
          localStorage.setItem('square_access_token', data.access_token);
        }

        const squareToken = data.access_token;

        // ✅ Trigger clients sync (correct path)
        await fetch('/api/square/clients', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-square-access-token': squareToken,
          },
        });

        // ✅ Trigger team sync
        await fetch('/api/square/team', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-square-access-token': squareToken,
          },
        });

        // Force full reload so app reads persisted data
        window.location.replace('/admin');
      })
      .catch((err) => {
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
