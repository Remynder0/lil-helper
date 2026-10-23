import { Match } from '../../types/match';
import { BASE_API_URL, apiFetch } from './apiClient';

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

  const defaultMaxProtection = subrank <= 2 ? 5 : 2;
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
