
import React, { useState, useMemo, useEffect } from 'react';
import { AreaChart, Area, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import BottomNav from './BottomNav';
import StylistDashboard from './StylistDashboard';
import { SquareIntegrationService } from '../services/squareIntegration';
import { CURRENT_CLIENT } from '../data/mockData';
import { useSettings, SettingsProvider } from '../contexts/SettingsContext';
import { usePlans } from '../contexts/PlanContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { 
    RefreshIcon, 
    CheckCircleIcon, 
    ChevronLeftIcon,
    TrashIcon,
    UsersIcon,
    GlobeIcon,
    ClipboardIcon,
    DatabaseIcon,
    SettingsIcon
} from './icons';
import type { UserRole, GeneratedPlan, Service, Stylist, MembershipTier, AppTextSize, Client } from '../types';
import AccountSettings from './AccountSettings';
import ReportsPage from './ReportsPage';
import SettingsPage from './SettingsPage';

const AdminDashboard: React.FC<{ role: UserRole; initialTab?: string; onNavigate: (view: string) => void; }> = ({ role, initialTab = 'dashboard', onNavigate }) => {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [isViewingReports, setIsViewingReports] = useState(false);
  
  const { 
      clients,
      branding,
  } = useSettings();
  
  const { getStats, plans } = usePlans();
  const { logout, user } = useAuth();
  const [adminPlan, setAdminPlan] = useState<GeneratedPlan | null>(null);

  const stats = getStats();
  const allPlansSorted = useMemo(() => [...plans].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [plans]);
  
  const totalPipeline = plans
    .filter(p => p.status === 'active' || p.status === 'draft')
    .reduce((sum, p) => sum + Number(p.totalCost), 0);

  const pipelineGrowthData = useMemo(() => {
    const sortedPlans = [...plans].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
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

  }, [plans]);

  const clientAdoptionData = useMemo(() => {
    const totalClients = clients.length;
    if (totalClients === 0) return [];
    
    const activePlans = plans.filter(p => p.status === 'active');
    const clientsWithActivePlans = new Set(activePlans.map(p => p.client.id)).size;

    return [
      { name: 'With Plan', value: clientsWithActivePlans },
      { name: 'No Plan', value: totalClients - clientsWithActivePlans }
    ];
  }, [plans, clients]);
  const activeAdoptionRate = clients.length > 0 ? ((new Set(plans.filter(p => p.status === 'active').map(p => p.client.id)).size / clients.length) * 100).toFixed(0) : 0;
  
  const renderDashboard = () => {
    if (isViewingReports) {
        return <ReportsPage user={user!} onBack={() => setIsViewingReports(false)} />;
    }

    return (
      <div className="p-6 pb-24 h-full overflow-y-auto">
          <div className="flex justify-between items-start mb-8">
            <h1 className="text-3xl font-black text-brand-accent tracking-tighter">Admin Dashboard</h1>
            {branding.logoUrl && <img src={branding.logoUrl} alt="Salon Logo" className="h-12 w-auto object-contain"/>}
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="col-span-2 bg-gray-950 text-white p-6 rounded-[32px] shadow-2xl border-4 border-gray-900">
                  <p className="text-sm font-black uppercase text-gray-400 mb-1 tracking-widest">Roadmap Pipeline</p>
                  <p className="text-5xl font-black text-brand-secondary">${totalPipeline.toLocaleString()}</p>
              </div>
              <div className="bg-white p-5 rounded-3xl border-4 border-gray-100 shadow-sm">
                  <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">Active Plans</p>
                  <p className="text-4xl font-black text-gray-950">{stats.activePlansCount}</p>
              </div>
               <div className="bg-white p-5 rounded-3xl border-4 border-gray-100 shadow-sm">
                  <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">Total Clients</p>
                  <p className="text-4xl font-black text-gray-950">{clients.length}</p>
              </div>
          </div>
          
          <div className="space-y-6">
            <div className="bg-white p-5 rounded-3xl border-4 border-gray-100 shadow-sm">
                <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest mb-4">Pipeline Growth</h3>
                <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={pipelineGrowthData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                            <defs>
                                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--color-brand-secondary)" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="var(--color-brand-secondary)" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" tick={{fontSize: 10, fill: '#6b7280'}} axisLine={false} tickLine={false} />
                            <YAxis tickFormatter={(val) => `$${(val as number / 1000)}k`} tick={{fontSize: 10, fill: '#6b7280'}} axisLine={false} tickLine={false} />
                            <Tooltip formatter={(value) => [`$${(value as number).toLocaleString()}`, "Pipeline"]} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }} />
                            <Area type="monotone" dataKey="value" stroke="var(--color-brand-secondary)" fillOpacity={1} fill="url(#colorValue)" strokeWidth={3} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
             <div className="bg-white p-5 rounded-3xl border-4 border-gray-100 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Client Adoption</h3>
                    <span className="text-2xl font-black text-brand-accent">{activeAdoptionRate}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden border-2 border-gray-200">
                    <div className="bg-brand-accent h-full" style={{ width: `${activeAdoptionRate}%` }}></div>
                </div>
                <p className="text-center text-[10px] font-bold text-gray-400 mt-2 uppercase tracking-wider">{clientAdoptionData[0]?.value} of {clients.length} clients have active plans.</p>
            </div>
          </div>


          <div className="my-8">
            <button onClick={() => setIsViewingReports(true)} className="w-full bg-white text-gray-950 font-black py-4 px-4 rounded-2xl shadow-md flex items-center justify-center space-x-3 border-b-4 border-gray-200 active:scale-95 transition-all">
                <ClipboardIcon className="w-5 h-5" />
                <span>View Full Reports</span>
            </button>
          </div>
          
          <h3 className="font-black text-gray-950 mb-4 text-sm uppercase tracking-widest">Recent Activity</h3>
          <div className="space-y-3">
              {allPlansSorted.slice(0, 5).map(p => (
                  <button key={p.id} onClick={() => { setAdminPlan(p); setActiveTab('plans'); }} className="w-full bg-white p-5 rounded-[24px] border-4 border-gray-100 shadow-sm text-left flex justify-between items-center group active:scale-95 hover:border-brand-primary transition-all">
                      <div>
                          <p className="font-black text-gray-950 group-hover:text-brand-primary transition-colors">{p.client.name}</p>
                          <p className="text-xs font-bold text-gray-400">by {p.stylistName}</p>
                      </div>
                      <div className="text-right">
                           <p className="font-black text-lg text-brand-accent">${p.totalCost.toLocaleString()}</p>
                           <span className={`text-xs font-bold px-2 py-0.5 rounded ${p.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>{p.status}</span>
                      </div>
                  </button>
              ))}
          </div>
      </div>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return renderDashboard();
      case 'plans':
        return <StylistDashboard 
                    role="admin" 
                    onLogout={() => {}} 
                    client={adminPlan?.client} 
                    existingPlan={adminPlan} 
                    onPlanChange={setAdminPlan}
                    initialStep={adminPlan ? 'summary' : undefined}
                    onNavigate={onNavigate}
                />;
      default:
        return renderDashboard();
    }
  };

  return (
    <div className="flex flex-col h-full bg-brand-bg">
      <div className="flex-grow flex flex-col overflow-y-auto pb-20">
        {renderContent()}
      </div>
      <BottomNav role={role} activeTab={activeTab} onNavigate={(tab) => {
          if (tab === 'settings' || tab === 'account') {
              onNavigate('settings');
          } else {
              setActiveTab(tab);
              setAdminPlan(null);
              setIsViewingReports(false);
          }
      }} />
    </div>
  );
};

export default AdminDashboard;
