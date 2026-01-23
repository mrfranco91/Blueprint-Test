
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ALL_SERVICES, STYLIST_LEVELS, MEMBERSHIP_TIERS, MOCK_CLIENTS } from '../data/mockData';
import type { Service, StylistLevel, Stylist, MembershipTier, Client, ServiceLinkingConfig, BrandingSettings, MembershipConfig, AppTextSize, User } from '../types';
import { supabase } from '../lib/supabase';

export interface IntegrationSettings {
    provider: 'vagaro' | 'square' | 'mindbody';
    squareAccessToken?: string;
    squareRefreshToken?: string;
    squareMerchantId?: string;
    environment: 'sandbox' | 'production';
}

interface SettingsContextType {
    services: Service[];
    levels: StylistLevel[];
    stylists: Stylist[];
    clients: Client[];
    membershipConfig: MembershipConfig;
    branding: BrandingSettings;
    integration: IntegrationSettings;
    linkingConfig: ServiceLinkingConfig;
    textSize: AppTextSize;
    pushAlertsEnabled: boolean;
    pinnedReports: { [userId: string]: string[] };
    updateServices: (services: Service[]) => void;
    updateLevels: (levels: StylistLevel[]) => void;
    updateStylists: (stylists: Stylist[]) => void;
    updateClients: (clients: Client[]) => void;
    updateMembershipConfig: React.Dispatch<React.SetStateAction<MembershipConfig>>;
    updateBranding: (branding: BrandingSettings) => void;
    updateIntegration: (integration: IntegrationSettings) => void;
    updateLinkingConfig: (config: ServiceLinkingConfig) => void;
    updateTextSize: (size: AppTextSize) => void;
    updatePushAlertsEnabled: (enabled: boolean) => void;
    updatePinnedReports: (userId: string | number, reportIds: string[]) => void;
    createClient: (clientData: { name: string; email: string }) => Promise<Client>;
    resolveClientByExternalId: (externalId: string, clientDetails: { name: string; email?: string; phone?: string; avatarUrl?: string; }) => Promise<Client>;
    saveAll: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [services, setServices] = useState<Service[]>(() => {
        try {
            const saved = localStorage.getItem('admin_services');
            return saved ? JSON.parse(saved) : ALL_SERVICES;
        } catch { return ALL_SERVICES; }
    });

    const [linkingConfig, setLinkingConfig] = useState<ServiceLinkingConfig>(() => {
        try {
            const saved = localStorage.getItem('admin_linking_config');
            return saved ? JSON.parse(saved) : {
                enabled: false,
                triggerCategory: 'Color',
                triggerServiceIds: [],
                exclusionServiceId: '',
                linkedServiceId: ''
            };
        } catch { 
            return { enabled: false, triggerCategory: 'Color', triggerServiceIds: [], exclusionServiceId: '', linkedServiceId: '' };
        }
    });

    const [levels, setLevels] = useState<StylistLevel[]>(() => {
        try {
            const saved = localStorage.getItem('admin_levels');
            return saved ? JSON.parse(saved) : STYLIST_LEVELS;
        } catch { return STYLIST_LEVELS; }
    });

    const [stylists, setStylists] = useState<Stylist[]>(() => {
        try {
            const saved = localStorage.getItem('admin_team');
            return saved ? JSON.parse(saved) : [
                { 
                    id: 'TM-aBcDeFgHiJkLmN', 
                    name: 'Jessica Miller', 
                    role: 'Full Time', 
                    levelId: 'lvl_2', 
                    email: 'jessica@example.com', 
                    permissions: { 
                        canBookAppointments: true, 
                        canOfferDiscounts: true, 
                        requiresDiscountApproval: false, 
                        viewGlobalReports: false,
                        viewClientContact: true,
                        viewAllSalonPlans: false
                    } 
                },
                { 
                    id: 'TM-oPqRsTuVwXyZaB', 
                    name: 'David Chen', 
                    role: 'Full Time', 
                    levelId: 'lvl_3', 
                    email: 'david@example.com', 
                    permissions: { 
                        canBookAppointments: true, 
                        canOfferDiscounts: true, 
                        requiresDiscountApproval: false, 
                        viewGlobalReports: true,
                        viewClientContact: true,
                        viewAllSalonPlans: true
                    } 
                },
                { 
                    id: 'TM-cDeFgHiJkLmNoP', 
                    name: 'Sarah Jones', 
                    role: 'Apprentice', 
                    levelId: 'lvl_1', 
                    email: 'sarah@example.com', 
                    permissions: { 
                        canBookAppointments: false, 
                        canOfferDiscounts: false, 
                        requiresDiscountApproval: true, 
                        viewGlobalReports: false,
                        viewClientContact: false,
                        viewAllSalonPlans: false
                    } 
                },
            ];
        } catch { return []; }
    });

    const [clients, setClients] = useState<Client[]>(() => {
        try {
            const saved = localStorage.getItem('admin_clients');
            return saved ? JSON.parse(saved) : MOCK_CLIENTS;
        } catch { return MOCK_CLIENTS; }
    });

    const [membershipConfig, setMembershipConfig] = useState<MembershipConfig>(() => {
        try {
            const saved = localStorage.getItem('admin_membership_config');
            return saved ? JSON.parse(saved) : { enabled: true, tiers: MEMBERSHIP_TIERS };
        } catch { return { enabled: true, tiers: MEMBERSHIP_TIERS }; }
    });

    const [branding, setBranding] = useState<BrandingSettings>(() => {
        return {
            salonName: localStorage.getItem('admin_brand_name') || 'Luxe Salon & Spa',
            primaryColor: localStorage.getItem('admin_brand_primary') || '#BE123C',
            secondaryColor: localStorage.getItem('admin_brand_secondary') || '#0F766E',
            accentColor: localStorage.getItem('admin_brand_accent') || '#1E3A8A',
            font: localStorage.getItem('admin_brand_font') || 'Roboto'
        };
    });

    const [integration, setIntegration] = useState<IntegrationSettings>(() => {
        try {
            const saved = localStorage.getItem('admin_integration');
            const parsed = saved ? JSON.parse(saved) : {};
            return { 
                provider: 'square', 
                squareAccessToken: '',
                squareRefreshToken: '',
                squareMerchantId: '',
                environment: 'production', 
                ...parsed 
            };
        } catch { return { provider: 'square', squareAccessToken: '', squareRefreshToken: '', squareMerchantId: '', environment: 'production' }; }
    });

    const [textSize, setTextSize] = useState<AppTextSize>(() => (localStorage.getItem('admin_text_size') as AppTextSize) || 'M');
    const [pushAlertsEnabled, setPushAlertsEnabled] = useState<boolean>(() => localStorage.getItem('admin_push_alerts_enabled') === 'true');
    const [pinnedReports, setPinnedReports] = useState<{ [userId: string]: string[] }>(() => {
        try {
            const saved = localStorage.getItem('admin_pinned_reports');
            return saved ? JSON.parse(saved) : {};
        } catch { return {}; }
    });

    useEffect(() => {
        document.documentElement.style.setProperty('--color-brand-primary', branding.primaryColor);
        document.documentElement.style.setProperty('--color-brand-secondary', branding.secondaryColor);
        document.documentElement.style.setProperty('--color-brand-accent', branding.accentColor);
        
        // Font logic
        document.body.classList.remove('font-sans', 'font-serif', 'font-mono');
        const font = branding.font;

        if (font && !['font-sans', 'font-serif', 'font-mono'].includes(font)) {
            const fontId = `google-font-${font.replace(/ /g, '-')}`;
            if (!document.getElementById(fontId)) {
                const link = document.createElement('link');
                link.id = fontId;
                link.href = `https://fonts.googleapis.com/css2?family=${font.replace(/ /g, '+')}:wght@400;700;900&display=swap`;
                link.rel = 'stylesheet';
                document.head.appendChild(link);
            }
            document.body.style.fontFamily = `'${font}', sans-serif`;
        } else {
             document.body.classList.add(font);
             document.body.style.fontFamily = '';
        }
    }, [branding]);

    useEffect(() => {
        document.body.classList.remove('text-size-s', 'text-size-m', 'text-size-l');
        document.body.classList.add(`text-size-${textSize.toLowerCase()}`);
    }, [textSize]);

    useEffect(() => {
        const fetchClientsFromDb = async () => {
            if (!supabase) return;
            try {
                const { data, error } = await supabase.from('clients').select('*');
                if (!error && data) {
                    const dbClients: Client[] = data.map(row => ({
                        id: row.id,
                        externalId: row.external_id,
                        name: row.name,
                        email: row.email,
                        phone: row.phone,
                        avatarUrl: row.avatar_url,
                        historicalData: [],
                        source: row.source
                    }));
                    
                    if (dbClients.length > 0) {
                        setClients(prev => {
                            const clientMap = new Map();
                            // Keep mock clients as fallback
                            MOCK_CLIENTS.forEach(c => clientMap.set(c.id, c));
                            // Overwrite with DB data
                            dbClients.forEach(c => clientMap.set(c.id, c));
                            return Array.from(clientMap.values());
                        });
                    }
                }
            } catch (err) {
                console.error("Error fetching clients from database:", err);
            }
        };
        fetchClientsFromDb();
    }, []);

    const updateTextSize = (size: AppTextSize) => {
        setTextSize(size);
        localStorage.setItem('admin_text_size', size);
    };

    const updatePushAlertsEnabled = (enabled: boolean) => {
        setPushAlertsEnabled(enabled);
        localStorage.setItem('admin_push_alerts_enabled', String(enabled));
    };

    const updatePinnedReports = (userId: string | number, reportIds: string[]) => {
        const newPinned = { ...pinnedReports, [userId.toString()]: reportIds };
        setPinnedReports(newPinned);
        localStorage.setItem('admin_pinned_reports', JSON.stringify(newPinned));
    };

    const createClient = async (clientData: { name: string, email: string }): Promise<Client> => {
        if (!supabase) throw new Error("Supabase is not initialized.");
        
        const avatar_url = `https://ui-avatars.com/api/?name=${encodeURIComponent(clientData.name)}&background=random`;

        const { data, error } = await supabase
            .from('clients')
            .insert({
                name: clientData.name,
                email: clientData.email,
                avatar_url
            })
            .select()
            .single();

        if (error) {
            console.error("Supabase client creation error:", error);
            throw error;
        }

        const newClient: Client = {
            id: data.id,
            externalId: data.external_id,
            name: data.name,
            email: data.email,
            phone: data.phone,
            avatarUrl: data.avatar_url,
            historicalData: []
        };
        
        setClients(prev => [...prev, newClient]);
        
        return newClient;
    };
    
    const resolveClientByExternalId = async (externalId: string, clientDetails: { name: string; email?: string; phone?: string; avatarUrl?: string; }): Promise<Client> => {
        if (!supabase) throw new Error("Supabase is not initialized.");
        if (!externalId) throw new Error("External ID is required to resolve a client.");

        const { data: existingClient, error: findError } = await supabase
            .from('clients')
            .select('*')
            .eq('external_id', externalId)
            .maybeSingle();

        if (findError) throw findError;

        if (existingClient) {
            const resolvedClient: Client = {
                id: existingClient.id,
                externalId: existingClient.external_id,
                name: existingClient.name,
                email: existingClient.email,
                phone: existingClient.phone,
                avatarUrl: existingClient.avatar_url,
                historicalData: []
            };
            setClients(prev => {
                const index = prev.findIndex(c => c.id === resolvedClient.id || (c.externalId && c.externalId === externalId));
                if (index > -1) {
                    const updated = [...prev];
                    updated[index] = resolvedClient;
                    return updated;
                }
                return [...prev, resolvedClient];
            });
            return resolvedClient;
        }

        const { data: newDbClient, error: createError } = await supabase
            .from('clients')
            .insert({
                external_id: externalId,
                name: clientDetails.name,
                email: clientDetails.email,
                phone: clientDetails.phone,
                avatar_url: clientDetails.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(clientDetails.name)}&background=random`
            })
            .select()
            .single();
        
        if (createError) throw createError;

        const newClient: Client = {
            id: newDbClient.id,
            externalId: newDbClient.external_id,
            name: newDbClient.name,
            email: newDbClient.email,
            phone: newDbClient.phone,
            avatarUrl: newDbClient.avatar_url,
            historicalData: []
        };
        
        setClients(prev => [...prev, newClient]);
        return newClient;
    };

    const saveAll = () => {
        try {
            localStorage.setItem('admin_services', JSON.stringify(services));
            localStorage.setItem('admin_linking_config', JSON.stringify(linkingConfig));
            localStorage.setItem('admin_levels', JSON.stringify(levels));
            localStorage.setItem('admin_team', JSON.stringify(stylists));
            localStorage.setItem('admin_clients', JSON.stringify(clients));
            localStorage.setItem('admin_membership_config', JSON.stringify(membershipConfig));
            localStorage.setItem('admin_integration', JSON.stringify(integration));
            localStorage.setItem('admin_brand_name', branding.salonName);
            localStorage.setItem('admin_brand_primary', branding.primaryColor);
            localStorage.setItem('admin_brand_secondary', branding.secondaryColor);
            localStorage.setItem('admin_brand_accent', branding.accentColor);
            localStorage.setItem('admin_brand_font', branding.font);
        } catch (e) {
            console.error('Failed to save settings:', e);
        }
    };

    return (
        <SettingsContext.Provider value={{
            services, levels, stylists, clients, membershipConfig, branding, integration, linkingConfig, textSize, pushAlertsEnabled, pinnedReports,
            updateServices: setServices,
            updateLevels: setLevels,
            updateStylists: setStylists,
            updateClients: setClients,
            updateMembershipConfig: setMembershipConfig,
            updateBranding: setBranding,
            updateIntegration: setIntegration,
            updateLinkingConfig: setLinkingConfig,
            updateTextSize,
            updatePushAlertsEnabled,
            updatePinnedReports,
            createClient,
            resolveClientByExternalId,
            saveAll
        }}>
            {children}
        </SettingsContext.Provider>
    );
};

export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error("useSettings must be used within a SettingsProvider");
    }
    return context;
};
