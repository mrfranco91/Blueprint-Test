import React, { useEffect } from 'react';
import type { GeneratedPlan, UserRole } from './types';
import StylistDashboard from './components/StylistDashboard';
import AdminDashboard from './components/AdminDashboard';
import { supabase } from './lib/supabase';
import { SettingsProvider } from './contexts/SettingsContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { PlanProvider } from './contexts/PlanContext';
import './styles/accessibility.css';
import MissingCredentialsScreen from './components/MissingCredentialsScreen';
import { isSquareTokenMissing } from './services/squareIntegration';

const AppContent: React.FC = () => {
  const { user, logout, authInitialized } = useAuth();

  // Handle Square OAuth completion (code stored by /square-callback)
  useEffect(() => {
    const squareAuthed = sessionStorage.getItem('square_oauth_complete') === 'true';
    if (!squareAuthed) return;

    (async () => {
      const code = sessionStorage.getItem('square_oauth_code');
      if (!code) return;

      try {
        const res = await fetch('/api/square/oauth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });

        const data = await res.json();
        if (res.ok && data?.access_token) {
          localStorage.setItem('square_access_token', data.access_token);
          window.location.reload(); // Reload to apply the new token everywhere
        }
      } finally {
        // Always clear to prevent loops/retries on every load
        sessionStorage.removeItem('square_oauth_complete');
        sessionStorage.removeItem('square_oauth_code');
      }
    })();
  }, []);

  // 🔒 ABSOLUTE GATE: Square OAuth is REQUIRED to access the app.
  // Providers are now mounted, so hooks are safe.
  if (isSquareTokenMissing) {
    return <MissingCredentialsScreen />;
  }

  // AUTH INITIALIZATION GATE:
  // Do not render anything until the auth state has been confirmed. This prevents
  // a flash of the login screen or a redirect loop on page load.
  if (!authInitialized) {
    return (
        <div className="flex items-center justify-center h-screen">
            <div className="w-16 h-16 border-4 border-brand-accent border-t-transparent rounded-full animate-spin"></div>
        </div>
    );
  }

  // Internal login screen has been removed per patch request.
  // App now relies on AuthProvider to set a user (e.g., from a session for admins).
  // If no user is set, a blank screen will render.
  
  const renderDashboard = () => {
    const effectiveRole = user?.role;

    if (!effectiveRole) {
      return null;
    }

    switch (effectiveRole) {
      case 'stylist':
        return <StylistDashboard 
                  onLogout={logout} 
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
  return (
    <SettingsProvider>
      <AuthProvider>
        <PlanProvider>
          <AppContent />
        </PlanProvider>
      </AuthProvider>
    </SettingsProvider>
  );
};

export default App;