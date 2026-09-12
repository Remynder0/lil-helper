import React from 'react';
import { LANE_LABELS } from '../../types/match';
import { getHeroById } from '../../data/heroes';
import { HeroAvatar } from '../HeroAvatar';
import { Sparkles, Users, ArrowRight, ArrowRightLeft } from 'lucide-react';
import { BestActionsAdvisorResult } from '../../services/analytics';

interface DraftDecisionTreeProps {
  bestActionsAdvisor: BestActionsAdvisorResult | null;
  myHeroId: number | null;
}

export const DraftDecisionTree: React.FC<DraftDecisionTreeProps> = ({
  bestActionsAdvisor,
  myHeroId,
}) => {
  return (
    <div className="bg-deadlock-panel border border-deadlock-border rounded-xl p-5 flex flex-col gap-5 relative overflow-hidden">
      <div className="flex items-center justify-between pb-3 border-b border-deadlock-border/60">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-deadlock-accent" />
          <h3 className="font-bold text-sm uppercase tracking-wide text-gray-100">
            Recommended Draft & Lane Actions
          </h3>
        </div>
        {bestActionsAdvisor && myHeroId && (
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-deadlock-muted">Current projected WR:</span>
            <span className="font-black px-2 py-0.5 rounded bg-deadlock-dark border border-deadlock-border text-gray-200">
              {bestActionsAdvisor.currentProjectedWinRate}% WR
            </span>
          </div>
        )}
      </div>

      {!myHeroId ? (
        <div className="py-8 flex flex-col items-center justify-center text-center text-deadlock-muted">
          <Users className="w-8 h-8 mb-2 opacity-40 text-deadlock-accent" />
          <p className="text-xs italic">
            Click on an allied hero slot on your lane to set your hero and display action recommendations.
          </p>
        </div>
      ) : bestActionsAdvisor ? (
        (() => {
          const currentHero = bestActionsAdvisor.currentHero;
          const currentLane = bestActionsAdvisor.currentLane;
          const bestOverall = bestActionsAdvisor.bestOverallAction;
          const bestSafe = bestActionsAdvisor.bestSafeActionWithoutSwap;

          const isSwapSuggested = bestOverall.isSwapRequested && bestOverall.id !== bestSafe.id;

          return (
            <div className="w-full overflow-x-auto py-2">
              <div className="min-w-[700px] flex items-center">
                {/* ROOT NODE: Current Hero + Current Lane + Current Projected WR */}
                <div className="flex flex-col items-center p-3 rounded-xl bg-deadlock-dark border-2 border-deadlock-border shrink-0 w-[140px] shadow-md z-10">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-deadlock-muted mb-1.5 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-deadlock-accent animate-pulse" />
                    Current
                  </div>
                  <HeroAvatar heroId={myHeroId} size="md" />
                  <span className="text-xs font-black text-gray-100 mt-1 text-center truncate max-w-full">
                    {currentHero?.name || 'Unknown'}
                  </span>
                  <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-deadlock-panel border border-deadlock-border text-gray-300 mt-0.5">
                    {LANE_LABELS[currentLane]}
                  </span>
                  <div className="text-sm font-black font-mono text-gray-300 mt-1.5">
                    {bestActionsAdvisor.currentProjectedWinRate}% WR
                  </div>
                </div>

                {/* BRANCHES */}
                {!isSwapSuggested ? (
                  /* CASE 1: SINGLE STRAIGHT BRANCH (NO SWAP NEEDED) */
                  <div className="flex items-center flex-1">
                    {/* CONNECTING ARROW WITH +XX% BADGE */}
                    <div className="relative flex-1 flex items-center justify-center min-w-[120px] px-2">
                      <div className="w-full h-0.5 bg-gradient-to-r from-deadlock-accent/60 to-deadlock-win" />
                      <div className="absolute right-0 text-deadlock-win">
                        <ArrowRight className="w-5 h-5 -mr-2.5" />
                      </div>
                      {/* +XX% badge on arrow */}
                      <div className="absolute -top-3.5 px-2 py-0.5 rounded-full bg-deadlock-win text-black text-[11px] font-black font-mono shadow-md whitespace-nowrap">
                        {bestOverall.deltaVsCurrent >= 0
                          ? `+${bestOverall.deltaVsCurrent}%`
                          : `${bestOverall.deltaVsCurrent}%`}
                      </div>
                    </div>

                    {/* TARGET NODE */}
                    <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-gradient-to-r from-deadlock-win/15 via-deadlock-dark to-deadlock-dark border-2 border-deadlock-win/50 flex-1 shadow-md">
                      <div className="flex items-center gap-3">
                        <HeroAvatar heroId={bestOverall.heroId} size="md" isHighlighted />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-white">
                              {bestOverall.hero?.name}
                            </span>
                            <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-deadlock-dark border border-deadlock-border text-gray-300">
                              {LANE_LABELS[bestOverall.lane]}
                            </span>
                          </div>
                          <div className="text-xs text-deadlock-win font-semibold mt-0.5">
                            {bestOverall.type === 'stay_current'
                              ? 'Keep current configuration'
                              : `Switch to ${bestOverall.hero?.name}`}
                          </div>
                          <div className="text-[10px] text-deadlock-muted">
                            {bestOverall.deltaVsCurrent > 0
                              ? `Optimal matchup (+${bestOverall.deltaVsCurrent}% win rate)`
                              : 'Most balanced option'}
                          </div>
                        </div>
                      </div>

                      <div className="text-right font-mono shrink-0">
                        <div className="text-2xl font-black text-deadlock-win">
                          {bestOverall.projectedWinRate}%
                        </div>
                        <span className="text-[11px] text-deadlock-muted font-sans font-semibold">
                          Projected WR
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* CASE 2: FORKED TREE WITH 2 BRANCHES (OPTION 1 WITH SWAP vs OPTION 2 WITHOUT SWAP) */
                  <div className="flex items-center flex-1">
                    {/* SVG TREE CONNECTOR WITH LABELED ARROWS */}
                    <div className="relative w-[130px] h-[190px] shrink-0">
                      <svg className="w-full h-full" viewBox="0 0 130 190" fill="none">
                        {/* Stem from Root */}
                        <line x1="0" y1="95" x2="35" y2="95" stroke="#4ade80" strokeWidth="2.5" strokeOpacity="0.8" />
                        
                        {/* Top Branch (Option 1: Lane Swap) */}
                        <path
                          d="M 35 95 C 65 95, 65 40, 115 40"
                          stroke="#4ade80"
                          strokeWidth="2.5"
                          fill="none"
                        />
                        <polygon points="113,35 125,40 113,45" fill="#4ade80" />

                        {/* Bottom Branch (Option 2: Without Swap) */}
                        <path
                          d="M 35 95 C 65 95, 65 150, 115 150"
                          stroke="#60a5fa"
                          strokeWidth="2.5"
                          fill="none"
                        />
                        <polygon points="113,145 125,150 113,155" fill="#60a5fa" />
                      </svg>

                      {/* +XX% Badge on Top Branch (With Swap) */}
                      <div className="absolute top-[18px] left-[45px] px-2 py-0.5 rounded-full bg-deadlock-win text-black text-[10px] font-black font-mono shadow-md whitespace-nowrap">
                        {bestOverall.deltaVsCurrent >= 0
                          ? `+${bestOverall.deltaVsCurrent}%`
                          : `${bestOverall.deltaVsCurrent}%`}
                      </div>

                      {/* +XX% Badge on Bottom Branch (Without Swap) */}
                      <div className="absolute bottom-[18px] left-[45px] px-2 py-0.5 rounded-full bg-blue-500 text-white text-[10px] font-black font-mono shadow-md whitespace-nowrap">
                        {bestSafe.deltaVsCurrent >= 0
                          ? `+${bestSafe.deltaVsCurrent}%`
                          : `${bestSafe.deltaVsCurrent}%`}
                      </div>
                    </div>

                    {/* BRANCH CARDS */}
                    <div className="flex flex-col gap-3.5 flex-1">
                      {/* BRANCH 1: OPTION 1 (MAX WR WITH LANE SWAP) */}
                      <div className="flex items-center justify-between gap-4 p-3.5 rounded-xl bg-gradient-to-r from-deadlock-win/15 via-deadlock-dark to-deadlock-dark border-2 border-deadlock-win/50 shadow-md">
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col min-w-[80px]">
                            <span className="text-[10px] font-black uppercase tracking-wider text-deadlock-win flex items-center gap-1">
                              Option 1
                            </span>
                            <span className="text-[10px] text-deadlock-muted font-medium">
                              With lane swap
                            </span>
                          </div>

                          {/* Swap Visual: [Current Hero] ⇄ [Ally Hero] */}
                          <div className="flex items-center gap-2 p-1.5 rounded-lg bg-deadlock-panel/90 border border-deadlock-border">
                            <div className="flex flex-col items-center">
                              <HeroAvatar heroId={myHeroId} size="sm" />
                              <span className="text-[10px] font-semibold text-gray-300 mt-0.5">
                                {currentHero?.name}
                              </span>
                            </div>

                            <div className="flex flex-col items-center text-amber-400 px-1">
                              <ArrowRightLeft className="w-4 h-4" />
                              <span className="text-[8px] uppercase font-bold tracking-wider">Swap</span>
                            </div>

                            <div className="flex flex-col items-center">
                              <HeroAvatar heroId={bestOverall.laneSwapWithAllyId} size="sm" />
                              <span className="text-[10px] font-semibold text-gray-300 mt-0.5">
                                {getHeroById(bestOverall.laneSwapWithAllyId || 0)?.name}
                              </span>
                            </div>
                          </div>

                          {/* If hero switch is also needed after swap */}
                          {bestOverall.heroId !== myHeroId && (
                            <div className="flex items-center gap-2">
                              <ArrowRight className="w-4 h-4 text-deadlock-win" />
                              <div className="flex flex-col items-center p-1.5 rounded-lg bg-deadlock-win/10 border border-deadlock-win/40">
                                <HeroAvatar heroId={bestOverall.heroId} size="sm" isHighlighted />
                                <span className="text-[10px] font-bold text-deadlock-win mt-0.5">
                                  {bestOverall.hero?.name}
                                </span>
                              </div>
                            </div>
                          )}

                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-deadlock-dark border border-deadlock-border text-gray-300">
                            {LANE_LABELS[bestOverall.lane]}
                          </span>
                        </div>

                        <div className="text-right font-mono shrink-0 pl-2">
                          <div className="text-2xl font-black text-deadlock-win">
                            {bestOverall.projectedWinRate}%
                          </div>
                        </div>
                      </div>

                      {/* BRANCH 2: OPTION 2 (WITHOUT SWAP / IF REFUSED) */}
                      <div className="flex items-center justify-between gap-4 p-3.5 rounded-xl bg-gradient-to-r from-blue-500/15 via-deadlock-dark to-deadlock-dark border-2 border-blue-500/40 shadow-md">
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col min-w-[80px]">
                            <span className="text-[10px] font-black uppercase tracking-wider text-blue-400 flex items-center gap-1">
                              Option 2
                            </span>
                            <span className="text-[10px] text-deadlock-muted font-medium">
                              If swap denied
                            </span>
                          </div>

                          {/* Hero to pick or keep */}
                          <div className="flex items-center gap-2.5 p-1.5 rounded-lg bg-deadlock-panel/90 border border-deadlock-border">
                            <HeroAvatar heroId={bestSafe.heroId} size="sm" />
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-gray-100">
                                {bestSafe.hero?.name}
                              </span>
                              <span className="text-[10px] text-deadlock-muted">
                                {bestSafe.heroId === myHeroId
                                  ? 'Keep your current hero'
                                  : `Switch to ${bestSafe.hero?.name}`}
                              </span>
                            </div>
                          </div>

                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-deadlock-dark border border-deadlock-border text-gray-300">
                            {LANE_LABELS[bestSafe.lane]}
                          </span>
                        </div>

                        <div className="text-right font-mono shrink-0 pl-2">
                          <div className="text-2xl font-black text-blue-300">
                            {bestSafe.projectedWinRate}%
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()
      ) : null}
    </div>
  );
};
