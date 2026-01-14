
import React, { useEffect, useState } from 'react';
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
import SettingsPage from './components/SettingsPage';
import BottomNav from './components/BottomNav';

const AppContent: React.FC = () => {
  const { user, logout, authInitialized } = useAuth();
  const [view, setView] = useState('dashboard');

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

  const renderCurrentView = () => {
    const effectiveRole: UserRole = user?.role || 'stylist';
    
    if (view === 'settings') {
      return (
        <SettingsProvider>
          <div className="flex flex-col h-full bg-brand-bg">
            <div className="flex-grow flex flex-col pb-20 overflow-hidden">
              <SettingsPage />
            </div>
            <BottomNav
              role={effectiveRole}
              activeTab="settings"
              onNavigate={(tab) => {
                if (tab !== 'settings') {
                  setView('dashboard');
                }
              }}
            />
          </div>
        </SettingsProvider>
      );
    }
    
    // Default to the user's role-specific dashboard.
    switch (effectiveRole) {
      case 'stylist':
        return <StylistDashboard 
                  onLogout={logout} 
                  onNavigate={setView}
               />;
      case 'admin':
        return <AdminDashboard role="admin" onNavigate={setView} />;
      default:
        return <div>Unknown role</div>;
    }
  };

  return (
    <div className="bg-brand-bg min-h-screen">
      <div className="max-w-md mx-auto bg-white shadow-lg min-h-screen relative pb-12">
        {renderCurrentView()}
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
