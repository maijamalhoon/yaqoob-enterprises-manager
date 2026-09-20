import { createClient, SupabaseClient } from '@supabase/supabase-js';

export function getSupabaseConfig(): { url: string; anonKey: string } {
  return {
    url: import.meta.env.VITE_SUPABASE_URL as string,
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
  };
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

const { url: supabaseUrl, anonKey: supabaseAnonKey } = getSupabaseConfig();
const supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export function getSupabaseClient(): SupabaseClient {
  return supabaseInstance;
}

export function formatSupabaseError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error || '');
  if (message.toLowerCase().includes('failed to fetch')) {
    return `Cannot reach Supabase at ${supabaseUrl}. Check internet access and project status.`;
  }
  return message || 'Supabase request failed';
}
