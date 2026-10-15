import { invoke } from '@tauri-apps/api/core';
import { Match, ConnectedProfile } from '../types/match';
import type { UserSettings } from './userSettings';
import { fetchCloudMatchHistory, pushCloudMatchHistory, getCloudSyncState } from './cloudSync';
import { isSupabaseConfigured, initializeSupabaseConfig } from './supabaseClient';

export const CURRENT_STORAGE_SCHEMA_VERSION = 2;
const LOCAL_STORAGE_KEY = 'deadlock_matches_v1';
const SETTINGS_STORAGE_KEY = 'deadlock_app_settings_v1';

export interface VersionedMatchStorage {
  version: number;
  updatedAt: string;
  matches: Match[];
}

export interface AppSettingsPayload {
  activeAccountId?: number | null;
  profile?: ConnectedProfile | null;
  settings?: UserSettings;
  customLogPath?: string | null;
  lastApiRefreshTimestamp?: number | null;
  [key: string]: unknown;
}

let activeAccountId: number | null = null;

export function setActiveStorageAccountId(accountId: number | null | undefined): void {
  activeAccountId = accountId ?? null;
}

export function getActiveStorageAccountId(): number | null {
  return activeAccountId;
}

function getSavedProfile(): ConnectedProfile | null {
  try {
    const raw = localStorage.getItem('deadlock_connected_profile') || localStorage.getItem('deadlock_app_settings_v1');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.personaName && parsed.accountId) return parsed as ConnectedProfile;
      if (parsed.profile?.personaName && parsed.profile?.accountId) return parsed.profile as ConnectedProfile;
    }
  } catch {}
  return null;
}

function resolveAccountId(accountId?: number | null): number | null {
  if (accountId !== undefined && accountId !== null) return accountId;
  if (activeAccountId !== null) return activeAccountId;
  const profile = getSavedProfile();
  if (profile?.accountId) return profile.accountId;
  return null;
}

function getLocalStorageKey(accountId?: number | null): string {
  const targetId = resolveAccountId(accountId);
  return targetId ? `${LOCAL_STORAGE_KEY}_${targetId}` : LOCAL_STORAGE_KEY;
}

export function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/**
 * Safely normalizes and validates matches across schema evolutions.
 */
function sanitizeMatches(records: unknown[]): Match[] {
  return records
    .filter((r): r is Match => typeof r === 'object' && r !== null && 'id' in r && 'result' in r)
    .map((r) => ({
      ...r,
      rankedProgress: typeof r.rankedProgress === 'number' ? r.rankedProgress : null,
      rankedDemotionProtection: typeof r.rankedDemotionProtection === 'number' ? r.rankedDemotionProtection : null,
      rankedRank: typeof r.rankedRank === 'number' ? r.rankedRank : null,
      rankedSubrank: typeof r.rankedSubrank === 'number' ? r.rankedSubrank : null,
      lane: r.lane ?? undefined,
      laneOutcome: r.laneOutcome ?? undefined,
      laneAllyId: r.laneAllyId ?? undefined,
      laneOpponents: Array.isArray(r.laneOpponents) ? r.laneOpponents : undefined,
    }));
}

/**
 * Migrates arbitrary storage or import JSON data into current schema.
 * Supports:
 * - Legacy format (v1): [ MatchRecord, ... ]
 * - Versioned format (v2+): { version: 2, matches: [ ... ], updatedAt: string }
 */
export function migrateMatchData(rawData: unknown): { version: number; matches: Match[] } {
  if (!rawData) {
    return { version: CURRENT_STORAGE_SCHEMA_VERSION, matches: [] };
  }

  // Legacy format: raw Array
  if (Array.isArray(rawData)) {
    return {
      version: CURRENT_STORAGE_SCHEMA_VERSION,
      matches: sanitizeMatches(rawData),
    };
  }

  // Versioned format
  if (typeof rawData === 'object' && rawData !== null && 'matches' in rawData) {
    const container = rawData as { version?: number; matches?: unknown[] };
    const rawMatches = Array.isArray(container.matches) ? container.matches : [];
    return {
      version: CURRENT_STORAGE_SCHEMA_VERSION,
      matches: sanitizeMatches(rawMatches),
    };
  }

  return { version: CURRENT_STORAGE_SCHEMA_VERSION, matches: [] };
}

function serializeVersionedStorage(matches: Match[]): string {
  const container: VersionedMatchStorage = {
    version: CURRENT_STORAGE_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    matches,
  };
  return JSON.stringify(container);
}

export async function fetchLocalMatches(targetAccountId: number | null): Promise<Match[]> {
  if (isTauriEnvironment()) {
    try {
      const data = await invoke<unknown>('get_matches', { accountId: targetAccountId ?? null });
      const { matches } = migrateMatchData(data);
      return matches;
    } catch (err) {
      console.error('Tauri get_matches failed, falling back to localStorage:', err);
    }
  }

  // Browser fallback
  try {
    const key = getLocalStorageKey(targetAccountId);
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const { matches } = migrateMatchData(parsed);
    return matches;
  } catch (err) {
    console.error('Failed to read from localStorage:', err);
    return [];
  }
}

export async function writeLocalMatchesCache(targetAccountId: number | null, matches: Match[]): Promise<void> {
  if (isTauriEnvironment()) {
    try {
      await invoke<number>('import_matches', {
        jsonData: JSON.stringify(matches),
        accountId: targetAccountId ?? null,
      });
      return;
    } catch (err) {
      console.error('Failed to update local cache in Tauri:', err);
    }
  }
  localStorage.setItem(getLocalStorageKey(targetAccountId), serializeVersionedStorage(matches));
}

/**
 * Retrieves all matches for an account.
 * Prioritizes Supabase Cloud if configured, updates local cache,
 * and falls back to local storage (Tauri JSON or browser localStorage) seamlessly.
 */
export async function fetchAllMatches(accountId?: number | null): Promise<Match[]> {
  const targetAccountId = resolveAccountId(accountId);

  // Guest mode strictly uses local storage
  if (!targetAccountId) {
    return await fetchLocalMatches(null);
  }

  // Priority: Check Supabase Cloud if credentials exist
  if (isSupabaseConfigured()) {
    try {
      const cloud = await fetchCloudMatchHistory(targetAccountId);
      if (cloud.found) {
        // Cache locally for offline availability
        writeLocalMatchesCache(targetAccountId, cloud.matches).catch(console.error);
        return cloud.matches;
      }

      // First time on Cloud: check if local disk has matches to push
      const localMatches = await fetchLocalMatches(targetAccountId);
      if (localMatches.length > 0) {
        pushCloudMatchHistory(targetAccountId, localMatches).catch(console.error);
      } else {
        pushCloudMatchHistory(targetAccountId, []).catch(console.error);
      }
      return localMatches;
    } catch (err) {
      console.warn('Cloud sync unavailable, falling back to local storage:', err);
    }
  }

  // Fallback to local storage
  return await fetchLocalMatches(targetAccountId);
}

export async function persistMatch(match: Match, accountId?: number | null): Promise<Match> {
  const targetAccountId = resolveAccountId(accountId);

  if (isTauriEnvironment()) {
    try {
      await invoke<Match>('save_match', {
        matchRecord: match,
        accountId: targetAccountId ?? null,
      });
    } catch (err) {
      console.error('Tauri save_match failed, falling back to localStorage:', err);
    }
  }

  // Always update browser/local mirror
  const matches = await fetchLocalMatches(targetAccountId);
  const existingIdx = matches.findIndex((m) => m.id === match.id);
  let updatedList: Match[];
  if (existingIdx >= 0) {
    updatedList = [...matches];
    updatedList[existingIdx] = match;
  } else {
    updatedList = [match, ...matches];
  }

  localStorage.setItem(getLocalStorageKey(targetAccountId), serializeVersionedStorage(updatedList));

  // If cloud is configured and user is connected, push to Supabase in background
  if (targetAccountId && isSupabaseConfigured()) {
    const profile = getSavedProfile();
    pushCloudMatchHistory(targetAccountId, updatedList, profile).catch((err) => {
      console.warn('Failed to push match to Supabase Cloud:', err);
    });
  }

  return match;
}

export async function persistMatches(newMatches: Match[], accountId?: number | null): Promise<Match[]> {
  if (newMatches.length === 0) return [];
  const targetAccountId = resolveAccountId(accountId);

  if (isTauriEnvironment()) {
    try {
      await invoke<number>('import_matches', {
        jsonData: JSON.stringify(newMatches),
        accountId: targetAccountId ?? null,
      });
    } catch (err) {
      console.error('Tauri import_matches in persistMatches failed, falling back:', err);
    }
  }

  const current = await fetchLocalMatches(targetAccountId);
  for (const item of newMatches) {
    const idx = current.findIndex((m) => m.id === item.id);
    if (idx >= 0) {
      current[idx] = item;
    } else {
      current.unshift(item);
    }
  }
  localStorage.setItem(getLocalStorageKey(targetAccountId), serializeVersionedStorage(current));

  // If cloud is configured, push to Supabase in background
  if (targetAccountId && isSupabaseConfigured()) {
    const profile = getSavedProfile();
    pushCloudMatchHistory(targetAccountId, current, profile).catch((err) => {
      console.warn('Failed to push matches to Supabase Cloud:', err);
    });
  }

  return newMatches;
}

export async function removeMatch(id: string, accountId?: number | null): Promise<boolean> {
  const targetAccountId = resolveAccountId(accountId);
  let wasDeleted = false;

  if (isTauriEnvironment()) {
    try {
      wasDeleted = await invoke<boolean>('delete_match', {
        id,
        accountId: targetAccountId ?? null,
      });
    } catch (err) {
      console.error('Tauri delete_match failed, falling back to localStorage:', err);
    }
  }

  // Update browser localStorage mirror
  const key = getLocalStorageKey(targetAccountId);
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      const { matches } = migrateMatchData(parsed);
      const filtered = matches.filter((m) => m.id !== id);
      if (filtered.length !== matches.length) {
        wasDeleted = true;
        localStorage.setItem(key, serializeVersionedStorage(filtered));
      }
    }
  } catch {}

  // If deleted and Supabase is configured, push updated list to Supabase Cloud
  if (wasDeleted && targetAccountId && isSupabaseConfigured()) {
    const current = await fetchLocalMatches(targetAccountId);
    const profile = getSavedProfile();
    pushCloudMatchHistory(targetAccountId, current, profile).catch((err) => {
      console.warn('Failed to push match deletion to Supabase Cloud:', err);
    });
  }

  // Also clean up from tracked pending matches if it was a pending match
  if (id.startsWith('pending_') || id.startsWith('queue_')) {
    const num = parseInt(id.replace(/^(pending_|queue_)/, ''), 10);
    if (!isNaN(num)) {
      removeTrackedPendingMatch(num);
    }
    wasDeleted = true;
  }

  return wasDeleted;
}

export async function exportMatchesJson(accountId?: number | null): Promise<string> {
  const targetAccountId = resolveAccountId(accountId);

  if (isTauriEnvironment()) {
    try {
      return await invoke<string>('export_matches', { accountId: targetAccountId ?? null });
    } catch (err) {
      console.error('Tauri export_matches failed:', err);
    }
  }

  const matches = await fetchAllMatches(targetAccountId);
  return JSON.stringify(
    {
      version: CURRENT_STORAGE_SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
      matches,
    },
    null,
    2
  );
}

export async function importMatchesJson(jsonString: string, accountId?: number | null): Promise<number> {
  const targetAccountId = resolveAccountId(accountId);
  const parsed = JSON.parse(jsonString);
  const { matches: importedMatches } = migrateMatchData(parsed);

  if (importedMatches.length === 0) {
    throw new Error('Import data must contain valid match records.');
  }

  if (isTauriEnvironment()) {
    try {
      await invoke<number>('import_matches', {
        jsonData: JSON.stringify(importedMatches),
        accountId: targetAccountId ?? null,
      });
    } catch (err) {
      console.error('Tauri import_matches failed:', err);
    }
  }

  const current = await fetchLocalMatches(targetAccountId);
  for (const item of importedMatches) {
    const idx = current.findIndex((m) => m.id === item.id);
    if (idx >= 0) {
      current[idx] = item;
    } else {
      current.push(item);
    }
  }

  localStorage.setItem(getLocalStorageKey(targetAccountId), serializeVersionedStorage(current));

  if (targetAccountId && isSupabaseConfigured()) {
    pushCloudMatchHistory(targetAccountId, current).catch(console.error);
  }

  return importedMatches.length;
}

/**
 * Retrieves persisted app settings (Steam profile, preferences, custom log path)
 * from settings.json or localStorage.
 */
export async function fetchAppSettings(): Promise<AppSettingsPayload> {
  let diskData: AppSettingsPayload | null = null;
  if (isTauriEnvironment()) {
    try {
      const data = await invoke<AppSettingsPayload>('get_settings');
      if (data && typeof data === 'object' && Object.keys(data).length > 0) {
        diskData = data;
        return data;
      }
    } catch (err) {
      console.error('Tauri get_settings failed, falling back to localStorage:', err);
    }
  }

  // Check localStorage for unified key
  let localData: AppSettingsPayload | null = null;
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) localData = JSON.parse(raw);
  } catch {}

  if (localData && Object.keys(localData).length > 0) {
    if (isTauriEnvironment()) {
      invoke('save_settings', { settings: localData }).catch(console.error);
    }
    return localData;
  }

  // Migrate legacy separate localStorage keys if unified settings don't exist yet
  try {
    let migratedProfile = null;
    let migratedSettings = null;
    const p = localStorage.getItem('deadlock_steam_profile');
    if (p) migratedProfile = JSON.parse(p);
    const s = localStorage.getItem('deadlock_user_settings');
    if (s) migratedSettings = JSON.parse(s);

    if (migratedProfile || migratedSettings) {
      const payload: AppSettingsPayload = {
        activeAccountId: migratedProfile?.accountId ?? null,
        profile: migratedProfile,
        settings: migratedSettings ?? undefined,
      };
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(payload));
      if (isTauriEnvironment()) {
        invoke('save_settings', { settings: payload }).catch(console.error);
      }
      return payload;
    }
  } catch {}

  const defaultPayload: AppSettingsPayload = {
    activeAccountId: null,
    profile: null,
  };
  if (isTauriEnvironment() && !diskData) {
    invoke('save_settings', { settings: defaultPayload }).catch(console.error);
  }
  return defaultPayload;
}

/**
 * Atomically updates and persists settings to settings.json and localStorage.
 */
export async function saveAppSettings(settings: Partial<AppSettingsPayload>): Promise<AppSettingsPayload> {
  const current = await fetchAppSettings();
  const updated: AppSettingsPayload = { ...current, ...settings };

  if (isTauriEnvironment()) {
    try {
      await invoke('save_settings', { settings: updated });
    } catch (err) {
      console.error('Tauri save_settings failed:', err);
    }
  }

  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export interface TrackedPendingMatch {
  matchId: number;
  detectedAt: number; // Unix timestamp in ms
  heroId?: number | null;
  heroName?: string | null;
  source?: 'log' | 'manual';
}

const PENDING_MATCHES_STORAGE_KEY = 'deadlock_tracked_pending_matches_v1';

export function getTrackedPendingMatches(): TrackedPendingMatch[] {
  try {
    const raw = localStorage.getItem(PENDING_MATCHES_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as TrackedPendingMatch[];
  } catch (err) {
    console.error('Failed to parse tracked pending matches:', err);
    return [];
  }
}

export function saveTrackedPendingMatch(
  matchId: number,
  detectedAt = Date.now(),
  heroId?: number | null,
  heroName?: string | null,
  source?: 'log' | 'manual'
): void {
  const current = getTrackedPendingMatches();
  const existing = current.find((item) => item.matchId === matchId);
  if (existing) {
    let changed = false;
    if (heroId && !existing.heroId) {
      existing.heroId = heroId;
      existing.heroName = heroName;
      changed = true;
    }
    if (detectedAt && existing.detectedAt !== detectedAt) {
      existing.detectedAt = detectedAt;
      changed = true;
    }
    if (source && existing.source !== source) {
      existing.source = source;
      changed = true;
    }
    if (changed) {
      localStorage.setItem(PENDING_MATCHES_STORAGE_KEY, JSON.stringify(current));
    }
    return;
  }
  current.push({ matchId, detectedAt, heroId, heroName, source });
  localStorage.setItem(PENDING_MATCHES_STORAGE_KEY, JSON.stringify(current));
}

export function removeTrackedPendingMatch(matchId: number): void {
  const current = getTrackedPendingMatches();
  const filtered = current.filter((item) => item.matchId !== matchId);
  localStorage.setItem(PENDING_MATCHES_STORAGE_KEY, JSON.stringify(filtered));
}

/**
 * Explicitly synchronizes an account's match history with Supabase Cloud.
 * Merges local and cloud matches bidirectionally and updates both stores.
 */
export async function syncMatchesWithCloud(
  accountId: number,
  profile?: ConnectedProfile | null
): Promise<{ success: boolean; count: number; message: string }> {
  if (!isSupabaseConfigured()) {
    await initializeSupabaseConfig();
  }

  if (!isSupabaseConfigured()) {
    return {
      success: false,
      count: 0,
      message: 'Supabase is not configured. Check your .env file.',
    };
  }

  try {
    const cloud = await fetchCloudMatchHistory(accountId);
    const local = await fetchLocalMatches(accountId);

    const matchMap = new Map<string, Match>();

    if (cloud.found && Array.isArray(cloud.matches)) {
      cloud.matches.forEach((m) => {
        const key = String(m.matchId || m.id);
        matchMap.set(key, m);
      });
    }

    local.forEach((m) => {
      const key = String(m.matchId || m.id);
      matchMap.set(key, m);
    });

    const merged = Array.from(matchMap.values()).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    // Save locally
    await writeLocalMatchesCache(accountId, merged);

    // Push to Supabase Cloud
    const pushed = await pushCloudMatchHistory(accountId, merged, profile);
    if (!pushed) {
      const state = getCloudSyncState();
      return {
        success: false,
        count: merged.length,
        message: state.lastError || 'Could not push matches to Supabase Cloud.',
      };
    }

    return {
      success: true,
      count: merged.length,
      message: `Successfully synced ${merged.length} matches with Supabase Cloud!`,
    };
  } catch (err: any) {
    console.error('Cloud sync error:', err);
    return {
      success: false,
      count: 0,
      message: err?.message || 'Unexpected Cloud Sync error.',
    };
  }
}
