
import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import type { User, UserRole, Stylist, Client } from '../types';
import { useSettings } from './SettingsContext';
import { supabase } from '../lib/supabase';

interface AuthContextType {
    user: User | null;
    login: (role: UserRole, specificId?: string | number) => Promise<void>;
    logout: () => Promise<void>;
    isAuthenticated: boolean;
    authInitialized: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const { stylists } = useSettings();
    const [authInitialized, setAuthInitialized] = useState(false);

    useEffect(() => {
        if (!supabase) {
            setAuthInitialized(true);
            return;
        }

        // With client auth disabled, this only checks for a potential admin session.
        const resolveUserFromSession = async (session: any) => {
            const authUser = session?.user;
            if (!authUser) {
                setUser(null);
                return;
            }

            const { role } = authUser.user_metadata || {};

            if (role === 'admin') {
                const { business_name } = authUser.user_metadata;
                setUser({
                    id: authUser.id,
                    name: business_name || 'Admin',
                    role: 'admin',
                    email: authUser.email,
                    isMock: false
                });
            } else {
                // Client role resolution is disabled in this patch.
                setUser(null);
            }
        };

        let subscribed = true;

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            if (subscribed) {
                await resolveUserFromSession(session);
                setAuthInitialized(true);
            }
        });

        return () => {
            subscribed = false;
            subscription?.unsubscribe();
        };
    }, []);

    // Mock login for stylists and admin (dev/demo purposes)
    const login = async (role: UserRole, specificId?: string | number) => {
        if (role === 'stylist' || role === 'admin') {
            let newUser: User | null = null;
            if (role === 'admin') {
                newUser = { id: 'admin', name: 'System Administrator', role: 'admin', isMock: true };
            } else {
                const stylist = specificId ? stylists.find(s => s.id === specificId) : stylists[0];
                if (stylist) {
                    newUser = { id: stylist.id, name: stylist.name, role: 'stylist', email: stylist.email, stylistData: stylist };
                }
            }
            setUser(newUser);
        }
        // Client mock login is disabled.
    };

    const logout = async () => {
        if (supabase) {
            const { error } = await supabase.auth.signOut();
            if (error) console.error("Error signing out:", error);
        }
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user, authInitialized }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};
