import { Match, Side, MatchResult, LaneColor, LaneOutcome } from '../types/match';

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

export interface RawMatchPlayerTimelineStat {
  time_stamp_s: number;
  net_worth: number;
  kills: number;
  deaths: number;
  assists: number;
  gold_boss?: number;
}

export interface RawMatchPlayerMetadata {
  account_id: number;
  hero_id: number;
  team: number; // 0 or 1
  assigned_lane?: number; // 1, 4, 6 or other
  kills?: number;
  deaths?: number;
  assists?: number;
  abandon_match_time_s?: number;
  stats?: RawMatchPlayerTimelineStat[];
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
  const res = await fetch(url, {
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
 * Calculates lane outcome at 12 minutes (time_stamp_s === 720, or fallback to 540 if unavailable):
 * - Soul difference >= 5000: sufficient on its own (won / lost)
 * - Guardian destroyed >= 4 minutes (240s) before enemy/own: sufficient on its own (won / lost)
 * - Soul difference >= 3000 AND >= 2 minutes (120s) guardian advance: won / lost
 * - Otherwise: even
 */
export function calculateLaneOutcome(
  players: RawMatchPlayerMetadata[],
  objectives: RawMatchObjective[] | undefined,
  myLane: number,
  myTeam: number
): LaneOutcome | undefined {
  const enemyTeam = myTeam === 0 ? 1 : 0;

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

  // If neither 12-minute nor 9-minute stats are available, don't guess
  if (myNW === 0 && enemyNW === 0) {
    return undefined;
  }

  const soulDiff = myNW - enemyNW;

  // Guardian timing comparison
  const myGuardian = objectives?.find(
    (o) => o.team === myTeam && mapObjectiveToRawLane(o.team_objective_id) === myLane && o.destroyed_time_s > 0
  );
  const enemyGuardian = objectives?.find(
    (o) => o.team === enemyTeam && mapObjectiveToRawLane(o.team_objective_id) === myLane && o.destroyed_time_s > 0
  );

  const myGuardianDeathTime = myGuardian ? myGuardian.destroyed_time_s : 99999;
  const enemyGuardianDeathTime = enemyGuardian ? enemyGuardian.destroyed_time_s : 99999;

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

      // Accurate lane outcome using 9-minute stats & guardian objective timing
      laneOutcome = calculateLaneOutcome(
        players,
        metadata.match_info.objectives,
        myPlayerMeta.assigned_lane,
        myTeam
      );
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
