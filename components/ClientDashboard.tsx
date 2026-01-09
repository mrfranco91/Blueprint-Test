
import React, { useState, useMemo, useEffect } from 'react';
import type { Client, GeneratedPlan, UserRole, PlanAppointment } from '../types';
import PlanSummaryStep from './PlanSummaryStep';
import BottomNav from './BottomNav';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { usePlans } from '../contexts/PlanContext';
import { supabase } from '../lib/supabase';
import { CheckCircleIcon, TrashIcon, DocumentTextIcon, RefreshIcon, SettingsIcon, UsersIcon, ChevronLeftIcon, CalendarIcon, PlusIcon } from './icons';
import AccountSettings from './AccountSettings';

interface ClientDashboardProps {
  client: Client;
  plan: GeneratedPlan | null; // This will be the LATEST plan
  role: UserRole;
}

const ClientDashboard: React.FC<ClientDashboardProps> = ({ client: propClient, plan: propPlan, role }) => {
  const [activeTab, setActiveTab] = useState('plan');
  const [viewingPlan, setViewingPlan] = useState<GeneratedPlan | null>(null);

  const [realClient, setRealClient] = useState<Client | null>(null);
  const [realPlans, setRealPlans] = useState<GeneratedPlan[] | null>(null);
  
  const { membershipConfig, branding, stylists, services: allAvailableServices } = useSettings();
  const { logout, user } = useAuth();
  const { getClientHistory, getClientBookings } = usePlans();

  // AUTHENTICATION CHECK: Handle the "Not Linked" state
  const isUnlinked = !user?.isMock && !user?.clientData;

  // Effect for AUTHENTICATED (real) clients
  useEffect(() => {
    const hydrateRealClient = async () => {
      // This logic is only for real, authenticated users.
      if (!supabase || user?.isMock) return;
      
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser?.email) return;

      const { data: clientRow, error: clientError } = await supabase
        .from("clients")
        .select("*")
        .eq("email", authUser.email)
        .maybeSingle();

      if (clientError || !clientRow) {
        return;
      }
      
      const fetchedClient: Client = {
          id: clientRow.id,
          externalId: clientRow.external_id,
          name: clientRow.name,
          email: clientRow.email,
          phone: clientRow.phone,
          avatarUrl: clientRow.avatar_url,
          historicalData: []
      };
      setRealClient(fetchedClient);

      const { data: plansData, error: plansError } = await supabase
        .from("plans")
        .select("*")
        .eq("client_id", clientRow.id)
        .order("created_at", { ascending: false });

      if (plansError) {
          console.error("Failed to fetch real plans for client:", plansError);
          return;
      }

      if (plansData) {
        const formattedPlans = plansData
            .map((dbPlan: any) => {
                const blob = dbPlan.plan_data;
                if (!blob || !blob.client) return null;
                return {
                    ...blob,
                    id: dbPlan.id,
                    createdAt: blob.createdAt || dbPlan.created_at,
                    appointments: (blob.appointments || []).map((a: any) => ({
                        ...a,
                        date: new Date(a.date)
                    }))
                };
            })
            .filter((p): p is GeneratedPlan => p !== null);
        setRealPlans(formattedPlans);
      }
    };

    hydrateRealClient();
  }, [user]);

  // FINALIZED Effect for SAMPLE (mock) clients in AI Studio preview
  useEffect(() => {
    const loadMostRecentPlanForPreview = async () => {
      // This logic runs ONLY for the dev-only "sample client" view.
      if (!supabase || user?.isMock !== true) {
        return;
      }

      // 1. Find the single most recent plan in the entire database.
      const { data: latestPlan, error } = await supabase
        .from("plans")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) {
          console.error("Error fetching latest plan for preview:", error.message);
          return;
      }

      // 2. If a plan is found, format it and set it as the ONLY plan to be displayed.
      if (latestPlan) {
        const blob = latestPlan.plan_data;
        if (blob && blob.client) {
            const formattedPlan: GeneratedPlan = {
                ...blob,
                id: latestPlan.id,
                createdAt: blob.createdAt || latestPlan.created_at,
                appointments: (blob.appointments || []).map((a: any) => ({
                    ...a,
                    date: new Date(a.date)
                }))
            };
            setRealPlans([formattedPlan]);
        }
      }
    };

    loadMostRecentPlanForPreview();
  }, [user?.isMock]);

  if (isUnlinked) {
      return (
          <div className="min-h-screen bg-brand-bg flex flex-col items-center justify-center p-6 text-center">
              <div className="bg-white p-10 rounded-[40px] shadow-2xl border-4 border-gray-950 max-w-sm">
                  <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-6 text-gray-400">
                      <UsersIcon className="w-10 h-10" />
                  </div>
                  <h2 className="text-2xl font-black text-gray-950 tracking-tighter mb-4">Account Not Linked</h2>
                  <p className="text-sm font-bold text-gray-500 leading-relaxed mb-8">
                      Your account is not yet linked to a salon. Please contact the salon.
                  </p>
                  <button onClick={logout} className="w-full bg-gray-950 text-white font-black py-4 rounded-2xl shadow-xl active:scale-95 transition-all">
                      SIGN OUT
                  </button>
              </div>
          </div>
      );
  }

  // Prioritize real data over initial props.
  const client = realClient || propClient;
  const allClientPlans = realPlans !== null ? realPlans : getClientHistory(client.id);

  const pendingOfferPlan = useMemo(() => {
    if (!allClientPlans) return null;
    return allClientPlans
      .filter(p => p.membershipStatus === 'offered')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] || null;
  }, [allClientPlans]);

  const allSquareBookings = useMemo(() => getClientBookings(client.id), [client.id, getClientBookings]);

  const monthlySpend = (viewingPlan || allClientPlans[0])?.averageMonthlySpend || 0;
  
  const sortedTiers = useMemo(() => [...membershipConfig.tiers].sort((a, b) => b.minSpend - a.minSpend), [membershipConfig.tiers]);
  
  const currentTier = useMemo(() => {
      return sortedTiers.find(t => monthlySpend >= t.minSpend) || sortedTiers[sortedTiers.length - 1]; 
  }, [monthlySpend, sortedTiers]);

  const renderMemberships = () => (
      <div className="p-6 pb-24 h-full overflow-y-auto">
          <h1 className="text-2xl font-black text-brand-accent mb-4 tracking-tighter">Loyalty Status</h1>
          
          {(allClientPlans[0] || viewingPlan) && currentTier && (
              <div className="mb-8 p-1 rounded-[32px] bg-gray-950 shadow-2xl border-4 border-gray-950">
                  <div className="bg-white rounded-[28px] p-6 text-gray-950">
                      <div className="flex justify-between items-center mb-6">
                          <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Your Benefits</p>
                            <h2 className="text-3xl font-black text-gray-950 tracking-tighter leading-none">{currentTier.name}</h2>
                          </div>
                          <div className="w-14 h-14 rounded-2xl flex items-center justify-center border-4 border-gray-50 shadow-sm" style={{backgroundColor: currentTier.color + '20'}}>
                              <CheckCircleIcon className="w-8 h-8" style={{color: currentTier.color}} />
                          </div>
                      </div>
                      <ul className="space-y-3">
                          {currentTier.perks.map((perk, i) => (
                              <li key={i} className="flex items-center text-sm text-gray-950 font-black">
                                  <div className="w-2 h-2 rounded-full bg-green-500 mr-3"></div>
                                  {perk}
                              </li>
                          ))}
                      </ul>
                  </div>
              </div>
          )}

          <h3 className="font-black text-gray-950 uppercase text-[10px] tracking-widest mb-4 px-1">Rewards Catalog</h3>
          
          <div className="space-y-4">
              {[...membershipConfig.tiers].reverse().map(tier => (
                  <div key={tier.id} className={`bg-white border-4 rounded-3xl overflow-hidden shadow-sm transition-all ${currentTier?.id === tier.id ? 'border-brand-secondary ring-4 ring-teal-50' : 'border-gray-100 opacity-60'}`}>
                      <div className="p-5 text-gray-950">
                          <div className="flex justify-between items-center mb-3">
                              <h3 className="font-black text-gray-950">{tier.name}</h3>
                              <span className="text-[10px] font-black bg-gray-100 px-3 py-1 rounded-full uppercase tracking-tighter">Min ${tier.minSpend}/mo</span>
                          </div>
                          <ul className="space-y-2">
                              {tier.perks.map((perk, i) => (
                                  <li key={i} className="text-xs text-gray-600 font-bold flex items-center">
                                      <div className="w-1.5 h-1.5 rounded-full bg-gray-300 mr-2"></div>
                                      {perk}
                                  </li>
                              ))}
                          </ul>
                      </div>
                  </div>
              ))}
          </div>
      </div>
  );

  const renderAppointments = () => {
      const roadmapAppointments = allClientPlans.flatMap(p => 
        p.appointments.map(a => ({
          date: new Date(a.date),
          services: a.services,
          type: 'roadmap',
          stylist: p.stylistName,
          plan: p,
          id: `roadmap-${p.id}-${a.date}`
        }))
      );
      
      const confirmedBookings = allSquareBookings.map(b => {
        const bookingServices = b.services.map(s => {
            const serviceDetails = allAvailableServices.find(as => as.id === s.variation_id);
            return {
                name: s.name,
                cost: serviceDetails?.cost || 0,
                duration: serviceDetails?.duration || 0,
                id: s.variation_id
            };
        });

        return {
            date: new Date(b.start_time),
            services: bookingServices,
            type: 'confirmed',
            stylist: stylists.find(s => s.id === b.stylist_id)?.name || 'Professional',
            id: b.id
        }
      });

      const allItems = [...roadmapAppointments, ...confirmedBookings];
      const today = new Date();
      today.setHours(0,0,0,0);
      
      const upcoming = allItems
          .filter(a => new Date(a.date) >= today)
          .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          
      const past = allItems
          .filter(a => new Date(a.date) < today)
          .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      const AppointmentCard: React.FC<{ item: any, previousItem?: any }> = ({ item, previousItem }) => {
          const totalCost = item.services.reduce((sum: number, s: any) => sum + (s.cost || 0), 0);
          const totalDuration = item.services.reduce((sum: number, s: any) => sum + (s.duration || 0), 0);
    
          const formatDuration = (minutes: number) => {
            const h = Math.floor(minutes / 60);
            const m = minutes % 60;
            return `${h > 0 ? `${h}h ` : ''}${m > 0 ? `${m}m` : ''}`.trim() || '0m';
          };
    
          let costIndicator = '';
          let timeIndicator = '';
    
          if (previousItem) {
              const prevCost = previousItem.services.reduce((sum: number, s: any) => sum + (s.cost || 0), 0);
              const prevDuration = previousItem.services.reduce((sum: number, s: any) => sum + (s.duration || 0), 0);
              const costDiff = totalCost - prevCost;
              const durationDiff = totalDuration - prevDuration;
    
              if (Math.abs(costDiff) > 5) { // Meaningful difference
                  costIndicator = costDiff > 0 ? 'Higher investment than last visit' : 'Lower investment than last visit';
              }
              if (Math.abs(durationDiff) > 10) { // Meaningful difference
                  timeIndicator = durationDiff > 0 ? 'Longer than your last visit' : 'Shorter than your last visit';
              }
          }

          return (
            <div className={`p-5 rounded-3xl border-4 shadow-sm transition-all ${item.type === 'confirmed' ? 'bg-white border-brand-secondary ring-4 ring-teal-50' : 'bg-gray-50 border-gray-100'}`}>
                <div className="flex justify-between items-center mb-4">
                    <div>
                      <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${item.type === 'confirmed' ? 'text-brand-secondary' : 'text-gray-400'}`}>
                          {item.type === 'confirmed' ? 'Confirmed Appointment' : 'Next on Your Blueprint'}
                      </p>
                      <p className="font-black text-gray-950 text-lg">{new Date(item.date).toLocaleDateString([], {weekday: 'long', month: 'long', day: 'numeric'})}</p>
                    </div>
                    <p className="font-bold text-gray-500 text-sm">{new Date(item.date).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</p>
                </div>
  
                <div className="grid grid-cols-2 gap-4 bg-white p-4 rounded-2xl border-2 border-gray-100 mb-4">
                    <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Est. Cost</p>
                        <p className="font-black text-2xl text-gray-900">${totalCost.toFixed(0)}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Est. Time</p>
                        <p className="font-black text-2xl text-gray-900">{formatDuration(totalDuration)}</p>
                    </div>
                    {(costIndicator || timeIndicator) && (
                      <div className="col-span-2 text-center border-t-2 border-gray-100 pt-3 mt-2">
                          <p className="text-xs font-bold text-gray-500">{costIndicator || timeIndicator}</p>
                      </div>
                    )}
                </div>
  
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Included Services:</p>
                  <div className="space-y-2">
                    {item.services.map((s: any, idx: number) => (
                        <div key={idx} className="bg-gray-100/50 p-3 rounded-xl border-2 border-gray-100 flex justify-between">
                            <span className="font-bold text-sm text-gray-800">{s.name}</span>
                        </div>
                    ))}
                  </div>
                </div>
                
                {item.type === 'roadmap' && (
                    <button 
                        onClick={() => { setViewingPlan(item.plan); setActiveTab('plan'); }}
                        className="mt-6 w-full py-4 bg-gray-950 text-white font-black rounded-2xl shadow-xl flex items-center justify-center space-x-3 active:scale-95 transition-all border-b-4 border-gray-800"
                    >
                        <CalendarIcon className="w-5 h-5 text-brand-secondary" />
                        <span>BOOK THIS VISIT</span>
                    </button>
                )}

                <p className="text-center text-[10px] font-bold text-gray-400 mt-4 px-2 italic">With {item.stylist}</p>
            </div>
          );
      };

      return (
          <div className="p-6 pb-24 h-full overflow-y-auto">
              <h1 className="text-2xl font-black text-brand-accent mb-6 tracking-tighter">Timeline</h1>
              <div className="space-y-8">
                  <div>
                      <h2 className="font-black text-gray-950 text-sm uppercase tracking-widest mb-3">Coming Up</h2>
                      {upcoming.length > 0 ? (
                          <div className="space-y-4">
                              {upcoming.map((item) => <AppointmentCard key={item.id} item={item} previousItem={past[0]} />)}
                          </div>
                      ) : <p className="text-center text-xs font-bold text-gray-400 py-8 uppercase">No upcoming visits</p>}
                  </div>
                   <div>
                      <h2 className="font-black text-gray-950 text-sm uppercase tracking-widest mb-3">History</h2>
                      {past.length > 0 ? (
                          <div className="space-y-4">
                              {past.map((item, index) => <AppointmentCard key={item.id} item={item} previousItem={past[index + 1]} />)}
                          </div>
                      ) : <p className="text-center text-xs font-bold text-gray-400 py-8 uppercase">No history found</p>}
                  </div>
              </div>
          </div>
      );
  }

  const renderContent = () => {
    switch (activeTab) {
        case 'plan':
             if (viewingPlan) {
                 return (
                    <div className="flex flex-col h-full">
                        <button onClick={() => setViewingPlan(null)} className="flex items-center space-x-2 p-4 bg-gray-50 border-b-2 border-gray-100 text-sm font-black text-gray-950">
                            <ChevronLeftIcon className="w-5 h-5" />
                            <span>All My Blueprints</span>
                        </button>
                        <div className="flex-grow overflow-y-auto">
                            <PlanSummaryStep plan={viewingPlan} role={role} />
                        </div>
                    </div>
                 );
             }

             if (allClientPlans.length === 0) return (
                 <div className="p-8 text-center h-full flex flex-col items-center justify-center text-gray-400 font-black uppercase text-sm tracking-widest">
                     <DocumentTextIcon className="w-16 h-16 mb-4 opacity-20" />
                     <p className="px-10 leading-tight mb-8">Your stylist is currently building your maintenance blueprint.</p>
                     <button 
                        onClick={() => setActiveTab('appointments')}
                        className="bg-brand-primary text-white font-black py-4 px-8 rounded-2xl shadow-xl border-b-4 border-black/20"
                     >
                        Check Appointments
                     </button>
                 </div>
             );

             return (
                <div className="p-6 pb-24 h-full overflow-y-auto">
                    <h1 className="text-2xl font-black text-brand-accent mb-6 tracking-tighter">My Blueprints</h1>
                    <div className="space-y-4">
                        {allClientPlans.map(p => (
                            <button key={p.id} onClick={() => setViewingPlan(p)} className="w-full text-left bg-white p-5 rounded-[24px] border-4 border-gray-100 shadow-sm hover:border-brand-primary active:scale-95 transition-all">
                                <p className="font-black text-gray-950">Maintenance Blueprint</p>
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                                    With {p.stylistName} &bull; Created {new Date(p.createdAt).toLocaleDateString()}
                                </p>
                                <div className="mt-3 pt-3 border-t-2 border-gray-50 flex justify-between items-center">
                                    <p className="font-black text-lg text-brand-accent">${p.totalCost.toLocaleString()}</p>
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${p.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>{p.status}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
             );
        case 'appointments': return renderAppointments();
        case 'memberships': return renderMemberships();
        case 'account': 
            return <AccountSettings user={user} onLogout={logout} subtitle="Valued Guest" />;
        default: return <div>Unknown</div>;
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-brand-bg">
        <header className="p-4 flex justify-between items-center bg-white border-b-2 border-gray-100 shadow-sm sticky top-0 z-10">
            <h1 className="text-xl font-black text-brand-accent tracking-tighter">{branding.salonName}</h1>
            {branding.logoUrl && <img src={branding.logoUrl} alt="Salon Logo" className="h-10 w-auto object-contain" />}
        </header>
        {pendingOfferPlan && !viewingPlan && (
            <div className="bg-brand-secondary text-white p-4 text-center animate-fade-in shadow-lg">
                <p className="text-sm font-black mb-2">You have a new membership invitation!</p>
                <button 
                    onClick={() => { setViewingPlan(pendingOfferPlan); setActiveTab('plan'); }}
                    className="bg-white text-brand-secondary font-black px-4 py-1 rounded-full text-xs uppercase tracking-widest"
                >
                    View Offer
                </button>
            </div>
        )}
        <div className="flex-grow flex flex-col">
            {renderContent()}
        </div>
        <BottomNav role={role} activeTab={activeTab} onNavigate={setActiveTab} />
    </div>
  );
};

export default ClientDashboard;
