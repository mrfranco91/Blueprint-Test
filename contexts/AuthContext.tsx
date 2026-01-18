    import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { User, UserRole } from '../types';
import { supabase } from '../lib/supabase';
import { isSquareTokenMissing } from '../services/squareIntegration';

interface AuthContextType {
  user: User | null;
  login: (role: UserRole) => Promise<void>;
  logout: () => Promise<void>;
  authInitialized: boolean;
  needsSquareConnect: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authInitialized, setAuthInitialized] = useState(false);
  const [needsSquareConnect, setNeedsSquareConnect] = useState(false);

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      const { data } = await supabase.auth.getSession();
      const sessionUser = data.session?.user;

      if (!mounted) return;

      if (!sessionUser) {
        setUser(null);
        setNeedsSquareConnect(false);
        setAuthInitialized(true);
        return;
      }

      const { role, business_name } = sessionUser.user_metadata || {};

      if (role !== 'admin') {
        setUser(null);
        setNeedsSquareConnect(false);
        setAuthInitialized(true);
        return;
      }

      // ✅ ADMIN IS LOGGED IN
      setUser({
        id: sessionUser.id,
        name: business_name || 'Admin',
        role: 'admin',
        email: sessionUser.email,
        isMock: false,
      });

      // 🔑 THIS IS THE MISSING LOGIC
      // FIX: `isSquareTokenMissing` is a boolean constant, not a function.
      setNeedsSquareConnect(isSquareTokenMissing);

      setAuthInitialized(true);
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      initAuth();
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const login = async (role: UserRole) => {
    if (role === 'admin') {
      setUser({
        id: 'admin',
        name: 'Admin',
        role: 'admin',
        isMock: true,
      });
      setNeedsSquareConnect(true);
      setAuthInitialized(true);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setNeedsSquareConnect(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        authInitialized,
        needsSquareConnect,
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
