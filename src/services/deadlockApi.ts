import { Match, Side, MatchResult, LaneColor, LaneOutcome } from '../types/match';
import { logApiRequest } from './apiLogger';

const BASE_API_URL = 'https://api.deadlock-api.com/v1';

async function apiFetch(
  url: string,
  init?: RequestInit,
  customSummary?: string
): Promise<Response> {
  const start = performance.now();
  const method = init?.method || 'GET';
  const endpoint = url.startsWith(BASE_API_URL) ? url.slice(BASE_API_URL.length) : url;

  try {
    const res = await fetch(url, init);
    const durationMs = Math.round(performance.now() - start);

    let summary = customSummary || `HTTP ${res.status}`;
    if (res.status === 200) {
      summary = customSummary || 'OK (200)';
    } else if (res.status === 429) {
      summary = 'Rate Limited (429)';
    } else if (res.status === 404) {
      summary = 'Not Found (404)';
    } else if (res.status === 503) {
      summary = 'Steam Unavailable (503)';
    }

    logApiRequest({
      method,
      url,
      endpoint,
      status: res.status,
      statusText: res.statusText || String(res.status),
      durationMs,
      success: res.ok,
      summary,
      error: res.ok ? undefined : `HTTP ${res.status} ${res.statusText}`,
    });

    return res;
  } catch (err: any) {
    const durationMs = Math.round(performance.now() - start);
    logApiRequest({
      method,
      url,
      endpoint,
      status: 0,
      statusText: 'Network Error',
      durationMs,
      success: false,
      summary: 'Connection Error',
      error: err?.message || String(err),
    });
    throw err;
  }
}

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

export interface RawMatchPlayerTimelineStat {
  time_stamp_s: number;
  net_worth: number;
  kills: number;
  deaths: number;
  assists: number;
  gold_boss?: number;
}

export interface RawPlayerMatchRankData {
  initial_display_rank?: number;
  initial_flat_progress?: number;
  final_flat_progress?: number;
  desired_progress_change?: number;
  initial_calibration_games?: number;
  initial_demotion_protection_games?: number;
  consumed_demotion_protection?: boolean;
  initial_win_streak?: number;
}

export interface RawMatchPlayerMetadata {
  account_id: number;
  hero_id: number;
  team: number; // 0 or 1
  player_slot?: number;
  assigned_lane?: number; // 1, 4, 6 or other
  kills?: number;
  deaths?: number;
  assists?: number;
  player_match_outcome?: number;
  abandon_match_time_s?: number;
  stats?: RawMatchPlayerTimelineStat[];
  player_rank_data?: RawPlayerMatchRankData;
}

export interface RawMatchObjective {
  team: number; // 0 or 1
  team_objective_id: number; // 1 = Yellow, 4 = Blue, 3 = Green
  destroyed_time_s: number;
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
    objectives?: RawMatchObjective[];
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
    const res = await apiFetch(url);
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
  const res = await apiFetch(url, {
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch match history: HTTP ${res.status}`);
  }

  const rawMatches: RawPlayerMatchHistoryEntry[] = await res.json();
  if (!Array.isArray(rawMatches)) return [];

  // Strictly filter for Ranked mode only (match_mode === 4)
  return rawMatches.filter((m) => m.match_mode === 4);
}

function getApiHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    Pragma: 'no-cache',
  };
  try {
    const customKey =
      localStorage.getItem('deadlock_api_key') ||
      (import.meta as any).env?.VITE_DEADLOCK_API_KEY;
    if (customKey && typeof customKey === 'string' && customKey.trim()) {
      headers['X-API-KEY'] = customKey.trim();
    }
  } catch {
    // Ignore storage errors
  }
  return headers;
}

export type FetchMetadataResult =
  | { success: true; data: RawMatchMetadata }
  | {
      success: false;
      error: 'steam_unavailable' | 'rate_limited' | 'not_found' | 'server_error' | 'network_error';
      status?: number;
      message?: string;
      retryAfterSeconds?: number;
    };

export type FetchSingleMatchResult =
  | { success: true; match: Match }
  | {
      success: false;
      error:
        | 'steam_unavailable'
        | 'rate_limited'
        | 'not_found'
        | 'not_ranked'
        | 'not_in_match'
        | 'server_error'
        | 'network_error';
      status?: number;
      message?: string;
      retryAfterSeconds?: number;
    };

/**
 * Fetches detailed metadata with full status diagnostic and retry on transient Steam 503 errors.
 */
export async function fetchMatchMetadataWithStatus(
  matchId: number,
  retryCount = 1
): Promise<FetchMetadataResult> {
  const url = `${BASE_API_URL}/matches/${matchId}/metadata`;
  const headers = getApiHeaders();

  for (let attempt = 0; attempt <= retryCount; attempt++) {
    try {
      const res = await apiFetch(url, { headers });

      if (res.ok) {
        const data = (await res.json()) as RawMatchMetadata;
        return { success: true, data };
      }

      if (res.status === 503) {
        // Steam service temporarily unavailable or overwhelmed
        if (attempt < retryCount) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
          continue;
        }
        return {
          success: false,
          error: 'steam_unavailable',
          status: 503,
          message: 'Failed to fetch data from Steam (service unavailable). Steam coordinator may be busy or down.',
        };
      }

      if (res.status === 429) {
        const body = await res.json().catch(() => null);
        const retryAfter = body?.error?.next_request_in || 60;
        return {
          success: false,
          error: 'rate_limited',
          status: 429,
          retryAfterSeconds: retryAfter,
          message: body?.error?.quota
            ? `Steam query quota reached (${body.error.quota.limit} requests/hour per IP). Next request allowed in ${retryAfter}s.`
            : 'Rate limit exceeded. Please wait before retrying.',
        };
      }

      if (res.status === 404) {
        return {
          success: false,
          error: 'not_found',
          status: 404,
          message: `Match #${matchId} was not found on Steam or Deadlock API.`,
        };
      }

      if (res.status >= 500) {
        return {
          success: false,
          error: 'server_error',
          status: res.status,
          message: `Deadlock API server error (HTTP ${res.status}).`,
        };
      }

      return {
        success: false,
        error: 'server_error',
        status: res.status,
        message: `HTTP error ${res.status}`,
      };
    } catch (err) {
      if (attempt < retryCount) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        continue;
      }
      return {
        success: false,
        error: 'network_error',
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  return {
    success: false,
    error: 'server_error',
    message: 'Unknown error occurred while fetching match metadata.',
  };
}

/**
 * Fetches detailed metadata for a specific match (complete 12 player compositions, lanes, duration).
 */
export async function fetchMatchMetadata(matchId: number): Promise<RawMatchMetadata | null> {
  const res = await fetchMatchMetadataWithStatus(matchId);
  return res.success ? res.data : null;
}

/**
 * Maps raw assigned_lane (1, 4, 6 or others) to our 3 duo lanes: 'yellow' | 'blue' | 'green'.
 * Returns undefined if lane number doesn't match any known lane.
 * Exported so it can be reused by the .dem parser path.
 */
export function mapRawLaneToLaneColor(rawLane?: number): LaneColor | undefined {
  if (rawLane === 1) return 'yellow';
  if (rawLane === 4) return 'blue';
  if (rawLane === 6) return 'green';
  return undefined;
}

/**
 * Maps Source 2 objective ID to assigned lane:
 * 1 = Yellow, 4 = Blue, 3 = Green
 */
function mapObjectiveToRawLane(objectiveId: number): number | null {
  if (objectiveId === 1) return 1;
  if (objectiveId === 4) return 4;
  if (objectiveId === 3) return 6;
  return null;
}

/**
 * Source-agnostic input for lane outcome calculation.
 * Can be populated from API net_worth stats OR from .dem m_unNetWorth at tick ~720s.
 */
export interface LaneNWSample {
  myLaneSouls: number;
  enemyLaneSouls: number;
}

export interface GuardianTiming {
  myGuardianDestroyedAt?: number;
  enemyGuardianDestroyedAt?: number;
}

/**
 * Pure lane outcome calculation — source agnostic (works for API and .dem).
 * Rules:
 * - Soul difference >= 5000: sufficient on its own (won / lost)
 * - Guardian destroyed >= 4 minutes (240s) before enemy/own: sufficient on its own (won / lost)
 * - Soul difference >= 3000 AND >= 2 minutes (120s) guardian advance: won / lost
 * - Otherwise: even
 * Returns undefined if no soul data available.
 */
export function computeLaneOutcome(
  nwSample: LaneNWSample,
  guardians?: GuardianTiming
): LaneOutcome | undefined {
  const { myLaneSouls, enemyLaneSouls } = nwSample;

  if (myLaneSouls === 0 && enemyLaneSouls === 0) return undefined;

  const soulDiff = myLaneSouls - enemyLaneSouls;

  const myGuardianDeathTime = guardians?.myGuardianDestroyedAt ?? 99999;
  const enemyGuardianDeathTime = guardians?.enemyGuardianDestroyedAt ?? 99999;
  // Positive if enemy guardian died before ours (we took down their guardian earlier)
  const guardianTimeAdvantage = myGuardianDeathTime - enemyGuardianDeathTime;

  // Rule 1: 5000 soul difference is sufficient on its own
  if (soulDiff >= 5000) return 'won';
  if (soulDiff <= -5000) return 'lost';

  // Rule 2: >= 4 minutes (240s) guardian difference is notable on its own
  if (guardianTimeAdvantage >= 240) return 'won';
  if (guardianTimeAdvantage <= -240) return 'lost';

  // Rule 3: >= 3000 soul difference AND >= 2 minutes (120s) guardian advantage
  if (soulDiff >= 3000 && guardianTimeAdvantage >= 120) return 'won';
  if (soulDiff <= -3000 && guardianTimeAdvantage <= -120) return 'lost';

  return 'even';
}

/**
 * Calculates lane outcome at 12 minutes (time_stamp_s === 720, or fallback to 540 if unavailable).
 * Wraps computeLaneOutcome with API-specific data extraction.
 */
export function calculateLaneOutcome(
  players: RawMatchPlayerMetadata[],
  objectives: RawMatchObjective[] | undefined,
  myLane: number,
  myTeam: number
): LaneOutcome | undefined {
  const enemyTeam = myTeam === 0 ? 1 : myTeam === 1 ? 0 : myTeam === 2 ? 3 : 2;

  const myDuo = players.filter((p) => p.team === myTeam && p.assigned_lane === myLane);
  const enemyDuo = players.filter((p) => p.team === enemyTeam && p.assigned_lane === myLane);

  // Preferred timestamp: 12 minutes (720s). Fallback to 9 minutes (540s) for shorter games.
  const targetTime = 720;
  const fallbackTime = 540;

  let myNW = myDuo.reduce(
    (sum, p) => sum + (p.stats?.find((s) => s.time_stamp_s === targetTime)?.net_worth || 0),
    0
  );
  let enemyNW = enemyDuo.reduce(
    (sum, p) => sum + (p.stats?.find((s) => s.time_stamp_s === targetTime)?.net_worth || 0),
    0
  );

  if (myNW === 0 && enemyNW === 0) {
    myNW = myDuo.reduce(
      (sum, p) => sum + (p.stats?.find((s) => s.time_stamp_s === fallbackTime)?.net_worth || 0),
      0
    );
    enemyNW = enemyDuo.reduce(
      (sum, p) => sum + (p.stats?.find((s) => s.time_stamp_s === fallbackTime)?.net_worth || 0),
      0
    );
  }

  const myGuardian = objectives?.find(
    (o) => o.team === myTeam && mapObjectiveToRawLane(o.team_objective_id) === myLane && o.destroyed_time_s > 0
  );
  const enemyGuardian = objectives?.find(
    (o) => o.team === enemyTeam && mapObjectiveToRawLane(o.team_objective_id) === myLane && o.destroyed_time_s > 0
  );

  return computeLaneOutcome(
    { myLaneSouls: myNW, enemyLaneSouls: enemyNW },
    {
      myGuardianDestroyedAt: myGuardian?.destroyed_time_s,
      enemyGuardianDestroyedAt: enemyGuardian?.destroyed_time_s,
    }
  );
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

  // Determine Result:
  // Rules for player_match_outcome:
  // - 1: standard victory -> 'win'
  // - 2: standard defeat -> 'loss'
  // - 5 (Safe to Leave / Abandon):
  //     * ally leaver + game won -> 'win'
  //     * ally leaver + game lost -> 'cancel'
  //     * enemy leaver + game won -> 'win'
  //     * enemy leaver + game lost -> 'loss'
  let result: MatchResult = 'cancel';
  const myTeam = historyEntry.player_team;
  const isTeamWinner = metadata?.match_info?.winning_team !== undefined
    ? metadata.match_info.winning_team === myTeam
    : historyEntry.match_result === 1;

  if (historyEntry.player_match_outcome === 1) {
    result = 'win';
  } else if (historyEntry.player_match_outcome === 2) {
    result = 'loss';
  } else if (historyEntry.player_match_outcome === 5) {
    const players = metadata?.match_info?.players || [];
    const hasAllyLeaver = players.some(
      (p) => p.team === myTeam && (p.abandon_match_time_s || 0) > 0
    );

    if (isTeamWinner) {
      result = 'win';
    } else if (hasAllyLeaver) {
      result = 'cancel';
    } else {
      result = 'loss';
    }
  } else if (metadata?.match_info?.winning_team !== undefined) {
    result = isTeamWinner ? 'win' : 'loss';
  }

  const myHeroId = historyEntry.hero_id;
  const durationSeconds = metadata?.match_info?.duration_s || historyEntry.match_duration_s;
  const isoDate = new Date(historyEntry.start_time * 1000).toISOString();

  let allies: number[] = [];
  let enemies: number[] = [];
  let lane: LaneColor | undefined;
  let laneAllyId: number | undefined;
  let laneOpponents: number[] | undefined;
  let laneOutcome: LaneOutcome | undefined;
  let playerSlot: number | undefined;
  let rankedBadge: number | null = null;
  let rankedRank: number | null = null;
  let rankedSubrank: number | null = null;
  let rankedDelta: number | null = null;
  let rankedProgress: number | null = null;
  let rankedInitialProgress: number | null = null;
  let rankedDemotionProtection: number | null = null;
  let rankedConsumedDemotionProtection: boolean | null = null;

  if (metadata?.match_info?.players) {
    const players = metadata.match_info.players;
    const myTeam = historyEntry.player_team;
    const myPlayerMeta = players.find(
      (p) => p.account_id === historyEntry.account_id || p.hero_id === myHeroId
    );

    if (myPlayerMeta?.player_slot !== undefined) {
      playerSlot = myPlayerMeta.player_slot;
    }

    const allyPlayers = players.filter(
      (p) => p.team === myTeam && p.hero_id !== myHeroId
    );
    const enemyPlayers = players.filter((p) => p.team !== myTeam);

    allyPlayers.sort((a, b) => (a.assigned_lane ?? 99) - (b.assigned_lane ?? 99));
    enemyPlayers.sort((a, b) => (a.assigned_lane ?? 99) - (b.assigned_lane ?? 99));

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

      // Accurate lane outcome using 9-minute stats & guardian objective timing
      laneOutcome = calculateLaneOutcome(
        players,
        metadata.match_info.objectives,
        myPlayerMeta.assigned_lane,
        myTeam
      );
    }

    // Extract ranked points and badge progression
    const rankData = myPlayerMeta?.player_rank_data;
    if (rankData) {
      rankedBadge = rankData.initial_display_rank ?? historyEntry.ranked_display_badge ?? null;
      if (rankedBadge) {
        rankedRank = Math.floor(rankedBadge / 10);
        rankedSubrank = rankedBadge % 10;
      }
      if (
        rankData.consumed_demotion_protection &&
        rankData.final_flat_progress !== undefined &&
        rankData.final_flat_progress !== null &&
        rankData.initial_flat_progress !== undefined &&
        rankData.initial_flat_progress !== null
      ) {
        rankedDelta = rankData.final_flat_progress - rankData.initial_flat_progress;
      } else {
        rankedDelta = rankData.desired_progress_change ?? historyEntry.ranked_delta ?? null;
      }
      rankedProgress = rankData.final_flat_progress ?? null;
      rankedInitialProgress = rankData.initial_flat_progress ?? null;
      const initialShields = rankData.initial_demotion_protection_games ?? null;
      const consumedShield = rankData.consumed_demotion_protection ?? false;
      rankedConsumedDemotionProtection = consumedShield;
      rankedDemotionProtection = initialShields !== null
        ? (consumedShield ? Math.max(0, initialShields - 1) : initialShields)
        : null;
    }
  }

  if (rankedBadge === null && historyEntry.ranked_display_badge) {
    rankedBadge = historyEntry.ranked_display_badge;
    rankedRank = Math.floor(rankedBadge / 10);
    rankedSubrank = rankedBadge % 10;
  }
  if (rankedDelta === null && historyEntry.ranked_delta !== undefined && historyEntry.ranked_delta !== null) {
    rankedDelta = historyEntry.ranked_delta;
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
    playerSlot,
    rankedBadge,
    rankedRank,
    rankedSubrank,
    rankedDelta,
    rankedProgress,
    rankedInitialProgress,
    rankedDemotionProtection,
    rankedConsumedDemotionProtection,
    notes: `Ranked Match #${historyEntry.match_id} (Auto-imported from Deadlock API)`,
  };
}

/**
 * Converts a DemParseResult (from the Rust .dem parser) into a Match entity.
 * Reuses mapRawLaneToLaneColor and computeLaneOutcome to avoid duplication.
 * Automatically populates ranked progression fields if calculatedRanked is provided.
 *
 * @param dem - Result from the Rust parse_dem_file Tauri command
 * @param rankedData - Calculated ranked progression from deadlock rules, or a string note
 */
export function convertDemResultToMatch(
  dem: import('../types/demTypes').DemParseResult,
  rankedData?: import('../services/rankedCalculator').CalculatedRankedProgression | string,
  fallbackDate?: string
): Match {
  // team 2 = Hidden King, team 3 = Archmother
  const side: Side = dem.myTeam === 2 ? 'hidden_king' : 'archmother';
  const winnerTeam = dem.winningTeam;
  const result: MatchResult =
    dem.myTeam === winnerTeam ? 'win' : winnerTeam === 0 ? 'cancel' : 'loss';

  const lane = mapRawLaneToLaneColor(dem.lane);

  // Lane outcome via souls at T=720s & guardian timings — same logic as calculateLaneOutcome
  const laneOutcome: LaneOutcome | undefined =
    dem.myLaneSoulsAt720 !== undefined && dem.enemyLaneSoulsAt720 !== undefined
      ? computeLaneOutcome(
          {
            myLaneSouls: dem.myLaneSoulsAt720,
            enemyLaneSouls: dem.enemyLaneSoulsAt720,
          },
          {
            myGuardianDestroyedAt: dem.myGuardianDestroyedAt,
            enemyGuardianDestroyedAt: dem.enemyGuardianDestroyedAt,
          }
        )
      : undefined;

  const allies = [...dem.allies];
  const enemies = [...dem.enemies];

  // Pad arrays to expected lengths (same as API path)
  while (allies.length < 5) allies.push(0);
  while (enemies.length < 6) enemies.push(0);

  const isCalculatedObj = typeof rankedData === 'object' && rankedData !== null;
  const calc = isCalculatedObj ? rankedData : undefined;

  const validDate =
    fallbackDate && fallbackDate.trim().length > 5
      ? fallbackDate.trim()
      : dem.dateIso && dem.dateIso.trim().length > 5
      ? dem.dateIso.trim()
      : new Date().toISOString();

  return {
    id: `dem_${dem.matchId}`,
    matchId: dem.matchId,
    date: validDate,
    side,
    myHeroId: dem.myHeroId,
    allies,
    enemies,
    result,
    durationSeconds: dem.durationSeconds,
    lane,
    laneAllyId: dem.laneAllyId,
    laneOpponents: dem.laneOpponents.length > 0 ? dem.laneOpponents : undefined,
    laneOutcome,
    // Ranked progression deduced from Deadlock rules
    rankedBadge: calc?.rankedBadge ?? null,
    rankedRank: calc?.rankedRank ?? null,
    rankedSubrank: calc?.rankedSubrank ?? null,
    rankedDelta: calc?.rankedDelta ?? null,
    rankedProgress: calc?.rankedProgress ?? null,
    rankedInitialProgress: calc?.rankedInitialProgress ?? null,
    rankedDemotionProtection: calc?.rankedDemotionProtection ?? null,
    rankedConsumedDemotionProtection: calc?.rankedConsumedDemotionProtection ?? null,
    notes: `Ranked Match #${dem.matchId} (Manual ID Import)`,
  };
}

/**
 * Synchronizes ranked matches for a given account:
 * - Fetches ranked history
 * - Updates or adds matches with full metadata
 * - Fetches in parallel chunks to respect rate limits without dropping matches
 */
export async function syncRankedMatchesForAccount(
  accountId: number,
  existingMatchIds: Set<string | number>,
  forceUpdateExisting = false
): Promise<{ addedMatches: Match[]; totalRankedFound: number }> {
  const rankedHistory = await fetchPlayerRankedMatches(accountId);
  const totalRankedFound = rankedHistory.length;

  const entriesToProcess = rankedHistory.filter((entry) => {
    if (forceUpdateExisting) return true;
    const stringId = `api_${entry.match_id}`;
    return (
      !existingMatchIds.has(stringId) &&
      !existingMatchIds.has(entry.match_id) &&
      !existingMatchIds.has(String(entry.match_id))
    );
  });

  if (entriesToProcess.length === 0) {
    return { addedMatches: [], totalRankedFound };
  }

  const addedMatches: Match[] = [];
  // Process in batches of 4 to avoid rate limit spikes while syncing all matches
  const chunkSize = 4;
  for (let i = 0; i < entriesToProcess.length; i += chunkSize) {
    const chunk = entriesToProcess.slice(i, i + chunkSize);
    const results = await Promise.all(
      chunk.map(async (entry) => {
        const metadata = await fetchMatchMetadata(entry.match_id);
        return convertToAppMatch(entry, metadata);
      })
    );
    addedMatches.push(...results);
  }

  return { addedMatches, totalRankedFound };
}

/**
 * Re-traverses all existing matches that have a matchId but are missing ranked points/progress data.
 * Fetches match metadata from the Deadlock API in polite batches of 4 and populates:
 * - rankedDelta (points won/lost, e.g. +300, -300)
 * - rankedBadge, rankedRank, rankedSubrank
 * - rankedProgress, rankedInitialProgress
 */
export async function backfillRankedDataForMatches(
  matches: Match[],
  targetAccountId?: number,
  onProgress?: (processed: number, total: number) => void
): Promise<{ updatedMatches: Match[]; updatedCount: number }> {
  const matchesToUpdate = matches.filter(
    (m) => m.matchId && (m.rankedDelta === undefined || m.rankedDelta === null)
  );

  if (matchesToUpdate.length === 0) {
    return { updatedMatches: matches, updatedCount: 0 };
  }

  const updatedMap = new Map<string, Match>();
  const chunkSize = 4;
  let processedCount = 0;

  for (let i = 0; i < matchesToUpdate.length; i += chunkSize) {
    const chunk = matchesToUpdate.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map(async (m) => {
        try {
          const metadata = await fetchMatchMetadata(m.matchId!);
          if (!metadata?.match_info?.players) return;

          const players = metadata.match_info.players;
          const myPlayerMeta = players.find(
            (p) => (targetAccountId && p.account_id === targetAccountId) || p.hero_id === m.myHeroId
          );

          const rankData = myPlayerMeta?.player_rank_data;
          if (rankData) {
            const badge = rankData.initial_display_rank ?? null;
            const rank = badge ? Math.floor(badge / 10) : null;
            const subrank = badge ? badge % 10 : null;

            const updated: Match = {
              ...m,
              rankedBadge: badge,
              rankedRank: rank,
              rankedSubrank: subrank,
              rankedDelta:
                rankData.consumed_demotion_protection &&
                rankData.final_flat_progress !== undefined &&
                rankData.final_flat_progress !== null &&
                rankData.initial_flat_progress !== undefined &&
                rankData.initial_flat_progress !== null
                  ? rankData.final_flat_progress - rankData.initial_flat_progress
                  : rankData.desired_progress_change ?? null,
              rankedProgress: rankData.final_flat_progress ?? null,
              rankedInitialProgress: rankData.initial_flat_progress ?? null,
              rankedDemotionProtection:
                rankData.initial_demotion_protection_games !== undefined &&
                rankData.initial_demotion_protection_games !== null
                  ? (rankData.consumed_demotion_protection
                      ? Math.max(0, rankData.initial_demotion_protection_games - 1)
                      : rankData.initial_demotion_protection_games)
                  : null,
              rankedConsumedDemotionProtection: rankData.consumed_demotion_protection ?? false,
            };
            updatedMap.set(m.id, updated);
          }
        } catch (err) {
          console.warn(`Failed to backfill ranked data for match #${m.matchId}:`, err);
        }
      })
    );

    processedCount += chunk.length;
    if (onProgress) {
      onProgress(processedCount, matchesToUpdate.length);
    }
  }

  const updatedMatches = matches.map((m) => updatedMap.get(m.id) || m);
  return { updatedMatches, updatedCount: updatedMap.size };
}

/**
 * Directly converts raw match metadata into our Match entity for a specific player.
 * Useful when a match was omitted by Valve from player match-history.
 */
export function convertMetadataDirectlyToAppMatch(
  metadata: RawMatchMetadata,
  targetAccountId: number
): Match | null {
  const matchInfo = metadata.match_info;
  if (!matchInfo || !matchInfo.players) return null;

  // Strictly enforce Ranked matches only (match_mode === 4)
  if (matchInfo.match_mode !== 4) {
    return null;
  }

  const myPlayerMeta = matchInfo.players.find((p) => p.account_id === targetAccountId);
  if (!myPlayerMeta) return null;

  // Synthesize a RawPlayerMatchHistoryEntry
  const historyEntry: RawPlayerMatchHistoryEntry = {
    account_id: myPlayerMeta.account_id,
    match_id: matchInfo.match_id,
    hero_id: myPlayerMeta.hero_id,
    hero_level: 1,
    start_time: matchInfo.start_time,
    game_mode: matchInfo.game_mode,
    match_mode: matchInfo.match_mode,
    player_team: myPlayerMeta.team,
    player_kills: myPlayerMeta.kills || 0,
    player_deaths: myPlayerMeta.deaths || 0,
    player_assists: myPlayerMeta.assists || 0,
    net_worth: 0,
    last_hits: 0,
    denies: 0,
    match_duration_s: matchInfo.duration_s,
    match_result: matchInfo.winning_team === myPlayerMeta.team ? 1 : 2,
    player_match_outcome: myPlayerMeta.player_match_outcome || (matchInfo.winning_team === myPlayerMeta.team ? 1 : 2),
  };

  return convertToAppMatch(historyEntry, metadata);
}

/**
 * Fetches match metadata directly by Match ID with precise error diagnostics
 * (differentiating between steam_unavailable, rate_limited, not_found, not_ranked, not_in_match).
 */
export async function fetchSingleMatchResultById(
  matchId: number,
  targetAccountId: number
): Promise<FetchSingleMatchResult> {
  const metaRes = await fetchMatchMetadataWithStatus(matchId);
  if (!metaRes.success) {
    return metaRes;
  }

  const metadata = metaRes.data;
  const matchInfo = metadata.match_info;
  if (!matchInfo || !matchInfo.players) {
    return {
      success: false,
      error: 'server_error',
      message: 'Invalid match metadata received from Deadlock API.',
    };
  }

  if (matchInfo.match_mode !== 4) {
    return {
      success: false,
      error: 'not_ranked',
      message: `Match #${matchId} exists, but it is not a Ranked match (mode: ${matchInfo.match_mode}). Only ranked matches are imported.`,
    };
  }

  const myPlayerMeta = matchInfo.players.find((p) => p.account_id === targetAccountId);
  if (!myPlayerMeta) {
    return {
      success: false,
      error: 'not_in_match',
      message: `Match #${matchId} exists, but your connected Steam account was not a participant in this match.`,
    };
  }

  const match = convertMetadataDirectlyToAppMatch(metadata, targetAccountId);
  if (!match) {
    return {
      success: false,
      error: 'server_error',
      message: 'Failed to convert match metadata into internal match format.',
    };
  }

  return { success: true, match };
}

/**
 * Convenience wrapper returning Match or null.
 */
export async function fetchSingleMatchById(
  matchId: number,
  targetAccountId: number
): Promise<Match | null> {
  const res = await fetchSingleMatchResultById(matchId, targetAccountId);
  return res.success ? res.match : null;
}

export interface RawPlayerRankResponse {
  badge: number;
  rank: number;
  subrank: number;
  last_match?: {
    match_id: number;
    start_time?: number;
    player_rank_initial_display_rank?: number;
    player_rank_initial_flat_progress?: number;
    player_rank_final_flat_progress?: number;
    player_rank_desired_progress_change?: number;
    player_rank_initial_calibration_games?: number;
    player_rank_initial_demotion_protection_games?: number;
    player_rank_consumed_demotion_protection?: boolean;
    player_rank_initial_win_streak?: number;
  };
}

export interface RawBadgeDistributionEntry {
  badge_level: number;
  total_matches: number;
  unique_players: number;
}

export interface PlayerRankStanding {
  badge: number;
  rank: number;
  subrank: number;
  tierName: string;
  subrankRoman: string;
  badgeImageUrl: string;
  progress: number;
  progressMax: number;
  flatProgress?: number;
  progressChange: number;
  demotionProtectionGames: number;
  maxDemotionProtectionGames: number;
  calibrationGamesRemaining: number;
  percentile: number;
  topPercentileFormatted: string;
  betterThanFormatted: string;
  totalRankedPlayers: number;
  playersAbove: number;
}

export const DEADLOCK_RANK_NAMES: Record<number, string> = {
  0: 'Obscurus',
  1: 'Initiate',
  2: 'Seeker',
  3: 'Acolyte',
  4: 'Sentinel',
  5: 'Mystic',
  6: 'Ritualist',
  7: 'Emissary',
  8: 'Oracle',
  9: 'Phantom',
  10: 'Ascendant',
  11: 'Eternus',
};

const ROMAN_NUMERALS = ['', 'I', 'II', 'III', 'IV', 'V', 'VI'];

let cachedBadgeDistribution: { timestamp: number; data: RawBadgeDistributionEntry[] } | null = null;

export async function fetchBadgeDistribution(): Promise<RawBadgeDistributionEntry[]> {
  const now = Date.now();
  if (cachedBadgeDistribution && now - cachedBadgeDistribution.timestamp < 15 * 60 * 1000) {
    return cachedBadgeDistribution.data;
  }
  try {
    const res = await apiFetch(`${BASE_API_URL}/analytics/badge-distribution`);
    if (!res.ok) {
      if (cachedBadgeDistribution) return cachedBadgeDistribution.data;
      return [];
    }
    const data: RawBadgeDistributionEntry[] = await res.json();
    cachedBadgeDistribution = { timestamp: now, data };
    return data;
  } catch (err) {
    console.warn('Failed to fetch badge distribution:', err);
    return cachedBadgeDistribution?.data || [];
  }
}

export async function fetchPlayerRank(accountId: number): Promise<RawPlayerRankResponse | null> {
  try {
    const res = await apiFetch(`${BASE_API_URL}/players/${accountId}/rank`);
    if (!res.ok) {
      return null;
    }
    const data: RawPlayerRankResponse = await res.json();
    return data;
  } catch (err) {
    console.warn('Failed to fetch player rank:', err);
    return null;
  }
}

/**
 * Builds a PlayerRankStanding directly from a local match entity,
 * combining local calculated progression with global leaderboard percentile.
 */
export function buildRankStandingFromLocalMatch(
  match: Match,
  badgeDist: RawBadgeDistributionEntry[] = []
): PlayerRankStanding | null {
  if (match.rankedProgress === undefined || match.rankedProgress === null) {
    return null;
  }

  const currentProgress = match.rankedProgress;
  const rank = match.rankedRank || (match.rankedBadge ? Math.floor(match.rankedBadge / 10) : 1);
  const subrank = Math.min(6, Math.max(1, Math.floor((currentProgress % 6000) / 1000) + 1));
  const badge = rank * 10 + subrank;
  const tierName = DEADLOCK_RANK_NAMES[rank] || `Rank ${rank}`;
  const subrankRoman = ROMAN_NUMERALS[subrank] || (subrank > 0 ? String(subrank) : '');
  const badgeImageUrl = `https://api.deadlock-api.com/v1/assets/ranks/${rank}/${subrank}/image`;

  const progress = currentProgress % 1000;
  const progressMax = 1000;
  const progressChange = match.rankedDelta ?? 0;

  const defaultMaxProtection = subrank === 1 ? 5 : 2;
  const demotionProtectionGames = match.rankedDemotionProtection ?? defaultMaxProtection;
  const maxDemotionProtectionGames = Math.max(defaultMaxProtection, demotionProtectionGames);

  const totalRankedPlayers = badgeDist.reduce((sum, item) => sum + (item.unique_players || 0), 0);
  const playersAbove = badgeDist
    .filter((item) => item.badge_level > badge)
    .reduce((sum, item) => sum + (item.unique_players || 0), 0);
  const playersBelow = badgeDist
    .filter((item) => item.badge_level < badge)
    .reduce((sum, item) => sum + (item.unique_players || 0), 0);

  let topPercentile = 0;
  let betterThanPercentile = 0;
  if (totalRankedPlayers > 0) {
    topPercentile = (playersAbove / totalRankedPlayers) * 100;
    betterThanPercentile = (playersBelow / totalRankedPlayers) * 100;
  }

  const topPercentileFormatted =
    totalRankedPlayers > 0
      ? topPercentile < 0.1
        ? 'Top 0.1%'
        : `Top ${topPercentile.toFixed(1)}%`
      : 'Top --%';
  const betterThanFormatted =
    totalRankedPlayers > 0 ? `Better than ${betterThanPercentile.toFixed(1)}%` : 'Active player';

  return {
    badge,
    rank,
    subrank,
    tierName,
    subrankRoman,
    badgeImageUrl,
    progress,
    progressMax,
    flatProgress: currentProgress,
    progressChange,
    demotionProtectionGames,
    maxDemotionProtectionGames,
    calibrationGamesRemaining: 0,
    percentile: parseFloat(betterThanPercentile.toFixed(1)),
    topPercentileFormatted,
    betterThanFormatted,
    totalRankedPlayers,
    playersAbove,
  };
}

export async function fetchPlayerRankStanding(
  accountId: number,
  latestLocalMatch?: Match | null
): Promise<PlayerRankStanding | null> {
  const [rankData, badgeDist] = await Promise.all([
    fetchPlayerRank(accountId),
    fetchBadgeDistribution(),
  ]);

  // Priority: if a local match has ranked data, use it as the source of truth for the player's rank!
  if (latestLocalMatch && latestLocalMatch.rankedProgress !== undefined && latestLocalMatch.rankedProgress !== null) {
    return buildRankStandingFromLocalMatch(latestLocalMatch, badgeDist);
  }

  if (!rankData || rankData.rank === undefined) {
    return null;
  }

  const rank = rankData.rank;
  const subrank = rankData.subrank || 0;
  const badge = rankData.badge || rank * 10 + subrank;
  const tierName = DEADLOCK_RANK_NAMES[rank] || `Rank ${rank}`;
  const subrankRoman = ROMAN_NUMERALS[subrank] || (subrank > 0 ? String(subrank) : '');
  const badgeImageUrl = `https://api.deadlock-api.com/v1/assets/ranks/${rank}/${subrank}/image`;

  const lastMatch = rankData.last_match;
  const rawFlatProgress =
    lastMatch?.player_rank_final_flat_progress ??
    lastMatch?.player_rank_initial_flat_progress ??
    0;
  // Progress within subrank (each subrank has 1,000 points in Deadlock)
  const progress = rawFlatProgress % 1000;
  const progressMax = 1000;
  const progressChange = lastMatch?.player_rank_desired_progress_change ?? 0;

  const rawProtection = lastMatch?.player_rank_initial_demotion_protection_games ?? 0;
  const consumed = lastMatch?.player_rank_consumed_demotion_protection ?? false;
  const demotionProtectionGames = consumed ? Math.max(0, rawProtection - 1) : rawProtection;
  const defaultMaxProtection = subrank === 1 ? 5 : 2;
  const maxDemotionProtectionGames = Math.max(defaultMaxProtection, rawProtection, demotionProtectionGames);

  const calibrationGamesRemaining = lastMatch?.player_rank_initial_calibration_games ?? 0;

  const totalRankedPlayers = badgeDist.reduce((sum, item) => sum + (item.unique_players || 0), 0);
  const playersAbove = badgeDist
    .filter((item) => item.badge_level > badge)
    .reduce((sum, item) => sum + (item.unique_players || 0), 0);
  const playersBelow = badgeDist
    .filter((item) => item.badge_level < badge)
    .reduce((sum, item) => sum + (item.unique_players || 0), 0);

  let topPercentile = 0;
  let betterThanPercentile = 0;
  if (totalRankedPlayers > 0) {
    topPercentile = (playersAbove / totalRankedPlayers) * 100;
    betterThanPercentile = (playersBelow / totalRankedPlayers) * 100;
  }

  const topPercentileFormatted =
    topPercentile < 0.1 ? 'Top 0.1%' : `Top ${topPercentile.toFixed(1)}%`;
  const betterThanFormatted = `Better than ${betterThanPercentile.toFixed(1)}%`;

  return {
    badge,
    rank,
    subrank,
    tierName,
    subrankRoman,
    badgeImageUrl,
    progress,
    progressMax,
    flatProgress: rawFlatProgress,
    progressChange,
    demotionProtectionGames,
    maxDemotionProtectionGames,
    calibrationGamesRemaining,
    percentile: parseFloat(betterThanPercentile.toFixed(1)),
    topPercentileFormatted,
    betterThanFormatted,
    totalRankedPlayers,
    playersAbove,
  };
}


