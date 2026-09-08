import React, { useState } from 'react';
import { Match } from '../types/match';
import { HeroAvatar } from './HeroAvatar';
import {
  calculateEnemyMatchups,
  EnemyMatchupStat,
} from '../services/analytics';
import { getHeroById } from '../data/heroes';
import {
  Swords,
  Skull,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Filter,
} from 'lucide-react';

interface EnemyMatchupsViewProps {
  matches: Match[];
}

type SortField = 'matches' | 'winRate' | 'wins';

export const EnemyMatchupsView: React.FC<EnemyMatchupsViewProps> = ({ matches }) => {
  const [selectedPlayerHeroId, setSelectedPlayerHeroId] = useState<number | null>(null);
  const [sortField, setSortField] = useState<SortField>('matches');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Find all distinct heroes piloted by the player
  const playedHeroIds = Array.from(new Set(matches.map((m) => m.myHeroId)));
  const playedHeroes = playedHeroIds
    .map((id) => getHeroById(id))
    .filter((h): h is NonNullable<typeof h> => h !== undefined);

  // Calculate matchups based on the selected hero or overall
  const matchups = calculateEnemyMatchups(matches, selectedPlayerHeroId);

  // Sort matchups
  const sortedMatchups = [...matchups].sort((a, b) => {
    let diff = 0;
    if (sortField === 'matches') diff = b.matchesAgainst - a.matchesAgainst;
    else if (sortField === 'winRate') diff = b.winRate - a.winRate;
    else if (sortField === 'wins') diff = b.wins - a.wins;
    return sortAsc ? -diff : diff;
  });

  // Calculate Nemeses (lowest winrate with at least 2 matches against, or at least 1)
  const qualifiedForHighlights = matchups.filter((m) => m.wins + m.losses >= 1);
  const nemeses = [...qualifiedForHighlights]
    .sort((a, b) => a.winRate - b.winRate || b.matchesAgainst - a.matchesAgainst)
    .slice(0, 3);

  // Favorable matchups (highest winrate)
  const favorable = [...qualifiedForHighlights]
    .sort((a, b) => b.winRate - a.winRate || b.matchesAgainst - a.matchesAgainst)
    .slice(0, 3);

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
              ? `Showing matchups specifically when you play ${selectedHeroObj.name}`
              : 'Showing matchups across all your played heroes'}
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

      {/* HIGHLIGHT CARDS: Nemeses vs Favorable Matchups */}
      {qualifiedForHighlights.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Nemeses Card */}
          <div className="bg-deadlock-panel border border-deadlock-loss/40 rounded-xl p-4 flex flex-col gap-3 relative overflow-hidden">
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
              {nemeses.map((nemesis) => (
                <div
                  key={nemesis.enemyHeroId}
                  className="bg-deadlock-dark/80 border border-deadlock-border/60 rounded-lg p-2.5 flex flex-col items-center text-center gap-1.5"
                >
                  <HeroAvatar heroId={nemesis.enemyHeroId} size="sm" />
                  <span className="font-bold text-xs text-gray-200 truncate max-w-full">
                    {nemesis.enemyHero?.name}
                  </span>
                  <div className="text-[11px] font-mono font-bold text-deadlock-loss">
                    {nemesis.winRate}% WR
                  </div>
                  <div className="text-[10px] text-deadlock-muted font-mono">
                    {nemesis.wins}W - {nemesis.losses}L
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Favorable Matchups Card */}
          <div className="bg-deadlock-panel border border-deadlock-win/40 rounded-xl p-4 flex flex-col gap-3 relative overflow-hidden">
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
              {favorable.map((fav) => (
                <div
                  key={fav.enemyHeroId}
                  className="bg-deadlock-dark/80 border border-deadlock-border/60 rounded-lg p-2.5 flex flex-col items-center text-center gap-1.5"
                >
                  <HeroAvatar heroId={fav.enemyHeroId} size="sm" />
                  <span className="font-bold text-xs text-gray-200 truncate max-w-full">
                    {fav.enemyHero?.name}
                  </span>
                  <div className="text-[11px] font-mono font-bold text-deadlock-win">
                    {fav.winRate}% WR
                  </div>
                  <div className="text-[10px] text-deadlock-muted font-mono">
                    {fav.wins}W - {fav.losses}L
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* FULL MATCHUP TABLE */}
      <div className="bg-deadlock-panel border border-deadlock-border/80 rounded-xl overflow-hidden flex flex-col">
        <div className="p-5 border-b border-deadlock-border/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Swords className="w-4 h-4 text-deadlock-muted" />
            <h3 className="text-sm font-bold tracking-wide uppercase text-gray-200">
              Enemy Hero Matchup Matrix ({sortedMatchups.length} Opponents Faced)
            </h3>
          </div>
          <span className="text-xs text-deadlock-muted">
            Click column headers to sort
          </span>
        </div>

        {sortedMatchups.length === 0 ? (
          <div className="p-8 text-center text-xs text-deadlock-muted">
            No enemy data recorded for this hero selection.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-deadlock-dark/60 text-deadlock-muted border-b border-deadlock-border/60">
                <tr>
                  <th className="py-3 px-4 font-semibold">Enemy Hero</th>
                  <th
                    onClick={() => handleSort('matches')}
                    className="py-3 px-4 font-semibold cursor-pointer hover:text-white transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <span>Matches Against</span>
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
                      <span>Your Record (W / L / C)</span>
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
                      <span>Your Win Rate</span>
                      {sortField === 'winRate' && (
                        sortAsc ? <ChevronUp className="w-3.5 h-3.5 text-deadlock-accent" /> : <ChevronDown className="w-3.5 h-3.5 text-deadlock-accent" />
                      )}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-deadlock-border/40">
                {sortedMatchups.map((m: EnemyMatchupStat) => {
                  const decided = m.wins + m.losses;
                  return (
                    <tr
                      key={m.enemyHeroId}
                      className="hover:bg-deadlock-dark/30 transition-colors"
                    >
                      {/* Enemy Hero info */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <HeroAvatar heroId={m.enemyHeroId} size="xs" />
                          <div>
                            <div className="font-bold text-gray-200 text-sm">
                              {m.enemyHero?.name || `Hero #${m.enemyHeroId}`}
                            </div>
                            <div className="text-[11px] text-deadlock-muted capitalize">
                              {m.enemyHero?.heroType || m.enemyHero?.role || 'Unknown'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Matches Against */}
                      <td className="py-3 px-4 font-mono font-medium text-gray-300">
                        {m.matchesAgainst}
                      </td>

                      {/* Record */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="text-deadlock-win font-bold font-mono">{m.wins}W</span>
                          <span className="text-deadlock-muted">-</span>
                          <span className="text-deadlock-loss font-bold font-mono">{m.losses}L</span>
                          {m.cancels > 0 && (
                            <span className="text-deadlock-muted font-mono">
                              - {m.cancels}C
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
                                m.winRate >= 50 ? 'bg-deadlock-win' : 'bg-deadlock-loss'
                              }`}
                              style={{ width: `${m.winRate}%` }}
                            />
                          </div>
                          <span
                            className={`font-mono font-bold text-sm ${
                              decided > 0
                                ? m.winRate >= 50
                                  ? 'text-deadlock-win'
                                  : 'text-deadlock-loss'
                                : 'text-deadlock-muted'
                            }`}
                          >
                            {decided > 0 ? `${m.winRate}%` : 'N/A'}
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
