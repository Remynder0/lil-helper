import React, { useState } from 'react';
import {
  LaneCardConfig,
  calculateLaneScore,
  calculateLaneDominance,
  calculateAverageLaneScore,
  getDominanceTier,
} from './laneTypes';
import { LaneVialGauge, OutcomeType, VialDisplayMode } from '../vials';

export interface LaneVialCardProps {
  laneConfig: LaneCardConfig;
  totalTrackedGames: number;
  displayMode?: VialDisplayMode;
}

export const LaneVialCard: React.FC<LaneVialCardProps> = ({
  laneConfig,
  displayMode,
}) => {
  const { key, label, colorClass, borderClass, bgGlowClass, dotClass, stat } = laneConfig;
  const [hoveredOutcome, setHoveredOutcome] = useState<OutcomeType | null>(null);

  const totalOutcomes = stat.laneWins + stat.laneEvens + stat.laneLosses;
  const winPct = totalOutcomes > 0 ? Math.round((stat.laneWins / totalOutcomes) * 100) : 0;
  const evenPct = totalOutcomes > 0 ? Math.round((stat.laneEvens / totalOutcomes) * 100) : 0;
  const lossPct = totalOutcomes > 0 ? Math.max(0, 100 - winPct - evenPct) : 0;

  // Lane Score and Normalized Dominance Rating (0-100%, 5 tiers)
  const laneScore = calculateLaneScore(stat.laneWins, stat.laneEvens, stat.laneLosses);
  const dominance = calculateLaneDominance(stat.laneWins, stat.laneEvens, stat.laneLosses);
  const avgScore = calculateAverageLaneScore(stat.laneWins, stat.laneEvens, stat.laneLosses);
  const tier = getDominanceTier(dominance);

  return (
    <div
      className={`steam-glass steam-panel border ${borderClass} rounded-xl p-4 flex flex-col gap-3.5 relative overflow-hidden transition-all`}
    >
      <div className={`absolute top-0 right-0 w-32 h-32 ${bgGlowClass} rounded-full blur-2xl pointer-events-none`} />

      {/* Card Header: Lane name on left, Match winrate over games on right */}
      <div className="flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <span className={`w-3 h-3 rounded-full shadow-sm ${dotClass}`} />
          <span className={`font-bold text-sm ${colorClass}`}>{label}</span>
        </div>
        {/* Match Winrate over total games */}
        <span className="text-xs text-deadlock-muted font-mono bg-deadlock-dark/80 px-2.5 py-0.5 rounded border border-deadlock-border/60">
          {stat.winRate}% winrate over {stat.matches} {stat.matches === 1 ? 'game' : 'games'}
        </span>
      </div>

      {/* Vertical Alchemical Flask + Interactive Lane Score Details */}
      <div className="flex items-center justify-between gap-4 z-10 py-1">
        {/* Unified Lane Vial Gauge (Switches between ECharts and Classic based on displayMode) */}
        <div className="flex flex-col items-center gap-1 shrink-0">
          <LaneVialGauge
            laneKey={key}
            stat={stat}
            hoveredOutcome={hoveredOutcome}
            onHoverOutcome={setHoveredOutcome}
            displayMode={displayMode}
          />
        </div>

        {/* Right side: Dynamic Hover Breakdown + Prominent Lane Score */}
        <div className="flex flex-col justify-between flex-1 gap-2.5">
          {/* Dynamic Hover Outcome Display */}
          <div className="h-14 flex items-center justify-center p-2 rounded-lg bg-deadlock-dark/80 border border-deadlock-border/40 transition-all text-center">
            {hoveredOutcome === 'won' ? (
              <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/60" />
                <span className="font-bold">Lane Won:</span>
                <span className="text-sm font-black">{stat.laneWins} games</span>
                <span className="text-emerald-300">({winPct}%)</span>
              </div>
            ) : hoveredOutcome === 'even' ? (
              <div className="flex items-center gap-2 text-yellow-400 font-mono text-xs">
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 shadow-sm shadow-yellow-400/60" />
                <span className="font-bold">Lane Even:</span>
                <span className="text-sm font-black">{stat.laneEvens} games</span>
                <span className="text-yellow-300">({evenPct}%)</span>
              </div>
            ) : hoveredOutcome === 'lost' ? (
              <div className="flex items-center gap-2 text-rose-400 font-mono text-xs">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-sm shadow-rose-500/60" />
                <span className="font-bold">Lane Lost:</span>
                <span className="text-sm font-black">{stat.laneLosses} games</span>
                <span className="text-rose-300">({lossPct}%)</span>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center">
                <div className="text-xs font-mono font-bold">
                  <span
                    className="text-deadlock-win cursor-pointer hover:underline"
                    onMouseEnter={() => setHoveredOutcome('won')}
                    onMouseLeave={() => setHoveredOutcome(null)}
                  >
                    {stat.laneWins}W
                  </span>
                  <span className="text-deadlock-muted font-normal mx-1">-</span>
                  <span
                    className="text-yellow-400 cursor-pointer hover:underline"
                    onMouseEnter={() => setHoveredOutcome('even')}
                    onMouseLeave={() => setHoveredOutcome(null)}
                  >
                    {stat.laneEvens}E
                  </span>
                  <span className="text-deadlock-muted font-normal mx-1">-</span>
                  <span
                    className="text-deadlock-loss cursor-pointer hover:underline"
                    onMouseEnter={() => setHoveredOutcome('lost')}
                    onMouseLeave={() => setHoveredOutcome(null)}
                  >
                    {stat.laneLosses}L
                  </span>
                </div>
                <span className="text-[10px] text-deadlock-muted mt-0.5">
                  Hover vial layers for breakdown
                </span>
              </div>
            )}
          </div>

          {/* Lane Dominance Box (Normalized 0-100%, 5 Color Tiers) */}
          <div
            className={`flex flex-col items-center justify-center p-3 rounded-xl bg-deadlock-dark/90 border ${tier.borderClass} text-center shadow-inner cursor-help transition-all hover:bg-deadlock-card/40`}
            title={`Lane Dominance: ${stat.matches > 0 ? `${dominance}%` : 'N/A'} (Tier: ${tier.label})\n• Average Score: ${avgScore > 0 ? `+${avgScore}` : avgScore} pts / match\n• Cumulative Total: ${laneScore > 0 ? `+${laneScore}` : laneScore} pts\n• Scoring Rules: Win (+2), Even (+1), Loss (-2)`}
          >
            <div className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${tier.dotColor}`} />
              <span className="text-[10px] uppercase font-bold tracking-wider text-deadlock-muted">
                Lane Dominance
              </span>
            </div>

            <div className="flex items-baseline gap-1 mt-0.5">
              <span
                className={`text-3xl font-black font-mono tracking-tight ${tier.colorClass} ${tier.glowClass}`}
              >
                {stat.matches > 0 ? `${dominance}%` : 'N/A'}
              </span>
            </div>

            {/* Sub-label: Tier name + cumulative total */}
            {stat.matches > 0 ? (
              <div className="flex items-center gap-1 mt-0.5 text-[10px] font-mono">
                <span className={`font-bold ${tier.colorClass}`}>{tier.label}</span>
              </div>
            ) : (
              <span className="text-[10px] text-deadlock-muted mt-0.5 font-mono">No games yet</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
