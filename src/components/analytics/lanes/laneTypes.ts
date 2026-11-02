import { LaneDistributionStat } from '../../../services/analytics';

export type TableSortField = 'hero' | 'lanes' | 'laneWins' | 'laneScore' | 'gameWinRate';
export type MatchupTab = 'opponents' | 'allies';

/**
 * Raw cumulative lane score: Win: +2, Even: +1, Loss: -2
 */
export function calculateLaneScore(laneWins: number, laneEvens: number, laneLosses: number): number {
  return (laneWins * 2) + (laneEvens * 1) - (laneLosses * 2);
}

/**
 * Normalized Lane Dominance Rating (0% to 100%):
 * Eliminates match count volume bias by projecting average score [-2, +2] onto [0, 100%].
 * - 100%: All lanes won
 * - 75%: All lanes even (or 50% Win, 50% Even)
 * - 50%: Pure neutral balance (e.g. 50% Win, 50% Loss)
 * - 0%: All lanes lost
 */
export function calculateLaneDominance(laneWins: number, laneEvens: number, laneLosses: number): number {
  const total = laneWins + laneEvens + laneLosses;
  if (total === 0) return 50;
  const rawScore = (laneWins * 2) + (laneEvens * 1) - (laneLosses * 2);
  const avgScore = rawScore / total; // Range: [-2.0, +2.0]
  const dominance = ((avgScore + 2) / 4) * 100;
  return Math.round(dominance);
}

/**
 * Average Lane Score per match (-2.00 to +2.00)
 */
export function calculateAverageLaneScore(laneWins: number, laneEvens: number, laneLosses: number): number {
  const total = laneWins + laneEvens + laneLosses;
  if (total === 0) return 0;
  const rawScore = (laneWins * 2) + (laneEvens * 1) - (laneLosses * 2);
  return Number((rawScore / total).toFixed(2));
}

export interface DominanceTier {
  id: 'dominant' | 'advantage' | 'balanced' | 'contested' | 'vulnerable';
  min: number;
  label: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  glowClass: string;
  dotColor: string;
}

/**
 * 5-tier chromatic evaluation system across the 0-100% dominance scale:
 * 1. Dominant (>= 80%): Emerald green
 * 2. Advantage (65% - 79%): Sky cyan
 * 3. Balanced (50% - 64%): Amber gold
 * 4. Contested (35% - 49%): Warm orange
 * 5. Vulnerable (< 35%): Crimson rose
 */
export function getDominanceTier(dominance: number): DominanceTier {
  if (dominance >= 80) {
    return {
      id: 'dominant',
      min: 80,
      label: 'Dominant',
      colorClass: 'text-emerald-400',
      bgClass: 'bg-emerald-500/15',
      borderClass: 'border-emerald-500/30 hover:border-emerald-500/60',
      glowClass: 'drop-shadow-[0_0_8px_rgba(52,211,153,0.35)]',
      dotColor: 'bg-emerald-400 shadow-emerald-400/50',
    };
  }
  if (dominance >= 65) {
    return {
      id: 'advantage',
      min: 65,
      label: 'Advantage',
      colorClass: 'text-sky-400',
      bgClass: 'bg-sky-500/15',
      borderClass: 'border-sky-500/30 hover:border-sky-500/60',
      glowClass: 'drop-shadow-[0_0_8px_rgba(56,189,248,0.35)]',
      dotColor: 'bg-sky-400 shadow-sky-400/50',
    };
  }
  if (dominance >= 50) {
    return {
      id: 'balanced',
      min: 50,
      label: 'Balanced',
      colorClass: 'text-yellow-400',
      bgClass: 'bg-yellow-500/15',
      borderClass: 'border-yellow-500/30 hover:border-yellow-500/60',
      glowClass: 'drop-shadow-[0_0_8px_rgba(250,204,21,0.35)]',
      dotColor: 'bg-yellow-400 shadow-yellow-400/50',
    };
  }
  if (dominance >= 35) {
    return {
      id: 'contested',
      min: 35,
      label: 'Contested',
      colorClass: 'text-orange-400',
      bgClass: 'bg-orange-500/15',
      borderClass: 'border-orange-500/30 hover:border-orange-500/60',
      glowClass: 'drop-shadow-[0_0_8px_rgba(251,146,60,0.35)]',
      dotColor: 'bg-orange-400 shadow-orange-400/50',
    };
  }
  return {
    id: 'vulnerable',
    min: 0,
    label: 'Vulnerable',
    colorClass: 'text-rose-400',
    bgClass: 'bg-rose-500/15',
    borderClass: 'border-rose-500/30 hover:border-rose-500/60',
    glowClass: 'drop-shadow-[0_0_8px_rgba(244,63,94,0.35)]',
    dotColor: 'bg-rose-400 shadow-rose-400/50',
  };
}

export interface LaneCardConfig {
  key: 'yellow' | 'blue' | 'green';
  label: string;
  colorClass: string;
  borderClass: string;
  bgGlowClass: string;
  dotClass: string;
  stat: LaneDistributionStat;
}
