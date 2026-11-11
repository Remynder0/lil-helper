/**
 * Ranked Season boundaries and configuration.
 *
 * Season 1: Launch through 2026-11-05 21:07:17 UTC (delta 300 base).
 * Season 2: Officially started worldwide on 2026-11-05 at 21:07:18 UTC (Match #131890899, delta 350 base).
 *
 * Note: Ranked Season 2 calculation rules are temporarily pending detailed study.
 * Matches identified as Season 2 are strictly blocked from being recorded or saved.
 */

export const SEASON_2_START_TIMESTAMP_MS = 1793912838000; // 2026-11-05T21:07:18.000Z
export const SEASON_2_START_MATCH_ID = 131890899;
export const SEASON_2_RANKED_DELTA_BASE = 350;
export const SEASON_1_RANKED_DELTA_BASE = 300;

export interface SeasonCheckCandidate {
  id?: string | number | null;
  matchId?: number | string | null;
  match_id?: number | string | null;
  date?: string | number | null;
  start_time?: number | null;
  rankedDelta?: number | null;
  ranked_delta?: number | null;
  desired_progress_change?: number | null;
  match_info?: {
    match_id?: number | string | null;
    start_time?: number | null;
  } | null;
}

/**
 * Determines whether a match belongs to Ranked Season 2.
 * Any match meeting ANY of the Season 2 criteria is treated as Season 2:
 * 1. Match ID >= 131890899 (first ranked match of Season 2 worldwide)
 * 2. Absolute ranked delta / desired progress change == 350 (or greater)
 * 3. Start time / Date timestamp >= 2026-11-05T21:07:18.000Z
 */
export function isSeason2Match(candidate: SeasonCheckCandidate | null | undefined): boolean {
  if (!candidate) return false;

  // 1. Check Match ID
  const rawMatchId = candidate.matchId ?? candidate.match_id ?? candidate.match_info?.match_id;
  let effectiveMatchId: number | null = null;
  if (typeof rawMatchId === 'number' && Number.isFinite(rawMatchId)) {
    effectiveMatchId = rawMatchId;
  } else if (typeof rawMatchId === 'string') {
    const parsed = parseInt(rawMatchId, 10);
    if (!isNaN(parsed)) effectiveMatchId = parsed;
  } else if (typeof candidate.id === 'string') {
    const matchNum = candidate.id.replace(/^(api_|match_|pending_|queue_)/, '');
    const parsed = parseInt(matchNum, 10);
    if (!isNaN(parsed) && parsed > 1000000) effectiveMatchId = parsed;
  }

  if (effectiveMatchId !== null && effectiveMatchId >= SEASON_2_START_MATCH_ID) {
    return true;
  }

  // 2. Check Ranked Delta / Desired Progress Change (Season 2 base is 350)
  const delta = candidate.rankedDelta ?? candidate.ranked_delta ?? candidate.desired_progress_change;
  if (typeof delta === 'number' && Number.isFinite(delta)) {
    if (Math.abs(delta) === SEASON_2_RANKED_DELTA_BASE) {
      return true;
    }
  }

  // 3. Check start_time (Unix timestamp in seconds or milliseconds)
  const startTime = candidate.start_time ?? candidate.match_info?.start_time;
  if (typeof startTime === 'number' && Number.isFinite(startTime)) {
    const startTimeMs = startTime > 1e11 ? startTime : startTime * 1000;
    if (startTimeMs >= SEASON_2_START_TIMESTAMP_MS) {
      return true;
    }
  }

  // 4. Check Date string or timestamp
  if (candidate.date) {
    const timestamp = typeof candidate.date === 'number' ? candidate.date : Date.parse(candidate.date);
    if (!isNaN(timestamp) && timestamp >= SEASON_2_START_TIMESTAMP_MS) {
      return true;
    }
  }

  return false;
}

/**
 * Determines whether a match belongs to Ranked Season 1.
 */
export function isSeason1Match(candidate: SeasonCheckCandidate | null | undefined): boolean {
  if (!candidate) return false;
  return !isSeason2Match(candidate);
}

/**
 * Returns the season number for a match (1 or 2).
 */
export function getMatchSeason(candidate: SeasonCheckCandidate | null | undefined): 1 | 2 {
  return isSeason2Match(candidate) ? 2 : 1;
}
