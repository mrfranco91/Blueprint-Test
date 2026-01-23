import React from 'react';
import { HomeIcon, CalendarIcon, UsersIcon, SettingsIcon, DocumentTextIcon, CheckCircleIcon } from './icons';
import { useSettings } from '../contexts/SettingsContext';
import { ensureAccessibleColor } from '../utils/ensureAccessibleColor';
import type { UserRole } from '../types';

export type Tab = 'dashboard' | 'plans' | 'settings' | 'account' | 'home' | 'clients' | 'appointments' | 'plan' | 'memberships';

interface BottomNavProps {
  role: UserRole;
  activeTab: string;
  onChange: (tab: Tab) => void;
}

export default function BottomNav({ role, activeTab, onChange }: BottomNavProps) {
  const { branding } = useSettings();
  const safePrimaryColor = ensureAccessibleColor(branding.primaryColor, '#FFFFFF', '#BE123C');

  let navItems: { name: string; icon: any; key: Tab }[] = [];

  const adminNav = [
    { name: 'Dashboard', icon: HomeIcon, key: 'dashboard' as Tab },
    { name: 'Plans', icon: DocumentTextIcon, key: 'plans' as Tab },
    { name: 'Settings', icon: SettingsIcon, key: 'settings' as Tab },
    { name: 'Account', icon: UsersIcon, key: 'account' as Tab },
  ];

  const stylistNav = [
    { name: 'Home', icon: HomeIcon, key: 'home' as Tab },
    { name: 'Clients', icon: UsersIcon, key: 'clients' as Tab },
    { name: 'Calendar', icon: CalendarIcon, key: 'appointments' as Tab },
    { name: 'Plans', icon: DocumentTextIcon, key: 'plans' as Tab },
    { name: 'Account', icon: SettingsIcon, key: 'account' as Tab },
  ];

  const clientNav = [
    { name: 'My Blueprint', icon: DocumentTextIcon, key: 'plan' as Tab },
    { name: 'Appointments', icon: CalendarIcon, key: 'appointments' as Tab },
    { name: 'Memberships', icon: CheckCircleIcon, key: 'memberships' as Tab },
    { name: 'Account', icon: SettingsIcon, key: 'account' as Tab },
  ];

  switch(role) {
    case 'admin':
      navItems = adminNav;
      break;
    case 'stylist':
      navItems = stylistNav;
      break;
    case 'client':
      navItems = clientNav;
      break;
    default:
      navItems = [];
  }

  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white border-t-4 border-gray-900 z-50 shadow-[0_-10px_20px_rgba(0,0,0,0.1)]">
      <div className="flex justify-around max-w-md mx-auto p-2 pb-6 pt-3">
        {NAV_ITEMS.map(({ key, label, icon: Icon }) => {
          const isActive = activeTab === key;

          return (
            <button
              key={key}
              onClick={() => onChange(key)}
              className="flex flex-col items-center justify-center w-full p-1 rounded-lg transition-colors"
              style={isActive ? { color: safePrimaryColor } : {}}
              aria-label={label}
            >
              <Icon className={`h-7 w-7 mb-1 ${isActive ? 'stroke-[3]' : 'stroke-[2.5]'}`} />
              <span className={`text-[10px] font-black uppercase tracking-tight ${isActive ? '' : 'text-gray-950'}`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
