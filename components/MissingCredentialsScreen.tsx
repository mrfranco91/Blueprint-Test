import React from 'react';
import { DatabaseIcon } from './icons';

const MissingCredentialsScreen: React.FC = () => {
  return (
    <div className="min-h-screen bg-red-50 flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-white p-10 rounded-[40px] shadow-2xl border-4 border-red-200 max-w-sm w-full">
        <div className="w-20 h-20 bg-red-100 rounded-3xl flex items-center justify-center mx-auto mb-6 text-red-500">
          <DatabaseIcon className="w-10 h-10" />
        </div>
        <h1 className="text-2xl font-black text-red-900 tracking-tighter mb-4">
          Configuration Error
        </h1>
        <p className="text-sm font-bold text-red-800 leading-relaxed mb-2">
          The application cannot start because the required environment variables are missing.
        </p>
        <div className="mt-6 text-left bg-red-50 p-4 rounded-xl border border-red-200">
            <p className="text-xs font-bold text-red-600 uppercase mb-2">Required Variables:</p>
            <code className="block text-sm font-mono text-red-900 bg-red-100 p-2 rounded">SUPABASE_URL</code>
            <code className="block text-sm font-mono text-red-900 bg-red-100 p-2 rounded mt-2">SUPABASE_ANON_KEY</code>
            <code className="block text-sm font-mono text-red-900 bg-red-100 p-2 rounded mt-2">SQUARE_ACCESS_TOKEN</code>
        </div>
        <p className="text-xs text-red-600 mt-4">
            Please provide these variables in your hosting environment to continue.
        </p>
      </div>
    </div>
  );
};

export default MissingCredentialsScreen;
