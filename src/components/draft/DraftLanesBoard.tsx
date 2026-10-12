import React from 'react';
import occultDivider from '../../assets/occult/divider.svg';
import occultSeal from '../../assets/occult/seal.svg';
import { LaneColor, LANE_LABELS } from '../../types/match';
import { HeroAvatar } from '../HeroAvatar';
import { Compass, Users, Swords, ChevronDown } from 'lucide-react';
import { ActiveSlot } from './types';

interface DraftLanesBoardProps {
  lanes: Record<LaneColor, { allies: (number | null)[]; enemies: (number | null)[] }>;
  assignedLane: LaneColor;
  myHeroId: number | null;
  activeSlot: ActiveSlot | null;
  onSelectSlot: (slot: ActiveSlot) => void;
  onSetMyHeroId: (heroId: number | null) => void;
  onRemoveHero: (lane: LaneColor, team: 'allies' | 'enemies', index: number) => void;
  onSetAssignedLane: (lane: LaneColor) => void;
  isManualMode?: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const DraftLanesBoard: React.FC<DraftLanesBoardProps> = ({
  lanes,
  assignedLane,
  myHeroId,
  activeSlot,
  onSelectSlot,
  onSetMyHeroId,
  onRemoveHero,
  onSetAssignedLane,
  isManualMode = false,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  return (
    <div
      className={`occult-panel arcane-glow rounded-xl flex flex-col relative z-10 overflow-hidden transition-all duration-500 ease-in-out ${
        isCollapsed ? 'p-3.5 gap-0' : 'p-5 gap-4'
      }`}
    >
      {/* Alchemical Solomon Seal Watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden z-0">
        <img
          src={occultSeal}
          alt=""
          aria-hidden="true"
          className="w-[450px] h-[450px] object-contain opacity-[0.06] filter drop-shadow-[0_0_30px_rgba(107,76,138,0.6)] animate-[spin_180s_linear_infinite]"
        />
      </div>

      {/* 1. Panel Header (Collapsible toggle) */}
      <div
        className={`flex items-center justify-between flex-wrap gap-2 relative z-10 transition-all duration-300 ${
          isCollapsed ? 'pb-0 border-b-0' : 'pb-3 border-b border-deadlock-arcane/30'
        }`}
      >
        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex items-center gap-2 group text-left cursor-pointer select-none"
          title={isCollapsed ? 'Click to expand lanes board' : 'Click to collapse lanes board'}
        >
          <div className="p-1.5 rounded-md bg-purple-950/60 border border-deadlock-arcane/40 group-hover:border-deadlock-arcane text-deadlock-arcane group-hover:text-purple-200 transition-all shadow-inner">
            <Compass className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-purple-100 font-mono flex items-center gap-1.5 group-hover:text-white transition-colors">
              The 3 Duo Lanes <span className="text-purple-400/60">•</span> Astral Alignment
            </h3>
            {isCollapsed && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-deadlock-arcane/25 border border-deadlock-arcane/50 text-purple-200 font-bold shadow-sm">
                Folded (6v6 Aligned)
              </span>
            )}
          </div>
          <ChevronDown
            className={`w-4 h-4 text-purple-300/70 group-hover:text-purple-100 transition-transform duration-500 ease-in-out ${
              isCollapsed ? '-rotate-90' : 'rotate-0'
            }`}
          />
        </button>

        <div className="flex items-center gap-3">
          <span className="text-xs text-purple-300/70 italic hidden sm:inline">
            {isCollapsed
              ? 'Lanes folded to focus on swap & switch suggestions'
              : isManualMode
              ? 'Manual Mode: Click on ritual slots below to pick or ban heroes (6 Allies vs 6 Enemies)'
              : 'Auto Mode (OCR): Lane alignment detected automatically'}
          </span>
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1a1226]/90 hover:bg-[#251a36] border border-deadlock-arcane/40 text-[11px] font-mono font-bold text-purple-200 hover:text-white transition-all shadow-sm cursor-pointer"
            >
              {isCollapsed ? 'Expand Board' : 'Collapse Board'}
            </button>
          )}
        </div>
      </div>

      {/* 2. Unified Lanes Board with Continuous Color Halos and Full-Width Occult Separator */}
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-500 ease-in-out ${
          isCollapsed ? 'grid-rows-[0fr] opacity-0 pointer-events-none' : 'grid-rows-[1fr] opacity-100'
        }`}
      >
        <div className="overflow-hidden min-h-0">
          <div className="overflow-x-auto pb-1 pt-1 relative z-10">
        <div className="min-w-[650px] relative rounded-xl overflow-hidden p-3 md:p-4 bg-[#130d1e]/85 border border-deadlock-arcane/35 shadow-inner">
          {/* Continuous Colored Halos (One for each lane from top to bottom) */}
          <div className="absolute inset-3 md:inset-4 grid grid-cols-3 gap-3 md:gap-4 pointer-events-none z-0">
            {(['yellow', 'blue', 'green'] as const).map((laneColor) => {
              const isMyLane = isManualMode && assignedLane === laneColor;

              if (laneColor === 'yellow') {
                return (
                  <div
                    key={laneColor}
                    className={`rounded-xl transition-all duration-300 ${
                      isMyLane
                        ? 'border-2 border-amber-400/85 bg-gradient-to-b from-amber-500/25 via-[#181124]/40 to-amber-500/25 shadow-[0_0_35px_rgba(245,158,11,0.3),inset_0_0_25px_rgba(245,158,11,0.15)] ring-1 ring-amber-400/60'
                        : 'border border-amber-500/35 bg-gradient-to-b from-amber-500/12 via-[#181124]/20 to-amber-500/12 shadow-[0_0_20px_rgba(245,158,11,0.12),inset_0_0_15px_rgba(245,158,11,0.06)]'
                    }`}
                  />
                );
              }
              if (laneColor === 'blue') {
                return (
                  <div
                    key={laneColor}
                    className={`rounded-xl transition-all duration-300 ${
                      isMyLane
                        ? 'border-2 border-blue-400/85 bg-gradient-to-b from-blue-500/25 via-[#181124]/40 to-blue-500/25 shadow-[0_0_35px_rgba(59,130,246,0.3),inset_0_0_25px_rgba(59,130,246,0.15)] ring-1 ring-blue-400/60'
                        : 'border border-blue-500/35 bg-gradient-to-b from-blue-500/12 via-[#181124]/20 to-blue-500/12 shadow-[0_0_20px_rgba(59,130,246,0.12),inset_0_0_15px_rgba(59,130,246,0.06)]'
                    }`}
                  />
                );
              }
              return (
                <div
                  key={laneColor}
                  className={`rounded-xl transition-all duration-300 ${
                    isMyLane
                      ? 'border-2 border-emerald-400/85 bg-gradient-to-b from-emerald-500/25 via-[#181124]/40 to-emerald-500/25 shadow-[0_0_35px_rgba(16,185,129,0.3),inset_0_0_25px_rgba(16,185,129,0.15)] ring-1 ring-emerald-400/60'
                      : 'border border-emerald-500/35 bg-gradient-to-b from-emerald-500/12 via-[#181124]/20 to-emerald-500/12 shadow-[0_0_20px_rgba(16,185,129,0.12),inset_0_0_15px_rgba(16,185,129,0.06)]'
                  }`}
                />
              );
            })}
          </div>

          {/* Foreground Interactive Content */}
          <div className="relative z-10 flex flex-col gap-2.5">
            {/* Top Row: Lane Headers & Allied Duos */}
            <div className="grid grid-cols-3 gap-3 md:gap-4">
              {(['yellow', 'blue', 'green'] as const).map((laneColor) => {
                const laneData = lanes[laneColor];
                const isMyLane = isManualMode && assignedLane === laneColor;

                return (
                  <div key={laneColor} className="flex flex-col gap-2 p-2.5 sm:p-3">
                    {/* Lane Header */}
                    <div className="flex items-center justify-between gap-1 flex-wrap">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                            laneColor === 'yellow'
                              ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]'
                              : laneColor === 'blue'
                              ? 'bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]'
                              : 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                          }`}
                        />
                        <span
                          className={`font-bold text-xs uppercase tracking-wide truncate ${
                            laneColor === 'yellow'
                              ? 'text-amber-300'
                              : laneColor === 'blue'
                              ? 'text-blue-300'
                              : 'text-emerald-300'
                          }`}
                        >
                          {LANE_LABELS[laneColor]}
                        </span>
                      </div>

                      {isManualMode && (
                        <button
                          type="button"
                          onClick={() => onSetAssignedLane(laneColor)}
                          className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-wider border transition-all ${
                            isMyLane
                              ? 'bg-deadlock-accent border-deadlock-accent text-deadlock-steam shadow-sm'
                              : 'bg-[#1a1228]/85 border-deadlock-arcane/40 text-purple-300/80 hover:text-white hover:border-purple-400'
                          }`}
                        >
                          {isMyLane ? 'Focus Lane' : 'Select'}
                        </button>
                      )}
                    </div>

                    {/* Allied Duo */}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-deadlock-archmother flex items-center gap-1">
                        <Users className="w-3 h-3 text-deadlock-archmother" /> Allied Duo
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        {[0, 1].map((idx) => {
                          const heroId = laneData.allies[idx];
                          const isYou = heroId !== null && heroId === myHeroId;
                          const isActive =
                            isManualMode &&
                            activeSlot?.type === 'lane' &&
                            activeSlot.lane === laneColor &&
                            activeSlot.team === 'allies' &&
                            activeSlot.index === idx;

                          return (
                            <div
                              key={idx}
                              onClick={
                                isManualMode
                                  ? () => {
                                      onSelectSlot({ type: 'lane', lane: laneColor, team: 'allies', index: idx });
                                      if (heroId) onSetMyHeroId(heroId);
                                    }
                                  : undefined
                              }
                              className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${
                                isManualMode ? 'cursor-pointer' : 'cursor-default'
                              } ${
                                isActive
                                  ? 'border-deadlock-archmother bg-deadlock-archmother/25 ring-1 ring-deadlock-archmother shadow-[0_0_12px_rgba(234,179,8,0.3)]'
                                  : isYou
                                  ? 'border-deadlock-accent bg-deadlock-accent/25 ring-1 ring-deadlock-accent shadow-[0_0_12px_rgba(234,179,8,0.3)]'
                                  : isManualMode
                                  ? 'border-deadlock-arcane/40 bg-[#1a1226]/90 hover:border-purple-400 hover:bg-[#201633]'
                                  : 'border-deadlock-arcane/30 bg-[#1a1226]/70'
                              }`}
                            >
                              <HeroAvatar
                                heroId={heroId}
                                size="sm"
                                showName
                                onRemove={
                                  isManualMode && heroId
                                    ? () => onRemoveHero(laneColor, 'allies', idx)
                                    : undefined
                                }
                              />
                              {isYou && (
                                <span className="text-[9px] text-deadlock-accent font-black mt-0.5">
                                  YOU
                                </span>
                              )}
                              {!heroId && (
                                <span className="text-[10px] text-purple-300/60 font-mono mt-1">
                                  Slot #{idx + 1}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Middle: THE OCCULT DIVIDER (Full-width spanning the ENTIRE container) */}
            <div className="relative py-2.5 my-1.5 -mx-3 md:-mx-4 w-[calc(100%+1.5rem)] md:w-[calc(100%+2rem)] flex items-center justify-center border-y border-deadlock-arcane/40 bg-[#170e24]/70 shadow-[0_0_18px_rgba(107,76,138,0.3)] overflow-hidden">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full h-px bg-gradient-to-r from-deadlock-arcane/20 via-deadlock-arcane to-deadlock-arcane/20 shadow-[0_0_12px_rgba(154,106,191,0.7)]" />
              </div>
              <img
                src={occultDivider}
                alt="Occult Ritual Divider"
                className="relative z-10 w-full h-8 md:h-10 object-fill opacity-95 drop-shadow-[0_0_16px_rgba(154,106,191,0.9)] filter brightness-125"
              />
            </div>

            {/* Bottom Row: Enemy Duos */}
            <div className="grid grid-cols-3 gap-3 md:gap-4">
              {(['yellow', 'blue', 'green'] as const).map((laneColor) => {
                const laneData = lanes[laneColor];

                return (
                  <div key={laneColor} className="flex flex-col gap-1.5 p-2.5 sm:p-3 pt-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-deadlock-hidden-king flex items-center gap-1">
                      <Swords className="w-3 h-3 text-deadlock-hidden-king" /> Enemy Duo
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      {[0, 1].map((idx) => {
                        const heroId = laneData.enemies[idx];
                        const isActive =
                          isManualMode &&
                          activeSlot?.type === 'lane' &&
                          activeSlot.lane === laneColor &&
                          activeSlot.team === 'enemies' &&
                          activeSlot.index === idx;

                        return (
                          <div
                            key={idx}
                            onClick={
                              isManualMode
                                ? () =>
                                    onSelectSlot({ type: 'lane', lane: laneColor, team: 'enemies', index: idx })
                                : undefined
                            }
                            className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${
                              isManualMode ? 'cursor-pointer' : 'cursor-default'
                            } ${
                              isActive
                                ? 'border-deadlock-hidden-king bg-deadlock-hidden-king/25 ring-1 ring-deadlock-hidden-king shadow-[0_0_12px_rgba(139,58,58,0.4)]'
                                : isManualMode
                                ? 'border-deadlock-arcane/40 bg-[#1a1226]/90 hover:border-purple-400 hover:bg-[#201633]'
                                : 'border-deadlock-arcane/30 bg-[#1a1226]/70'
                            }`}
                          >
                            <HeroAvatar
                              heroId={heroId}
                              size="sm"
                              showName
                              onRemove={
                                isManualMode && heroId
                                  ? () => onRemoveHero(laneColor, 'enemies', idx)
                                  : undefined
                              }
                            />
                            {!heroId && (
                              <span className="text-[10px] text-purple-300/60 font-mono mt-1">
                                Enemy #{idx + 1}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
  );
};
