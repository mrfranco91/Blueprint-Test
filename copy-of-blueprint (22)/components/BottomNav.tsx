
import React from 'react';
import { HomeIcon, UsersIcon, CalendarIcon, DocumentTextIcon, SettingsIcon, CheckCircleIcon, PlusIcon, ClipboardIcon } from './icons';
import type { UserRole } from '../types';
import { useSettings } from '../contexts/SettingsContext';
import { ensureAccessibleColor } from '../utils/ensureAccessibleColor';

interface BottomNavProps {
    role: UserRole;
    activeTab: string;
    onNavigate: (tab: string) => void;
}

const BottomNav: React.FC<BottomNavProps> = ({ role, activeTab, onNavigate }) => {
  const { branding } = useSettings();
  let navItems: { name: string; icon: any; key: string; isAction?: boolean }[] = [];

  const stylistNav = [
    { name: 'Home', icon: HomeIcon, key: 'home' },
    { name: 'Clients', icon: UsersIcon, key: 'clients' },
    { name: 'Calendar', icon: CalendarIcon, key: 'appointments' },
    { name: 'Plans', icon: DocumentTextIcon, key: 'plans' },
    { name: 'Account', icon: SettingsIcon, key: 'account' },
  ];
  
  const clientNav = [
    { name: 'My Blueprint', icon: DocumentTextIcon, key: 'plan' },
    { name: 'Appointments', icon: CalendarIcon, key: 'appointments' },
    { name: 'Memberships', icon: CheckCircleIcon, key: 'memberships' },
    { name: 'Account', icon: SettingsIcon, key: 'account' },
  ];

  const adminNav = [
      { name: 'Dashboard', icon: HomeIcon, key: 'dashboard' },
      { name: 'Plans', icon: DocumentTextIcon, key: 'plans' },
      { name: 'Settings', icon: SettingsIcon, key: 'settings' },
      { name: 'Account', icon: UsersIcon, key: 'account' },
  ]

  switch(role) {
      case 'stylist':
          navItems = stylistNav;
          break;
      case 'client':
          navItems = clientNav;
          break;
      case 'admin':
          navItems = adminNav;
          break;
      default:
          navItems = [];
  }

  const safePrimaryColor = ensureAccessibleColor(branding.primaryColor, '#FFFFFF', '#BE123C');

  return (
    <div className="w-full bg-white border-t-4 border-gray-900 p-2 flex justify-around mt-auto fixed bottom-0 left-0 right-0 max-w-md mx-auto z-40 pb-6 pt-3 shadow-[0_-10px_20px_rgba(0,0,0,0.1)]">
      {navItems.map(item => {
        const isActive = activeTab === item.key || (activeTab === 'home' && item.key === 'dashboard');
        return (
            <button
            key={item.key}
            onClick={() => onNavigate(item.key)}
            className={`flex flex-col items-center justify-center w-full p-1 rounded-lg transition-colors ${
                item.isAction 
                ? '-mt-6' 
                : isActive 
                    ? '' 
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-950'
            }`}
            style={isActive && !item.isAction ? { color: safePrimaryColor } : (item.isAction ? { color: safePrimaryColor } : {})}
            >
            {item.isAction ? (
                <div className="bg-brand-primary text-white rounded-full p-3 shadow-lg border-4 border-gray-900">
                    <item.icon className="h-6 w-6" />
                </div>
            ) : (
                <item.icon className={`h-7 w-7 mb-1 ${isActive ? 'stroke-[3]' : 'stroke-[2.5]'}`} />
            )}
            
            <span className={`text-[10px] font-black uppercase tracking-tight ${item.isAction ? 'mt-1' : (isActive ? '' : 'text-gray-950')}`}>
                {item.name}
            </span>
            </button>
        )
      })}
    </div>
  );
};

export default BottomNav;
