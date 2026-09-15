import { Match } from '../../types/match';
import { getHeroById } from '../../data/heroes';
import { GlobalStats, PatronStats, HeroPerformance, FamiliarFaceStat } from './types';

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

  // Chronological sort to calculate accurate streaks (oldest to newest)
  const chronological = [...matches].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  let currentWinMatches: Match[] = [];
  let bestWinMatches: Match[] = [];

  let currentLossMatches: Match[] = [];
  let worstLossMatches: Match[] = [];

  for (const m of chronological) {
    if (m.result === 'win') {
      currentWinMatches.push(m);
      currentLossMatches = [];
      if (currentWinMatches.length >= bestWinMatches.length) {
        bestWinMatches = [...currentWinMatches];
      }
    } else if (m.result === 'loss') {
      currentLossMatches.push(m);
      currentWinMatches = [];
      if (currentLossMatches.length >= worstLossMatches.length) {
        worstLossMatches = [...currentLossMatches];
      }
    }
  }

  return {
    totalMatches: matches.length,
    totalWins,
    totalLosses,
    totalCancels,
    winRate,
    bestWinStreak: {
      count: bestWinMatches.length,
      startDate: bestWinMatches[0]?.date,
      endDate: bestWinMatches[bestWinMatches.length - 1]?.date,
      matchIds: bestWinMatches.map((m) => m.id),
    },
    worstLoseStreak: {
      count: worstLossMatches.length,
      startDate: worstLossMatches[0]?.date,
      endDate: worstLossMatches[worstLossMatches.length - 1]?.date,
      matchIds: worstLossMatches.map((m) => m.id),
    },
  };
}

/**
 * Formats a streak's start and end date for display.
 */
export function formatStreakDateRange(startDate?: string, endDate?: string): string {
  if (!startDate) return '';
  const d1 = new Date(startDate);
  const d2 = endDate ? new Date(endDate) : d1;

  const sameDay = d1.toDateString() === d2.toDateString();
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };

  if (sameDay) {
    return d1.toLocaleDateString([], options);
  }

  if (d1.getFullYear() === d2.getFullYear()) {
    const startStr = d1.toLocaleDateString([], { month: 'short', day: 'numeric' });
    const endStr = d2.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    return `${startStr} – ${endStr}`;
  }

  return `${d1.toLocaleDateString([], options)} – ${d2.toLocaleDateString([], options)}`;
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
 * Rules of 5/10 for representative sample size:
 * - If the player has less than 100 total games (< 100): threshold = 5 games.
 * - Starting from 100 total games (>= 100): threshold = 10 games.
 */
export function getSampleThreshold(totalMatches: number): number {
  return totalMatches < 100 ? 5 : 10;
}

export function isSampleRepresentative(sampleCount: number, totalMatches: number): boolean {
  return sampleCount >= getSampleThreshold(totalMatches);
}

export function getSampleThresholdExplanation(totalMatches: number): string {
  const threshold = getSampleThreshold(totalMatches);
  if (totalMatches < 100) {
    return `Threshold of representativeness: ${threshold} games (active because < 100 games in total: ${totalMatches}/100)`;
  }
  return `Threshold of representativeness: ${threshold} games (active because ≥ 100 games in total: ${totalMatches})`;
}

/**
 * Computes performance breakdown per played hero (myHeroId).
 * Sorted by matches played descending by default.
 */
export function calculateHeroPerformance(matches: Match[]): HeroPerformance[] {
  const threshold = getSampleThreshold(matches.length);
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
      isRepresentative: stat.matches >= threshold,
      threshold,
    });
  }

  // Sort by matches played descending
  list.sort((a, b) => b.matches - a.matches);

  return list;
}

/**
 * Computes the hero most frequently encountered across all matches
 * (excluding the hero the player picked themselves).
 */
export function calculateFamiliarFace(matches: Match[]): FamiliarFaceStat | null {
  if (matches.length === 0) return null;
  const threshold = getSampleThreshold(matches.length);

  const map = new Map<
    number,
    { heroId: number; asAlly: number; asEnemy: number; wins: number; losses: number }
  >();

  for (const m of matches) {
    for (const allyId of m.allies) {
      if (allyId && allyId !== m.myHeroId) {
        const cur = map.get(allyId) || {
          heroId: allyId,
          asAlly: 0,
          asEnemy: 0,
          wins: 0,
          losses: 0,
        };
        cur.asAlly += 1;
        if (m.result === 'win') cur.wins += 1;
        else if (m.result === 'loss') cur.losses += 1;
        map.set(allyId, cur);
      }
    }
    for (const enemyId of m.enemies) {
      if (enemyId) {
        const cur = map.get(enemyId) || {
          heroId: enemyId,
          asAlly: 0,
          asEnemy: 0,
          wins: 0,
          losses: 0,
        };
        cur.asEnemy += 1;
        // When user loses, enemy team wins; when user wins, enemy team loses
        if (m.result === 'loss') cur.wins += 1;
        else if (m.result === 'win') cur.losses += 1;
        map.set(enemyId, cur);
      }
    }
  }

  const entries = Array.from(map.values()).map((entry) => {
    const appearances = entry.asAlly + entry.asEnemy;
    const decided = entry.wins + entry.losses;
    const winRate = decided > 0 ? Math.round((entry.wins / decided) * 100) : 0;
    return {
      ...entry,
      appearances,
      winRate,
    };
  });

  entries.sort((a, b) => b.appearances - a.appearances);

  if (entries.length === 0 || entries[0].appearances === 0) return null;

  const top = entries[0];
  const presenceRate = Math.round((top.appearances / matches.length) * 100);

  return {
    heroId: top.heroId,
    hero: getHeroById(top.heroId),
    appearances: top.appearances,
    asAlly: top.asAlly,
    asEnemy: top.asEnemy,
    presenceRate,
    wins: top.wins,
    losses: top.losses,
    winRate: top.winRate,
    isRepresentative: top.appearances >= threshold,
    threshold,
  };
}
