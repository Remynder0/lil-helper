import { invoke } from '@tauri-apps/api/core';
import { Match, ConnectedProfile } from '../types/match';
import type { UserSettings } from './userSettings';

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

function resolveAccountId(accountId?: number | null): number | null {
  return accountId !== undefined ? accountId : activeAccountId;
}

function getLocalStorageKey(accountId?: number | null): string {
  const targetId = resolveAccountId(accountId);
  return targetId ? `${LOCAL_STORAGE_KEY}_${targetId}` : LOCAL_STORAGE_KEY;
}

function isTauriEnvironment(): boolean {
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

export async function fetchAllMatches(accountId?: number | null): Promise<Match[]> {
  const targetAccountId = resolveAccountId(accountId);

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

export async function persistMatch(match: Match, accountId?: number | null): Promise<Match> {
  const targetAccountId = resolveAccountId(accountId);

  if (isTauriEnvironment()) {
    try {
      return await invoke<Match>('save_match', {
        matchRecord: match,
        accountId: targetAccountId ?? null,
      });
    } catch (err) {
      console.error('Tauri save_match failed, falling back to localStorage:', err);
    }
  }

  // Browser fallback
  const matches = await fetchAllMatches(targetAccountId);
  const existingIdx = matches.findIndex((m) => m.id === match.id);
  if (existingIdx >= 0) {
    matches[existingIdx] = match;
  } else {
    matches.unshift(match);
  }

  localStorage.setItem(getLocalStorageKey(targetAccountId), serializeVersionedStorage(matches));
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
      return newMatches;
    } catch (err) {
      console.error('Tauri import_matches in persistMatches failed, falling back:', err);
    }
  }

  const current = await fetchAllMatches(targetAccountId);
  for (const item of newMatches) {
    const idx = current.findIndex((m) => m.id === item.id);
    if (idx >= 0) {
      current[idx] = item;
    } else {
      current.unshift(item);
    }
  }
  localStorage.setItem(getLocalStorageKey(targetAccountId), serializeVersionedStorage(current));
  return newMatches;
}

export async function removeMatch(id: string, accountId?: number | null): Promise<boolean> {
  const targetAccountId = resolveAccountId(accountId);

  if (isTauriEnvironment()) {
    try {
      return await invoke<boolean>('delete_match', {
        id,
        accountId: targetAccountId ?? null,
      });
    } catch (err) {
      console.error('Tauri delete_match failed, falling back to localStorage:', err);
    }
  }

  // Browser fallback
  const matches = await fetchAllMatches(targetAccountId);
  const filtered = matches.filter((m) => m.id !== id);
  const changed = filtered.length !== matches.length;
  if (changed) {
    localStorage.setItem(getLocalStorageKey(targetAccountId), serializeVersionedStorage(filtered));
  }
  return changed;
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
      return await invoke<number>('import_matches', {
        jsonData: JSON.stringify(importedMatches),
        accountId: targetAccountId ?? null,
      });
    } catch (err) {
      console.error('Tauri import_matches failed:', err);
    }
  }

  const current = await fetchAllMatches(targetAccountId);
  for (const item of importedMatches) {
    const idx = current.findIndex((m) => m.id === item.id);
    if (idx >= 0) {
      current[idx] = item;
    } else {
      current.push(item);
    }
  }

  localStorage.setItem(getLocalStorageKey(targetAccountId), serializeVersionedStorage(current));
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
