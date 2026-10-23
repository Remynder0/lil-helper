import React from 'react';
import {
  Trophy,
  Skull,
  Ban,
  Trash2,
  Pencil,
  Calendar,
  Clock,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { HeroAvatar } from '../HeroAvatar';
import { getHeroById } from '../../data/heroes';
import {
  Match,
  Side,
  SIDE_LABELS,
  RESULT_LABELS,
  LANE_LABELS,
  LANE_OUTCOME_LABELS,
  LaneColor,
} from '../../types/match';
import { formatDurationDHM } from '../../services/logs/matchQueue';

export interface LaneDuo {
  lane: LaneColor;
  heroes: number[];
}

/**
 * Organizes a match's draft into 3 map duos (Yellow, Blue, Green).
 * Places the player and partner in their actual lane duo, keeping
 * the player's hero at their authentic map lane.
 */
export function getLanedTeamDuos(m: Match): { yourTeam: LaneDuo[]; enemyTeam: LaneDuo[] } {
  // 1. Determine player's lane
  let playerLane: LaneColor = m.lane || 'yellow';
  if (!m.lane && m.playerSlot) {
    if (m.playerSlot <= 2) playerLane = 'yellow';
    else if (m.playerSlot <= 4) playerLane = 'blue';
    else playerLane = 'green';
  }

  // 2. Build Your Team
  const alliesList = Array.isArray(m.allies) ? m.allies : [];
  const partnerId =
    m.laneAllyId !== undefined && alliesList.includes(m.laneAllyId)
      ? m.laneAllyId
      : undefined;

  const remainingAllies =
    partnerId !== undefined
      ? alliesList.filter((id) => id !== partnerId)
      : [...alliesList];

  let playerDuo: number[];
  let otherAllies: number[];

  if (partnerId !== undefined) {
    playerDuo = [m.myHeroId, partnerId];
    otherAllies = remainingAllies;
  } else if (remainingAllies.length > 0) {
    playerDuo = [m.myHeroId, remainingAllies[0]];
    otherAllies = remainingAllies.slice(1);
  } else {
    playerDuo = [m.myHeroId];
    otherAllies = [];
  }

  const pair1 = otherAllies.slice(0, 2);
  const pair2 = otherAllies.slice(2, 4);

  let yourYellow: number[];
  let yourBlue: number[];
  let yourGreen: number[];

  if (playerLane === 'yellow') {
    yourYellow = playerDuo;
    yourBlue = pair1;
    yourGreen = pair2;
  } else if (playerLane === 'blue') {
    yourYellow = pair1;
    yourBlue = playerDuo;
    yourGreen = pair2;
  } else {
    yourYellow = pair1;
    yourBlue = pair2;
    yourGreen = playerDuo;
  }

  const yourTeam: LaneDuo[] = [
    { lane: 'yellow', heroes: yourYellow },
    { lane: 'blue', heroes: yourBlue },
    { lane: 'green', heroes: yourGreen },
  ];

  // 3. Build Enemy Team
  const enemiesList = Array.isArray(m.enemies) ? m.enemies : [];
  const directOpponents = Array.isArray(m.laneOpponents) ? m.laneOpponents : [];
  const oppIdsInEnemies = directOpponents.filter((id) => enemiesList.includes(id));

  let enemyYellow: number[];
  let enemyBlue: number[];
  let enemyGreen: number[];

  if (oppIdsInEnemies.length > 0) {
    const oppDuo = [...oppIdsInEnemies];
    const remainingEnemies = enemiesList.filter((id) => !oppDuo.includes(id));
    while (oppDuo.length < 2 && remainingEnemies.length > 0) {
      oppDuo.push(remainingEnemies.shift()!);
    }

    const enemyPair1 = remainingEnemies.slice(0, 2);
    const enemyPair2 = remainingEnemies.slice(2, 4);

    if (playerLane === 'yellow') {
      enemyYellow = oppDuo;
      enemyBlue = enemyPair1;
      enemyGreen = enemyPair2;
    } else if (playerLane === 'blue') {
      enemyYellow = enemyPair1;
      enemyBlue = oppDuo;
      enemyGreen = enemyPair2;
    } else {
      enemyYellow = enemyPair1;
      enemyBlue = enemyPair2;
      enemyGreen = oppDuo;
    }
  } else {
    enemyYellow = enemiesList.slice(0, 2);
    enemyBlue = enemiesList.slice(2, 4);
    enemyGreen = enemiesList.slice(4, 6);
  }

  const enemyTeam: LaneDuo[] = [
    { lane: 'yellow', heroes: enemyYellow },
    { lane: 'blue', heroes: enemyBlue },
    { lane: 'green', heroes: enemyGreen },
  ];

  return { yourTeam, enemyTeam };
}

interface HistoryMatchCardProps {
  match: Match;
  isStreakMatch: boolean;
  highlightedStreakType?: 'win' | 'loss' | null;
  isExpanded: boolean;
  syncingMatchId: number | null;
  waitNoticeMatchId: number | null;
  onToggleExpand: (id: string) => void;
  onEditMatch: (match: Match) => void;
  onDeleteMatch: (id: string) => void;
  onSyncIncompleteMatch: (match: Match) => void;
}

export const HistoryMatchCard: React.FC<HistoryMatchCardProps> = ({
  match: m,
  isStreakMatch,
  highlightedStreakType,
  isExpanded,
  syncingMatchId,
  waitNoticeMatchId,
  onToggleExpand,
  onEditMatch,
  onDeleteMatch,
  onSyncIncompleteMatch,
}) => {
  const enemySide: Side = m.side === 'hidden_king' ? 'archmother' : 'hidden_king';
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
              <span className="text-xs font-black uppercase text-amber-400">
                Match #{currentMatchId}
              </span>
              <span className="text-[11px] text-gray-300">
                {dateStr} at {timeStr}
              </span>
              <span className="text-xs font-semibold text-gray-200">
                Played:{' '}
                <strong className="text-deadlock-steam">{myHero?.name || 'Unknown'}</strong>
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
            onClick={() => onSyncIncompleteMatch(m)}
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

  const lanedDuos = getLanedTeamDuos(m);

  return (
    <div
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
      <div className="p-3.5 flex flex-row items-center justify-between gap-4 overflow-x-auto min-w-0">
        {/* Left: Result Talisman Seal + Date + Played Hero Summary */}
        <div className="flex items-center gap-3.5 shrink-0">
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
          </div>
        </div>

        {/* Middle: 6v6 Team Draft Visuals (Grouped by Lane: Yellow ➔ Blue ➔ Green) */}
        <div className="flex-1 flex items-center justify-center gap-3 shrink-0 flex-nowrap min-w-0">
          {/* Your Team */}
          <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-deadlock-dark/70 border border-deadlock-border/50 shrink-0">
            {lanedDuos.yourTeam.map((duo, duoIdx) => {
              const isMyLane = duo.lane === m.lane;
              return (
                <React.Fragment key={duo.lane}>
                  <div
                    className={`flex items-center gap-1 px-1 py-0.5 rounded-md transition-colors ${
                      isMyLane
                        ? 'bg-deadlock-panel/60 border border-deadlock-border/80 shadow-sm'
                        : ''
                    }`}
                    title={`${LANE_LABELS[duo.lane]}${isMyLane ? ' (Your Lane)' : ''}`}
                  >
                    {duo.heroes.map((heroId, heroIdx) => {
                      const isUser = heroId === m.myHeroId;
                      const isPartner = heroId === m.laneAllyId;
                      const heroData = getHeroById(heroId);
                      return (
                        <div
                          key={`${heroId}-${heroIdx}`}
                          title={
                            isUser
                              ? `Your Hero: ${heroData?.name || 'Unknown'} (${LANE_LABELS[duo.lane]})`
                              : isPartner
                              ? `Lane Partner: ${heroData?.name || 'Unknown'} (${LANE_LABELS[duo.lane]})`
                              : `Ally: ${heroData?.name || 'Unknown'} (${LANE_LABELS[duo.lane]})`
                          }
                        >
                          <HeroAvatar
                            heroId={heroId}
                            size={isUser ? 'sm' : 'xs'}
                            accentColor={m.side}
                            isHighlighted={isUser}
                          />
                        </div>
                      );
                    })}
                  </div>
                  {duoIdx < 2 && <span className="w-px h-5 bg-deadlock-border/40" />}
                </React.Fragment>
              );
            })}
          </div>

          <span className="text-xs font-bold font-mono text-deadlock-muted px-1 shrink-0">
            VS
          </span>

          {/* Enemy Team */}
          <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-deadlock-dark/70 border border-deadlock-border/50 shrink-0">
            {lanedDuos.enemyTeam.map((duo, duoIdx) => {
              const isOpponentLane = duo.lane === m.lane;
              return (
                <React.Fragment key={duo.lane}>
                  <div
                    className={`flex items-center gap-1 px-1 py-0.5 rounded-md transition-colors ${
                      isOpponentLane
                        ? 'bg-deadlock-panel/60 border border-deadlock-border/80 shadow-sm'
                        : ''
                    }`}
                    title={`${LANE_LABELS[duo.lane]}${isOpponentLane ? ' (Opponents in Your Lane)' : ''}`}
                  >
                    {duo.heroes.map((enemyId, heroIdx) => {
                      const enemy = getHeroById(enemyId);
                      const isDirectOpponent = m.laneOpponents?.includes(enemyId);
                      return (
                        <div
                          key={`${enemyId}-${heroIdx}`}
                          title={
                            isDirectOpponent
                              ? `Direct Opponent: ${enemy?.name || 'Unknown'} (${LANE_LABELS[duo.lane]})`
                              : `Enemy: ${enemy?.name || 'Unknown'} (${LANE_LABELS[duo.lane]})`
                          }
                        >
                          <HeroAvatar heroId={enemyId} size="xs" accentColor={enemySide} />
                        </div>
                      );
                    })}
                  </div>
                  {duoIdx < 2 && <span className="w-px h-5 bg-deadlock-border/40" />}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Right: Actions (Details, Edit, Delete) */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Details Toggle */}
          <button
            type="button"
            onClick={() => onToggleExpand(m.id)}
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
            <span className="text-deadlock-muted italic">
              No notes recorded for this match.
            </span>
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
                    <span className="font-semibold text-deadlock-steam">
                      {getHeroById(m.laneAllyId)?.name}
                    </span>
                  </div>
                )}

                {m.laneOpponents && m.laneOpponents.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-deadlock-muted">Faced:</span>
                    <div className="flex items-center gap-1.5">
                      {m.laneOpponents.map((oppId) => (
                        <div key={oppId} className="flex items-center gap-1">
                          <HeroAvatar heroId={oppId} size="xs" />
                          <span className="font-semibold text-deadlock-steam">
                            {getHeroById(oppId)?.name}
                          </span>
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
                      <span className="text-deadlock-muted capitalize">
                        ({hero?.heroType})
                      </span>
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
                      <span className="text-deadlock-muted capitalize">
                        ({hero?.heroType})
                      </span>
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
};
