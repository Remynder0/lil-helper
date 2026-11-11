import React, { useState, useMemo, useEffect } from 'react';
import { getHeroById } from '../../data/heroes';
import {
  Match,
  Side,
  MatchResult,
  ConnectedProfile,
} from '../../types/match';
import {
  fetchPlayerRankStanding,
  PlayerRankStanding,
  buildRankStandingFromLocalMatch,
  fetchSingleMatchResultById,
} from '../../services/api/deadlockApi';
import artDecoBadge from '../../assets/art-deco/badge.svg';
import { RotateCcw, Swords, Flame } from 'lucide-react';
import { persistMatch } from '../../services/storage/storage';
import { updateQueuedMatchStatus } from '../../services/logs/matchQueue';
import { HeroFilter, PlayedHeroItem } from '../HeroFilter';
import { ReplayRecoveryModal } from './ReplayRecoveryModal';
import { HistoryRankStandingCards } from './HistoryRankStandingCards';
import { HistoryMatchCard, getLanedTeamDuos, LaneDuo } from './HistoryMatchCard';

export { getLanedTeamDuos };
export type { LaneDuo };

interface HistoryListProps {
  matches: Match[];
  profile?: ConnectedProfile | null;
  onEditMatch: (match: Match) => void;
  onDeleteMatch: (id: string) => void;
  onHeroFilterChange?: (heroId: number | null) => void;
  highlightedMatchIds?: string[] | null;
  highlightedStreakType?: 'win' | 'loss' | null;
  onClearHighlight?: () => void;
  onMatchImported?: (match: Match) => void;
  className?: string;
}

export const HistoryList: React.FC<HistoryListProps> = ({
  matches,
  profile,
  onEditMatch,
  onDeleteMatch,
  onHeroFilterChange,
  highlightedMatchIds,
  highlightedStreakType,
  onClearHighlight,
  onMatchImported,
  className = '',
}) => {
  // Chronological ranked matches from local history
  const latestLocalRankedMatch = useMemo(() => {
    const ranked = matches
      .filter((m) => m.rankedProgress !== undefined && m.rankedProgress !== null)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return ranked.length > 0 ? ranked[ranked.length - 1] : null;
  }, [matches]);

  // Rank Standing state
  const [apiStanding, setApiStanding] = useState<PlayerRankStanding | null>(null);
  const [isLoadingRank, setIsLoadingRank] = useState<boolean>(false);

  useEffect(() => {
    if (!profile?.accountId) {
      setApiStanding(null);
      return;
    }
    let isMounted = true;
    setIsLoadingRank(true);
    fetchPlayerRankStanding(profile.accountId, latestLocalRankedMatch)
      .then((data) => {
        if (isMounted) {
          setApiStanding(data);
        }
      })
      .catch((err) => {
        console.warn('Failed to fetch player rank standing:', err);
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingRank(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [profile?.accountId, latestLocalRankedMatch?.id, latestLocalRankedMatch?.rankedProgress]);

  // Effective rank standing: prioritize local match data (fallback to immediate local standing if API is loading)
  const rankStanding = useMemo(() => {
    if (apiStanding) return apiStanding;
    if (latestLocalRankedMatch) {
      return buildRankStandingFromLocalMatch(latestLocalRankedMatch, []);
    }
    return null;
  }, [apiStanding, latestLocalRankedMatch]);

  // Incomplete match syncing & replay recovery states
  const [syncingMatchId, setSyncingMatchId] = useState<number | null>(null);
  const [waitNoticeMatchId, setWaitNoticeMatchId] = useState<number | null>(null);
  const [selectedRecoveryMatch, setSelectedRecoveryMatch] = useState<Match | null>(null);

  // Filter states
  const [heroFilter, setHeroFilter] = useState<number | 'all'>('all');
  const [outcomeFilter, setOutcomeFilter] = useState<MatchResult | 'all'>('all');
  const [sideFilter, setSideFilter] = useState<Side | 'all'>('all');
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);

  // Synchronise an incomplete match
  const handleSyncIncompleteMatch = async (m: Match) => {
    const matchId = m.matchId || parseInt(m.id.replace(/\D/g, ''), 10);
    if (!matchId) return;

    setSyncingMatchId(matchId);
    const matchTimestamp = new Date(m.date).getTime();
    const elapsedMs = Date.now() - matchTimestamp;
    const isOlderThan5h = elapsedMs >= 5 * 60 * 60 * 1000;

    try {
      const result = await fetchSingleMatchResultById(matchId, profile?.accountId || 0);
      if (result.success && result.match) {
        await persistMatch(result.match);
        updateQueuedMatchStatus(matchId, 'synced');
        onMatchImported?.(result.match);
        setSyncingMatchId(null);
        return;
      }

      if (!result.success && result.error === 'season_2_blocked') {
        setSyncingMatchId(null);
        return;
      }

      // API failed or match is not indexed yet
      if (isOlderThan5h) {
        setSelectedRecoveryMatch(m);
      } else {
        setWaitNoticeMatchId(matchId);
        setTimeout(() => {
          setWaitNoticeMatchId((prev) => (prev === matchId ? null : prev));
        }, 6000);
      }
    } catch (err) {
      if (isOlderThan5h) {
        setSelectedRecoveryMatch(m);
      } else {
        setWaitNoticeMatchId(matchId);
        setTimeout(() => {
          setWaitNoticeMatchId((prev) => (prev === matchId ? null : prev));
        }, 6000);
      }
    } finally {
      setSyncingMatchId(null);
    }
  };

  // Distinct heroes that the user has played in history, sorted by match count descending
  const playedHeroes: PlayedHeroItem[] = useMemo(() => {
    const counts = new Map<number, number>();
    for (const m of matches) {
      if (!m.isIncomplete && m.myHeroId) {
        counts.set(m.myHeroId, (counts.get(m.myHeroId) || 0) + 1);
      }
    }
    const heroList = Array.from(counts.keys())
      .map((id) => getHeroById(id))
      .filter((h): h is NonNullable<typeof h> => h !== undefined);
    heroList.sort((a, b) => (counts.get(b.id) || 0) - (counts.get(a.id) || 0));
    return heroList.map((hero) => ({ hero, count: counts.get(hero.id) || 0 }));
  }, [matches]);

  // Match counts per side in history
  const sideCounts = useMemo(() => {
    let hiddenKing = 0;
    let archmother = 0;
    for (const m of matches) {
      if (!m.isIncomplete) {
        if (m.side === 'hidden_king') hiddenKing++;
        else if (m.side === 'archmother') archmother++;
      }
    }
    return { hiddenKing, archmother, total: hiddenKing + archmother };
  }, [matches]);

  // Filtered matches sorted from newest to oldest
  const filteredMatches = useMemo(() => {
    return matches
      .filter((match) => {
        // Incomplete matches handling in filters
        if (match.isIncomplete) {
          if (outcomeFilter !== 'all') return false;
          if (sideFilter !== 'all') return false;
          if (heroFilter !== 'all' && match.myHeroId !== 0 && match.myHeroId !== heroFilter)
            return false;
          return true;
        }

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
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [matches, heroFilter, outcomeFilter, sideFilter]);

  // Filtered stats
  const filteredWins = filteredMatches.filter(
    (m) => !m.isIncomplete && m.result === 'win'
  ).length;
  const filteredLosses = filteredMatches.filter(
    (m) => !m.isIncomplete && m.result === 'loss'
  ).length;
  const filteredCancelled = filteredMatches.filter(
    (m) => !m.isIncomplete && m.result === 'cancel'
  ).length;
  const filteredDecided = filteredWins + filteredLosses;
  const filteredWinRate =
    filteredDecided > 0 ? Math.round((filteredWins / filteredDecided) * 100) : 0;

  const resetFilters = () => {
    setHeroFilter('all');
    setOutcomeFilter('all');
    setSideFilter('all');
    onHeroFilterChange?.(null);
  };

  const hasActiveFilters =
    heroFilter !== 'all' ||
    outcomeFilter !== 'all' ||
    sideFilter !== 'all';

  const toggleExpand = (id: string) => {
    setExpandedMatchId((prev) => (prev === id ? null : id));
  };

  // Scroll to streak and reset filters when highlightedMatchIds changes
  useEffect(() => {
    if (highlightedMatchIds && highlightedMatchIds.length > 0) {
      setHeroFilter('all');
      setOutcomeFilter('all');
      setSideFilter('all');
      onHeroFilterChange?.(null);

      const timer = setTimeout(() => {
        for (const id of highlightedMatchIds) {
          const el = document.getElementById(`match-${id}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            break;
          }
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [highlightedMatchIds, onHeroFilterChange]);

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {/* Player Official Rank, Demotion Protection Shields & Percentile Banner */}
      {profile?.accountId && (
        <HistoryRankStandingCards
          accountId={profile.accountId}
          rankStanding={rankStanding}
          isLoadingRank={isLoadingRank}
        />
      )}

      {/* Unified Hero & Match Filter Toolbar */}
      <HeroFilter
        playedHeroes={playedHeroes}
        selectedPlayerHeroId={heroFilter === 'all' ? null : heroFilter}
        onSelectHeroId={(id) => {
          const next = id ?? 'all';
          setHeroFilter(next);
          onHeroFilterChange?.(id);
        }}
        totalTrackedMatches={matches.length}
        title={`Filter Matches (${filteredMatches.length} of ${matches.length})`}
        subtitle={(hero) =>
          hero
            ? `Filtering matches specifically for ${hero.name}`
            : 'Filter match history across all your recorded games'
        }
        headerExtra={
          <div className="brass-plate px-3 py-1.5 rounded-lg flex items-center gap-3 border border-deadlock-border/80">
            <span className="text-xs text-deadlock-muted">Filtered Winrate:</span>
            <span
              className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${
                filteredWinRate >= 50
                  ? 'bg-deadlock-win/20 text-deadlock-win border border-deadlock-win/40 shadow-sm'
                  : filteredDecided > 0
                  ? 'bg-deadlock-loss/20 text-deadlock-loss border border-deadlock-loss/40 shadow-sm'
                  : 'text-deadlock-steam'
              }`}
            >
              {filteredDecided > 0 ? `${filteredWinRate}%` : 'N/A'}
            </span>
            <span className="text-[11px] font-mono text-deadlock-muted">
              ({filteredWins}W - {filteredLosses}L
              {filteredCancelled > 0 ? ` - ${filteredCancelled} Cancel` : ''})
            </span>
            {hasActiveFilters && (
              <>
                <span className="h-3 w-px bg-deadlock-border" />
                <button
                  type="button"
                  onClick={resetFilters}
                  className="flex items-center gap-1 text-[11px] text-deadlock-accent hover:text-white transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              </>
            )}
          </div>
        }
        selectedSide={sideFilter}
        onSideChange={setSideFilter}
        sideCounts={sideCounts}
      >
        {/* Outcome Filter */}
        <div className="flex items-center gap-2 pt-2 border-t border-deadlock-border/40 max-w-xs">
          <span className="text-xs text-deadlock-muted font-medium shrink-0">Outcome:</span>
          <select
            value={outcomeFilter}
            onChange={(e) => setOutcomeFilter(e.target.value as MatchResult | 'all')}
            className="w-full bg-deadlock-dark border border-deadlock-border rounded-lg px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-deadlock-muted transition-colors cursor-pointer"
          >
            <option value="all">All Outcomes (Wins, Losses, Cancelled)</option>
            <option value="win">Victories Only</option>
            <option value="loss">Defeats Only</option>
            <option value="cancel">Cancelled / AFK Only</option>
          </select>
        </div>
      </HeroFilter>

      {/* Match Cards List */}
      {matches.length === 0 ? (
        <div className="steam-glass steam-panel rounded-xl p-12 flex flex-col items-center justify-center gap-3 text-center border border-deadlock-border/80">
          <div className="relative">
            <Swords className="w-12 h-12 text-deadlock-accent/60" />
            <div className="absolute -top-3 -left-3 pointer-events-none opacity-20">
              <img
                src={artDecoBadge}
                alt=""
                aria-hidden="true"
                className="w-16 h-16 animate-[spin_20s_linear_infinite]"
              />
            </div>
          </div>
          <h3 className="text-sm font-bold tracking-wide text-deadlock-steam uppercase">
            No matches recorded in the occult archives
          </h3>
          <p className="text-xs text-deadlock-muted max-w-sm">
            Record a 6v6 draft in the &quot;Log Match&quot; tab to build your personal analytics.
          </p>
        </div>
      ) : filteredMatches.length === 0 ? (
        <div className="steam-glass steam-card rounded-xl p-10 flex flex-col items-center justify-center gap-2 text-center text-deadlock-muted text-xs border border-deadlock-border/80">
          <span>No matches match the selected filters.</span>
          <button
            type="button"
            onClick={resetFilters}
            className="text-deadlock-accent underline hover:no-underline font-bold"
          >
            Clear all filters
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Highlight Streak Banner */}
          {highlightedMatchIds && highlightedMatchIds.length > 0 && (
            <div
              className={`p-3 rounded-xl border flex items-center justify-between text-xs font-semibold animate-fadeIn ${
                highlightedStreakType === 'win'
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-300 shadow-[0_0_20px_rgba(251,191,36,0.15)]'
                  : highlightedStreakType === 'loss'
                  ? 'bg-red-500/10 border-red-500/40 text-red-300 shadow-[0_0_20px_rgba(239,68,68,0.15)]'
                  : 'bg-amber-500/15 border-amber-500/50 text-amber-200 shadow-[0_0_20px_rgba(251,191,36,0.2)]'
              }`}
            >
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-amber-400" />
                <span>
                  {highlightedStreakType === 'win'
                    ? `Highlighting Best Win Streak (${highlightedMatchIds.length} matches)`
                    : highlightedStreakType === 'loss'
                    ? `Highlighting Worst Lose Streak (${highlightedMatchIds.length} matches)`
                    : `Focusing Match #${highlightedMatchIds[0].replace(/\D/g, '')}`}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onClearHighlight?.()}
                className="px-2.5 py-1 rounded bg-black/40 hover:bg-black/60 text-deadlock-steam border border-deadlock-border/60 hover:border-deadlock-steam transition-all"
              >
                Clear Highlight ✕
              </button>
            </div>
          )}

          {filteredMatches.map((m) => (
            <HistoryMatchCard
              key={m.id}
              match={m}
              isStreakMatch={Boolean(highlightedMatchIds?.includes(m.id))}
              highlightedStreakType={highlightedStreakType}
              isExpanded={expandedMatchId === m.id}
              syncingMatchId={syncingMatchId}
              waitNoticeMatchId={waitNoticeMatchId}
              onToggleExpand={toggleExpand}
              onEditMatch={onEditMatch}
              onDeleteMatch={onDeleteMatch}
              onSyncIncompleteMatch={handleSyncIncompleteMatch}
            />
          ))}
        </div>
      )}

      {/* Replay Recovery Modal for incomplete matches > 5h */}
      <ReplayRecoveryModal
        isOpen={Boolean(selectedRecoveryMatch)}
        onClose={() => setSelectedRecoveryMatch(null)}
        match={selectedRecoveryMatch}
        accountId={profile?.accountId || 0}
        allMatches={matches}
        onMatchImported={(imported) => {
          onMatchImported?.(imported);
          setSelectedRecoveryMatch(null);
        }}
      />
    </div>
  );
};
