
import React, { useEffect } from 'react';
import type { GeneratedPlan, UserRole } from './types';
import { CURRENT_CLIENT } from './data/mockData';
import RoleSwitcher from './components/RoleSwitcher';
import StylistDashboard from './components/StylistDashboard';
import ClientDashboard from './components/ClientDashboard';
import AdminDashboard from './components/AdminDashboard';
import SetupScreen from './components/SetupScreen';
import LoginScreen from './components/LoginScreen';
import { supabase } from './lib/supabase';
import { SettingsProvider, useSettings } from './contexts/SettingsContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { PlanProvider, usePlans } from './contexts/PlanContext';
import './styles/accessibility.css';
import SquareCallback from './components/SquareCallback';
import { SquareIntegrationService } from './services/squareIntegration';

const AppContent: React.FC = () => {
  const { user, login, logout, isAuthenticated } = useAuth();
  const { getPlanForClient } = usePlans();
  const { integration, updateIntegration } = useSettings();

  const squareAuthed = sessionStorage.getItem('square_oauth_complete') === 'true';

  useEffect(() => {
    if (squareAuthed) {
      async function syncSquareCustomers() {
        try {
          const code = sessionStorage.getItem('square_oauth_code');
          if (!code) return;

          // 1. Exchange OAuth code for access token
          // We use the environment from settings.
          const tokens = await SquareIntegrationService.exchangeCodeForToken(code, integration.environment || 'production');
          
          // 2. Update persistent integration settings with the new tokens
          updateIntegration({
            ...integration,
            squareAccessToken: tokens.accessToken,
            squareRefreshToken: tokens.refreshToken,
            squareMerchantId: tokens.merchantId
          });

          // 3. Fetch live customers from Square API
          const squareCustomers = await SquareIntegrationService.fetchCustomers(tokens.accessToken, integration.environment || 'production');

          // 4. Persist Square customers to the application's database
          if (supabase && squareCustomers.length > 0) {
              const upsertData = squareCustomers.map(c => ({
                  external_id: c.id,
                  name: c.name,
                  email: c.email,
                  phone: c.phone,
                  avatar_url: c.avatarUrl,
                  source: 'square'
              }));

              const { error } = await supabase
                .from('clients')
                .upsert(upsertData, { onConflict: 'external_id' });
              
              if (error) {
                  console.error('Failed to persist Square customers to database:', error);
              } else {
                  console.log(`Successfully synced ${squareCustomers.length} customers from Square to database.`);
              }
          }

          // Store in localStorage for immediate frontend selector availability
          localStorage.setItem(
            'square_customers',
            JSON.stringify(squareCustomers)
          );
          
          // Clear the code so we don't repeat the exchange/sync process on every mount
          sessionStorage.removeItem('square_oauth_code');
          
        } catch (e) {
          console.error('Failed to sync Square customers:', e);
        }
      }
      syncSquareCustomers();
    }
  }, [squareAuthed, integration, updateIntegration]);

  if (!isAuthenticated && !squareAuthed) {
      // The onLogin prop is removed as client auth is now handled by Supabase,
      // and mock stylist/admin login is passed directly via the component.
      return <LoginScreen onLogin={login} />;
  }

  const renderDashboard = () => {
    // Square-auth users are treated as ADMIN role if no other user is logged in
    const effectiveRole = user?.role || (squareAuthed ? 'admin' : null);

    if (!effectiveRole) return null;

    switch (effectiveRole) {
      case 'stylist':
        // Stylist dashboard needs to know who the client is. 
        // For MVP, StylistDashboard manages its own client selection state.
        return <StylistDashboard 
                  onLogout={logout} 
               />;
      case 'client':
        // Load the REAL plan for this client
        const myPlan = user?.clientData ? getPlanForClient(user.clientData.id) : null;
        return <ClientDashboard 
                  client={(user?.clientData || (user?.isMock ? CURRENT_CLIENT : null)) as any} 
                  plan={myPlan} 
                  role="client" 
               />;
      case 'admin':
        return <AdminDashboard role="admin" />;
      default:
        return <div>Unknown role</div>;
    }
  };

  return (
    <div className="bg-brand-bg min-h-screen">
      <div className="max-w-md mx-auto bg-white shadow-lg min-h-screen relative pb-12">
        {renderDashboard()}
      </div>
    </div>
  );
};

const App: React.FC = () => {
  // Basic check for connection config existence
  const isDbConnected = !!supabase;
  
  // Simple routing for OAuth callback
  if (window.location.pathname === '/square/callback') {
    return (
        <SettingsProvider>
            <AuthProvider>
                <PlanProvider>
                    <SquareCallback />
                </PlanProvider>
            </AuthProvider>
        </SettingsProvider>
    );
  }

  return (
    <SettingsProvider>
        <AuthProvider>
            <PlanProvider>
                {!isDbConnected ? <SetupScreen /> : <AppContent />}
            </PlanProvider>
        </AuthProvider>
    </SettingsProvider>
  );
};

export default App;
