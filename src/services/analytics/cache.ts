/**
 * ============================================================================
 * ANALYTICS COMPUTATION CACHE
 * ============================================================================
 *
 * Provides high-performance memoization for heavy statistical calculations.
 * Avoids recalculating O(N*M) analytics routines when matches[] hasn't changed.
 *
 * Cache invalidation is driven by a lightweight fingerprint of the matches list:
 *   fingerprint = `${count}_${firstMatchId}_${lastMatchId}_${latestDate}`
 */

import { Match, LaneColor } from '../../types/match';
import {
  GlobalStats,
  PatronStats,
  HeroPerformance,
  LaneAnalyticsSummary,
  EnemyMatchupStat,
  AllySynergyStat,
  BestActionsAdvisorResult,
  FamiliarFaceStat,
} from './types';
import {
  calculateGlobalStats,
  calculatePatronStats,
  calculateHeroPerformance,
  calculateFamiliarFace,
} from './global';
import { calculateLaneAnalytics } from './lanes';
import { calculateEnemyMatchups, calculateAllySynergies } from './matchups';
import { calculateBestDraftActions } from './draftAdvisor';

/**
 * Computes a fast O(1) fingerprint of the matches array to detect data changes.
 */
export function getMatchesFingerprint(matches: Match[]): string {
  if (!matches || matches.length === 0) return 'empty_0';
  const first = matches[0];
  const last = matches[matches.length - 1];
  return `${matches.length}:${first.id}_${first.date}:${last.id}_${last.date}`;
}

// In-memory LRU-like cache storage
const cacheStore = new Map<string, { fingerprint: string; value: unknown }>();

function getOrCompute<T>(cacheKey: string, fingerprint: string, computeFn: () => T): T {
  const cached = cacheStore.get(cacheKey);
  if (cached && cached.fingerprint === fingerprint) {
    return cached.value as T;
  }
  const computed = computeFn();
  cacheStore.set(cacheKey, { fingerprint, value: computed });
  return computed;
}

/**
 * Clears the analytics memory cache.
 */
export function clearAnalyticsCache(): void {
  cacheStore.clear();
}

/**
 * Cached wrapper for calculateGlobalStats
 */
export function getCachedGlobalStats(matches: Match[]): GlobalStats {
  const fp = getMatchesFingerprint(matches);
  return getOrCompute('globalStats', fp, () => calculateGlobalStats(matches));
}

/**
 * Cached wrapper for calculatePatronStats
 */
export function getCachedPatronStats(matches: Match[]): PatronStats {
  const fp = getMatchesFingerprint(matches);
  return getOrCompute('patronStats', fp, () => calculatePatronStats(matches));
}

/**
 * Cached wrapper for calculateHeroPerformance
 */
export function getCachedHeroPerformance(matches: Match[]): HeroPerformance[] {
  const fp = getMatchesFingerprint(matches);
  return getOrCompute('heroPerformance', fp, () => calculateHeroPerformance(matches));
}

/**
 * Cached wrapper for calculateFamiliarFace
 */
export function getCachedFamiliarFace(matches: Match[]): FamiliarFaceStat | null {
  const fp = getMatchesFingerprint(matches);
  return getOrCompute('familiarFace', fp, () => calculateFamiliarFace(matches));
}

/**
 * Cached wrapper for calculateLaneAnalytics
 */
export function getCachedLaneAnalytics(matches: Match[]): LaneAnalyticsSummary {
  const fp = getMatchesFingerprint(matches);
  return getOrCompute('laneAnalytics', fp, () => calculateLaneAnalytics(matches));
}

/**
 * Cached wrapper for calculateEnemyMatchups
 */
export function getCachedEnemyMatchups(
  matches: Match[],
  selectedPlayerHeroId: number | null
): EnemyMatchupStat[] {
  const fp = `${getMatchesFingerprint(matches)}:hero_${selectedPlayerHeroId ?? 'all'}`;
  return getOrCompute(`enemyMatchups:${selectedPlayerHeroId ?? 'all'}`, fp, () =>
    calculateEnemyMatchups(matches, selectedPlayerHeroId)
  );
}

/**
 * Cached wrapper for calculateAllySynergies
 */
export function getCachedAllySynergies(
  matches: Match[],
  selectedPlayerHeroId: number | null
): AllySynergyStat[] {
  const fp = `${getMatchesFingerprint(matches)}:hero_${selectedPlayerHeroId ?? 'all'}`;
  return getOrCompute(`allySynergies:${selectedPlayerHeroId ?? 'all'}`, fp, () =>
    calculateAllySynergies(matches, selectedPlayerHeroId)
  );
}

/**
 * Cached wrapper for calculateBestDraftActions
 */
export function getCachedBestDraftActions(
  matches: Match[],
  myHeroId: number,
  assignedLane: LaneColor,
  lanes: Record<LaneColor, { allies: number[]; enemies: number[] }>,
  unavailableHeroIds: number[]
): BestActionsAdvisorResult {
  const lanesHash = JSON.stringify(lanes);
  const unavailHash = unavailableHeroIds.slice().sort().join(',');
  const fp = `${getMatchesFingerprint(matches)}:h${myHeroId}:l${assignedLane}:${lanesHash}:${unavailHash}`;
  const key = `bestDraftActions:${myHeroId}:${assignedLane}`;
  return getOrCompute(key, fp, () =>
    calculateBestDraftActions(matches, myHeroId, assignedLane, lanes, unavailableHeroIds)
  );
}
