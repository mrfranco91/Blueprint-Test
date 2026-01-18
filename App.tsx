import React from 'react';
import type { UserRole } from './types';

import StylistDashboard from './components/StylistDashboard';
import AdminDashboard from './components/AdminDashboard';
import LoginScreen from './components/LoginScreen';
import MissingCredentialsScreen from './components/MissingCredentialsScreen';

import { SettingsProvider } from './contexts/SettingsContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { PlanProvider } from './contexts/PlanContext';

import { isSquareTokenMissing } from './services/squareIntegration';

import './styles/accessibility.css';

/* ----------------------------- */
/* App Content (Auth-aware UI)   */
/* ----------------------------- */

const AppContent: React.FC = () => {
  const { user, login, logout, authInitialized } = useAuth();

  console.log('[APP CONTENT STATE]', {
    authInitialized,
    user,
  });

  /*
    IMPORTANT:
    Never block rendering forever.
    If auth hasn't initialized yet, show login instead of spinner.
  */
  if (!authInitialized) {
    return <LoginScreen onLogin={login} />;
  }

  if (!user) {
    return <LoginScreen onLogin={login} />;
  }

  const renderDashboard = () => {
    const role: UserRole = user.role;

    switch (role) {
      case 'stylist':
        return <StylistDashboard onLogout={logout} role="stylist" />;

      case 'admin':
        return <AdminDashboard role="admin" />;

      default:
        return <LoginScreen onLogin={login} />;
    }
  };

  return (
    <div className="bg-brand-bg min-h-screen">
      <div className="max-w-md mx-auto bg-white shadow-lg min-h-screen relative">
        {renderDashboard()}
      </div>
    </div>
  );
};

/* ----------------------------- */
/* Root App Wrapper              */
/* ----------------------------- */

const App: React.FC = () => {
  /*
    CRITICAL FIX:
    isSquareTokenMissing is a FUNCTION.
    It MUST be called.
  */
  if (isSquareTokenMissing()) {
    return (
      <SettingsProvider>
        <MissingCredentialsScreen />
      </SettingsProvider>
    );
  }

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
