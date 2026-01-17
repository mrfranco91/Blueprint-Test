import { createClient, SupabaseClient } from '@supabase/supabase-js';

// FIX: Use process.env, which is populated by vite.config.js, instead of import.meta.env.
const supabaseUrl = process.env.VITE_SUPABASE_URL;
// FIX: Use process.env, which is populated by vite.config.js, instead of import.meta.env.
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

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