import { createClient } from '@supabase/supabase-js';

//  DO NOT hardcode credentials
//  Supabase credentials must come ONLY from build-time env vars

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase environment variables are missing. ' +
    'Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  );
}

//  SINGLETON — created exactly once
export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true, // REQUIRED for OAuth redirects
    },
  }
);
