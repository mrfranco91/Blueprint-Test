import React from 'react';
import type { UserRole } from './types';
import StylistDashboard from './components/StylistDashboard';
import AdminDashboard from './components/AdminDashboard';
import { SettingsProvider } from './contexts/SettingsContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { PlanProvider } from './contexts/PlanContext';
import './styles/accessibility.css';
import MissingCredentialsScreen from './components/MissingCredentialsScreen';
import { isSquareTokenMissing } from './services/squareIntegration';
import LoginScreen from './components/LoginScreen';

const AppContent: React.FC = () => {
  const { user, login, logout, authInitialized } = useAuth();

  // AUTH INITIALIZATION GATE:
  // Do not render anything until the auth state has been confirmed. This prevents
  // a flash of the login screen or a redirect loop on page load.
  if (!authInitialized) {
    return (
      <div className="flex items-center justify-center h-screen bg-brand-bg">
        <div className="w-16 h-16 border-4 border-brand-accent border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen onLogin={login} />;
  }

  if (user.role === 'admin') {
    return <AdminDashboard role="admin" />;
  }

  if (user.role === 'stylist') {
    return <StylistDashboard onLogout={logout} role="stylist" />;
  }

  return <LoginScreen onLogin={login} />; // Default to login screen
};

const App: React.FC = () => {
  if (isSquareTokenMissing) {
    return <MissingCredentialsScreen />;
  }

  return (
    <AuthProvider>
      <SettingsProvider>
        <PlanProvider>
          <AppContent />
        </PlanProvider>
      </SettingsProvider>
    </AuthProvider>
  );
};

export default App;
