
import React from 'react';
import type { GeneratedPlan, UserRole } from './types';
import { CURRENT_CLIENT } from './data/mockData';
import RoleSwitcher from './components/RoleSwitcher';
import StylistDashboard from './components/StylistDashboard';
import ClientDashboard from './components/ClientDashboard';
import AdminDashboard from './components/AdminDashboard';
import SetupScreen from './components/SetupScreen';
import LoginScreen from './components/LoginScreen';
import { supabase } from './lib/supabase';
import { SettingsProvider } from './contexts/SettingsContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { PlanProvider, usePlans } from './contexts/PlanContext';
import './styles/accessibility.css';
import SquareCallback from './components/SquareCallback';

const AppContent: React.FC = () => {
  const { user, login, logout, isAuthenticated } = useAuth();
  const { getPlanForClient } = usePlans();

  if (!isAuthenticated) {
      // The onLogin prop is removed as client auth is now handled by Supabase,
      // and mock stylist/admin login is passed directly via the component.
      return <LoginScreen onLogin={login} />;
  }

  const renderDashboard = () => {
    if (!user) return null;

    switch (user.role) {
      case 'stylist':
        // Stylist dashboard needs to know who the client is. 
        // For MVP, StylistDashboard manages its own client selection state.
        return <StylistDashboard 
                  onLogout={logout} 
               />;
      case 'client':
        // Load the REAL plan for this client
        const myPlan = user.clientData ? getPlanForClient(user.clientData.id) : null;
        return <ClientDashboard 
                  client={user.clientData || CURRENT_CLIENT} 
                  plan={myPlan} 
                  role={user.role} 
               />;
      case 'admin':
        return <AdminDashboard role={user.role} />;
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
            <SquareCallback />
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
