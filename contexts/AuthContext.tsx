import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
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
    let active = true;

    const hydrateFromSession = (session: any) => {
      if (!active) return;

      const authUser = session?.user;

      if (!authUser) {
        setUser(null);
        setAuthInitialized(true);
        return;
      }

      // AUTHENTICATED: do not clear user due to missing metadata
      const businessName = authUser.user_metadata?.business_name;
      const role = (authUser.user_metadata?.role as UserRole) || 'admin';

      setUser({
        id: authUser.id,
        name: businessName || 'Admin',
        role,
        email: authUser.email,
        isMock: false,
      });

      setAuthInitialized(true);
    };

    // Check for mock admin session in localStorage first
    const savedMockUser = localStorage.getItem('mock_admin_user');
    if (savedMockUser) {
      try {
        const user = JSON.parse(savedMockUser);
        if (active) {
          setUser(user);
          setAuthInitialized(true);
        }
      } catch (e) {
        console.error('Failed to restore mock user session:', e);
        setAuthInitialized(true);
      }
      return;
    }

    if (!supabase) {
      setAuthInitialized(true);
      return;
    }

    // IMPORTANT: hydrate existing session immediately on mount
    supabase.auth.getSession().then(({ data }) => {
      hydrateFromSession(data.session);
    });

    // Listen for any future auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      hydrateFromSession(session);
    });

    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, []);

  // Keep existing signature; do not refactor callers.
  // (Used only for any existing non-Square demo flows.)
  const login = async (role: UserRole, specificId?: string) => {
    if (role === 'admin') {
      setUser({
        id: 'admin',
        name: 'Admin',
        role: 'admin',
        isMock: true,
      });
      setAuthInitialized(true);
      return;
    }

    // No-op for non-admin in this context (do not redesign auth here)
    setAuthInitialized(true);
  };

  const logout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setAuthInitialized(true);
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
