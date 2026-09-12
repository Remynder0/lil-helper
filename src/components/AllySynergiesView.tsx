import React, { useState, useMemo } from 'react';
import { Match } from '../types/match';
import { HeroAvatar } from './HeroAvatar';
import {
  calculateAllySynergies,
  AllySynergyStat,
} from '../services/analytics';
import { getHeroById } from '../data/heroes';
import {
  Users,
  Sparkles,
  HeartCrack,
  ChevronDown,
  ChevronUp,
  Filter,
} from 'lucide-react';

interface AllySynergiesViewProps {
  matches: Match[];
}

type SortField = 'matches' | 'winRate' | 'wins';

export const AllySynergiesView: React.FC<AllySynergiesViewProps> = ({ matches }) => {
  const [selectedPlayerHeroId, setSelectedPlayerHeroId] = useState<number | null>(null);
  const [sortField, setSortField] = useState<SortField>('matches');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Find all distinct heroes piloted by the player
  const playedHeroes = useMemo(() => {
    const playedHeroIds = Array.from(new Set(matches.map((m) => m.myHeroId)));
    return playedHeroIds
      .map((id) => getHeroById(id))
      .filter((h): h is NonNullable<typeof h> => h !== undefined);
  }, [matches]);

  // Calculate synergies based on the selected hero or overall
  const synergies = useMemo(() => {
    return calculateAllySynergies(matches, selectedPlayerHeroId);
  }, [matches, selectedPlayerHeroId]);

  // Sort synergies
  const sortedSynergies = useMemo(() => {
    return [...synergies].sort((a, b) => {
      let diff = 0;
      if (sortField === 'matches') diff = b.matchesWith - a.matchesWith;
      else if (sortField === 'winRate') diff = b.winRate - a.winRate;
      else if (sortField === 'wins') diff = b.wins - a.wins;
      return sortAsc ? -diff : diff;
    });
  }, [synergies, sortField, sortAsc]);

  // Calculate Highlights (at least 1 match played together)
  const qualifiedForHighlights = useMemo(() => {
    return synergies.filter((s) => s.wins + s.losses >= 1);
  }, [synergies]);

  const bestSynergies = useMemo(() => {
    return [...qualifiedForHighlights]
      .sort((a, b) => b.winRate - a.winRate || b.matchesWith - a.matchesWith)
      .slice(0, 3);
  }, [qualifiedForHighlights]);

  // Calculate Anti-Synergies (worst teammates)
  const antiSynergies = useMemo(() => {
    return [...qualifiedForHighlights]
      .sort((a, b) => a.winRate - b.winRate || b.matchesWith - a.matchesWith)
      .slice(0, 3);
  }, [qualifiedForHighlights]);

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
      {/* FILTER HEADER: Choose "All My Heroes" or a specific hero piloted */}
      <div className="bg-deadlock-panel border border-deadlock-border/80 rounded-xl p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-deadlock-accent" />
            <span className="text-xs font-bold uppercase tracking-wider text-gray-200">
              Filter by Your Hero:
            </span>
          </div>
          <span className="text-xs text-deadlock-muted">
            {selectedHeroObj
              ? `Showing synergies specifically when you play ${selectedHeroObj.name}`
              : 'Showing synergies across all your played heroes'}
          </span>
        </div>

        {/* Hero Selector Buttons */}
        <div className="flex items-center gap-2 flex-wrap pt-1">
          <button
            type="button"
            onClick={() => setSelectedPlayerHeroId(null)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              selectedPlayerHeroId === null
                ? 'bg-deadlock-accent/20 border-deadlock-accent text-white shadow-sm'
                : 'bg-deadlock-dark border-deadlock-border text-deadlock-muted hover:text-white hover:border-white/30'
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
                    ? 'bg-deadlock-border border-white text-white shadow-md ring-1 ring-white/40'
                    : 'bg-deadlock-dark border-deadlock-border text-deadlock-muted hover:text-white hover:border-white/30'
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

      {/* HIGHLIGHT CARDS: Best Synergies vs Anti-Synergies */}
      {qualifiedForHighlights.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Best Synergies Card */}
          <div className="bg-deadlock-panel border border-deadlock-win/40 rounded-xl p-4 flex flex-col gap-3 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-deadlock-win/5 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-deadlock-win" />
                <h3 className="font-bold text-sm text-green-300 uppercase tracking-wide">
                  Top Synergies (Best Teammates)
                </h3>
              </div>
              <span className="text-[11px] text-deadlock-muted">Highest Winrate</span>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-1">
              {bestSynergies.map((syn) => (
                <div
                  key={syn.allyHeroId}
                  className="bg-deadlock-dark/80 border border-deadlock-border/60 rounded-lg p-2.5 flex flex-col items-center text-center gap-1.5"
                >
                  <HeroAvatar heroId={syn.allyHeroId} size="sm" />
                  <span className="font-bold text-xs text-gray-200 truncate max-w-full">
                    {syn.allyHero?.name}
                  </span>
                  <div className="text-[11px] font-mono font-bold text-deadlock-win">
                    {syn.winRate}% WR
                  </div>
                  <div className="text-[10px] text-deadlock-muted font-mono">
                    {syn.wins}W - {syn.losses}L
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Anti-Synergies Card */}
          <div className="bg-deadlock-panel border border-amber-500/40 rounded-xl p-4 flex flex-col gap-3 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HeartCrack className="w-4 h-4 text-amber-400" />
                <h3 className="font-bold text-sm text-amber-300 uppercase tracking-wide">
                  Anti-Synergies (Lowest Success)
                </h3>
              </div>
              <span className="text-[11px] text-deadlock-muted">Lowest Winrate</span>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-1">
              {antiSynergies.map((anti) => (
                <div
                  key={anti.allyHeroId}
                  className="bg-deadlock-dark/80 border border-deadlock-border/60 rounded-lg p-2.5 flex flex-col items-center text-center gap-1.5"
                >
                  <HeroAvatar heroId={anti.allyHeroId} size="sm" />
                  <span className="font-bold text-xs text-gray-200 truncate max-w-full">
                    {anti.allyHero?.name}
                  </span>
                  <div className="text-[11px] font-mono font-bold text-amber-400">
                    {anti.winRate}% WR
                  </div>
                  <div className="text-[10px] text-deadlock-muted font-mono">
                    {anti.wins}W - {anti.losses}L
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* FULL ALLY SYNERGY TABLE */}
      <div className="bg-deadlock-panel border border-deadlock-border/80 rounded-xl overflow-hidden flex flex-col">
        <div className="p-5 border-b border-deadlock-border/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-deadlock-muted" />
            <h3 className="text-sm font-bold tracking-wide uppercase text-gray-200">
              Ally Synergy Matrix ({sortedSynergies.length} Allies Played With)
            </h3>
          </div>
          <span className="text-xs text-deadlock-muted">
            Click column headers to sort
          </span>
        </div>

        {sortedSynergies.length === 0 ? (
          <div className="p-8 text-center text-xs text-deadlock-muted">
            No ally data recorded for this hero selection.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-deadlock-dark/60 text-deadlock-muted border-b border-deadlock-border/60">
                <tr>
                  <th className="py-3 px-4 font-semibold">Ally Hero</th>
                  <th
                    onClick={() => handleSort('matches')}
                    className="py-3 px-4 font-semibold cursor-pointer hover:text-white transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <span>Matches Together</span>
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
                      <span>Record Together (W / L / C)</span>
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
                      <span>Win Rate Together</span>
                      {sortField === 'winRate' && (
                        sortAsc ? <ChevronUp className="w-3.5 h-3.5 text-deadlock-accent" /> : <ChevronDown className="w-3.5 h-3.5 text-deadlock-accent" />
                      )}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-deadlock-border/40">
                {sortedSynergies.map((s: AllySynergyStat) => {
                  const decided = s.wins + s.losses;
                  return (
                    <tr
                      key={s.allyHeroId}
                      className="hover:bg-deadlock-dark/30 transition-colors"
                    >
                      {/* Ally Hero info */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <HeroAvatar heroId={s.allyHeroId} size="xs" />
                          <div>
                            <div className="font-bold text-gray-200 text-sm">
                              {s.allyHero?.name || `Hero #${s.allyHeroId}`}
                            </div>
                            <div className="text-[11px] text-deadlock-muted capitalize">
                              {s.allyHero?.heroType || s.allyHero?.role || 'Unknown'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Matches Together */}
                      <td className="py-3 px-4 font-mono font-medium text-gray-300">
                        {s.matchesWith}
                      </td>

                      {/* Record */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="text-deadlock-win font-bold font-mono">{s.wins}W</span>
                          <span className="text-deadlock-muted">-</span>
                          <span className="text-deadlock-loss font-bold font-mono">{s.losses}L</span>
                          {s.cancels > 0 && (
                            <span className="text-deadlock-muted font-mono">
                              - {s.cancels}C
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Win Rate */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <div className="w-24 bg-deadlock-dark rounded-full h-1.5 overflow-hidden border border-deadlock-border/60 hidden sm:block">
                            <div
                              className={`h-full ${
                                s.winRate >= 50 ? 'bg-deadlock-win' : 'bg-deadlock-loss'
                              }`}
                              style={{ width: `${s.winRate}%` }}
                            />
                          </div>
                          <span
                            className={`font-mono font-bold text-sm ${
                              decided > 0
                                ? s.winRate >= 50
                                  ? 'text-deadlock-win'
                                  : 'text-deadlock-loss'
                                : 'text-deadlock-muted'
                            }`}
                          >
                            {decided > 0 ? `${s.winRate}%` : 'N/A'}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
