import React, { useState, useMemo } from 'react';
import { Match } from '../../types/match';
import { HeroAvatar } from '../HeroAvatar';
import {
  getCachedEnemyMatchups,
  getCachedAllySynergies,
  EnemyMatchupStat,
  AllySynergyStat,
  getSampleThreshold,
} from '../../services/analytics';
import { getHeroById } from '../../data/heroes';
import {
  Swords,
  Users,
  Skull,
  ShieldCheck,
  Sparkles,
  HeartCrack,
  Search,
} from 'lucide-react';
import { HeroTable, HeroTableColumn } from '../template/HeroTable';
import { HeroFilter, SideFilterType } from '../HeroFilter';

interface HeroMatchupsAndSynergiesViewProps {
  matches: Match[];
}

type SortField = 'matches' | 'winRate' | 'wins';
type RelationMode = 'against' | 'with';

export const HeroMatchupsAndSynergiesView: React.FC<HeroMatchupsAndSynergiesViewProps> = ({ matches }) => {
  const [selectedPlayerHeroId, setSelectedPlayerHeroId] = useState<number | null>(null);
  const [relationMode, setRelationMode] = useState<RelationMode>('against');
  const [selectedSide, setSelectedSide] = useState<SideFilterType>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortField, setSortField] = useState<SortField>('matches');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Match counts per map side
  const sideCounts = useMemo(() => {
    let hiddenKing = 0;
    let archmother = 0;
    for (const m of matches) {
      if (m.side === 'hidden_king') hiddenKing++;
      else if (m.side === 'archmother') archmother++;
    }
    return { hiddenKing, archmother, total: hiddenKing + archmother };
  }, [matches]);

  // Filter matches based on selected side
  const filteredMatches = useMemo(() => {
    if (selectedSide === 'all') return matches;
    return matches.filter((m) => m.side === selectedSide);
  }, [matches, selectedSide]);

  const threshold = useMemo(() => getSampleThreshold(filteredMatches.length), [filteredMatches.length]);

  // Find all distinct heroes piloted by the player, sorted by matches descending
  const playedHeroes = useMemo(() => {
    const counts = new Map<number, number>();
    for (const m of filteredMatches) {
      if (m.myHeroId) {
        counts.set(m.myHeroId, (counts.get(m.myHeroId) || 0) + 1);
      }
    }
    const heroList = Array.from(counts.keys())
      .map((id) => getHeroById(id))
      .filter((h): h is NonNullable<typeof h> => h !== undefined);
    heroList.sort((a, b) => (counts.get(b.id) || 0) - (counts.get(a.id) || 0));
    return heroList.map((hero) => ({ hero, count: counts.get(hero.id) || 0 }));
  }, [filteredMatches]);

  // Calculate matchups against enemies
  const enemyMatchups = useMemo(() => {
    return getCachedEnemyMatchups(filteredMatches, selectedPlayerHeroId);
  }, [filteredMatches, selectedPlayerHeroId]);

  // Calculate synergies with allies
  const allySynergies = useMemo(() => {
    return getCachedAllySynergies(filteredMatches, selectedPlayerHeroId);
  }, [filteredMatches, selectedPlayerHeroId]);

  // Filtered & Sorted Enemy Matchups
  const sortedEnemyMatchups = useMemo(() => {
    let list = [...enemyMatchups];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((m) => m.enemyHero?.name.toLowerCase().includes(q));
    }
    return list.sort((a, b) => {
      let diff = 0;
      if (sortField === 'matches') diff = b.matchesAgainst - a.matchesAgainst;
      else if (sortField === 'winRate') diff = b.winRate - a.winRate;
      else if (sortField === 'wins') diff = b.wins - a.wins;
      return sortAsc ? -diff : diff;
    });
  }, [enemyMatchups, searchQuery, sortField, sortAsc]);

  // Filtered & Sorted Ally Synergies
  const sortedAllySynergies = useMemo(() => {
    let list = [...allySynergies];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((s) => s.allyHero?.name.toLowerCase().includes(q));
    }
    return list.sort((a, b) => {
      let diff = 0;
      if (sortField === 'matches') diff = b.matchesWith - a.matchesWith;
      else if (sortField === 'winRate') diff = b.winRate - a.winRate;
      else if (sortField === 'wins') diff = b.wins - a.wins;
      return sortAsc ? -diff : diff;
    });
  }, [allySynergies, searchQuery, sortField, sortAsc]);

  // Enemy Highlights (Nemeses & Favorable)
  const enemyQualified = useMemo(() => {
    const repMatchups = enemyMatchups.filter((m) => m.matchesAgainst >= threshold);
    if (repMatchups.length >= 2) return repMatchups;
    return enemyMatchups.filter((m) => m.wins + m.losses >= 1);
  }, [enemyMatchups, threshold]);

  const nemeses = useMemo(() => {
    return [...enemyQualified]
      .sort((a, b) => a.winRate - b.winRate || b.matchesAgainst - a.matchesAgainst)
      .slice(0, 3);
  }, [enemyQualified]);

  const favorable = useMemo(() => {
    return [...enemyQualified]
      .sort((a, b) => b.winRate - a.winRate || b.matchesAgainst - a.matchesAgainst)
      .slice(0, 3);
  }, [enemyQualified]);

  // Ally Highlights (Best Synergies & Anti-Synergies)
  const allyQualified = useMemo(() => {
    const repSynergies = allySynergies.filter((s) => s.matchesWith >= threshold);
    if (repSynergies.length >= 2) return repSynergies;
    return allySynergies.filter((s) => s.wins + s.losses >= 1);
  }, [allySynergies, threshold]);

  const bestSynergies = useMemo(() => {
    return [...allyQualified]
      .sort((a, b) => b.winRate - a.winRate || b.matchesWith - a.matchesWith)
      .slice(0, 3);
  }, [allyQualified]);

  const antiSynergies = useMemo(() => {
    return [...allyQualified]
      .sort((a, b) => a.winRate - b.winRate || b.matchesWith - a.matchesWith)
      .slice(0, 3);
  }, [allyQualified]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  // Column definitions for Enemy Hero Matchups
  const enemyColumns: HeroTableColumn<EnemyMatchupStat>[] = useMemo(
    () => [
      {
        key: 'hero',
        header: 'Hero',
        render: (matchup) => (
          <div className="flex items-center gap-3">
            <HeroAvatar heroId={matchup.enemyHeroId} size="xs" />
            <div>
              <div className="font-bold text-deadlock-steam text-sm">
                {matchup.enemyHero?.name || `Hero #${matchup.enemyHeroId}`}
              </div>
              <div className="text-[11px] text-deadlock-muted capitalize">
                {matchup.enemyHero?.heroType || matchup.enemyHero?.role || 'Unknown'}
              </div>
            </div>
          </div>
        ),
      },
      {
        key: 'matches',
        header: 'Matches Against',
        sortField: 'matches',
        render: (matchup) => (
          <span className="font-mono font-medium text-deadlock-steam">
            {matchup.matchesAgainst}
          </span>
        ),
      },
      {
        key: 'wins',
        header: 'Record (W / L / C)',
        sortField: 'wins',
        render: (matchup) => (
          <div className="flex items-center gap-2 font-mono">
            <span className="text-deadlock-win font-bold">{matchup.wins}W</span>
            <span className="text-deadlock-muted">-</span>
            <span className="text-deadlock-loss font-bold">{matchup.losses}L</span>
            {matchup.cancels > 0 && (
              <span className="text-deadlock-muted">- {matchup.cancels}C</span>
            )}
          </div>
        ),
      },
      {
        key: 'winRate',
        header: 'Win Rate',
        sortField: 'winRate',
        align: 'right',
        render: (matchup) => {
          const decided = matchup.wins + matchup.losses;
          return (
            <div className="flex items-center justify-end gap-3">
              <div className="w-24 bg-deadlock-dark rounded-full h-1.5 overflow-hidden border border-deadlock-border/60 hidden sm:block">
                <div
                  className={`h-full ${matchup.winRate >= 50 ? 'bg-deadlock-win' : 'bg-deadlock-loss'}`}
                  style={{ width: `${matchup.winRate}%` }}
                />
              </div>
              <span
                className={`font-mono font-bold text-sm ${
                  decided > 0
                    ? matchup.winRate >= 50
                      ? 'text-deadlock-win'
                      : 'text-deadlock-loss'
                    : 'text-deadlock-muted'
                }`}
              >
                {decided > 0 ? `${matchup.winRate}%` : 'N/A'}
              </span>
            </div>
          );
        },
      },
    ],
    []
  );

  // Column definitions for Ally Hero Synergies
  const allyColumns: HeroTableColumn<AllySynergyStat>[] = useMemo(
    () => [
      {
        key: 'hero',
        header: 'Hero',
        render: (synergy) => (
          <div className="flex items-center gap-3">
            <HeroAvatar heroId={synergy.allyHeroId} size="xs" />
            <div>
              <div className="font-bold text-deadlock-steam text-sm">
                {synergy.allyHero?.name || `Hero #${synergy.allyHeroId}`}
              </div>
              <div className="text-[11px] text-deadlock-muted capitalize">
                {synergy.allyHero?.heroType || synergy.allyHero?.role || 'Unknown'}
              </div>
            </div>
          </div>
        ),
      },
      {
        key: 'matches',
        header: 'Matches With',
        sortField: 'matches',
        render: (synergy) => (
          <span className="font-mono font-medium text-deadlock-steam">
            {synergy.matchesWith}
          </span>
        ),
      },
      {
        key: 'wins',
        header: 'Record (W / L / C)',
        sortField: 'wins',
        render: (synergy) => (
          <div className="flex items-center gap-2 font-mono">
            <span className="text-deadlock-win font-bold">{synergy.wins}W</span>
            <span className="text-deadlock-muted">-</span>
            <span className="text-deadlock-loss font-bold">{synergy.losses}L</span>
            {synergy.cancels > 0 && (
              <span className="text-deadlock-muted">- {synergy.cancels}C</span>
            )}
          </div>
        ),
      },
      {
        key: 'winRate',
        header: 'Win Rate',
        sortField: 'winRate',
        align: 'right',
        render: (synergy) => {
          const decided = synergy.wins + synergy.losses;
          return (
            <div className="flex items-center justify-end gap-3">
              <div className="w-24 bg-deadlock-dark rounded-full h-1.5 overflow-hidden border border-deadlock-border/60 hidden sm:block">
                <div
                  className={`h-full ${synergy.winRate >= 50 ? 'bg-deadlock-win' : 'bg-deadlock-loss'}`}
                  style={{ width: `${synergy.winRate}%` }}
                />
              </div>
              <span
                className={`font-mono font-bold text-sm ${
                  decided > 0
                    ? synergy.winRate >= 50
                      ? 'text-deadlock-win'
                      : 'text-deadlock-loss'
                    : 'text-deadlock-muted'
                }`}
              >
                {decided > 0 ? `${synergy.winRate}%` : 'N/A'}
              </span>
            </div>
          );
        },
      },
    ],
    []
  );

  return (
    <div className="flex flex-col gap-6">
      {/* 1. SHARED FILTER HEADER: Hero, Against/With Mode, and Map Side */}
      <HeroFilter<RelationMode>
        playedHeroes={playedHeroes}
        selectedPlayerHeroId={selectedPlayerHeroId}
        onSelectHeroId={setSelectedPlayerHeroId}
        totalTrackedMatches={filteredMatches.length}
        title="Filter by Your Hero:"
        subtitle={(hero) =>
          hero
            ? `Analyzing performance specifically when you pilot ${hero.name}`
            : 'Analyzing performance across all your played heroes'
        }
        matchupTab={relationMode}
        onTabChange={setRelationMode}
        tabOptions={[
          {
            id: 'against',
            label: 'How I Perform Against (Enemies)',
            icon: <Swords className="w-3.5 h-3.5 text-red-400" />,
            count: enemyMatchups.length,
            activeClass: 'bg-red-500/20 text-red-300 border-red-500/40 shadow-sm',
          },
          {
            id: 'with',
            label: 'How I Perform With (Allies)',
            icon: <Users className="w-3.5 h-3.5 text-emerald-400" />,
            count: allySynergies.length,
            activeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm',
          },
        ]}
        selectedSide={selectedSide}
        onSideChange={setSelectedSide}
        sideCounts={sideCounts}
      />

      {/* 3. HIGHLIGHT CARDS: Mode-specific */}
      {relationMode === 'against' && enemyQualified.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Nemeses Card */}
          <div className="steam-glass steam-panel border border-deadlock-loss/40 rounded-xl p-4 flex flex-col gap-3 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-deadlock-loss/5 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skull className="w-4 h-4 text-deadlock-loss" />
                <h3 className="font-bold text-sm text-red-300 uppercase tracking-wide">
                  Top Nemeses (Hardest Opponents)
                </h3>
              </div>
              <span className="text-[11px] text-deadlock-muted">Lowest Winrate</span>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-1">
              {nemeses.map((nemesis) => {
                const isRep = nemesis.matchesAgainst >= threshold;
                return (
                  <div
                    key={nemesis.enemyHeroId}
                    className={`bg-deadlock-card/80 border border-deadlock-border/60 rounded-lg p-2.5 flex flex-col items-center text-center gap-1.5 transition-all duration-200 ${
                      !isRep ? 'opacity-40 blur-[1px] hover:blur-none hover:opacity-100' : ''
                    }`}
                    title={!isRep ? `Low sample (< ${threshold} matches)` : undefined}
                  >
                    <HeroAvatar heroId={nemesis.enemyHeroId} size="sm" />
                    <span className="font-bold text-xs text-deadlock-steam truncate max-w-full">
                      {nemesis.enemyHero?.name}
                    </span>
                    <div className="text-[11px] font-mono font-bold text-deadlock-loss">
                      {nemesis.winRate}% WR
                    </div>
                    <div className="text-[10px] text-deadlock-muted font-mono">
                      {nemesis.wins}W - {nemesis.losses}L
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Favorable Matchups Card */}
          <div className="steam-glass steam-panel border border-deadlock-win/40 rounded-xl p-4 flex flex-col gap-3 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-deadlock-win/5 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-deadlock-win" />
                <h3 className="font-bold text-sm text-green-300 uppercase tracking-wide">
                  Favorable Matchups (Best Records)
                </h3>
              </div>
              <span className="text-[11px] text-deadlock-muted">Highest Winrate</span>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-1">
              {favorable.map((fav) => {
                const isRep = fav.matchesAgainst >= threshold;
                return (
                  <div
                    key={fav.enemyHeroId}
                    className={`bg-deadlock-card/80 border border-deadlock-border/60 rounded-lg p-2.5 flex flex-col items-center text-center gap-1.5 transition-all duration-200 ${
                      !isRep ? 'opacity-40 blur-[1px] hover:blur-none hover:opacity-100' : ''
                    }`}
                    title={!isRep ? `Low sample (< ${threshold} matches)` : undefined}
                  >
                    <HeroAvatar heroId={fav.enemyHeroId} size="sm" />
                    <span className="font-bold text-xs text-deadlock-steam truncate max-w-full">
                      {fav.enemyHero?.name}
                    </span>
                    <div className="text-[11px] font-mono font-bold text-deadlock-win">
                      {fav.winRate}% WR
                    </div>
                    <div className="text-[10px] text-deadlock-muted font-mono">
                      {fav.wins}W - {fav.losses}L
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {relationMode === 'with' && allyQualified.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Best Synergies Card */}
          <div className="steam-glass steam-panel border border-deadlock-win/40 rounded-xl p-4 flex flex-col gap-3 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-deadlock-win/5 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-deadlock-win" />
                <h3 className="font-bold text-sm text-green-300 uppercase tracking-wide">
                  Best Synergies (Top Teammates)
                </h3>
              </div>
              <span className="text-[11px] text-deadlock-muted">Highest Winrate</span>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-1">
              {bestSynergies.map((syn) => {
                const isRep = syn.matchesWith >= threshold;
                return (
                  <div
                    key={syn.allyHeroId}
                    className={`bg-deadlock-card/80 border border-deadlock-border/60 rounded-lg p-2.5 flex flex-col items-center text-center gap-1.5 transition-all duration-200 ${
                      !isRep ? 'opacity-40 blur-[1px] hover:blur-none hover:opacity-100' : ''
                    }`}
                    title={!isRep ? `Low sample (< ${threshold} matches)` : undefined}
                  >
                    <HeroAvatar heroId={syn.allyHeroId} size="sm" />
                    <span className="font-bold text-xs text-deadlock-steam truncate max-w-full">
                      {syn.allyHero?.name}
                    </span>
                    <div className="text-[11px] font-mono font-bold text-deadlock-win">
                      {syn.winRate}% WR
                    </div>
                    <div className="text-[10px] text-deadlock-muted font-mono">
                      {syn.wins}W - {syn.losses}L
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Anti-Synergies Card */}
          <div className="steam-glass steam-panel border border-amber-500/40 rounded-xl p-4 flex flex-col gap-3 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HeartCrack className="w-4 h-4 text-amber-400" />
                <h3 className="font-bold text-sm text-amber-300 uppercase tracking-wide">
                  Anti-Synergies (Toughest Teammates)
                </h3>
              </div>
              <span className="text-[11px] text-deadlock-muted">Lowest Winrate</span>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-1">
              {antiSynergies.map((syn) => {
                const isRep = syn.matchesWith >= threshold;
                return (
                  <div
                    key={syn.allyHeroId}
                    className={`bg-deadlock-card/80 border border-deadlock-border/60 rounded-lg p-2.5 flex flex-col items-center text-center gap-1.5 transition-all duration-200 ${
                      !isRep ? 'opacity-40 blur-[1px] hover:blur-none hover:opacity-100' : ''
                    }`}
                    title={!isRep ? `Low sample (< ${threshold} matches)` : undefined}
                  >
                    <HeroAvatar heroId={syn.allyHeroId} size="sm" />
                    <span className="font-bold text-xs text-deadlock-steam truncate max-w-full">
                      {syn.allyHero?.name}
                    </span>
                    <div className="text-[11px] font-mono font-bold text-amber-400">
                      {syn.winRate}% WR
                    </div>
                    <div className="text-[10px] text-deadlock-muted font-mono">
                      {syn.wins}W - {syn.losses}L
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 4. DETAILED BREAKDOWN TABLE */}
      {relationMode === 'against' ? (
        <HeroTable<EnemyMatchupStat>
          data={sortedEnemyMatchups}
          isLowSample={(matchup) => matchup.matchesAgainst < threshold}
          threshold={threshold}
          columns={enemyColumns}
          getRowKey={(matchup) => matchup.enemyHeroId}
          sortField={sortField}
          sortAsc={sortAsc}
          onSort={(field) => handleSort(field as SortField)}
          headerContent={
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Swords className="w-4 h-4 text-red-400" />
                <h3 className="text-sm font-bold tracking-wide uppercase text-deadlock-steam">
                  Enemy Hero Matchup Matrix ({sortedEnemyMatchups.length} Opponents Faced)
                </h3>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-deadlock-muted hidden sm:inline">Click column headers to sort</span>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-deadlock-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search enemy hero..."
                    className="bg-deadlock-dark border border-deadlock-border text-xs rounded-lg pl-8 pr-3 py-1.5 text-deadlock-steam focus:outline-none focus:border-deadlock-accent w-40 sm:w-48 transition-all"
                  />
                </div>
              </div>
            </div>
          }
          emptyMessage={`No matching hero entries found for "${searchQuery}".`}
        />
      ) : (
        <HeroTable<AllySynergyStat>
          data={sortedAllySynergies}
          isLowSample={(synergy) => synergy.matchesWith < threshold}
          threshold={threshold}
          columns={allyColumns}
          getRowKey={(synergy) => synergy.allyHeroId}
          sortField={sortField}
          sortAsc={sortAsc}
          onSort={(field) => handleSort(field as SortField)}
          headerContent={
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold tracking-wide uppercase text-deadlock-steam">
                  Ally Hero Synergy Matrix ({sortedAllySynergies.length} Teammates Recorded)
                </h3>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-deadlock-muted hidden sm:inline">Click column headers to sort</span>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-deadlock-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search ally hero..."
                    className="bg-deadlock-dark border border-deadlock-border text-xs rounded-lg pl-8 pr-3 py-1.5 text-deadlock-steam focus:outline-none focus:border-deadlock-accent w-40 sm:w-48 transition-all"
                  />
                </div>
              </div>
            </div>
          }
          emptyMessage={`No matching hero entries found for "${searchQuery}".`}
        />
      )}
    </div>
  );
};
