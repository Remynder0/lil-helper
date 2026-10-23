import { BASE_API_URL, apiFetch } from './apiClient';

export interface SteamProfileSearchResult {
  account_id: number;
  personaname: string;
  avatar?: string;
  profileurl?: string;
}

/**
 * Extracts a numeric 32-bit Steam Account ID from:
 * 1. Steam Community Profile URLs: https://steamcommunity.com/profiles/76561198863397281/
 * 2. 64-bit SteamID: 76561198863397281 (converted via BigInt - 76561197960265728n)
 * 3. 32-bit Steam Account ID / Friend Code: 123456789
 */
export function extractSteamAccountId(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const STEAM_BASE_64 = BigInt('76561197960265728');

  // 1. Steam Community Profile URL: https://steamcommunity.com/profiles/76561198863397281/
  const profileUrlMatch = trimmed.match(/steamcommunity\.com\/profiles\/(\d+)/i);
  if (profileUrlMatch) {
    const raw64 = profileUrlMatch[1];
    try {
      const steam64 = BigInt(raw64);
      const accountId = Number(steam64 - STEAM_BASE_64);
      if (accountId > 0) return accountId;
    } catch {}
  }

  // 2. Direct SteamID64: 17 digits starting with 7656119...
  if (/^7656119\d{10}$/.test(trimmed)) {
    try {
      const steam64 = BigInt(trimmed);
      const accountId = Number(steam64 - STEAM_BASE_64);
      if (accountId > 0) return accountId;
    } catch {}
  }

  // 3. Steam Account ID / Friend code (32-bit integer, usually 1 to 10 digits)
  if (/^\d{1,10}$/.test(trimmed)) {
    const num = Number(trimmed);
    if (num > 0 && num < 2147483647) {
      return num;
    }
  }

  return null;
}

/**
 * Directly fetches Steam profile metadata (personaName, avatar, profileUrl)
 * by 32-bit Account ID via Deadlock API.
 */
export async function fetchSteamProfileById(accountId: number): Promise<SteamProfileSearchResult | null> {
  try {
    const url = `${BASE_API_URL}/players/steam?account_ids=${accountId}&refresh=true`;
    const res = await apiFetch(url);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const p = data[0];
        return {
          account_id: p.account_id,
          personaname: p.personaname || `Account #${accountId}`,
          avatar: p.avatarfull || p.avatarmedium || p.avatar,
          profileurl: p.profileurl,
        };
      }
    }
    return {
      account_id: accountId,
      personaname: `Account #${accountId}`,
    };
  } catch (err) {
    console.error('Failed to fetch steam profile by ID:', err);
    return {
      account_id: accountId,
      personaname: `Account #${accountId}`,
    };
  }
}

/**
 * Searches for Steam profiles by nickname / personaname, Account ID, SteamID64, or profile URL.
 */
export async function searchSteamProfiles(query: string): Promise<SteamProfileSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  // Check if query is an Account ID, SteamID64, or Steam profile URL
  const directAccountId = extractSteamAccountId(trimmed);
  if (directAccountId) {
    const profile = await fetchSteamProfileById(directAccountId);
    return profile ? [profile] : [];
  }

  // Otherwise, it's a nickname / pseudonym search
  try {
    const url = `${BASE_API_URL}/players/steam-search?search_query=${encodeURIComponent(
      trimmed
    )}&limit=10&min_matches_played_last_30d=0`;
    const res = await apiFetch(url);
    if (!res.ok) {
      if (res.status === 503) {
        const error = new Error('STEAM_SEARCH_503');
        (error as any).status = 503;
        throw error;
      }
      return [];
    }

    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err: any) {
    if (err?.status === 503 || err?.message === 'STEAM_SEARCH_503') {
      throw err;
    }
    console.error('Failed to search Steam profiles:', err);
    return [];
  }
}
