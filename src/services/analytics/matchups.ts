import { Match } from '../../types/match';
import { getHeroById } from '../../data/heroes';
import { EnemyMatchupStat, AllySynergyStat } from './types';

/**
 * Computes matchup statistics against enemy heroes.
 * If playerHeroId is provided, filters to matches where user played that hero (e.g. Abrams vs Bebop).
 * If playerHeroId is null, computes global matchup against each enemy hero across all user picks.
 */
export function calculateEnemyMatchups(
  matches: Match[],
  playerHeroId: number | null = null
): EnemyMatchupStat[] {
  const filtered = playerHeroId !== null
    ? matches.filter((m) => m.myHeroId === playerHeroId)
    : matches;

  const map = new Map<number, { matchesAgainst: number; wins: number; losses: number; cancels: number }>();

  for (const m of filtered) {
    for (const enemyId of m.enemies) {
      const current = map.get(enemyId) || { matchesAgainst: 0, wins: 0, losses: 0, cancels: 0 };
      current.matchesAgainst += 1;
      if (m.result === 'win') current.wins += 1;
      else if (m.result === 'loss') current.losses += 1;
      else if (m.result === 'cancel') current.cancels += 1;
      map.set(enemyId, current);
    }
  }

  const list: EnemyMatchupStat[] = [];
  for (const [enemyHeroId, stat] of map.entries()) {
    const decided = stat.wins + stat.losses;
    const winRate = decided > 0 ? Math.round((stat.wins / decided) * 100) : 0;
    list.push({
      enemyHeroId,
      enemyHero: getHeroById(enemyHeroId),
      matchesAgainst: stat.matchesAgainst,
      wins: stat.wins,
      losses: stat.losses,
      cancels: stat.cancels,
      winRate,
    });
  }

  return list;
}

/**
 * Computes ally synergy statistics.
 * If playerHeroId is provided, filters to matches where user played that hero (e.g. Abrams + Dynamo).
 * If playerHeroId is null, computes synergy across all matches played.
 */
export function calculateAllySynergies(
  matches: Match[],
  playerHeroId: number | null = null
): AllySynergyStat[] {
  const filtered = playerHeroId !== null
    ? matches.filter((m) => m.myHeroId === playerHeroId)
    : matches;

  const map = new Map<number, { matchesWith: number; wins: number; losses: number; cancels: number }>();

  for (const m of filtered) {
    for (const allyId of m.allies) {
      const current = map.get(allyId) || { matchesWith: 0, wins: 0, losses: 0, cancels: 0 };
      current.matchesWith += 1;
      if (m.result === 'win') current.wins += 1;
      else if (m.result === 'loss') current.losses += 1;
      else if (m.result === 'cancel') current.cancels += 1;
      map.set(allyId, current);
    }
  }

  const list: AllySynergyStat[] = [];
  for (const [allyHeroId, stat] of map.entries()) {
    const decided = stat.wins + stat.losses;
    const winRate = decided > 0 ? Math.round((stat.wins / decided) * 100) : 0;
    list.push({
      allyHeroId,
      allyHero: getHeroById(allyHeroId),
      matchesWith: stat.matchesWith,
      wins: stat.wins,
      losses: stat.losses,
      cancels: stat.cancels,
      winRate,
    });
  }

  return list;
}
