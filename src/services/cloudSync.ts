import { Match, ConnectedProfile } from '../types/match';
import { getSupabaseClient, isSupabaseConfigured, getSupabaseAnonKey } from './supabaseClient';
import { migrateMatchData } from './storage';

export interface CloudFetchResult {
  found: boolean;
  matches: Match[];
  updatedAt?: string;
  personaName?: string;
  avatarUrl?: string;
  error?: string;
}

export interface CloudSyncState {
  isConfigured: boolean;
  isSyncing: boolean;
  lastSyncedAt: number | null;
  lastError: string | null;
}

let syncState: CloudSyncState = {
  isConfigured: isSupabaseConfigured(),
  isSyncing: false,
  lastSyncedAt: null,
  lastError: null,
};

const listeners = new Set<(state: CloudSyncState) => void>();

function notifyState(): void {
  syncState = { ...syncState, isConfigured: isSupabaseConfigured() };
  listeners.forEach((listener) => listener(syncState));
}

export function subscribeToCloudSync(callback: (state: CloudSyncState) => void): () => void {
  listeners.add(callback);
  callback(syncState);
  return () => {
    listeners.delete(callback);
  };
}

export function getCloudSyncState(): CloudSyncState {
  return { ...syncState, isConfigured: isSupabaseConfigured() };
}

function isSecretKey(key?: string): boolean {
  return Boolean(key && key.startsWith('sb_secret_'));
}

async function fetchViaProxy(accountId: number): Promise<CloudFetchResult> {
  const endpoints = [
    `/api/cloud/fetch?account_id=${accountId}`,
    `http://localhost:1420/api/cloud/fetch?account_id=${accountId}`,
  ];

  for (const ep of endpoints) {
    try {
      const res = await fetch(ep);
      if (res.ok) {
        const data = await res.json();
        if (data.found) {
          const { matches } = migrateMatchData(data.matches);
          return {
            found: true,
            matches,
            updatedAt: data.updatedAt,
            personaName: data.personaName,
            avatarUrl: data.avatarUrl,
          };
        }
        return { found: false, matches: [] };
      }
    } catch {}
  }
  return { found: false, matches: [], error: 'Proxy fetch endpoint unreachable' };
}

async function pushViaProxy(
  accountId: number,
  matches: Match[],
  profile?: ConnectedProfile | null
): Promise<{ success: boolean; error?: string }> {
  const endpoints = ['/api/cloud/push', 'http://localhost:1420/api/cloud/push'];
  const payload = {
    account_id: accountId,
    matches,
    persona_name: profile?.personaName,
    avatar_url: profile?.avatarUrl,
  };

  for (const ep of endpoints) {
    try {
      const res = await fetch(ep, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        return { success: true };
      }
      const data = await res.json().catch(() => null);
      if (data?.error) {
        return { success: false, error: data.error };
      }
    } catch {}
  }
  return { success: false, error: 'Proxy push endpoint unreachable' };
}

/**
 * Reads match history from Supabase for a given Steam account ID.
 * Returns found: false if the account has no entry in Supabase or if unconfigured/offline.
 */
export async function fetchCloudMatchHistory(accountId: number): Promise<CloudFetchResult> {
  if (!isSupabaseConfigured()) {
    return { found: false, matches: [] };
  }

  syncState.isSyncing = true;
  notifyState();

  const key = getSupabaseAnonKey();
  if (isSecretKey(key)) {
    const proxyRes = await fetchViaProxy(accountId);
    syncState.isSyncing = false;
    if (proxyRes.found) {
      syncState.lastSyncedAt = Date.now();
      syncState.lastError = null;
    } else if (proxyRes.error) {
      syncState.lastError = proxyRes.error;
    }
    notifyState();
    return proxyRes;
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    syncState.isSyncing = false;
    notifyState();
    return { found: false, matches: [] };
  }

  try {
    const { data, error } = await supabase
      .from('match_histories')
      .select('matches, version, updated_at, persona_name, avatar_url')
      .eq('account_id', accountId)
      .maybeSingle();

    if (error) {
      const isSecretError =
        error.message?.toLowerCase().includes('secret api') ||
        error.message?.toLowerCase().includes('forbidden') ||
        error.code === '401' ||
        error.code === '403';

      if (isSecretError) {
        const proxyRes = await fetchViaProxy(accountId);
        syncState.isSyncing = false;
        if (proxyRes.found) {
          syncState.lastSyncedAt = Date.now();
          syncState.lastError = null;
        } else if (proxyRes.error) {
          syncState.lastError = proxyRes.error;
        }
        notifyState();
        return proxyRes;
      }

      console.warn('Supabase fetch error for account', accountId, error.message);
      syncState.isSyncing = false;
      syncState.lastError = error.message;
      notifyState();
      return { found: false, matches: [], error: error.message };
    }

    syncState.isSyncing = false;
    if (!data) {
      syncState.lastError = null;
      notifyState();
      return { found: false, matches: [] };
    }

    const { matches } = migrateMatchData(data.matches);
    syncState.lastSyncedAt = Date.now();
    syncState.lastError = null;
    notifyState();

    return {
      found: true,
      matches,
      updatedAt: data.updated_at,
      personaName: data.persona_name || undefined,
      avatarUrl: data.avatar_url || undefined,
    };
  } catch (err: any) {
    const proxyRes = await fetchViaProxy(accountId);
    syncState.isSyncing = false;
    if (proxyRes.found) {
      syncState.lastSyncedAt = Date.now();
      syncState.lastError = null;
      notifyState();
      return proxyRes;
    }

    syncState.lastError = err?.message || 'Network error';
    notifyState();
    return { found: false, matches: [], error: syncState.lastError || undefined };
  }
}

/**
 * Pushes or upserts match history into Supabase for a given Steam account ID.
 */
export async function pushCloudMatchHistory(
  accountId: number,
  matches: Match[],
  profile?: ConnectedProfile | null
): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return false;
  }

  syncState.isSyncing = true;
  notifyState();

  const key = getSupabaseAnonKey();
  if (isSecretKey(key)) {
    const proxyRes = await pushViaProxy(accountId, matches, profile);
    syncState.isSyncing = false;
    if (proxyRes.success) {
      syncState.lastSyncedAt = Date.now();
      syncState.lastError = null;
      notifyState();
      return true;
    }
    syncState.lastError = proxyRes.error || 'Proxy push failed';
    notifyState();
    return false;
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    syncState.isSyncing = false;
    notifyState();
    return false;
  }

  try {
    const payload: Record<string, unknown> = {
      account_id: accountId,
      version: 2,
      updated_at: new Date().toISOString(),
      matches,
    };

    if (profile?.personaName) payload.persona_name = profile.personaName;
    if (profile?.avatarUrl) payload.avatar_url = profile.avatarUrl;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session?.user?.id) {
        payload.user_id = sessionData.session.user.id;
      }
    } catch {}

    const { error } = await supabase
      .from('match_histories')
      .upsert(payload, { onConflict: 'account_id' });

    if (error) {
      const isFallbackNeeded =
        error.message?.toLowerCase().includes('secret api') ||
        error.message?.toLowerCase().includes('forbidden') ||
        error.message?.toLowerCase().includes('row-level security') ||
        error.message?.toLowerCase().includes('violates') ||
        error.code === '401' ||
        error.code === '403' ||
        error.code === '42501';

      if (isFallbackNeeded) {
        const proxyRes = await pushViaProxy(accountId, matches, profile);
        syncState.isSyncing = false;
        if (proxyRes.success) {
          syncState.lastSyncedAt = Date.now();
          syncState.lastError = null;
          notifyState();
          return true;
        }
        syncState.lastError = proxyRes.error || 'Proxy push failed';
        notifyState();
        return false;
      }

      console.error('Supabase upsert failed:', error.message);
      syncState.isSyncing = false;
      syncState.lastError = error.message;
      notifyState();
      return false;
    }

    syncState.isSyncing = false;
    syncState.lastSyncedAt = Date.now();
    syncState.lastError = null;
    notifyState();
    return true;
  } catch (err: any) {
    const proxyRes = await pushViaProxy(accountId, matches, profile);
    syncState.isSyncing = false;
    if (proxyRes.success) {
      syncState.lastSyncedAt = Date.now();
      syncState.lastError = null;
      notifyState();
      return true;
    }

    syncState.lastError = err?.message || 'Network error';
    notifyState();
    return false;
  }
}
