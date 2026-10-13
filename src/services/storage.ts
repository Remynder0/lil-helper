import { invoke } from '@tauri-apps/api/core';
import { Match } from '../types/match';

export const CURRENT_STORAGE_SCHEMA_VERSION = 2;
const LOCAL_STORAGE_KEY = 'deadlock_matches_v1';

export interface VersionedMatchStorage {
  version: number;
  updatedAt: string;
  matches: Match[];
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

export async function fetchAllMatches(): Promise<Match[]> {
  if (isTauriEnvironment()) {
    try {
      const data = await invoke<unknown>('get_matches');
      const { matches } = migrateMatchData(data);
      return matches;
    } catch (err) {
      console.error('Tauri get_matches failed, falling back to localStorage:', err);
    }
  }

  // Browser fallback
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const { matches } = migrateMatchData(parsed);
    return matches;
  } catch (err) {
    console.error('Failed to read from localStorage:', err);
    return [];
  }
}

export async function persistMatch(match: Match): Promise<Match> {
  if (isTauriEnvironment()) {
    try {
      return await invoke<Match>('save_match', { matchRecord: match });
    } catch (err) {
      console.error('Tauri save_match failed, falling back to localStorage:', err);
    }
  }

  // Browser fallback
  const matches = await fetchAllMatches();
  const existingIdx = matches.findIndex((m) => m.id === match.id);
  if (existingIdx >= 0) {
    matches[existingIdx] = match;
  } else {
    matches.unshift(match);
  }

  localStorage.setItem(LOCAL_STORAGE_KEY, serializeVersionedStorage(matches));
  return match;
}

export async function persistMatches(newMatches: Match[]): Promise<Match[]> {
  if (newMatches.length === 0) return [];

  if (isTauriEnvironment()) {
    try {
      await invoke<number>('import_matches', { jsonData: JSON.stringify(newMatches) });
      return newMatches;
    } catch (err) {
      console.error('Tauri import_matches in persistMatches failed, falling back:', err);
    }
  }

  const current = await fetchAllMatches();
  for (const item of newMatches) {
    const idx = current.findIndex((m) => m.id === item.id);
    if (idx >= 0) {
      current[idx] = item;
    } else {
      current.unshift(item);
    }
  }
  localStorage.setItem(LOCAL_STORAGE_KEY, serializeVersionedStorage(current));
  return newMatches;
}

export async function removeMatch(id: string): Promise<boolean> {
  if (isTauriEnvironment()) {
    try {
      return await invoke<boolean>('delete_match', { id });
    } catch (err) {
      console.error('Tauri delete_match failed, falling back to localStorage:', err);
    }
  }

  // Browser fallback
  const matches = await fetchAllMatches();
  const filtered = matches.filter((m) => m.id !== id);
  const changed = filtered.length !== matches.length;
  if (changed) {
    localStorage.setItem(LOCAL_STORAGE_KEY, serializeVersionedStorage(filtered));
  }
  return changed;
}

export async function exportMatchesJson(): Promise<string> {
  if (isTauriEnvironment()) {
    try {
      return await invoke<string>('export_matches');
    } catch (err) {
      console.error('Tauri export_matches failed:', err);
    }
  }

  const matches = await fetchAllMatches();
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

export async function importMatchesJson(jsonString: string): Promise<number> {
  const parsed = JSON.parse(jsonString);
  const { matches: importedMatches } = migrateMatchData(parsed);

  if (importedMatches.length === 0) {
    throw new Error('Import data must contain valid match records.');
  }

  if (isTauriEnvironment()) {
    try {
      return await invoke<number>('import_matches', { jsonData: JSON.stringify(importedMatches) });
    } catch (err) {
      console.error('Tauri import_matches failed:', err);
    }
  }

  const current = await fetchAllMatches();
  for (const item of importedMatches) {
    const idx = current.findIndex((m) => m.id === item.id);
    if (idx >= 0) {
      current[idx] = item;
    } else {
      current.push(item);
    }
  }

  localStorage.setItem(LOCAL_STORAGE_KEY, serializeVersionedStorage(current));
  return importedMatches.length;
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

