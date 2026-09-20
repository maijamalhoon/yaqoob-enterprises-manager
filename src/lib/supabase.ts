import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Retrieve keys from environment or runtime localStorage settings
export function getSupabaseConfig(): { url: string; anonKey: string } {
  const envUrl = (import.meta.env.VITE_SUPABASE_URL as string) || '';
  const envKey =
    (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string) ||
    (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ||
    '';

  const storedUrl = typeof window !== 'undefined' ? localStorage.getItem('yaqoob_supabase_url') || '' : '';
  const storedKey = typeof window !== 'undefined' ? localStorage.getItem('yaqoob_supabase_key') || '' : '';

  const url = storedUrl || envUrl;
  const anonKey = storedKey || envKey;

  return { url, anonKey };
}

export function isSupabaseConfigured(): boolean {
  const { url, anonKey } = getSupabaseConfig();
  return Boolean(
    url &&
      anonKey &&
      url.startsWith('https://') &&
      !url.includes('your-project.supabase.co') &&
      !url.includes('your-tenant-id.supabase.co') &&
      !anonKey.includes('sb_secret_') &&
      !anonKey.includes('service_role') &&
      !anonKey.includes('your-anon-key')
  );
}

let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  const { url, anonKey } = getSupabaseConfig();
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (!supabaseInstance) {
    try {
      supabaseInstance = createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      });
    } catch (err) {
      console.warn('Could not initialize Supabase client:', err);
      return null;
    }
  }

  return supabaseInstance;
}

export function updateSupabaseConfig(url: string, anonKey: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('yaqoob_supabase_url', url);
    localStorage.setItem('yaqoob_supabase_key', anonKey);
    supabaseInstance = null; // reset for next getSupabaseClient call
  }
}
