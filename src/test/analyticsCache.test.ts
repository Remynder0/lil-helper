/**
 * ============================================================================
 * TESTS UNITAIRES : analytics/cache.ts (Cache Analytique & Invalidation)
 * ============================================================================
 *
 * 🎯 CE QUE CE FICHIER TESTE :
 *  - Le calcul d'empreinte O(1) de matches (getMatchesFingerprint).
 *  - La mémorisation des calculs : deux appels consécutifs avec le même tableau
 *    doivent retourner la référence en cache (0ms de recalcul).
 *  - L'invalidation automatique dès qu'un match est ajouté ou modifié.
 *  - La fonction de purge complète (clearAnalyticsCache).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getMatchesFingerprint,
  getCachedGlobalStats,
  getCachedHeroPerformance,
  getCachedPatronStats,
  clearAnalyticsCache,
} from '../services/analytics/cache';
import { Match } from '../types/match';

function createMockMatch(id: string, date: string, result: 'win' | 'loss' | 'cancel'): Match {
  return {
    id,
    date,
    side: 'hidden_king',
    myHeroId: 1,
    allies: [2, 3, 4, 5, 6],
    enemies: [7, 8, 9, 10, 11, 12],
    result,
  };
}

describe('analyticsCache – Empreinte et invalidation', () => {
  beforeEach(() => {
    clearAnalyticsCache();
  });

  it('generates consistent fingerprint for empty matches', () => {
    expect(getMatchesFingerprint([])).toBe('empty_0');
  });

  it('generates distinct fingerprints when matches change', () => {
    const list1 = [createMockMatch('1', '2024-01-01', 'win')];
    const list2 = [createMockMatch('1', '2024-01-01', 'win'), createMockMatch('2', '2024-01-02', 'loss')];

    expect(getMatchesFingerprint(list1)).not.toBe(getMatchesFingerprint(list2));
  });

  it('returns cached reference when called multiple times with same matches', () => {
    const matches = [
      createMockMatch('1', '2024-01-01', 'win'),
      createMockMatch('2', '2024-01-02', 'loss'),
    ];

    const stats1 = getCachedGlobalStats(matches);
    const stats2 = getCachedGlobalStats(matches);

    // Identité de référence stricte (résultat servi depuis le cache Map)
    expect(stats1).toBe(stats2);
  });

  it('recalculates when matches array fingerprint changes', () => {
    const matchesA = [createMockMatch('1', '2024-01-01', 'win')];
    const matchesB = [createMockMatch('1', '2024-01-01', 'win'), createMockMatch('2', '2024-01-02', 'win')];

    const statsA = getCachedGlobalStats(matchesA);
    const statsB = getCachedGlobalStats(matchesB);

    expect(statsA.totalMatches).toBe(1);
    expect(statsB.totalMatches).toBe(2);
    expect(statsA).not.toBe(statsB);
  });

  it('caches hero performances and patron stats across invocations', () => {
    const matches = [createMockMatch('1', '2024-01-01', 'win')];

    const hp1 = getCachedHeroPerformance(matches);
    const hp2 = getCachedHeroPerformance(matches);
    expect(hp1).toBe(hp2);

    const patron1 = getCachedPatronStats(matches);
    const patron2 = getCachedPatronStats(matches);
    expect(patron1).toBe(patron2);
  });
});
