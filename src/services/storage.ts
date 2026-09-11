import { invoke } from '@tauri-apps/api/core';
import { Match } from '../types/match';

const LOCAL_STORAGE_KEY = 'deadlock_matches_v1';

function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function fetchAllMatches(): Promise<Match[]> {
  if (isTauriEnvironment()) {
    try {
      return await invoke<Match[]>('get_matches');
    } catch (err) {
      console.error('Tauri get_matches failed, falling back to localStorage:', err);
    }
  }

  // Browser fallback
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Match[];
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
  const existingIdx = matches.findIndex(m => m.id === match.id);
  if (existingIdx >= 0) {
    matches[existingIdx] = match;
  } else {
    matches.unshift(match);
  }

  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(matches));
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
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(current));
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
  const filtered = matches.filter(m => m.id !== id);
  const changed = filtered.length !== matches.length;
  if (changed) {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filtered));
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
  return JSON.stringify(matches, null, 2);
}

export async function importMatchesJson(jsonString: string): Promise<number> {
  const parsed = JSON.parse(jsonString);
  if (!Array.isArray(parsed)) {
    throw new Error('Import data must be a JSON array of matches.');
  }

  if (isTauriEnvironment()) {
    try {
      return await invoke<number>('import_matches', { jsonData: jsonString });
    } catch (err) {
      console.error('Tauri import_matches failed:', err);
    }
  }

  const current = await fetchAllMatches();
  for (const item of parsed) {
    const idx = current.findIndex(m => m.id === item.id);
    if (idx >= 0) {
      current[idx] = item;
    } else {
      current.push(item);
    }
  }

  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(current));
  return parsed.length;
}
