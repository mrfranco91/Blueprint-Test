

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
    const { stylists, clients: mockClients } = useSettings();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!supabase) {
            setLoading(false);
            return;
        }

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            setLoading(true);
            const authUser = session?.user;

            if (authUser) {
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
                    // Existing client logic
                    try {
                        const { data: canonicalClient, error: canonicalError } = await supabase
                            .from('clients')
                            .select('*')
                            .eq('id', authUser.id)
                            .single();

                        if (canonicalError && canonicalError.code !== 'PGRST116') {
                            throw canonicalError;
                        }
                        
                        let finalClientProfile = canonicalClient;

                        if (!finalClientProfile) {
                            const nameFromEmail = authUser.email?.split('@')[0] || 'New Client';
                            const { data: newClientData, error: insertError } = await supabase.from('clients')
                                .upsert({
                                    id: authUser.id,
                                    email: authUser.email,
                                    name: nameFromEmail,
                                    avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(nameFromEmail)}&background=random`,
                                })
                                .select()
                                .single();
                            
                            if (insertError) throw insertError;
                            finalClientProfile = newClientData;
                        }

                        if (finalClientProfile) {
                            const clientData: Client = {
                                id: finalClientProfile.id,
                                externalId: finalClientProfile.external_id,
                                name: finalClientProfile.name,
                                email: finalClientProfile.email,
                                phone: finalClientProfile.phone,
                                avatarUrl: finalClientProfile.avatar_url,
                                historicalData: [],
                            };
                            setUser({ id: authUser.id, name: clientData.name, role: 'client', email: authUser.email, clientData, avatarUrl: clientData.avatarUrl });
                        }
                    } catch (error) {
                        console.error("Auth state change error for client:", error);
                        setUser(null);
                    }
                }
            } else {
                setUser(null);
            }
            setLoading(false);
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    // Mock login for stylists and admin
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
