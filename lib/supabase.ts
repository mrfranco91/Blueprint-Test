import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Cast `import.meta` to `any` to prevent TypeScript errors if Vite types aren't loaded.
const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;

// Use a singleton pattern to ensure only one Supabase client instance is created.
let supabaseInstance: SupabaseClient | null = null;

export const getSupabaseClient = (): SupabaseClient => {
  // If an instance already exists, return it to avoid re-initialization.
  if (supabaseInstance) return supabaseInstance;

  // Validate that the required environment variables are present.
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase environment variables are missing. Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.');
  }

  // Create the client with specific auth configuration.
  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });

  return supabaseInstance;
};

// Export the initialized Supabase client directly for easy import elsewhere.
export const supabase = getSupabaseClient();

// Log the Supabase project URL for debugging
console.log('Supabase URL:', supabaseUrl);
