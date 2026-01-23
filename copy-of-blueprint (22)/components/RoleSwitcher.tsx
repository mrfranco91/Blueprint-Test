import React from 'react';
import type { UserRole } from '../types';

interface RoleSwitcherProps {
  currentRole: UserRole;
  setRole: (role: UserRole) => void;
}

const ROLES: UserRole[] = ['stylist', 'client', 'admin'];

const RoleSwitcher: React.FC<RoleSwitcherProps> = ({ currentRole, setRole }) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-800 bg-opacity-90 p-2 z-50 max-w-md mx-auto">
      <div className="flex justify-around items-center">
        <span className="text-white text-sm font-bold mr-2">VIEW AS:</span>
        {ROLES.map(role => (
          <button
            key={role}
            onClick={() => setRole(role)}
            className={`px-3 py-1 text-xs font-semibold rounded-full capitalize transition-colors ${
              currentRole === role
                ? 'bg-brand-primary text-white'
                : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
            }`}
          >
            {role}
          </button>
        ))}
      </div>
    </div>
  );
};

export default RoleSwitcher;