import React from 'react';

const MissingCredentialsScreen = () => {
  // FIX: Cast import.meta to any to resolve TypeScript error in environments where Vite client types are not available.
  const squareAppId =
    (import.meta as any).env.VITE_SQUARE_APPLICATION_ID ||
    (import.meta as any).env.VITE_SQUARE_CLIENT_ID;
  const squareRedirectUri = (import.meta as any).env.VITE_SQUARE_REDIRECT_URI;
  const squareEnv = ((import.meta as any).env.VITE_SQUARE_ENV || 'production').toLowerCase();

  const scopes =
    ((import.meta as any).env.VITE_SQUARE_OAUTH_SCOPES as string | undefined) ??
    'MERCHANT_PROFILE_READ EMPLOYEES_READ ITEMS_READ CUSTOMERS_READ CUSTOMERS_WRITE APPOINTMENTS_READ APPOINTMENTS_ALL_READ APPOINTMENTS_WRITE SUBSCRIPTIONS_READ SUBSCRIPTIONS_WRITE';

  const startOAuth = () => {
    if (!squareAppId || !squareRedirectUri) {
      alert("Square OAuth is not configured correctly. Missing Application ID or Redirect URI.");
      return;
    }

    const base =
      squareEnv === 'sandbox'
        ? 'https://connect.squareupsandbox.com/oauth2/authorize'
        : 'https://connect.squareup.com/oauth2/authorize';

    const url =
      `${base}` +
      `?client_id=${encodeURIComponent(squareAppId)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent(scopes)}` +
      `&redirect_uri=${encodeURIComponent(squareRedirectUri)}` +
      `&session=false`;

    window.location.href = url;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6 font-sans">
      <div className="bg-white p-10 rounded-[40px] border-4 border-gray-950 shadow-2xl text-center max-w-sm w-full">
        <h1
          className="text-2xl font-black tracking-tighter mb-4"
        >
          Sign in with Square
        </h1>
        <p className="text-sm font-bold text-gray-700 mb-6">
          Connect your Square account to access the Pro/Admin dashboard.
        </p>
        <button
          onClick={startOAuth}
          className="w-full bg-gray-950 text-white font-black py-3 rounded-2xl border-4 border-gray-950 shadow-lg"
        >
          Continue with Square
        </button>
      </div>
    </div>
  );
};

export default MissingCredentialsScreen;