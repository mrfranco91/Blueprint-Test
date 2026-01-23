import React, { useState } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { SettingsIcon } from './icons';
import { ensureAccessibleColor } from '../utils/ensureAccessibleColor';

const LoginScreen: React.FC = () => {
  const { branding } = useSettings();
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTokenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) {
      setError('Please enter a Square access token');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Sync team members
      const teamRes = await fetch('/api/square/team', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-square-access-token': token,
        },
      });

      if (!teamRes.ok) {
        const data = await teamRes.json();
        throw new Error(data?.message || 'Failed to sync team');
      }

      // Sync clients
      const clientRes = await fetch('/api/square/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-square-access-token': token,
        },
      });

      if (!clientRes.ok) {
        const data = await clientRes.json();
        throw new Error(data?.message || 'Failed to sync clients');
      }

      // Success - redirect to admin
      window.location.href = '/admin';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
    }
  };

  const safeAccentColor = ensureAccessibleColor(branding.accentColor, '#FFFFFF', '#1E3A8A');

  const headerStyle = {
    color: ensureAccessibleColor(branding.accentColor, '#F9FAFB', '#1E3A8A'),
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6 transition-colors duration-500"
      style={{ backgroundColor: branding.accentColor }}
    >
      <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-md overflow-hidden relative border-4 border-gray-950">
        <div className="bg-gray-50 p-10 text-center border-b-4 border-gray-100">
          {branding.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt={`${branding.salonName} Logo`}
              className="w-20 h-20 object-contain mx-auto mb-4"
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
          <p className="text-gray-400 text-xs font-black uppercase tracking-widest mt-2">
            Internal Management
          </p>
        </div>

        <div className="p-10">
          <p className="text-center text-sm font-bold text-gray-700 mb-6">
            Connect your Square account to manage your salon's service blueprints.
          </p>
          <button
            onClick={() => {
              window.location.href = '/api/square/oauth/start';
            }}
            className="w-full bg-gray-950 text-white font-black py-4 rounded-2xl border-4 border-gray-950 shadow-lg active:scale-95 transition-transform"
          >
            Connect with Square
          </button>

          <div className="my-6 flex items-center gap-4">
            <div className="flex-1 h-px bg-gray-300" />
            <span className="text-xs text-gray-500 font-bold">OR</span>
            <div className="flex-1 h-px bg-gray-300" />
          </div>

          <p className="text-center text-xs text-gray-600 mb-4">
            Manually enter your Square access token for development/testing
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
              className="w-full bg-gray-200 text-gray-950 font-bold py-3 rounded-lg border-2 border-gray-300 active:scale-95 transition-transform disabled:opacity-50 text-sm"
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
