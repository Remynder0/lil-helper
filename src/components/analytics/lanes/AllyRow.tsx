import React from 'react';
import { DirectLaneAllyStat } from '../../../services/analytics';
import { HeroAvatar } from '../../HeroAvatar';
import { calculateLaneScore, calculateLaneDominance, getDominanceTier } from './laneTypes';

export interface AllyRowProps {
  ally: DirectLaneAllyStat;
  isLowSample: boolean;
  threshold?: number;
}

export const AllyRow: React.FC<AllyRowProps> = ({ ally, isLowSample, threshold }) => {
  const laneScore = calculateLaneScore(ally.laneWins, ally.laneEvens, ally.laneLosses);
  const dominance = calculateLaneDominance(ally.laneWins, ally.laneEvens, ally.laneLosses);
  const tier = getDominanceTier(dominance);

  return (
    <tr
      className={`transition-all duration-200 ${
        isLowSample
          ? 'opacity-40 blur-[1px] hover:blur-none hover:opacity-100 bg-deadlock-card/20 hover:bg-deadlock-card/60'
          : 'hover:bg-deadlock-card/50'
      }`}
      title={isLowSample ? `Low sample size (${ally.lanesTogether} < ${threshold ?? 3} matches) — hover to reveal` : undefined}
    >
      <td className="py-3 px-4">
        <div className="flex items-center gap-2.5">
          <HeroAvatar heroId={ally.allyHeroId} size="xs" />
          <span className="font-bold text-deadlock-steam">{ally.allyHero?.name}</span>
          {isLowSample && (
            <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-mono">
              Low Sample
            </span>
          )}
        </div>
      </td>
      <td className="py-3 px-4 font-mono text-deadlock-steam font-semibold">
        {ally.lanesTogether}
      </td>
      {/* Laning Phase Record: xW - xE - xL (with E in Yellow) */}
      <td className="py-3 px-4 font-mono">
        <div className="flex items-center gap-1.5 font-bold">
          <span className="text-deadlock-win">{ally.laneWins}W</span>
          <span className="text-deadlock-muted font-normal">-</span>
          <span className="text-yellow-400">{ally.laneEvens}E</span>
          <span className="text-deadlock-muted font-normal">-</span>
          <span className="text-deadlock-loss">{ally.laneLosses}L</span>
        </div>
      </td>
      {/* Lane Dominance Badge */}
      <td className="py-3 px-4 font-mono">
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-bold border cursor-help transition-all ${tier.bgClass} ${tier.colorClass} ${tier.borderClass}`}
          title={`Lane Dominance: ${dominance}% (${tier.label})\n• Cumulative score: ${laneScore > 0 ? `+${laneScore}` : laneScore} pts\n• Scoring rules: Win (+2), Even (+1), Loss (-2)`}
        >
          <span>{dominance}%</span>
        </span>
      </td>
      <td className="py-3 px-4 font-mono text-right">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border ${
            ally.gameWinRate >= 50
              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
              : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
          }`}
        >
          {ally.gameWinRate}%
        </span>
        <span className="text-[11px] text-deadlock-muted ml-2 font-mono">
          ({ally.gameWins}W - {ally.gameLosses}L)
        </span>
      </td>
    </tr>
  );
};
