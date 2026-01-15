import React from 'react';
import { HomeIcon, DocumentTextIcon, SettingsIcon } from './icons';
import type { UserRole } from '../types';
import { useSettings } from '../contexts/SettingsContext';
import { ensureAccessibleColor } from '../utils/ensureAccessibleColor';

interface BottomNavProps {
  role: UserRole; // kept for compatibility; Pro/Admin nav is identical by requirement
  activeTab: string;
  onNavigate: (tab: string) => void;
}

const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onNavigate }) => {
  const { branding } = useSettings();

  // ✅ Pro/Admin nav is the same (no client nav, no stylist-only nav)
  // ✅ Keys match AdminDashboard switch cases: 'dashboard' | 'plans' | 'settings'
  const navItems = [
    { name: 'Dashboard', icon: HomeIcon, key: 'dashboard' },
    { name: 'Plans', icon: DocumentTextIcon, key: 'plans' },
    { name: 'Settings', icon: SettingsIcon, key: 'settings' },
  ];

  const safePrimaryColor = ensureAccessibleColor(branding.primaryColor, '#111827', '#BE123C');

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t-4 border-gray-900 shadow-[0_-4px_0_0_#111827] z-50">
      <div className="max-w-md mx-auto flex justify-around items-end py-2 px-2">
        {navItems.map((item) => {
          const isActive = activeTab === item.key;

          return (
            <button
              key={item.key}
              onClick={() => onNavigate(item.key)}
              className={`flex flex-col items-center justify-center flex-1 mx-1 py-2 rounded-xl transition-all ${
                isActive ? 'bg-gray-100' : 'hover:bg-gray-50'
              }`}
              style={isActive ? { color: safePrimaryColor } : {}}
              aria-label={item.name}
            >
              <item.icon className={`h-7 w-7 mb-1 ${isActive ? 'stroke-[3]' : 'stroke-[2.5]'}`} />
              <span className={`text-[10px] font-black uppercase tracking-tight ${isActive ? '' : 'text-gray-700'}`}>
                {item.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default BottomNav;