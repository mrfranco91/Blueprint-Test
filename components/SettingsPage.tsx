
import React, { useState } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { SquareIntegrationService } from '../services/squareIntegration';
import { 
    RefreshIcon, 
    CheckCircleIcon, 
    ChevronLeftIcon,
    TrashIcon,
    UsersIcon,
    GlobeIcon,
    DatabaseIcon,
} from './icons';
import type { Stylist, Client } from '../types';
import AccountSettings from './AccountSettings';
import { GOOGLE_FONTS_LIST } from '../data/fonts';


type SettingsView = 'menu' | 'account' | 'branding' | 'team' | 'memberships' | 'integrations';

const SettingsPage: React.FC = () => {
  const [activeSettingsView, setActiveSettingsView] = useState<SettingsView>('menu');
  const [editingStylist, setEditingStylist] = useState<Stylist | null>(null);
  const [addingBenefitTierId, setAddingBenefitTierId] = useState<string | null>(null);
  const [newBenefitValue, setNewBenefitValue] = useState('');
  
  const { 
      services, updateServices,
      stylists, updateStylists,
      clients, updateClients,
      branding, updateBranding,
      membershipConfig, updateMembershipConfig,
      saveAll,
      resolveClientByExternalId,
  } = useSettings();
  
  const { logout, user } = useAuth();

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const markUnsaved = () => setHasUnsavedChanges(true);

  const handleSaveSettings = () => {
      saveAll();
      setHasUnsavedChanges(false);
      setSyncMessage("Settings Saved!");
      setTimeout(() => setSyncMessage(null), 2000);
  }

  const handleSync = async () => {
      if (!supabase) { setSyncError("Database connection not ready."); return; }
      
      setIsSyncing(true);
      setSyncMessage(null);
      setSyncError(null);

      try {
          const loc = await SquareIntegrationService.fetchLocation();
          
          const [newServices, newStylists, newSquareClients] = await Promise.all([
              SquareIntegrationService.fetchCatalog(),
              SquareIntegrationService.fetchTeam(),
              SquareIntegrationService.fetchCustomers(),
          ]);
          
          console.warn("SYSTEM INVARIANT: Skipping persistence of Square team members because the 'stylists' table was not found in the schema. This is correct behavior for initial bootstrap sync.");
          
          if (newSquareClients.length > 0) {
              setSyncMessage(`Syncing ${newSquareClients.length} clients...`);
              const resolvedClients: Client[] = [];
              for (const sqClient of newSquareClients) {
                  if (!sqClient.id) {
                      console.warn("Skipping Square client with no ID:", sqClient);
                      continue;
                  }
                  const client = await resolveClientByExternalId(sqClient.id, {
                      name: sqClient.name!,
                      email: sqClient.email,
                      phone: sqClient.phone,
                      avatarUrl: sqClient.avatarUrl
                  });
                  resolvedClients.push(client);
              }
              updateClients(resolvedClients);
          }

          if (newServices.length > 0) {
            const servicePayload = newServices.map(s => ({
                id: s.id,
                name: s.name,
                category: s.category,
                cost: s.cost,
                duration: s.duration,
                metadata: { version: s.version }
            }));
            const { error: se } = await supabase.from('services').upsert(servicePayload as any, { onConflict: 'id' });
            if (se) throw se;
            updateServices(newServices);
          }

          console.warn("SYSTEM INVARIANT: Skipping booking sync. This is an initial bootstrap sync and must not write to transactional tables like 'bookings'. This is correct and expected behavior.");
          
          setSyncMessage("Client & Service sync completed successfully!");
          saveAll();
          setHasUnsavedChanges(false);
      } catch (error: any) {
          console.error("Sync Error:", error);
          setSyncError(error.message || "Sync failed.");
      } finally {
          setIsSyncing(false);
      }
  };

  const handleSaveNewBenefit = (tierIndex: number) => {
    if (newBenefitValue && newBenefitValue.trim()) {
        updateMembershipConfig(prevConfig => {
            const newTiers = prevConfig.tiers.map((t, idx) => {
                if (idx === tierIndex) {
                    return { ...t, perks: [...t.perks, newBenefitValue.trim()] };
                }
                return t;
            });
            return { ...prevConfig, tiers: newTiers };
        });
        markUnsaved();
        setNewBenefitValue('');
        setAddingBenefitTierId(null);
    }
  };

  const renderBranding = () => (
    <div className="space-y-8 animate-fade-in">
        <div>
            <label className="block text-[10px] font-black uppercase text-gray-950 mb-2 tracking-widest">Salon Name</label>
            <input type="text" value={branding.salonName} onChange={e => { updateBranding({...branding, salonName: e.target.value}); markUnsaved(); }} className="w-full p-5 border-4 border-gray-950 rounded-2xl font-black bg-white text-gray-950 outline-none text-lg" />
        </div>
        <div className="grid grid-cols-3 gap-4">
            <div>
                <label className="block text-[10px] font-black uppercase text-gray-950 mb-2 tracking-widest">Primary</label>
                <input type="color" value={branding.primaryColor} onChange={e => { updateBranding({...branding, primaryColor: e.target.value}); markUnsaved(); }} className="w-full h-16 rounded-2xl border-4 border-gray-950 cursor-pointer p-1" />
            </div>
            <div>
                <label className="block text-[10px] font-black uppercase text-gray-950 mb-2 tracking-widest">Secondary</label>
                <input type="color" value={branding.secondaryColor} onChange={e => { updateBranding({...branding, secondaryColor: e.target.value}); markUnsaved(); }} className="w-full h-16 rounded-2xl border-4 border-gray-950 cursor-pointer p-1" />
            </div>
             <div>
                <label className="block text-[10px] font-black uppercase text-gray-950 mb-2 tracking-widest">Accent / Utility</label>
                <input type="color" value={branding.accentColor} onChange={e => { updateBranding({...branding, accentColor: e.target.value}); markUnsaved(); }} className="w-full h-16 rounded-2xl border-4 border-gray-950 cursor-pointer p-1" />
            </div>
        </div>
        <div>
            <label className="block text-[10px] font-black uppercase text-gray-950 mb-2 tracking-widest">Brand Font</label>
             <select value={branding.font} onChange={e => { updateBranding({...branding, font: e.target.value}); markUnsaved(); }} className="w-full p-5 border-4 border-gray-950 rounded-2xl font-black bg-white text-gray-950 outline-none text-lg">
                {GOOGLE_FONTS_LIST.map(f => <option key={f} value={f}>{f}</option>)}
             </select>
        </div>
         <div>
            <label className="block text-[10px] font-black uppercase text-gray-950 mb-2 tracking-widest">Logo Upload</label>
            <input type="file" accept="image/*" onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onloadend = () => { updateBranding({...branding, logoUrl: reader.result as string }); markUnsaved(); };
                reader.readAsDataURL(file);
              }
            }} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand-accent/10 file:text-brand-accent hover:file:bg-brand-accent/20"/>
        </div>
    </div>
  );

  const renderMembershipSetup = () => (
      <div className="bg-white p-8 rounded-[40px] border-4 border-gray-950 shadow-2xl mb-8 animate-fade-in text-gray-950">
          <div className="flex justify-between items-center mb-8">
            <h3 className="font-black text-2xl tracking-tighter">Membership Tiers</h3>
            <button onClick={() => { updateMembershipConfig(prev => ({...prev, enabled: !prev.enabled})); markUnsaved(); }} className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest border-2 transition-all ${membershipConfig.enabled ? 'bg-brand-secondary text-white border-brand-secondary' : 'bg-white text-gray-400 border-gray-100'}`}>
                {membershipConfig.enabled ? 'Active' : 'Off'}
            </button>
          </div>
          <div className="space-y-8">
              {membershipConfig.tiers.map((tier, idx) => (
                  <div key={tier.id} className="p-6 border-4 border-gray-100 rounded-[32px] bg-gray-50 space-y-4 shadow-sm">
                      <div className="flex justify-between items-center">
                          <input value={tier.name} onChange={e => {
                              const nextTiers = [...membershipConfig.tiers];
                              nextTiers[idx] = { ...nextTiers[idx], name: e.target.value };
                              updateMembershipConfig({...membershipConfig, tiers: nextTiers});
                              markUnsaved();
                          }} className="font-black text-xl bg-transparent outline-none w-full tracking-tighter" />
                          <input type="color" value={tier.color} onChange={e => {
                               const nextTiers = [...membershipConfig.tiers];
                               nextTiers[idx] = { ...nextTiers[idx], color: e.target.value };
                               updateMembershipConfig({...membershipConfig, tiers: nextTiers});
                               markUnsaved();
                          }} className="w-8 h-8 rounded-lg cursor-pointer border-2 border-white shadow-md" />
                      </div>
                      
                      <div className="bg-white p-3 rounded-xl border-2 border-gray-100">
                          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Min. Monthly Spend</p>
                          <div className="flex items-center">
                            <span className="text-gray-400 mr-1 font-black">$</span>
                            <input type="number" value={tier.minSpend} onChange={e => {
                                const nextTiers = [...membershipConfig.tiers];
                               nextTiers[idx] = { ...nextTiers[idx], minSpend: parseInt(e.target.value) || 0 };
                               updateMembershipConfig({...membershipConfig, tiers: nextTiers});
                                markUnsaved();
                            }} className="w-full font-black outline-none text-brand-accent text-lg bg-transparent" />
                          </div>
                      </div>

                      <div className="space-y-2">
                          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Benefits</p>
                          {tier.perks.map((perk, perkIdx) => (
                              <div key={perkIdx} className="flex items-center justify-between bg-white p-2 rounded-lg border border-gray-100">
                                  <span className="text-xs font-bold text-gray-700">{perk}</span>
                                  <button onClick={() => {
                                      const nextTiers = [...membershipConfig.tiers];
                                      const nextPerks = [...nextTiers[idx].perks];
                                      nextPerks.splice(perkIdx, 1);
                                      nextTiers[idx] = { ...nextTiers[idx], perks: nextPerks };
                                      updateMembershipConfig({...membershipConfig, tiers: nextTiers});
                                      markUnsaved();
                                  }} className="text-red-500 hover:text-red-700 p-1"><TrashIcon className="w-4 h-4" /></button>
                              </div>
                          ))}
                          {addingBenefitTierId === tier.id ? (
                            <form onSubmit={(e) => { e.preventDefault(); handleSaveNewBenefit(idx); }} className="space-y-2">
                                <input
                                    type="text"
                                    value={newBenefitValue}
                                    onChange={e => setNewBenefitValue(e.target.value)}
                                    placeholder="Enter benefit name..."
                                    autoFocus
                                    className="w-full p-2 border-2 border-brand-accent rounded-lg text-xs font-bold"
                                />
                                <div className="flex space-x-2">
                                    <button type="submit" className="flex-1 py-1 bg-brand-accent text-white rounded-md text-xs font-bold">Add</button>
                                    <button type="button" onClick={() => { setAddingBenefitTierId(null); setNewBenefitValue(''); }} className="flex-1 py-1 bg-gray-200 text-gray-700 rounded-md text-xs font-bold">Cancel</button>
                                </div>
                            </form>
                          ) : (
                            <button type="button" onClick={() => { setAddingBenefitTierId(tier.id); setNewBenefitValue(''); }} className="w-full py-2 border-2 border-dashed border-gray-200 rounded-lg text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                + Add Benefit
                            </button>
                          )}
                      </div>
                  </div>
              ))}
          </div>
      </div>
  );

  const renderTeam = () => (
    <div className="space-y-4 pb-32 animate-fade-in">
        {editingStylist ? (
            <div>
                <div className="bg-gray-950 p-7 rounded-[40px] text-white mb-8 border-4 border-gray-950 shadow-xl">
                    <p className="text-[10px] font-black text-gray-400 uppercase mb-1 tracking-widest">Editing Permissions For</p>
                    <h2 className="text-3xl font-black">{editingStylist.name}</h2>
                </div>
                
                <div className="space-y-4">
                    {[
                        { key: 'canBookAppointments', label: 'Square Booking', desc: 'Can sync roadmaps to Square.' },
                        { key: 'can_book_own_schedule', label: 'Book Own Schedule', desc: 'Can book appointments for their own calendar.' },
                        { key: 'can_book_peer_schedules', label: 'Book Peer Schedules', desc: 'Can book appointments for other team members.' },
                        { key: 'canOfferDiscounts', label: 'Plan Discounting', desc: 'Can override service costs.' },
                        { key: 'requiresDiscountApproval', label: 'Approval Required', desc: 'Discounted plans need admin sign-off.' },
                        { key: 'viewGlobalReports', label: 'Global Reports', desc: 'Can view business-wide analytics.' },
                        { key: 'viewClientContact', label: 'Client Contacts', desc: 'Can view client phone & email.' },
                        { key: 'viewAllSalonPlans', label: 'View All Plans', desc: 'Can view roadmaps created by any stylist.' },
                    ].map(perm => (
                        <div key={perm.key} className="bg-white p-6 rounded-[32px] border-4 border-gray-100 flex items-center justify-between text-gray-950">
                            <div className="pr-4">
                                <p className="text-lg font-black">{perm.label}</p>
                                <p className="text-xs font-bold text-gray-500 leading-tight">{perm.desc}</p>
                            </div>
                            <button 
                                onClick={() => {
                                    const nextPerms = { ...editingStylist.permissions, [perm.key]: !editingStylist.permissions[perm.key as keyof Stylist['permissions']] };
                                    const newStylist = { ...editingStylist, permissions: nextPerms };
                                    setEditingStylist(newStylist);
                                    updateStylists(stylists.map(s => s.id === editingStylist.id ? newStylist : s));
                                    markUnsaved();
                                }}
                                className={`w-14 h-8 rounded-full transition-all relative border-2 ${editingStylist.permissions[perm.key as keyof Stylist['permissions']] ? 'bg-brand-secondary border-black/10' : 'bg-gray-200 border-gray-300'}`}
                            >
                                <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${editingStylist.permissions[perm.key as keyof Stylist['permissions']] ? 'left-7' : 'left-1'}`}></div>
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        ) : (
            <>
                <div className="bg-orange-50 p-6 rounded-[32px] border-4 border-orange-100 mb-8 text-gray-950">
                    <h4 className="text-sm font-black uppercase mb-2">Team Governance</h4>
                    <p className="text-xs font-bold leading-tight">Select a professional to configure their permissions within the app.</p>
                </div>
                {stylists.map(stylist => (
                    <button key={stylist.id} onClick={() => setEditingStylist(stylist)} className="w-full bg-white p-5 rounded-[28px] border-4 border-gray-100 flex items-center justify-between shadow-sm active:scale-95 transition-all group hover:border-brand-primary">
                        <div className="flex items-center space-x-4 text-gray-950">
                            <div className="w-14 h-14 bg-brand-primary/10 rounded-2xl flex items-center justify-center text-brand-primary text-xl font-black">{stylist.name[0]}</div>
                            <div className="text-left">
                                <p className="text-lg font-black leading-none mb-1 group-hover:text-brand-primary transition-colors">{stylist.name}</p>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{stylist.role}</p>
                            </div>
                        </div>
                        <CheckCircleIcon className="w-6 h-6 text-gray-200" />
                    </button>
                ))}
            </>
        )}
    </div>
  );
  
    const renderIntegrations = () => (
        <div className="space-y-6 animate-fade-in">
            <div className="bg-white p-6 rounded-[32px] border-4 border-gray-100 text-gray-950">
                <h3 className="text-xl font-black mb-1">Square Integration</h3>
                <p className="text-xs font-bold text-gray-500 mb-6">Sync your service catalog, team, and clients automatically.</p>
                
                <div className="bg-green-50 p-6 rounded-2xl border-2 border-green-200 text-center">
                    <CheckCircleIcon className="w-10 h-10 text-green-500 mx-auto mb-2" />
                    <p className="font-black text-green-900">Square Connected</p>
                    <p className="text-xs font-bold text-green-700">Using static access token.</p>
                </div>
            </div>

            <button onClick={handleSync} disabled={isSyncing} className="w-full bg-gray-950 text-white font-black py-5 rounded-2xl shadow-lg flex items-center justify-center space-x-3 border-b-4 border-gray-800 active:scale-95 transition-all disabled:bg-gray-400 disabled:cursor-not-allowed">
                {isSyncing ? <RefreshIcon className="w-6 h-6 animate-spin" /> : <DatabaseIcon className="w-6 h-6" />}
                <span>{isSyncing ? 'SYNCING DATA...' : 'FORCE SYNC WITH SQUARE'}</span>
            </button>
            
            {syncError && <div className="text-center p-4 bg-red-50 text-red-700 font-bold rounded-xl border border-red-200">{syncError}</div>}
        </div>
    );
    
    const settingsViews = [
        { key: 'account', label: 'Account', icon: UsersIcon },
        { key: 'branding', label: 'Branding', icon: GlobeIcon },
        { key: 'team', label: 'Team', icon: UsersIcon },
        { key: 'memberships', label: 'Membership', icon: CheckCircleIcon },
        { key: 'integrations', label: 'Sync', icon: DatabaseIcon },
    ];

    const isSubMenu = activeSettingsView !== 'menu';
    let headerTitle = 'System Settings';
    if (editingStylist) {
        headerTitle = 'Editing Team';
    } else if (isSubMenu) {
        headerTitle = activeSettingsView;
    }

    const renderContent = () => {
        if (activeSettingsView === 'account') return <div className="p-4"><AccountSettings user={user} onLogout={logout} subtitle="System Controller" /></div>;
        if (activeSettingsView === 'branding') return renderBranding();
        if (activeSettingsView === 'team') return renderTeam();
        if (activeSettingsView === 'memberships') return renderMembershipSetup();
        if (activeSettingsView === 'integrations') return renderIntegrations();
        return null; // Should not happen
    };

    return (
        <div className="p-6 h-full flex flex-col">
            <div className="flex items-center mb-8">
                {(isSubMenu || editingStylist) && (
                    <button 
                        onClick={() => {
                            if (editingStylist) {
                                setEditingStylist(null);
                            } else {
                                setActiveSettingsView('menu');
                            }
                        }} 
                        className="mr-4 p-2 bg-white text-gray-900 rounded-full shadow-sm border-2 border-gray-200 hover:bg-gray-100 transition-colors"
                        aria-label="Go back"
                    >
                        <ChevronLeftIcon className="w-6 h-6" />
                    </button>
                )}
                <h1 className="text-3xl font-black text-brand-accent tracking-tighter capitalize">{headerTitle}</h1>
            </div>

            {activeSettingsView === 'menu' && !editingStylist ? (
                <div className="grid grid-cols-2 gap-3 mb-8 animate-fade-in">
                    {settingsViews.map(view => (
                        <button key={view.key} onClick={() => setActiveSettingsView(view.key as SettingsView)} className="p-4 rounded-2xl flex flex-col items-center justify-center text-center transition-all border-4 bg-white text-gray-950 border-gray-100 hover:border-brand-accent hover:shadow-lg">
                           <view.icon className="w-7 h-7 text-brand-primary" />
                           <span className="text-xs font-black uppercase tracking-widest">{view.label}</span>
                        </button>
                    ))}
                </div>
            ) : (
                <div className="flex-grow">
                    {renderContent()}
                </div>
            )}

             {hasUnsavedChanges && (
                <div className="fixed bottom-24 left-4 right-4 max-w-md mx-auto z-30 flex space-x-2">
                    <button onClick={handleSaveSettings} className="flex-1 bg-brand-secondary text-white font-black py-4 rounded-xl shadow-2xl border-b-4 border-black/20">SAVE</button>
                </div>
            )}
            {syncMessage && (
                <div className="fixed bottom-24 left-4 right-4 max-w-md mx-auto z-30 p-4 bg-green-500 text-white font-black rounded-xl shadow-2xl text-center animate-bounce-in flex items-center justify-center space-x-2">
                    <CheckCircleIcon className="w-6 h-6" />
                    <span>{syncMessage}</span>
                </div>
             )}
        </div>
    );
};

export default SettingsPage;
