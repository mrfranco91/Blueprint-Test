import { createClient } from '@supabase/supabase-js';

// Supabase credentials must come ONLY from build-time env vars
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase environment variables are missing. ' +
    'Check SUPABASE_URL and SUPABASE_ANON_KEY.'
  );
}

// SINGLETON — created exactly once
export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false, // Square OAuth is removed.
    },
  }
);
