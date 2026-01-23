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
            Enter your Square access token to manage your salon's service blueprints.
          </p>
          <form onSubmit={handleTokenSubmit} className="space-y-4">
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Square Access Token"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-gray-950"
              disabled={loading}
            />
            {error && (
              <p className="text-red-600 text-sm font-bold">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gray-950 text-white font-black py-4 rounded-2xl border-4 border-gray-950 shadow-lg active:scale-95 transition-transform disabled:opacity-50"
            >
              {loading ? 'Syncing...' : 'Sync with Square'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
