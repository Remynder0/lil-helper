import React, { useState, useMemo } from 'react';
import { Match } from '../types/match';
import { HeroAvatar } from './HeroAvatar';
import {
  calculateEnemyMatchups,
  calculateAllySynergies,
  EnemyMatchupStat,
  AllySynergyStat,
  getSampleThreshold,
} from '../services/analytics';
import { getHeroById } from '../data/heroes';
import {
  Swords,
  Users,
  Skull,
  ShieldCheck,
  Sparkles,
  HeartCrack,
  ChevronDown,
  ChevronUp,
  Filter,
  Search,
} from 'lucide-react';

interface HeroMatchupsAndSynergiesViewProps {
  matches: Match[];
}

type SortField = 'matches' | 'winRate' | 'wins';
type RelationMode = 'against' | 'with';

export const HeroMatchupsAndSynergiesView: React.FC<HeroMatchupsAndSynergiesViewProps> = ({ matches }) => {
  const [selectedPlayerHeroId, setSelectedPlayerHeroId] = useState<number | null>(null);
  const [relationMode, setRelationMode] = useState<RelationMode>('against');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortField, setSortField] = useState<SortField>('matches');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  const threshold = useMemo(() => getSampleThreshold(matches.length), [matches.length]);


  // Find all distinct heroes piloted by the player
  const playedHeroes = useMemo(() => {
    const playedHeroIds = Array.from(new Set(matches.map((m) => m.myHeroId)));
    return playedHeroIds
      .map((id) => getHeroById(id))
      .filter((h): h is NonNullable<typeof h> => h !== undefined);
  }, [matches]);

  // Calculate matchups against enemies
  const enemyMatchups = useMemo(() => {
    return calculateEnemyMatchups(matches, selectedPlayerHeroId);
  }, [matches, selectedPlayerHeroId]);

  // Calculate synergies with allies
  const allySynergies = useMemo(() => {
    return calculateAllySynergies(matches, selectedPlayerHeroId);
  }, [matches, selectedPlayerHeroId]);

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

  const selectedHeroObj = selectedPlayerHeroId ? getHeroById(selectedPlayerHeroId) : null;

  return (
    <div className="flex flex-col gap-6">
      {/* 1. SHARED FILTER HEADER: Choose "All My Heroes" or a specific hero */}
      <div className="steam-glass steam-panel rounded-xl p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-deadlock-accent" />
            <span className="text-xs font-bold uppercase tracking-wider text-deadlock-steam">
              Filter by Your Hero:
            </span>
          </div>
          <span className="text-xs text-deadlock-muted">
            {selectedHeroObj
              ? `Analyzing performance specifically when you pilot ${selectedHeroObj.name}`
              : 'Analyzing performance across all your played heroes'}
          </span>
        </div>

        {/* Hero Selector Pills */}
        <div className="flex items-center gap-2 flex-wrap pt-1">
          <button
            type="button"
            onClick={() => setSelectedPlayerHeroId(null)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              selectedPlayerHeroId === null
                ? 'bg-deadlock-accent/20 border-deadlock-accent text-deadlock-steam shadow-sm'
                : 'bg-deadlock-dark border-deadlock-border text-deadlock-muted hover:text-deadlock-steam hover:border-white/30'
            }`}
          >
            All Heroes ({matches.length} matches)
          </button>

          {playedHeroes.map((hero) => {
            const isSelected = selectedPlayerHeroId === hero.id;
            const heroMatchCount = matches.filter((m) => m.myHeroId === hero.id).length;
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
                <span className="text-[10px] opacity-70 font-mono">({heroMatchCount})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. SEGMENTED MODE SWITCH: AGAINST (ENEMIES) vs WITH (ALLIES) */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center bg-deadlock-panel/90 p-1 rounded-xl border border-deadlock-border/80 shadow-md">
          <button
            type="button"
            onClick={() => setRelationMode('against')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs transition-all ${
              relationMode === 'against'
                ? 'bg-red-500/20 text-red-300 border border-red-500/40 shadow-sm'
                : 'text-deadlock-muted hover:text-deadlock-steam'
            }`}
          >
            <Swords className="w-4 h-4 text-red-400" />
            <span>How I Perform Against (Enemies)</span>
            <span className="ml-1 text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-deadlock-card/80 border border-deadlock-border/60">
              {enemyMatchups.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setRelationMode('with')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs transition-all ${
              relationMode === 'with'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-deadlock-muted hover:text-deadlock-steam'
            }`}
          >
            <Users className="w-4 h-4 text-emerald-400" />
            <span>How I Perform With (Allies)</span>
            <span className="ml-1 text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-deadlock-card/80 border border-deadlock-border/60">
              {allySynergies.length}
            </span>
          </button>
        </div>

        {/* Search filter for matrix */}
        <div className="relative min-w-[220px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-deadlock-muted pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={relationMode === 'against' ? 'Search enemy hero...' : 'Search ally hero...'}
            className="w-full bg-deadlock-panel/80 border border-deadlock-border/80 rounded-lg pl-8 pr-7 py-2 text-xs text-deadlock-steam placeholder-deadlock-muted/60 focus:outline-none focus:border-deadlock-accent/60 transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-deadlock-muted hover:text-deadlock-steam text-xs"
            >
              ✕
            </button>
          )}
        </div>
      </div>

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
      <div className="steam-glass steam-panel rounded-xl overflow-hidden flex flex-col">
        <div className="p-5 border-b border-deadlock-border/80 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            {relationMode === 'against' ? (
              <Swords className="w-4 h-4 text-red-400" />
            ) : (
              <Users className="w-4 h-4 text-emerald-400" />
            )}
            <h3 className="text-sm font-bold tracking-wide uppercase text-deadlock-steam">
              {relationMode === 'against'
                ? `Enemy Hero Matchup Matrix (${sortedEnemyMatchups.length} Opponents Faced)`
                : `Ally Hero Synergy Matrix (${sortedAllySynergies.length} Teammates Recorded)`}
            </h3>
          </div>
          <span className="text-xs text-deadlock-muted">Click column headers to sort</span>
        </div>

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
                    <span>{relationMode === 'against' ? 'Matches Against' : 'Matches With'}</span>
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
              {relationMode === 'against'
                ? sortedEnemyMatchups.map((matchup: EnemyMatchupStat) => {
                    const decided = matchup.wins + matchup.losses;
                    const isRep = matchup.matchesAgainst >= threshold;
                    return (
                      <tr
                        key={matchup.enemyHeroId}
                        className={`transition-all duration-200 ${
                          !isRep
                            ? 'opacity-40 blur-[1px] hover:blur-none hover:opacity-100'
                            : 'hover:bg-deadlock-card/40'
                        }`}
                        title={!isRep ? `Low sample (< ${threshold} matches)` : undefined}
                      >
                        <td className="py-3 px-4">
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
                        </td>
                        <td className="py-3 px-4 font-mono font-medium text-deadlock-steam">
                          {matchup.matchesAgainst}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2 font-mono">
                            <span className="text-deadlock-win font-bold">{matchup.wins}W</span>
                            <span className="text-deadlock-muted">-</span>
                            <span className="text-deadlock-loss font-bold">{matchup.losses}L</span>
                            {matchup.cancels > 0 && (
                              <span className="text-deadlock-muted">- {matchup.cancels}C</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
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
                        </td>
                      </tr>
                    );
                  })
                : sortedAllySynergies.map((synergy: AllySynergyStat) => {
                    const decided = synergy.wins + synergy.losses;
                    const isRep = synergy.matchesWith >= threshold;
                    return (
                      <tr
                        key={synergy.allyHeroId}
                        className={`transition-all duration-200 ${
                          !isRep
                            ? 'opacity-40 blur-[1px] hover:blur-none hover:opacity-100'
                            : 'hover:bg-deadlock-card/40'
                        }`}
                        title={!isRep ? `Low sample (< ${threshold} matches)` : undefined}
                      >
                        <td className="py-3 px-4">
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
                        </td>
                        <td className="py-3 px-4 font-mono font-medium text-deadlock-steam">
                          {synergy.matchesWith}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2 font-mono">
                            <span className="text-deadlock-win font-bold">{synergy.wins}W</span>
                            <span className="text-deadlock-muted">-</span>
                            <span className="text-deadlock-loss font-bold">{synergy.losses}L</span>
                            {synergy.cancels > 0 && (
                              <span className="text-deadlock-muted">- {synergy.cancels}C</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
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
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>

          {((relationMode === 'against' && sortedEnemyMatchups.length === 0) ||
            (relationMode === 'with' && sortedAllySynergies.length === 0)) && (
            <div className="text-center py-10 text-xs text-deadlock-muted">
              No matching hero entries found for "{searchQuery}".
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
