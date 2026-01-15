import React from 'react';
import { HomeIcon, CalendarIcon, UsersIcon, SettingsIcon, ClipboardIcon } from './icons';
import type { UserRole } from '../types';
import { useSettings } from '../contexts/SettingsContext';
import { ensureAccessibleColor } from '../utils/ensureAccessibleColor';

interface BottomNavProps {
    role: UserRole;
    activeTab: string;
    onNavigate: (tab: string) => void;
}

// UX ARCHITECTURE MAPPING:
// 'dashboard' -> Home screen
// 'appointments' -> Calendar/Schedule
// 'clients' -> Client directory
// 'plans' -> Team view/Roadmap management
// 'settings' -> System configuration
const NAV_ITEMS = [
  { key: 'dashboard', label: 'Home', icon: HomeIcon },
  { key: 'appointments', label: 'Calendar', icon: CalendarIcon },
  { key: 'clients', label: 'Clients', icon: UsersIcon },
  { key: 'plans', label: 'Team', icon: ClipboardIcon },
  { key: 'settings', label: 'Settings', icon: SettingsIcon },
];

export default function BottomNav({ role, activeTab, onNavigate }: BottomNavProps) {
  const { branding } = useSettings();
  const safePrimaryColor = ensureAccessibleColor(branding.primaryColor, '#FFFFFF', '#BE123C');

  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white border-t-4 border-gray-900 z-50 pb-6 pt-3 shadow-[0_-10px_20px_rgba(0,0,0,0.1)]">
      <div className="flex justify-around max-w-md mx-auto">
        {NAV_ITEMS.map(({ key, label, icon: Icon }) => {
          // Normalized active state check to prevent routing mismatch
          const isActive = activeTab === key || (activeTab === 'home' && key === 'dashboard');
          
          return (
            <button
              key={key}
              onClick={() => onNavigate(key)}
              className={`flex flex-col items-center justify-center w-full p-1 rounded-lg transition-colors ${
                isActive 
                    ? '' 
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-950'
              }`}
              style={isActive ? { color: safePrimaryColor } : {}}
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
