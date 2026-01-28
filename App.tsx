import React from 'react';
import { SpeedInsights } from '@vercel/speed-insights/react';

import StylistDashboard from './components/StylistDashboard';
import AdminDashboard from './components/AdminDashboard';
import ClientDashboard from './components/ClientDashboard';
import LoginScreen from './components/LoginScreen';
import MissingCredentialsScreen from './components/MissingCredentialsScreen';

import { SettingsProvider, useSettings } from './contexts/SettingsContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { PlanProvider } from './contexts/PlanContext';

import './styles/accessibility.css';

const LoadingScreen: React.FC = () => (
  <div className="flex items-center justify-center h-screen">
    <div className="animate-spin h-10 w-10 border-4 border-gray-300 border-t-transparent rounded-full" />
  </div>
);

interface WrongAppNoticeProps {
  title: string;
  description: string;
  actionLabel: string;
  actionHref: string;
}

const WrongAppNotice: React.FC<WrongAppNoticeProps> = ({
  title,
  description,
  actionLabel,
  actionHref,
}) => (
  <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-gray-50 to-white px-6">
    <div className="bg-white border-4 border-gray-100 rounded-3xl shadow-lg p-8 max-w-lg text-center">
      <h1 className="text-3xl font-black text-gray-950 mb-4 tracking-tight">{title}</h1>
      <p className="text-gray-600 font-semibold mb-6">{description}</p>
      <a
        className="inline-flex items-center justify-center px-6 py-3 rounded-2xl bg-gray-950 text-white font-black shadow-lg hover:shadow-xl transition-shadow"
        href={actionHref}
      >
        {actionLabel}
      </a>
    </div>
  </div>
);

const StylistAppContent: React.FC = () => {
  const { user, logout, authInitialized } = useAuth();
  const { needsSquareConnect } = useSettings();

  if (!authInitialized) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <LoginScreen />;
  }

  if (needsSquareConnect) {
    return <MissingCredentialsScreen />;
  }

  if (user.role === 'admin') {
    return <AdminDashboard role="admin" />;
  }

  if (user.role === 'stylist') {
    return <StylistDashboard onLogout={logout} role="stylist" />;
  }

  return (
    <WrongAppNotice
      title="This is the stylist app"
      description="Your account is set up as a client. Use the client app to view your plan and appointments."
      actionLabel="Go to client app"
      actionHref="/client.html"
    />
  );
};

const ClientAppContent: React.FC = () => {
  const { user, authInitialized } = useAuth();

  if (!authInitialized) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <LoginScreen />;
  }

  if (user.role !== 'client') {
    return (
      <WrongAppNotice
        title="This is the client app"
        description="Your account is set up for professionals. Use the stylist app to manage clients and plans."
        actionLabel="Go to stylist app"
        actionHref="/"
      />
    );
  }

  return <ClientDashboard />;
};

const AppProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <SettingsProvider>
    <AuthProvider>
      <PlanProvider>
        {children}
        <SpeedInsights />
      </PlanProvider>
    </AuthProvider>
  </SettingsProvider>
);

export const StylistApp: React.FC = () => (
  <AppProviders>
    <StylistAppContent />
  </AppProviders>
);

export const ClientApp: React.FC = () => (
  <AppProviders>
    <ClientAppContent />
  </AppProviders>
);

const App = StylistApp;

export default App;
