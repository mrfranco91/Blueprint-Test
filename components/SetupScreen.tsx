import React from 'react';

// This component has been disabled as part of the stabilization patch.
// Supabase is now configured exclusively via build-time environment variables.
const SetupScreen: React.FC = () => {
  return (
    <div className="min-h-screen bg-brand-accent flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full text-center">
        <h1 className="text-2xl font-bold text-gray-900">Configuration Disabled</h1>
        <p className="text-gray-600 mt-2">This app is configured via environment variables.</p>
      </div>
    </div>
  );
};

export default SetupScreen;
