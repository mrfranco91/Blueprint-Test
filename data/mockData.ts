import type { Service, MembershipTier, StylistLevel } from '../types';

export const STYLIST_LEVELS: StylistLevel[] = [
    { id: 'lvl_1', name: 'Junior Stylist', color: 'bg-blue-100 text-blue-800', order: 1 },
    { id: 'lvl_2', name: 'Senior Stylist', color: 'bg-purple-100 text-purple-800', order: 2 },
    { id: 'lvl_3', name: 'Master Stylist', color: 'bg-amber-100 text-amber-800', order: 3 },
];

// Empty by default - services should be synced from Square
// Plans should only be created with real Square services, not mock data
export const ALL_SERVICES: Service[] = [];

export const MEMBERSHIP_TIERS: MembershipTier[] = [
    { id: 't1', name: 'Silver Member', minSpend: 0, perks: ['Access to Booking App', 'Birthday Discount'], color: '#9CA3AF' },
    { id: 't2', name: 'Gold Member', minSpend: 150, perks: ['10% Off Retail', 'Priority Holiday Booking', 'Free Bang Trims'], color: '#FBBF24' },
    { id: 't3', name: 'Platinum Member', minSpend: 300, perks: ['20% Off Retail', '1 Free Treatment / Month', 'Complimentary Blowouts'], color: '#E5E7EB' },
];

export const TODAY_APPOINTMENTS = [
    { id: 'a1', time: '09:00 AM', clientName: 'Emma Thompson', service: 'Full Highlight', status: 'completed' },
    { id: 'a2', time: '12:30 PM', clientName: 'Sophia Martinez', service: 'Haircut', status: 'in-progress' },
    { id: 'a3', time: '02:00 PM', clientName: 'Ava Johnson', service: 'Keratin Treatment', status: 'upcoming' },
    { id: 'a4', time: '04:30 PM', clientName: 'Olivia Wilson', service: 'Consultation', status: 'upcoming' },
];

export const SERVICE_COLORS: { [key: string]: string } = {
    'Haircut': '#8884d8',
    'Full Highlight': '#82ca9d',
    'Keratin': '#ffc658',
    'Moisture': '#ff8042',
    'Clarify': '#00C49F',
    'Root Touch Up': '#0088FE',
    'Partial Highlight': '#FFBB28',
    'Add Tone': '#FF8042',
    'Repair': '#A4DE6C',
    'Extensions': '#d0ed57'
};
