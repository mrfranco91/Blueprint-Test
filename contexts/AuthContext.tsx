import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { User, UserRole } from '../types';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  logout: () => Promise<void>;
  authInitialized: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authInitialized, setAuthInitialized] = useState(false);

  useEffect(() => {
    let mounted = true;

    const resolveSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!mounted) return;

      if (session?.user) {
        const { role, business_name } = session.user.user_metadata || {};
        if (role) {
          setUser({
            id: session.user.id,
            name: business_name || 'Admin',
            role: role as UserRole,
            email: session.user.email,
            isMock: false,
          });
        } else {
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setAuthInitialized(true);
    };

    resolveSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      if (session?.user) {
        const { role, business_name } = session.user.user_metadata || {};
        if (role) {
          setUser({
            id: session.user.id,
            name: business_name || 'Admin',
            role: role as UserRole,
            email: session.user.email,
            isMock: false,
          });
        } else {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        logout,
        authInitialized,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};