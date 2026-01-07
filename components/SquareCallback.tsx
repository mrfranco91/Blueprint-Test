
import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { SquareIntegrationService } from '../services/squareIntegration';

const SquareCallback: React.FC = () => {
  const [error, setError] = useState<string | null>(null);
  const { login } = useAuth();
  const { integration, updateIntegration, saveAll } = useSettings();

  useEffect(() => {
    const processCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const state = params.get('state');

      console.log('Square OAuth callback received:', { code, state });

      if (!code) {
        setError('OAuth authentication failed: No authorization code provided by Square.');
        return;
      }

      try {
        // Exchange authorization code for an access token
        const { accessToken, refreshToken, merchantId } = await SquareIntegrationService.exchangeCodeForToken(code, integration.environment);

        // Update application settings with the new Square credentials
        updateIntegration({
          ...integration,
          squareAccessToken: accessToken,
          squareRefreshToken: refreshToken,
          squareMerchantId: merchantId,
        });
        
        // Persist the settings to localStorage
        saveAll();
        
        sessionStorage.setItem('square_just_connected', 'true');

        // Log the user in as an admin. The Square OAuth flow is for professional users.
        await login('admin');

        // Redirect to the application's root. The user is now authenticated,
        // and the app will render the appropriate dashboard instead of the login screen.
        window.location.href = '/';

      } catch (err: any) {
        console.error('Error during Square token exchange:', err);
        setError(`Failed to connect to Square: ${err.message}`);
      }
    };

    processCallback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-red-50 p-6 text-center">
          <div className="bg-white p-8 rounded-2xl shadow-lg border-2 border-red-200">
            <h1 className="text-2xl font-bold text-red-800">Connection Failed</h1>
            <p className="text-red-600 mt-2 max-w-sm">{error}</p>
            <a href="/" className="mt-6 inline-block px-6 py-3 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors">
                Return to Login
            </a>
          </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4 text-center">
        <div className="flex flex-col items-center">
            <div className="w-16 h-16 border-4 border-brand-accent border-t-transparent rounded-full animate-spin mb-6"></div>
            <h1 className="text-2xl font-bold text-gray-800">Finalizing connection to Square…</h1>
            <p className="text-gray-600 mt-2">Please wait, this should only take a moment.</p>
        </div>
    </div>
  );
};

export default SquareCallback;
