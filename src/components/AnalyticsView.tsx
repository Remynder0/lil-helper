import React, { useState, useMemo } from 'react';
import artDecoCorner from '../assets/art-deco/corner.svg';
import { Match } from '../types/match';
import { HeroAvatar } from './HeroAvatar';
import { EnemyMatchupsView } from './EnemyMatchupsView';
import { AllySynergiesView } from './AllySynergiesView';
import { LanePerformanceView } from './LanePerformanceView';
import {
  calculateGlobalStats,
  calculatePatronStats,
  calculateHeroPerformance,
  calculateFamiliarFace,
  calculateLaneAnalytics,
  formatStreakDateRange,
  HeroPerformance,
  getSampleThreshold,
} from '../services/analytics';
import {
  Flame,
  TrendingDown,
  TrendingUp,
  Gamepad2,
  Crown,
  ChevronDown,
  ChevronUp,
  Swords,
  BarChart2,
  Users,
  Compass,
  Eye,
  Shield,
} from 'lucide-react';

interface AnalyticsViewProps {
  matches: Match[];
  onNavigateToStreak?: (matchIds: string[], type: 'win' | 'loss') => void;
}

type SortField = 'matches' | 'winRate' | 'wins';
type AnalyticsSubTab = 'overview' | 'matchups' | 'synergies' | 'lanes';

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ matches, onNavigateToStreak }) => {
  const [subTab, setSubTab] = useState<AnalyticsSubTab>('overview');
  const [sortField, setSortField] = useState<SortField>('matches');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  const threshold = useMemo(() => getSampleThreshold(matches.length), [matches.length]);

  const globalStats = useMemo(() => calculateGlobalStats(matches), [matches]);
  const patronStats = useMemo(() => calculatePatronStats(matches), [matches]);
  const heroPerformances = useMemo(() => calculateHeroPerformance(matches), [matches]);
  const familiarFace = useMemo(() => calculateFamiliarFace(matches), [matches]);
  const laneAnalytics = useMemo(() => calculateLaneAnalytics(matches), [matches]);

  const topLanePartner = useMemo(() => {
    return laneAnalytics.allies.length > 0 && laneAnalytics.allies[0].lanesTogether > 0
      ? laneAnalytics.allies[0]
      : null;
  }, [laneAnalytics]);

  const topRival = useMemo(() => {
    return laneAnalytics.opponents.length > 0 && laneAnalytics.opponents[0].lanesFaced > 0
      ? laneAnalytics.opponents[0]
      : null;
  }, [laneAnalytics]);

  const sortedHeroes = useMemo(() => {
    return [...heroPerformances].sort((a, b) => {
      let diff = 0;
      if (sortField === 'matches') diff = b.matches - a.matches;
      else if (sortField === 'winRate') diff = b.winRate - a.winRate;
      else if (sortField === 'wins') diff = b.wins - a.wins;
      return sortAsc ? -diff : diff;
    });
  }, [heroPerformances, sortField, sortAsc]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  if (matches.length === 0) {
    return (
      <div className="bg-deadlock-panel/80 backdrop-blur-sm steam-card border border-deadlock-border rounded-xl p-12 text-center flex flex-col items-center justify-center gap-3">
        <Gamepad2 className="w-12 h-12 text-deadlock-muted opacity-40" />
        <h2 className="text-lg font-bold text-deadlock-steam">No match data available yet</h2>
        <p className="text-sm text-deadlock-muted max-w-md">
          Start recording your matches in the <strong>Log Match</strong> tab to unlock comprehensive stats, patron win rates, and hero performance tracking.
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Art Déco corner ornaments */}
      <img src={artDecoCorner} alt="" aria-hidden="true" className="absolute top-0 left-0 w-14 h-14 pointer-events-none opacity-50" />
      <img src={artDecoCorner} alt="" aria-hidden="true" className="absolute top-0 right-0 w-14 h-14 pointer-events-none opacity-50 -scale-x-100" />
      <img src={artDecoCorner} alt="" aria-hidden="true" className="absolute bottom-0 left-0 w-14 h-14 pointer-events-none opacity-50 -scale-y-100" />
      <img src={artDecoCorner} alt="" aria-hidden="true" className="absolute bottom-0 right-0 w-14 h-14 pointer-events-none opacity-50 -scale-x-100 -scale-y-100" />

    <div className="flex flex-col gap-6">
      {/* Subtab Navigation */}
      <div className="flex items-center justify-between border-b border-deadlock-border pb-3">
        <div className="flex items-center gap-2 bg-deadlock-panel/80 backdrop-blur-sm steam-card p-1 rounded-lg border border-deadlock-border flex-wrap">
          <button
            type="button"
            onClick={() => setSubTab('overview')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md font-semibold text-xs transition-all ${
              subTab === 'overview'
                ? 'bg-deadlock-accent/20 text-deadlock-accent border border-deadlock-accent/40 shadow-sm steam-card'
                : 'text-deadlock-muted hover:text-deadlock-steam'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span>Overview</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('matchups')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md font-semibold text-xs transition-all ${
              subTab === 'matchups'
                ? 'bg-deadlock-accent/20 text-deadlock-accent border border-deadlock-accent/40 shadow-sm steam-card'
                : 'text-deadlock-muted hover:text-deadlock-steam'
            }`}
          >
            <Swords className="w-3.5 h-3.5" />
            <span>How I perform against</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('synergies')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md font-semibold text-xs transition-all ${
              subTab === 'synergies'
                ? 'bg-deadlock-accent/20 text-deadlock-accent border border-deadlock-accent/40 shadow-sm steam-card'
                : 'text-deadlock-muted hover:text-deadlock-steam'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>How I perform with</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('lanes')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md font-semibold text-xs transition-all ${
              subTab === 'lanes'
                ? 'bg-deadlock-accent/20 text-deadlock-accent border border-deadlock-accent/40 shadow-sm steam-card'
                : 'text-deadlock-muted hover:text-deadlock-steam'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Lane Matchups</span>
          </button>
        </div>

        <span className="text-xs text-deadlock-muted hidden sm:inline">
          Based on {matches.length} recorded match{matches.length !== 1 ? 'es' : ''}
        </span>
      </div>

      {subTab === 'matchups' && <EnemyMatchupsView matches={matches} />}
      {subTab === 'synergies' && <AllySynergiesView matches={matches} />}
      {subTab === 'lanes' && <LanePerformanceView matches={matches} />}
      {subTab === 'overview' && (
        <>

      {/* SECTION 1: GLOBAL STATS CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Total Matches */}
        <div className="steam-glass steam-panel rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-deadlock-muted text-xs">
            <span>Total Matches</span>
            <Gamepad2 className="w-4 h-4 text-deadlock-muted" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-deadlock-steam">{globalStats.totalMatches}</span>
            <span className="text-xs text-deadlock-muted">recorded</span>
          </div>
        </div>

        {/* Global Winrate */}
        <div className="steam-glass steam-panel rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-deadlock-muted text-xs">
            <span>Win Rate</span>
            <TrendingUp className="w-4 h-4 text-deadlock-win" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className={`text-2xl font-black ${
                globalStats.winRate >= 50
                  ? 'text-deadlock-win'
                  : globalStats.totalMatches > 0
                  ? 'text-deadlock-loss'
                  : 'text-deadlock-steam'
              }`}
            >
              {globalStats.totalWins + globalStats.totalLosses > 0 ? `${globalStats.winRate}%` : 'N/A'}
            </span>
            <span className="text-xs text-deadlock-muted">
              ({globalStats.totalWins}W - {globalStats.totalLosses}L)
            </span>
          </div>
        </div>

        {/* Win Streak (Best) */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            if (globalStats.bestWinStreak.count > 0 && onNavigateToStreak) {
              onNavigateToStreak(globalStats.bestWinStreak.matchIds, 'win');
            }
          }}
          onKeyDown={(e) => {
            if (
              (e.key === 'Enter' || e.key === ' ') &&
              globalStats.bestWinStreak.count > 0 &&
              onNavigateToStreak
            ) {
              onNavigateToStreak(globalStats.bestWinStreak.matchIds, 'win');
            }
          }}
          title={globalStats.bestWinStreak.count > 0 ? 'Click to view this streak in History' : undefined}
          className={`steam-glass steam-panel rounded-xl p-4 flex flex-col justify-between transition-all group ${
            globalStats.bestWinStreak.count > 0
              ? 'cursor-pointer hover:border-amber-400/60 hover:shadow-[0_0_16px_rgba(251,191,36,0.15)] hover:scale-[1.01]'
              : ''
          }`}
        >
          <div className="flex items-center justify-between text-deadlock-muted text-xs">
            <span className="font-semibold text-deadlock-steam">Win Streak</span>
            <div className="flex items-center gap-1.5">
              {globalStats.bestWinStreak.count > 0 && (
                <span className="text-[10px] text-amber-400/80 group-hover:text-amber-300 font-medium transition-colors hidden sm:inline">
                  View in history →
                </span>
              )}
              <Flame className="w-4 h-4 text-amber-400" />
            </div>
          </div>
          <div className="mt-2 flex flex-col gap-1">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-deadlock-win">
                {globalStats.bestWinStreak.count}
              </span>
              <span className="text-xs font-semibold text-deadlock-steam">
                {globalStats.bestWinStreak.count === 1 ? 'win' : 'wins in a row'}
              </span>
            </div>
            <span className="text-xs text-deadlock-muted truncate">
              {globalStats.bestWinStreak.count > 0
                ? formatStreakDateRange(
                    globalStats.bestWinStreak.startDate,
                    globalStats.bestWinStreak.endDate
                  )
                : 'No win streak recorded'}
            </span>
          </div>
        </div>

        {/* Lose Streak (Worst) */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            if (globalStats.worstLoseStreak.count > 0 && onNavigateToStreak) {
              onNavigateToStreak(globalStats.worstLoseStreak.matchIds, 'loss');
            }
          }}
          onKeyDown={(e) => {
            if (
              (e.key === 'Enter' || e.key === ' ') &&
              globalStats.worstLoseStreak.count > 0 &&
              onNavigateToStreak
            ) {
              onNavigateToStreak(globalStats.worstLoseStreak.matchIds, 'loss');
            }
          }}
          title={globalStats.worstLoseStreak.count > 0 ? 'Click to view this streak in History' : undefined}
          className={`steam-glass steam-panel rounded-xl p-4 flex flex-col justify-between transition-all group ${
            globalStats.worstLoseStreak.count > 0
              ? 'cursor-pointer hover:border-red-400/60 hover:shadow-[0_0_16px_rgba(239,68,68,0.15)] hover:scale-[1.01]'
              : ''
          }`}
        >
          <div className="flex items-center justify-between text-deadlock-muted text-xs">
            <span className="font-semibold text-deadlock-steam">Lose Streak</span>
            <div className="flex items-center gap-1.5">
              {globalStats.worstLoseStreak.count > 0 && (
                <span className="text-[10px] text-red-400/80 group-hover:text-red-300 font-medium transition-colors hidden sm:inline">
                  View in history →
                </span>
              )}
              <TrendingDown className="w-4 h-4 text-deadlock-loss" />
            </div>
          </div>
          <div className="mt-2 flex flex-col gap-1">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-deadlock-loss">
                {globalStats.worstLoseStreak.count}
              </span>
              <span className="text-xs font-semibold text-deadlock-steam">
                {globalStats.worstLoseStreak.count === 1 ? 'loss' : 'losses in a row'}
              </span>
            </div>
            <span className="text-xs text-deadlock-muted truncate">
              {globalStats.worstLoseStreak.count > 0
                ? formatStreakDateRange(
                    globalStats.worstLoseStreak.startDate,
                    globalStats.worstLoseStreak.endDate
                  )
                : 'No lose streak recorded'}
            </span>
          </div>
        </div>
      </div>

      {/* SECTION 2: PATRON PERFORMANCE COMPARISON */}
      <div className="steam-glass steam-panel rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Crown className="w-5 h-5 text-deadlock-hidden-king" />
          <h2 className="text-sm font-bold tracking-wide uppercase text-deadlock-steam">
            Patron Faction Performance
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* The Hidden King */}
          <div className="bg-deadlock-card/80 border border-deadlock-hidden-king/40 rounded-xl p-4 flex flex-col gap-3 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-28 h-28 bg-deadlock-hidden-king/5 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-deadlock-hidden-king shadow-sm shadow-deadlock-hidden-king" />
                <span className="font-bold text-sm text-yellow-300">The Hidden King</span>
              </div>
              <span className="text-xs text-deadlock-muted font-mono">
                {patronStats.hiddenKing.matches} match{patronStats.hiddenKing.matches !== 1 ? 'es' : ''}
              </span>
            </div>

            <div className="flex items-center justify-between mt-1">
              <div>
                <div className="text-3xl font-black text-deadlock-steam">
                  {patronStats.hiddenKing.wins + patronStats.hiddenKing.losses > 0
                    ? `${patronStats.hiddenKing.winRate}%`
                    : 'N/A'}
                </div>
                <div className="text-xs text-deadlock-muted mt-0.5">
                  {patronStats.hiddenKing.wins}W - {patronStats.hiddenKing.losses}L
                  {patronStats.hiddenKing.cancels > 0 && ` (${patronStats.hiddenKing.cancels} Cancel)`}
                </div>
              </div>

              {/* Mini Winrate Bar */}
              <div className="w-32 flex flex-col gap-1 text-right">
                <div className="w-full bg-deadlock-panel rounded-full h-2 overflow-hidden border border-deadlock-border">
                  <div
                    className="bg-deadlock-hidden-king h-full transition-all duration-300"
                    style={{ width: `${patronStats.hiddenKing.winRate}%` }}
                  />
                </div>
                <span className="text-[10px] text-deadlock-muted font-mono">
                  {patronStats.hiddenKing.wins} wins / {patronStats.hiddenKing.wins + patronStats.hiddenKing.losses} decided
                </span>
              </div>
            </div>
          </div>

          {/* The Archmother */}
          <div className="bg-deadlock-card/80 border border-deadlock-archmother/40 rounded-xl p-4 flex flex-col gap-3 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-28 h-28 bg-deadlock-archmother/5 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-deadlock-archmother shadow-sm shadow-deadlock-archmother" />
                <span className="font-bold text-sm text-blue-300">The Archmother</span>
              </div>
              <span className="text-xs text-deadlock-muted font-mono">
                {patronStats.archmother.matches} match{patronStats.archmother.matches !== 1 ? 'es' : ''}
              </span>
            </div>

            <div className="flex items-center justify-between mt-1">
              <div>
                <div className="text-3xl font-black text-deadlock-steam">
                  {patronStats.archmother.wins + patronStats.archmother.losses > 0
                    ? `${patronStats.archmother.winRate}%`
                    : 'N/A'}
                </div>
                <div className="text-xs text-deadlock-muted mt-0.5">
                  {patronStats.archmother.wins}W - {patronStats.archmother.losses}L
                  {patronStats.archmother.cancels > 0 && ` (${patronStats.archmother.cancels} Cancel)`}
                </div>
              </div>

              {/* Mini Winrate Bar */}
              <div className="w-32 flex flex-col gap-1 text-right">
                <div className="w-full bg-deadlock-panel rounded-full h-2 overflow-hidden border border-deadlock-border">
                  <div
                    className="bg-deadlock-archmother h-full transition-all duration-300"
                    style={{ width: `${patronStats.archmother.winRate}%` }}
                  />
                </div>
                <span className="text-[10px] text-deadlock-muted font-mono">
                  {patronStats.archmother.wins} wins / {patronStats.archmother.wins + patronStats.archmother.losses} decided
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION: TRIO ENCOUNTERS (Familiar Face, Lane Partner, Rival) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Familiar Face */}
        <div className="steam-glass steam-panel rounded-xl p-5 border border-deadlock-border/80 flex flex-col justify-between relative overflow-hidden group hover:border-cyan-400/40 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-400/5 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-bold tracking-wide uppercase text-deadlock-steam">
                Familiar Face
              </h3>
            </div>
            <span className="text-[10px] text-deadlock-muted font-medium bg-deadlock-card/60 px-2 py-0.5 rounded-full border border-deadlock-border/60">
              Most Encountered
            </span>
          </div>

          {familiarFace && familiarFace.hero ? (
            <div
              className={`mt-4 flex items-center gap-3.5 transition-all duration-200 ${
                !familiarFace.isRepresentative
                  ? 'opacity-40 blur-[1px] hover:blur-none hover:opacity-100'
                  : ''
              }`}
              title={!familiarFace.isRepresentative ? `Low sample (< ${threshold} matches)` : undefined}
            >
              <div className="relative shrink-0">
                <HeroAvatar heroId={familiarFace.heroId} size="md" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-black text-white truncate">
                  {familiarFace.hero.name}
                </span>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className="text-lg font-black text-cyan-400">
                    {familiarFace.appearances}
                  </span>
                  <span className="text-xs text-deadlock-muted">
                    matches ({familiarFace.presenceRate}%)
                  </span>
                </div>
                <span className="text-[11px] text-deadlock-muted mt-0.5 font-mono">
                  Win Rate: <strong className={familiarFace.winRate >= 50 ? 'text-deadlock-win' : 'text-deadlock-loss'}>{familiarFace.winRate}%</strong> ({familiarFace.wins}W - {familiarFace.losses}L)
                </span>
              </div>
            </div>
          ) : (
            <div className="mt-6 text-center py-4 text-xs text-deadlock-muted">
              No match data recorded yet.
            </div>
          )}
        </div>

        {/* Lane Partner */}
        <div
          role={topLanePartner ? 'button' : undefined}
          tabIndex={topLanePartner ? 0 : undefined}
          onClick={() => topLanePartner && setSubTab('lanes')}
          title={topLanePartner ? 'Click to view Lane Matchups' : undefined}
          className={`steam-glass steam-panel rounded-xl p-5 border border-deadlock-border/80 flex flex-col justify-between relative overflow-hidden group transition-all ${
            topLanePartner
              ? 'cursor-pointer hover:border-emerald-400/50 hover:shadow-[0_0_16px_rgba(16,185,129,0.15)]'
              : ''
          }`}
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-400/5 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold tracking-wide uppercase text-deadlock-steam">
                Lane Partner
              </h3>
            </div>
            <span className="text-[10px] text-deadlock-muted font-medium bg-deadlock-card/60 px-2 py-0.5 rounded-full border border-deadlock-border/60">
              Most Duo Lanes
            </span>
          </div>

          {topLanePartner && topLanePartner.allyHero ? (
            <div className="mt-4 flex items-center gap-3.5">
              <div className="relative shrink-0">
                <HeroAvatar heroId={topLanePartner.allyHeroId} size="md" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-black text-white truncate">
                  {topLanePartner.allyHero.name}
                </span>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className="text-lg font-black text-emerald-400">
                    {topLanePartner.lanesTogether}
                  </span>
                  <span className="text-xs text-deadlock-muted">
                    duo lane{topLanePartner.lanesTogether > 1 ? 's' : ''}
                  </span>
                </div>
                <span className="text-[11px] text-deadlock-muted mt-0.5 font-mono">
                  Lane Win Rate: <strong className="text-deadlock-steam">{topLanePartner.laneWinRate}%</strong> ({topLanePartner.laneWins}W - {topLanePartner.laneLosses}L)
                </span>
              </div>
            </div>
          ) : (
            <div className="mt-6 text-center py-4 text-xs text-deadlock-muted">
              No duo lane ally recorded yet.
            </div>
          )}
        </div>

        {/* Rival */}
        <div
          role={topRival ? 'button' : undefined}
          tabIndex={topRival ? 0 : undefined}
          onClick={() => topRival && setSubTab('lanes')}
          title={topRival ? 'Click to view Lane Matchups' : undefined}
          className={`steam-glass steam-panel rounded-xl p-5 border border-deadlock-border/80 flex flex-col justify-between relative overflow-hidden group transition-all ${
            topRival
              ? 'cursor-pointer hover:border-red-400/50 hover:shadow-[0_0_16px_rgba(239,68,68,0.15)]'
              : ''
          }`}
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-red-400/5 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Swords className="w-4 h-4 text-red-400" />
              <h3 className="text-xs font-bold tracking-wide uppercase text-deadlock-steam">
                Rival
              </h3>
            </div>
            <span className="text-[10px] text-deadlock-muted font-medium bg-deadlock-card/60 px-2 py-0.5 rounded-full border border-deadlock-border/60">
              Most Faced on Lane
            </span>
          </div>

          {topRival && topRival.opponentHero ? (
            <div className="mt-4 flex items-center gap-3.5">
              <div className="relative shrink-0">
                <HeroAvatar heroId={topRival.opponentHeroId} size="md" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-black text-white truncate">
                  {topRival.opponentHero.name}
                </span>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className="text-lg font-black text-red-400">
                    {topRival.lanesFaced}
                  </span>
                  <span className="text-xs text-deadlock-muted">
                    lane duel{topRival.lanesFaced > 1 ? 's' : ''}
                  </span>
                </div>
                <span className="text-[11px] text-deadlock-muted mt-0.5 font-mono">
                  Lane Win Rate: <strong className="text-deadlock-steam">{topRival.laneWinRate}%</strong> ({topRival.laneWins}W - {topRival.laneLosses}L)
                </span>
              </div>
            </div>
          ) : (
            <div className="mt-6 text-center py-4 text-xs text-deadlock-muted">
              No lane opponent recorded yet.
            </div>
          )}
        </div>
      </div>

      {/* SECTION 3: HERO PERFORMANCE BREAKDOWN TABLE */}
      <div className="bg-deadlock-panel/80 backdrop-blur-sm steam-card border border-deadlock-border/80 rounded-xl overflow-hidden flex flex-col">
        <div className="p-5 border-b border-deadlock-border/80 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold tracking-wide uppercase text-deadlock-steam">
              Hero Performance Breakdown ({sortedHeroes.length} heroes)
            </h2>
            <p className="text-xs text-deadlock-muted mt-0.5">
              Statistics for each hero you have piloted in recorded drafts
            </p>
          </div>

          <div className="text-xs text-deadlock-muted">
            Click column headers to sort
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-deadlock-card/80 text-deadlock-muted border-b border-deadlock-border/60">
              <tr>
                <th className="py-3 px-4 font-semibold">Hero</th>
                <th
                  onClick={() => handleSort('matches')}
                  className="py-3 px-4 font-semibold cursor-pointer hover:text-deadlock-steam transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Matches</span>
                    {sortField === 'matches' && (
                      sortAsc ? <ChevronUp className="w-3.5 h-3.5 text-deadlock-accent" /> : <ChevronDown className="w-3.5 h-3.5 text-deadlock-accent" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('wins')}
                  className="py-3 px-4 font-semibold cursor-pointer hover:text-deadlock-steam transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Record (W / L / C)</span>
                    {sortField === 'wins' && (
                      sortAsc ? <ChevronUp className="w-3.5 h-3.5 text-deadlock-accent" /> : <ChevronDown className="w-3.5 h-3.5 text-deadlock-accent" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('winRate')}
                  className="py-3 px-4 font-semibold cursor-pointer hover:text-deadlock-steam transition-colors text-right"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Win Rate</span>
                    {sortField === 'winRate' && (
                      sortAsc ? <ChevronUp className="w-3.5 h-3.5 text-deadlock-accent" /> : <ChevronDown className="w-3.5 h-3.5 text-deadlock-accent" />
                    )}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-deadlock-border/40">
              {sortedHeroes.map((hp: HeroPerformance) => {
                const decided = hp.wins + hp.losses;
                const isRep = hp.matches >= threshold;
                return (
                  <tr
                    key={hp.heroId}
                    className={`transition-all duration-200 ${
                      !isRep
                        ? 'opacity-35 blur-[1.5px] hover:blur-none hover:opacity-100'
                        : 'hover:bg-deadlock-card/40'
                    }`}
                    title={!isRep ? `Low sample (< ${threshold} matches)` : undefined}
                  >
                    {/* Hero Info */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <HeroAvatar heroId={hp.heroId} size="xs" />
                        <div>
                          <div className="font-bold text-deadlock-steam text-sm">
                            {hp.hero?.name || `Hero #${hp.heroId}`}
                          </div>
                          <div className="text-[11px] text-deadlock-muted capitalize">
                            {hp.hero?.heroType || hp.hero?.role || 'Unknown'}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Total Matches */}
                    <td className="py-3 px-4 font-mono font-medium text-deadlock-steam">
                      {hp.matches}
                    </td>

                    {/* Record */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="text-deadlock-win font-bold font-mono">{hp.wins}W</span>
                        <span className="text-deadlock-muted">-</span>
                        <span className="text-deadlock-loss font-bold font-mono">{hp.losses}L</span>
                        {hp.cancels > 0 && (
                          <span className="text-deadlock-muted font-mono">
                            - {hp.cancels}C
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Winrate Bar & Percentage */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <div className="w-24 bg-deadlock-dark rounded-full h-1.5 overflow-hidden border border-deadlock-border/60 hidden sm:block">
                          <div
                            className={`h-full ${
                              hp.winRate >= 50 ? 'bg-deadlock-win' : 'bg-deadlock-loss'
                            }`}
                            style={{ width: `${hp.winRate}%` }}
                          />
                        </div>
                        <span
                          className={`font-mono font-bold text-sm ${
                            decided > 0
                              ? hp.winRate >= 50
                                ? 'text-deadlock-win'
                                : 'text-deadlock-loss'
                              : 'text-deadlock-muted'
                          }`}
                        >
                          {decided > 0 ? `${hp.winRate}%` : 'N/A'}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
        </>
      )}
    </div>
    </div>
  );
};
