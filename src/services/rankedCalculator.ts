/**
 * Calculateur de progression Ranked pour Deadlock.
 * Déduit automatiquement les points gagnés/perdus, les sous-rangs et la consommation
 * de boucliers de rétrogradation selon les règles officielles du jeu.
 */

import { Match, MatchResult } from '../types/match';

/**
 * Barème des victoires consécutives selon Deadlock :
 * 1ère victoire : +300
 * 2ème victoire : +300
 * 3ème victoire : +370
 * 4ème victoire : +390
 * 5ème victoire : +410
 * 6ème victoire et plus : +430
 */
export const WINSTREAK_POINTS: readonly number[] = [300, 300, 370, 390, 410, 430];

export interface CalculatedRankedProgression {
  rankedBadge: number | null;
  rankedRank: number | null;
  rankedSubrank: number | null;
  rankedDelta: number | null;
  rankedProgress: number | null;
  rankedInitialProgress: number | null;
  rankedDemotionProtection: number | null;
  rankedConsumedDemotionProtection: boolean | null;
  summaryNote: string;
}

/**
 * Compte le nombre de victoires consécutives immédiates avant la date donnée.
 */
export function calculateWinStreakBefore(matchDate: string, allMatches: Match[]): number {
  const sorted = allMatches
    .filter((m) => m.date < matchDate && m.result !== 'cancel')
    .sort((a, b) => b.date.localeCompare(a.date));

  let streak = 0;
  for (const m of sorted) {
    if (m.result === 'win') {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

/**
 * Trouve le match immédiatement précédent ayant des données de progression ranked.
 */
export function findPreviousRankedMatch(matchDate: string, allMatches: Match[]): Match | null {
  const sorted = allMatches
    .filter(
      (m) =>
        m.date < matchDate &&
        m.rankedProgress !== undefined &&
        m.rankedProgress !== null
    )
    .sort((a, b) => b.date.localeCompare(a.date));

  return sorted[0] || null;
}

/**
 * Calcule la progression ranked pour un match (typiquement importé via .dem).
 *
 * @param result - Résultat du match ('win' | 'loss' | 'cancel')
 * @param matchDate - Date ISO du match
 * @param allMatches - Liste de tous les matchs enregistrés dans l'app
 */
export function calculateRankedProgression(
  result: MatchResult,
  matchDate: string,
  allMatches: Match[]
): CalculatedRankedProgression {
  const prevMatch = findPreviousRankedMatch(matchDate, allMatches);

  // Si aucun match précédent n'a de rankedProgress enregistré, on ne peut pas déduire
  if (!prevMatch || prevMatch.rankedProgress === undefined || prevMatch.rankedProgress === null) {
    return {
      rankedBadge: null,
      rankedRank: null,
      rankedSubrank: null,
      rankedDelta: null,
      rankedProgress: null,
      rankedInitialProgress: null,
      rankedDemotionProtection: null,
      rankedConsumedDemotionProtection: null,
      summaryNote: `⏳ Initial ranked data not found in preceding history.`,
    };
  }

  const initialProgress = prevMatch.rankedProgress;
  const initialShields = prevMatch.rankedDemotionProtection ?? 2;
  const initialRank =
    prevMatch.rankedRank ||
    (prevMatch.rankedBadge ? Math.floor(prevMatch.rankedBadge / 10) : Math.floor(initialProgress / 6000) + 1);
  const initialSubrank =
    prevMatch.rankedSubrank ||
    (prevMatch.rankedBadge
      ? prevMatch.rankedBadge % 10
      : Math.min(6, Math.max(1, Math.floor((initialProgress % 6000) / 1000) + 1)));

  let delta: number;
  let finalProgress: number;
  let remainingShields: number = initialShields;
  let consumedDemotionProtection = false;
  let detailsText = '';

  if (result === 'win') {
    const currentStreak = calculateWinStreakBefore(matchDate, allMatches);
    const streakIndex = Math.min(currentStreak, WINSTREAK_POINTS.length - 1);
    const winPoints = WINSTREAK_POINTS[streakIndex];

    delta = winPoints;
    finalProgress = initialProgress + delta;
    detailsText = `Victory (+${delta} pts, streak: ${currentStreak + 1})`;
  } else if (result === 'loss') {
    const desiredLoss = 300;
    // Subrank floor (previous multiple of 1000)
    const subrankFloor = Math.floor(initialProgress / 1000) * 1000;
    const pointsAboveFloor = initialProgress - subrankFloor;

    if (pointsAboveFloor < desiredLoss && initialShields > 0) {
      // Demotion protection shield absorbs the fall below the floor
      consumedDemotionProtection = true;
      remainingShields = Math.max(0, initialShields - 1);
      finalProgress = subrankFloor;
      delta = -pointsAboveFloor; // Effective loss limited to floor (e.g. 100 -> 0 = -100)
      detailsText = `Defeat (${delta} pts, shield consumed: ${remainingShields} left)`;
    } else if (pointsAboveFloor < desiredLoss && initialShields <= 0) {
      // No shield: demotion to lower subrank
      delta = -desiredLoss;
      finalProgress = Math.max(0, initialProgress + delta);
      detailsText = `Defeat (${delta} pts, demoted without shield)`;
    } else {
      // Normal loss within subrank
      delta = -desiredLoss;
      finalProgress = initialProgress + delta;
      detailsText = `Defeat (${delta} pts)`;
    }
  } else {
    // Cancelled
    delta = 0;
    finalProgress = initialProgress;
    detailsText = `Cancelled match (0 pts)`;
  }

  // Calculate new rank and subrank
  const newRank = Math.max(1, Math.floor(finalProgress / 6000) + 1);
  const newSubrank = Math.min(6, Math.max(1, Math.floor((finalProgress % 6000) / 1000) + 1));
  const newBadge = newRank * 10 + newSubrank;

  // Promotion & demotion detection
  const isPromotion =
    newRank > initialRank || (newRank === initialRank && newSubrank > initialSubrank);
  const isDemotion =
    newRank < initialRank || (newRank === initialRank && newSubrank < initialSubrank);

  if (isPromotion) {
    remainingShields = newSubrank === 1 ? 5 : 2;
    detailsText += ` | Promotion Tier ${newRank}-${newSubrank} (${remainingShields} shields)`;
  } else if (isDemotion) {
    remainingShields = newSubrank === 1 ? 5 : 2;
    detailsText += ` | Demotion Tier ${newRank}-${newSubrank} (${remainingShields} shields)`;
  }

  const summaryNote = `Calculated Ranked: ${detailsText} | Total: ${finalProgress} pts`;

  return {
    rankedBadge: newBadge,
    rankedRank: newRank,
    rankedSubrank: newSubrank,
    rankedDelta: delta,
    rankedProgress: finalProgress,
    rankedInitialProgress: initialProgress,
    rankedDemotionProtection: remainingShields,
    rankedConsumedDemotionProtection: consumedDemotionProtection,
    summaryNote,
  };
}
