import React, { useMemo, useState, useEffect } from 'react';
import { Match } from '../types/match';
import type { Hero } from '../data/heroes';
import {
  loadUserSettings,
  saveUserSettings,
  ShieldDisplayMode,
} from '../services/userSettings';
import {
  BarChart2,
  ChevronLeft,
  ChevronRight,
  Shield,
} from 'lucide-react';
import artDecoCorner from '../assets/art-deco/corner.svg';

import { DEADLOCK_RANK_NAMES } from '../services/deadlockApi';
import {
  getRankTierFromFlatProgress,
  ROMAN_NUMERALS,
  RankedShieldEvent,
  processRankedMatches,
  plotRankedPoints,
  PlottedPoint as RankedChartPoint,
  RankedThresholdLine,
  PlottedChartGeometry as RankedChartData,
  ETERNUS_PERCENTILE_THRESHOLDS,
  getEternusSubrankFromPercentile,
} from "../services/rankedChart";
import { RANKED_CHART_CONFIG } from '../config';

export {
  getRankTierFromFlatProgress,
  ROMAN_NUMERALS,
  type RankedShieldEvent,
  type RankedChartPoint,
  type RankedThresholdLine,
  type RankedChartData,
  ETERNUS_PERCENTILE_THRESHOLDS,
  getEternusSubrankFromPercentile,
};

export function computeRankedChartGeometry(
  filteredMatches: Match[],
  _shieldEventsMap: Map<string, RankedShieldEvent>,
  _matchDeltasMap: Map<string, number>,
  tierOnlyThresholds?: boolean
) {
  const { processedMatches } = processRankedMatches(filteredMatches);
  return plotRankedPoints(processedMatches, { tierOnlyThresholds });
}

export interface RankedHeroFilterOption {
  heroId: number;
  hero: Hero | undefined;
  count: number;
  wins: number;
  losses: number;
  winRate: number;
  totalDelta: number;
  avgDelta: number;
}

export interface RankedProgressionChartProps {
  filteredMatches: Match[];
  totalRanked: number;
  shieldEventsMap: Map<string, RankedShieldEvent>;
  matchDeltasMap: Map<string, number>;
  selectedMatch: Match | null;
  onSelectMatch: (match: Match | null) => void;
  // Range filter controls (sliding window game-by-game or 'all')
  rangeFilter: 'window' | 'last50' | 'last20' | 'all';
  onRangeFilterChange: (mode: 'window' | 'last50' | 'last20' | 'all') => void;
  windowStartIndex: number;
  onWindowStartIndexChange: (index: number) => void;
  windowSize?: number;
  // Hero highlight filter
  selectedHeroId: number | null;
  onSelectHeroId?: (heroId: number | null) => void;
  rankedHeroes?: RankedHeroFilterOption[];
}

export const RankedProgressionChart: React.FC<RankedProgressionChartProps> = ({
  filteredMatches,
  totalRanked,
  shieldEventsMap,
  matchDeltasMap,
  selectedMatch,
  onSelectMatch,
  rangeFilter,
  onRangeFilterChange,
  windowStartIndex,
  onWindowStartIndexChange,
  windowSize = RANKED_CHART_CONFIG.TIMELINE_SLIDING_WINDOW_MATCH_COUNT,
  selectedHeroId,
}) => {
  // Sliding window calculation based on windowSize (or actual filtered matches length if provided)
  const effectiveWindowSize = Math.max(1, windowSize);
  const maxStartIndex = Math.max(0, totalRanked - effectiveWindowSize);
  const activeStartIndex = Math.min(Math.max(0, windowStartIndex), maxStartIndex);
  const windowStart = totalRanked === 0 ? 0 : activeStartIndex + 1;
  const windowEnd = Math.min(totalRanked, activeStartIndex + filteredMatches.length);

  // Hover states for interactive tooltips
  const [hoveredPoint, setHoveredPoint] = useState<{
    match: Match;
    x: number;
    y: number;
    index: number;
    startProgress?: number;
    endProgress?: number;
    effectiveDelta?: number;
  } | null>(null);

  const [hoveredGap, setHoveredGap] = useState<{
    x: number;
    y: number;
    gapPoints: number;
    prevMatch: Match;
    nextMatch: Match;
  } | null>(null);

  // Shield display mode: 'badges' (floating pins) | 'tooltip' (inside tooltip) | 'both'
  const [shieldDisplayMode, setShieldDisplayMode] = useState<ShieldDisplayMode>(
    () => loadUserSettings().shieldDisplayMode
  );

  useEffect(() => {
    const handleSettingsUpdate = () => {
      setShieldDisplayMode(loadUserSettings().shieldDisplayMode);
    };
    window.addEventListener('deadlock_settings_updated', handleSettingsUpdate);
    return () => window.removeEventListener('deadlock_settings_updated', handleSettingsUpdate);
  }, []);

  const handleShieldDisplayModeChange = (mode: ShieldDisplayMode) => {
    setShieldDisplayMode(mode);
    saveUserSettings({ shieldDisplayMode: mode });
  };

  const showFloatingBadges = shieldDisplayMode === 'badges';
  const showTooltipShields = shieldDisplayMode === 'tooltip';
  const isAllMode = rangeFilter === 'all';

  // SVG Chart Geometry calculations
  const chartData = useMemo(() => {
    return computeRankedChartGeometry(filteredMatches, shieldEventsMap, matchDeltasMap, isAllMode);
  }, [filteredMatches, shieldEventsMap, matchDeltasMap, isAllMode]);

  // Distinct visible subranks in the current chart view (highest visible tier at index 0)
  const visibleSubranks = useMemo(() => {
    if (!chartData?.verticalTransitions?.length) return [];
    const set = new Set(chartData.verticalTransitions.map((vt) => vt.toSubrank));
    return Array.from(set).sort((a, b) => b - a);
  }, [chartData?.verticalTransitions]);

  // Check if there are any rank/subrank transitions in the current filtered window
  const visibleTransitionsInWindow = useMemo(() => {
    if (!chartData?.verticalTransitions || filteredMatches.length === 0) return [];
    const matchIdsInWindow = new Set(filteredMatches.map((m) => m.id));
    return chartData.verticalTransitions.filter((vt) =>
      matchIdsInWindow.has(chartData.points[vt.index]?.match.id)
    );
  }, [chartData, filteredMatches]);

  // Fallback standing label for window if no transition is present (only applicable in Eternus / rank 11)
  const windowStandingLabel = useMemo(() => {
    if (filteredMatches.length === 0) return null;
    const last = filteredMatches[filteredMatches.length - 1];
    const rank = last.rankedRank || (last.rankedBadge ? Math.floor(last.rankedBadge / 10) : 1);
    if (rank < 11) return null; // Only show for Eternus (Tier 11) where subrank transitions might be outside the 30-game window
    const subrank = last.rankedSubrank ?? (last.rankedBadge ? last.rankedBadge % 10 : 1);
    const tierName = DEADLOCK_RANK_NAMES[rank] || `Tier ${rank}`;
    const subRoman = ROMAN_NUMERALS[subrank] || String(subrank);
    return `${tierName} ${subRoman}`;
  }, [filteredMatches]);

  return (
    <div className="steam-glass steam-panel rounded-xl p-5 border border-deadlock-border/80 shadow-xl flex flex-col gap-4 relative">
      {/* Decorative corner flourishes */}
      <div className="absolute top-2 left-2 pointer-events-none opacity-40">
        <img src={artDecoCorner} alt="" className="w-8 h-8" />
      </div>
      <div className="absolute top-2 right-2 pointer-events-none opacity-40 -scale-x-100">
        <img src={artDecoCorner} alt="" className="w-8 h-8" />
      </div>

      {/* Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 relative z-10">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-deadlock-accent" />
          <h2 className="text-sm font-bold tracking-wide uppercase text-deadlock-steam">
            Ranked Points Evolution
          </h2>
          <span className="text-[11px] font-mono text-deadlock-muted px-2 py-0.5 rounded-full bg-deadlock-card/80 border border-deadlock-border/60">
            {filteredMatches.length} matches shown
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap text-xs">
          {/* Quick Preset Buttons (All / Timeline (X) / Last 50 / Last 20) */}
          <div className="flex items-center bg-deadlock-dark/80 p-0.5 rounded-lg border border-deadlock-border/60">
            <button
              type="button"
              onClick={() => onRangeFilterChange('all')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                rangeFilter === 'all'
                  ? 'bg-deadlock-accent/25 text-deadlock-accent font-bold'
                  : 'text-deadlock-muted hover:text-deadlock-steam'
              }`}
            >
              Global View
            </button>
            <button
              type="button"
              onClick={() => onRangeFilterChange('window')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                rangeFilter === 'window'
                  ? 'bg-deadlock-accent/25 text-deadlock-accent font-bold'
                  : 'text-deadlock-muted hover:text-deadlock-steam'
              }`}
            >
              Timeline ({effectiveWindowSize})
            </button>
            <button
              type="button"
              onClick={() => onRangeFilterChange('last50')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                rangeFilter === 'last50'
                  ? 'bg-deadlock-accent/25 text-deadlock-accent font-bold'
                  : 'text-deadlock-muted hover:text-deadlock-steam'
              }`}
            >
              Last {RANKED_CHART_CONFIG.PRESET_LAST_MATCHES_PRIMARY_COUNT}
            </button>
            <button
              type="button"
              onClick={() => onRangeFilterChange('last20')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                rangeFilter === 'last20'
                  ? 'bg-deadlock-accent/25 text-deadlock-accent font-bold'
                  : 'text-deadlock-muted hover:text-deadlock-steam'
              }`}
            >
              Last {RANKED_CHART_CONFIG.PRESET_LAST_MATCHES_SECONDARY_COUNT}
            </button>
          </div>

          {/* Shield Display Mode Switcher (Badges vs Tooltip) */}
          <div className="flex items-center bg-deadlock-dark/80 p-0.5 rounded-lg border border-deadlock-border/60" title="Shield Display Style">
            <button
              type="button"
              onClick={() => handleShieldDisplayModeChange('badges')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors flex items-center gap-1.5 ${
                shieldDisplayMode === 'badges'
                  ? 'bg-deadlock-accent/25 text-deadlock-accent font-bold'
                  : 'text-deadlock-muted hover:text-deadlock-steam'
              }`}
              title="Badges (New version: Blue/Rose shields floating above match nodes)"
            >
              <Shield className="w-3 h-3 text-sky-400 fill-sky-500/80" />
              <span>Badges</span>
            </button>
            <button
              type="button"
              onClick={() => handleShieldDisplayModeChange('tooltip')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                shieldDisplayMode === 'tooltip'
                  ? 'bg-deadlock-accent/25 text-deadlock-accent font-bold'
                  : 'text-deadlock-muted hover:text-deadlock-steam'
              }`}
              title="Tooltip (Classic version: Shields inside hover tooltip)"
            >
              Tooltip
            </button>
          </div>
        </div>
      </div>

      {/* SVG Interactive Chart */}
      {chartData && (
        <div className="relative w-full h-[320px] 2xl:h-[420px] bg-deadlock-dark/60 rounded-xl border border-deadlock-border/60 p-2 overflow-visible select-none z-20">
          {/* Persistent watermarked standing badge in top-right when no transition is visible in current window */}
          {!isAllMode && visibleTransitionsInWindow.length === 0 && windowStandingLabel && (
            <div className="absolute top-4 right-4 z-30 pointer-events-none flex items-center gap-2 px-3 py-1 rounded-lg bg-deadlock-dark/85 border border-deadlock-brass/50 shadow-md backdrop-blur-sm">
              <span className="w-2 h-2 rounded-full bg-deadlock-accent animate-pulse" />
              <span className="text-[10px] font-mono text-deadlock-muted uppercase tracking-wider">Standing:</span>
              <span className="text-xs font-bold font-display text-deadlock-steam">{windowStandingLabel}</span>
            </div>
          )}

          <svg
            viewBox={`0 0 ${chartData.width} ${chartData.height}`}
            className="w-full h-full overflow-visible"
            preserveAspectRatio="none"
            onMouseLeave={() => {
              setHoveredPoint(null);
              setHoveredGap(null);
            }}
          >
            <defs>
              {/* Luminous brass area gradient */}
              <linearGradient id="rankedGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#c4956a" stopOpacity="0.4" />
                <stop offset="60%" stopColor="#b87333" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#110f0c" stopOpacity="0.0" />
              </linearGradient>

              <linearGradient id="lineGlow" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#b87333" />
                <stop offset="50%" stopColor="#e8c06a" />
                <stop offset="100%" stopColor="#c4956a" />
              </linearGradient>
            </defs>

            {/* Horizontal Subrank Threshold Lines displaying Subrank Names when not in Global View */}
            {chartData.thresholdLines.map((line, idx) => {
              const tierRankNumber = Math.min(11, Math.floor(line.val / 7000) + 1);
              return (
                <g key={idx}>
                  <line
                    x1={isAllMode ? chartData.padding.left - 55 : chartData.padding.left}
                    y1={line.y}
                    x2={chartData.width - chartData.padding.right}
                    y2={line.y}
                    stroke="#b87333"
                    strokeWidth={isAllMode ? 1.4 : 1.2}
                    strokeDasharray={isAllMode ? '5 3' : '4 3'}
                    strokeOpacity={isAllMode ? 0.45 : 0.55}
                  />
                  {!isAllMode ? (
                    <text
                      x={chartData.padding.left - 10}
                      y={line.y + 3.5}
                      textAnchor="end"
                      className="font-mono text-[9px] fill-deadlock-accent font-bold"
                    >
                      {line.label}
                    </text>
                  ) : (
                    // In Global View: display rank tier badge icon + tier name on the left axis
                    <g transform={`translate(${chartData.padding.left - 55}, ${line.y - 11})`}>
                      <image
                        href={`https://api.deadlock-api.com/v1/assets/ranks/${tierRankNumber}/1/image`}
                        x={0}
                        y={0}
                        width={20}
                        height={20}
                        preserveAspectRatio="xMidYMid meet"
                      />
                      <text
                        x={24}
                        y={14}
                        className="font-mono text-[9px] fill-deadlock-accent font-bold tracking-wider"
                      >
                        {line.label}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* Area Fill */}
            {chartData.areaD && (
              <path
                d={chartData.areaD}
                fill="url(#rankedGradient)"
                opacity={selectedHeroId ? 0.25 : 0.85}
                className="transition-opacity duration-300"
              />
            )}

            {/* Traits de liaison reliant les points consécutifs sans césure */}
            {chartData.segments?.map((seg) => {
              const isHeroMatch =
                selectedHeroId === null || seg.match.myHeroId === selectedHeroId;

              return (
                <line
                  key={`seg-${seg.index}`}
                  x1={seg.x1}
                  y1={seg.y1}
                  x2={seg.x2}
                  y2={seg.y2}
                  stroke={
                    !isHeroMatch
                      ? '#5a4e3c'
                      : seg.isWin
                      ? '#5f8f7a'
                      : seg.isLoss
                      ? '#a94442'
                      : '#e8c06a'
                  }
                  strokeWidth={isHeroMatch ? (selectedHeroId ? 3.5 : 2.5) : 1.5}
                  strokeOpacity={isHeroMatch ? 1 : 0.3}
                  strokeDasharray={!isHeroMatch ? '3 3' : undefined}
                  strokeLinecap="round"
                  style={
                    isHeroMatch
                      ? {
                          filter: seg.isWin
                            ? 'drop-shadow(0 2px 6px rgba(95,143,122,0.45))'
                            : seg.isLoss
                            ? 'drop-shadow(0 2px 6px rgba(169,68,66,0.45))'
                            : 'drop-shadow(0 2px 6px rgba(232,192,106,0.4))',
                        }
                      : undefined
                  }
                />
              );
            })}

            {/* Traits verticaux de césure / ellipse marquant les sauts de points anormaux (masqués en Global View) */}
            {!isAllMode && chartData.gaps?.map((gap) => (
              <g
                key={`gap-caesura-${gap.index}`}
                className="cursor-pointer group"
                onMouseEnter={() => {
                  setHoveredPoint(null);
                  setHoveredGap({
                    x: gap.x,
                    y: (gap.prevY + gap.nextY) / 2,
                    gapPoints: gap.gapPoints,
                    prevMatch: gap.prevMatch,
                    nextMatch: gap.nextMatch,
                  });
                }}
              >
                {/* Hit area invisible pour faciliter le survol et afficher l'infobulle */}
                <rect
                  x={gap.x - 14}
                  y={chartData.padding.top}
                  width={28}
                  height={chartData.height - chartData.padding.top - chartData.padding.bottom}
                  fill="transparent"
                />

                {/* Traits verticaux parallèles de césure / ellipse */}
                <line
                  x1={gap.x - 3.5}
                  y1={chartData.padding.top}
                  x2={gap.x - 3.5}
                  y2={chartData.height - chartData.padding.bottom}
                  stroke="#f59e0b"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  strokeOpacity={0.65}
                  className="group-hover:stroke-amber-300 group-hover:opacity-100 transition-all"
                />
                <line
                  x1={gap.x + 3.5}
                  y1={chartData.padding.top}
                  x2={gap.x + 3.5}
                  y2={chartData.height - chartData.padding.bottom}
                  stroke="#f59e0b"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  strokeOpacity={0.65}
                  className="group-hover:stroke-amber-300 group-hover:opacity-100 transition-all"
                />

                {/* Emblème central de césure / ellipse avec double barre oblique // */}
                <g transform={`translate(${gap.x}, ${(chartData.padding.top + chartData.height - chartData.padding.bottom) / 2})`}>
                  <circle r={8.5} fill="#181512" stroke="#f59e0b" strokeWidth={1} strokeOpacity={0.8} />
                  <line x1={-2.5} y1={4.5} x2={-0.5} y2={-4.5} stroke="#f59e0b" strokeWidth={1.4} strokeLinecap="round" />
                  <line x1={1.5} y1={4.5} x2={3.5} y2={-4.5} stroke="#f59e0b" strokeWidth={1.4} strokeLinecap="round" />
                </g>
              </g>
            ))}

            {/* Traits verticaux de transition de rang / sous-rang (percentile-based Eternus) */}
            {!isAllMode && chartData.verticalTransitions?.map((vt) => {
              // Level based ONLY on subranks actually present and visible in the current view:
              // The highest visible subrank is at the top (y=12), the next lower visible is below (+20px).
              // Identical subranks are strictly on the exact same height!
              const levelIndex = visibleSubranks.indexOf(vt.toSubrank);
              const badgeY = 12 + Math.max(0, levelIndex) * 20;

              return (
                <g key={`vt-${vt.index}`} className="pointer-events-none">
                  <line
                    x1={vt.x}
                    y1={badgeY + 8}
                    x2={vt.x}
                    y2={chartData.height - chartData.padding.bottom}
                    stroke={vt.type === 'promotion' ? '#38bdf8' : '#fb7185'}
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                    strokeOpacity={0.7}
                  />
                  <g transform={`translate(${vt.x}, ${badgeY})`}>
                    <rect
                      x={-34}
                      y={-8}
                      width={68}
                      height={16}
                      rx={3}
                      fill="#110f0c"
                      stroke={vt.type === 'promotion' ? '#38bdf8' : '#fb7185'}
                      strokeWidth={1}
                      strokeOpacity={0.85}
                    />
                    <text
                      x={0}
                      y={3}
                      textAnchor="middle"
                      className={`font-mono text-[9px] font-black tracking-wider ${
                        vt.type === 'promotion' ? 'fill-sky-300' : 'fill-rose-300'
                      }`}
                    >
                      {vt.label}
                    </text>
                  </g>
                </g>
              );
            })}

            {/* Vertical guideline on hover */}
            {!isAllMode && hoveredPoint && (
              <line
                x1={hoveredPoint.x}
                y1={chartData.padding.top}
                x2={hoveredPoint.x}
                y2={chartData.height - chartData.padding.bottom}
                stroke="#e8c06a"
                strokeWidth="1"
                strokeDasharray="3 3"
                strokeOpacity={0.7}
              />
            )}

            {/* Interactive Match Points on Curve (at start of match: "au moment de la game") */}
            {!isAllMode && chartData.points.map((pt) => {
              const isWin = pt.effectiveDelta > 0 || pt.match.result === 'win';
              const isSelectedHero = selectedHeroId === null || pt.match.myHeroId === selectedHeroId;
              const isHovered = hoveredPoint?.index === pt.index;
              const isSelectedMatch = selectedMatch?.id === pt.match.id;
              const isShieldConsumed = pt.shieldEvent?.type === 'used';
              const isShieldReset = pt.shieldEvent?.type === 'gained';
              const shieldY = Math.max(12, pt.y - 20);

              return (
                <g key={pt.index} className={isSelectedHero ? 'opacity-100' : 'opacity-35 transition-opacity'}>
                  {/* Selected Match Golden Pulse Ring */}
                  {isSelectedMatch && (
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={10}
                      fill="none"
                      stroke="#e8c06a"
                      strokeWidth={2}
                      className="animate-pulse"
                    />
                  )}

                  {/* Consumed Demotion Protection Shield Badge (Rose) */}
                  {showFloatingBadges && isShieldConsumed && (
                    <g
                      className="cursor-pointer transition-transform duration-150"
                      onClick={() => {
                        onSelectMatch(selectedMatch?.id === pt.match.id ? null : pt.match);
                      }}
                      onMouseEnter={() => {
                        setHoveredGap(null);
                        setHoveredPoint({
                          match: pt.match,
                          x: pt.x,
                          y: pt.y,
                          index: pt.index,
                          startProgress: pt.startProgress,
                          endProgress: pt.endProgress,
                          effectiveDelta: pt.effectiveDelta,
                        });
                      }}
                      style={{
                        filter:
                          isHovered || isSelectedMatch
                            ? 'drop-shadow(0 2px 8px rgba(244,63,94,0.95))'
                            : 'drop-shadow(0 2px 5px rgba(244,63,94,0.7))',
                      }}
                    >
                      {/* Connecting dashed stem */}
                      <line
                        x1={pt.x}
                        y1={pt.y - (isSelectedMatch ? 8 : 5)}
                        x2={pt.x}
                        y2={shieldY + 8}
                        stroke="#f43f5e"
                        strokeWidth={1.5}
                        strokeDasharray="2 2"
                        strokeOpacity={0.8}
                      />

                      {/* Shield Badge Container */}
                      <circle
                        cx={pt.x}
                        cy={shieldY}
                        r={8}
                        fill="#200d11"
                        stroke={isHovered || isSelectedMatch ? '#fb7185' : '#e11d48'}
                        strokeWidth={isHovered || isSelectedMatch ? 2 : 1.5}
                      />

                      {/* Shield Icon SVG Path */}
                      <path
                        d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"
                        fill="#f43f5e"
                        stroke={isHovered || isSelectedMatch ? '#ffffff' : '#fda4af'}
                        strokeWidth="1.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        transform={`translate(${pt.x - 4.8}, ${shieldY - 4.8}) scale(0.4)`}
                      />
                    </g>
                  )}

                  {/* Shields Reset Protection Badge (Blue) */}
                  {showFloatingBadges && isShieldReset && !isShieldConsumed && (
                    <g
                      className="cursor-pointer transition-transform duration-150"
                      onClick={() => {
                        onSelectMatch(selectedMatch?.id === pt.match.id ? null : pt.match);
                      }}
                      onMouseEnter={() => {
                        setHoveredGap(null);
                        setHoveredPoint({
                          match: pt.match,
                          x: pt.x,
                          y: pt.y,
                          index: pt.index,
                          startProgress: pt.startProgress,
                          endProgress: pt.endProgress,
                          effectiveDelta: pt.effectiveDelta,
                        });
                      }}
                      style={{
                        filter:
                          isHovered || isSelectedMatch
                            ? 'drop-shadow(0 2px 8px rgba(56,189,248,0.95))'
                            : 'drop-shadow(0 2px 5px rgba(56,189,248,0.7))',
                      }}
                    >
                      {/* Connecting dashed stem */}
                      <line
                        x1={pt.x}
                        y1={pt.y - (isSelectedMatch ? 8 : 5)}
                        x2={pt.x}
                        y2={shieldY + 8}
                        stroke="#38bdf8"
                        strokeWidth={1.5}
                        strokeDasharray="2 2"
                        strokeOpacity={0.8}
                      />

                      {/* Shield Badge Container */}
                      <circle
                        cx={pt.x}
                        cy={shieldY}
                        r={8}
                        fill="#082032"
                        stroke={isHovered || isSelectedMatch ? '#60a5fa' : '#0284c7'}
                        strokeWidth={isHovered || isSelectedMatch ? 2 : 1.5}
                      />

                      {/* Shield Icon SVG Path */}
                      <path
                        d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"
                        fill="#38bdf8"
                        stroke={isHovered || isSelectedMatch ? '#ffffff' : '#bae6fd'}
                        strokeWidth="1.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        transform={`translate(${pt.x - 4.8}, ${shieldY - 4.8}) scale(0.4)`}
                      />
                    </g>
                  )}

                  {/* Hover & Click target circle */}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r="12"
                    fill="transparent"
                    className="cursor-pointer"
                    onClick={() => {
                      onSelectMatch(selectedMatch?.id === pt.match.id ? null : pt.match);
                    }}
                    onMouseEnter={() => {
                      setHoveredGap(null);
                      setHoveredPoint({
                        match: pt.match,
                        x: pt.x,
                        y: pt.y,
                        index: pt.index,
                        startProgress: pt.startProgress,
                        endProgress: pt.endProgress,
                        effectiveDelta: pt.effectiveDelta,
                      });
                    }}
                  />

                  {/* Visible data dot */}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={isSelectedMatch ? 6.5 : isHovered ? 6 : isSelectedHero && selectedHeroId ? 5 : 4}
                    fill={
                      isSelectedHero
                        ? isWin
                          ? '#5f8f7a'
                          : '#a94442'
                        : '#5a4e3c'
                    }
                    stroke={
                      isSelectedMatch
                        ? '#fff'
                        : isHovered && pt.shieldEvent
                        ? pt.shieldEvent.type === 'gained'
                          ? '#38bdf8'
                          : '#f43f5e'
                        : isHovered
                        ? '#e8c06a'
                        : showFloatingBadges && isShieldConsumed
                        ? '#f43f5e'
                        : showFloatingBadges && isShieldReset
                        ? '#38bdf8'
                        : isSelectedHero && selectedHeroId
                        ? '#e8c06a'
                        : '#110f0c'
                    }
                    strokeWidth={isSelectedMatch ? 2.5 : isHovered ? 2 : isSelectedHero && selectedHeroId ? 2 : 1.5}
                    className="transition-all duration-150 pointer-events-none drop-shadow-[0_0_6px_rgba(0,0,0,0.8)]"
                  />
                </g>
              );
            })}
          </svg>

          {/* Steampunk Minimalist Tooltip on Hover */}
          {!isAllMode && hoveredPoint && (() => {
            const xPercent = (hoveredPoint.x / chartData.width) * 100;
            const showBelow = hoveredPoint.y < chartData.height * 0.45;
            const isNearLeft = xPercent < 15;
            const isNearRight = xPercent > 85;

            let horizontalClass = '-translate-x-1/2';
            if (isNearLeft) horizontalClass = 'translate-x-0';
            else if (isNearRight) horizontalClass = '-translate-x-full';

            const verticalClass = showBelow ? 'translate-y-3' : '-translate-y-full -translate-y-3';

            const delta =
              hoveredPoint.effectiveDelta ??
              (matchDeltasMap.get(hoveredPoint.match.id) ?? (hoveredPoint.match.rankedDelta || 0));
            const isPositive = delta > 0;
            const currentProg =
              hoveredPoint.endProgress ?? (hoveredPoint.match.rankedProgress ?? 0);
            const isEternus =
              currentProg >= 70000 ||
              hoveredPoint.match.rankedRank === 11 ||
              (hoveredPoint.match.rankedBadge ? Math.floor(hoveredPoint.match.rankedBadge / 10) === 11 : false);

            let standingText: string;
            if (isEternus) {
              const subrank =
                hoveredPoint.match.rankedSubrank ??
                (hoveredPoint.match.rankedBadge ? hoveredPoint.match.rankedBadge % 10 : 1);
              const subrankRoman = ROMAN_NUMERALS[subrank] || 'I';
              standingText = `Eternus ${subrankRoman} · ${currentProg.toLocaleString()} pts`;
            } else {
              const rankInfo = getRankTierFromFlatProgress(currentProg);
              const progressInSub = currentProg % 1000;
              standingText = `${rankInfo.label} · ${progressInSub} pts`;
            }
            const hoveredShield = showTooltipShields ? shieldEventsMap.get(hoveredPoint.match.id) : null;

            return (
              <div
                className={`absolute z-50 pointer-events-none transition-all duration-75 transform ${horizontalClass} ${verticalClass}`}
                style={{
                  left: `${xPercent}%`,
                  top: `${(hoveredPoint.y / chartData.height) * 100}%`,
                }}
              >
                <div className="bg-deadlock-dark/95 backdrop-blur-md border border-deadlock-brass/80 shadow-2xl rounded-lg px-2.5 py-1.5 flex flex-col items-center gap-0.5 text-center drop-shadow-[0_4px_16px_rgba(0,0,0,0.95)] whitespace-nowrap">
                  <span
                    className={`font-mono text-xs font-black leading-tight ${
                      isPositive ? 'text-emerald-400' : delta < 0 ? 'text-rose-400' : 'text-deadlock-muted'
                    }`}
                  >
                    {isPositive ? `+${delta} pts` : `${delta} pts`}
                  </span>
                  <span className="font-mono text-[11px] font-bold text-deadlock-steam leading-tight">
                    {standingText}
                  </span>

                  {/* Shield event badge in tooltip (Classic / Tooltip mode) */}
                  {showTooltipShields && hoveredShield && (
                    <div
                      className={`mt-1 px-2 py-0.5 rounded flex items-center gap-1.5 text-[10px] font-bold font-mono ${
                        hoveredShield.type === 'gained'
                          ? 'bg-cyan-950/90 border border-cyan-400/60 text-cyan-200'
                          : 'bg-rose-950/90 border border-rose-400/60 text-rose-200'
                      }`}
                    >
                      <Shield
                        className={`w-3 h-3 shrink-0 ${
                          hoveredShield.type === 'gained'
                            ? 'fill-cyan-400 text-cyan-300'
                            : 'fill-rose-500 text-rose-300'
                        }`}
                      />
                      <span>
                        {hoveredShield.type === 'gained'
                          ? `+${hoveredShield.count} Shields Reset`
                          : '-1 Shield'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Missing Match Gap Tooltip on Hovering Gap Line */}
          {hoveredGap && (() => {
            const xPercent = (hoveredGap.x / chartData.width) * 100;
            const showBelow = hoveredGap.y < chartData.height * 0.45;
            const isNearLeft = xPercent < 15;
            const isNearRight = xPercent > 85;

            let horizontalClass = '-translate-x-1/2';
            if (isNearLeft) horizontalClass = 'translate-x-0';
            else if (isNearRight) horizontalClass = '-translate-x-full';

            const verticalClass = showBelow ? 'translate-y-3' : '-translate-y-full -translate-y-3';
            const isPositive = hoveredGap.gapPoints > 0;

            return (
              <div
                className={`absolute z-50 pointer-events-none transition-all duration-75 transform ${horizontalClass} ${verticalClass}`}
                style={{
                  left: `${xPercent}%`,
                  top: `${(hoveredGap.y / chartData.height) * 100}%`,
                }}
              >
                <div className="bg-deadlock-dark/95 backdrop-blur-md border border-amber-500/80 shadow-2xl rounded-lg px-2.5 py-1.5 flex flex-col items-center gap-0.5 text-center drop-shadow-[0_4px_16px_rgba(0,0,0,0.95)] whitespace-nowrap">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                    Unrecorded Match Gap
                  </span>
                  <span
                    className={`font-mono text-xs font-black leading-tight ${
                      isPositive ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {isPositive ? `+${hoveredGap.gapPoints} pts` : `${hoveredGap.gapPoints} pts`}
                  </span>
                  <span className="font-mono text-[10px] text-deadlock-muted leading-tight">
                    Missing unrecorded matches
                  </span>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Timeline Slider Bar along the full width directly underneath the graph */}
      {!isAllMode && totalRanked > effectiveWindowSize && (
        <div className="flex items-center gap-3 px-3 py-2 bg-deadlock-dark/70 rounded-xl border border-deadlock-border/70 text-xs font-mono relative z-10 shadow-inner">
          <button
            type="button"
            onClick={() => {
              if (rangeFilter !== 'window') onRangeFilterChange('window');
              onWindowStartIndexChange(Math.max(0, activeStartIndex - 1));
            }}
            disabled={activeStartIndex <= 0}
            title="Previous match (-1 game)"
            className="p-1 rounded text-deadlock-muted hover:text-deadlock-steam hover:bg-deadlock-card disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-[10px] text-deadlock-muted uppercase tracking-wider hidden sm:inline select-none">
            Oldest
          </span>
          <input
            type="range"
            min={0}
            max={maxStartIndex}
            step={1}
            value={activeStartIndex}
            onChange={(e) => {
              if (rangeFilter !== 'window') onRangeFilterChange('window');
              onWindowStartIndexChange(Number(e.target.value));
            }}
            className="flex-1 h-2 bg-deadlock-card rounded-lg appearance-none cursor-pointer accent-[#e8c06a]"
          />
          <span className="text-[10px] text-deadlock-muted uppercase tracking-wider hidden sm:inline select-none">
            Recent
          </span>
          <span className="text-[11px] font-bold text-deadlock-accent whitespace-nowrap px-2.5 py-0.5 rounded bg-deadlock-card/90 border border-deadlock-border/70 shadow-sm">
            Matches {windowStart}–{windowEnd} of {totalRanked}
          </span>
          <button
            type="button"
            onClick={() => {
              if (rangeFilter !== 'window') onRangeFilterChange('window');
              onWindowStartIndexChange(Math.min(maxStartIndex, activeStartIndex + 1));
            }}
            disabled={activeStartIndex >= maxStartIndex}
            title="Next match (+1 game)"
            className="p-1 rounded text-deadlock-muted hover:text-deadlock-steam hover:bg-deadlock-card disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Chart Legend */}
      <div className="flex items-center justify-between flex-wrap gap-3 pt-3 px-1 text-[11px] font-mono text-deadlock-muted border-t border-deadlock-border/40 relative z-10">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="flex items-center gap-1.5" title="Point indicates player rank standing after match">
            <span className="w-2.5 h-2.5 rounded-full border border-deadlock-accent bg-deadlock-dark" />
            <span>Point: Standing after Match</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3.5 h-1 rounded bg-[#5f8f7a]" />
            <span>Win (+pts)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3.5 h-1 rounded bg-[#a94442]" />
            <span>Loss (-pts)</span>
          </span>
          <span className="flex items-center gap-1.5" title="Discontinuity between recorded matches">
            <span className="flex items-center gap-0.5 h-3">
              <span className="w-[1.5px] h-3 bg-amber-400" />
              <span className="w-[1.5px] h-3 bg-amber-400" />
            </span>
            <span>Unrecorded Match Gap</span>
          </span>
          {showFloatingBadges && (
            <>
              <span className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-sky-400 fill-sky-500/80" />
                <span>Shields Reset</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-rose-400 fill-rose-500/80" />
                <span>Shield Consumed</span>
              </span>
            </>
          )}
        </div>
        <span className="text-[10px] text-deadlock-muted/70 italic">
          Click any point to view match details
        </span>
      </div>
    </div>
  );
};
