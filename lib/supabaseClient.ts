import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = "https://flbbfwlyaunxjnvjqoek.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsYmJmd2x5YXVueGpvdmpxb2VrbSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzEzNTk0Mzg0LCJleHAiOjIwMjkxNzAzODR9.8_z_z_z_z_z_z_z_z_z_z_z_z_z_z_z_z_z_z_z_z_z_z";

const isValidUrl = (url: string) => {
  return url && (url.startsWith('http://') || url.startsWith('https://'));
};

let supabaseInstance: SupabaseClient | null = null;

export const getSupabase = (): SupabaseClient => {
  if (!supabaseInstance) {
    if (!isValidUrl(supabaseUrl) || !supabaseAnonKey) {
      throw new Error('Supabase configuration is missing or invalid. Please set VITE_SUPABASE_URL (must start with http/https) and VITE_SUPABASE_ANON_KEY in your environment.');
    }
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
  }
  return supabaseInstance;
};
