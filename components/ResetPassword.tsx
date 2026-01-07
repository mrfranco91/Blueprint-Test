
import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useSettings } from '../contexts/SettingsContext';
import { ensureAccessibleColor } from '../utils/ensureAccessibleColor';
import { RefreshIcon, CheckCircleIcon } from './icons';

const ResetPassword = () => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    
    const { branding } = useSettings();
    
    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }
        if (password.length < 6) {
            setError("Password must be at least 6 characters.");
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            if (!supabase) throw new Error("Supabase not initialized");
            const { error: resetError } = await supabase.auth.updateUser({ password });
            if (resetError) throw resetError;
            
            setSuccess(true);
            setTimeout(() => {
                window.location.replace('/');
            }, 2000);
        } catch (err: any) {
            setError(err.message || "Failed to update password.");
        } finally {
            setIsLoading(false);
        }
    };

    const safePrimaryColor = ensureAccessibleColor(branding.primaryColor, '#FFFFFF', '#BE123C');
    const buttonStyle = {
        backgroundColor: branding.primaryColor,
        color: ensureAccessibleColor('#FFFFFF', branding.primaryColor, '#FFFFFF')
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-brand-primary" style={{ backgroundColor: branding.primaryColor }}>
            <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-md overflow-hidden border-4 border-gray-950 p-10">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-black tracking-tighter text-gray-900">Set New Password</h1>
                    <p className="text-gray-500 mt-2 font-medium">Please enter your new security credentials.</p>
                </div>

                {success ? (
                    <div className="text-center animate-fade-in py-10">
                        <CheckCircleIcon className="w-20 h-20 text-green-500 mx-auto mb-4" />
                        <h2 className="text-2xl font-black text-gray-900">Password Updated!</h2>
                        <p className="text-gray-500 mt-2">Redirecting you to login...</p>
                    </div>
                ) : (
                    <form onSubmit={handleReset} className="space-y-4">
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">New Password</label>
                            <input 
                                type="password" 
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                placeholder="••••••••"
                                className="w-full p-4 border-4 border-gray-100 rounded-2xl focus:border-brand-primary outline-none transition-all bg-gray-50 font-bold"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Confirm Password</label>
                            <input 
                                type="password" 
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                placeholder="••••••••"
                                className="w-full p-4 border-4 border-gray-100 rounded-2xl focus:border-brand-primary outline-none transition-all bg-gray-50 font-bold"
                            />
                        </div>

                        {error && <p className="text-red-600 text-xs font-bold text-center p-3 bg-red-50 rounded-lg">{error}</p>}
                        
                        <button 
                            type="submit" 
                            disabled={isLoading}
                            className="w-full text-white font-black py-5 rounded-2xl shadow-xl transition-all active:scale-95 border-b-8 border-black/20 disabled:bg-gray-400"
                            style={buttonStyle}
                        >
                            {isLoading ? <RefreshIcon className="w-6 h-6 animate-spin mx-auto" /> : 'RESET PASSWORD'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default ResetPassword;
