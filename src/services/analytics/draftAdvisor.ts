import { Match, LANE_LABELS } from '../../types/match';
import { HEROES, getHeroById, Hero } from '../../data/heroes';
import { DraftAction, BestActionsAdvisorResult } from './types';
import { getSampleThreshold } from './global';

/**
 * Evaluates a lane matchup score for hero H with partner P against opponents [E1, E2].
 * Uses 5/10 rule threshold to regress low-sample stats towards 50%.
 */
function evaluateLaneScore(
  matches: Match[],
  myHeroId: number,
  partnerId: number | null,
  opponents: number[]
): { score: number; isRepresentative: boolean; threshold: number } {
  const threshold = getSampleThreshold(matches.length);
  const myMatches = matches.filter((m) => m.myHeroId === myHeroId);
  const isRepresentative = myMatches.length >= threshold;
  if (myMatches.length === 0) return { score: 50, isRepresentative: false, threshold };

  let totalWeight = 0;
  let scoreSum = 0;

  // 1. Historical lane encounters against these specific opponents (lane matchup excluded from threshold for now)
  for (const oppId of opponents) {
    const vsMatches = myMatches.filter((m) => m.laneOpponents && m.laneOpponents.includes(oppId));
    if (vsMatches.length > 0) {
      const won = vsMatches.filter((m) => m.laneOutcome === 'won').length;
      const lost = vsMatches.filter((m) => m.laneOutcome === 'lost').length;
      const count = won + lost;
      if (count > 0) {
        const rawWr = (won / count) * 100;
        scoreSum += rawWr * 3; // direct lane history
        totalWeight += 3;
      }
    } else {
      // Fallback: general match winrate against this enemy
      const genMatches = myMatches.filter((m) => m.enemies.includes(oppId));
      const decided = genMatches.filter((m) => m.result === 'win' || m.result === 'loss');
      if (decided.length > 0) {
        const genWins = genMatches.filter((m) => m.result === 'win').length;
        const genWr = (genWins / decided.length) * 100;
        scoreSum += genWr * 1.5;
        totalWeight += 1.5;
      }
    }
  }

  // 2. Synergy with partner (lane matchup excluded from threshold for now)
  if (partnerId) {
    const withMatches = myMatches.filter((m) => m.laneAllyId === partnerId);
    if (withMatches.length > 0) {
      const won = withMatches.filter((m) => m.laneOutcome === 'won').length;
      const lost = withMatches.filter((m) => m.laneOutcome === 'lost').length;
      const count = won + lost;
      if (count > 0) {
        const rawWr = (won / count) * 100;
        scoreSum += rawWr * 2;
        totalWeight += 2;
      }
    } else {
      // Fallback: general ally synergy
      const genAllies = myMatches.filter((m) => m.allies.includes(partnerId));
      const decided = genAllies.filter((m) => m.result === 'win' || m.result === 'loss');
      if (decided.length > 0) {
        const genWins = genAllies.filter((m) => m.result === 'win').length;
        const genWr = (genWins / decided.length) * 100;
        scoreSum += genWr * 1;
        totalWeight += 1;
      }
    }
  }

  // Baseline personal win rate weight
  const decided = myMatches.filter((m) => m.result === 'win' || m.result === 'loss');
  if (decided.length > 0) {
    const personalWr = (myMatches.filter((m) => m.result === 'win').length / decided.length) * 100;
    scoreSum += personalWr * 1;
    totalWeight += 1;
  }

  const finalScore = totalWeight > 0 ? Math.round(scoreSum / totalWeight) : 50;
  return { score: finalScore, isRepresentative, threshold };
}

/**
 * Global optimization engine:
 * Evaluates all combinations of:
 * - (Current Hero OR any available non-picked non-banned Hero)
 * x
 * - (Current Lane OR any lane swap with an ally)
 *
 * Identifies:
 * 1. Absolute #1 Best Action (can involve a swap request)
 * 2. Guaranteed Best Action if swap is denied (without swap, 100% in your control)
 */
export function calculateBestDraftActions(
  matches: Match[],
  currentMyHeroId: number,
  assignedLane: 'yellow' | 'blue' | 'green',
  lanes: Record<'yellow' | 'blue' | 'green', { allies: number[]; enemies: number[] }>,
  allUnavailableHeroIds: number[]
): BestActionsAdvisorResult {
  const currentLaneData = lanes[assignedLane];
  const currentPartnerId = currentLaneData.allies.find((id) => id !== currentMyHeroId) || null;
  const currentOpponentIds = currentLaneData.enemies;

  // Baseline win rate: keeping current hero on current lane
  const { score: currentWr } = evaluateLaneScore(matches, currentMyHeroId, currentPartnerId, currentOpponentIds);

  const threshold = getSampleThreshold(matches.length);

  // Count matches played per hero
  const heroMatchCounts = new Map<number, number>();
  for (const m of matches) {
    heroMatchCounts.set(m.myHeroId, (heroMatchCounts.get(m.myHeroId) || 0) + 1);
  }

  // Candidate heroes to switch to:
  // Must be representative (>= threshold games) to be proposed as an option,
  // not already picked in the match or banned.
  const representativeSwitchHeroes = HEROES.filter(
    (h) =>
      h.id !== currentMyHeroId &&
      !allUnavailableHeroIds.includes(h.id) &&
      (heroMatchCounts.get(h.id) || 0) >= threshold
  ).map((h) => h.id);

  // Graceful fallback only if user has zero representative heroes in history
  const switchCandidates = representativeSwitchHeroes.length > 0
    ? representativeSwitchHeroes
    : HEROES.filter(
        (h) =>
          h.id !== currentMyHeroId &&
          !allUnavailableHeroIds.includes(h.id) &&
          (heroMatchCounts.get(h.id) || 0) > 0
      ).map((h) => h.id);

  const availableHeroIds = [currentMyHeroId, ...switchCandidates];

  const candidateActions: DraftAction[] = [];

  // Possible lane placements:
  // 1. Staying on assigned lane (no swap)
  // 2. Swapping with each ally on each other lane
  interface LaneOption {
    lane: 'yellow' | 'blue' | 'green';
    swapWithAllyId: number | null;
    partnerId: number | null;
    opponents: number[];
  }

  const laneOptions: LaneOption[] = [
    {
      lane: assignedLane,
      swapWithAllyId: null,
      partnerId: currentPartnerId,
      opponents: currentOpponentIds,
    },
  ];

  const otherLanes = (['yellow', 'blue', 'green'] as const).filter((l) => l !== assignedLane);
  for (const otherLane of otherLanes) {
    const alliesOnOtherLane = lanes[otherLane].allies;
    const oppsOnOtherLane = lanes[otherLane].enemies;

    for (const targetAllyId of alliesOnOtherLane) {
      const remainingPartnerId = alliesOnOtherLane.find((id) => id !== targetAllyId) || null;
      laneOptions.push({
        lane: otherLane,
        swapWithAllyId: targetAllyId,
        partnerId: remainingPartnerId,
        opponents: oppsOnOtherLane,
      });
    }
  }

  // Combinatorial evaluation: each candidate hero on each lane option
  for (const heroId of availableHeroIds) {
    const isSameHero = heroId === currentMyHeroId;
    const heroObj = getHeroById(heroId);

    for (const laneOpt of laneOptions) {
      const isSameLane = laneOpt.lane === assignedLane && laneOpt.swapWithAllyId === null;
      const { score, isRepresentative, threshold } = evaluateLaneScore(matches, heroId, laneOpt.partnerId, laneOpt.opponents);
      const delta = score - currentWr;

      let type: DraftAction['type'] = 'stay_current';
      let title = '';
      let description = '';

      const targetAllyObj = laneOpt.swapWithAllyId ? getHeroById(laneOpt.swapWithAllyId) : null;
      const partnerObj = laneOpt.partnerId ? getHeroById(laneOpt.partnerId) : null;
      const oppNames = laneOpt.opponents.map((id) => getHeroById(id)?.name || `#${id}`).join(' & ');

      if (isSameHero && isSameLane) {
        type = 'stay_current';
        title = `Keep ${heroObj?.name} on ${LANE_LABELS[assignedLane]}`;
        description = `Maintain your current setup facing ${oppNames}.`;
      } else if (!isSameHero && isSameLane) {
        type = 'switch_hero_only';
        title = `Switch Hero to ${heroObj?.name} (Stay on ${LANE_LABELS[assignedLane]})`;
        description = `Switch to ${heroObj?.name} without changing lane to counter ${oppNames}.`;
      } else if (isSameHero && !isSameLane) {
        type = 'swap_lane_only';
        title = `Swap Lane to ${LANE_LABELS[laneOpt.lane]} (with ${targetAllyObj?.name})`;
        description = `Keep ${heroObj?.name} and ask ${targetAllyObj?.name} to swap so you duo with ${partnerObj?.name || 'partner'} against ${oppNames}.`;
      } else {
        type = 'swap_lane_and_switch_hero';
        title = `Swap to ${LANE_LABELS[laneOpt.lane]} (with ${targetAllyObj?.name}) AND Switch to ${heroObj?.name}`;
        description = `Ask ${targetAllyObj?.name} to swap lane AND switch hero to ${heroObj?.name} for optimal synergy and counter against ${oppNames}.`;
      }

      candidateActions.push({
        id: `${heroId}-${laneOpt.lane}-${laneOpt.swapWithAllyId || 'none'}`,
        type,
        heroId,
        hero: heroObj,
        lane: laneOpt.lane,
        laneSwapWithAllyId: laneOpt.swapWithAllyId,
        duoPartnerId: laneOpt.partnerId,
        opponents: laneOpt.opponents,
        projectedWinRate: score,
        deltaVsCurrent: delta,
        isSwapRequested: laneOpt.swapWithAllyId !== null,
        isRepresentative,
        threshold,
        title,
        description,
      });
    }
  }

  // Sort descending by projected win rate, prioritizing representative actions
  candidateActions.sort((a, b) => {
    if (a.isRepresentative !== b.isRepresentative) {
      return a.isRepresentative ? -1 : 1;
    }
    if (b.projectedWinRate !== a.projectedWinRate) {
      return b.projectedWinRate - a.projectedWinRate;
    }
    // tie-breaker: prefer no swap over swap
    if (!a.isSwapRequested && b.isSwapRequested) return -1;
    if (a.isSwapRequested && !b.isSwapRequested) return 1;
    return 0;
  });

  // Only propose representative solutions (>= threshold games).
  // Fallback to all candidate actions only if player has zero representative actions.
  const representativeActions = candidateActions.filter((a) => a.isRepresentative);
  const eligibleActions = representativeActions.length > 0 ? representativeActions : candidateActions;

  // 1. Best overall action (any possibility)
  const bestOverallAction = eligibleActions[0] || candidateActions[0];

  // 2. Best safe action that does not require teammate approval
  const safeActions = eligibleActions.filter((a) => !a.isSwapRequested);
  const bestSafeActionWithoutSwap = safeActions[0] || eligibleActions[0] || candidateActions[0];

  return {
    currentProjectedWinRate: currentWr,
    currentHero: getHeroById(currentMyHeroId),
    currentLane: assignedLane,
    currentPartner: currentPartnerId ? getHeroById(currentPartnerId) : undefined,
    currentOpponents: currentOpponentIds.map((id) => getHeroById(id)).filter((h): h is Hero => h !== undefined),
    bestOverallAction,
    bestSafeActionWithoutSwap,
    allRankedActions: eligibleActions.slice(0, 10),
  };
}
