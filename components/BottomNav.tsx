import React from 'react';
import { HomeIcon, CalendarIcon, UsersIcon, SettingsIcon, ClipboardIcon } from './icons';
import { useSettings } from '../contexts/SettingsContext';
import { ensureAccessibleColor } from '../utils/ensureAccessibleColor';

export type Tab = 'dashboard' | 'calendar' | 'clients' | 'team' | 'settings';

interface BottomNavProps {
  activeTab: string;
  onChange: (tab: Tab) => void;
}

const NAV_ITEMS: { key: Tab; label: string; icon: any }[] = [
  { key: 'dashboard', label: 'Home', icon: HomeIcon },
  { key: 'calendar', label: 'Calendar', icon: CalendarIcon },
  { key: 'clients', label: 'Clients', icon: UsersIcon },
  { key: 'team', label: 'Team', icon: ClipboardIcon },
  { key: 'settings', label: 'Settings', icon: SettingsIcon },
];

export default function BottomNav({ activeTab, onChange }: BottomNavProps) {
  const { branding } = useSettings();
  const safePrimaryColor = ensureAccessibleColor(branding.primaryColor, '#111827', '#BE123C');

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
