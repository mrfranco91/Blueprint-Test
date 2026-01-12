
import React from 'react';
import type { UserRole } from '../types';
import { useSettings } from '../contexts/SettingsContext';
import { SettingsIcon } from './icons';
import { ensureAccessibleColor } from '../utils/ensureAccessibleColor';

interface LoginScreenProps {
  onLogin: (role: UserRole, id?: string) => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const { stylists, branding } = useSettings();

  const headerStyle = {
      color: ensureAccessibleColor(branding.accentColor, '#F9FAFB', '#1E3A8A')
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ backgroundColor: branding.accentColor}}>
      <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-md overflow-hidden border-4 border-gray-950">
        
        <div className="bg-gray-50 p-10 text-center border-b-4 border-gray-100">
            {branding.logoUrl && (
                 <img src={branding.logoUrl} alt={`${branding.salonName} Logo`} className="w-20 h-20 object-contain mx-auto mb-4" />
            )}
            <h1 className="text-3xl font-black tracking-tighter" style={headerStyle}>
                Pro Access
            </h1>
            <p className="text-gray-400 text-xs font-black uppercase tracking-widest mt-2">
                Internal Management
            </p>
        </div>

        <div className="p-10">
            <div className="animate-fade-in">
                <p className="text-center text-xs text-gray-500 mt-3 px-4 mb-4">Select a user to continue (mock login).</p>
                <div className="mt-4 pt-4 space-y-3">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 text-center mb-2">Stylist Login</h3>
                     {stylists.slice(0, 3).map(s => (
                        <button key={s.id} onClick={() => onLogin('stylist', s.id)} className="w-full group flex items-center p-4 rounded-2xl border-4 border-gray-50 hover:border-brand-accent transition-all bg-white text-left">
                            <div className="w-10 h-10 rounded-xl bg-brand-accent text-white flex items-center justify-center font-black text-sm">{s.name[0]}</div>
                            <div className="ml-3">
                                <p className="text-sm font-black text-gray-950 leading-none">{s.name}</p>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">{s.role}</p>
                            </div>
                        </button>
                    ))}
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 text-center mb-2 pt-4 border-t-2 border-gray-100">Admin Login</h3>
                    <button onClick={() => onLogin('admin')} className="w-full group flex items-center p-4 rounded-2xl border-4 border-gray-950 bg-gray-950 text-white transition-all text-left">
                        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center font-black text-sm">A</div>
                        <div className="ml-3">
                            <p className="text-sm font-black leading-none">System Admin</p>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Full Controller</p>
                        </div>
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
