import React, { useState } from 'react';
import { useSettings } from '../contexts/SettingsContext';

const MissingCredentialsScreen = () => {
  const { branding } = useSettings();
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const squareAppId =
    (import.meta as any).env.VITE_SQUARE_APPLICATION_ID ||
    (import.meta as any).env.VITE_SQUARE_CLIENT_ID;
  const squareRedirectUri = (import.meta as any).env.VITE_SQUARE_REDIRECT_URI;
  const squareEnv = ((import.meta as any).env.VITE_SQUARE_ENV || 'production').toLowerCase();
  const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;

  const scopes =
    ((import.meta as any).env.VITE_SQUARE_OAUTH_SCOPES as string | undefined) ??
    'MERCHANT_PROFILE_READ EMPLOYEES_READ ITEMS_READ CUSTOMERS_READ CUSTOMERS_WRITE APPOINTMENTS_READ APPOINTMENTS_ALL_READ APPOINTMENTS_WRITE SUBSCRIPTIONS_READ SUBSCRIPTIONS_WRITE';

  const startOAuth = () => {
    if (!squareAppId || !squareRedirectUri) {
      alert("Square OAuth is not configured correctly. Missing Application ID or Redirect URI.");
      return;
    }

    const base =
      squareEnv === 'sandbox'
        ? 'https://connect.squareupsandbox.com/oauth2/authorize'
        : 'https://connect.squareup.com/oauth2/authorize';

    const url =
      `${base}` +
      `?client_id=${encodeURIComponent(squareAppId)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent(scopes)}` +
      `&redirect_uri=${encodeURIComponent(squareRedirectUri)}` +
      `&session=false`;

    window.location.href = url;
  };

  const handleTokenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) {
      setError('Please enter a Square access token');
      return;
    }

    if (!supabaseUrl) {
      setError('Supabase URL is not configured');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { supabase } = await import('../lib/supabase');

      // Get existing session (user is already authenticated at this point)
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        throw new Error('Not authenticated');
      }

      const jwtToken = session.session.access_token;

      // Sync team members
      const teamRes = await fetch(
        `${supabaseUrl}/functions/v1/sync-team-members`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${jwtToken}`,
          },
          body: JSON.stringify({ squareAccessToken: token }),
        }
      );

      const teamText = await teamRes.text();
      if (!teamRes.ok) {
        const data = teamText ? JSON.parse(teamText) : {};
        throw new Error(data?.message || `Team sync failed (${teamRes.status})`);
      }

      // Sync clients
      const clientRes = await fetch(
        `${supabaseUrl}/functions/v1/sync-clients`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${jwtToken}`,
          },
          body: JSON.stringify({ squareAccessToken: token }),
        }
      );

      const clientText = await clientRes.text();
      if (!clientRes.ok) {
        const data = clientText ? JSON.parse(clientText) : {};
        throw new Error(data?.message || `Client sync failed (${clientRes.status})`);
      }

      // Reload to refresh the settings context
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6 font-sans">
      <div className="bg-white p-10 rounded-[40px] border-4 border-gray-950 shadow-2xl max-w-sm w-full">
        <h1 className="text-2xl font-black tracking-tighter mb-4 text-center">
          Connect Square
        </h1>
        <p className="text-sm font-bold text-gray-700 mb-6 text-center">
          Connect your Square account to access the Pro/Admin dashboard.
        </p>

        {squareRedirectUri && (
          <div className="mb-6">
            <button
              onClick={startOAuth}
              className="w-full bg-gray-950 text-white font-black py-3 rounded-2xl border-4 border-gray-950 shadow-lg hover:bg-gray-800 transition-colors"
            >
              Continue with Square OAuth
            </button>
          </div>
        )}

        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-gray-300"></div>
          <span className="text-xs text-gray-500 font-semibold">or</span>
          <div className="flex-1 h-px bg-gray-300"></div>
        </div>

        <form onSubmit={handleTokenSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-2">
              Square Access Token
            </label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste your Square access token"
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg text-sm focus:outline-none focus:border-gray-950"
              disabled={loading}
            />
          </div>
          {error && (
            <p className="text-red-600 text-xs font-bold">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gray-200 text-gray-950 font-bold py-3 rounded-lg border-2 border-gray-300 hover:bg-gray-300 transition-colors disabled:opacity-50 text-sm"
          >
            {loading ? 'Syncing...' : 'Sync with Token'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default MissingCredentialsScreen;
