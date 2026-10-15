import { createClient, SupabaseClient } from '@supabase/supabase-js';

const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL as string | undefined;
const envAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string | undefined;

const DEFAULT_SUPABASE_URL = 'https://jijasfcnswuokpihprch.supabase.co';
const DEFAULT_SUPABASE_KEY = 'sb_publishable_Ju7d4NDj7pR-uMIme60Acg_-YOknhTj';

let cachedClient: SupabaseClient | null = null;
let runtimeOverride: { url?: string | null; key?: string | null } | null = null;

/**
 * Returns whether Supabase URL and anon key are properly provided.
 */
export function isSupabaseConfigured(): boolean {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  return Boolean(url && key && url.startsWith('http') && !url.includes('your-project'));
}

export function getSupabaseUrl(): string | undefined {
  if (runtimeOverride !== null) {
    return runtimeOverride.url || undefined;
  }
  if (envUrl && envUrl.trim().length > 0) return envUrl.trim();
  try {
    const local = localStorage.getItem('deadlock_supabase_url');
    if (local && local.trim().length > 0) return local.trim();
  } catch {}
  return DEFAULT_SUPABASE_URL;
}

export function getSupabaseAnonKey(): string | undefined {
  if (runtimeOverride !== null) {
    return runtimeOverride.key || undefined;
  }
  if (envAnonKey && envAnonKey.trim().length > 0) return envAnonKey.trim();
  try {
    const local = localStorage.getItem('deadlock_supabase_anon_key');
    if (local && local.trim().length > 0) return local.trim();
  } catch {}
  return DEFAULT_SUPABASE_KEY;
}

/**
 * Retrieves the Supabase client instance, or null if unconfigured.
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (cachedClient) {
    return cachedClient;
  }

  const url = getSupabaseUrl()!;
  const key = getSupabaseAnonKey()!;

  try {
    cachedClient = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
    return cachedClient;
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
    return null;
  }
}

/**
 * Allows updating or resetting credentials at runtime.
 * Pass null or empty strings to explicitly disable Supabase (e.g. for unit tests or offline testing).
 * Pass undefined without arguments to clear override and reload environment variables.
 */
export function configureSupabase(url?: string | null, anonKey?: string | null): boolean {
  if (url === undefined && anonKey === undefined) {
    runtimeOverride = null;
    localStorage.removeItem('deadlock_supabase_url');
    localStorage.removeItem('deadlock_supabase_anon_key');
  } else if (!url || !anonKey || url.trim() === '' || anonKey.trim() === '') {
    runtimeOverride = { url: null, key: null };
  } else {
    runtimeOverride = { url: url.trim(), key: anonKey.trim() };
    localStorage.setItem('deadlock_supabase_url', url.trim());
    localStorage.setItem('deadlock_supabase_anon_key', anonKey.trim());
  }
  cachedClient = null;
  return isSupabaseConfigured();
}

/**
 * Resets any runtime override and restores original environment variables.
 */
export function resetSupabaseConfig(): void {
  runtimeOverride = null;
  cachedClient = null;
}

/**
 * Asynchronously initializes Supabase config if not already loaded from environment variables.
 * In dev or Tauri mode, checks /api/config/supabase to retrieve .env credentials live.
 */
export async function initializeSupabaseConfig(): Promise<boolean> {
  if (isSupabaseConfigured() || runtimeOverride !== null) return isSupabaseConfigured();

  try {
    const res = await fetch('/api/config/supabase');
    if (res.ok) {
      const data = await res.json();
      if (data.url && data.key) {
        configureSupabase(data.url, data.key);
        return isSupabaseConfigured();
      }
    }
  } catch {}

  try {
    const res = await fetch('http://localhost:1420/api/config/supabase');
    if (res.ok) {
      const data = await res.json();
      if (data.url && data.key) {
        configureSupabase(data.url, data.key);
        return isSupabaseConfigured();
      }
    }
  } catch {}

  return isSupabaseConfigured();
}
