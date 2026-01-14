import { useEffect, useState } from 'react';

const SquareCallback = () => {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        const errorParam = params.get('error_description') || params.get('error');

        if (errorParam) {
          setError(decodeURIComponent(errorParam));
          return;
        }

        if (!code) {
          setError('Missing OAuth code from Square.');
          return;
        }

        const res = await fetch('/api/square/oauth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });

        const data = await res.json();

        if (!res.ok || !data?.access_token) {
          setError(data?.message || 'Failed to exchange Square OAuth token.');
          return;
        }

        // ✅ PERSIST TOKEN — THIS WAS MISSING
        localStorage.setItem('square_access_token', data.access_token);

        // Clean URL + redirect to app
        window.location.replace('/');
      } catch (e: any) {
        setError(e?.message || 'Square OAuth failed.');
      }
    };

    run();
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6 font-sans">
        <div className="bg-white p-6 rounded-2xl border-4 border-red-600 text-center max-w-sm w-full shadow-lg">
          <h1 className="font-black mb-2 text-red-800">Square Login Failed</h1>
          <p className="text-sm font-bold text-gray-700">{error}</p>
          <a href="/" className="mt-4 inline-block text-xs font-bold text-gray-500 underline">Return to App</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6 font-sans">
      <div className="text-sm font-bold text-gray-700">
        Completing Square login…
      </div>
    </div>
  );
};

export default SquareCallback;