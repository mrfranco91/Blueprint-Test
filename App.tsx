
import React from 'react';
import type { GeneratedPlan, UserRole } from './types';
import StylistDashboard from './components/StylistDashboard';
import AdminDashboard from './components/AdminDashboard';
import LoginScreen from './components/LoginScreen';
import { supabase } from './lib/supabase';
import { SettingsProvider } from './contexts/SettingsContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { PlanProvider } from './contexts/PlanContext';
import './styles/accessibility.css';

const AppContent: React.FC = () => {
  const { user, login, logout, isAuthenticated, authInitialized } = useAuth();

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

  // Authentication is now exclusively handled by mock logins.
  if (!isAuthenticated) {
      return <LoginScreen onLogin={login} />;
  }

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
      // Client dashboard is disabled in this stabilization patch.
      case 'client':
        return <LoginScreen onLogin={login} />; // Fallback to login
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
  // SetupScreen and dynamic DB connection logic removed per stabilization patch.
  // The app now relies exclusively on build-time environment variables.
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
