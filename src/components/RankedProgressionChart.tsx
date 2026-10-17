import React, { useMemo, useState, useEffect } from 'react';
import { Match } from '../types/match';
import type { Hero } from '../data/heroes';
import { DEADLOCK_RANK_NAMES } from '../services/deadlockApi';
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

export const ROMAN_NUMERALS = ['', 'I', 'II', 'III', 'IV', 'V', 'VI'];

export interface RankedShieldEvent {
  matchId: string;
  type: 'gained' | 'used';
  count: number;
  reason: string;
  subrankLabel: string;
  shieldsRemaining?: number;
}

/**
 * Maps a Deadlock flat ladder progress value to its exact rank and subrank.
 * In Deadlock's official ranked ladder:
 * - Initiate I begins at 7,000 flat progress.
 * - Each tier contains 6 subranks (I, II, III, IV, V, VI).
 * - Each subrank is exactly 1,000 points (6,000 points per tier).
 * 
 * Example subrank floors:
 * - 49,000 pts: Oracle I
 * - 53,000 pts: Oracle V
 * - 54,000 pts: Oracle VI
 * - 55,000 pts: Phantom I
 * - 56,000 pts: Phantom II
 * - 57,000 pts: Phantom III
 * - 58,000 pts: Phantom IV
 * - 59,000 pts: Phantom V
 * - 60,000 pts: Phantom VI
 * - 61,000 pts: Ascendant I
 */
export function getRankTierFromFlatProgress(flatProgress: number): {
  rank: number;
  subrank: number;
  tierName: string;
  subrankRoman: string;
  label: string;
} {
  const s = Math.floor(flatProgress / 1000);
  const totalSubrankIndex = s - 7;

  if (totalSubrankIndex < 0) {
    return {
      rank: 0,
      subrank: 1,
      tierName: DEADLOCK_RANK_NAMES[0] || 'Obscurus',
      subrankRoman: 'I',
      label: `${flatProgress.toLocaleString()} pts`,
    };
  }

  const rank = Math.min(11, Math.floor(totalSubrankIndex / 6) + 1);
  const subrank = Math.min(6, (totalSubrankIndex % 6) + 1);
  const tierName = DEADLOCK_RANK_NAMES[rank] || `Tier ${rank}`;
  const subrankRoman = ROMAN_NUMERALS[subrank] || String(subrank);

  return {
    rank,
    subrank,
    tierName,
    subrankRoman,
    label: `${tierName} ${subrankRoman}`,
  };
}

export interface RankedChartPoint {
  match: Match;
  index: number;
  startProgress: number;
  endProgress: number;
  effectiveDelta: number;
  shieldEvent?: RankedShieldEvent;
  x: number;
  y: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export interface RankedThresholdLine {
  y: number;
  val: number;
  label: string;
}

export interface RankedChartData {
  width: number;
  height: number;
  padding: { top: number; right: number; bottom: number; left: number };
  points: RankedChartPoint[];
  finalEndpoint: { x: number; y: number; progress: number } | null;
  areaD: string;
  thresholdLines: RankedThresholdLine[];
  yMin: number;
  yMax: number;
}

/**
 * Computes the geometry, coordinates, SVG paths, and threshold lines for the ranked evolution chart.
 */
export function computeRankedChartGeometry(
  filteredMatches: Match[],
  shieldEventsMap: Map<string, RankedShieldEvent>,
  matchDeltasMap: Map<string, number>
): RankedChartData | null {
  if (filteredMatches.length === 0) return null;

  const allProgressValues: number[] = [];
  const matchPointsData = filteredMatches.map((m, idx) => {
    const effectiveDelta = matchDeltasMap.get(m.id) ?? (m.rankedDelta || 0);
    const startProgress =
      m.rankedInitialProgress !== null && m.rankedInitialProgress !== undefined
        ? m.rankedInitialProgress
        : m.rankedProgress !== null && m.rankedProgress !== undefined
        ? m.rankedProgress - effectiveDelta
        : 0;
    const endProgress =
      m.rankedProgress !== null && m.rankedProgress !== undefined
        ? m.rankedProgress
        : startProgress + effectiveDelta;

    allProgressValues.push(startProgress, endProgress);

    const shieldEvent = shieldEventsMap.get(m.id);
    return {
      match: m,
      index: idx,
      startProgress,
      endProgress,
      effectiveDelta,
      shieldEvent,
    };
  });

  const minVal = Math.min(...allProgressValues);
  const maxVal = Math.max(...allProgressValues);

  // Boundaries snapped to subrank boundaries
  const yMin = Math.max(0, Math.floor((minVal - 200) / 1000) * 1000);
  const yMax = Math.ceil((maxVal + 300) / 1000) * 1000;
  const yRange = Math.max(1000, yMax - yMin);

  const width = 860;
  const height = 280;
  const padding = { top: 30, right: 35, bottom: 40, left: 80 };

  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const n = filteredMatches.length;

  const points: RankedChartPoint[] = matchPointsData.map((item, idx) => {
    const startX = n === 1 ? padding.left + 0.15 * chartW : padding.left + (idx / n) * chartW;
    const endX = n === 1 ? padding.left + 0.85 * chartW : padding.left + ((idx + 1) / n) * chartW;
    const startY = padding.top + chartH - ((item.startProgress - yMin) / yRange) * chartH;
    const endY = padding.top + chartH - ((item.endProgress - yMin) / yRange) * chartH;

    return {
      ...item,
      x: startX,
      y: startY,
      startX,
      startY,
      endX,
      endY,
    };
  });

  const finalEndpoint =
    points.length > 0
      ? {
          x: points[points.length - 1].endX,
          y: points[points.length - 1].endY,
          progress: points[points.length - 1].endProgress,
        }
      : null;

  // Filled area path with direct lines
  let areaD = '';
  if (points.length > 0 && finalEndpoint) {
    let d = `M ${points[0].startX} ${points[0].startY}`;
    for (let i = 0; i < points.length; i++) {
      d += ` L ${points[i].endX} ${points[i].endY}`;
      if (i < points.length - 1 && points[i].endY !== points[i + 1].startY) {
        d += ` L ${points[i + 1].startX} ${points[i + 1].startY}`;
      }
    }
    d += ` L ${finalEndpoint.x} ${padding.top + chartH}`;
    d += ` L ${points[0].startX} ${padding.top + chartH} Z`;
    areaD = d;
  }

  // Generate horizontal subrank threshold grid lines displaying accurate subrank names
  const thresholdLines: RankedThresholdLine[] = [];
  const minStep = Math.floor(yMin / 1000);
  const maxStep = Math.ceil(yMax / 1000);

  for (let s = minStep; s <= maxStep; s++) {
    const v = s * 1000;
    const y = padding.top + chartH - ((v - yMin) / yRange) * chartH;
    const rankInfo = getRankTierFromFlatProgress(v);
    thresholdLines.push({ y, val: v, label: rankInfo.label });
  }

  return {
    width,
    height,
    padding,
    points,
    finalEndpoint,
    areaD,
    thresholdLines,
    yMin,
    yMax,
  };
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
  // Range filter controls
  rangeFilter: 'chunk50' | 'last10' | 'last20';
  onRangeFilterChange: (mode: 'chunk50' | 'last10' | 'last20') => void;
  activeChunkIndex: number;
  onChunkIndexChange: (index: number) => void;
  // Hero highlight filter
  selectedHeroId: number | null;
  onSelectHeroId: (heroId: number | null) => void;
  rankedHeroes: RankedHeroFilterOption[];
  // Current standing for final endpoint tooltip
  currentStanding?: {
    tierName: string;
    subrankRoman: string;
    progressInSubrank: number;
  };
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
  activeChunkIndex,
  onChunkIndexChange,
  selectedHeroId,
  onSelectHeroId,
  rankedHeroes,
  currentStanding,
}) => {
  // 50-match pagination chunks navigation calculation
  const CHUNK_SIZE = 50;
  const totalChunks = Math.max(1, Math.ceil(totalRanked / CHUNK_SIZE));
  const chunkStart = totalRanked === 0 ? 0 : activeChunkIndex * CHUNK_SIZE + 1;
  const chunkEnd = Math.min(totalRanked, (activeChunkIndex + 1) * CHUNK_SIZE);

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

  const [hoveredFinalPoint, setHoveredFinalPoint] = useState<{
    x: number;
    y: number;
    progress: number;
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

  // SVG Chart Geometry calculations
  const chartData = useMemo(() => {
    return computeRankedChartGeometry(filteredMatches, shieldEventsMap, matchDeltasMap);
  }, [filteredMatches, shieldEventsMap, matchDeltasMap]);

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
          {/* Range Filter Buttons: 50-match Tranches with Arrows + Quick Last 20 / Last 10 */}
          <div className="flex items-center bg-deadlock-dark/80 p-0.5 rounded-lg border border-deadlock-border/60">
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => {
                  onRangeFilterChange('chunk50');
                  onChunkIndexChange(Math.max(0, activeChunkIndex - 1));
                }}
                disabled={activeChunkIndex <= 0}
                title="Previous 50 matches (older)"
                className="p-1 rounded-l-md text-deadlock-muted hover:text-deadlock-steam disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onRangeFilterChange('chunk50')}
                className={`px-2 py-1 text-[11px] font-medium transition-colors ${
                  rangeFilter === 'chunk50'
                    ? 'bg-deadlock-accent/25 text-deadlock-accent font-bold'
                    : 'text-deadlock-muted hover:text-deadlock-steam'
                }`}
              >
                {totalChunks > 1
                  ? `Matches ${chunkStart}–${chunkEnd} of ${totalRanked}`
                  : `Matches 1–${totalRanked} (${totalRanked})`}
              </button>
              <button
                type="button"
                onClick={() => {
                  onRangeFilterChange('chunk50');
                  onChunkIndexChange(Math.min(totalChunks - 1, activeChunkIndex + 1));
                }}
                disabled={activeChunkIndex >= totalChunks - 1}
                title="Next 50 matches (newer)"
                className="p-1 rounded-r-md text-deadlock-muted hover:text-deadlock-steam disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="h-3.5 w-[1px] bg-deadlock-border/40 mx-0.5" />

            <button
              type="button"
              onClick={() => onRangeFilterChange('last20')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                rangeFilter === 'last20'
                  ? 'bg-deadlock-accent/25 text-deadlock-accent font-bold'
                  : 'text-deadlock-muted hover:text-deadlock-steam'
              }`}
            >
              Last 20
            </button>
            <button
              type="button"
              onClick={() => onRangeFilterChange('last10')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                rangeFilter === 'last10'
                  ? 'bg-deadlock-accent/25 text-deadlock-accent font-bold'
                  : 'text-deadlock-muted hover:text-deadlock-steam'
              }`}
            >
              Last 10
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

          {/* Hero Highlight Selector (keeps curve intact, grays out non-matching matches) */}
          {rankedHeroes.length > 1 && (
            <select
              value={selectedHeroId || ''}
              onChange={(e) => onSelectHeroId(e.target.value ? Number(e.target.value) : null)}
              className={`bg-deadlock-dark/80 border rounded-lg px-2.5 py-1 text-[11px] text-deadlock-steam focus:outline-none transition-colors ${
                selectedHeroId ? 'border-deadlock-accent text-deadlock-accent font-bold' : 'border-deadlock-border/80'
              }`}
            >
              <option value="">Highlight Hero (All)</option>
              {rankedHeroes.map((item) => (
                <option key={item.heroId} value={item.heroId}>
                  {item.hero?.name || `#${item.heroId}`} ({item.totalDelta > 0 ? `+${item.totalDelta}` : item.totalDelta} pts · {item.count}g)
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* SVG Interactive Chart */}
      {chartData && (
        <div className="relative w-full h-[320px] 2xl:h-[420px] bg-deadlock-dark/60 rounded-xl border border-deadlock-border/60 p-2 overflow-visible select-none z-20">
          <svg
            viewBox={`0 0 ${chartData.width} ${chartData.height}`}
            className="w-full h-full overflow-visible"
            preserveAspectRatio="none"
            onMouseLeave={() => {
              setHoveredPoint(null);
              setHoveredFinalPoint(null);
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

            {/* Horizontal Subrank Threshold Lines displaying ONLY Subrank Names */}
            {chartData.thresholdLines.map((line, idx) => (
              <g key={idx}>
                <line
                  x1={chartData.padding.left}
                  y1={line.y}
                  x2={chartData.width - chartData.padding.right}
                  y2={line.y}
                  stroke="#b87333"
                  strokeWidth={1.2}
                  strokeDasharray="4 3"
                  strokeOpacity={0.55}
                />
                <text
                  x={chartData.padding.left - 10}
                  y={line.y + 3.5}
                  textAnchor="end"
                  className="font-mono text-[9px] fill-deadlock-accent font-bold"
                >
                  {line.label}
                </text>
              </g>
            ))}

            {/* Area Fill */}
            {chartData.areaD && (
              <path
                d={chartData.areaD}
                fill="url(#rankedGradient)"
                opacity={selectedHeroId ? 0.25 : 1}
                className="transition-opacity duration-300"
              />
            )}

            {/* Evolution Curve Segments: each trait represents the gain/loss of the match */}
            {chartData.points.map((pt, idx) => {
              const isHeroMatch =
                selectedHeroId === null || pt.match.myHeroId === selectedHeroId;
              const isWin = pt.effectiveDelta > 0 || pt.match.result === 'win';
              const isLoss = pt.effectiveDelta < 0 || pt.match.result === 'loss';

              return (
                <g key={`seg-group-${idx}`}>
                  {/* Inter-match gap connector (dashed line / pointillés when matches are missing) */}
                  {idx > 0 && chartData.points[idx - 1].endProgress !== pt.startProgress && (() => {
                    const prevPt = chartData.points[idx - 1];
                    const gapPoints = pt.startProgress - prevPt.endProgress;
                    return (
                      <g key={`gap-group-${idx}`}>
                        {/* Transparent hover hit area for gap line */}
                        <line
                          x1={prevPt.endX}
                          y1={prevPt.endY}
                          x2={pt.startX}
                          y2={pt.startY}
                          stroke="transparent"
                          strokeWidth={16}
                          className="cursor-pointer"
                          onMouseEnter={() => {
                            setHoveredPoint(null);
                            setHoveredFinalPoint(null);
                            setHoveredGap({
                              x: pt.startX,
                              y: (prevPt.endY + pt.startY) / 2,
                              gapPoints,
                              prevMatch: prevPt.match,
                              nextMatch: pt.match,
                            });
                          }}
                        >
                          <title>{`Missing match gap: ${gapPoints > 0 ? '+' : ''}${gapPoints} pts`}</title>
                        </line>

                        {/* Distinct glowing dashed line indicating missing matches */}
                        <line
                          x1={prevPt.endX}
                          y1={prevPt.endY}
                          x2={pt.startX}
                          y2={pt.startY}
                          stroke="#f59e0b"
                          strokeWidth={2}
                          strokeDasharray="4 4"
                          strokeOpacity={0.9}
                          strokeLinecap="round"
                          style={{
                            filter: 'drop-shadow(0 0 5px rgba(245, 158, 11, 0.75))',
                          }}
                        />

                        {/* Gap endpoint marker at the start of the jump */}
                        <circle
                          cx={prevPt.endX}
                          cy={prevPt.endY}
                          r={2.5}
                          fill="#f59e0b"
                          stroke="#110f0c"
                          strokeWidth={1}
                        />
                      </g>
                    );
                  })()}

                  {/* Match Gain / Loss Trait */}
                  <line
                    x1={pt.startX}
                    y1={pt.startY}
                    x2={pt.endX}
                    y2={pt.endY}
                    stroke={
                      !isHeroMatch
                        ? '#5a4e3c'
                        : isWin
                        ? '#5f8f7a'
                        : isLoss
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
                            filter: isWin
                              ? 'drop-shadow(0 2px 6px rgba(95,143,122,0.45))'
                              : isLoss
                              ? 'drop-shadow(0 2px 6px rgba(169,68,66,0.45))'
                              : 'drop-shadow(0 2px 6px rgba(232,192,106,0.4))',
                          }
                        : undefined
                    }
                  />
                </g>
              );
            })}

            {/* Vertical guideline on hover */}
            {hoveredPoint && (
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
            {chartData.points.map((pt) => {
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
                        setHoveredFinalPoint(null);
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
                        setHoveredFinalPoint(null);
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
                      setHoveredFinalPoint(null);
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

            {/* Final Endpoint: Current Standing at the end of the last match */}
            {chartData.finalEndpoint && (
              <g>
                <circle
                  cx={chartData.finalEndpoint.x}
                  cy={chartData.finalEndpoint.y}
                  r="12"
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => {
                    setHoveredPoint(null);
                    setHoveredGap(null);
                    setHoveredFinalPoint({
                      x: chartData.finalEndpoint!.x,
                      y: chartData.finalEndpoint!.y,
                      progress: chartData.finalEndpoint!.progress,
                    });
                  }}
                />
                <circle
                  cx={chartData.finalEndpoint.x}
                  cy={chartData.finalEndpoint.y}
                  r={hoveredFinalPoint ? 6 : 4.5}
                  fill="#e8c06a"
                  stroke="#110f0c"
                  strokeWidth={1.5}
                  className="transition-all duration-150 pointer-events-none drop-shadow-[0_0_8px_rgba(232,192,106,0.9)]"
                />
              </g>
            )}
          </svg>

          {/* Steampunk Minimalist Tooltip on Hover */}
          {hoveredPoint && (() => {
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
            const startProg =
              hoveredPoint.startProgress ?? (hoveredPoint.match.rankedInitialProgress ?? 0);
            const rankTier =
              hoveredPoint.match.rankedRank ||
              (hoveredPoint.match.rankedBadge ? Math.floor(hoveredPoint.match.rankedBadge / 10) : 1);
            const subrank =
              hoveredPoint.match.rankedSubrank ??
              (hoveredPoint.match.rankedBadge ? hoveredPoint.match.rankedBadge % 10 : 1);
            const subrankRoman = ROMAN_NUMERALS[subrank] || String(subrank);
            const tierName = DEADLOCK_RANK_NAMES[rankTier] || 'Initiate';
            const progressInSub = startProg % 1000;
            const standingText = `${tierName} ${subrankRoman} · ${progressInSub} pts`;
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

          {/* Current Standing Tooltip on Hovering Final Endpoint */}
          {hoveredFinalPoint && (() => {
            const xPercent = (hoveredFinalPoint.x / chartData.width) * 100;
            const showBelow = hoveredFinalPoint.y < chartData.height * 0.45;
            const verticalClass = showBelow ? 'translate-y-3' : '-translate-y-full -translate-y-3';
            const fallbackRank = getRankTierFromFlatProgress(hoveredFinalPoint.progress);
            const tierName = currentStanding?.tierName || fallbackRank.tierName;
            const subrankRoman = currentStanding?.subrankRoman || fallbackRank.subrankRoman;
            const progressInSubrank =
              currentStanding !== undefined
                ? currentStanding.progressInSubrank
                : hoveredFinalPoint.progress % 1000;

            return (
              <div
                className={`absolute z-50 pointer-events-none transition-all duration-75 transform -translate-x-full ${verticalClass}`}
                style={{
                  left: `${xPercent}%`,
                  top: `${(hoveredFinalPoint.y / chartData.height) * 100}%`,
                }}
              >
                <div className="bg-deadlock-dark/95 backdrop-blur-md border border-deadlock-brass/80 shadow-2xl rounded-lg px-2.5 py-1.5 flex flex-col items-center gap-0.5 text-center drop-shadow-[0_4px_16px_rgba(0,0,0,0.95)] whitespace-nowrap">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-deadlock-accent">
                    Current Standing
                  </span>
                  <span className="font-mono text-xs font-bold text-deadlock-steam leading-tight">
                    {tierName} {subrankRoman} · {progressInSubrank} / 1,000 pts
                  </span>
                  <span className="font-mono text-[9px] text-deadlock-muted leading-tight">
                    {hoveredFinalPoint.progress.toLocaleString()} ladder points
                  </span>
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

      {/* Chart Legend */}
      <div className="flex items-center justify-between flex-wrap gap-3 pt-3 px-1 text-[11px] font-mono text-deadlock-muted border-t border-deadlock-border/40 relative z-10">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="flex items-center gap-1.5" title="Point shows player rank standing at match start">
            <span className="w-2.5 h-2.5 rounded-full border border-deadlock-accent bg-deadlock-dark" />
            <span>Point: Standing at Game</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3.5 h-1 rounded bg-[#5f8f7a]" />
            <span>Victory Trait (+pts)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3.5 h-1 rounded bg-[#a94442]" />
            <span>Defeat Trait (-pts)</span>
          </span>
          <span className="flex items-center gap-1.5" title="Discontinuity between recorded matches">
            <span className="w-3.5 h-0 border-b-2 border-dashed border-amber-400" />
            <span>Missing Matches Gap</span>
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
          {chartData?.finalEndpoint && (
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#e8c06a] border border-[#110f0c]" />
              <span>Current Standing</span>
            </span>
          )}
        </div>
        <span className="text-[10px] text-deadlock-muted/70 italic">
          Click any point to view match details
        </span>
      </div>
    </div>
  );
};
