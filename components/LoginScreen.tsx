import React, { useState } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { SettingsIcon } from './icons';
import { ensureAccessibleColor } from '../utils/ensureAccessibleColor';
import { generateUUIDFromToken } from '../utils/tokenUuid';

const LoginScreen: React.FC = () => {
  const { branding } = useSettings();
  const { login } = useAuth();
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
  const squareAppId =
    (import.meta as any).env.VITE_SQUARE_APPLICATION_ID ||
    (import.meta as any).env.VITE_SQUARE_CLIENT_ID;
  const squareRedirectUri = (import.meta as any).env.VITE_SQUARE_REDIRECT_URI;
  const squareEnv = ((import.meta as any).env.VITE_SQUARE_ENV || 'production').toLowerCase();

  const scopes =
    ((import.meta as any).env.VITE_SQUARE_OAUTH_SCOPES as string | undefined) ??
    'MERCHANT_PROFILE_READ EMPLOYEES_READ ITEMS_READ CUSTOMERS_READ CUSTOMERS_WRITE APPOINTMENTS_READ APPOINTMENTS_ALL_READ APPOINTMENTS_WRITE SUBSCRIPTIONS_READ SUBSCRIPTIONS_WRITE';

  const startSquareOAuth = () => {
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

      // For manual token sync, we need to create a temporary user or use an existing session
      let jwtToken: string | null = null;

      // Try to get existing session first
      const { data: session } = await supabase.auth.getSession();
      if (session?.session?.access_token) {
        jwtToken = session.session.access_token;
      } else {
        // Create a temporary test account for manual sync
        const tempEmail = `manual-sync-${Date.now()}@blueprint.local`;
        const tempPassword = Math.random().toString(36).slice(-12);

        const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
          email: tempEmail,
          password: tempPassword,
        });

        if (signUpErr && signUpErr.message !== 'User already registered') {
          throw new Error(`Failed to create session: ${signUpErr.message}`);
        }

        // Sign in
        const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
          email: tempEmail,
          password: tempPassword,
        });

        if (signInErr) {
          throw new Error(`Failed to sign in: ${signInErr.message}`);
        }

        jwtToken = signInData?.session?.access_token;
      }

      if (!jwtToken) {
        throw new Error('Failed to obtain authentication token');
      }

      // Sync team members via local API endpoint
      const teamRes = await fetch('/api/square/team', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwtToken}`,
        },
        body: JSON.stringify({ squareAccessToken: token }),
      });

      const teamText = await teamRes.text();
      if (!teamRes.ok) {
        const data = teamText ? JSON.parse(teamText) : {};
        throw new Error(data?.message || `Team sync failed (${teamRes.status})`);
      }

      // Sync clients via local API endpoint
      const clientRes = await fetch('/api/square/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwtToken}`,
        },
        body: JSON.stringify({ squareAccessToken: token }),
      });

      const clientText = await clientRes.text();
      if (!clientRes.ok) {
        const data = clientText ? JSON.parse(clientText) : {};
        throw new Error(data?.message || `Client sync failed (${clientRes.status})`);
      }

      // Success - user is already authenticated via Supabase session
      // Don't call login('admin') - that would create a mock user and lose the real session
      localStorage.removeItem('mock_admin_user');
      window.location.href = '/admin';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
    }
  };

  const safeAccentColor = ensureAccessibleColor(branding.accentColor, '#FFFFFF', '#0F4C81');

  const headerStyle = {
    color: '#0F4C81', /* Blueprint Classic Blue for strong contrast on light background */
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6 transition-colors duration-500"
      style={{ backgroundColor: '#0F4C81' }}
    >
      <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-md overflow-hidden relative border-4 border-gray-950">
        <div className="bg-gray-50 p-10 text-center border-b-4 border-gray-100">
          {branding.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt={`${branding.salonName} Logo`}
              className="login-logo w-20 h-20 object-contain mx-auto mb-4"
            />
          ) : (
            <div
              className="w-20 h-20 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-xl transform -rotate-3"
              style={{ backgroundColor: safeAccentColor }}
            >
              <SettingsIcon className="w-10 h-10 text-white" />
            </div>
          )}

          <h1 className="text-3xl font-black tracking-tighter" style={headerStyle}>
            Pro Access
          </h1>
          <p className="text-xs font-black uppercase tracking-widest mt-2" style={{ color: '#0F4C81' }}>
            Internal Management
          </p>
        </div>

        <div className="p-10" style={{ backgroundColor: 'rgba(138, 186, 211, 0.1)' }}>

          {squareRedirectUri && (
            <div className="mb-6">
              <button
                onClick={startSquareOAuth}
                className="blueprint-button font-black"
              >
                Login with Square
              </button>
            </div>
          )}

          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1" style={{ height: '2px', backgroundColor: '#0F4C81' }}></div>
            <span className="text-xs font-semibold" style={{ color: '#374151' }}>or</span>
            <div className="flex-1" style={{ height: '2px', backgroundColor: '#0F4C81' }}></div>
          </div>

          <p className="text-center text-xs mb-4" style={{ color: '#374151' }}>
            Enter your Square access token to sync your team and clients
          </p>
          <form onSubmit={handleTokenSubmit} className="space-y-3">
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Square Access Token"
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg text-sm focus:outline-none focus:border-gray-950"
              disabled={loading}
            />
            {error && (
              <p className="text-red-600 text-xs font-bold">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="blueprint-button font-bold"
            >
              {loading ? 'Syncing...' : 'Sync Manually'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
