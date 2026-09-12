import { Match } from '../../types/match';
import { HEROES, getHeroById } from '../../data/heroes';
import { calculateHeroPerformance } from './global';
import { HeroDraftRecommendation } from './types';

/**
 * Computes draft recommendations for all available heroes given the current
 * allies and enemies drafted so far.
 *
 * Algorithm:
 * 1. Calculate baseline win rate for candidate hero H.
 * 2. For each selected enemy E: retrieve historical matchup win rate of H vs E.
 * 3. For each selected ally A: retrieve historical synergy win rate of H with A.
 * 4. Compute weighted overall score and human-readable explanations.
 */
export function calculateDraftRecommendations(
  matches: Match[],
  currentAllies: number[],
  currentEnemies: number[],
  unavailableHeroIds: number[]
): HeroDraftRecommendation[] {
  const recommendations: HeroDraftRecommendation[] = [];

  // Pre-calculate hero performance map
  const heroPerformances = calculateHeroPerformance(matches);
  const heroPerfMap = new Map<number, { winRate: number; matches: number }>();
  for (const hp of heroPerformances) {
    heroPerfMap.set(hp.heroId, { winRate: hp.winRate, matches: hp.matches });
  }

  // Iterate over all active Deadlock heroes
  for (const hero of HEROES) {
    // Skip heroes already picked or unavailable
    if (unavailableHeroIds.includes(hero.id)) {
      continue;
    }

    const perf = heroPerfMap.get(hero.id);
    const baselineWinRate = perf ? perf.winRate : 50; // default to 50% if unplayed
    const totalGamesPiloted = perf ? perf.matches : 0;

    // Filter matches where user piloted this hero
    const heroMatches = matches.filter((m) => m.myHeroId === hero.id);

    // 1. Analyze matchups against selected enemies
    const enemyDetails: HeroDraftRecommendation['enemyDetails'] = [];
    let enemyScoreSum = 0;
    let enemyCount = 0;

    for (const enemyId of currentEnemies) {
      const againstMatches = heroMatches.filter((m) => m.enemies.includes(enemyId));
      const decided = againstMatches.filter((m) => m.result === 'win' || m.result === 'loss');
      const wins = againstMatches.filter((m) => m.result === 'win').length;

      if (decided.length > 0) {
        const wr = Math.round((wins / decided.length) * 100);
        const advantage = wr - 50;
        const enemyObj = getHeroById(enemyId);
        enemyDetails.push({
          enemyHeroId: enemyId,
          enemyHeroName: enemyObj?.name || `Hero #${enemyId}`,
          winRate: wr,
          matches: decided.length,
          advantage,
        });
        enemyScoreSum += wr;
        enemyCount += 1;
      }
    }

    const enemyMatchupScore = enemyCount > 0 ? Math.round(enemyScoreSum / enemyCount) : null;

    // 2. Analyze synergies with selected allies
    const allyDetails: HeroDraftRecommendation['allyDetails'] = [];
    let allyScoreSum = 0;
    let allyCount = 0;

    for (const allyId of currentAllies) {
      const withMatches = heroMatches.filter((m) => m.allies.includes(allyId));
      const decided = withMatches.filter((m) => m.result === 'win' || m.result === 'loss');
      const wins = withMatches.filter((m) => m.result === 'win').length;

      if (decided.length > 0) {
        const wr = Math.round((wins / decided.length) * 100);
        const synergy = wr - 50;
        const allyObj = getHeroById(allyId);
        allyDetails.push({
          allyHeroId: allyId,
          allyHeroName: allyObj?.name || `Hero #${allyId}`,
          winRate: wr,
          matches: decided.length,
          synergy,
        });
        allyScoreSum += wr;
        allyCount += 1;
      }
    }

    const allySynergyScore = allyCount > 0 ? Math.round(allyScoreSum / allyCount) : null;

    // 3. Compute overall recommendation score
    // Baseline: 40% weight, Enemy counters: 35% weight, Ally synergies: 25% weight
    let overallScore = baselineWinRate;
    if (enemyMatchupScore !== null && allySynergyScore !== null) {
      overallScore = Math.round(baselineWinRate * 0.35 + enemyMatchupScore * 0.40 + allySynergyScore * 0.25);
    } else if (enemyMatchupScore !== null) {
      overallScore = Math.round(baselineWinRate * 0.45 + enemyMatchupScore * 0.55);
    } else if (allySynergyScore !== null) {
      overallScore = Math.round(baselineWinRate * 0.55 + allySynergyScore * 0.45);
    }

    // Small bonus for hero experience/confidence (up to +3 for 30+ games)
    if (totalGamesPiloted >= 30) {
      overallScore = Math.min(100, overallScore + 2);
    }

    // 4. Generate human-readable primary reason
    let primaryReason = '';
    const strongCounters = enemyDetails.filter((e) => e.advantage >= 15);
    const hardCountered = enemyDetails.filter((e) => e.advantage <= -15);
    const strongSynergies = allyDetails.filter((a) => a.synergy >= 15);

    if (strongCounters.length > 0 && strongSynergies.length > 0) {
      primaryReason = `Counters ${strongCounters[0].enemyHeroName} (${strongCounters[0].winRate}% WR) & synergizes with ${strongSynergies[0].allyHeroName} (${strongSynergies[0].winRate}% WR)`;
    } else if (strongCounters.length > 0) {
      primaryReason = `Strong counter against ${strongCounters.map((c) => c.enemyHeroName).join(', ')}`;
    } else if (hardCountered.length > 0) {
      primaryReason = `Caution: Countered by ${hardCountered.map((c) => c.enemyHeroName).join(', ')}`;
    } else if (strongSynergies.length > 0) {
      primaryReason = `High synergy alongside ${strongSynergies.map((s) => s.allyHeroName).join(', ')}`;
    } else if (totalGamesPiloted > 0) {
      primaryReason = `${baselineWinRate}% historical personal win rate over ${totalGamesPiloted} games`;
    } else {
      primaryReason = 'No match';
    }

    if (primaryReason != 'No match') {
      recommendations.push({
        heroId: hero.id,
        hero,
        overallScore,
        baselineWinRate,
        totalGamesPiloted,
        enemyMatchupScore,
        enemyDetails,
        allySynergyScore,
        allyDetails,
        primaryReason,
      });
    }
  }

  // Sort descending by overall score, then by experience
  recommendations.sort((a, b) => {
    if (b.overallScore !== a.overallScore) {
      return b.overallScore - a.overallScore;
    }
    return b.totalGamesPiloted - a.totalGamesPiloted;
  });

  return recommendations;
}
