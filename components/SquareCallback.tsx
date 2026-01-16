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

    // 🔒 CRITICAL: exchange code ONCE, then redirect away
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
      .then((data) => {
        // ✅ SUCCESS — Save token and IMMEDIATELY LEAVE CALLBACK PAGE
        if (data.access_token) {
          localStorage.setItem('square_access_token', data.access_token);
        }
        
        // ✅ CRITICAL FIX: force full app reload so state rehydrates
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