import { createClient } from '@supabase/supabase-js';

console.log('DEBUG import.meta.env:', import.meta.env);
console.log('DEBUG SUPABASE URL:', import.meta.env?.VITE_SUPABASE_URL);
console.log('DEBUG SUPABASE ANON:', import.meta.env?.VITE_SUPABASE_ANON_KEY);

const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase environment variables are missing. ' +
    'Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
