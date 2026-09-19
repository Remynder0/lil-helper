import React, { useMemo, useState } from 'react';
import {
  Match,
  ConnectedProfile,
  LANE_LABELS,
  LANE_OUTCOME_LABELS,
  SIDE_LABELS,
} from '../types/match';
import { getHeroById } from '../data/heroes';
import { DEADLOCK_RANK_NAMES } from '../services/deadlockApi';
import { HeroAvatar } from './HeroAvatar';
import {
  Trophy,
  TrendingUp,
  TrendingDown,
  Award,
  Shield,
  Flame,
  BarChart2,
  Users,
  Calendar,
  Clock,
  X,
} from 'lucide-react';
import artDecoCorner from '../assets/art-deco/corner.svg';

interface RankedProgressionViewProps {
  matches: Match[];
  profile?: ConnectedProfile | null;
}

const ROMAN_NUMERALS = ['', 'I', 'II', 'III', 'IV', 'V', 'VI'];

export const RankedProgressionView: React.FC<RankedProgressionViewProps> = ({
  matches,
  profile,
}) => {
  // Filter range: 'all' | 'last10' | 'last20'
  const [rangeFilter, setRangeFilter] = useState<'all' | 'last10' | 'last20'>('all');
  // Selected hero filter: highlights corresponding sections and grays out others
  const [selectedHeroId, setSelectedHeroId] = useState<number | null>(null);
  // Selected match on chart click to display full game details underneath
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  // Hovered match point for chart tooltip
  const [hoveredPoint, setHoveredPoint] = useState<{
    match: Match;
    x: number;
    y: number;
    index: number;
  } | null>(null);

  // Filter matches that have ranked data, strictly excluding Obscurus (unranked / calibration badge 0)
  const rankedMatchesChronological = useMemo(() => {
    return matches
      .filter(
        (m) =>
          m.rankedDelta !== undefined &&
          m.rankedDelta !== null &&
          m.rankedProgress !== undefined &&
          m.rankedProgress !== null &&
          (m.rankedBadge ?? 0) > 0 &&
          (m.rankedRank ?? 0) > 0 &&
          (m.rankedProgress ?? 0) > 0
      )
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [matches]);

  // Played heroes in ranked with total points won/lost
  const rankedHeroes = useMemo(() => {
    const heroMap = new Map<
      number,
      { count: number; wins: number; losses: number; totalDelta: number }
    >();

    rankedMatchesChronological.forEach((m) => {
      const current = heroMap.get(m.myHeroId) || {
        count: 0,
        wins: 0,
        losses: 0,
        totalDelta: 0,
      };
      current.count += 1;
      if (m.result === 'win') current.wins += 1;
      else if (m.result === 'loss') current.losses += 1;
      current.totalDelta += m.rankedDelta || 0;
      heroMap.set(m.myHeroId, current);
    });

    return Array.from(heroMap.entries())
      .map(([heroId, data]) => ({
        heroId,
        hero: getHeroById(heroId),
        count: data.count,
        wins: data.wins,
        losses: data.losses,
        winRate: data.count > 0 ? Math.round((data.wins / data.count) * 100) : 0,
        totalDelta: data.totalDelta,
        avgDelta: data.count > 0 ? Math.round(data.totalDelta / data.count) : 0,
      }))
      .sort((a, b) => b.totalDelta - a.totalDelta);
  }, [rankedMatchesChronological]);

  // Apply range filter to full data series (all matches kept in timeline, hero selection will gray out unselected)
  const filteredMatches = useMemo(() => {
    let list = [...rankedMatchesChronological];
    if (rangeFilter === 'last10') {
      list = list.slice(-10);
    } else if (rangeFilter === 'last20') {
      list = list.slice(-20);
    }
    return list;
  }, [rankedMatchesChronological, rangeFilter]);

  // Key KPI stats
  const stats = useMemo(() => {
    if (rankedMatchesChronological.length === 0) {
      return null;
    }

    const latest = rankedMatchesChronological[rankedMatchesChronological.length - 1];
    const currentProgress = latest.rankedProgress ?? 0;
    const currentRank = latest.rankedRank || (latest.rankedBadge ? Math.floor(latest.rankedBadge / 10) : 1);
    // Subrank is directly derived from flat progress (1000 pts per subrank):
    // 0-999 -> Subrank 1 (I), 1000-1999 -> Subrank 2 (II), 2000-2999 -> Subrank 3 (III), 3000-3999 -> Subrank 4 (IV)
    const currentSubrank = Math.min(6, Math.max(1, Math.floor((currentProgress % 6000) / 1000) + 1));
    const currentBadge = currentRank * 10 + currentSubrank;
    const currentTierName = DEADLOCK_RANK_NAMES[currentRank] || `Tier ${currentRank}`;
    const currentSubrankRoman = ROMAN_NUMERALS[currentSubrank] || (currentSubrank > 0 ? String(currentSubrank) : '');

    // Progress within current subrank (1000 points per subrank)
    const progressInSubrank = currentProgress % 1000;
    const progressMaxSubrank = 1000;
    const subrankPercent = Math.min(100, Math.round((progressInSubrank / progressMaxSubrank) * 100));

    // Net delta across all matches
    const totalDelta = rankedMatchesChronological.reduce((sum, m) => sum + (m.rankedDelta || 0), 0);

    // Wins and losses deltas
    const winDeltas = rankedMatchesChronological
      .filter((m) => (m.rankedDelta || 0) > 0)
      .map((m) => m.rankedDelta || 0);
    const lossDeltas = rankedMatchesChronological
      .filter((m) => (m.rankedDelta || 0) < 0)
      .map((m) => m.rankedDelta || 0);

    const avgWin = winDeltas.length > 0 ? Math.round(winDeltas.reduce((a, b) => a + b, 0) / winDeltas.length) : 0;
    const avgLoss = lossDeltas.length > 0 ? Math.round(lossDeltas.reduce((a, b) => a + b, 0) / lossDeltas.length) : 0;

    // Peak progress
    const peakProgress = Math.max(...rankedMatchesChronological.map((m) => m.rankedProgress || 0));
    const peakRank = currentRank;
    const peakSubrank = Math.min(6, Math.max(1, Math.floor((peakProgress % 6000) / 1000) + 1));
    const peakTierName = DEADLOCK_RANK_NAMES[peakRank] || `Tier ${peakRank}`;
    const peakSubrankRoman = ROMAN_NUMERALS[peakSubrank] || (peakSubrank > 0 ? String(peakSubrank) : '');

    const totalWins = rankedMatchesChronological.filter((m) => m.result === 'win').length;
    const totalLosses = rankedMatchesChronological.filter((m) => m.result === 'loss').length;
    const winRate = totalWins + totalLosses > 0 ? Math.round((totalWins / (totalWins + totalLosses)) * 100) : 0;

    return {
      currentProgress,
      currentBadge,
      currentRank,
      currentSubrank,
      currentTierName,
      currentSubrankRoman,
      progressInSubrank,
      progressMaxSubrank,
      subrankPercent,
      totalDelta,
      avgWin,
      avgLoss,
      peakProgress,
      peakTierName,
      peakSubrankRoman,
      totalWins,
      totalLosses,
      winRate,
      totalRanked: rankedMatchesChronological.length,
    };
  }, [rankedMatchesChronological]);

  // SVG Chart Geometry calculations
  const chartData = useMemo(() => {
    if (filteredMatches.length === 0) return null;

    const values = filteredMatches.map((m) => m.rankedProgress || 0);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);

    // Boundaries snapped to subrank boundaries
    const yMin = Math.max(0, Math.floor((minVal - 200) / 1000) * 1000);
    const yMax = Math.ceil((maxVal + 300) / 1000) * 1000;
    const yRange = Math.max(1000, yMax - yMin);

    const width = 860;
    const height = 280;
    const padding = { top: 30, right: 35, bottom: 40, left: 80 };

    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const points = filteredMatches.map((m, idx) => {
      const x =
        filteredMatches.length === 1
          ? padding.left + chartW / 2
          : padding.left + (idx / (filteredMatches.length - 1)) * chartW;
      const progress = m.rankedProgress || 0;
      const y = padding.top + chartH - ((progress - yMin) / yRange) * chartH;
      return { x, y, match: m, index: idx };
    });

    // Filled area path with direct lines
    const pathD = points.reduce((acc, pt, i) => {
      return i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
    }, '');

    const areaD = points.length > 0
      ? `${pathD} L ${points[points.length - 1].x} ${padding.top + chartH} L ${points[0].x} ${padding.top + chartH} Z`
      : '';

    // Generate horizontal subrank threshold grid lines displaying ONLY the subrank names
    const thresholdLines: { y: number; val: number; label: string }[] = [];
    const minSubrank = Math.max(0, Math.floor(yMin / 1000));
    const maxSubrank = Math.min(6, Math.ceil(yMax / 1000));

    for (let s = minSubrank; s <= maxSubrank; s++) {
      const v = s * 1000;
      const y = padding.top + chartH - ((v - yMin) / yRange) * chartH;
      const subrankIdx = Math.min(6, s + 1);
      const subrankRoman = ROMAN_NUMERALS[subrankIdx] || String(subrankIdx);
      const tierName = stats?.currentTierName || 'Initiate';
      const label = `${tierName} ${subrankRoman}`;
      thresholdLines.push({ y, val: v, label });
    }

    return {
      width,
      height,
      padding,
      points,
      pathD,
      areaD,
      thresholdLines,
      yMin,
      yMax,
    };
  }, [filteredMatches, stats?.currentTierName]);

  if (rankedMatchesChronological.length === 0) {
    return (
      <div className="steam-glass steam-panel rounded-xl p-10 border border-deadlock-border/80 flex flex-col items-center justify-center gap-4 text-center">
        <Trophy className="w-12 h-12 text-deadlock-accent/60 animate-pulse" />
        <h3 className="text-base font-bold uppercase tracking-wider text-deadlock-steam">
          No Ranked Match Points Recorded
        </h3>
        <p className="text-xs text-deadlock-muted max-w-md">
          Once your matches are synchronized with the Deadlock API, your exact ranked points progression, subrank standings, and performance curve will be automatically tracked here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 1. TOP STATS CARDS */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Current Standing */}
          <div className="steam-glass steam-panel rounded-xl p-4 border border-deadlock-brass/40 shadow-lg flex flex-col justify-between relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-deadlock-muted">
                Current Standing
              </span>
              <Award className="w-4 h-4 text-deadlock-accent group-hover:scale-110 transition-transform" />
            </div>

            <div className="flex items-center gap-3 my-2">
              <div className="w-12 h-12 shrink-0 rounded-lg bg-deadlock-dark/80 border border-deadlock-brass/50 flex items-center justify-center p-1 drop-shadow-[0_2px_10px_rgba(232,192,106,0.3)]">
                <img
                  src={`https://api.deadlock-api.com/v1/assets/ranks/${stats.currentRank}/${stats.currentSubrank}/image`}
                  alt=""
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    if (profile?.accountId) {
                      (e.target as HTMLImageElement).src = `https://api.deadlock-api.com/v1/players/${profile.accountId}/rank/image`;
                    }
                  }}
                />
              </div>
              <div className="flex flex-col">
                <div className="text-lg font-bold font-display text-deadlock-steam flex items-center gap-1.5 leading-tight">
                  <span>{stats.currentTierName}</span>
                  <span className="text-deadlock-accent font-serif">{stats.currentSubrankRoman}</span>
                </div>
                <span className="text-[11px] font-mono text-deadlock-accent font-bold">
                  {stats.progressInSubrank} / 1,000 pts
                </span>
              </div>
            </div>

            {/* Subrank progress bar */}
            <div className="w-full h-1.5 rounded-full bg-deadlock-dark/90 overflow-hidden border border-deadlock-border/60 mt-2">
              <div
                className="h-full bg-gradient-to-r from-deadlock-brass via-deadlock-accent to-amber-300 rounded-full transition-all duration-500"
                style={{ width: `${stats.subrankPercent}%` }}
              />
            </div>
          </div>

          {/* Card 2: Net Ranked Points Balance */}
          <div className="steam-glass steam-panel rounded-xl p-4 border border-deadlock-border/80 shadow-lg flex flex-col justify-between relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-deadlock-muted">
                Net Points Balance
              </span>
              {stats.totalDelta >= 0 ? (
                <TrendingUp className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
              ) : (
                <TrendingDown className="w-4 h-4 text-rose-400 group-hover:scale-110 transition-transform" />
              )}
            </div>

            <div className="my-2">
              <div
                className={`text-2xl font-black font-mono tracking-tight flex items-baseline gap-1 ${
                  stats.totalDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                <span>{stats.totalDelta > 0 ? `+${stats.totalDelta.toLocaleString()}` : stats.totalDelta.toLocaleString()}</span>
                <span className="text-xs font-normal text-deadlock-muted">pts</span>
              </div>
              <p className="text-[11px] text-deadlock-muted mt-0.5">
                Over {stats.totalRanked} recorded ranked matches
              </p>
            </div>
          </div>

          {/* Card 3: Average Points per Game */}
          <div className="steam-glass steam-panel rounded-xl p-4 border border-deadlock-border/80 shadow-lg flex flex-col justify-between relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-deadlock-muted">
                Points Dynamic
              </span>
              <Flame className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
            </div>

            <div className="grid grid-cols-2 gap-2 my-2">
              <div className="flex flex-col bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-2 text-center">
                <span className="text-[10px] uppercase font-bold text-emerald-300">Avg Gain</span>
                <span className="text-base font-black font-mono text-emerald-400">
                  +{stats.avgWin}
                </span>
              </div>
              <div className="flex flex-col bg-rose-500/10 border border-rose-500/30 rounded-lg p-2 text-center">
                <span className="text-[10px] uppercase font-bold text-rose-300">Avg Loss</span>
                <span className="text-base font-black font-mono text-rose-400">
                  {stats.avgLoss}
                </span>
              </div>
            </div>
          </div>

          {/* Card 4: Peak Standing */}
          <div className="steam-glass steam-panel rounded-xl p-4 border border-deadlock-border/80 shadow-lg flex flex-col justify-between relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-deadlock-muted">
                Peak Standing
              </span>
              <Shield className="w-4 h-4 text-deadlock-brass group-hover:scale-110 transition-transform" />
            </div>

            <div className="my-2">
              <div className="text-lg font-bold font-display text-deadlock-steam flex items-center gap-1.5 leading-tight">
                <span>{stats.peakTierName}</span>
                <span className="text-deadlock-accent font-serif">{stats.peakSubrankRoman}</span>
              </div>
              <div className="text-xs font-mono font-bold text-deadlock-accent mt-0.5">
                {stats.peakProgress % 1000} / 1,000 pts
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. PROGRESSION CHART SECTION */}
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
            {/* Range Filter Buttons */}
            <div className="flex items-center bg-deadlock-dark/80 p-0.5 rounded-lg border border-deadlock-border/60">
              <button
                type="button"
                onClick={() => setRangeFilter('all')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  rangeFilter === 'all'
                    ? 'bg-deadlock-accent/25 text-deadlock-accent font-bold'
                    : 'text-deadlock-muted hover:text-deadlock-steam'
                }`}
              >
                All ({rankedMatchesChronological.length})
              </button>
              <button
                type="button"
                onClick={() => setRangeFilter('last20')}
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
                onClick={() => setRangeFilter('last10')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  rangeFilter === 'last10'
                    ? 'bg-deadlock-accent/25 text-deadlock-accent font-bold'
                    : 'text-deadlock-muted hover:text-deadlock-steam'
                }`}
              >
                Last 10
              </button>
            </div>

            {/* Hero Highlight Selector (keeps curve intact, grays out non-matching matches) */}
            {rankedHeroes.length > 1 && (
              <select
                value={selectedHeroId || ''}
                onChange={(e) => setSelectedHeroId(e.target.value ? Number(e.target.value) : null)}
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
          <div className="relative w-full h-[320px] bg-deadlock-dark/60 rounded-xl border border-deadlock-border/60 p-2 overflow-visible select-none z-20">
            <svg
              viewBox={`0 0 ${chartData.width} ${chartData.height}`}
              className="w-full h-full overflow-visible"
              preserveAspectRatio="none"
              onMouseLeave={() => setHoveredPoint(null)}
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

              {/* Evolution Curve Segments: direct lines (horizontal when points have same value, diagonal otherwise) */}
              {chartData.points.map((pt, idx) => {
                if (idx === 0) return null;
                const prevPt = chartData.points[idx - 1];
                const isHeroMatch =
                  selectedHeroId === null ||
                  pt.match.myHeroId === selectedHeroId ||
                  prevPt.match.myHeroId === selectedHeroId;

                return (
                  <path
                    key={`seg-${idx}`}
                    d={`M ${prevPt.x} ${prevPt.y} L ${pt.x} ${pt.y}`}
                    fill="none"
                    stroke={isHeroMatch ? '#e8c06a' : '#5a4e3c'}
                    strokeWidth={isHeroMatch ? (selectedHeroId ? 3.2 : 2.5) : 1.5}
                    strokeOpacity={isHeroMatch ? 1 : 0.3}
                    strokeDasharray={!isHeroMatch ? '3 3' : undefined}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={isHeroMatch ? { filter: 'drop-shadow(0 2px 6px rgba(232,192,106,0.4))' } : undefined}
                  />
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
                  strokeOpacity="0.7"
                />
              )}

              {/* Interactive Match Points on Curve */}
              {chartData.points.map((pt) => {
                const isWin = (pt.match.rankedDelta || 0) > 0;
                const isSelectedHero = selectedHeroId === null || pt.match.myHeroId === selectedHeroId;
                const isHovered = hoveredPoint?.index === pt.index;
                const isSelectedMatch = selectedMatch?.id === pt.match.id;

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

                    {/* Hover & Click target circle */}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r="12"
                      fill="transparent"
                      className="cursor-pointer"
                      onClick={() => {
                        setSelectedMatch(selectedMatch?.id === pt.match.id ? null : pt.match);
                      }}
                      onMouseEnter={() => {
                        setHoveredPoint({
                          match: pt.match,
                          x: pt.x,
                          y: pt.y,
                          index: pt.index,
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
                      stroke={isSelectedMatch ? '#fff' : isHovered ? '#e8c06a' : isSelectedHero && selectedHeroId ? '#e8c06a' : '#110f0c'}
                      strokeWidth={isSelectedMatch ? 2.5 : isHovered ? 2 : isSelectedHero && selectedHeroId ? 2 : 1.5}
                      className="transition-all duration-150 pointer-events-none drop-shadow-[0_0_6px_rgba(0,0,0,0.8)]"
                    />
                  </g>
                );
              })}
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

              const delta = hoveredPoint.match.rankedDelta || 0;
              const isPositive = delta > 0;
              const progress = hoveredPoint.match.rankedProgress || 0;
              const rankTier = hoveredPoint.match.rankedRank || 1;
              const subrank = Math.min(6, Math.max(1, Math.floor((progress % 6000) / 1000) + 1));
              const subrankRoman = ROMAN_NUMERALS[subrank] || String(subrank);
              const tierName = DEADLOCK_RANK_NAMES[rankTier] || 'Initiate';
              const progressInSub = progress % 1000;
              const standingText = `${tierName} ${subrankRoman} ${progressInSub}`;

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
                        isPositive ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {isPositive ? `+${delta} pts` : `${delta} pts`}
                    </span>
                    <span className="font-mono text-[11px] font-bold text-deadlock-steam leading-tight">
                      {standingText}
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* 3. SELECTED GAME DETAILS (displayed on graph point click) */}
      {selectedMatch && (() => {
        const myHero = getHeroById(selectedMatch.myHeroId);
        const isWin = selectedMatch.result === 'win';
        const durationM = selectedMatch.durationSeconds ? Math.floor(selectedMatch.durationSeconds / 60) : 0;
        const durationS = selectedMatch.durationSeconds ? selectedMatch.durationSeconds % 60 : 0;
        const delta = selectedMatch.rankedDelta || 0;
        const isPositive = delta > 0;
        const progress = selectedMatch.rankedProgress || 0;
        const rankTier = selectedMatch.rankedRank || 1;
        const subrank = Math.min(6, Math.max(1, Math.floor((progress % 6000) / 1000) + 1));
        const subrankRoman = ROMAN_NUMERALS[subrank] || '';
        const tierName = DEADLOCK_RANK_NAMES[rankTier] || 'Initiate';
        const progressInSub = progress % 1000;
        const enemySide = selectedMatch.side === 'hidden_king' ? 'archmother' : 'hidden_king';

        return (
          <div className="steam-glass steam-panel rounded-xl p-5 border border-deadlock-accent/50 shadow-2xl flex flex-col gap-4 relative animate-in fade-in duration-200">
            {/* Header: Hero, Outcome, Delta, Standing & Close */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-deadlock-border/60 pb-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl overflow-hidden border-2 border-deadlock-brass/70 shadow-lg bg-deadlock-panel shrink-0">
                  {myHero?.iconUrl ? (
                    <img src={myHero.iconUrl} alt={myHero.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs font-bold text-deadlock-muted">?</span>
                  )}
                </div>

                <div className="flex flex-col">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-base font-bold text-deadlock-steam font-display">
                      {myHero?.name || `Hero #${selectedMatch.myHeroId}`}
                    </span>
                    <span
                      className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border tracking-wide ${
                        isWin
                          ? 'bg-deadlock-win/20 text-deadlock-win border-deadlock-win/40 shadow-sm shadow-deadlock-win/20'
                          : 'bg-deadlock-loss/20 text-deadlock-loss border-deadlock-loss/40 shadow-sm shadow-deadlock-loss/20'
                      }`}
                    >
                      {isWin ? 'Victory' : 'Defeat'}
                    </span>
                    <span className="text-[11px] font-mono text-deadlock-muted bg-deadlock-dark/60 px-2 py-0.5 rounded border border-deadlock-border/50">
                      {SIDE_LABELS[selectedMatch.side]}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-deadlock-muted mt-1 font-mono">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-deadlock-accent/70" />
                      {new Date(selectedMatch.date).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {selectedMatch.durationSeconds !== undefined && selectedMatch.durationSeconds > 0 && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-deadlock-accent/70" />
                        {durationM}m {durationS < 10 ? `0${durationS}` : durationS}s
                      </span>
                    )}
                    {selectedMatch.matchId && (
                      <span className="text-deadlock-muted/70">
                        #{selectedMatch.matchId}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Points Delta, Standing & Close Button */}
              <div className="flex items-center gap-4 self-end md:self-center">
                <div className="flex flex-col items-end">
                  <span
                    className={`font-mono text-lg font-black tracking-tight ${
                      isPositive ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {isPositive ? `+${delta}` : delta} pts
                  </span>
                  <span className="text-xs font-mono text-deadlock-steam font-semibold">
                    {tierName} {subrankRoman} {progressInSub}
                    <span className="text-deadlock-muted font-normal text-[10px] ml-1">
                      ({progress.toLocaleString()} ladder)
                    </span>
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedMatch(null)}
                  className="p-1.5 rounded-lg text-deadlock-muted hover:text-deadlock-steam hover:bg-deadlock-dark border border-transparent hover:border-deadlock-border/60 transition-colors cursor-pointer"
                  title="Close match details"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Lineup & Matchups */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Your Team */}
              <div className="bg-deadlock-dark/60 rounded-xl p-3.5 border border-deadlock-border/60 flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-deadlock-steam flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    Your Team ({SIDE_LABELS[selectedMatch.side]})
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div title={`You: ${myHero?.name}`}>
                    <HeroAvatar
                      heroId={selectedMatch.myHeroId}
                      size="sm"
                      accentColor={selectedMatch.side}
                      isHighlighted={true}
                    />
                  </div>
                  <span className="w-px h-8 bg-deadlock-border/70 mx-1" />
                  {selectedMatch.allies.map((allyId, idx) => (
                    <div key={idx} title={getHeroById(allyId)?.name}>
                      <HeroAvatar heroId={allyId} size="xs" accentColor={selectedMatch.side} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Enemy Team */}
              <div className="bg-deadlock-dark/60 rounded-xl p-3.5 border border-deadlock-border/60 flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-deadlock-muted flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-400" />
                    Enemy Team ({SIDE_LABELS[enemySide]})
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {selectedMatch.enemies.map((enemyId, idx) => (
                    <div key={idx} title={getHeroById(enemyId)?.name}>
                      <HeroAvatar heroId={enemyId} size="xs" accentColor={enemySide} />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Lane Details & Notes (if available) */}
            {(selectedMatch.lane || selectedMatch.notes) && (
              <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-deadlock-border/40 text-xs">
                {selectedMatch.lane && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-deadlock-muted font-mono text-[11px]">Lane:</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                        selectedMatch.lane === 'yellow'
                          ? 'bg-yellow-500/15 border-yellow-500/40 text-yellow-300'
                          : selectedMatch.lane === 'blue'
                          ? 'bg-blue-500/15 border-blue-500/40 text-blue-300'
                          : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                      }`}
                    >
                      {LANE_LABELS[selectedMatch.lane]}
                    </span>
                    {selectedMatch.laneOutcome && (
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                          selectedMatch.laneOutcome === 'won'
                            ? 'bg-deadlock-win/15 border-deadlock-win/40 text-deadlock-win'
                            : selectedMatch.laneOutcome === 'lost'
                            ? 'bg-deadlock-loss/15 border-deadlock-loss/40 text-deadlock-loss'
                            : 'bg-yellow-500/15 border-yellow-500/40 text-yellow-300'
                        }`}
                      >
                        {LANE_OUTCOME_LABELS[selectedMatch.laneOutcome]}
                      </span>
                    )}
                  </div>
                )}
                {selectedMatch.notes && (
                  <div className="flex items-center gap-1.5 text-deadlock-muted italic">
                    <span className="font-mono not-italic text-[11px]">Note:</span>
                    <span>&quot;{selectedMatch.notes}&quot;</span>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* 3. HEROES RANKED POINTS BALANCE */}
      {rankedHeroes.length > 0 && (
        <div className="steam-glass steam-panel rounded-xl p-5 border border-deadlock-border/80 shadow-xl flex flex-col gap-4 relative">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-deadlock-border/60 pb-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-deadlock-accent" />
              <h3 className="text-sm font-bold tracking-wide uppercase text-deadlock-steam">
                Hero Points Balance
              </h3>
              <span className="text-[11px] font-mono text-deadlock-muted px-2 py-0.5 rounded-full bg-deadlock-card/80 border border-deadlock-border/60">
                {rankedHeroes.length} heroes played
              </span>
            </div>
            <span className="text-[11px] text-deadlock-muted">
              Click a hero to highlight their trajectory on the curve
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {rankedHeroes.map((item) => {
              const isSelected = selectedHeroId === item.heroId;
              const isPositive = item.totalDelta > 0;
              const isNegative = item.totalDelta < 0;

              return (
                <button
                  key={item.heroId}
                  type="button"
                  onClick={() => setSelectedHeroId(isSelected ? null : item.heroId)}
                  className={`relative text-left rounded-xl p-3 flex flex-col justify-between gap-2 transition-all duration-200 border cursor-pointer group ${
                    isSelected
                      ? 'bg-deadlock-accent/15 border-deadlock-accent shadow-[0_0_15px_rgba(232,192,106,0.25)] ring-1 ring-deadlock-accent/60 scale-[1.02]'
                      : selectedHeroId !== null
                      ? 'bg-deadlock-dark/40 border-deadlock-border/40 opacity-50 hover:opacity-90 hover:border-deadlock-border/80'
                      : 'bg-deadlock-dark/70 border-deadlock-border/70 hover:border-deadlock-brass/60 hover:bg-deadlock-dark/90'
                  }`}
                >
                  {/* Hero Header */}
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 border border-deadlock-border/70 bg-deadlock-card flex items-center justify-center">
                      {item.hero?.iconUrl ? (
                        <img
                          src={item.hero.iconUrl}
                          alt={item.hero.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <span className="text-xs font-bold text-deadlock-muted">?</span>
                      )}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-deadlock-steam truncate">
                        {item.hero?.name || `Hero #${item.heroId}`}
                      </span>
                      <span className="text-[10px] text-deadlock-muted font-mono">
                        {item.count} {item.count === 1 ? 'game' : 'games'} ({item.winRate}% WR)
                      </span>
                    </div>
                  </div>

                  {/* Net Points Delta */}
                  <div className="pt-1.5 border-t border-deadlock-border/40 flex flex-col">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[10px] uppercase font-mono text-deadlock-muted">Balance</span>
                      <span
                        className={`text-sm font-mono font-black ${
                          isPositive
                            ? 'text-emerald-400'
                            : isNegative
                            ? 'text-rose-400'
                            : 'text-deadlock-muted'
                        }`}
                      >
                        {isPositive ? `+${item.totalDelta.toLocaleString()}` : item.totalDelta.toLocaleString()} pts
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-mono mt-0.5 text-deadlock-muted">
                      <span>
                        {item.wins}W - {item.losses}L
                      </span>
                      <span>
                        {item.avgDelta > 0 ? `+${item.avgDelta}` : item.avgDelta} /g
                      </span>
                    </div>
                  </div>

                  {/* Active indicator dot if selected */}
                  {isSelected && (
                    <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-deadlock-accent animate-pulse" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
