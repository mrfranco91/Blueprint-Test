import React from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { SettingsIcon } from './icons';
import { ensureAccessibleColor } from '../utils/ensureAccessibleColor';

const LoginScreen: React.FC = () => {
  const { branding } = useSettings();

  const handleSquareLogin = () => {
    // This server-side route constructs the OAuth URL and redirects.
    window.location.href = '/api/square/oauth/start';
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
            onClick={handleSquareLogin}
            className="w-full bg-gray-950 text-white font-black py-4 rounded-2xl border-4 border-gray-950 shadow-lg active:scale-95 transition-transform"
          >
            Connect with Square
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;