import React, { useState, useMemo, useEffect } from 'react';
import { HeroAvatar } from './HeroAvatar';
import { HEROES, getHeroById } from '../data/heroes';
import { Match, Side, MatchResult, SIDE_LABELS, RESULT_LABELS, LANE_LABELS, LANE_OUTCOME_LABELS, ConnectedProfile } from '../types/match';
import { fetchPlayerRankStanding, PlayerRankStanding } from '../services/deadlockApi';
import occultBadge from '../assets/occult/badge.svg';
import victorianBadge from '../assets/victorian-metal/badge.svg';
import victorianDivider from '../assets/victorian-metal/divider.svg';
import artDecoBadge from '../assets/art-deco/badge.svg';
import {
  Trophy,
  Skull,
  Ban,
  Trash2,
  Pencil,
  Filter,
  Calendar,
  Clock,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Swords,
  Flame,
  Shield,
  TrendingUp,
  AlertTriangle,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { fetchSingleMatchResultById } from '../services/deadlockApi';
import { persistMatch } from '../services/storage';
import { updateQueuedMatchStatus, formatDurationDHM } from '../services/matchQueue';
import { ReplayRecoveryModal } from './ReplayRecoveryModal';

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
  // Rank Standing state
  const [rankStanding, setRankStanding] = useState<PlayerRankStanding | null>(null);
  const [isLoadingRank, setIsLoadingRank] = useState<boolean>(false);

  // Incomplete match syncing & replay recovery states
  const [syncingMatchId, setSyncingMatchId] = useState<number | null>(null);
  const [waitNoticeMatchId, setWaitNoticeMatchId] = useState<number | null>(null);
  const [selectedRecoveryMatch, setSelectedRecoveryMatch] = useState<Match | null>(null);

  useEffect(() => {
    if (!profile?.accountId) {
      setRankStanding(null);
      return;
    }
    let isMounted = true;
    setIsLoadingRank(true);
    fetchPlayerRankStanding(profile.accountId)
      .then((data) => {
        if (isMounted) {
          setRankStanding(data);
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
  }, [profile?.accountId]);

  // Filter states
  const [heroFilter, setHeroFilter] = useState<number | 'all'>('all');
  const [outcomeFilter, setOutcomeFilter] = useState<MatchResult | 'all'>('all');
  const [sideFilter, setSideFilter] = useState<Side | 'all'>('all');
  const [matchTypeFilter, setMatchTypeFilter] = useState<'all' | 'ranked' | 'casual'>('all');
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

  // Distinct heroes that the user has played in history
  const playedHeroIds = useMemo(() => {
    const ids = new Set<number>();
    matches.filter((m) => !m.isIncomplete).forEach((m) => ids.add(m.myHeroId));
    return Array.from(ids).sort((a, b) => {
      const nameA = getHeroById(a)?.name || '';
      const nameB = getHeroById(b)?.name || '';
      return nameA.localeCompare(nameB);
    });
  }, [matches]);

  // Filtered matches sorted from newest to oldest
  const filteredMatches = useMemo(() => {
    return matches
      .filter((match) => {
        // Incomplete matches handling in filters
        if (match.isIncomplete) {
          if (outcomeFilter !== 'all') return false;
          if (sideFilter !== 'all') return false;
          if (heroFilter !== 'all' && match.myHeroId !== 0 && match.myHeroId !== heroFilter) return false;
          if (matchTypeFilter === 'casual') return false;
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

        // Match type filter (Ranked vs Casual)
        if (matchTypeFilter === 'ranked') {
          const isRanked =
            (match.rankedRank !== null && match.rankedRank !== undefined && match.rankedRank > 0) ||
            (match.rankedBadge !== null && match.rankedBadge !== undefined && match.rankedBadge > 0) ||
            (match.rankedDelta !== null && match.rankedDelta !== undefined);
          if (!isRanked) return false;
        } else if (matchTypeFilter === 'casual') {
          const isRanked =
            (match.rankedRank !== null && match.rankedRank !== undefined && match.rankedRank > 0) ||
            (match.rankedBadge !== null && match.rankedBadge !== undefined && match.rankedBadge > 0) ||
            (match.rankedDelta !== null && match.rankedDelta !== undefined);
          if (isRanked) return false;
        }

        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [matches, heroFilter, outcomeFilter, sideFilter, matchTypeFilter]);

  // Filtered stats
  const filteredWins = filteredMatches.filter((m) => !m.isIncomplete && m.result === 'win').length;
  const filteredLosses = filteredMatches.filter((m) => !m.isIncomplete && m.result === 'loss').length;
  const filteredCancelled = filteredMatches.filter((m) => !m.isIncomplete && m.result === 'cancel').length;
  const filteredDecided = filteredWins + filteredLosses;
  const filteredWinRate =
    filteredDecided > 0 ? Math.round((filteredWins / filteredDecided) * 100) : 0;

  const resetFilters = () => {
    setHeroFilter('all');
    setOutcomeFilter('all');
    setSideFilter('all');
    setMatchTypeFilter('all');
    onHeroFilterChange?.(null);
  };

  const hasActiveFilters =
    heroFilter !== 'all' || outcomeFilter !== 'all' || sideFilter !== 'all' || matchTypeFilter !== 'all';

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
      {profile?.accountId && rankStanding && (
        <div className="steam-glass steam-panel rounded-xl p-4 sm:p-5 border border-deadlock-brass/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.6)]">
          {/* Rotating celestial sigil in corner background */}
          <div className="absolute -right-4 -top-6 pointer-events-none opacity-30">
            <img src={occultBadge} alt="" aria-hidden="true" className="w-[180px] h-[180px] animate-[spin_30s_linear_infinite]" />
          </div>

          <div className="flex items-center gap-4 relative z-10">
            {/* Rank badge from Deadlock API */}
            <div className="relative shrink-0 flex items-center justify-center">
              <div className="w-16 h-16 sm:w-20 sm:h-20 relative flex items-center justify-center drop-shadow-[0_4px_16px_rgba(230,175,46,0.35)]">
                <img
                  src={rankStanding.badgeImageUrl}
                  alt={`${rankStanding.tierName} ${rankStanding.subrankRoman}`}
                  className="w-full h-full object-contain filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] hover:scale-105 transition-transform duration-200"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://api.deadlock-api.com/v1/players/${profile.accountId}/rank/image`;
                  }}
                />
              </div>
            </div>

            <div className="flex flex-col">
              {rankStanding.calibrationGamesRemaining > 0 && (
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/50 text-amber-300">
                    Calibrating ({rankStanding.calibrationGamesRemaining} left)
                  </span>
                </div>
              )}
              <h2 className="text-xl sm:text-2xl font-bold text-deadlock-steam tracking-wide drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] flex items-center gap-2">
                <span>{rankStanding.tierName}</span>
                <span className="text-deadlock-accent font-serif tracking-wider">{rankStanding.subrankRoman}</span>
              </h2>

              {/* Subrank progress bar */}
              {rankStanding.progressMax > 0 && (
                <div className="flex flex-col gap-1 mt-1 w-48 sm:w-56">
                  <div
                    className="flex items-center justify-between text-[10px] font-mono"
                    title={rankStanding.flatProgress !== undefined ? `${rankStanding.flatProgress.toLocaleString()} ladder points` : undefined}
                  >
                    <span className="text-deadlock-muted">Progress</span>
                    <span className="text-deadlock-accent font-bold">
                      {rankStanding.progress.toLocaleString()} / {rankStanding.progressMax.toLocaleString()} pts
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-deadlock-dark/80 overflow-hidden border border-deadlock-border/40">
                    <div
                      className="h-full bg-gradient-to-r from-deadlock-brass to-deadlock-accent transition-all duration-500 rounded-full"
                      style={{
                        width: `${Math.min(100, Math.max(0, (rankStanding.progress / rankStanding.progressMax) * 100))}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right section: Demotion Protection Shields & Global Server Percentile */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 relative z-10 w-full md:w-auto justify-start md:justify-end">
            {/* Demotion Protection Shields (Icon-only, no text label) */}
            <div
              className="steam-glass px-3.5 py-2.5 rounded-xl border border-deadlock-brass/30 flex items-center justify-center bg-deadlock-dark/50 shadow-inner"
              title={`${rankStanding.demotionProtectionGames ?? 0} / ${rankStanding.maxDemotionProtectionGames || (rankStanding.subrank === 1 ? 5 : 2)} Demotion Protection`}
            >
              <div className="flex items-center gap-1.5">
                {Array.from({
                  length:
                    rankStanding.maxDemotionProtectionGames ||
                    (rankStanding.subrank === 1 ? 5 : 2),
                }).map((_, i) => {
                  const isFilled = i < (rankStanding.demotionProtectionGames ?? 0);
                  return isFilled ? (
                    <Shield
                      key={i}
                      className="w-6 h-6 fill-emerald-400 text-emerald-300 drop-shadow-[0_0_10px_rgba(52,211,153,0.8)] transition-transform hover:scale-110"
                    />
                  ) : (
                    <Shield
                      key={i}
                      className="w-6 h-6 text-zinc-500/60 fill-zinc-900/60 stroke-[1.5] transition-transform hover:scale-110"
                    />
                  );
                })}
              </div>
            </div>

            {/* Global Server Percentile */}
            <div className="steam-glass px-3.5 py-2 rounded-xl border border-deadlock-brass/30 flex items-center gap-3 bg-deadlock-dark/40 shadow-inner">
              <div className="p-1.5 rounded-lg bg-deadlock-card/80 border border-deadlock-border/60">
                <TrendingUp className="w-4 h-4 text-deadlock-accent" />
              </div>
              <div className="flex flex-col text-left">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-deadlock-muted">
                    Percentile
                  </span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-deadlock-accent/20 text-deadlock-accent font-mono font-bold">
                    {rankStanding.topPercentileFormatted}
                  </span>
                </div>
                <span className="text-xs font-semibold text-deadlock-steam">
                  {rankStanding.betterThanFormatted}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {profile?.accountId && isLoadingRank && !rankStanding && (
        <div className="steam-glass steam-panel rounded-xl p-5 border border-deadlock-brass/30 animate-pulse flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-deadlock-dark/60 border border-deadlock-border/50" />
            <div className="flex flex-col gap-2">
              <div className="w-24 h-3 bg-deadlock-dark/60 rounded" />
              <div className="w-36 h-5 bg-deadlock-dark/60 rounded" />
            </div>
          </div>
          <div className="w-48 h-10 bg-deadlock-dark/60 rounded" />
        </div>
      )}


      {/* Filter Toolbar */}
      <div className="steam-glass steam-panel rounded-xl p-4 flex flex-col gap-3 relative border border-deadlock-border/80">
        {/* Top Header of Filter Toolbar: Title & Filtered Winrate badge */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <img src={victorianBadge} alt="" aria-hidden="true" className="w-[18px] h-[18px] shrink-0 animate-[spin_20s_linear_infinite] opacity-70" />
            <Filter className="w-4 h-4 text-deadlock-accent" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-deadlock-steam">
              Filter Matches ({filteredMatches.length} of {matches.length})
            </h3>
          </div>

          {/* Dynamic Filtered Winrate Badge */}
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
              ({filteredWins}W - {filteredLosses}L{filteredCancelled > 0 ? ` - ${filteredCancelled} Cancel` : ''})
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
        </div>

        <img src={victorianDivider} alt="" aria-hidden="true" className="w-full h-3 object-cover my-3 opacity-60" />

        {/* Hero Icons Filter Bar */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-deadlock-muted">
            Filter by Played Hero:
          </span>
          <div className="flex items-center gap-2 flex-wrap py-1">
            {/* All Heroes Button */}
            <button
              type="button"
              onClick={() => {
                setHeroFilter('all');
                onHeroFilterChange?.(null);
              }}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                heroFilter === 'all'
                  ? 'bg-deadlock-steam text-black shadow-md shadow-deadlock-steam/10 ring-2 ring-deadlock-steam/30'
                  : 'bg-deadlock-dark text-deadlock-muted hover:text-deadlock-steam border border-deadlock-border hover:border-deadlock-brass'
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
                  onClick={() => {
                    const next = isSelected ? 'all' : id;
                    setHeroFilter(next);
                    onHeroFilterChange?.(next === 'all' ? null : next);
                  }}
                  title={`${hero?.name || `Hero #${id}`} (${matchesCount} match${matchesCount > 1 ? 'es' : ''})`}
                  className={`relative group rounded-lg p-1 border transition-all duration-150 flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-deadlock-dark border-deadlock-steam ring-2 ring-deadlock-steam/40 scale-105 shadow-md'
                      : 'bg-deadlock-dark/60 border-deadlock-border/70 hover:border-deadlock-brass hover:bg-deadlock-card/40'
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
                      isSelected ? 'text-deadlock-steam font-bold' : 'text-gray-300'
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

            {/* Any Hero Selector (allows selecting Celeste or any other hero) */}
            <div className="flex items-center gap-1.5 ml-auto">
              <span className="text-[11px] text-deadlock-muted font-medium">Hero:</span>
              <select
                value={heroFilter === 'all' ? '' : heroFilter}
                onChange={(e) => {
                  const val = e.target.value === '' ? 'all' : Number(e.target.value);
                  setHeroFilter(val);
                  onHeroFilterChange?.(val === 'all' ? null : val);
                }}
                className="bg-deadlock-card border border-deadlock-border rounded-lg px-2.5 py-1.5 text-xs text-deadlock-steam focus:outline-none focus:border-deadlock-accent transition-colors cursor-pointer"
              >
                <option value="">Choose any hero...</option>
                {HEROES.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name} {h.id === 81 ? '★ (Celeste)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Outcome, Patron Faction, and Match Mode Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-deadlock-border/40">
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

          {/* Mode Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-deadlock-muted font-medium shrink-0">Mode:</span>
            <select
              value={matchTypeFilter}
              onChange={(e) => setMatchTypeFilter(e.target.value as 'all' | 'ranked' | 'casual')}
              className="w-full bg-deadlock-dark border border-deadlock-border rounded-lg px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-deadlock-muted transition-colors"
            >
              <option value="all">All Match Modes</option>
              <option value="ranked">Ranked Matches Only</option>
              <option value="casual">Casual / Unranked Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Match Cards List */}
      {matches.length === 0 ? (
        <div className="steam-glass steam-panel rounded-xl p-12 flex flex-col items-center justify-center gap-3 text-center border border-deadlock-border/80">
          <div className="relative">
            <Swords className="w-12 h-12 text-deadlock-accent/60" />
            <div className="absolute -top-3 -left-3 pointer-events-none opacity-20">
              <img src={artDecoBadge} alt="" aria-hidden="true" className="w-16 h-16 animate-[spin_20s_linear_infinite]" />
            </div>
          </div>
          <h3 className="text-sm font-bold tracking-wide text-deadlock-steam uppercase">No matches recorded in the occult archives</h3>
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

          {filteredMatches.map((m) => {
            const isStreakMatch = Boolean(highlightedMatchIds?.includes(m.id));
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

            if (m.isIncomplete) {
              const currentMatchId = m.matchId || parseInt(m.id.replace(/\D/g, ''), 10) || 0;
              const isSyncing = syncingMatchId === currentMatchId;
              const hasWaitNotice = waitNoticeMatchId === currentMatchId;

              return (
                <div
                  key={m.id}
                  id={`match-${m.id}`}
                  className={`steam-glass rounded-xl overflow-hidden relative group border transition-all duration-200 shadow-md ${
                    isStreakMatch
                      ? 'border-amber-400 ring-2 ring-amber-400/80 bg-amber-950/30 shadow-[0_0_20px_rgba(251,191,36,0.35)]'
                      : 'border-dashed border-amber-500/50 hover:border-amber-400 bg-amber-950/10'
                  }`}
                >
                  {/* Blurred background preview - same blur as AnalyticsView: opacity-40 blur-[1px] */}
                  <div className="p-3.5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 opacity-40 blur-[1px] select-none pointer-events-none transition-all duration-200">
                    <div className="flex items-center gap-3.5 min-w-[230px]">
                      <div className="flex items-center justify-center w-11 h-11 rounded-full border-2 border-amber-500/40 bg-amber-500/20 text-amber-300">
                        <Clock className="w-5 h-5" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-black uppercase text-amber-400">Match #{currentMatchId}</span>
                        <span className="text-[11px] text-gray-300">{dateStr} at {timeStr}</span>
                        <span className="text-xs font-semibold text-gray-200">
                          Played: <strong className="text-deadlock-steam">{myHero?.name || 'Unknown'}</strong>
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs font-mono text-gray-400">Synchronization required</span>
                    </div>
                  </div>

                  {/* Hover / Incomplete overlay - visible only on hover or when syncing/notice active */}
                  <div
                    className={`absolute inset-0 z-10 flex flex-col sm:flex-row items-center justify-between px-5 py-3.5 bg-black/80 backdrop-blur-sm gap-3 transition-opacity duration-200 ${
                      isSyncing || hasWaitNotice
                        ? 'opacity-100 pointer-events-auto'
                        : 'opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto'
                    }`}
                  >
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
                        <span className="text-xs font-bold text-amber-300 uppercase tracking-wider font-mono">
                          Incomplete Match #{currentMatchId}
                        </span>
                        <span className="text-[10px] text-amber-200/70 font-mono">
                          ({formatDurationDHM(new Date(m.date).getTime())} ago)
                        </span>
                      </div>
                      {hasWaitNotice ? (
                        <span className="text-[11px] text-amber-200 font-semibold animate-fadeIn bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 rounded">
                          ⏳ Valve API data is not ready yet. Please wait a bit before trying again.
                        </span>
                      ) : (
                        <span className="text-[11px] text-gray-300 leading-tight">
                          Match data not yet indexed by Valve API. Click to synchronize.
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSyncIncompleteMatch(m)}
                      disabled={isSyncing}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-black font-black text-xs shadow-lg shadow-amber-950/50 transition-all cursor-pointer disabled:opacity-50 shrink-0"
                    >
                      {isSyncing ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-black" />
                          <span>Syncing...</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 text-black" />
                          <span>Synchronize</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={m.id}
                id={`match-${m.id}`}
                className={`steam-glass rounded-xl transition-all overflow-hidden flex flex-col relative group border ${
                  isStreakMatch
                    ? highlightedStreakType === 'win'
                      ? 'border-amber-400 ring-2 ring-amber-400/60 shadow-[0_0_24px_rgba(251,191,36,0.3)] bg-gradient-to-r from-amber-950/25 to-transparent'
                      : 'border-red-500 ring-2 ring-red-500/60 shadow-[0_0_24px_rgba(239,68,68,0.3)] bg-gradient-to-r from-red-950/25 to-transparent'
                    : 'border-deadlock-border/70 hover:border-deadlock-brass/70 hover:shadow-[0_4px_24px_rgba(184,115,51,0.25)]'
                }`}
              >
                {/* Main Card Row */}
                <div className="p-3.5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                  {/* Left: Result Talisman Seal + Date + Played Hero Summary */}
                  <div className="flex items-center gap-3.5 min-w-[230px]">
                    <div
                      className={`flex items-center justify-center w-11 h-11 rounded-full shadow-lg shrink-0 border-2 transition-transform group-hover:scale-105 ${
                        m.result === 'win'
                          ? 'bg-gradient-to-b from-[#78a590] via-[#5f8f7a] to-[#2d4d3e] border-[#a2cfba] text-[#110f0c] shadow-[0_0_12px_rgba(95,143,122,0.4)]'
                          : m.result === 'loss'
                          ? 'bg-gradient-to-b from-[#bd5654] via-[#a94442] to-[#5a2120] border-[#e07d7b] text-white shadow-[0_0_12px_rgba(169,68,66,0.4)]'
                          : 'bg-gradient-to-b from-[#d4a373] via-[#b87333] to-[#5a3818] border-[#e8c06a] text-black shadow-[0_0_12px_rgba(196,149,106,0.3)]'
                      }`}
                    >
                      {m.result === 'win' ? (
                        <Trophy className="w-5 h-5 drop-shadow" />
                      ) : m.result === 'loss' ? (
                        <Skull className="w-5 h-5 drop-shadow" />
                      ) : (
                        <Ban className="w-5 h-5 drop-shadow" />
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
                        {isStreakMatch && (
                          <span
                            className={`text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                              highlightedStreakType === 'win'
                                ? 'bg-amber-400/20 text-amber-300 border-amber-400/50'
                                : 'bg-red-500/20 text-red-300 border-red-500/50'
                            }`}
                          >
                            ★ Streak
                          </span>
                        )}
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

                      <div className="flex items-center gap-2 text-[11px] text-gray-200 mt-0.5 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-deadlock-accent" />
                          {dateStr} at {timeStr}
                        </span>
                        {m.durationSeconds !== undefined && m.durationSeconds > 0 && (
                          <span className="flex items-center gap-1 font-mono text-gray-200 bg-deadlock-dark px-1.5 py-0.2 rounded border border-deadlock-border/60">
                            <Clock className="w-3 h-3 text-deadlock-accent" />
                            {Math.floor(m.durationSeconds / 60)}m {m.durationSeconds % 60}s
                          </span>
                        )}
                      </div>

                      <span className="text-xs font-semibold text-gray-200 mt-0.5">
                        Played: <strong className="text-deadlock-steam">{myHero?.name || 'Unknown'}</strong>
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
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-deadlock-muted hover:text-deadlock-steam hover:bg-deadlock-border/40 transition-colors"
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
                      className="p-2 text-deadlock-muted hover:text-deadlock-accent hover:bg-deadlock-accent/10 rounded-lg transition-colors"
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
                      className="p-2 text-deadlock-muted hover:text-deadlock-loss hover:bg-deadlock-loss/10 rounded-lg transition-colors"
                      title="Delete Match"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Expanded Details Drawer */}
                {isExpanded && (
                  <div className="bg-deadlock-card/80 border-t border-deadlock-border/60 p-4 flex flex-col gap-3 text-xs">
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
                              <span className="font-semibold text-deadlock-steam">{getHeroById(m.laneAllyId)?.name}</span>
                            </div>
                          )}

                          {m.laneOpponents && m.laneOpponents.length > 0 && (
                            <div className="flex items-center gap-2">
                              <span className="text-deadlock-muted">Faced:</span>
                              <div className="flex items-center gap-1.5">
                                {m.laneOpponents.map((oppId) => (
                                  <div key={oppId} className="flex items-center gap-1">
                                    <HeroAvatar heroId={oppId} size="xs" />
                                    <span className="font-semibold text-deadlock-steam">{getHeroById(oppId)?.name}</span>
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
                          <div className="flex items-center gap-2 text-deadlock-steam font-medium">
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
