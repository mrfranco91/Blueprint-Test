
import React, { useState } from 'react';
import type { UserRole } from '../types';
import { clearSupabaseConfig } from '../lib/supabase';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { UsersIcon, CheckCircleIcon, RefreshIcon, DocumentTextIcon, SettingsIcon, ChevronLeftIcon } from './icons';
import { ensureAccessibleColor } from '../utils/ensureAccessibleColor';

interface LoginScreenProps {
  onLogin: (role: UserRole, id?: string) => void;
  onSelectRole?: (role: UserRole) => void;
}

type AppMode = 'landing' | 'professional' | 'client';
type ClientAuthMode = 'signin' | 'signup';

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, onSelectRole }) => {
  const [appMode, setAppMode] = useState<AppMode>('landing');
  const [clientAuthMode, setClientAuthMode] = useState<ClientAuthMode>('signin');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);

  const { stylists, branding } = useSettings();
  const { signInClient, signUpClient, isAuthenticated } = useAuth();
  const squareAuthed = sessionStorage.getItem('square_oauth_complete') === 'true';

  const handleClientAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setAuthError(null);
    setAuthMessage(null);

    try {
        if (clientAuthMode === 'signup') {
            const { data, error } = await signUpClient({ 
                email, 
                password,
                options: { data: { role: 'client' } } 
            });
            if (error) throw error;
            if (data.user && !data.session) {
                setAuthMessage("Success! Please check your email to confirm your account.");
            }
        } else {
            const { error } = await signInClient({ email, password });
            if (error) throw error;
            // Successful sign-in will be handled by the onAuthStateChange listener
        }
    } catch (err: any) {
        setAuthError(err.message || 'An unexpected error occurred.');
    } finally {
        setIsLoading(false);
    }
  };
  
  const handleDevClientLogin = async () => {
    setIsLoading(true);
    setAuthError(null);
    setAuthMessage(null);
    try {
        await onLogin('client');
        onSelectRole?.('client');
    } catch (err: any) {
        setAuthError(`Dev login failed: ${err.message}. Ensure at least one client exists in the database.`);
    } finally {
        setIsLoading(false);
    }
  };

  const handleRoleSelection = (role: UserRole, id?: string) => {
      if (role === 'stylist' && id) {
          onLogin('stylist', id);
          onSelectRole?.('stylist');
      } else if (role === 'admin') {
          onLogin('admin');
          onSelectRole?.('admin');
      } else if (role === 'client') {
          onSelectRole?.('client');
      }
  };
  
  const safeAccentColor = ensureAccessibleColor(branding.accentColor, '#FFFFFF', '#1E3A8A');
  const safePrimaryColor = ensureAccessibleColor(branding.primaryColor, '#FFFFFF', '#BE123C');
  
  const handleSquareLogin = () => {
    const clientId = process.env.VITE_SQUARE_APPLICATION_ID;
    const redirectUri = process.env.VITE_SQUARE_REDIRECT_URI;

    if (!clientId) {
      setAuthError('Square login is unavailable. The application ID is missing.');
      return;
    }

    const scopes = [
      'CUSTOMERS_READ', 'CUSTOMERS_WRITE', 'EMPLOYEES_READ', 'EMPLOYEES_WRITE',
      'ITEMS_READ', 'ITEMS_WRITE', 'APPOINTMENTS_READ', 'APPOINTMENTS_WRITE',
      'MERCHANT_PROFILE_READ', 'MERCHANT_PROFILE_WRITE', 'ORDERS_READ', 'ORDERS_WRITE',
      'PAYMENTS_READ', 'PAYMENTS_WRITE', 'INVOICES_READ', 'INVOICES_WRITE',
      'SUBSCRIPTIONS_READ', 'SUBSCRIPTIONS_WRITE', 'INVENTORY_READ', 'INVENTORY_WRITE',
      'LOYALTY_READ', 'LOYALTY_WRITE', 'GIFTCARDS_READ', 'GIFTCARDS_WRITE', 'PAYOUTS_READ',
    ].map(s => s.trim()).join(' ');

    const authorizeBase = 'https://connect.squareup.com/oauth2/authorize';
    const state = crypto.randomUUID();

    const oauthUrl = `${authorizeBase}?client_id=${encodeURIComponent(clientId)}&response_type=code&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}&session=false`;

    window.location.href = oauthUrl;
  };

  if (appMode === 'landing') {
      return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
            <div className="text-center mb-10">
                {branding.logoUrl ? (
                    <img src={branding.logoUrl} alt={`${branding.salonName} Logo`} className="w-24 h-24 object-contain mx-auto mb-4" />
                ) : (
                    <div className="w-20 h-20 bg-brand-accent rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-xl transform -rotate-3">
                        <span className="text-white font-bold text-4xl">{branding.salonName?.[0] || 'S'}</span>
                    </div>
                )}
                <h1 className="text-3xl font-bold text-gray-900 tracking-tighter">{branding.salonName}</h1>
                <p className="text-gray-500 mt-2 font-medium">Select your application portal</p>
                {(isAuthenticated || squareAuthed) && (
                    <div className="mt-4 px-4 py-1 bg-green-100 text-green-800 rounded-full text-[10px] font-black uppercase tracking-widest inline-block">
                        Already Authenticated
                    </div>
                )}
            </div>

            <div className="w-full max-w-md space-y-4">
                <button 
                    onClick={() => setAppMode('professional')}
                    className="w-full bg-white p-6 rounded-[32px] shadow-lg border-4 border-transparent hover:border-brand-accent transition-all group text-left flex items-center"
                >
                    <div className="bg-brand-accent/10 p-4 rounded-2xl mr-5 group-hover:bg-brand-accent group-hover:text-white transition-colors" style={{ color: safeAccentColor }}>
                        <SettingsIcon className="w-8 h-8" />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-gray-950 leading-none">Professional App</h3>
                        <p className="text-xs font-bold text-gray-400 mt-2 uppercase tracking-widest">Stylists & Admins</p>
                    </div>
                </button>

                <button 
                    onClick={() => {
                        if (isAuthenticated) handleRoleSelection('client');
                        else setAppMode('client');
                    }}
                    className="w-full bg-white p-6 rounded-[32px] shadow-lg border-4 border-transparent hover:border-brand-primary transition-all group text-left flex items-center"
                >
                    <div className="bg-brand-primary/10 p-4 rounded-2xl mr-5 group-hover:bg-brand-primary group-hover:text-white transition-colors" style={{ color: safePrimaryColor }}>
                        <UsersIcon className="w-8 h-8" />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-gray-950 leading-none">Client Portal</h3>
                        <p className="text-xs font-bold text-gray-400 mt-2 uppercase tracking-widest">Customer Roadmaps</p>
                    </div>
                </button>
            </div>
            
            <p className="mt-12 text-gray-400 text-[10px] font-black uppercase tracking-widest">v1.5.1 • Enterprise Core</p>
        </div>
      );
  }

  const headerStyle = {
      color: ensureAccessibleColor(
          appMode === 'professional' ? branding.accentColor : branding.primaryColor,
          '#F9FAFB', 
          appMode === 'professional' ? '#1E3A8A' : '#BE123C'
      )
  };
  
  const buttonStyle = {
      backgroundColor: branding.primaryColor,
      color: ensureAccessibleColor('#FFFFFF', branding.primaryColor, '#1F2937')
  };

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-6 transition-colors duration-500`} style={{ backgroundColor: appMode === 'professional' ? branding.accentColor : branding.primaryColor}}>
      <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-md overflow-hidden relative border-4 border-gray-950">
        
        <button onClick={() => setAppMode('landing')} className="absolute top-6 left-6 text-gray-400 hover:text-gray-800 transition-colors z-10">
            <ChevronLeftIcon className="w-7 h-7" />
        </button>

        <div className="bg-gray-50 p-10 text-center border-b-4 border-gray-100">
            {appMode === 'client' && branding.logoUrl && (
                 <img src={branding.logoUrl} alt={`${branding.salonName} Logo`} className="w-20 h-20 object-contain mx-auto mb-4" />
            )}
            <h1 className="text-3xl font-black tracking-tighter" style={headerStyle}>
                {appMode === 'professional' ? 'Pro Access' : branding.salonName}
            </h1>
            <p className="text-gray-400 text-xs font-black uppercase tracking-widest mt-2">
                {appMode === 'professional' ? 'Internal Management' : 'Client Portal'}
            </p>
        </div>

        <div className="p-10">
            {appMode === 'client' ? (
                <div className="animate-fade-in">
                    <form onSubmit={handleClientAuth} className="space-y-4">
                        <h2 className="text-xl font-black text-center mb-4 text-gray-800">{clientAuthMode === 'signin' ? 'Sign In' : 'Create Account'}</h2>
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Email</label>
                            <input 
                                type="email" 
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                placeholder="you@example.com"
                                className="w-full p-4 border-4 border-gray-100 rounded-2xl focus:border-brand-primary outline-none transition-all bg-gray-50 font-bold"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Password</label>
                            <input 
                                type="password" 
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                placeholder="••••••••"
                                className="w-full p-4 border-4 border-gray-100 rounded-2xl focus:border-brand-primary outline-none transition-all bg-gray-50 font-bold"
                            />
                        </div>

                        {authError && <p className="text-red-600 text-xs font-bold text-center p-3 bg-red-50 rounded-lg">{authError}</p>}
                        {authMessage && <p className="text-green-600 text-xs font-bold text-center p-3 bg-green-50 rounded-lg">{authMessage}</p>}
                        
                        <button 
                            type="submit" 
                            disabled={isLoading}
                            className="w-full text-white font-black py-5 rounded-2xl shadow-xl transition-all active:scale-95 border-b-8 border-black/20 disabled:bg-gray-400"
                            style={buttonStyle}
                        >
                            {isLoading ? <RefreshIcon className="w-6 h-6 animate-spin mx-auto" /> : (clientAuthMode === 'signin' ? 'SIGN IN' : 'SIGN UP')}
                        </button>
                    </form>
                    <button 
                        onClick={() => {
                            setClientAuthMode(prev => prev === 'signin' ? 'signup' : 'signin');
                            setAuthError(null);
                            setAuthMessage(null);
                        }}
                        className="w-full text-center mt-6 text-xs font-black text-gray-400 uppercase tracking-widest hover:text-brand-primary"
                    >
                        {clientAuthMode === 'signin' ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
                    </button>
                    <div className="mt-8 pt-6 border-t-2 border-gray-100">
                        <div className="relative flex justify-center text-[10px] font-black uppercase tracking-widest mb-4">
                            <span className="px-4 bg-white text-gray-400">DEV ONLY</span>
                        </div>
                        <button 
                            type="button"
                            onClick={handleDevClientLogin}
                            disabled={isLoading}
                            className="w-full bg-amber-500 text-white font-black py-4 rounded-2xl shadow-lg border-b-4 border-amber-700 active:scale-95 transition-all disabled:bg-gray-400"
                        >
                            {isLoading ? <RefreshIcon className="w-6 h-6 animate-spin mx-auto" /> : "Login as Test Client (Dev Only)"}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="animate-fade-in">
                    {squareAuthed ? (
                         <button type="button" onClick={() => handleRoleSelection('admin')} className="w-full bg-blue-600 text-white font-black py-5 rounded-2xl shadow-lg flex items-center justify-center space-x-3 border-b-4 border-blue-800 active:scale-95 transition-all text-lg">
                            <span>Continue as Administrator</span>
                        </button>
                    ) : (
                        <button type="button" onClick={handleSquareLogin} className="w-full bg-blue-600 text-white font-black py-5 rounded-2xl shadow-lg flex items-center justify-center space-x-3 border-b-4 border-blue-800 active:scale-95 transition-all text-lg">
                            <span>Log in with Square</span>
                        </button>
                    )}
                    {authError && <p className="text-red-600 text-xs font-bold text-center p-3 mt-4 bg-red-50 rounded-lg">{authError}</p>}
                    
                    <div className="mt-8 text-gray-500">
                        <div className="mt-4 pt-4 border-t-2 border-gray-100 space-y-3">
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 text-center mb-2">Stylist Access</h3>
                             {stylists.slice(0, 3).map(s => (
                                <button key={s.id} onClick={() => handleRoleSelection('stylist', s.id)} className="w-full group flex items-center p-4 rounded-2xl border-4 border-gray-50 hover:border-brand-accent transition-all bg-white text-left">
                                    <div className="w-10 h-10 rounded-xl bg-brand-accent text-white flex items-center justify-center font-black text-sm">{s.name[0]}</div>
                                    <div className="ml-3">
                                        <p className="text-sm font-black text-gray-950 leading-none">{s.name}</p>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">{s.role}</p>
                                    </div>
                                </button>
                            ))}
                            <button onClick={() => handleRoleSelection('admin')} className="w-full group flex items-center p-4 rounded-2xl border-4 border-gray-950 bg-gray-950 text-white transition-all text-left">
                                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center font-black text-sm">A</div>
                                <div className="ml-3">
                                    <p className="text-sm font-black leading-none">Manual Admin Access</p>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Full Controller</p>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            <button onClick={clearSupabaseConfig} className="w-full text-center mt-10 text-[9px] font-black text-gray-300 uppercase tracking-widest hover:text-brand-accent transition-colors">
                Reset System Config
            </button>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
