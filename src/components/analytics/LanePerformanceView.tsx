import React, { useState, useMemo } from 'react';
import { Match } from '../../types/match';
import { HeroAvatar } from '../HeroAvatar';
import {
  calculateLaneAnalytics,
  LaneAnalyticsSummary,
  DirectLaneOpponentStat,
  DirectLaneAllyStat,
  LaneDistributionStat,
} from '../../services/analytics';
import { getHeroById } from '../../data/heroes';
import {
  Compass,
  Swords,
  Filter,
  TrendingUp,
  Users,
  Search,
  ChevronDown,
  ChevronUp,
  Flame,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';

interface LanePerformanceViewProps {
  matches: Match[];
}

type TableSortField = 'hero' | 'lanes' | 'laneWins' | 'laneScore' | 'gameWinRate';
type MatchupTab = 'opponents' | 'allies';
type OutcomeType = 'won' | 'even' | 'lost';

export function calculateLaneScore(laneWins: number, laneEvens: number, laneLosses: number): number {
  return (laneWins * 2) + (laneEvens * 1) - (laneLosses * 2);
}

export const LanePerformanceView: React.FC<LanePerformanceViewProps> = ({ matches }) => {
  const [selectedPlayerHeroId, setSelectedPlayerHeroId] = useState<number | null>(null);
  const [matchupTab, setMatchupTab] = useState<MatchupTab>('opponents');
  const [tableSearch, setTableSearch] = useState<string>('');
  const [sortField, setSortField] = useState<TableSortField>('lanes');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Distinct heroes piloted by player with lane data, sorted by matches played descending
  const playedHeroes = useMemo(() => {
    const heroCounts = new Map<number, number>();
    for (const m of matches) {
      if (m.lane) {
        heroCounts.set(m.myHeroId, (heroCounts.get(m.myHeroId) || 0) + 1);
      }
    }
    const playedHeroIds = Array.from(heroCounts.keys());
    return playedHeroIds
      .map((id) => ({
        hero: getHeroById(id),
        count: heroCounts.get(id) || 0,
      }))
      .filter((item): item is { hero: NonNullable<typeof item.hero>; count: number } => item.hero !== undefined)
      .sort((a, b) => b.count - a.count);
  }, [matches]);

  const laneStats: LaneAnalyticsSummary = useMemo(
    () => calculateLaneAnalytics(matches, selectedPlayerHeroId),
    [matches, selectedPlayerHeroId]
  );

  const selectedHeroObj = selectedPlayerHeroId ? getHeroById(selectedPlayerHeroId) : null;

  const handleSort = (field: TableSortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(field === 'hero'); // Ascending for hero name, descending for stats
    }
  };

  // Filter and sort opponents
  const sortedOpponents = useMemo(() => {
    let list = [...laneStats.opponents];
    if (tableSearch.trim()) {
      const q = tableSearch.toLowerCase().trim();
      list = list.filter((o) => o.opponentHero?.name.toLowerCase().includes(q));
    }
    return list.sort((a, b) => {
      let diff = 0;
      if (sortField === 'hero') {
        const nameA = a.opponentHero?.name || '';
        const nameB = b.opponentHero?.name || '';
        diff = nameA.localeCompare(nameB);
      } else if (sortField === 'lanes') {
        diff = b.lanesFaced - a.lanesFaced;
      } else if (sortField === 'laneWins') {
        diff = b.laneWins - a.laneWins;
      } else if (sortField === 'laneScore') {
        const scoreA = calculateLaneScore(a.laneWins, a.laneEvens, a.laneLosses);
        const scoreB = calculateLaneScore(b.laneWins, b.laneEvens, b.laneLosses);
        diff = scoreB - scoreA;
      } else if (sortField === 'gameWinRate') {
        diff = b.gameWinRate - a.gameWinRate;
      }
      return sortAsc ? -diff : diff;
    });
  }, [laneStats.opponents, tableSearch, sortField, sortAsc]);

  // Filter and sort allies (duo lane partners)
  const sortedAllies = useMemo(() => {
    let list = [...laneStats.allies];
    if (tableSearch.trim()) {
      const q = tableSearch.toLowerCase().trim();
      list = list.filter((a) => a.allyHero?.name.toLowerCase().includes(q));
    }
    return list.sort((a, b) => {
      let diff = 0;
      if (sortField === 'hero') {
        const nameA = a.allyHero?.name || '';
        const nameB = b.allyHero?.name || '';
        diff = nameA.localeCompare(nameB);
      } else if (sortField === 'lanes') {
        diff = b.lanesTogether - a.lanesTogether;
      } else if (sortField === 'laneWins') {
        diff = b.laneWins - a.laneWins;
      } else if (sortField === 'laneScore') {
        const scoreA = calculateLaneScore(a.laneWins, a.laneEvens, a.laneLosses);
        const scoreB = calculateLaneScore(b.laneWins, b.laneEvens, b.laneLosses);
        diff = scoreB - scoreA;
      } else if (sortField === 'gameWinRate') {
        diff = b.gameWinRate - a.gameWinRate;
      }
      return sortAsc ? -diff : diff;
    });
  }, [laneStats.allies, tableSearch, sortField, sortAsc]);

  // Partition opponents into representative and low-sample
  const { repOpponents, lowSampleOpponents } = useMemo(() => {
    const rep: DirectLaneOpponentStat[] = [];
    const low: DirectLaneOpponentStat[] = [];
    for (const item of sortedOpponents) {
      if (item.isRepresentative) {
        rep.push(item);
      } else {
        low.push(item);
      }
    }
    return { repOpponents: rep, lowSampleOpponents: low };
  }, [sortedOpponents]);

  // Partition allies into representative and low-sample
  const { repAllies, lowSampleAllies } = useMemo(() => {
    const rep: DirectLaneAllyStat[] = [];
    const low: DirectLaneAllyStat[] = [];
    for (const item of sortedAllies) {
      if (item.isRepresentative) {
        rep.push(item);
      } else {
        low.push(item);
      }
    }
    return { repAllies: rep, lowSampleAllies: low };
  }, [sortedAllies]);

  const currentThreshold = useMemo(() => {
    if (matchupTab === 'opponents' && laneStats.opponents.length > 0) {
      return laneStats.opponents[0].threshold ?? 3;
    }
    if (matchupTab === 'allies' && laneStats.allies.length > 0) {
      return laneStats.allies[0].threshold ?? 3;
    }
    return 3;
  }, [matchupTab, laneStats]);

  if (laneStats.totalLaneTrackedMatches === 0) {
    return (
      <div className="steam-glass steam-panel rounded-xl p-12 text-center flex flex-col items-center justify-center gap-3">
        <Compass className="w-12 h-12 text-deadlock-muted opacity-40" />
        <h2 className="text-lg font-bold text-deadlock-steam">No lane data tracked yet</h2>
        <p className="text-sm text-deadlock-muted max-w-md">
          When recording or editing matches in the <strong>Log Match</strong> / <strong>History</strong> tabs, fill in the <strong>Lane Assignment</strong> section (Yellow, Blue, or Green lane) to unlock lane statistics and opponent tracking!
        </p>
      </div>
    );
  }

  const lanesConfig = [
    {
      key: 'yellow' as const,
      label: 'Yellow Lane',
      colorClass: 'text-yellow-400',
      borderClass: 'border-yellow-500/40',
      bgGlowClass: 'bg-yellow-500/5',
      dotClass: 'bg-yellow-400 shadow-yellow-400/50',
      stat: laneStats.lanes.yellow,
    },
    {
      key: 'blue' as const,
      label: 'Blue Lane',
      colorClass: 'text-sky-400',
      borderClass: 'border-sky-500/40',
      bgGlowClass: 'bg-sky-500/5',
      dotClass: 'bg-sky-400 shadow-sky-400/50',
      stat: laneStats.lanes.blue,
    },
    {
      key: 'green' as const,
      label: 'Green Lane',
      colorClass: 'text-emerald-400',
      borderClass: 'border-emerald-500/40',
      bgGlowClass: 'bg-emerald-500/5',
      dotClass: 'bg-emerald-400 shadow-emerald-400/50',
      stat: laneStats.lanes.green,
    },
  ];

  const totalTrackedGames = Math.max(laneStats.totalLaneTrackedMatches, 1);

  return (
    <div className="flex flex-col gap-6">
      {/* ── SECTION 1: FILTER BY YOUR HERO (SORTED BY NUMBER OF GAMES) ── */}
      <div className="steam-glass steam-panel rounded-xl p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-deadlock-accent" />
            <span className="text-xs font-bold uppercase tracking-wider text-deadlock-steam">
              Filter Lane Stats by Your Hero:
            </span>
          </div>
          <span className="text-xs text-deadlock-muted">
            {selectedHeroObj
              ? `Showing lane performance specifically when you play ${selectedHeroObj.name}`
              : `Showing lane performance across all heroes (${laneStats.totalLaneTrackedMatches} matches with lane data)`}
          </span>
        </div>

        {/* Hero Selector Buttons: Sorted by games descending */}
        <div className="flex items-center gap-2 flex-wrap pt-1">
          <button
            type="button"
            onClick={() => setSelectedPlayerHeroId(null)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 ${
              selectedPlayerHeroId === null
                ? 'bg-deadlock-accent/20 border-deadlock-accent text-deadlock-steam shadow-sm ring-1 ring-deadlock-accent/40'
                : 'bg-deadlock-dark border-deadlock-border text-deadlock-muted hover:text-deadlock-steam hover:border-white/30'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-deadlock-accent" />
            <span>All Heroes</span>
            <span className="text-[10px] opacity-75 font-mono">({laneStats.totalLaneTrackedMatches})</span>
          </button>

          {playedHeroes.map(({ hero, count }) => {
            const isSelected = selectedPlayerHeroId === hero.id;
            return (
              <button
                key={hero.id}
                type="button"
                onClick={() => setSelectedPlayerHeroId(hero.id)}
                className={`flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs border transition-all ${
                  isSelected
                    ? 'bg-deadlock-border border-white text-deadlock-steam shadow-md ring-1 ring-white/40'
                    : 'bg-deadlock-dark border-deadlock-border text-deadlock-muted hover:text-deadlock-steam hover:border-white/30'
                }`}
              >
                <HeroAvatar heroId={hero.id} size="xs" />
                <span className="font-medium">{hero.name}</span>
                <span className="text-[10px] opacity-70 font-mono">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── SECTION 2: VERTICAL ALCHEMICAL LIQUID VIALS & LANE SCORE ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-deadlock-accent" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-deadlock-steam">
              Lane Performance & Outcome Vials
            </h3>
          </div>
          <span className="text-[11px] text-deadlock-muted font-normal">
            Alchemical outcome vials (Win on top, Even in middle, Loss at bottom — hover layers for details)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {lanesConfig.map((laneConf) => (
            <LaneVialCard
              key={laneConf.key}
              laneConfig={laneConf}
              totalTrackedGames={totalTrackedGames}
            />
          ))}
        </div>
      </div>

      {/* ── SECTION 3: LANE CONVERSION TO MATCH VICTORY (SNOWBALL & COMEBACK) ── */}
      <div className="steam-glass steam-panel rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-deadlock-win" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-deadlock-steam">
              Lane Outcome Conversion to Match Victory
            </h3>
          </div>
          <span className="text-[11px] text-deadlock-muted">
            Correlation between laning phase result and final match victory
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Lane Won -> Snowball */}
          <div className="bg-deadlock-card/80 border border-deadlock-win/40 rounded-xl p-4 flex flex-col gap-2 relative overflow-hidden">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-deadlock-win flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5" />
                When Lane is Won
              </span>
              <span className="text-deadlock-muted font-mono">{laneStats.outcomes.won.matches} times</span>
            </div>

            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-black text-deadlock-win font-mono">
                {laneStats.outcomes.won.matches > 0 ? `${laneStats.outcomes.won.conversionWinRate}%` : 'N/A'}
              </span>
              <span className="text-xs text-deadlock-muted font-mono">
                {laneStats.outcomes.won.gameWins}W - {laneStats.outcomes.won.gameLosses}L
              </span>
            </div>
          </div>

          {/* Lane Even -> Neutral */}
          <div className="bg-deadlock-card/80 border border-amber-500/30 rounded-xl p-4 flex flex-col gap-2 relative overflow-hidden">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-yellow-300">When Lane is Even</span>
              <span className="text-deadlock-muted font-mono">{laneStats.outcomes.even.matches} times</span>
            </div>

            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-black text-yellow-300 font-mono">
                {laneStats.outcomes.even.matches > 0 ? `${laneStats.outcomes.even.conversionWinRate}%` : 'N/A'}
              </span>
              <span className="text-xs text-deadlock-muted font-mono">
                {laneStats.outcomes.even.gameWins}W - {laneStats.outcomes.even.gameLosses}L
              </span>
            </div>
          </div>

          {/* Lane Lost -> Comeback */}
          <div className="bg-deadlock-card/80 border border-deadlock-loss/40 rounded-xl p-4 flex flex-col gap-2 relative overflow-hidden">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-deadlock-loss flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5" />
                When Lane is Lost
              </span>
              <span className="text-deadlock-muted font-mono">{laneStats.outcomes.lost.matches} times</span>
            </div>

            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-black text-deadlock-loss font-mono">
                {laneStats.outcomes.lost.matches > 0 ? `${laneStats.outcomes.lost.conversionWinRate}%` : 'N/A'}
              </span>
              <span className="text-xs text-deadlock-muted font-mono">
                {laneStats.outcomes.lost.gameWins}W - {laneStats.outcomes.lost.gameLosses}L
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── SECTION 4: DIRECT LANE MATCHUPS TABLE (CLICKABLE SORTABLE COLUMNS) ── */}
      <div className="steam-glass steam-panel rounded-xl overflow-hidden flex flex-col">
        {/* Toolbar Header */}
        <div className="p-4 border-b border-deadlock-border/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Mode Switcher Tabs */}
          <div className="flex items-center gap-1.5 bg-deadlock-dark/80 p-1 rounded-xl border border-deadlock-border/60">
            <button
              type="button"
              onClick={() => setMatchupTab('opponents')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                matchupTab === 'opponents'
                  ? 'bg-deadlock-border text-deadlock-steam shadow-sm border border-white/20'
                  : 'text-deadlock-muted hover:text-deadlock-steam'
              }`}
            >
              <Swords className="w-3.5 h-3.5 text-deadlock-hidden-king" />
              <span>Direct Opponents</span>
              <span className="text-[10px] font-mono opacity-70">({laneStats.opponents.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setMatchupTab('allies')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                matchupTab === 'allies'
                  ? 'bg-deadlock-border text-deadlock-steam shadow-sm border border-white/20'
                  : 'text-deadlock-muted hover:text-deadlock-steam'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-sky-400" />
              <span>Duo Lane Partners</span>
              <span className="text-[10px] font-mono opacity-70">({laneStats.allies.length})</span>
            </button>
          </div>

          {/* Quick Search & Info Label */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-deadlock-muted hidden sm:inline">Click column headers to sort</span>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-deadlock-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={matchupTab === 'opponents' ? 'Search opponent...' : 'Search partner...'}
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="bg-deadlock-dark border border-deadlock-border text-xs rounded-lg pl-8 pr-3 py-1.5 text-deadlock-steam focus:outline-none focus:border-deadlock-accent w-40 sm:w-48 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Matchup Table with Clickable Sorting Columns */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-deadlock-card/90 text-deadlock-muted border-b border-deadlock-border/60">
              <tr>
                {/* Hero Column */}
                <th
                  onClick={() => handleSort('hero')}
                  className="py-3 px-4 font-semibold cursor-pointer hover:text-deadlock-steam transition-colors select-none"
                >
                  <div className="flex items-center gap-1">
                    <span>Hero</span>
                    {sortField === 'hero' && (
                      sortAsc ? <ChevronUp className="w-3.5 h-3.5 text-deadlock-accent" /> : <ChevronDown className="w-3.5 h-3.5 text-deadlock-accent" />
                    )}
                  </div>
                </th>

                {/* Lanes Count Column */}
                <th
                  onClick={() => handleSort('lanes')}
                  className="py-3 px-4 font-semibold cursor-pointer hover:text-deadlock-steam transition-colors select-none"
                >
                  <div className="flex items-center gap-1">
                    <span>{matchupTab === 'opponents' ? 'Lanes Faced' : 'Lanes Together'}</span>
                    {sortField === 'lanes' && (
                      sortAsc ? <ChevronUp className="w-3.5 h-3.5 text-deadlock-accent" /> : <ChevronDown className="w-3.5 h-3.5 text-deadlock-accent" />
                    )}
                  </div>
                </th>

                {/* Record Column: xW - xE - xL (with E in Yellow) */}
                <th
                  onClick={() => handleSort('laneWins')}
                  className="py-3 px-4 font-semibold cursor-pointer hover:text-deadlock-steam transition-colors select-none"
                >
                  <div className="flex items-center gap-1">
                    <span>Laning Phase Record (W / E / L)</span>
                    {sortField === 'laneWins' && (
                      sortAsc ? <ChevronUp className="w-3.5 h-3.5 text-deadlock-accent" /> : <ChevronDown className="w-3.5 h-3.5 text-deadlock-accent" />
                    )}
                  </div>
                </th>

                {/* Lane Score Column */}
                <th
                  onClick={() => handleSort('laneScore')}
                  className="py-3 px-4 font-semibold cursor-pointer hover:text-deadlock-steam transition-colors select-none"
                  title="Lane Score Rules: Win: +2 / Even: +1 / Loss: -2"
                >
                  <div className="flex items-center gap-1">
                    <span>Lane Score</span>
                    {sortField === 'laneScore' && (
                      sortAsc ? <ChevronUp className="w-3.5 h-3.5 text-deadlock-accent" /> : <ChevronDown className="w-3.5 h-3.5 text-deadlock-accent" />
                    )}
                  </div>
                </th>

                {/* Final Match Win Rate Column */}
                <th
                  onClick={() => handleSort('gameWinRate')}
                  className="py-3 px-4 font-semibold cursor-pointer hover:text-deadlock-steam transition-colors select-none text-right"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Final Game Win Rate</span>
                    {sortField === 'gameWinRate' && (
                      sortAsc ? <ChevronUp className="w-3.5 h-3.5 text-deadlock-accent" /> : <ChevronDown className="w-3.5 h-3.5 text-deadlock-accent" />
                    )}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-deadlock-border/40">
              {matchupTab === 'opponents' ? (
                <>
                  {repOpponents.map((opp) => (
                    <OpponentRow key={opp.opponentHeroId} opp={opp} isLowSample={false} />
                  ))}

                  {/* Delimiter row for low-sample opponents */}
                  {lowSampleOpponents.length > 0 && (
                    <tr className="bg-deadlock-dark/95 border-y border-dashed border-amber-500/40">
                      <td colSpan={5} className="py-2.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-2 text-xs text-amber-200/90 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-sm shadow-amber-400/50" />
                          <span>
                            Low Sample Size (&lt; {currentThreshold} matches) — The following heroes do not have enough data to be statistically conclusive
                          </span>
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-sm shadow-amber-400/50" />
                        </div>
                      </td>
                    </tr>
                  )}

                  {lowSampleOpponents.map((opp) => (
                    <OpponentRow
                      key={opp.opponentHeroId}
                      opp={opp}
                      isLowSample={true}
                      threshold={currentThreshold}
                    />
                  ))}

                  {sortedOpponents.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-deadlock-muted italic">
                        No direct lane opponents found matching your criteria.
                      </td>
                    </tr>
                  )}
                </>
              ) : (
                <>
                  {repAllies.map((ally) => (
                    <AllyRow key={ally.allyHeroId} ally={ally} isLowSample={false} />
                  ))}

                  {/* Delimiter row for low-sample allies */}
                  {lowSampleAllies.length > 0 && (
                    <tr className="bg-deadlock-dark/95 border-y border-dashed border-amber-500/40">
                      <td colSpan={5} className="py-2.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-2 text-xs text-amber-200/90 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-sm shadow-amber-400/50" />
                          <span>
                            Low Sample Size (&lt; {currentThreshold} matches) — The following heroes do not have enough data to be statistically conclusive
                          </span>
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-sm shadow-amber-400/50" />
                        </div>
                      </td>
                    </tr>
                  )}

                  {lowSampleAllies.map((ally) => (
                    <AllyRow
                      key={ally.allyHeroId}
                      ally={ally}
                      isLowSample={true}
                      threshold={currentThreshold}
                    />
                  ))}

                  {sortedAllies.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-deadlock-muted italic">
                        No duo lane partners recorded yet. When playing a duo lane, assign your lane ally in the match editor to track synergies!
                      </td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

/* ── SUBCOMPONENT: LANE VIAL CARD WITH HOVER INTERACTION & LANE SCORE ── */

interface LaneVialCardProps {
  laneConfig: {
    key: 'yellow' | 'blue' | 'green';
    label: string;
    colorClass: string;
    borderClass: string;
    bgGlowClass: string;
    dotClass: string;
    stat: LaneDistributionStat;
  };
  totalTrackedGames: number;
}

const LaneVialCard: React.FC<LaneVialCardProps> = ({ laneConfig }) => {
  const { key, label, colorClass, borderClass, bgGlowClass, dotClass, stat } = laneConfig;
  const [hoveredOutcome, setHoveredOutcome] = useState<OutcomeType | null>(null);

  const totalOutcomes = stat.laneWins + stat.laneEvens + stat.laneLosses;

  const winPct = totalOutcomes > 0 ? Math.round((stat.laneWins / totalOutcomes) * 100) : 0;
  const evenPct = totalOutcomes > 0 ? Math.round((stat.laneEvens / totalOutcomes) * 100) : 0;
  const lossPct = totalOutcomes > 0 ? Math.max(0, 100 - winPct - evenPct) : 0;

  // Lane Score formula: Win = +2, Even = +1, Lose = -2
  const laneScore = calculateLaneScore(stat.laneWins, stat.laneEvens, stat.laneLosses);
  const formattedScore = `${laneScore}`;

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
        {/* SVG Alchemical Vial Component (Wins on TOP, 100% full) */}
        <div className="flex flex-col items-center gap-1 shrink-0">

          <AlchemicalVialGauge
            laneKey={key}
            stat={stat}
            totalOutcomes={totalOutcomes}
            winPct={winPct}
            evenPct={evenPct}
            lossPct={lossPct}
            hoveredOutcome={hoveredOutcome}
            onHoverOutcome={setHoveredOutcome}
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
                  <span className="text-deadlock-win">{stat.laneWins}W</span>
                  <span className="text-deadlock-muted font-normal mx-1">-</span>
                  <span className="text-yellow-400">{stat.laneEvens}E</span>
                  <span className="text-deadlock-muted font-normal mx-1">-</span>
                  <span className="text-deadlock-loss">{stat.laneLosses}L</span>
                </div>
                <span className="text-[10px] text-deadlock-muted mt-0.5">
                  Hover vial layers for breakdown
                </span>
              </div>
            )}
          </div>

          {/* Lane Score Box (Clean Score, rules in title tooltip) */}
          <div
            className="flex flex-col items-center justify-center p-3 rounded-xl bg-deadlock-dark/90 border border-deadlock-border/60 text-center shadow-inner cursor-help transition-all hover:border-deadlock-border hover:bg-deadlock-card/40"
            title="Lane Score Rules: Win: +2 / Even: +1 / Loss: -2"
          >
            <span className="text-[10px] uppercase font-bold tracking-wider text-deadlock-muted">
              Lane Score
            </span>

            <div className="flex items-baseline gap-1 mt-0.5">
              <span
                className={`text-3xl font-black font-mono tracking-tight ${
                  laneScore > 0
                    ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]'
                    : laneScore < 0
                    ? 'text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.3)]'
                    : 'text-deadlock-muted'
                }`}
              >
                {formattedScore}
              </span>
              <span className="text-xs font-semibold text-deadlock-muted">pts</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── SUBCOMPONENT: SVG ALCHEMICAL LIQUID VIAL GAUGE (100% FULL, WINS ON TOP) ── */

interface AlchemicalVialGaugeProps {
  laneKey: 'yellow' | 'blue' | 'green';
  stat: LaneDistributionStat;
  totalOutcomes: number;
  winPct: number;
  evenPct: number;
  lossPct: number;
  hoveredOutcome: OutcomeType | null;
  onHoverOutcome: (outcome: OutcomeType | null) => void;
}

const AlchemicalVialGauge: React.FC<AlchemicalVialGaugeProps> = ({
  laneKey,
  stat,
  totalOutcomes,
  winPct,
  evenPct,
  lossPct,
  hoveredOutcome,
  onHoverOutcome,
}) => {
  // SVG Vial Interior Geometry:
  // Flask interior is between y = 16 (top rim) and y = 190 (bottom curve center y=172 + radius 18).
  // Total usable liquid height is exactly 174px (100% full liquid when matches exist).
  const usableLiquidHeight = 174;
  const liquidTopY = 16;

  // Layer heights: WIN on TOP, EVEN in MIDDLE, LOSS at BOTTOM
  const wonHeightPx = totalOutcomes > 0 ? (stat.laneWins / totalOutcomes) * usableLiquidHeight : 0;
  const evenHeightPx = totalOutcomes > 0 ? (stat.laneEvens / totalOutcomes) * usableLiquidHeight : 0;
  const lostHeightPx = usableLiquidHeight - wonHeightPx - evenHeightPx;

  // Vertical offsets from top to bottom
  const yWon = liquidTopY;
  const yEven = liquidTopY + wonHeightPx;
  const yLost = yEven + evenHeightPx;

  const fullTooltip = `Lane Outcomes (${totalOutcomes} total):\n• Won (Top): ${stat.laneWins} (${winPct}%)\n• Even (Middle): ${stat.laneEvens} (${evenPct}%)\n• Lost (Bottom): ${stat.laneLosses} (${lossPct}%)`;

  return (
    <div className="relative group cursor-pointer" title={fullTooltip}>
      <svg
        width="64"
        height="204"
        viewBox="0 0 64 204"
        className="overflow-visible drop-shadow-md select-none transition-transform duration-300 group-hover:scale-[1.02]"
      >
        <defs>
          {/* Clip path defining the interior cavity of the glass flask */}
          <clipPath id={`vial-cavity-${laneKey}`}>
            <path d="M 14 14 L 14 172 A 18 18 0 0 0 50 172 L 50 14 Z" />
          </clipPath>

          {/* Gradients for the 3 distinct fluid layers */}
          <linearGradient id={`fluid-won-${laneKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#047857" />
          </linearGradient>

          <linearGradient id={`fluid-even-${laneKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fde047" />
            <stop offset="100%" stopColor="#d97706" />
          </linearGradient>

          <linearGradient id={`fluid-lost-${laneKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fb7185" />
            <stop offset="100%" stopColor="#9f1239" />
          </linearGradient>
        </defs>

        {/* 1. Empty flask dark interior background */}
        <path
          d="M 14 14 L 14 172 A 18 18 0 0 0 50 172 L 50 14 Z"
          fill="#14110e"
          stroke="#26211b"
          strokeWidth="1"
        />

        {/* 2. Full Liquid Contents (clipped to flask interior) */}
        {stat.matches > 0 && totalOutcomes > 0 ? (
          <g clipPath={`url(#vial-cavity-${laneKey})`}>
            {/* Green / Won Fluid (TOP) */}
            {wonHeightPx > 0 && (
              <rect
                x="10"
                y={yWon}
                width="44"
                height={wonHeightPx + (evenHeightPx > 0 || lostHeightPx > 0 ? 0.5 : 2)}
                fill={`url(#fluid-won-${laneKey})`}
                className={`transition-all duration-200 cursor-pointer ${
                  hoveredOutcome === 'won'
                    ? 'brightness-125 filter drop-shadow'
                    : hoveredOutcome !== null
                    ? 'opacity-65'
                    : 'hover:brightness-110'
                }`}
                onMouseEnter={() => onHoverOutcome('won')}
                onMouseLeave={() => onHoverOutcome(null)}
              >
                <title>{`Lane Won: ${stat.laneWins} games (${winPct}%) [+2 pts]`}</title>
              </rect>
            )}

            {/* Amber-Yellow / Even Fluid (MIDDLE) */}
            {evenHeightPx > 0 && (
              <rect
                x="10"
                y={yEven}
                width="44"
                height={evenHeightPx + (lostHeightPx > 0 ? 0.5 : 2)}
                fill={`url(#fluid-even-${laneKey})`}
                className={`transition-all duration-200 cursor-pointer ${
                  hoveredOutcome === 'even'
                    ? 'brightness-125 filter drop-shadow'
                    : hoveredOutcome !== null
                    ? 'opacity-65'
                    : 'hover:brightness-110'
                }`}
                onMouseEnter={() => onHoverOutcome('even')}
                onMouseLeave={() => onHoverOutcome(null)}
              >
                <title>{`Lane Even: ${stat.laneEvens} games (${evenPct}%) [+1 pt]`}</title>
              </rect>
            )}

            {/* Crimson / Lost Fluid (BOTTOM) */}
            {lostHeightPx > 0 && (
              <rect
                x="10"
                y={yLost}
                width="44"
                height={lostHeightPx + 4}
                fill={`url(#fluid-lost-${laneKey})`}
                className={`transition-all duration-200 cursor-pointer ${
                  hoveredOutcome === 'lost'
                    ? 'brightness-125 filter drop-shadow'
                    : hoveredOutcome !== null
                    ? 'opacity-65'
                    : 'hover:brightness-110'
                }`}
                onMouseEnter={() => onHoverOutcome('lost')}
                onMouseLeave={() => onHoverOutcome(null)}
              >
                <title>{`Lane Lost: ${stat.laneLosses} games (${lossPct}%) [-2 pts]`}</title>
              </rect>
            )}

            {/* Glowing meniscus line at the fluid surface (top) */}
            <path
              d="M 14 16 Q 32 13.5, 50 16 L 50 19 L 14 19 Z"
              fill="rgba(255, 255, 255, 0.45)"
            />
            <line
              x1="14"
              y1={liquidTopY}
              x2="50"
              y2={liquidTopY}
              stroke="rgba(255, 255, 255, 0.85)"
              strokeWidth="1.5"
            />
          </g>
        ) : (
          <text
            x="32"
            y="105"
            textAnchor="middle"
            fill="#8b8273"
            fontSize="10"
            fontStyle="italic"
          >
            Empty
          </text>
        )}

        {/* 3. Calibration / Measurement Tick Marks */}
        <line x1="44" y1="58" x2="50" y2="58" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
        <line x1="41" y1="102" x2="50" y2="102" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" />
        <line x1="44" y1="146" x2="50" y2="146" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />

        {/* 4. Glass tube contour & rim */}
        <path
          d="M 14 14 L 14 172 A 18 18 0 0 0 50 172 L 50 14 Z"
          fill="none"
          stroke="#4d4233"
          strokeWidth="2.5"
        />

        {/* Beveled top flask mouth */}
        <rect
          x="11"
          y="10"
          width="42"
          height="4.5"
          rx="2"
          fill="#1c1814"
          stroke="#5a4e3c"
          strokeWidth="1.5"
        />

        {/* 5. Glass Specular Glare Highlights */}
        {/* Left main curved reflection highlight */}
        <path
          d="M 18 18 L 18 166 A 14 14 0 0 0 25 183"
          fill="none"
          stroke="rgba(255, 255, 255, 0.3)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        {/* Right subtle secondary highlight */}
        <path
          d="M 47 24 L 47 160"
          fill="none"
          stroke="rgba(255, 255, 255, 0.12)"
          strokeWidth="1"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
};

/* ── SUBCOMPONENTS FOR CLEAN TABLE ROWS ── */

interface OpponentRowProps {
  opp: DirectLaneOpponentStat;
  isLowSample: boolean;
  threshold?: number;
}

const OpponentRow: React.FC<OpponentRowProps> = ({ opp, isLowSample, threshold }) => {
  const laneScore = calculateLaneScore(opp.laneWins, opp.laneEvens, opp.laneLosses);
  const formattedScore = `${laneScore}`;

  return (
    <tr
      className={`transition-all duration-200 ${
        isLowSample
          ? 'opacity-40 blur-[1px] hover:blur-none hover:opacity-100 bg-deadlock-card/20 hover:bg-deadlock-card/60'
          : 'hover:bg-deadlock-card/50'
      }`}
      title={isLowSample ? `Low sample size (${opp.lanesFaced} < ${threshold ?? 3} matches) — hover to reveal` : undefined}
    >
      <td className="py-3 px-4">
        <div className="flex items-center gap-2.5">
          <HeroAvatar heroId={opp.opponentHeroId} size="xs" />
          <span className="font-bold text-deadlock-steam">{opp.opponentHero?.name}</span>
          {isLowSample && (
            <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-mono">
              Low Sample
            </span>
          )}
        </div>
      </td>
      <td className="py-3 px-4 font-mono text-deadlock-steam font-semibold">
        {opp.lanesFaced}
      </td>
      {/* Laning Phase Record: xW - xE - xL (with E in Yellow) */}
      <td className="py-3 px-4 font-mono">
        <div className="flex items-center gap-1.5 font-bold">
          <span className="text-deadlock-win">{opp.laneWins}W</span>
          <span className="text-deadlock-muted font-normal">-</span>
          <span className="text-yellow-400">{opp.laneEvens}E</span>
          <span className="text-deadlock-muted font-normal">-</span>
          <span className="text-deadlock-loss">{opp.laneLosses}L</span>
        </div>
      </td>
      {/* Lane Score Badge */}
      <td className="py-3 px-4 font-mono">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border cursor-help transition-all ${
            laneScore > 0
              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:border-emerald-500/60'
              : laneScore < 0
              ? 'bg-rose-500/15 text-rose-400 border-rose-500/30 hover:border-rose-500/60'
              : 'bg-slate-500/15 text-slate-300 border-slate-500/30 hover:border-slate-500/60'
          }`}
          title="Lane Score Rules: Win: +2 / Even: +1 / Loss: -2"
        >
          {formattedScore}
        </span>
      </td>
      <td className="py-3 px-4 font-mono text-right">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border ${
            opp.gameWinRate >= 50
              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
              : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
          }`}
        >
          {opp.gameWinRate}%
        </span>
        <span className="text-[11px] text-deadlock-muted ml-2 font-mono">
          ({opp.gameWins}W - {opp.gameLosses}L)
        </span>
      </td>
    </tr>
  );
};

interface AllyRowProps {
  ally: DirectLaneAllyStat;
  isLowSample: boolean;
  threshold?: number;
}

const AllyRow: React.FC<AllyRowProps> = ({ ally, isLowSample, threshold }) => {
  const laneScore = calculateLaneScore(ally.laneWins, ally.laneEvens, ally.laneLosses);
  const formattedScore = `${laneScore}`;

  return (
    <tr
      className={`transition-all duration-200 ${
        isLowSample
          ? 'opacity-40 blur-[1px] hover:blur-none hover:opacity-100 bg-deadlock-card/20 hover:bg-deadlock-card/60'
          : 'hover:bg-deadlock-card/50'
      }`}
      title={isLowSample ? `Low sample size (${ally.lanesTogether} < ${threshold ?? 3} matches) — hover to reveal` : undefined}
    >
      <td className="py-3 px-4">
        <div className="flex items-center gap-2.5">
          <HeroAvatar heroId={ally.allyHeroId} size="xs" />
          <span className="font-bold text-deadlock-steam">{ally.allyHero?.name}</span>
          {isLowSample && (
            <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-mono">
              Low Sample
            </span>
          )}
        </div>
      </td>
      <td className="py-3 px-4 font-mono text-deadlock-steam font-semibold">
        {ally.lanesTogether}
      </td>
      {/* Laning Phase Record: xW - xE - xL (with E in Yellow) */}
      <td className="py-3 px-4 font-mono">
        <div className="flex items-center gap-1.5 font-bold">
          <span className="text-deadlock-win">{ally.laneWins}W</span>
          <span className="text-deadlock-muted font-normal">-</span>
          <span className="text-yellow-400">{ally.laneEvens}E</span>
          <span className="text-deadlock-muted font-normal">-</span>
          <span className="text-deadlock-loss">{ally.laneLosses}L</span>
        </div>
      </td>
      {/* Lane Score Badge */}
      <td className="py-3 px-4 font-mono">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border cursor-help transition-all ${
            laneScore > 0
              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:border-emerald-500/60'
              : laneScore < 0
              ? 'bg-rose-500/15 text-rose-400 border-rose-500/30 hover:border-rose-500/60'
              : 'bg-slate-500/15 text-slate-300 border-slate-500/30 hover:border-slate-500/60'
          }`}
          title="Lane Score Rules: Win: +2 / Even: +1 / Loss: -2"
        >
          {formattedScore}
        </span>
      </td>
      <td className="py-3 px-4 font-mono text-right">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border ${
            ally.gameWinRate >= 50
              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
              : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
          }`}
        >
          {ally.gameWinRate}%
        </span>
        <span className="text-[11px] text-deadlock-muted ml-2 font-mono">
          ({ally.gameWins}W - {ally.gameLosses}L)
        </span>
      </td>
    </tr>
  );
};
