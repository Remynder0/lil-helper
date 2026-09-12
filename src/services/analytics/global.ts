import { Match } from '../../types/match';
import { getHeroById } from '../../data/heroes';
import { GlobalStats, PatronStats, HeroPerformance } from './types';

/**
 * Calculates global statistics over a list of matches.
 * Note: cancelled matches are excluded from the winrate denominator.
 */
export function calculateGlobalStats(matches: Match[]): GlobalStats {
  let totalWins = 0;
  let totalLosses = 0;
  let totalCancels = 0;

  for (const m of matches) {
    if (m.result === 'win') totalWins += 1;
    else if (m.result === 'loss') totalLosses += 1;
    else if (m.result === 'cancel') totalCancels += 1;
  }

  const decided = totalWins + totalLosses;
  const winRate = decided > 0 ? Math.round((totalWins / decided) * 100) : 0;

  return {
    totalMatches: matches.length,
    totalWins,
    totalLosses,
    totalCancels,
    winRate,
  };
}

/**
 * Computes performance statistics comparing the two patrons:
 * The Hidden King vs The Archmother.
 */
export function calculatePatronStats(matches: Match[]): PatronStats {
  const stats: PatronStats = {
    hiddenKing: { matches: 0, wins: 0, losses: 0, cancels: 0, winRate: 0 },
    archmother: { matches: 0, wins: 0, losses: 0, cancels: 0, winRate: 0 },
  };

  for (const m of matches) {
    const bucket = m.side === 'hidden_king' ? stats.hiddenKing : stats.archmother;
    bucket.matches += 1;
    if (m.result === 'win') bucket.wins += 1;
    else if (m.result === 'loss') bucket.losses += 1;
    else if (m.result === 'cancel') bucket.cancels += 1;
  }

  const hkDecided = stats.hiddenKing.wins + stats.hiddenKing.losses;
  stats.hiddenKing.winRate = hkDecided > 0 ? Math.round((stats.hiddenKing.wins / hkDecided) * 100) : 0;

  const archDecided = stats.archmother.wins + stats.archmother.losses;
  stats.archmother.winRate = archDecided > 0 ? Math.round((stats.archmother.wins / archDecided) * 100) : 0;

  return stats;
}

/**
 * Computes performance breakdown per played hero (myHeroId).
 * Sorted by matches played descending by default.
 */
export function calculateHeroPerformance(matches: Match[]): HeroPerformance[] {
  const map = new Map<number, { matches: number; wins: number; losses: number; cancels: number }>();

  for (const m of matches) {
    const current = map.get(m.myHeroId) || { matches: 0, wins: 0, losses: 0, cancels: 0 };
    current.matches += 1;
    if (m.result === 'win') current.wins += 1;
    else if (m.result === 'loss') current.losses += 1;
    else if (m.result === 'cancel') current.cancels += 1;
    map.set(m.myHeroId, current);
  }

  const list: HeroPerformance[] = [];

  for (const [heroId, stat] of map.entries()) {
    const decided = stat.wins + stat.losses;
    const winRate = decided > 0 ? Math.round((stat.wins / decided) * 100) : 0;
    list.push({
      heroId,
      hero: getHeroById(heroId),
      matches: stat.matches,
      wins: stat.wins,
      losses: stat.losses,
      cancels: stat.cancels,
      winRate,
    });
  }

  // Sort by matches played descending
  list.sort((a, b) => b.matches - a.matches);

  return list;
}
