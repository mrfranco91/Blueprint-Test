import { createClient, SupabaseClient } from '@supabase/supabase-js';

// FIX: Cast import.meta to any to resolve TypeScript error in environments where Vite client types are not available.
const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
// FIX: Cast import.meta to any to resolve TypeScript error in environments where Vite client types are not available.
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;

// FIX: Renamed to avoid redeclaring the exported 'supabase' const.
let supabaseInstance: SupabaseClient | null = null;

export const getSupabaseClient = (): SupabaseClient => {
  if (supabaseInstance) return supabaseInstance;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase environment variables are missing');
  }

  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });

  return supabaseInstance;
};

export const supabase = getSupabaseClient();