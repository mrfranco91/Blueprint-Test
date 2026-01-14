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

  const renderDashboard = () => {
    // By defaulting to 'stylist', the app shell renders correctly even when
    // no user is present (e.g., immediately after OAuth), restoring navigation.
    const effectiveRole: UserRole = user?.role || 'stylist';

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
  // 🔒 Square OAuth is the FIRST gate — before Supabase/Auth providers are mounted.
  if (isSquareTokenMissing) {
    return (
      <SettingsProvider>
        <MissingCredentialsScreen />
      </SettingsProvider>
    );
  }

  // ✅ Square connected — now it is safe to initialize Supabase/Auth.
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