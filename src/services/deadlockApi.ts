import { Match, Side, LaneColor, LaneOutcome } from '../types/match';

const BASE_API_URL = 'https://api.deadlock-api.com/v1';

export interface SteamProfileSearchResult {
  account_id: number;
  personaname: string;
  avatar?: string;
  profileurl?: string;
}

export interface RawPlayerMatchHistoryEntry {
  account_id: number;
  match_id: number;
  hero_id: number;
  hero_level: number;
  start_time: number; // Unix timestamp in seconds
  game_mode: number;
  match_mode: number; // 4 = ranked
  player_team: number; // 0 = team0, 1 = team1
  player_kills: number;
  player_deaths: number;
  player_assists: number;
  net_worth: number;
  last_hits: number;
  denies: number;
  match_duration_s: number;
  match_result: number;
  player_match_outcome: number; // 1 = win, 2 = loss
  ranked_display_badge?: number | null;
  ranked_delta?: number | null;
}

export interface RawMatchPlayerMetadata {
  account_id: number;
  hero_id: number;
  team: number; // 0 or 1
  assigned_lane?: number; // 1, 4, 6 or other
  kills?: number;
  deaths?: number;
  assists?: number;
}

export interface RawMatchMetadata {
  match_info: {
    match_id: number;
    duration_s: number;
    start_time: number;
    winning_team: number; // 0 or 1
    game_mode: number;
    match_mode: number;
    players: RawMatchPlayerMetadata[];
  };
}

/**
 * Searches for Steam profiles by nickname / personaname or account ID.
 */
export async function searchSteamProfiles(query: string): Promise<SteamProfileSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const isDigits = /^\d+$/.test(trimmed);

  try {
    const url = `${BASE_API_URL}/players/steam-search?search_query=${encodeURIComponent(
      trimmed
    )}&limit=10&min_matches_played_last_30d=0`;
    const res = await fetch(url);
    if (!res.ok) {
      if (isDigits) {
        return [{ account_id: Number(trimmed), personaname: `Account #${trimmed}` }];
      }
      return [];
    }

    const data = await res.json();
    const results: SteamProfileSearchResult[] = Array.isArray(data) ? data : [];

    if (isDigits) {
      const numId = Number(trimmed);
      if (!results.some((p) => p.account_id === numId)) {
        results.unshift({
          account_id: numId,
          personaname: `Account ID: ${numId}`,
        });
      }
    }

    return results;
  } catch (err) {
    console.error('Failed to search Steam profiles:', err);
    if (isDigits) {
      return [{ account_id: Number(trimmed), personaname: `Account #${trimmed}` }];
    }
    return [];
  }
}

/**
 * Fetches player match history and filters ONLY Ranked matches (`match_mode === 4`).
 */
export async function fetchPlayerRankedMatches(
  accountId: number
): Promise<RawPlayerMatchHistoryEntry[]> {
  const url = `${BASE_API_URL}/players/${accountId}/match-history`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch match history: HTTP ${res.status}`);
  }

  const rawMatches: RawPlayerMatchHistoryEntry[] = await res.json();
  if (!Array.isArray(rawMatches)) return [];

  // Strictly filter for Ranked mode only (match_mode === 4)
  return rawMatches.filter((m) => m.match_mode === 4);
}

/**
 * Fetches detailed metadata for a specific match (complete 12 player compositions, lanes, duration).
 */
export async function fetchMatchMetadata(matchId: number): Promise<RawMatchMetadata | null> {
  try {
    const url = `${BASE_API_URL}/matches/${matchId}/metadata`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`Could not fetch metadata for match ${matchId}: HTTP ${res.status}`);
      return null;
    }
    return (await res.json()) as RawMatchMetadata;
  } catch (err) {
    console.warn(`Failed to fetch metadata for match ${matchId}:`, err);
    return null;
  }
}

/**
 * Maps raw assigned_lane (1, 4, 6 or others) to our 3 duo lanes: 'yellow' | 'blue' | 'green'.
 */
function mapRawLaneToLaneColor(rawLane?: number): LaneColor {
  if (rawLane === 1) return 'yellow';
  if (rawLane === 4) return 'blue';
  if (rawLane === 6) return 'green';
  return 'green';
}

/**
 * Converts a raw ranked match and its metadata into our internal `Match` entity.
 */
export function convertToAppMatch(
  historyEntry: RawPlayerMatchHistoryEntry,
  metadata: RawMatchMetadata | null
): Match {
  // Determine Side: team 0 = The Hidden King, team 1 = The Archmother
  const side: Side = historyEntry.player_team === 0 ? 'hidden_king' : 'archmother';

  // Determine Result: outcome 1 = win, outcome 2 = loss, otherwise check match_result
  const isWin = historyEntry.player_match_outcome === 1 || historyEntry.match_result === 1;
  const isLoss = historyEntry.player_match_outcome === 2 || historyEntry.match_result === 2;
  const result = isWin ? 'win' : isLoss ? 'loss' : 'cancel';

  const myHeroId = historyEntry.hero_id;
  const durationSeconds = metadata?.match_info?.duration_s || historyEntry.match_duration_s;
  const isoDate = new Date(historyEntry.start_time * 1000).toISOString();

  let allies: number[] = [];
  let enemies: number[] = [];
  let lane: LaneColor | undefined;
  let laneAllyId: number | undefined;
  let laneOpponents: number[] | undefined;
  let laneOutcome: LaneOutcome | undefined;

  if (metadata?.match_info?.players) {
    const players = metadata.match_info.players;
    const myTeam = historyEntry.player_team;
    const myPlayerMeta = players.find(
      (p) => p.account_id === historyEntry.account_id || p.hero_id === myHeroId
    );

    const allyPlayers = players.filter(
      (p) => p.team === myTeam && p.hero_id !== myHeroId
    );
    const enemyPlayers = players.filter((p) => p.team !== myTeam);

    allies = allyPlayers.map((p) => p.hero_id).slice(0, 5);
    enemies = enemyPlayers.map((p) => p.hero_id).slice(0, 6);

    if (myPlayerMeta && myPlayerMeta.assigned_lane !== undefined) {
      lane = mapRawLaneToLaneColor(myPlayerMeta.assigned_lane);
      const lanePartner = allyPlayers.find((p) => p.assigned_lane === myPlayerMeta.assigned_lane);
      if (lanePartner) {
        laneAllyId = lanePartner.hero_id;
      }
      const directEnemies = enemyPlayers.filter((p) => p.assigned_lane === myPlayerMeta.assigned_lane);
      if (directEnemies.length > 0) {
        laneOpponents = directEnemies.map((p) => p.hero_id).slice(0, 2);
      }
      laneOutcome = isWin ? 'won' : isLoss ? 'lost' : 'even';
    }
  }

  // Ensure minimum array length
  while (allies.length < 5) {
    allies.push(0);
  }
  while (enemies.length < 6) {
    enemies.push(0);
  }

  return {
    id: `api_${historyEntry.match_id}`,
    matchId: historyEntry.match_id,
    date: isoDate,
    side,
    myHeroId,
    allies,
    enemies,
    result,
    durationSeconds,
    lane,
    laneAllyId,
    laneOpponents,
    laneOutcome,
    notes: `Ranked Match #${historyEntry.match_id} (Auto-imported from Deadlock API)`,
  };
}

/**
 * Synchronizes ranked matches for a given account:
 * - Fetches ranked history
 * - Deduplicates against existing local matches
 * - Fetches metadata for new matches (capped batch to respect rate limits)
 */
export async function syncRankedMatchesForAccount(
  accountId: number,
  existingMatchIds: Set<string | number>,
  maxToFetchMetadata = 15
): Promise<{ addedMatches: Match[]; totalRankedFound: number }> {
  const rankedHistory = await fetchPlayerRankedMatches(accountId);
  const totalRankedFound = rankedHistory.length;

  // Filter only matches not already in local database
  const newEntries = rankedHistory.filter((entry) => {
    const stringId = `api_${entry.match_id}`;
    return (
      !existingMatchIds.has(stringId) &&
      !existingMatchIds.has(entry.match_id) &&
      !existingMatchIds.has(String(entry.match_id))
    );
  });

  if (newEntries.length === 0) {
    return { addedMatches: [], totalRankedFound };
  }

  // Cap the metadata fetching to avoid hammering the API
  const entriesToProcess = newEntries.slice(0, maxToFetchMetadata);
  const addedMatches: Match[] = [];

  for (const entry of entriesToProcess) {
    const metadata = await fetchMatchMetadata(entry.match_id);
    const converted = convertToAppMatch(entry, metadata);
    addedMatches.push(converted);
  }

  return { addedMatches, totalRankedFound };
}
