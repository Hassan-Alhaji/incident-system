
import { createClient } from '@supabase/supabase-js';

// Access environment variables securely
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('⚠️ Supabase URL or Key is missing! Check your .env file or Vercel Settings.');
}

// Prevent crash if keys are missing (returns a dummy client usually, or we handle it)
// We cast to string to satisfy TS, but we know it might fail at runtime if invalid.
// Better: Check if valid URL.
const isValidUrl = (url: string) => {
    try { return Boolean(new URL(url)); } catch (e) { return false; }
};

export const supabase = (supabaseUrl && isValidUrl(supabaseUrl) && supabaseAnonKey)
    ? createClient(supabaseUrl, supabaseAnonKey)
    : createClient('https://placeholder.supabase.co', 'placeholder'); // Fallback to prevent crash
