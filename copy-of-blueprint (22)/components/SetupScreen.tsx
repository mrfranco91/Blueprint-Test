import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { saveSupabaseConfig, getSupabaseConfig } from '../lib/supabase';
import { SettingsIcon, RefreshIcon, CheckCircleIcon } from './icons';

const SetupScreen: React.FC = () => {
  // Pre-fill with existing config (or defaults)
  const { url: initialUrl, key: initialKey } = getSupabaseConfig();
  
  const [url, setUrl] = useState(initialUrl || '');
  const [key, setKey] = useState(initialKey || '');
  const [error, setError] = useState<string | null>(null);
  const [rawError, setRawError] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  // Visual validation
  const isValidUrl = url.startsWith('https://') && url.includes('.supabase.co');
  const isValidKey = key.length > 20;

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setRawError(null);
    setIsTesting(true);

    let cleanUrl = url.trim();
    const cleanKey = key.trim();

    if (cleanUrl.endsWith('/')) cleanUrl = cleanUrl.slice(0, -1);

    if (!cleanUrl || !cleanKey) {
        setError("Please fill in both fields.");
        setIsTesting(false);
        return;
    }

    try {
        const tempClient = createClient(cleanUrl, cleanKey);
        
        // Try to fetch something innocuous. 
        // We use 'rpc' call to a non-existent function or just a basic query.
        // A 404/400/PGRST error means we reached the server -> Success.
        const { error: reqError } = await tempClient.from('__ping_test__').select('count').limit(1);

        if (reqError) {
            const msg = reqError.message.toLowerCase();
            // Only fail on strict Auth/Network errors
            if (msg.includes('invalid api key') || msg.includes('jwt') || msg.includes('apikey')) {
                 setRawError(reqError.message);
                 throw new Error("Invalid API Key.");
            }
            if (msg.includes('fetch') || msg.includes('network') || msg.includes('failed to fetch')) {
                 setRawError(reqError.message);
                 throw new Error("Network Error. URL might be wrong.");
            }
        }
        
        saveSupabaseConfig(cleanUrl, cleanKey);

    } catch (err: any) {
        console.error("Connection Failed:", err);
        setError(err.message || "Connection failed.");
        if (!rawError) setRawError(err.message);
        setIsTesting(false);
    }
  };

  const handleSkip = () => {
      if (!url || !key) return;
      // Force save without testing
      let cleanUrl = url.trim();
      if (cleanUrl.endsWith('/')) cleanUrl = cleanUrl.slice(0, -1);
      saveSupabaseConfig(cleanUrl, key.trim());
  };

  return (
    <div className="min-h-screen bg-brand-accent flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full relative">
        <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-brand-accent mb-2">Connect Backend</h1>
            <p className="text-gray-600">Enter your Supabase credentials.</p>
        </div>

        <form onSubmit={handleConnect} className="space-y-6">
            <div>
                <label className="block text-sm font-bold text-gray-900 mb-1">1. Project URL</label>
                <div className="relative">
                    <input 
                        type="text" 
                        value={url}
                        onChange={e => setUrl(e.target.value)}
                        placeholder="https://your-project-id.supabase.co"
                        className={`w-full p-3 border rounded-lg focus:ring-2 outline-none font-mono text-sm ${isValidUrl ? 'border-green-500 focus:ring-green-200' : 'border-gray-300 focus:ring-brand-primary'}`}
                    />
                    {isValidUrl && <CheckCircleIcon className="w-5 h-5 text-green-500 absolute right-3 top-3" />}
                </div>
            </div>
            
            <div>
                <label className="block text-sm font-bold text-gray-900 mb-1">2. API Key (Anon)</label>
                 <div className="relative">
                    <input 
                        type="password" 
                        value={key}
                        onChange={e => setKey(e.target.value)}
                        placeholder="eyJh..."
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary outline-none font-mono text-sm"
                    />
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
                    <p className="font-bold">{error}</p>
                    {rawError && (
                        <p className="mt-1 text-xs font-mono break-all opacity-80">{rawError}</p>
                    )}
                </div>
            )}
            
            <button 
                type="submit"
                disabled={isTesting}
                className={`w-full text-white font-bold py-3 rounded-full shadow-lg transition-colors mt-4 flex justify-center items-center ${isTesting ? 'bg-gray-400 cursor-wait' : 'bg-brand-primary hover:opacity-90'}`}
            >
                {isTesting ? (
                    <>
                        <RefreshIcon className="w-5 h-5 animate-spin mr-2" />
                        Verifying...
                    </>
                ) : (
                    "Launch App"
                )}
            </button>
            
            <div className="text-center pt-2">
                 {(url && key) && (
                     <button 
                        type="button" 
                        onClick={handleSkip} 
                        className="text-xs text-gray-400 underline hover:text-brand-accent"
                     >
                        I'm sure these are correct, skip test
                     </button>
                 )}
            </div>
        </form>
      </div>
    </div>
  );
};

export default SetupScreen;