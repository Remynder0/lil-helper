import { Match } from '../../types/match';
import { getHeroById } from '../../data/heroes';
import {
  LaneDistributionStat,
  LaneOutcomeConversion,
  DirectLaneOpponentStat,
  DirectLaneAllyStat,
  LaneAnalyticsSummary,
} from './types';
import { getSampleThreshold } from './global';

/**
 * Computes lane-specific metrics across 3 lanes (Yellow, Blue, Green).
 * Gracefully ignores matches without lane data for 100% backwards-compatibility.
 */
export function calculateLaneAnalytics(
  matches: Match[],
  playerHeroId: number | null = null
): LaneAnalyticsSummary {
  const threshold = getSampleThreshold(matches.length);
  const filtered = playerHeroId !== null
    ? matches.filter((m) => m.myHeroId === playerHeroId)
    : matches;

  const lanesMap: Record<'yellow' | 'blue' | 'green', LaneDistributionStat> = {
    yellow: { lane: 'yellow', matches: 0, wins: 0, losses: 0, cancels: 0, winRate: 0, laneWins: 0, laneLosses: 0, laneEvens: 0 },
    blue: { lane: 'blue', matches: 0, wins: 0, losses: 0, cancels: 0, winRate: 0, laneWins: 0, laneLosses: 0, laneEvens: 0 },
    green: { lane: 'green', matches: 0, wins: 0, losses: 0, cancels: 0, winRate: 0, laneWins: 0, laneLosses: 0, laneEvens: 0 },
  };

  const outcomesMap: Record<'won' | 'lost' | 'even', LaneOutcomeConversion> = {
    won: { outcome: 'won', matches: 0, gameWins: 0, gameLosses: 0, conversionWinRate: 0 },
    lost: { outcome: 'lost', matches: 0, gameWins: 0, gameLosses: 0, conversionWinRate: 0 },
    even: { outcome: 'even', matches: 0, gameWins: 0, gameLosses: 0, conversionWinRate: 0 },
  };

  const opponentMap = new Map<number, { faced: number; lWins: number; lLosses: number; lEvens: number; gWins: number; gLosses: number }>();
  const allyMap = new Map<number, { together: number; lWins: number; lLosses: number; lEvens: number; gWins: number; gLosses: number }>();

  let trackedCount = 0;

  for (const m of filtered) {
    if (!m.lane) continue; // match has no lane data yet
    trackedCount += 1;

    // 1. Lane breakdown
    const laneStat = lanesMap[m.lane];
    if (laneStat) {
      laneStat.matches += 1;
      if (m.result === 'win') laneStat.wins += 1;
      else if (m.result === 'loss') laneStat.losses += 1;
      else if (m.result === 'cancel') laneStat.cancels += 1;

      if (m.laneOutcome === 'won') laneStat.laneWins += 1;
      else if (m.laneOutcome === 'lost') laneStat.laneLosses += 1;
      else if (m.laneOutcome === 'even') laneStat.laneEvens += 1;
    }

    // 2. Lane outcome to game win conversion
    if (m.laneOutcome) {
      const outcomeStat = outcomesMap[m.laneOutcome];
      if (outcomeStat) {
        outcomeStat.matches += 1;
        if (m.result === 'win') outcomeStat.gameWins += 1;
        else if (m.result === 'loss') outcomeStat.gameLosses += 1;
      }
    }

    // 3. Direct lane opponents
    if (m.laneOpponents && m.laneOpponents.length > 0) {
      for (const oppId of m.laneOpponents) {
        const cur = opponentMap.get(oppId) || { faced: 0, lWins: 0, lLosses: 0, lEvens: 0, gWins: 0, gLosses: 0 };
        cur.faced += 1;
        if (m.laneOutcome === 'won') cur.lWins += 1;
        else if (m.laneOutcome === 'lost') cur.lLosses += 1;
        else if (m.laneOutcome === 'even') cur.lEvens += 1;

        if (m.result === 'win') cur.gWins += 1;
        else if (m.result === 'loss') cur.gLosses += 1;
        opponentMap.set(oppId, cur);
      }
    }

    // 4. Direct lane partner ally
    if (m.laneAllyId) {
      const cur = allyMap.get(m.laneAllyId) || { together: 0, lWins: 0, lLosses: 0, lEvens: 0, gWins: 0, gLosses: 0 };
      cur.together += 1;
      if (m.laneOutcome === 'won') cur.lWins += 1;
      else if (m.laneOutcome === 'lost') cur.lLosses += 1;
      else if (m.laneOutcome === 'even') cur.lEvens += 1;

      if (m.result === 'win') cur.gWins += 1;
      else if (m.result === 'loss') cur.gLosses += 1;
      allyMap.set(m.laneAllyId, cur);
    }
  }

  // Calculate percentages for lanes
  (['yellow', 'blue', 'green'] as const).forEach((color) => {
    const l = lanesMap[color];
    const decided = l.wins + l.losses;
    l.winRate = decided > 0 ? Math.round((l.wins / decided) * 100) : 0;
  });

  // Calculate conversion rates
  (['won', 'lost', 'even'] as const).forEach((out) => {
    const o = outcomesMap[out];
    const decided = o.gameWins + o.gameLosses;
    o.conversionWinRate = decided > 0 ? Math.round((o.gameWins / decided) * 100) : 0;
  });

  // Opponents list
  const opponents: DirectLaneOpponentStat[] = [];
  for (const [oppId, stat] of opponentMap.entries()) {
    const lDecided = stat.lWins + stat.lLosses;
    const laneWinRate = lDecided > 0 ? Math.round((stat.lWins / lDecided) * 100) : 0;
    const gDecided = stat.gWins + stat.gLosses;
    const gameWinRate = gDecided > 0 ? Math.round((stat.gWins / gDecided) * 100) : 0;
    opponents.push({
      opponentHeroId: oppId,
      opponentHero: getHeroById(oppId),
      lanesFaced: stat.faced,
      laneWins: stat.lWins,
      laneLosses: stat.lLosses,
      laneEvens: stat.lEvens,
      laneWinRate,
      gameWins: stat.gWins,
      gameLosses: stat.gLosses,
      gameWinRate,
      isRepresentative: stat.faced >= threshold,
      threshold,
    });
  }
  opponents.sort((a, b) => b.lanesFaced - a.lanesFaced);

  // Allies list
  const allies: DirectLaneAllyStat[] = [];
  for (const [allyId, stat] of allyMap.entries()) {
    const lDecided = stat.lWins + stat.lLosses;
    const laneWinRate = lDecided > 0 ? Math.round((stat.lWins / lDecided) * 100) : 0;
    const gDecided = stat.gWins + stat.gLosses;
    const gameWinRate = gDecided > 0 ? Math.round((stat.gWins / gDecided) * 100) : 0;
    allies.push({
      allyHeroId: allyId,
      allyHero: getHeroById(allyId),
      lanesTogether: stat.together,
      laneWins: stat.lWins,
      laneLosses: stat.lLosses,
      laneEvens: stat.lEvens,
      laneWinRate,
      gameWins: stat.gWins,
      gameLosses: stat.gLosses,
      gameWinRate,
      isRepresentative: stat.together >= threshold,
      threshold,
    });
  }
  allies.sort((a, b) => b.lanesTogether - a.lanesTogether);

  return {
    totalLaneTrackedMatches: trackedCount,
    lanes: lanesMap,
    outcomes: outcomesMap,
    opponents,
    allies,
  };
}
