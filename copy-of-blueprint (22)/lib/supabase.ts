import { createClient } from '@supabase/supabase-js';

// PERMANENT CREDENTIALS (Hardcoded for persistence)
const DEFAULT_URL = 'https://szsrnzbwtrvsxzasaphs.supabase.co';
const DEFAULT_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6c3JuemJ3dHJ2c3h6YXNhcGhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2MTI3MTQsImV4cCI6MjA4MTE4ODcxNH0.otzF6gnfVkQAJj-Z1lte4ml6tJ5nZQQh2kwLJJOb6aU';

// Helper to get keys from local storage or defaults
export const getSupabaseConfig = () => {
    const localUrl = localStorage.getItem('VITE_SUPABASE_URL');
    const localKey = localStorage.getItem('VITE_SUPABASE_ANON_KEY');
    
    // Prefer local storage if set (allows overriding), otherwise use hardcoded defaults
    return { 
        url: localUrl || DEFAULT_URL, 
        key: localKey || DEFAULT_KEY 
    };
};

export const saveSupabaseConfig = (url: string, key: string) => {
    const cleanUrl = url ? url.trim() : '';
    const cleanKey = key ? key.trim() : '';

    localStorage.setItem('VITE_SUPABASE_URL', cleanUrl);
    localStorage.setItem('VITE_SUPABASE_ANON_KEY', cleanKey);
    
    // Simple reload to pick up new config
    window.location.reload();
};

export const clearSupabaseConfig = () => {
    localStorage.removeItem('VITE_SUPABASE_URL');
    localStorage.removeItem('VITE_SUPABASE_ANON_KEY');
    window.location.reload();
};

// Initialize the client
const { url, key } = getSupabaseConfig();

let supabaseInstance = null;

if (url && key) {
    try {
        supabaseInstance = createClient(url, key);
    } catch (e) {
        console.error("Failed to initialize Supabase client:", e);
        // Leaving instance as null will trigger SetupScreen
    }
}

export const supabase = supabaseInstance;