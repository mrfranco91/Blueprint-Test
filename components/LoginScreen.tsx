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

      // For manual token sync, we need a persistent Supabase user account
      let jwtToken: string | null = null;

      // Try to get existing session first
      const { data: session } = await supabase.auth.getSession();
      if (session?.session?.access_token) {
        jwtToken = session.session.access_token;
      } else {
        // Use a persistent test account for manual sync (same credentials each time)
        const tempEmail = 'manual-sync@blueprint.local';
        const tempPassword = 'blueprint-manual-sync';

        // Try to sign in first (account may already exist)
        let signInData = await supabase.auth.signInWithPassword({
          email: tempEmail,
          password: tempPassword,
        });

        // If sign in fails, create the account
        if (signInData.error) {
          const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
            email: tempEmail,
            password: tempPassword,
          });

          if (signUpErr && signUpErr.message !== 'User already registered') {
            throw new Error(`Failed to create session: ${signUpErr.message}`);
          }

          // Try signing in again after signup
          signInData = await supabase.auth.signInWithPassword({
            email: tempEmail,
            password: tempPassword,
          });
        }

        if (signInData.error) {
          throw new Error(`Failed to sign in: ${signInData.error.message}`);
        }

        jwtToken = signInData?.data?.session?.access_token;
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
      console.log('Team sync response:', { status: teamRes.status, text: teamText });
      if (!teamRes.ok) {
        const data = teamText ? JSON.parse(teamText) : {};
        console.warn('Team sync failed:', data?.message || `Team sync failed (${teamRes.status})`);
        // Don't throw - team sync is not critical
      } else {
        console.log('Team sync succeeded');
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
      console.log('Client sync response:', { status: clientRes.status, text: clientText });
      if (!clientRes.ok) {
        const data = clientText ? JSON.parse(clientText) : {};
        console.warn('Client sync failed:', data?.message || `Client sync failed (${clientRes.status})`);
        // Don't throw - client sync is not critical
      } else {
        console.log('Client sync succeeded');
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
      style={{ backgroundColor: branding.primaryColor }}
    >
      <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-md overflow-hidden relative border-4 border-gray-950">
        <div className="bg-gray-50 p-10 text-center border-b-4" style={{ borderColor: branding.primaryColor }}>
          {branding.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt={`${branding.salonName} Logo`}
              className="login-logo w-20 h-20 object-contain mx-auto mb-4"
            />
          ) : (
            <div
              className="w-20 h-20 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-xl transform -rotate-3"
              style={{ backgroundColor: branding.accentColor }}
            >
              <SettingsIcon className="w-10 h-10 text-white" />
            </div>
          )}

          <h1 className="text-3xl font-black tracking-tighter" style={{ color: branding.primaryColor }}>
            Pro Access
          </h1>
          <p className="text-xs font-black uppercase tracking-widest mt-2" style={{ color: branding.primaryColor }}>
            Internal Management
          </p>
        </div>

        <div className="p-10" style={{ backgroundColor: `rgba(${parseInt(branding.primaryColor.slice(1, 3), 16)}, ${parseInt(branding.primaryColor.slice(3, 5), 16)}, ${parseInt(branding.primaryColor.slice(5, 7), 16)}, 0.08)` }}>

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
            <div className="flex-1" style={{ height: '2px', backgroundColor: branding.primaryColor }}></div>
            <span className="text-xs font-semibold" style={{ color: '#374151' }}>or</span>
            <div className="flex-1" style={{ height: '2px', backgroundColor: branding.primaryColor }}></div>
          </div>

          <p className="text-center text-sm font-bold mb-6" style={{ color: '#374151' }}>
            Enter your Square access token to sync your team and clients
          </p>
          <form onSubmit={handleTokenSubmit} className="space-y-4">
            <div>
              <label className="block text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: '#374151' }}>
                Square Access Token
              </label>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Paste your access token"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl font-bold text-sm focus:outline-none focus:border-gray-950"
                disabled={loading}
              />
            </div>
            {error && (
              <p className="text-red-600 text-xs font-bold text-center bg-red-50 p-3 rounded-lg">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full font-black py-4 rounded-2xl border-4 border-gray-950 uppercase tracking-widest text-sm shadow-lg active:scale-95 transition-all"
              style={{ backgroundColor: branding.accentColor, color: '#FFFFFF' }}
            >
              {loading ? 'Syncing...' : 'Sync with Token'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
