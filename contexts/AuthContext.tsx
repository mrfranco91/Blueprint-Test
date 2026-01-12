
import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import type { User, UserRole, Stylist, Client } from '../types';
import { useSettings } from './SettingsContext';
import { supabase } from '../lib/supabase';

interface AuthContextType {
    user: User | null;
    login: (role: UserRole, specificId?: string | number) => Promise<void>; // Mock login for stylist/admin
    signInClient: (credentials: {email: string, password: string}) => Promise<any>;
    signUpClient: (credentials: {email: string, password: string, options?: { data: any } }) => Promise<any>;
    logout: () => Promise<void>;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const { stylists } = useSettings();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!supabase) {
            setLoading(false);
            return;
        }

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
                // CLIENT AUTHENTICATION RESOLUTION
                try {
                    // RESOLVE CLIENT BY EMAIL
                    const { data: clientRow, error: clientError } = await supabase
                        .from('clients')
                        .select('*')
                        .eq('email', authUser.email)
                        .maybeSingle();

                    if (clientError) {
                        console.error("Error fetching client profile during resolution:", clientError);
                        setUser(null);
                        return;
                    }

                    if (clientRow) {
                        const clientData: Client = {
                            id: clientRow.id,
                            externalId: clientRow.external_id,
                            name: clientRow.name,
                            email: clientRow.email,
                            phone: clientRow.phone,
                            avatarUrl: clientRow.avatar_url,
                            historicalData: [],
                            source: clientRow.source
                        };
                        setUser({ 
                            id: authUser.id, 
                            name: clientData.name, 
                            role: 'client', 
                            email: authUser.email, 
                            clientData, 
                            avatarUrl: clientData.avatarUrl 
                        });
                    } else {
                        // Keep the user authenticated as a guest if no linked record exists
                        // This allows the ClientDashboard to show the "Not Linked" state
                        setUser({ 
                            id: authUser.id, 
                            name: authUser.email?.split('@')[0] || 'Guest', 
                            role: 'client', 
                            email: authUser.email, 
                            clientData: undefined 
                        });
                    }
                } catch (error) {
                    console.error("Fatal error during user resolution:", error);
                    setUser(null);
                }
            }
        };
        
        // Set loading to true to show spinner while the first auth state is being determined.
        setLoading(true);

        // onAuthStateChange is the single source of truth. It fires immediately with the
        // current session, and then for any subsequent changes.
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (session) {
                await resolveUserFromSession(session);
            } else {
                setUser(null);
            }
            // This is the critical fix: once the initial state is determined (or any
            // subsequent state change occurs), the app is no longer in its initial
            // loading phase. This breaks the deadlock.
            setLoading(false);
        });

        return () => {
            subscription.unsubscribe();
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
        } else if (role === 'client') { // DEV-ONLY mock client login
             if (!supabase) {
                throw new Error("Supabase not initialized for mock client login");
            }
            const { data, error } = await supabase.from('clients').select('*').limit(1).single();

            if (error) {
                console.error("Error fetching a client for dev login:", error);
                throw new Error("Could not find a client in the database to log in with.");
            }

            if (data) {
                const clientProfile = data;
                const clientData: Client = {
                    id: clientProfile.id,
                    externalId: clientProfile.external_id,
                    name: clientProfile.name,
                    email: clientProfile.email,
                    phone: clientProfile.phone,
                    avatarUrl: clientProfile.avatar_url,
                    historicalData: [],
                    source: clientProfile.source
                };
                setUser({
                    id: clientProfile.id,
                    name: clientData.name,
                    role: 'client',
                    email: clientData.email,
                    clientData,
                    avatarUrl: clientData.avatarUrl,
                    isMock: true
                });
            } else {
                 throw new Error("No client found in the database.");
            }
        }
    };

    const signInClient = async (credentials: {email: string, password: string}) => {
        if (!supabase) throw new Error("Supabase not initialized");
        return await supabase.auth.signInWithPassword(credentials);
    };

    const signUpClient = async (credentials: {email: string, password: string, options?: { data: any }}) => {
        if (!supabase) throw new Error("Supabase not initialized");
        return await supabase.auth.signUp(credentials);
    };

    const logout = async () => {
        if (supabase) {
            const { error } = await supabase.auth.signOut();
            if (error) console.error("Error signing out:", error);
        }
        setUser(null);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="w-16 h-16 border-4 border-brand-accent border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <AuthContext.Provider value={{ user, login, signInClient, signUpClient, logout, isAuthenticated: !!user }}>
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
