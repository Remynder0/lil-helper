import React, { useState, useMemo } from 'react';
import { HeroAvatar } from './HeroAvatar';
import { getHeroById } from '../data/heroes';
import { Match, Side, MatchResult, SIDE_LABELS, RESULT_LABELS, LANE_LABELS, LANE_OUTCOME_LABELS } from '../types/match';
import {
  Trophy,
  Skull,
  Ban,
  Trash2,
  Pencil,
  Filter,
  Calendar,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Swords,
} from 'lucide-react';

interface HistoryListProps {
  matches: Match[];
  onEditMatch: (match: Match) => void;
  onDeleteMatch: (id: string) => void;
  className?: string;
}

export const HistoryList: React.FC<HistoryListProps> = ({
  matches,
  onEditMatch,
  onDeleteMatch,
  className = '',
}) => {
  // Filter states
  const [heroFilter, setHeroFilter] = useState<number | 'all'>('all');
  const [outcomeFilter, setOutcomeFilter] = useState<MatchResult | 'all'>('all');
  const [sideFilter, setSideFilter] = useState<Side | 'all'>('all');
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);

  // Distinct heroes that the user has played in history
  const playedHeroIds = useMemo(() => {
    const ids = new Set<number>();
    matches.forEach((m) => ids.add(m.myHeroId));
    return Array.from(ids).sort((a, b) => {
      const nameA = getHeroById(a)?.name || '';
      const nameB = getHeroById(b)?.name || '';
      return nameA.localeCompare(nameB);
    });
  }, [matches]);

  // Filtered matches
  const filteredMatches = useMemo(() => {
    return matches.filter((match) => {
      // Outcome filter
      if (outcomeFilter !== 'all' && match.result !== outcomeFilter) {
        return false;
      }

      // Side filter
      if (sideFilter !== 'all' && match.side !== sideFilter) {
        return false;
      }

      // Played hero filter
      if (heroFilter !== 'all' && match.myHeroId !== heroFilter) {
        return false;
      }

      return true;
    });
  }, [matches, heroFilter, outcomeFilter, sideFilter]);

  // Filtered stats
  const filteredWins = filteredMatches.filter((m) => m.result === 'win').length;
  const filteredLosses = filteredMatches.filter((m) => m.result === 'loss').length;
  const filteredCancelled = filteredMatches.filter((m) => m.result === 'cancel').length;
  const filteredDecided = filteredWins + filteredLosses;
  const filteredWinRate =
    filteredDecided > 0 ? Math.round((filteredWins / filteredDecided) * 100) : 0;

  const resetFilters = () => {
    setHeroFilter('all');
    setOutcomeFilter('all');
    setSideFilter('all');
  };

  const hasActiveFilters =
    heroFilter !== 'all' || outcomeFilter !== 'all' || sideFilter !== 'all';

  const toggleExpand = (id: string) => {
    setExpandedMatchId((prev) => (prev === id ? null : id));
  };

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {/* Filter Toolbar */}
      <div className="bg-deadlock-panel border border-deadlock-border rounded-xl p-4 flex flex-col gap-4">
        {/* Top Header of Filter Toolbar: Title & Filtered Winrate badge */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-deadlock-border/60">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-deadlock-muted" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-200">
              Filter Matches ({filteredMatches.length} of {matches.length})
            </h3>
          </div>

          {/* Dynamic Filtered Winrate Badge */}
          <div className="flex items-center gap-3 bg-deadlock-dark px-3 py-1.5 rounded-lg border border-deadlock-border">
            <span className="text-xs text-deadlock-muted">Filtered Winrate:</span>
            <span
              className={`text-xs font-extrabold ${
                filteredWinRate >= 50
                  ? 'text-deadlock-win'
                  : filteredDecided > 0
                  ? 'text-deadlock-loss'
                  : 'text-white'
              }`}
            >
              {filteredDecided > 0 ? `${filteredWinRate}%` : 'N/A'}
            </span>
            <span className="text-[11px] font-mono text-deadlock-muted">
              ({filteredWins}W - {filteredLosses}L{filteredCancelled > 0 ? ` - ${filteredCancelled} Cancel` : ''})
            </span>
            {hasActiveFilters && (
              <>
                <span className="h-3 w-px bg-deadlock-border" />
                <button
                  type="button"
                  onClick={resetFilters}
                  className="flex items-center gap-1 text-[11px] text-deadlock-muted hover:text-white transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Hero Icons Filter Bar */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-deadlock-muted">
            Filter by Played Hero:
          </span>
          <div className="flex items-center gap-2 flex-wrap py-1">
            {/* All Heroes Button */}
            <button
              type="button"
              onClick={() => setHeroFilter('all')}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                heroFilter === 'all'
                  ? 'bg-white text-black shadow-md shadow-white/10 ring-2 ring-white/30'
                  : 'bg-deadlock-dark text-deadlock-muted hover:text-white border border-deadlock-border hover:border-gray-400'
              }`}
            >
              All Heroes ({matches.length})
            </button>

            {/* Played Hero Icons */}
            {playedHeroIds.map((id) => {
              const hero = getHeroById(id);
              const isSelected = heroFilter === id;
              const matchesCount = matches.filter((m) => m.myHeroId === id).length;

              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setHeroFilter(isSelected ? 'all' : id)}
                  title={`${hero?.name || `Hero #${id}`} (${matchesCount} match${matchesCount > 1 ? 'es' : ''})`}
                  className={`relative group rounded-lg p-1 border transition-all duration-150 flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-deadlock-dark border-white ring-2 ring-white/40 scale-105 shadow-md'
                      : 'bg-deadlock-dark/60 border-deadlock-border/70 hover:border-gray-400 hover:bg-deadlock-dark'
                  }`}
                >
                  <div className="w-7 h-7 rounded-md overflow-hidden bg-deadlock-panel">
                    <img
                      src={hero?.iconUrl}
                      alt={hero?.name}
                      className="w-full h-full object-cover select-none"
                    />
                  </div>
                  <span
                    className={`text-xs font-medium pr-1 ${
                      isSelected ? 'text-white font-bold' : 'text-gray-300'
                    }`}
                  >
                    {hero?.name}
                  </span>
                  <span className="text-[10px] font-mono text-deadlock-muted">
                    {matchesCount}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Outcome and Patron Faction Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-deadlock-border/40">
          {/* Outcome Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-deadlock-muted font-medium shrink-0">Outcome:</span>
            <select
              value={outcomeFilter}
              onChange={(e) => setOutcomeFilter(e.target.value as MatchResult | 'all')}
              className="w-full bg-deadlock-dark border border-deadlock-border rounded-lg px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-deadlock-muted transition-colors"
            >
              <option value="all">All Outcomes (Wins, Losses, Cancelled)</option>
              <option value="win">Victories Only</option>
              <option value="loss">Defeats Only</option>
              <option value="cancel">Cancelled / AFK Only</option>
            </select>
          </div>

          {/* Side Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-deadlock-muted font-medium shrink-0">Faction:</span>
            <select
              value={sideFilter}
              onChange={(e) => setSideFilter(e.target.value as Side | 'all')}
              className="w-full bg-deadlock-dark border border-deadlock-border rounded-lg px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-deadlock-muted transition-colors"
            >
              <option value="all">Both Patrons</option>
              <option value="hidden_king">{SIDE_LABELS.hidden_king}</option>
              <option value="archmother">{SIDE_LABELS.archmother}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Match Cards List */}
      {matches.length === 0 ? (
        <div className="bg-deadlock-panel border border-deadlock-border rounded-xl p-12 flex flex-col items-center justify-center gap-3 text-center">
          <Swords className="w-10 h-10 text-deadlock-muted/50" />
          <h3 className="text-sm font-semibold text-gray-200">No matches recorded yet</h3>
          <p className="text-xs text-deadlock-muted max-w-sm">
            Record a 6v6 draft in the &quot;Log Match&quot; tab to build your personal analytics.
          </p>
        </div>
      ) : filteredMatches.length === 0 ? (
        <div className="bg-deadlock-panel border border-deadlock-border rounded-xl p-10 flex flex-col items-center justify-center gap-2 text-center text-deadlock-muted text-xs">
          <span>No matches match the selected filters.</span>
          <button
            type="button"
            onClick={resetFilters}
            className="text-white underline hover:no-underline font-medium"
          >
            Clear all filters
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredMatches.map((m) => {
            const enemySide: Side = m.side === 'hidden_king' ? 'archmother' : 'hidden_king';
            const isExpanded = expandedMatchId === m.id;
            const myHero = getHeroById(m.myHeroId);

            const dateObj = new Date(m.date);
            const dateStr = dateObj.toLocaleDateString([], {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });
            const timeStr = dateObj.toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={m.id}
                className="bg-deadlock-panel border border-deadlock-border hover:border-gray-500 rounded-xl transition-all overflow-hidden flex flex-col"
              >
                {/* Main Card Row */}
                <div className="p-3.5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                  {/* Left: Result Badge + Date + Played Hero Summary */}
                  <div className="flex items-center gap-3 min-w-[220px]">
                    <div
                      className={`flex items-center justify-center w-10 h-10 rounded-lg shadow-md shrink-0 ${
                        m.result === 'win'
                          ? 'bg-deadlock-win/20 border border-deadlock-win/60 text-deadlock-win'
                          : m.result === 'loss'
                          ? 'bg-deadlock-loss/20 border border-deadlock-loss/60 text-deadlock-loss'
                          : 'bg-amber-500/20 border border-amber-500/60 text-amber-400'
                      }`}
                    >
                      {m.result === 'win' ? (
                        <Trophy className="w-5 h-5" />
                      ) : m.result === 'loss' ? (
                        <Skull className="w-5 h-5" />
                      ) : (
                        <Ban className="w-5 h-5" />
                      )}
                    </div>

                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-black uppercase tracking-wider ${
                            m.result === 'win'
                              ? 'text-deadlock-win'
                              : m.result === 'loss'
                              ? 'text-deadlock-loss'
                              : 'text-amber-400'
                          }`}
                        >
                          {RESULT_LABELS[m.result] || m.result}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            m.side === 'hidden_king'
                              ? 'bg-deadlock-hidden-king/20 text-deadlock-hidden-king border border-deadlock-hidden-king/40'
                              : 'bg-deadlock-archmother/20 text-deadlock-archmother border border-deadlock-archmother/40'
                          }`}
                        >
                          {SIDE_LABELS[m.side]}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-deadlock-muted mt-0.5">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {dateStr} at {timeStr}
                        </span>
                      </div>

                      <span className="text-xs font-semibold text-gray-200 mt-0.5">
                        Played: <strong className="text-white">{myHero?.name || 'Unknown'}</strong>
                      </span>

                      {/* Lane Badge (if tracked) */}
                      {m.lane && (
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                              m.lane === 'yellow'
                                ? 'bg-yellow-500/15 border-yellow-500/40 text-yellow-300'
                                : m.lane === 'blue'
                                ? 'bg-blue-500/15 border-blue-500/40 text-blue-300'
                                : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                            }`}
                          >
                            {LANE_LABELS[m.lane]}
                          </span>
                          {m.laneOutcome && (
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                                m.laneOutcome === 'won'
                                  ? 'bg-deadlock-win/15 border-deadlock-win/40 text-deadlock-win'
                                  : m.laneOutcome === 'lost'
                                  ? 'bg-deadlock-loss/15 border-deadlock-loss/40 text-deadlock-loss'
                                  : 'bg-yellow-500/15 border-yellow-500/40 text-yellow-300'
                              }`}
                            >
                              {LANE_OUTCOME_LABELS[m.laneOutcome]}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Middle: 6v6 Team Draft Visuals */}
                  <div className="flex-1 flex flex-wrap items-center justify-center gap-3">
                    {/* Your Team */}
                    <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-deadlock-dark/70 border border-deadlock-border/50">
                      {/* My Hero (Highlighted) */}
                      <div title={`Your Hero: ${myHero?.name}`}>
                        <HeroAvatar
                          heroId={m.myHeroId}
                          size="sm"
                          accentColor={m.side}
                          isHighlighted={true}
                        />
                      </div>
                      <span className="w-px h-6 bg-deadlock-border/70 mx-0.5" />
                      {/* Allies */}
                      {m.allies.map((allyId, idx) => {
                        const ally = getHeroById(allyId);
                        return (
                          <div key={idx} title={`Ally: ${ally?.name}`}>
                            <HeroAvatar heroId={allyId} size="xs" accentColor={m.side} />
                          </div>
                        );
                      })}
                    </div>

                    <span className="text-xs font-bold font-mono text-deadlock-muted px-1">VS</span>

                    {/* Enemy Team */}
                    <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-deadlock-dark/70 border border-deadlock-border/50">
                      {m.enemies.map((enemyId, idx) => {
                        const enemy = getHeroById(enemyId);
                        return (
                          <div key={idx} title={`Enemy: ${enemy?.name}`}>
                            <HeroAvatar heroId={enemyId} size="xs" accentColor={enemySide} />
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Right: Actions (Details, Edit, Delete) */}
                  <div className="flex items-center gap-1.5 self-end lg:self-center">
                    {/* Details Toggle */}
                    <button
                      type="button"
                      onClick={() => toggleExpand(m.id)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-deadlock-muted hover:text-white hover:bg-deadlock-border/40 transition-colors"
                      title={isExpanded ? 'Collapse details' : 'View match notes and composition'}
                    >
                      <span>{isExpanded ? 'Less' : 'Details'}</span>
                      {isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {/* Edit Button */}
                    <button
                      type="button"
                      onClick={() => onEditMatch(m)}
                      className="p-2 text-deadlock-muted hover:text-deadlock-hidden-king hover:bg-deadlock-hidden-king/10 rounded-lg transition-colors"
                      title="Edit Match"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>

                    {/* Delete Button */}
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm('Delete this match from history?')) {
                          onDeleteMatch(m.id);
                        }
                      }}
                      className="p-2 text-deadlock-muted hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors"
                      title="Delete Match"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Expanded Details Drawer */}
                {isExpanded && (
                  <div className="bg-deadlock-dark/80 border-t border-deadlock-border/60 p-4 flex flex-col gap-3 text-xs">
                    {/* Notes */}
                    {m.notes ? (
                      <div className="flex flex-col gap-1">
                        <span className="font-bold text-gray-400 uppercase tracking-wider text-[10px]">
                          Match Notes
                        </span>
                        <p className="text-gray-200 bg-deadlock-panel/80 p-2.5 rounded-lg border border-deadlock-border/50 italic">
                          &quot;{m.notes}&quot;
                        </p>
                      </div>
                    ) : (
                      <span className="text-deadlock-muted italic">No notes recorded for this match.</span>
                    )}

                    {/* Lane Details (Issue #11) */}
                    {m.lane && (
                      <div className="bg-deadlock-panel/80 p-3 rounded-lg border border-deadlock-border/50 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-gray-300 uppercase tracking-wider text-[10px]">
                            Lane Phase: {LANE_LABELS[m.lane]} (Duo Lane)
                          </span>
                          {m.laneOutcome && (
                            <span
                              className={`text-[11px] font-black uppercase tracking-wider ${
                                m.laneOutcome === 'won'
                                  ? 'text-deadlock-win'
                                  : m.laneOutcome === 'lost'
                                  ? 'text-deadlock-loss'
                                  : 'text-yellow-400'
                              }`}
                            >
                              Result: {LANE_OUTCOME_LABELS[m.laneOutcome]}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-4 text-xs pt-1">
                          {m.laneAllyId && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-deadlock-muted">Partner:</span>
                              <HeroAvatar heroId={m.laneAllyId} size="xs" />
                              <span className="font-semibold text-white">{getHeroById(m.laneAllyId)?.name}</span>
                            </div>
                          )}

                          {m.laneOpponents && m.laneOpponents.length > 0 && (
                            <div className="flex items-center gap-2">
                              <span className="text-deadlock-muted">Faced:</span>
                              <div className="flex items-center gap-1.5">
                                {m.laneOpponents.map((oppId) => (
                                  <div key={oppId} className="flex items-center gap-1">
                                    <HeroAvatar heroId={oppId} size="xs" />
                                    <span className="font-semibold text-white">{getHeroById(oppId)?.name}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Team Composition Breakdown */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-deadlock-border/40">
                      {/* Your Team Details */}
                      <div className="flex flex-col gap-1.5">
                        <span className="font-bold text-gray-400 uppercase tracking-wider text-[10px]">
                          Your Team: {SIDE_LABELS[m.side]}
                        </span>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2 text-white font-medium">
                            <span className="text-deadlock-hidden-king font-bold">★ (You)</span>
                            <span>{myHero?.name}</span>
                            <span className="text-deadlock-muted capitalize">({myHero?.heroType})</span>
                          </div>
                          {m.allies.map((allyId) => {
                            const hero = getHeroById(allyId);
                            return (
                              <div key={allyId} className="flex items-center gap-2 text-gray-300">
                                <span className="text-deadlock-muted">•</span>
                                <span>{hero?.name}</span>
                                <span className="text-deadlock-muted capitalize">({hero?.heroType})</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Enemy Team Details */}
                      <div className="flex flex-col gap-1.5">
                        <span className="font-bold text-gray-400 uppercase tracking-wider text-[10px]">
                          Enemy Team: {SIDE_LABELS[enemySide]}
                        </span>
                        <div className="flex flex-col gap-1">
                          {m.enemies.map((enemyId) => {
                            const hero = getHeroById(enemyId);
                            return (
                              <div key={enemyId} className="flex items-center gap-2 text-gray-300">
                                <span className="text-deadlock-muted">•</span>
                                <span>{hero?.name}</span>
                                <span className="text-deadlock-muted capitalize">({hero?.heroType})</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
