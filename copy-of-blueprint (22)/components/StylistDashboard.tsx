
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { Step, Service, PlanDetails, GeneratedPlan, PlanAppointment, Client, UserRole } from '../types';
import { TODAY_APPOINTMENTS, MOCK_CLIENTS } from '../data/mockData';
import SelectClientStep from './SelectClientStep';
import SelectServicesStep from './SelectServicesStep';
import SetDatesStep from './SetDatesStep';
import SetFrequencyStep from './SetFrequencyStep';
import LoadingStep from './LoadingStep';
import PlanSummaryStep from './PlanSummaryStep';
import BottomNav from './BottomNav';
import { supabase } from '../lib/supabase';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { usePlans } from '../contexts/PlanContext';
import { RefreshIcon, DocumentTextIcon, PlusIcon, CalendarIcon, ChevronRightIcon, UsersIcon, TrashIcon, SettingsIcon, ChevronLeftIcon, ClipboardIcon } from './icons';
import AccountSettings from './AccountSettings';
import StylistReports from './StylistReports';
import { ensureAccessibleColor } from '../utils/ensureAccessibleColor';

interface StylistDashboardProps {
    onLogout: () => void;
    client?: Client;
    existingPlan?: GeneratedPlan | null;
    onPlanChange?: (plan: GeneratedPlan | null) => void;
    role?: UserRole;
    initialStep?: Step;
}

const StylistDashboard: React.FC<StylistDashboardProps> = ({ onLogout, role: propRole, existingPlan: propPlan, client: propClient, initialStep }) => {
  const [activeTab, setActiveTab] = useState(initialStep ? 'plans' : 'home');
  const [_step, _setStep] = useState<Step | 'idle'>('idle');
  const [wizardCompleted, setWizardCompleted] = useState(false);
  
  const stepRef = useRef(_step);
  stepRef.current = _step;

  const setStep = (newStep: Step | 'idle') => {
    if (wizardCompleted && stepRef.current === 'summary' && newStep !== 'summary') {
        console.warn(`Wizard step change to '${newStep}' blocked because wizard is complete.`);
        return;
    }
    _setStep(newStep);
  };
  
  const [isViewingReports, setIsViewingReports] = useState(false);
  
  const { services: availableServices, clients: globalClients, integration, pinnedReports, branding } = useSettings(); 
  const { user } = useAuth();
  const { savePlan, getPlanForClient, getClientHistory, plans } = usePlans();

  const [activeClient, setActiveClient] = useState<Client | null>(propClient || null);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [planDetails, setPlanDetails] = useState<PlanDetails>({});
  
  const [clientSearch, setClientSearch] = useState('');
  const [viewingHistory, setViewingHistory] = useState(false);
  const [selectedHistoryPlan, setSelectedHistoryPlan] = useState<GeneratedPlan | null>(null);
  
  const currentPlan = selectedHistoryPlan || propPlan || (activeClient ? getPlanForClient(activeClient.id) : null);

  useEffect(() => {
      if (initialStep) {
          setStep(initialStep);
          setActiveTab('plans');
      }
  }, [initialStep]);

  const selectedServices = useMemo(() => {
    return availableServices.filter(service => selectedServiceIds.includes(service.id));
  }, [selectedServiceIds, availableServices]);

  const filteredClients = useMemo(() => {
      return globalClients.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase()));
  }, [clientSearch, globalClients]);

  const myPlans = useMemo(() => {
      if (!user) return [];
      return plans.filter(p => p.stylistId === user.id);
  }, [plans, user]);

  const myStats = useMemo(() => {
      const myPipeline = myPlans.reduce((sum, p) => sum + p.totalCost, 0);
      const myActivePlansCount = myPlans.filter(p => p.status === 'active').length;
      const myClientsCount = new Set(myPlans.map(p => p.client.id)).size;
      return { myPipeline, myActivePlansCount, myClientsCount };
  }, [myPlans]);

  const myPipelineGrowthData = useMemo(() => {
    const sortedPlans = [...myPlans].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    let cumulativeValue = 0;
    const dataMap = new Map<string, number>();

    sortedPlans.forEach(plan => {
      const month = new Date(plan.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
      cumulativeValue += plan.totalCost;
      dataMap.set(month, cumulativeValue);
    });
    
    const lastSixMonths = [];
    const today = new Date();
    for(let i=5; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        lastSixMonths.push(d.toLocaleDateString('en-US', { year: 'numeric', month: 'short' }));
    }

    let lastKnownValue = 0;
    return lastSixMonths.map(month => {
        if(dataMap.has(month)) {
            lastKnownValue = dataMap.get(month)!;
        }
        return { name: month, value: lastKnownValue };
    });
  }, [myPlans]);

  const myRecentActivity = useMemo(() => {
    return [...myPlans].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [myPlans]);

  const resetWizard = () => {
    setSelectedServiceIds([]);
    setPlanDetails({});
    setViewingHistory(false);
    setSelectedHistoryPlan(null);
    setWizardCompleted(false);
    setStep('idle');
  };

  const handleClientSelectedForPlan = (client: Client) => {
      setActiveClient(client);
      resetWizard();
      setViewingHistory(true);
      setActiveTab('plans');
  };

  const handleStartNewPlan = () => {
      if (!activeClient) return;
      resetWizard();
      setStep('select-services');
  };
  
  const handleEditExistingPlan = () => {
      if(!currentPlan) return;
      const serviceIds: string[] = Array.from(new Set(currentPlan.appointments.flatMap(a => a.services.map(s => s.id))));
      setSelectedServiceIds(serviceIds);
      const details: PlanDetails = {};
      serviceIds.forEach((id: string) => {
          const firstAppt = currentPlan.appointments.find(a => a.services.some(s => s.id === id));
          details[id] = {
              firstDate: firstAppt ? new Date(firstAppt.date) : new Date(),
              frequency: 6
          };
      });
      setPlanDetails(details);
      setWizardCompleted(false);
      setViewingHistory(false);
      setStep('select-services');
  }

  const handleClientSelectedFromWizard = (client: Client) => {
      setActiveClient(client);
      setStep('select-services');
  };

  const handleServicesSelected = (ids: string[]) => {
    setSelectedServiceIds(ids);
    const initialDetails: PlanDetails = {};
    ids.forEach(id => {
      initialDetails[id] = { firstDate: null, frequency: null };
    });
    setPlanDetails(initialDetails);
    setStep('set-dates');
  };
  
  const handleDatesSet = (details: PlanDetails) => {
    setPlanDetails(details);
    setStep('set-frequency');
  };

  const handleFrequencySet = (details: PlanDetails) => {
    setPlanDetails(details);
    setStep('loading');
    setTimeout(async () => {
      await generatePlan(details, ids => setSelectedServiceIds(ids));
    }, 1500);
  };
  
  const generatePlan = async (details: PlanDetails, serviceIdUpdater: (ids: string[]) => void) => {
    if (!activeClient) return;
    const stylistLevelId = user?.stylistData?.levelId || 'lvl_1'; 
    const planStartDate = new Date();
    const planEndDate = new Date();
    planEndDate.setFullYear(planEndDate.getFullYear() + 1);
    const appointments: PlanAppointment[] = [];
    let totalCost = 0;
    const finalSelectedServices = availableServices.filter(s => details[s.id]?.firstDate && details[s.id]?.frequency);
    serviceIdUpdater(finalSelectedServices.map(s => s.id));
    finalSelectedServices.forEach(service => {
        const detail = details[service.id];
        if (!detail || detail.firstDate === null || detail.frequency === null) return;
        const dynamicCost = service.tierPrices?.[stylistLevelId] ?? service.cost;
        let currentDate = new Date(detail.firstDate.getTime());
        while (currentDate <= planEndDate) {
            if (currentDate >= planStartDate) {
                const serviceInstance = { ...service, cost: dynamicCost };
                appointments.push({
                    date: new Date(currentDate.getTime()),
                    services: [serviceInstance]
                });
                totalCost += dynamicCost;
            }
            currentDate.setDate(currentDate.getDate() + detail.frequency * 7);
        }
    });

    const appointmentsByDate: { [key: string]: PlanAppointment } = {};
    appointments.forEach(appt => {
        const dateKey = appt.date.toISOString().split('T')[0]; // YYYY-MM-DD
        if (appointmentsByDate[dateKey]) {
            appointmentsByDate[dateKey].services.push(...appt.services);
        } else {
            appointmentsByDate[dateKey] = {
                date: appt.date,
                services: [...appt.services]
            };
        }
    });
    const mergedAppointments = Object.values(appointmentsByDate);

    mergedAppointments.sort((a, b) => a.date.getTime() - b.date.getTime());
    const totalAppointments = mergedAppointments.length;
    const averageAppointmentCost = totalAppointments > 0 ? totalCost / totalAppointments : 0;
    const averageMonthlySpend = totalCost / 12;
    const newPlan: GeneratedPlan = {
        id: `plan_${Date.now()}`,
        status: 'draft',
        membershipStatus: 'none',
        createdAt: new Date().toISOString(),
        stylistId: user?.id?.toString() ?? '0',
        stylistName: user?.name || 'Stylist',
        client: activeClient, 
        appointments: mergedAppointments,
        totalYearlyAppointments: totalAppointments,
        averageAppointmentCost,
        averageMonthlySpend,
        totalCost,
    };

    let savedPlan: GeneratedPlan | null = null;
    try {
        savedPlan = await savePlan(newPlan);
        if (!savedPlan || !savedPlan.id) {
            throw new Error("Plan save operation returned invalid or null data.");
        }
    } catch (e: any) {
        console.error("Failed to generate and save plan:", e);
        alert(`Failed to save plan: ${e.message}`);
        setStep('set-frequency');
        return; 
    }

    try {
        const planForUI: GeneratedPlan = {
            ...savedPlan,
            appointments: (savedPlan.appointments || []).map(a => ({
                ...a,
                date: new Date(a.date) 
            }))
        };
        
        setSelectedHistoryPlan(planForUI);
        setStep('summary'); 
        setWizardCompleted(true);
    } catch (uiError: any) {
        console.warn("A UI error occurred after saving the plan, but proceeding to summary view.", uiError);
        setSelectedHistoryPlan(savedPlan);
        setStep('summary');
        setWizardCompleted(true);
    }
  };
  
  const renderHome = () => {
    const safeAccentColor = ensureAccessibleColor(branding.accentColor, '#F8F9FA', '#1E3A8A');
    const newRoadmapButtonStyle = {
        backgroundColor: branding.accentColor,
        color: ensureAccessibleColor('#FFFFFF', branding.accentColor, '#FFFFFF')
    };

    return (
        <div className="p-6 overflow-y-auto h-full pb-24">
            <div className="flex justify-between items-start mb-8">
                <div>
                    <h1 className="text-3xl font-black tracking-tighter" style={{ color: safeAccentColor }}>Welcome, {user?.name?.split(' ')[0]}</h1>
                    <p className="text-gray-950 font-black text-sm uppercase tracking-widest">Stylist Dashboard</p>
                </div>
                {branding.logoUrl ? (
                    <img src={branding.logoUrl} alt="Salon Logo" className="w-14 h-14 object-cover rounded-2xl border-4 border-gray-950 shadow-lg"/>
                ) : (
                    <div className="w-14 h-14 bg-brand-primary rounded-2xl flex items-center justify-center text-white font-black border-4 border-gray-950 shadow-lg text-2xl">
                        {user?.name?.[0] || 'S'}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="col-span-3 bg-gray-950 text-white p-6 rounded-[32px] shadow-2xl border-4 border-gray-900">
                    <p className="text-sm font-black uppercase text-gray-400 mb-1 tracking-widest">My Pipeline</p>
                    <p className="text-5xl font-black" style={{ color: branding.secondaryColor }}>${myStats.myPipeline.toLocaleString()}</p>
                </div>
                <div className="bg-white col-span-2 p-5 rounded-3xl border-4 border-gray-100 shadow-sm">
                    <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">My Active Plans</p>
                    <p className="text-4xl font-black text-gray-950">{myStats.myActivePlansCount}</p>
                </div>
                <div className="bg-white p-5 rounded-3xl border-4 border-gray-100 shadow-sm">
                    <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">My Clients</p>
                    <p className="text-4xl font-black text-gray-950">{myStats.myClientsCount}</p>
                </div>
            </div>
            
            <div className="bg-white p-5 rounded-3xl border-4 border-gray-100 shadow-sm mb-6">
                <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest mb-4">My Pipeline Growth</h3>
                <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={myPipelineGrowthData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                            <defs>
                                <linearGradient id="myColorValue" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="var(--color-brand-secondary)" stopOpacity={0.8}/>
                                    <stop offset="95%" stopColor="var(--color-brand-secondary)" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" tick={{fontSize: 10, fill: '#6b7280'}} axisLine={false} tickLine={false} />
                            <YAxis tickFormatter={(val) => `$${(val as number / 1000)}k`} tick={{fontSize: 10, fill: '#6b7280'}} axisLine={false} tickLine={false} />
                            <Tooltip formatter={(value) => [`$${(value as number).toLocaleString()}`, "Pipeline"]} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }} />
                            <Area type="monotone" dataKey="value" stroke="var(--color-brand-secondary)" fillOpacity={1} fill="url(#myColorValue)" strokeWidth={3} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="my-6 space-y-3">
                {propRole !== 'admin' && (
                    <button onClick={() => setIsViewingReports(true)} className="w-full bg-white text-gray-950 font-black py-4 px-4 rounded-2xl shadow-md flex items-center justify-center space-x-3 border-b-4 border-gray-200 active:scale-95 transition-all">
                        <ClipboardIcon className="w-5 h-5" />
                        <span>View My Reports</span>
                    </button>
                )}
                <button onClick={() => { setActiveTab('plans'); setStep('select-client'); }} className="w-full font-black py-4 px-4 rounded-2xl shadow-xl flex items-center justify-center space-x-3 border-b-4 border-black/20 active:scale-95 transition-all" style={newRoadmapButtonStyle}>
                    <PlusIcon className="w-6 h-6" />
                    <span>New Roadmap</span>
                </button>
            </div>
            
            <h3 className="font-black text-gray-950 mb-4 text-sm uppercase tracking-widest">My Recent Activity</h3>
            <div className="space-y-3">
                {myRecentActivity.slice(0, 5).map(p => (
                    <button key={p.id} onClick={() => { setActiveClient(p.client); setSelectedHistoryPlan(p); setStep('summary'); setActiveTab('plans'); }} className="w-full bg-white p-5 rounded-[24px] border-4 border-gray-100 shadow-sm text-left flex justify-between items-center group active:scale-95 hover:border-brand-primary transition-all">
                        <div>
                            <p className="font-black text-gray-950 group-hover:text-brand-primary transition-colors">{p.client.name}</p>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{new Date(p.createdAt).toLocaleDateString()}</p>
                        </div>
                        <div className="text-right">
                             <p className="font-black text-lg" style={{ color: safeAccentColor }}>${p.totalCost.toLocaleString()}</p>
                             <span className={`text-xs font-bold px-2 py-0.5 rounded ${p.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>{p.status}</span>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
  }

  const renderClientHistory = () => {
      if (!activeClient) return null;
      const clientPlans = getClientHistory(activeClient.id);
      const safeAccentColor = ensureAccessibleColor(branding.accentColor, '#FFFFFF', '#1E3A8A');
      return (
          <div className="p-6 h-full flex flex-col">
              <div className="mb-6 bg-white p-6 rounded-3xl shadow-sm border-4 border-gray-100 text-center">
                  <img src={activeClient.avatarUrl} className="w-24 h-24 rounded-full mx-auto mb-4 border-4" style={{ borderColor: branding.secondaryColor }}/>
                  <h2 className="text-2xl font-black" style={{ color: safeAccentColor }}>{activeClient.name}</h2>
                  {activeClient.externalId && <span className="text-[10px] text-green-600 font-black bg-green-50 px-2 py-0.5 rounded border border-green-200 uppercase tracking-widest">Square Linked</span>}
              </div>
              <h3 className="font-black text-gray-950 mb-3 text-sm uppercase tracking-widest px-1">Roadmap History</h3>
              <div className="flex-grow space-y-4 overflow-y-auto pb-24">
                  {clientPlans.length === 0 && <p className="text-center py-8 text-gray-400 font-bold uppercase text-xs">No active roadmaps found.</p>}
                  {clientPlans.map(plan => (
                      <div key={plan.id} className="bg-white p-5 rounded-[24px] border-4 border-gray-100 shadow-sm cursor-pointer hover:border-brand-secondary transition-all active:scale-95" onClick={() => { setSelectedHistoryPlan(plan); setStep('summary'); }}>
                          <div className="flex justify-between items-center">
                              <div>
                                  <p className="font-black text-gray-950">Maintenance Plan</p>
                                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Created {new Date(plan.createdAt).toLocaleDateString()}</p>
                              </div>
                              <p className="text-lg font-black" style={{ color: safeAccentColor }}>${plan.totalCost.toLocaleString()}</p>
                          </div>
                      </div>
                  ))}
              </div>
              <div className="fixed bottom-24 left-4 right-4 max-w-md mx-auto z-30">
                  <button onClick={handleStartNewPlan} className="w-full text-white font-black py-5 rounded-2xl shadow-2xl border-b-4 border-black/20 active:scale-95 transition-all" style={{ backgroundColor: branding.accentColor, color: ensureAccessibleColor('#FFFFFF', branding.accentColor, '#FFFFFF') }}>NEW ROADMAP</button>
                  <button onClick={() => { setActiveClient(null); setViewingHistory(false); }} className="w-full text-center mt-3 text-gray-400 font-black uppercase tracking-widest text-xs">Back to Search</button>
              </div>
          </div>
      )
  }

  const renderContent = () => {
      if (propRole !== 'admin' && activeTab === 'home' && isViewingReports) {
          return <StylistReports user={user!} onBack={() => setIsViewingReports(false)} />;
      }
      
      const safeAccentColor = ensureAccessibleColor(branding.accentColor, '#F8F9FA', '#1E3A8A');
      const startHereButtonStyle = {
          backgroundColor: branding.primaryColor,
          color: ensureAccessibleColor('#FFFFFF', branding.primaryColor, '#FFFFFF')
      };

      switch (activeTab) {
          case 'home': return renderHome();
          case 'clients': return (
              <div className="p-4 flex flex-col h-full">
                  <h1 className="text-2xl font-black mb-6 tracking-tighter" style={{ color: safeAccentColor }}>Client Directory</h1>
                   <div className="relative mb-6">
                        <input type="text" placeholder="Search by name..." value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} className="w-full p-4 pl-12 bg-white border-4 border-gray-100 rounded-2xl outline-none font-bold text-gray-950 shadow-sm focus:border-brand-accent" />
                        <UsersIcon className="w-5 h-5 text-gray-400 absolute left-4 top-4.5" />
                   </div>
                  <div className="flex-grow overflow-y-auto space-y-3 px-1">
                    {filteredClients.map(c => (
                        <button key={c.id} className="w-full flex items-center p-4 bg-white border-4 border-gray-100 rounded-[24px] shadow-sm active:scale-95 transition-all text-left" onClick={() => handleClientSelectedForPlan(c)}>
                            <img src={c.avatarUrl} className="w-14 h-14 rounded-2xl mr-4 border-2 border-gray-50"/>
                            <div className="flex-grow">
                                <span className="font-black text-gray-950 block text-lg leading-tight">{c.name}</span>
                                {c.externalId && <span className="text-[10px] text-green-600 font-black uppercase tracking-widest">Square Connected</span>}
                            </div>
                            <ChevronRightIcon className="w-6 h-6 text-gray-200"/>
                        </button>
                    ))}
                  </div>
              </div>
          );
          case 'appointments': return (
              <div className="p-6 flex flex-col items-center justify-center h-full text-center">
                  <CalendarIcon className="w-16 h-16 mb-6" style={{ color: safeAccentColor }}/>
                  <h1 className="text-2xl font-black mb-2 tracking-tighter" style={{ color: safeAccentColor }}>Salon Schedule</h1>
                  <p className="text-gray-400 font-bold mb-8 px-8">Synchronized with your salon management system.</p>
                  <button className="bg-gray-950 text-white px-10 py-5 rounded-2xl font-black text-lg border-b-4 border-gray-800 shadow-xl active:scale-95 transition-all">LAUNCH POS</button>
              </div>
          ); 
          case 'plans': 
              if (activeClient && viewingHistory && _step === 'idle') return renderClientHistory();
              if (_step === 'select-client') return <SelectClientStep clients={globalClients} onSelect={handleClientSelectedFromWizard} onBack={() => { setStep('idle'); setActiveTab('home'); }} />;
              if (_step === 'select-services') return <SelectServicesStep availableServices={availableServices} onNext={handleServicesSelected} onBack={() => { setViewingHistory(true); setStep('idle'); }} />;
              if (_step === 'set-dates') return <SetDatesStep selectedServices={selectedServices} onNext={handleDatesSet} planDetails={planDetails} onBack={() => setStep('select-services')} />;
              if (_step === 'set-frequency') return <SetFrequencyStep selectedServices={selectedServices} onNext={handleFrequencySet} planDetails={planDetails} onBack={() => setStep('set-dates')} />;
              if (_step === 'loading') return <LoadingStep />;
              if (_step === 'summary' && currentPlan) return <PlanSummaryStep plan={currentPlan} onEditPlan={handleEditExistingPlan} role={propRole || 'stylist'} />;
              return (
                 <div className="p-8 text-center flex flex-col items-center justify-center h-full">
                    <DocumentTextIcon className="w-16 h-16 mb-6" style={{ color: safeAccentColor }} />
                    <h2 className="text-2xl font-black mb-2 tracking-tighter" style={{ color: safeAccentColor }}>Plan Management</h2>
                    <p className="text-gray-400 font-bold mb-8">Select a client to view or create roadmaps.</p>
                    <button onClick={() => setStep('select-client')} className="font-black py-5 px-10 rounded-2xl border-b-4 border-black/20 shadow-xl active:scale-95 transition-all" style={startHereButtonStyle}>START HERE</button>
                 </div>
              );
          case 'account': 
            return <AccountSettings user={user} onLogout={onLogout} subtitle={user?.stylistData?.role || 'Stylist'} />;
          default: return <div>Unknown Tab</div>;
      }
  };

  return (
      <div className="flex flex-col h-full bg-brand-bg">
        <div className="flex-grow flex flex-col pb-20 overflow-hidden">
            {renderContent()}
        </div>
        <BottomNav role={propRole || 'stylist'} activeTab={activeTab} onNavigate={(tab) => {
            setActiveTab(tab);
            if (tab !== 'plans') {
                setActiveClient(null);
                resetWizard();
            } else if (_step !== 'idle') {
                // If they re-click "Plans" while in a wizard, reset it.
                setActiveClient(null);
                resetWizard();
            }
        }} />
      </div>
  )
};

export default StylistDashboard;