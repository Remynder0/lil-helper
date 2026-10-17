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
  Users,
  Calendar,
  Clock,
  X,
} from 'lucide-react';
import {
  RankedProgressionChart,
  getRankTierFromFlatProgress,
  ROMAN_NUMERALS,
  RankedShieldEvent,
} from './RankedProgressionChart';

export { getRankTierFromFlatProgress, ROMAN_NUMERALS };
export type { RankedShieldEvent };

interface RankedProgressionViewProps {
  matches: Match[];
  profile?: ConnectedProfile | null;
}

export interface RankedShieldAnalysis {
  events: Map<string, RankedShieldEvent>;
  activeShields: number;
}

/**
 * Computes demotion protection shield events (earned / consumed) across chronological matches.
 * Uses both explicit API flags (consumed_demotion_protection, initial_demotion_protection_games)
 * and the Deadlock ranked rules:
 * - Subranks 1 and 2 reset with 5 demotion protection shields
 * - Subranks 3-6 reset with 2 demotion protection shields
 * - Subranks and tiers are directly derived from match rankedSubrank and rankedRank/rankedBadge
 * - Both promotions and demotions reset shields (entering a new tier always restores shields)
 * - Defeats at subrank floor (delta 0) or with explicit consumed_demotion_protection consume a shield
 */
export function computeRankedShieldEvents(matches: Match[]): RankedShieldAnalysis {
  const events = new Map<string, RankedShieldEvent>();
  let runningShields = 5; // Default reset for subranks 1 & 2

  for (let i = 0; i < matches.length; i++) {
    const curr = matches[i];
    const prev = i > 0 ? matches[i - 1] : null;

    const currProgress = curr.rankedProgress ?? 0;
    const currRank = curr.rankedRank ?? (curr.rankedBadge ? Math.floor(curr.rankedBadge / 10) : 1);
    const currSubrank = curr.rankedSubrank ?? (curr.rankedBadge ? curr.rankedBadge % 10 : 1);
    const currTierName = DEADLOCK_RANK_NAMES[currRank] || `Tier ${currRank}`;
    const currSubrankRoman = ROMAN_NUMERALS[currSubrank] || String(currSubrank);
    const currSubrankLabel = `${currTierName} ${currSubrankRoman}`;

    const prevRank = prev ? (prev.rankedRank ?? (prev.rankedBadge ? Math.floor(prev.rankedBadge / 10) : 1)) : null;
    const prevSubrank = prev ? (prev.rankedSubrank ?? (prev.rankedBadge ? prev.rankedBadge % 10 : 1)) : null;

    if (i === 0) {
      runningShields = curr.rankedDemotionProtection ?? (currSubrank <= 2 ? 5 : 2);
    }

    // Detect rank/subrank changes
    const isPromotion =
      prev !== null &&
      (currRank > (prevRank ?? 0) || (currRank === prevRank && currSubrank > (prevSubrank ?? 0)));

    const isDemotion =
      prev !== null &&
      (currRank < (prevRank ?? 0) || (currRank === prevRank && currSubrank < (prevSubrank ?? 0)));

    // Rule: each new subrank resets shields (5 for subrank I & II, 2 for subranks III-VI)
    if (isPromotion) {
      const resetCount = currSubrank <= 2 ? 5 : 2;
      runningShields = resetCount;
      events.set(curr.id, {
        matchId: curr.id,
        type: 'gained',
        count: resetCount,
        reason: `Promotion to ${currSubrankLabel} (${resetCount} shields reset)`,
        subrankLabel: currSubrankLabel,
        shieldsRemaining: runningShields,
      });
      continue;
    }

    if (isDemotion) {
      // Demoted into a new subrank: shields reset as well
      const resetCount = currSubrank <= 2 ? 5 : 2;
      runningShields = resetCount;
      events.set(curr.id, {
        matchId: curr.id,
        type: 'gained',
        count: resetCount,
        reason: `Demotion to ${currSubrankLabel} (${resetCount} shields reset)`,
        subrankLabel: currSubrankLabel,
        shieldsRemaining: runningShields,
      });
      continue;
    }

    // Inside the same subrank: check if demotion protection was used
    const isLoss = curr.result === 'loss' || (curr.rankedDelta || 0) < 0;
    const explicitConsumed = curr.rankedConsumedDemotionProtection === true;
    const isLossAtFloor = isLoss && curr.rankedDelta === 0;

    const explicitProtectionDecreased =
      isLoss &&
      prev?.rankedDemotionProtection !== undefined &&
      prev?.rankedDemotionProtection !== null &&
      curr.rankedDemotionProtection !== undefined &&
      curr.rankedDemotionProtection !== null &&
      curr.rankedDemotionProtection < prev.rankedDemotionProtection;

    // Inferred shield consumption when explicit flag is null/missing:
    let inferredConsumed = false;
    if (
      isLoss &&
      !explicitConsumed &&
      !isLossAtFloor &&
      !explicitProtectionDecreased &&
      curr.rankedConsumedDemotionProtection !== false &&
      prev?.rankedProgress !== null &&
      prev?.rankedProgress !== undefined
    ) {
      const subrankFloor = Math.floor(prev.rankedProgress / 1000) * 1000;
      const initialProg = curr.rankedInitialProgress ?? prev.rankedProgress;
      if (
        (initialProg === subrankFloor && currProgress === subrankFloor) ||
        (initialProg > subrankFloor && currProgress === subrankFloor && (curr.rankedDelta || -300) < -(initialProg - subrankFloor))
      ) {
        inferredConsumed = true;
      }
    }

    const shieldUsed = explicitConsumed || isLossAtFloor || explicitProtectionDecreased || inferredConsumed;

    if (shieldUsed) {
      runningShields = Math.max(0, runningShields - 1);
      events.set(curr.id, {
        matchId: curr.id,
        type: 'used',
        count: -1,
        reason: 'Demotion protection activated (shield consumed)',
        subrankLabel: currSubrankLabel,
        shieldsRemaining: runningShields,
      });
    } else if (curr.rankedDemotionProtection !== undefined && curr.rankedDemotionProtection !== null) {
      runningShields = curr.rankedDemotionProtection;
    }
  }

  return { events, activeShields: Math.min(5, Math.max(0, runningShields)) };
}

export const RankedProgressionView: React.FC<RankedProgressionViewProps> = ({
  matches,
  profile,
}) => {
  // Filter range: 'chunk50' (slices of 50 with arrows) | 'last20' | 'last10'
  const [rangeFilter, setRangeFilter] = useState<'chunk50' | 'last10' | 'last20'>('chunk50');
  const [chunkIndex, setChunkIndex] = useState<number | null>(null);
  // Selected hero filter: highlights corresponding sections and grays out others
  const [selectedHeroId, setSelectedHeroId] = useState<number | null>(null);
  // Selected match on chart click to display full game details underneath
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);

  // Filter matches that have ranked data, strictly excluding Obscurus (unranked / calibration badge 0)
  // Preserves authentic match data without artificial delta overwrites so that gaps are naturally detected.
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

  // Shield events map: determines for each match if a shield was gained or used
  const shieldAnalysis = useMemo(() => {
    return computeRankedShieldEvents(rankedMatchesChronological);
  }, [rankedMatchesChronological]);

  const shieldEventsMap = shieldAnalysis.events;

  // Effective points delta per match, correctly reflecting points absorbed by demotion protection.
  // Never computes deltas across preceding matches because missing matches can create unrecorded gaps.
  const matchDeltasMap = useMemo(() => {
    const deltas = new Map<string, number>();

    for (let i = 0; i < rankedMatchesChronological.length; i++) {
      const m = rankedMatchesChronological[i];
      const shieldEvent = shieldEventsMap.get(m.id);
      const isShieldUsed = shieldEvent?.type === 'used';

      if (
        m.rankedProgress !== undefined &&
        m.rankedProgress !== null &&
        m.rankedInitialProgress !== undefined &&
        m.rankedInitialProgress !== null
      ) {
        deltas.set(m.id, m.rankedProgress - m.rankedInitialProgress);
      } else if (m.rankedDelta !== undefined && m.rankedDelta !== null) {
        deltas.set(m.id, m.rankedDelta);
      } else if (isShieldUsed) {
        // Demotion protection absorbed defeat at subrank floor -> 0 points lost
        deltas.set(m.id, 0);
      } else {
        deltas.set(m.id, 0);
      }
    }

    return deltas;
  }, [rankedMatchesChronological, shieldEventsMap]);

  // 50-match pagination chunks navigation calculation
  const CHUNK_SIZE = 50;
  const totalRanked = rankedMatchesChronological.length;
  const totalChunks = Math.max(1, Math.ceil(totalRanked / CHUNK_SIZE));
  const activeChunkIndex =
    chunkIndex !== null
      ? Math.min(Math.max(0, chunkIndex), totalChunks - 1)
      : totalChunks - 1;
  const chunkStart = totalRanked === 0 ? 0 : activeChunkIndex * CHUNK_SIZE + 1;
  const chunkEnd = Math.min(totalRanked, (activeChunkIndex + 1) * CHUNK_SIZE);

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
      const effectiveDelta = matchDeltasMap.get(m.id) ?? (m.rankedDelta || 0);
      current.totalDelta += effectiveDelta;
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
  }, [rankedMatchesChronological, matchDeltasMap]);

  // Apply range filter to full data series (all matches kept in timeline, hero selection will gray out unselected)
  const filteredMatches = useMemo(() => {
    let list = [...rankedMatchesChronological];
    if (rangeFilter === 'last10') {
      list = list.slice(-10);
    } else if (rangeFilter === 'last20') {
      list = list.slice(-20);
    } else {
      // 50-match tranche mode
      const start = activeChunkIndex * CHUNK_SIZE;
      const end = Math.min(totalRanked, (activeChunkIndex + 1) * CHUNK_SIZE);
      list = list.slice(start, end);
    }
    return list;
  }, [rankedMatchesChronological, rangeFilter, activeChunkIndex, totalRanked]);

  // Key KPI stats
  const stats = useMemo(() => {
    if (rankedMatchesChronological.length === 0) {
      return null;
    }

    const latest = rankedMatchesChronological[rankedMatchesChronological.length - 1];
    const currentProgress = latest.rankedProgress ?? 0;
    const currentRank = latest.rankedRank || (latest.rankedBadge ? Math.floor(latest.rankedBadge / 10) : 1);
    // Subrank is directly derived from match rankedSubrank or rankedBadge % 10
    const currentSubrank = latest.rankedSubrank ?? (latest.rankedBadge ? latest.rankedBadge % 10 : 1);
    const currentBadge = currentRank * 10 + currentSubrank;
    const currentTierName = DEADLOCK_RANK_NAMES[currentRank] || `Tier ${currentRank}`;
    const currentSubrankRoman = ROMAN_NUMERALS[currentSubrank] || (currentSubrank > 0 ? String(currentSubrank) : '');

    // Progress within current subrank (1000 points per subrank)
    const progressInSubrank = currentProgress % 1000;
    const progressMaxSubrank = 1000;
    const subrankPercent = Math.min(100, Math.round((progressInSubrank / progressMaxSubrank) * 100));

    // Net delta across visible matches in graph (adapts to range filter: chunk50 / last 20 / last 10)
    const visibleDelta = filteredMatches.reduce(
      (sum, m) => sum + (matchDeltasMap.get(m.id) ?? (m.rankedDelta || 0)),
      0
    );

    // Wins and losses deltas across visible matches
    const visibleWinDeltas = filteredMatches
      .map((m) => matchDeltasMap.get(m.id) ?? (m.rankedDelta || 0))
      .filter((d) => d > 0);
    const visibleLossDeltas = filteredMatches
      .map((m) => matchDeltasMap.get(m.id) ?? (m.rankedDelta || 0))
      .filter((d) => d < 0);

    const avgWin =
      visibleWinDeltas.length > 0
        ? Math.round(visibleWinDeltas.reduce((a, b) => a + b, 0) / visibleWinDeltas.length)
        : 0;
    const avgLoss =
      visibleLossDeltas.length > 0
        ? Math.round(visibleLossDeltas.reduce((a, b) => a + b, 0) / visibleLossDeltas.length)
        : 0;

    // All-time delta across all matches
    const allTimeDelta = rankedMatchesChronological.reduce(
      (sum, m) => sum + (matchDeltasMap.get(m.id) ?? (m.rankedDelta || 0)),
      0
    );

    // Peak progress
    const peakMatch = rankedMatchesChronological.reduce(
      (max, m) => ((m.rankedProgress || 0) > (max.rankedProgress || 0) ? m : max),
      rankedMatchesChronological[0]
    );
    const peakProgress = peakMatch?.rankedProgress ?? 0;
    const peakRank =
      peakMatch?.rankedRank ?? (peakMatch?.rankedBadge ? Math.floor(peakMatch.rankedBadge / 10) : currentRank);
    const peakSubrank = peakMatch?.rankedSubrank ?? (peakMatch?.rankedBadge ? peakMatch.rankedBadge % 10 : 1);
    const peakTierName = DEADLOCK_RANK_NAMES[peakRank] || `Tier ${peakRank}`;
    const peakSubrankRoman = ROMAN_NUMERALS[peakSubrank] || (peakSubrank > 0 ? String(peakSubrank) : '');

    const totalWins = rankedMatchesChronological.filter((m) => m.result === 'win').length;
    const totalLosses = rankedMatchesChronological.filter((m) => m.result === 'loss').length;
    const winRate = totalWins + totalLosses > 0 ? Math.round((totalWins / (totalWins + totalLosses)) * 100) : 0;

    // Shields stats
    const totalShieldsGained = Array.from(shieldEventsMap.values()).filter((e) => e.type === 'gained').length;
    const totalShieldsUsed = Array.from(shieldEventsMap.values()).filter((e) => e.type === 'used').length;
    const activeShields = latest.rankedDemotionProtection ?? shieldAnalysis.activeShields;

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
      totalDelta: visibleDelta,
      visibleDelta,
      allTimeDelta,
      avgWin,
      avgLoss,
      peakProgress,
      peakTierName,
      peakSubrankRoman,
      totalWins,
      totalLosses,
      winRate,
      visibleMatchesCount: filteredMatches.length,
      totalRanked: rankedMatchesChronological.length,
      totalShieldsGained,
      totalShieldsUsed,
      activeShields,
    };
  }, [rankedMatchesChronological, filteredMatches, shieldEventsMap, shieldAnalysis, matchDeltasMap]);


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
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-deadlock-muted">
                  Net Points Balance
                </span>
                {rangeFilter !== 'chunk50' && (
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-deadlock-dark border border-deadlock-accent/40 text-deadlock-accent font-bold">
                    {rangeFilter === 'last10' ? 'Last 10' : 'Last 20'}
                  </span>
                )}
              </div>
              {stats.totalDelta >= 0 ? (
                <TrendingUp className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
              ) : (
                <TrendingDown className="w-4 h-4 text-rose-400 group-hover:scale-110 transition-transform" />
              )}
            </div>

            <div className="my-auto py-2 flex flex-col items-center justify-center text-center">
              <div
                className={`text-2xl font-black font-mono tracking-tight flex items-baseline justify-center gap-1 ${
                  stats.totalDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                <span>{stats.totalDelta > 0 ? `+${stats.totalDelta.toLocaleString()}` : stats.totalDelta.toLocaleString()}</span>
                <span className="text-xs font-normal text-deadlock-muted">pts</span>
              </div>
              <p className="text-[11px] text-deadlock-muted mt-0.5 text-center">
                {rangeFilter === 'chunk50'
                  ? totalChunks > 1
                    ? `Over matches ${chunkStart}–${chunkEnd} of ${totalRanked}`
                    : `Over ${stats.totalRanked} recorded ranked matches`
                  : `Over last ${stats.visibleMatchesCount} matches`}
              </p>
            </div>
          </div>

          {/* Card 3: Average Points per Game */}
          <div className="steam-glass steam-panel rounded-xl p-4 border border-deadlock-border/80 shadow-lg flex flex-col justify-between relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-deadlock-muted">
                  Points Dynamic
                </span>
                {rangeFilter !== 'chunk50' && (
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-deadlock-dark border border-deadlock-accent/40 text-deadlock-accent font-bold">
                    {rangeFilter === 'last10' ? 'Last 10' : 'Last 20'}
                  </span>
                )}
              </div>
              <Flame className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
            </div>

            <div className="grid grid-cols-2 gap-2 my-2">
              <div className="flex flex-col bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-2 text-center">
                <span className="text-[10px] uppercase font-bold text-emerald-300">Avg Gain</span>
                <span className="text-base font-black font-mono text-emerald-400">
                  {stats.avgWin > 0 ? `+${stats.avgWin}` : stats.avgWin}
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

            <div className="my-auto py-2 flex flex-col items-center justify-center text-center">
              <div className="text-lg font-bold font-display text-deadlock-steam flex items-center justify-center gap-1.5 leading-tight">
                <span>{stats.peakTierName}</span>
                <span className="text-deadlock-accent font-serif">{stats.peakSubrankRoman}</span>
              </div>
              <div className="text-xs font-mono font-bold text-deadlock-accent mt-0.5 text-center">
                {stats.peakProgress % 1000} / 1,000 pts
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. PROGRESSION CHART SECTION */}
      <RankedProgressionChart
        filteredMatches={filteredMatches}
        totalRanked={totalRanked}
        shieldEventsMap={shieldEventsMap}
        matchDeltasMap={matchDeltasMap}
        selectedMatch={selectedMatch}
        onSelectMatch={setSelectedMatch}
        rangeFilter={rangeFilter}
        onRangeFilterChange={setRangeFilter}
        activeChunkIndex={activeChunkIndex}
        onChunkIndexChange={setChunkIndex}
        selectedHeroId={selectedHeroId}
        onSelectHeroId={setSelectedHeroId}
        rankedHeroes={rankedHeroes}
        currentStanding={
          stats
            ? {
                tierName: stats.currentTierName,
                subrankRoman: stats.currentSubrankRoman,
                progressInSubrank: stats.progressInSubrank,
              }
            : undefined
        }
      />

      {/* 3. SELECTED GAME DETAILS (displayed on graph point click) */}
      {selectedMatch && (() => {
        const myHero = getHeroById(selectedMatch.myHeroId);
        const duoPartnerHero = selectedMatch.laneAllyId ? getHeroById(selectedMatch.laneAllyId) : null;
        const isWin = selectedMatch.result === 'win';
        const durationM = selectedMatch.durationSeconds ? Math.floor(selectedMatch.durationSeconds / 60) : 0;
        const durationS = selectedMatch.durationSeconds ? selectedMatch.durationSeconds % 60 : 0;
        const delta = matchDeltasMap.get(selectedMatch.id) ?? (selectedMatch.rankedDelta || 0);
        const isPositive = delta > 0;
        const progress = selectedMatch.rankedProgress || 0;
        const initialProgress =
          selectedMatch.rankedInitialProgress !== null && selectedMatch.rankedInitialProgress !== undefined
            ? selectedMatch.rankedInitialProgress
            : progress - delta;
        const rankTier =
          selectedMatch.rankedRank ||
          (selectedMatch.rankedBadge ? Math.floor(selectedMatch.rankedBadge / 10) : 1);
        const subrank =
          selectedMatch.rankedSubrank ??
          (selectedMatch.rankedBadge ? selectedMatch.rankedBadge % 10 : 1);
        const subrankRoman = ROMAN_NUMERALS[subrank] || '';
        const tierName = DEADLOCK_RANK_NAMES[rankTier] || 'Initiate';
        const progressInSub = initialProgress % 1000;
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
                    {(() => {
                      const matchShield = shieldEventsMap.get(selectedMatch.id);
                      if (!matchShield) return null;
                      if (matchShield.type === 'gained') {
                        return (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded border font-mono text-[10px] font-black uppercase tracking-wider bg-cyan-950/70 border-cyan-400/80 text-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.25)]">
                            <Shield className="w-3 h-3 fill-cyan-400 text-cyan-300" />
                            <Shield className="w-3 h-3 fill-cyan-400 text-cyan-300" />
                            <span className="ml-0.5">Shields Reset (+{matchShield.count})</span>
                          </span>
                        );
                      }
                      return (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded border font-mono text-[10px] font-black uppercase tracking-wider bg-rose-950/70 border-rose-400/80 text-rose-300 shadow-[0_0_8px_rgba(244,63,94,0.25)]">
                          <Shield className="w-3 h-3 fill-rose-500 text-rose-300" />
                          <span className="ml-0.5">-1 Shield</span>
                        </span>
                      );
                    })()}
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
                      isPositive ? 'text-emerald-400' : delta < 0 ? 'text-rose-400' : 'text-deadlock-muted'
                    }`}
                  >
                    {isPositive ? `+${delta}` : delta} pts
                  </span>
                  <span className="text-xs font-mono text-deadlock-steam font-semibold">
                    {tierName} {subrankRoman} · {progressInSub} pts
                    <span className="text-deadlock-muted font-normal text-[10px] ml-1">
                      → {progress % 1000} pts ({progress.toLocaleString()} ladder)
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
                <div className="flex items-center gap-2.5 flex-wrap">
                  <div title={`You: ${myHero?.name}`}>
                    <HeroAvatar
                      heroId={selectedMatch.myHeroId}
                      size="sm"
                      accentColor={selectedMatch.side}
                      isHighlighted={true}
                    />
                  </div>
                  <span className="w-px h-8 bg-deadlock-border/70 mx-1" />
                  {selectedMatch.allies.map((allyId, idx) => {
                    const isDuo = allyId === selectedMatch.laneAllyId;
                    const allyHero = getHeroById(allyId);
                    return (
                      <div
                        key={idx}
                        className="relative flex flex-col items-center"
                        title={isDuo ? `Duo Partner: ${allyHero?.name}` : allyHero?.name}
                      >
                        <HeroAvatar
                          heroId={allyId}
                          size="xs"
                          accentColor={selectedMatch.side}
                          isHighlighted={isDuo}
                        />
                        {isDuo && (
                          <span className="absolute -bottom-1 px-1 py-0.2 bg-cyan-500 text-black font-black text-[7px] rounded uppercase tracking-wider font-mono shadow-[0_0_6px_rgba(6,182,212,0.8)]">
                            Duo
                          </span>
                        )}
                      </div>
                    );
                  })}
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

            {/* Lane & Duo Details */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-deadlock-dark/50 border border-deadlock-border/60 text-xs font-mono">
              <div className="flex items-center gap-3 flex-wrap">
                {/* Lane Color & Outcome */}
                {selectedMatch.lane ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-deadlock-muted text-[11px]">Lane:</span>
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
                ) : (
                  <span className="text-deadlock-muted text-[11px]">Lane not recorded</span>
                )}

                {/* Duo Partner Indicator */}
                <div className="flex items-center gap-1.5 pl-2 border-l border-deadlock-border/50">
                  <span className="text-deadlock-muted text-[11px]">Duo:</span>
                  {duoPartnerHero ? (
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-cyan-950/50 border border-cyan-500/50 text-cyan-200">
                      <HeroAvatar heroId={selectedMatch.laneAllyId!} size="xs" />
                      <span className="font-bold text-xs font-sans text-cyan-100">
                        {duoPartnerHero.name}
                      </span>
                    </div>
                  ) : selectedMatch.lane ? (
                    <span className="text-[11px] text-deadlock-muted px-2 py-0.5 rounded bg-deadlock-card/60 border border-deadlock-border/40">
                      Solo Lane
                    </span>
                  ) : (
                    <span className="text-deadlock-muted/60 text-[11px]">—</span>
                  )}
                </div>

                {/* Lane Opponents (if recorded) */}
                {selectedMatch.laneOpponents && selectedMatch.laneOpponents.length > 0 && (
                  <div className="flex items-center gap-1.5 pl-2 border-l border-deadlock-border/50">
                    <span className="text-deadlock-muted text-[11px]">vs:</span>
                    <div className="flex items-center gap-1">
                      {selectedMatch.laneOpponents.map((oppId) => {
                        const oppHero = getHeroById(oppId);
                        return (
                          <div key={oppId} title={oppHero?.name}>
                            <HeroAvatar heroId={oppId} size="xs" accentColor={enemySide} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Notes */}
              {selectedMatch.notes && (
                <div className="flex items-center gap-1.5 text-deadlock-muted italic text-[11px]">
                  <span className="not-italic font-bold text-deadlock-steam">Note:</span>
                  <span>&quot;{selectedMatch.notes}&quot;</span>
                </div>
              )}
            </div>
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
              {selectedHeroId !== null && (
                <button
                  type="button"
                  onClick={() => setSelectedHeroId(null)}
                  className="flex items-center gap-1 text-[11px] font-mono text-deadlock-accent hover:text-white px-2 py-0.5 rounded bg-deadlock-accent/15 border border-deadlock-accent/40 transition-colors ml-1"
                >
                  <X className="w-3 h-3" />
                  <span>Reset filter</span>
                </button>
              )}
            </div>
            <span className="text-[11px] text-deadlock-muted">
              Click a hero to highlight their trajectory on the curve
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-deadlock-card/60 text-deadlock-muted border-b border-deadlock-border/60 uppercase tracking-wider text-[10px] font-mono">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">Hero</th>
                  <th className="py-2.5 px-4 font-semibold">Matches</th>
                  <th className="py-2.5 px-4 font-semibold">Record (W - L)</th>
                  <th className="py-2.5 px-4 font-semibold">Win Rate</th>
                  <th className="py-2.5 px-4 font-semibold">Avg Delta</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Points Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-deadlock-border/30 font-mono">
                {rankedHeroes.map((item) => {
                  const isSelected = selectedHeroId === item.heroId;
                  const isPositive = item.totalDelta > 0;
                  const isNegative = item.totalDelta < 0;

                  return (
                    <tr
                      key={item.heroId}
                      onClick={() => setSelectedHeroId(isSelected ? null : item.heroId)}
                      className={`cursor-pointer transition-all duration-150 ${
                        isSelected
                          ? 'bg-deadlock-accent/20 border-l-4 border-l-deadlock-accent text-deadlock-steam shadow-inner'
                          : selectedHeroId !== null
                          ? 'opacity-40 hover:opacity-100 hover:bg-deadlock-card/30'
                          : 'hover:bg-deadlock-card/50'
                      }`}
                    >
                      {/* Hero Avatar & Name */}
                      <td className="py-2.5 px-4 font-sans font-bold">
                        <div className="flex items-center gap-2.5">
                          <HeroAvatar heroId={item.heroId} size="xs" />
                          <span className={isSelected ? 'text-deadlock-accent font-black' : 'text-deadlock-steam'}>
                            {item.hero?.name || `Hero #${item.heroId}`}
                          </span>
                        </div>
                      </td>

                      {/* Games count */}
                      <td className="py-2.5 px-4 text-deadlock-steam">
                        {item.count} {item.count === 1 ? 'game' : 'games'}
                      </td>

                      {/* Win - Loss Record */}
                      <td className="py-2.5 px-4">
                        <span className="text-emerald-400 font-bold">{item.wins}W</span>
                        <span className="text-deadlock-muted mx-1">-</span>
                        <span className="text-rose-400 font-bold">{item.losses}L</span>
                      </td>

                      {/* Winrate with mini progress bar */}
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-bold w-9 text-right ${
                              item.winRate >= 50 ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {item.winRate}%
                          </span>
                          <div className="w-16 h-1.5 bg-deadlock-dark/80 rounded-full overflow-hidden border border-deadlock-border/40">
                            <div
                              className={`h-full rounded-full ${
                                item.winRate >= 50 ? 'bg-emerald-500' : 'bg-rose-500'
                              }`}
                              style={{ width: `${Math.min(100, Math.max(0, item.winRate))}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Average Delta per game */}
                      <td className="py-2.5 px-4">
                        <span
                          className={`font-semibold ${
                            item.avgDelta > 0
                              ? 'text-emerald-400'
                              : item.avgDelta < 0
                              ? 'text-rose-400'
                              : 'text-deadlock-muted'
                          }`}
                        >
                          {item.avgDelta > 0 ? `+${item.avgDelta}` : item.avgDelta} pts
                        </span>
                      </td>

                      {/* Net Points Balance */}
                      <td className="py-2.5 px-4 text-right">
                        <span
                          className={`text-sm font-black ${
                            isPositive
                              ? 'text-emerald-400'
                              : isNegative
                              ? 'text-rose-400'
                              : 'text-deadlock-muted'
                          }`}
                        >
                          {isPositive ? `+${item.totalDelta.toLocaleString()}` : item.totalDelta.toLocaleString()} pts
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
