import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import type { User, UserRole } from '../types';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  login: (role: UserRole, specificId?: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  authInitialized: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authInitialized, setAuthInitialized] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setAuthInitialized(true);
      return;
    }

    const resolveUserFromSession = async (session: any) => {
      const authUser = session?.user;
      if (!authUser) {
        setUser(null);
        return;
      }

      const { role, business_name } = authUser.user_metadata || {};

      if (role === 'admin') {
        setUser({
          id: authUser.id,
          name: business_name || 'Admin',
          role: 'admin',
          email: authUser.email,
          isMock: false,
        });
      } else {
        setUser(null);
      }
    };

    let active = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!active) return;
        await resolveUserFromSession(session);
        setAuthInitialized(true);
      }
    );

    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, []);

  const login = async (role: UserRole, specificId?: string) => {
    if (role === 'admin') {
      setUser({
        id: 'admin',
        name: 'System Administrator',
        role: 'admin',
        isMock: true,
      });
    }
    if (role === 'stylist') {
        // This is a simplified mock login. A real app would fetch stylist data.
        setUser({
            id: specificId || 'stylist_mock',
            name: `Stylist ${specificId || ''}`.trim(),
            role: 'stylist',
            isMock: true
        });
    }
  };

  const logout = async () => {
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) console.error('Error signing out:', error);
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        isAuthenticated: !!user,
        authInitialized,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
