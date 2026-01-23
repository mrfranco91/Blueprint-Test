
import type { Service, Client, HistoricalData, MembershipTier, StylistLevel } from '../types';

export const STYLIST_LEVELS: StylistLevel[] = [
    { id: 'lvl_1', name: 'Junior Stylist', color: 'bg-blue-100 text-blue-800', order: 1 },
    { id: 'lvl_2', name: 'Senior Stylist', color: 'bg-purple-100 text-purple-800', order: 2 },
    { id: 'lvl_3', name: 'Master Stylist', color: 'bg-amber-100 text-amber-800', order: 3 },
];

export const ALL_SERVICES: Service[] = [
  { id: 's1', name: 'Haircut', category: 'Styling', cost: 100, duration: 60, tierPrices: { 'lvl_1': 80, 'lvl_2': 100, 'lvl_3': 120 } },
  { id: 's2', name: 'Root Touch Up', category: 'Color', cost: 120, duration: 90, tierPrices: { 'lvl_1': 100, 'lvl_2': 120, 'lvl_3': 140 } },
  { id: 's3', name: 'Partial Highlight', category: 'Color', cost: 180, duration: 120, tierPrices: { 'lvl_1': 150, 'lvl_2': 180, 'lvl_3': 210 } },
  { id: 's4', name: 'Full Highlight', category: 'Color', cost: 250, duration: 180, tierPrices: { 'lvl_1': 200, 'lvl_2': 250, 'lvl_3': 300 } },
  { id: 's5', name: 'Keratin', category: 'Treatment', cost: 300, duration: 150 },
  { id: 's6', name: 'Add Tone', category: 'Color', cost: 50, duration: 30 },
  { id: 's7', name: 'Moisture', category: 'Treatment', cost: 40, duration: 30 },
  { id: 's8', name: 'Repair', category: 'Treatment', cost: 45, duration: 30 },
  { id: 's9', name: 'Clarify', category: 'Treatment', cost: 35, duration: 20 },
  { id: 's10', name: 'Extensions', category: 'Styling', cost: 500, duration: 240 },
];

export const MEMBERSHIP_TIERS: MembershipTier[] = [
    { id: 't1', name: 'Silver Member', minSpend: 0, perks: ['Access to Booking App', 'Birthday Discount'], color: '#9CA3AF' },
    { id: 't2', name: 'Gold Member', minSpend: 150, perks: ['10% Off Retail', 'Priority Holiday Booking', 'Free Bang Trims'], color: '#FBBF24' },
    { id: 't3', name: 'Platinum Member', minSpend: 300, perks: ['20% Off Retail', '1 Free Treatment / Month', 'Complimentary Blowouts'], color: '#E5E7EB' },
];

const clientHistoricalData: HistoricalData[] = [
    { month: 'Apr', cost: 280 },
    { month: 'May', cost: 100 },
    { month: 'Jun', cost: 0 },
    { month: 'Jul', cost: 430 },
    { month: 'Aug', cost: 100 },
    { month: 'Sep', cost: 220 },
    { month: 'Oct', cost: 100 },
    { month: 'Nov', cost: 0 },
    { month: 'Dec', cost: 550 },
    { month: 'Jan', cost: 100 },
    { month: 'Feb', cost: 300 },
    { month: 'Mar', cost: 100 },
];

const nextAppt = new Date();
nextAppt.setDate(nextAppt.getDate() + 14); // Next appointment in 2 weeks

const lastAppt = new Date();
lastAppt.setDate(lastAppt.getDate() - 28); // Last appointment 4 weeks ago

export const CURRENT_CLIENT: Client = {
  id: 'c1',
  name: 'Olivia Wilson',
  email: 'olivia.wilson@example.com',
  phone: '555-0123',
  avatarUrl: 'https://picsum.photos/id/237/200/200',
  historicalData: clientHistoricalData,
  nextAppointmentDate: nextAppt,
  lastAppointmentDate: lastAppt,
};

export const MOCK_CLIENTS: Client[] = [
    CURRENT_CLIENT,
    { ...CURRENT_CLIENT, id: 'c2', name: 'Emma Thompson', email: 'emma.t@example.com', phone: '555-0124', avatarUrl: 'https://picsum.photos/id/64/200/200' },
    { ...CURRENT_CLIENT, id: 'c3', name: 'Sophia Martinez', email: 'sophia.m@example.com', phone: '555-0125', avatarUrl: 'https://picsum.photos/id/65/200/200' },
    { ...CURRENT_CLIENT, id: 'c4', name: 'Ava Johnson', email: 'ava.j@example.com', phone: '555-0126', avatarUrl: 'https://picsum.photos/id/91/200/200' },
    { ...CURRENT_CLIENT, id: 'c5', name: 'Isabella Davis', email: 'isabella.d@example.com', phone: '555-0127', avatarUrl: 'https://picsum.photos/id/177/200/200' },
    { ...CURRENT_CLIENT, id: 'c6', name: 'Mia Brown', email: 'mia.b@example.com', phone: '555-0128', avatarUrl: 'https://picsum.photos/id/342/200/200' },
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