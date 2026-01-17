import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type {
  Service,
  StylistLevel,
  Stylist,
  MembershipTier,
  Client,
  ServiceLinkingConfig,
  BrandingSettings,
  MembershipConfig,
  AppTextSize,
} from '../types';
import { ALL_SERVICES, STYLIST_LEVELS, MEMBERSHIP_TIERS } from '../data/mockData';
import type { Service, StylistLevel, Stylist, MembershipTier, Client, ServiceLinkingConfig, BrandingSettings, MembershipConfig, AppTextSize, User } from '../types';
import { supabase } from '../lib/supabase';
import { SquareIntegrationService, isSquareTokenMissing } from '../squareIntegration';

interface IntegrationSettings {
  provider: 'square';
  environment: 'sandbox' | 'production';
export interface IntegrationSettings {
provider: 'vagaro' | 'square' | 'mindbody';
environment: 'sandbox' | 'production';
}

// Accept ALL valid UUID versions (including v7 used by Supabase)
const isValidUUID = (id?: string) =>
!!id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

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
  loadingTeam: boolean;
  teamError: string | null;
  updateClients: (clients: Client[]) => void;
  createClient: (clientData: { name: string; email: string }) => Promise<Client>;
  // FIX: Added missing properties to resolve TypeScript errors in AdminDashboard and AccountSettings.
  updateBranding: (branding: BrandingSettings) => void;
  updateMembershipConfig: (config: MembershipConfig) => void;
  updateStylists: (stylists: Stylist[]) => void;
  updateServices: (services: Service[]) => void;
  saveAll: () => Promise<void>;
  resolveClientByExternalId: (
    externalId: string,
    details: { name: string; email?: string; phone?: string; avatarUrl?: string }
  ) => Promise<Client>;
  updateTextSize: (size: AppTextSize) => void;
  updatePushAlertsEnabled: (enabled: boolean) => void;
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
loadingTeam: boolean;
teamError: string | null;
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
  const [clients, setClients] = useState<Client[]>([]);
  const [stylists, setStylists] = useState<Stylist[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [teamError, setTeamError] = useState<string | null>(null);
  // FIX: Added state management for settings to allow updates from components.
  const [services, setServices] = useState<Service[]>([]);
  const [levels, setLevels] = useState<StylistLevel[]>([]);
  const [membershipConfig, setMembershipConfig] = useState<MembershipConfig>({
    enabled: true,
    tiers: [],
  });
  const [branding, setBranding] = useState<BrandingSettings>({
    salonName: 'Blueprint',
    primaryColor: '#4338CA',
    secondaryColor: '#DB2777',
    accentColor: '#059669',
    font: 'Inter',
  });
  const [integration, setIntegration] = useState<IntegrationSettings>({
    provider: 'square',
    environment: 'production',
  });
  const [linkingConfig, setLinkingConfig] = useState<ServiceLinkingConfig>({
    enabled: true,
    triggerCategory: 'Color',
    triggerServiceIds: [],
    exclusionServiceId: 's1',
    linkedServiceId: 's6',
  });
  const [textSize, setTextSize] = useState<AppTextSize>('M');
  const [pushAlertsEnabled, setPushAlertsEnabled] = useState(false);
  const [pinnedReports, setPinnedReports] = useState<{ [userId: string]: string[] }>({});

  // --- REQUIRED: Load clients from Supabase only ---
  useEffect(() => {
    if (!supabase) return;

    let cancelled = false;

    const loadClients = async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: true });

      if (cancelled) return;

      if (error) {
        console.error('Failed to load clients:', error);
        setClients([]);
        return;
      }

      const mapped: Client[] = (data || []).map((row: any) => ({
        id: row.id,
        externalId: row.external_id,
        name: row.name,
        email: row.email,
        phone: row.phone,
        avatarUrl: row.avatar_url,
        historicalData: [],
        source: row.source || 'manual',
      }));

      setClients(mapped);
    };

    loadClients();

    return () => {
      cancelled = true;
    };
  }, []);

  // --- OPTIONAL: Load Square team (must NEVER block app) ---
  useEffect(() => {
    if (!supabase) return;

    let cancelled = false;
    setLoadingTeam(true);
    setTeamError(null);

    const loadTeam = async () => {
      const { data, error } = await supabase
        .from('square_team_members')
        .select('*');

      if (cancelled) return;

      if (error) {
        console.warn('Square team not available:', error.message);
        setStylists([]);
        setTeamError(null);
        setLoadingTeam(false);
        return;
      }

      const mapped: Stylist[] = (data || []).map((row: any) => ({
        id: row.square_team_member_id,
        name: row.name,
        role: row.role || 'Stylist',
        email: row.email,
        levelId: row.level_id || 'default',
        permissions: row.permissions || {},
      }));

      setStylists(mapped);
      setLoadingTeam(false);
    };

    loadTeam();

    return () => {
      cancelled = true;
    };
  }, []);

  const createClient = async (clientData: { name: string; email: string }) => {
    if (!supabase) throw new Error('Supabase not initialized');

    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(
      clientData.name
    )}&background=random`;

    const { data, error } = await supabase
      .from('clients')
      // FIX: Cast payload to `any` to resolve Supabase type inference issue.
      .insert({
        name: clientData.name,
        email: clientData.email,
        avatar_url: avatarUrl,
      } as any)
      .select()
      .single();

    if (error || !data) {
      throw error || new Error('Failed to create client');
    }

    // FIX: Cast `data` to `any` to resolve Supabase type inference issues.
    const dbRow = data as any;
    const newClient: Client = {
      id: dbRow.id,
      externalId: dbRow.external_id,
      name: dbRow.name,
      email: dbRow.email,
      phone: dbRow.phone,
      avatarUrl: dbRow.avatar_url,
      historicalData: [],
      source: 'manual',
    };

    setClients(prev => [...prev, newClient]);
    return newClient;
  };

  // FIX: Implemented missing update and utility functions.
  const updateBranding = (newBranding: BrandingSettings) => setBranding(newBranding);
  const updateMembershipConfig = (newConfig: MembershipConfig) => setMembershipConfig(newConfig);
  const updateStylists = (newStylists: Stylist[]) => setStylists(newStylists);
  const updateServices = (newServices: Service[]) => setServices(newServices);
  const updateTextSize = (newSize: AppTextSize) => setTextSize(newSize);
  const updatePushAlertsEnabled = (enabled: boolean) => setPushAlertsEnabled(enabled);

  const saveAll = async () => {
    console.log("Saving all settings... (not implemented)");
  };

  const resolveClientByExternalId = async (
    externalId: string,
    details: { name: string; email?: string; phone?: string; avatarUrl?: string }
  ): Promise<Client> => {
    if (!supabase) throw new Error('Supabase not initialized');

    const existingLocal = clients.find(c => c.externalId === externalId);
    if (existingLocal) return existingLocal;
    
    const { data: dbData, error: dbError } = await supabase
      .from('clients')
      .select('*')
      .eq('external_id', externalId)
      .maybeSingle();

    if (dbError) console.error("Error checking for existing client:", dbError);
    
    if (dbData) {
      // FIX: Cast `dbData` to `any` to resolve Supabase type inference issues.
      const clientRow = dbData as any;
      const client: Client = {
        id: clientRow.id,
        externalId: clientRow.external_id,
        name: clientRow.name,
        email: clientRow.email,
        phone: clientRow.phone,
        avatarUrl: clientRow.avatar_url,
        historicalData: [],
        source: clientRow.source || 'square',
      };
      setClients(prev => [...prev.filter(c => c.id !== client.id), client]);
      return client;
    }
    
    const { data, error } = await supabase
      .from('clients')
      // FIX: Cast payload to `any` to resolve Supabase type inference issue.
      .insert({
        name: details.name,
        email: details.email,
        phone: details.phone,
        avatar_url: details.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(details.name)}&background=random`,
        external_id: externalId,
        source: 'square',
      } as any)
      .select()
      .single();

    if (error) throw error;

    // FIX: Add null check for `data` and cast to `any` to resolve type errors.
    if (!data) {
      throw new Error('Failed to create client in DB: no data returned.');
    }
    const dbRow = data as any;
    const newClient: Client = {
      id: dbRow.id,
      externalId: dbRow.external_id,
      name: dbRow.name,
      email: dbRow.email,
      phone: dbRow.phone,
      avatarUrl: dbRow.avatar_url,
      historicalData: [],
      source: 'square',
    };
    setClients(prev => [...prev, newClient]);
    return newClient;
  };

  return (
    <SettingsContext.Provider
      value={{
        services,
        levels,
        stylists,
        clients,
        membershipConfig,
        branding,
        integration,
        linkingConfig,
        textSize,
        pushAlertsEnabled,
        pinnedReports,
        loadingTeam,
        teamError,
        updateClients: setClients,
        createClient,
        updateBranding,
        updateMembershipConfig,
        updateStylists,
        updateServices,
        saveAll,
        resolveClientByExternalId,
        updateTextSize,
        updatePushAlertsEnabled,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
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

// TEAM STATE: Initialize as empty, no localStorage fallback.
const [stylists, setStylists] = useState<Stylist[]>([]);
const [loadingTeam, setLoadingTeam] = useState(true);
const [teamError, setTeamError] = useState<string | null>(null);

const [clients, setClients] = useState<Client[]>(() => {
try {
const saved = localStorage.getItem('admin_clients');
return saved ? JSON.parse(saved).filter((c: Client) => isValidUUID(c.id)) : [];
} catch { return []; }
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
environment: 'production', 
...parsed 
};
} catch { return { provider: 'square', environment: 'production' }; }
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
if(document.body) {
document.body.style.fontFamily = `'${font}', sans-serif`;
}
} else {
if(document.body) {
document.body.classList.add(font);
document.body.style.fontFamily = '';
}
}
}, [branding]);

useEffect(() => {
if (!document.body) return;
document.body.classList.remove('text-size-s', 'text-size-m', 'text-size-l');
document.body.classList.add(`text-size-${textSize.toLowerCase()}`);
}, [textSize]);

useEffect(() => {
if (!supabase) return;

const loadDataForUser = async (user: any) => {
if (!user) return;
const merchantId = user?.user_metadata?.merchant_id;
if (!merchantId) return;

setLoadingTeam(true);
setTeamError(null);

// Load settings from Supabase
const { data, error } = await supabase
.from('merchant_settings')
.select('settings')
.eq('merchant_id', merchantId)
.single();

if (error && error.code !== 'PGRST116') { // PGRST116: "exact one row not found"
console.error('Error loading settings from Supabase:', error);
}

export const useSettings = () => {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return ctx;
// FIX: Guard against data being null and cast to any to allow property access.
const dbSettings = data ? (data as any).settings : null;

if (dbSettings) {
if (dbSettings.services) setServices(dbSettings.services);
if (dbSettings.linkingConfig) setLinkingConfig(dbSettings.linkingConfig);
if (dbSettings.levels) setLevels(dbSettings.levels);
if (dbSettings.clients) setClients(dbSettings.clients.filter((c: Client) => isValidUUID(c.id)));
                console.log('[DEBUG] Loaded clients:', dbClients);
if (dbSettings.membershipConfig) setMembershipConfig(dbSettings.membershipConfig);
if (dbSettings.branding) setBranding(dbSettings.branding);
if (dbSettings.integration) setIntegration(dbSettings.integration);
if (dbSettings.textSize) setTextSize(dbSettings.textSize);
if (dbSettings.pushAlertsEnabled !== undefined) setPushAlertsEnabled(dbSettings.pushAlertsEnabled);
if (dbSettings.pinnedReports) setPinnedReports(dbSettings.pinnedReports);
}

try {
const { data: teamData, error: teamFetchError } = await supabase
.from('square_team_members')
.select('*');

if (teamFetchError) throw teamFetchError;

if (!teamData || teamData.length === 0) {
const errMessage = 'No team members found. Sync your team from Square in Settings.';
throw new Error(errMessage);
}

const mappedStylists: Stylist[] = teamData.map((member: any) => ({
id: member.square_team_member_id,
name: member.name,
role: member.role || 'Team Member',
email: member.email,
levelId: member.level_id || 'lvl_2',
permissions: member.permissions || {
canBookAppointments: true,
canOfferDiscounts: false,
requiresDiscountApproval: true,
viewGlobalReports: false,
viewClientContact: true,
viewAllSalonPlans: false,
can_book_own_schedule: true,
can_book_peer_schedules: false,
}
}));
setStylists(mappedStylists);

} catch (e: any) {
console.error('Team load failed:', e);
setStylists([]);
setTeamError(e.message || 'Failed to load team');
} finally {
setLoadingTeam(false);
}


// Load clients from their own table
try {
const { data: clientData, error: clientError } = await supabase.from('clients').select('*');
if (!clientError && clientData) {
const dbClients: Client[] = clientData.map((row: any) => ({
id: row.id,
externalId: row.external_id,
name: row.name,
email: row.email,
phone: row.phone,
avatar_url: row.avatar_url,
historicalData: [],
source: row.source
})).filter(c => isValidUUID(c.id));

if (dbClients.length > 0) {
setClients(dbClients);
}
}
} catch (err) {
console.error("Error fetching clients from database:", err);
}
};

const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
if ((event === 'INITIAL_SESSION' || event === 'SIGNED_IN') && session?.user) {
await loadDataForUser(session.user);
} else {
setLoadingTeam(false); // If no user, stop loading.
}
});

return () => {
subscription?.unsubscribe();
};
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

if (!clientData.name) {
throw new Error('Client name is required');
}

const avatar_url = `https://ui-avatars.com/api/?name=${encodeURIComponent(clientData.name)}&background=random`;

const { data, error } = await supabase
.from('clients')
.insert({
name: clientData.name,
email: clientData.email,
avatar_url
} as any)
.select()
.single();

if (error) {
console.error("Supabase client creation error:", error);
throw error;
}

if (!data) {
throw new Error("Client creation failed: no data returned.");
}

const newClient: Client = {
id: (data as any).id,
externalId: (data as any).external_id,
name: (data as any).name,
email: (data as any).email,
phone: (data as any).phone,
avatarUrl: (data as any).avatar_url,
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
id: (existingClient as any).id,
externalId: (existingClient as any).external_id,
name: (existingClient as any).name,
email: (existingClient as any).email,
phone: (existingClient as any).phone,
avatarUrl: (existingClient as any).avatar_url,
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
} as any)
.select()
.single();

if (createError) throw createError;

if (!newDbClient) {
throw new Error("Client creation failed: no data returned.");
}

const newClient: Client = {
id: (newDbClient as any).id,
externalId: (newDbClient as any).external_id,
...(isValidUUID((newDbClient as any).id)
? {}
: (() => { throw new Error('Invalid client UUID returned from DB'); })()),
name: (newDbClient as any).name,
email: (newDbClient as any).email,
phone: (newDbClient as any).phone,
avatarUrl: (newDbClient as any).avatar_url,
historicalData: []
};

setClients(prev => [...prev, newClient]);
return newClient;
};

const saveAll = async () => {
try {
localStorage.setItem('admin_services', JSON.stringify(services));
localStorage.setItem('admin_linking_config', JSON.stringify(linkingConfig));
localStorage.setItem('admin_levels', JSON.stringify(levels));
// Do not save stylists to localStorage anymore.
localStorage.setItem('admin_clients', JSON.stringify(clients.filter(c => isValidUUID(c.id))));
localStorage.setItem('admin_membership_config', JSON.stringify(membershipConfig));
localStorage.setItem('admin_integration', JSON.stringify(integration));
localStorage.setItem('admin_brand_name', branding.salonName);
localStorage.setItem('admin_brand_primary', branding.primaryColor);
localStorage.setItem('admin_brand_secondary', branding.secondaryColor);
localStorage.setItem('admin_brand_accent', branding.accentColor);
localStorage.setItem('admin_brand_font', branding.font);
} catch (e) {
console.error('Failed to save settings to localStorage:', e);
}

if (!supabase) return;
const { data: { user } } = await supabase.auth.getUser();
const merchantId = user?.user_metadata?.merchant_id;
if (!merchantId) return;

const settingsBlob = {
services, linkingConfig, levels, clients: clients.filter(c => isValidUUID(c.id)), membershipConfig,
branding, integration, textSize, pushAlertsEnabled, pinnedReports,
};

// FIX: Cast payload to any to bypass TypeScript inference errors with Supabase's upsert method when types are not available.
const { error } = await supabase
.from('merchant_settings')
.upsert({
merchant_id: merchantId,
settings: settingsBlob,
updated_at: new Date().toISOString()
} as any, { onConflict: 'merchant_id' });

if (error) {
console.error('Failed to persist settings to Supabase:', error);
}
};

return (
<SettingsContext.Provider value={{
services, levels, stylists, clients, membershipConfig, branding, integration, linkingConfig, textSize, pushAlertsEnabled, pinnedReports, loadingTeam, teamError,
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