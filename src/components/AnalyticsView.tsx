import React, { useState } from 'react';
import { Match } from '../types/match';
import { HeroAvatar } from './HeroAvatar';
import { EnemyMatchupsView } from './EnemyMatchupsView';
import { AllySynergiesView } from './AllySynergiesView';
import { LanePerformanceView } from './LanePerformanceView';
import {
  calculateGlobalStats,
  calculatePatronStats,
  calculateHeroPerformance,
  HeroPerformance,
} from '../services/analytics';
import {
  Trophy,
  XCircle,
  AlertCircle,
  TrendingUp,
  Gamepad2,
  Crown,
  ChevronDown,
  ChevronUp,
  Swords,
  BarChart2,
  Users,
  Compass,
} from 'lucide-react';

interface AnalyticsViewProps {
  matches: Match[];
}

type SortField = 'matches' | 'winRate' | 'wins';
type AnalyticsSubTab = 'overview' | 'matchups' | 'synergies' | 'lanes';

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ matches }) => {
  const [subTab, setSubTab] = useState<AnalyticsSubTab>('overview');
  const [sortField, setSortField] = useState<SortField>('matches');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  const globalStats = calculateGlobalStats(matches);
  const patronStats = calculatePatronStats(matches);
  const heroPerformances = calculateHeroPerformance(matches);

  const sortedHeroes = [...heroPerformances].sort((a, b) => {
    let diff = 0;
    if (sortField === 'matches') diff = b.matches - a.matches;
    else if (sortField === 'winRate') diff = b.winRate - a.winRate;
    else if (sortField === 'wins') diff = b.wins - a.wins;
    return sortAsc ? -diff : diff;
  });

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
      <div className="bg-deadlock-panel border border-deadlock-border rounded-xl p-12 text-center flex flex-col items-center justify-center gap-3">
        <Gamepad2 className="w-12 h-12 text-deadlock-muted opacity-40" />
        <h2 className="text-lg font-bold text-gray-200">No match data available yet</h2>
        <p className="text-sm text-deadlock-muted max-w-md">
          Start recording your matches in the <strong>Log Match</strong> tab to unlock comprehensive stats, patron win rates, and hero performance tracking.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Subtab Navigation */}
      <div className="flex items-center justify-between border-b border-deadlock-border pb-3">
        <div className="flex items-center gap-2 bg-deadlock-panel p-1 rounded-lg border border-deadlock-border flex-wrap">
          <button
            type="button"
            onClick={() => setSubTab('overview')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md font-semibold text-xs transition-all ${
              subTab === 'overview'
                ? 'bg-deadlock-border text-white shadow-sm'
                : 'text-deadlock-muted hover:text-white'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span>Overview & Heroes</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('matchups')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md font-semibold text-xs transition-all ${
              subTab === 'matchups'
                ? 'bg-deadlock-border text-white shadow-sm'
                : 'text-deadlock-muted hover:text-white'
            }`}
          >
            <Swords className="w-3.5 h-3.5" />
            <span>Enemy Matchups & Counters</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('synergies')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md font-semibold text-xs transition-all ${
              subTab === 'synergies'
                ? 'bg-deadlock-border text-white shadow-sm'
                : 'text-deadlock-muted hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Ally Synergies & Combos</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('lanes')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md font-semibold text-xs transition-all ${
              subTab === 'lanes'
                ? 'bg-deadlock-border text-white shadow-sm'
                : 'text-deadlock-muted hover:text-white'
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
        <div className="bg-deadlock-panel border border-deadlock-border/80 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-deadlock-muted text-xs">
            <span>Total Matches</span>
            <Gamepad2 className="w-4 h-4 text-deadlock-muted" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">{globalStats.totalMatches}</span>
            <span className="text-xs text-deadlock-muted">recorded</span>
          </div>
        </div>

        {/* Global Winrate */}
        <div className="bg-deadlock-panel border border-deadlock-border/80 rounded-xl p-4 flex flex-col justify-between">
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
                  : 'text-white'
              }`}
            >
              {globalStats.totalWins + globalStats.totalLosses > 0 ? `${globalStats.winRate}%` : 'N/A'}
            </span>
            <span className="text-xs text-deadlock-muted">
              ({globalStats.totalWins}W - {globalStats.totalLosses}L)
            </span>
          </div>
        </div>

        {/* Victories */}
        <div className="bg-deadlock-panel border border-deadlock-border/80 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-deadlock-muted text-xs">
            <span>Victories</span>
            <Trophy className="w-4 h-4 text-deadlock-win" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-deadlock-win">{globalStats.totalWins}</span>
            <span className="text-xs text-deadlock-muted">
              {globalStats.totalMatches > 0
                ? `${Math.round((globalStats.totalWins / globalStats.totalMatches) * 100)}% of games`
                : ''}
            </span>
          </div>
        </div>

        {/* Defeats & Cancels */}
        <div className="bg-deadlock-panel border border-deadlock-border/80 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-deadlock-muted text-xs">
            <span>Losses & Cancels</span>
            <div className="flex items-center gap-1">
              <XCircle className="w-3.5 h-3.5 text-deadlock-loss" />
              <AlertCircle className="w-3.5 h-3.5 text-gray-400" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-deadlock-loss">{globalStats.totalLosses}</span>
            <span className="text-xs text-deadlock-muted">
              loss{globalStats.totalLosses !== 1 ? 'es' : ''} / <strong className="text-gray-300">{globalStats.totalCancels}</strong> cancelled
            </span>
          </div>
        </div>
      </div>

      {/* SECTION 2: PATRON PERFORMANCE COMPARISON */}
      <div className="bg-deadlock-panel border border-deadlock-border/80 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Crown className="w-5 h-5 text-deadlock-hidden-king" />
          <h2 className="text-sm font-bold tracking-wide uppercase text-gray-200">
            Patron Faction Performance
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* The Hidden King */}
          <div className="bg-deadlock-dark/70 border border-deadlock-hidden-king/40 rounded-xl p-4 flex flex-col gap-3 relative overflow-hidden">
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
                <div className="text-3xl font-black text-white">
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
          <div className="bg-deadlock-dark/70 border border-deadlock-archmother/40 rounded-xl p-4 flex flex-col gap-3 relative overflow-hidden">
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
                <div className="text-3xl font-black text-white">
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

      {/* SECTION 3: HERO PERFORMANCE BREAKDOWN TABLE */}
      <div className="bg-deadlock-panel border border-deadlock-border/80 rounded-xl overflow-hidden flex flex-col">
        <div className="p-5 border-b border-deadlock-border/80 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold tracking-wide uppercase text-gray-200">
              Hero Performance Breakdown
            </h2>
            <p className="text-xs text-deadlock-muted mt-0.5">
              Statistics for each hero you have piloted in recorded drafts ({heroPerformances.length} heroes played)
            </p>
          </div>

          <div className="text-xs text-deadlock-muted">
            Click column headers to sort
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-deadlock-dark/60 text-deadlock-muted border-b border-deadlock-border/60">
              <tr>
                <th className="py-3 px-4 font-semibold">Hero</th>
                <th
                  onClick={() => handleSort('matches')}
                  className="py-3 px-4 font-semibold cursor-pointer hover:text-white transition-colors"
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
                  className="py-3 px-4 font-semibold cursor-pointer hover:text-white transition-colors"
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
                  className="py-3 px-4 font-semibold cursor-pointer hover:text-white transition-colors text-right"
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
                return (
                  <tr
                    key={hp.heroId}
                    className="hover:bg-deadlock-dark/30 transition-colors"
                  >
                    {/* Hero Info */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <HeroAvatar heroId={hp.heroId} size="xs" />
                        <div>
                          <div className="font-bold text-gray-200 text-sm">
                            {hp.hero?.name || `Hero #${hp.heroId}`}
                          </div>
                          <div className="text-[11px] text-deadlock-muted capitalize">
                            {hp.hero?.heroType || hp.hero?.role || 'Unknown'}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Total Matches */}
                    <td className="py-3 px-4 font-mono font-medium text-gray-300">
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
  );
};
