import React from 'react';
import type { UserRole } from '../types';
import { clearSupabaseConfig } from '../lib/supabase';
import { useSettings } from '../contexts/SettingsContext';
import { SettingsIcon } from './icons';
import { ensureAccessibleColor } from '../utils/ensureAccessibleColor';

interface LoginScreenProps {
  onLogin: (role: UserRole, id?: string) => void;
}

/**
 * PRO-ONLY BUILD:
 * - OAuth disabled.
 * - Login is only available via mock accounts for development.
 */
const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const { stylists, branding } = useSettings();

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
          <div className="space-y-3">
            <h3 className="text-center text-xs font-black uppercase tracking-widest text-gray-400 mb-4">
              Development Login
            </h3>

            {stylists.slice(0, 3).map((s) => (
              <button
                key={s.id}
                onClick={() => onLogin('stylist', s.id)}
                className="w-full group flex items-center p-4 rounded-2xl border-4 border-gray-50 hover:border-brand-accent transition-all bg-white text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-brand-accent text-white flex items-center justify-center font-black text-sm">
                  {s.name[0]}
                </div>
                <div className="ml-3">
                  <p className="text-sm font-black text-gray-950 leading-none">{s.name}</p>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">{s.role}</p>
                </div>
              </button>
            ))}

            <button
              onClick={() => onLogin('admin')}
              className="w-full group flex items-center p-4 rounded-2xl border-4 border-gray-950 bg-gray-950 text-white transition-all text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center font-black text-sm">
                A
              </div>
              <div className="ml-3">
                <p className="text-sm font-black leading-none">System Admin</p>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Full Controller</p>
              </div>
            </button>
          </div>

          <button
            onClick={clearSupabaseConfig}
            className="w-full text-center mt-10 text-[9px] font-black text-gray-300 uppercase tracking-widest hover:text-brand-accent transition-colors"
          >
            Reset System Database Config
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;