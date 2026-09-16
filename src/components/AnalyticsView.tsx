import React, { useState, useMemo } from 'react';
import artDecoCorner from '../assets/art-deco/corner.svg';
import { Match } from '../types/match';
import { HeroAvatar } from './HeroAvatar';
import { HeroMatchupsAndSynergiesView } from './HeroMatchupsAndSynergiesView';
import { LanePerformanceView } from './LanePerformanceView';
import {
  calculateGlobalStats,
  calculatePatronStats,
  calculateHeroPerformance,
  calculateFamiliarFace,
  calculateLaneAnalytics,
  formatStreakDateRange,
  HeroPerformance,
} from '../services/analytics';
import {
  Flame,
  TrendingDown,
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
  Search,
} from 'lucide-react';

interface AnalyticsViewProps {
  matches: Match[];
  onNavigateToStreak?: (matchIds: string[], type: 'win' | 'loss') => void;
}

type SortField = 'matches' | 'winRate' | 'wins';
type AnalyticsSubTab = 'overview' | 'relations' | 'lanes';

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ matches, onNavigateToStreak }) => {
  const [subTab, setSubTab] = useState<AnalyticsSubTab>('overview');
  const [sortField, setSortField] = useState<SortField>('matches');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [heroSearch, setHeroSearch] = useState<string>('');

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

  const displayedHeroes = useMemo(() => {
    if (!heroSearch.trim()) return sortedHeroes;
    const q = heroSearch.toLowerCase().trim();
    return sortedHeroes.filter((hp) => hp.hero?.name.toLowerCase().includes(q));
  }, [sortedHeroes, heroSearch]);

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
      {/* Art Déco corner ornaments adapting dynamically to window width */}
      <div className="fixed top-[74px] left-0 right-0 pointer-events-none z-20 flex justify-between overflow-hidden">
        <img
          src={artDecoCorner}
          alt=""
          aria-hidden="true"
          className="w-20 h-20 sm:w-28 sm:h-28 md:w-36 md:h-36 pointer-events-none opacity-60 drop-shadow-[0_0_14px_rgba(232,192,106,0.3)] select-none"
        />
        <img
          src={artDecoCorner}
          alt=""
          aria-hidden="true"
          className="w-20 h-20 sm:w-28 sm:h-28 md:w-36 md:h-36 pointer-events-none opacity-60 -scale-x-100 drop-shadow-[0_0_14px_rgba(232,192,106,0.3)] select-none"
        />
      </div>
      <div className="fixed bottom-0 left-0 right-0 pointer-events-none z-20 flex justify-between overflow-hidden">
        <img
          src={artDecoCorner}
          alt=""
          aria-hidden="true"
          className="w-20 h-20 sm:w-28 sm:h-28 md:w-36 md:h-36 pointer-events-none opacity-60 -scale-y-100 drop-shadow-[0_0_14px_rgba(232,192,106,0.3)] select-none"
        />
        <img
          src={artDecoCorner}
          alt=""
          aria-hidden="true"
          className="w-20 h-20 sm:w-28 sm:h-28 md:w-36 md:h-36 pointer-events-none opacity-60 -scale-x-100 -scale-y-100 drop-shadow-[0_0_14px_rgba(232,192,106,0.3)] select-none"
        />
      </div>

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
            onClick={() => setSubTab('relations')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md font-semibold text-xs transition-all ${
              subTab === 'relations'
                ? 'bg-deadlock-accent/20 text-deadlock-accent border border-deadlock-accent/40 shadow-sm steam-card'
                : 'text-deadlock-muted hover:text-deadlock-steam'
            }`}
          >
            <Swords className="w-3.5 h-3.5" />
            <span>How I perform against & with</span>
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

      {subTab === 'relations' && <HeroMatchupsAndSynergiesView matches={matches} />}
      {subTab === 'lanes' && <LanePerformanceView matches={matches} />}
      {subTab === 'overview' && (
        <div className="flex flex-col lg:flex-row items-start gap-6">
          {/* LEFT LATERAL PANEL: HERO PERFORMANCE */}
          <div className="w-full lg:w-80 xl:w-96 shrink-0 lg:sticky lg:top-20">
            <div className="bg-deadlock-panel/80 backdrop-blur-sm steam-card border border-deadlock-border/80 rounded-xl p-4 flex flex-col gap-3">
              {/* Panel Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-deadlock-accent" />
                  <h2 className="text-sm font-bold tracking-wide uppercase text-deadlock-steam">
                    Hero Performance
                  </h2>
                </div>
                <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-deadlock-card/80 border border-deadlock-border/60 text-deadlock-muted">
                  {heroPerformances.length} played
                </span>
              </div>

              {/* Search & Sort Controls */}
              <div className="flex flex-col gap-2 pt-1 border-t border-deadlock-border/40">
                {/* Search Bar */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-deadlock-muted pointer-events-none" />
                  <input
                    type="text"
                    value={heroSearch}
                    onChange={(e) => setHeroSearch(e.target.value)}
                    placeholder="Filter hero..."
                    className="w-full bg-deadlock-card/60 border border-deadlock-border/80 rounded-lg pl-8 pr-7 py-1.5 text-xs text-deadlock-steam placeholder-deadlock-muted/60 focus:outline-none focus:border-deadlock-accent/60 transition-colors"
                  />
                  {heroSearch && (
                    <button
                      type="button"
                      onClick={() => setHeroSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-deadlock-muted hover:text-deadlock-steam text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Sort Toggle Controls */}
                <div className="flex items-center justify-between gap-1 text-[11px] pt-1">
                  <span className="text-deadlock-muted font-medium">Sort:</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleSort('matches')}
                      className={`px-2 py-0.5 rounded flex items-center gap-0.5 font-medium transition-colors ${
                        sortField === 'matches'
                          ? 'bg-deadlock-accent/20 text-deadlock-accent border border-deadlock-accent/40 font-bold'
                          : 'text-deadlock-muted hover:text-deadlock-steam bg-deadlock-card/40 border border-transparent'
                      }`}
                    >
                      <span>Matches</span>
                      {sortField === 'matches' && (
                        sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSort('winRate')}
                      className={`px-2 py-0.5 rounded flex items-center gap-0.5 font-medium transition-colors ${
                        sortField === 'winRate'
                          ? 'bg-deadlock-accent/20 text-deadlock-accent border border-deadlock-accent/40 font-bold'
                          : 'text-deadlock-muted hover:text-deadlock-steam bg-deadlock-card/40 border border-transparent'
                      }`}
                    >
                      <span>Winrate</span>
                      {sortField === 'winRate' && (
                        sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSort('wins')}
                      className={`px-2 py-0.5 rounded flex items-center gap-0.5 font-medium transition-colors ${
                        sortField === 'wins'
                          ? 'bg-deadlock-accent/20 text-deadlock-accent border border-deadlock-accent/40 font-bold'
                          : 'text-deadlock-muted hover:text-deadlock-steam bg-deadlock-card/40 border border-transparent'
                      }`}
                    >
                      <span>Wins</span>
                      {sortField === 'wins' && (
                        sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Heroes List */}
              <div className="flex flex-col gap-1.5 max-h-[calc(100vh-280px)] min-h-[300px] overflow-y-auto pr-1">
                {displayedHeroes.map((hp: HeroPerformance) => {
                  const decided = hp.wins + hp.losses;
                  const isPositive = hp.winRate >= 50;
                  return (
                    <div key={hp.heroId} className="flex items-center gap-2.5 min-w-0">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <HeroAvatar heroId={hp.heroId} size="sm" />
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-xs text-deadlock-steam group-hover:text-white truncate">
                            {hp.hero?.name || `Hero #${hp.heroId}`}
                          </span>
                          <div className="flex items-center gap-1.5 text-[11px] text-deadlock-muted">
                            <span className="font-mono text-deadlock-steam/90 font-medium">
                              {hp.matches} {hp.matches === 1 ? 'match' : 'matches'}
                            </span>
                            <span>•</span>
                            <span className="text-deadlock-win font-mono font-medium">{hp.wins}W</span>
                            <span className="text-deadlock-loss font-mono font-medium">{hp.losses}L</span>
                            {hp.cancels > 0 && (
                              <span className="text-deadlock-muted/70 font-mono">{hp.cancels}C</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end shrink-0 gap-1">
                        <span
                          className={`font-mono font-bold text-xs px-2 py-0.5 rounded border ${
                            decided > 0
                              ? isPositive
                                ? 'bg-deadlock-win/10 text-deadlock-win border-deadlock-win/30'
                                : 'bg-deadlock-loss/10 text-deadlock-loss border-deadlock-loss/30'
                              : 'bg-deadlock-card text-deadlock-muted border-deadlock-border/40'
                          }`}
                        >
                          {decided > 0 ? `${hp.winRate}%` : 'N/A'}
                        </span>
                        {decided > 0 && (
                          <div className="w-14 bg-deadlock-dark/80 rounded-full h-1 overflow-hidden border border-deadlock-border/40">
                            <div
                              className={`h-full transition-all duration-300 ${
                                isPositive ? 'bg-deadlock-win' : 'bg-deadlock-loss'
                              }`}
                              style={{ width: `${hp.winRate}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {displayedHeroes.length === 0 && (
                  <div className="text-center py-8 text-xs text-deadlock-muted">
                    No heroes match "{heroSearch}".
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT MAIN PANEL */}
          <div className="flex-1 min-w-0 flex flex-col gap-6 w-full">
            {/* SECTION 1: STREAKS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

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
            <div className="mt-4 flex items-center gap-3.5">
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

          </div>
        </div>
      )}
    </div>
    </div>
  );
};
