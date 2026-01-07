
import React, { useState, useMemo } from 'react';
import type { Client } from '../types';
import { PlusIcon, UsersIcon, RefreshIcon } from './icons';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { ensureAccessibleColor } from '../utils/ensureAccessibleColor';

interface SelectClientStepProps {
  clients: Client[];
  onSelect: (client: Client) => void;
  onBack: () => void;
}

const SelectClientStep: React.FC<SelectClientStepProps> = ({ clients: propClients, onSelect, onBack }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { user } = useAuth();
  const { createClient, branding } = useSettings();

  const isAdmin = user?.role === 'admin';

  const clients = useMemo(() => {
    // 1. Try to get Square customers from the local sync cache for immediate availability
    const squareRaw = localStorage.getItem('square_customers');
    let squareClientsData = [];
    try {
        squareClientsData = JSON.parse(squareRaw || '[]');
    } catch (e) {
        console.error("Failed to parse cached Square customers:", e);
    }
    
    // 2. If we have cached Square data, use it. This provides a fast path right after OAuth.
    if (squareClientsData && squareClientsData.length > 0) {
      return squareClientsData.map((c: any) => ({
        id: c.id,
        externalId: c.id,
        name: `${c.given_name ?? ''} ${c.family_name ?? ''}`.trim() || c.email_address || 'Unnamed Client',
        email: c.email_address ?? '',
        avatarUrl: c.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.given_name || 'U')}&background=random`,
        historicalData: [],
        source: 'square',
      })) as Client[];
    }

    // 3. Otherwise, use the clients provided by the parent (which are fetched from the DB).
    // Filter to ensure we only show real clients if the user expects only real clients,
    // but we keep the propClients as fallback so sample clients still appear if sync hasn't happened.
    return propClients;
  }, [propClients]);

  const filteredClients = useMemo(() => {
    return clients.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [clients, searchTerm]);

  const handleCreateClient = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newName.trim() || !newEmail.trim()) {
          setCreateError("Name and email are required.");
          return;
      }
      setIsSubmitting(true);
      setCreateError(null);
      try {
          const newClient = await createClient({ name: newName, email: newEmail });
          onSelect(newClient); // This moves to the next step
      } catch (error: any) {
          if (error.message.includes('duplicate key value violates unique constraint')) {
              setCreateError("A client with this email already exists.");
          } else {
              setCreateError("Failed to create client. Please try again.");
          }
          console.error(error);
      } finally {
          setIsSubmitting(false);
      }
  };

  if (isCreating) {
    return (
        <div className="flex flex-col h-full p-4 pb-12 bg-white">
            <div className="text-center p-4">
                <h1 className="text-2xl font-bold text-gray-900 mb-1">Create New Client</h1>
                <p className="text-sm text-gray-500">This client will be saved to your database.</p>
            </div>
            <form onSubmit={handleCreateClient} className="p-4 space-y-4">
                <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Full Name</label>
                    <input 
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="e.g. Jane Doe"
                        required
                        className="w-full p-3 border border-gray-300 rounded-lg outline-none"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Email Address</label>
                    <input 
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder="e.g. jane.doe@email.com"
                        required
                        className="w-full p-3 border border-gray-300 rounded-lg outline-none"
                    />
                </div>
                {createError && <p className="text-red-500 text-sm font-bold">{createError}</p>}
                <div className="pt-4 space-y-2">
                    <button 
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full font-bold py-3 px-4 rounded-full shadow-lg flex items-center justify-center disabled:bg-gray-400"
                        style={{ backgroundColor: branding.secondaryColor, color: ensureAccessibleColor('#FFFFFF', branding.secondaryColor, '#1F2937') }}
                    >
                        {isSubmitting ? <RefreshIcon className="w-5 h-5 animate-spin" /> : 'Save and Continue'}
                    </button>
                    <button 
                        type="button"
                        onClick={() => setIsCreating(false)}
                        className="w-full text-gray-600 font-bold py-2"
                    >
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    );
  }

  return (
    <div className="flex flex-col h-full pb-12">
      <div className="p-4 bg-white border-b border-gray-100">
        <div className="w-full h-2 bg-gray-100 mb-4 rounded-full overflow-hidden">
            <div className="h-full bg-brand-secondary w-1/5 rounded-full"></div>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 text-center mb-1">Select Client</h1>
        <p className="text-sm text-gray-500 text-center mb-4">Who are we creating a plan for?</p>
        
        <div className="relative">
             <input 
                type="text" 
                placeholder="Search clients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
                className="w-full p-3 pl-10 bg-gray-50 border border-gray-200 rounded-xl outline-none transition-all"
            />
            <div className="absolute left-3 top-3.5 text-gray-400">
                <UsersIcon className="w-5 h-5" />
            </div>
        </div>
      </div>
      
      <div className="flex-grow overflow-y-auto p-4 space-y-3 bg-brand-bg">
        {isAdmin && (
            <button
                onClick={() => setIsCreating(true)}
                className="w-full p-4 rounded-xl shadow-md flex items-center justify-center font-bold hover:opacity-90 transition-opacity mb-4"
                style={{ backgroundColor: branding.accentColor, color: ensureAccessibleColor('#FFFFFF', branding.accentColor, '#1F2937') }}
            >
                <PlusIcon className="w-5 h-5 mr-2" />
                Create New Client
            </button>
        )}
        {filteredClients.length === 0 ? (
            <div className="text-center py-10 opacity-50">
                <p>No clients found.</p>
            </div>
        ) : (
            filteredClients.map((client) => (
                <button 
                    key={client.id} 
                    onClick={() => onSelect(client)} 
                    className="w-full bg-white p-3 rounded-xl shadow-sm border border-gray-200 flex items-center hover:border-gray-400 transition-all group"
                >
                    <img src={client.avatarUrl} alt={client.name} className="w-12 h-12 rounded-full mr-4 border border-gray-100 group-hover:border-gray-400" />
                    <div className="flex-grow text-left">
                        <h3 className="font-bold text-gray-900 text-lg">{client.name}</h3>
                        <p className="text-xs text-gray-500">{client.source === 'square' ? 'Source: Square' : 'Last seen: 2 weeks ago'}</p>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-gray-200 transition-colors">
                        <PlusIcon className="w-5 h-5" />
                    </div>
                </button>
            ))
        )}
      </div>

      <div className="p-4 mt-auto bg-white border-t border-gray-200">
        <button onClick={onBack} className="w-full bg-gray-100 text-gray-600 font-bold py-3 px-4 rounded-full hover:bg-gray-200">
          Cancel
        </button>
      </div>
    </div>
  );
};

export default SelectClientStep;
