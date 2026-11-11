import React, { useState } from 'react';
import { Database, Plus, CheckCircle2, Clock } from 'lucide-react';
import {
  QueuedMatch,
  addMatchToQueue,
  removeMatchFromQueue,
  updateQueuedMatchStatus,
  formatDurationDHM,
} from '../../services/logs/matchQueue';
import { fetchSingleMatchResultById } from '../../services/api/deadlockApi';
import { persistMatches } from '../../services/storage/storage';
import { HeroAvatar } from '../HeroAvatar';
import { ConnectedProfile, Match } from '../../types/match';

interface MatchQueuePanelProps {
  profile?: ConnectedProfile | null;
  matchQueue: QueuedMatch[];
  matches: Match[];
  onMatchesUpdated?: (updater: (prev: Match[]) => Match[]) => void;
}

export const MatchQueuePanel: React.FC<MatchQueuePanelProps> = ({
  profile,
  matchQueue,
  matches,
  onMatchesUpdated,
}) => {
  const [manualMatchIdInput, setManualMatchIdInput] = useState<string>('');
  const [manualMatchDate, setManualMatchDate] = useState<string>(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  });
  const [checkingMatchId, setCheckingMatchId] = useState<number | null>(null);

  // Action: Add Match ID to Queue manually
  const handleAddManualMatch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanId = parseInt(manualMatchIdInput.trim(), 10);
    if (cleanId > 0) {
      const ts = manualMatchDate ? new Date(manualMatchDate).getTime() : Date.now();
      addMatchToQueue(cleanId, isNaN(ts) ? Date.now() : ts, undefined, undefined, 'manual');
      setManualMatchIdInput('');
    }
  };

  // Action: Check/Import specific queued match immediately
  const handleCheckQueuedMatch = async (matchId: number) => {
    if (!profile?.accountId || checkingMatchId !== null) return;
    setCheckingMatchId(matchId);
    updateQueuedMatchStatus(matchId, 'syncing', 'Checking API now...');

    try {
      const result = await fetchSingleMatchResultById(matchId, profile.accountId);
      if (result.success) {
        updateQueuedMatchStatus(matchId, 'synced', 'Successfully imported into matches!', false);
        await persistMatches([result.match]);
        if (onMatchesUpdated) {
          onMatchesUpdated((prev) => {
            if (prev.some((m) => m.id === result.match.id || m.matchId === matchId)) {
              return prev;
            }
            return [result.match, ...prev].sort(
              (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
            );
          });
        }
      } else if (result.error === 'not_ranked') {
        updateQueuedMatchStatus(matchId, 'not_ranked', 'Match is Casual / Unranked.', false);
      } else if (result.error === 'season_2_blocked') {
        updateQueuedMatchStatus(matchId, 'failed', result.message || 'Season 2 matches are not supported yet.', false);
      } else if (result.error === 'not_in_match') {
        updateQueuedMatchStatus(matchId, 'failed', 'Profile was not part of this match.', false);
      } else if (result.error === 'rate_limited') {
        updateQueuedMatchStatus(
          matchId,
          'failed',
          result.message || 'Rate limit reached (3 requests/hour). Quota cooldown active.',
          false
        );
      } else {
        updateQueuedMatchStatus(
          matchId,
          'failed',
          result.message || 'Not yet indexed by Valve API. Cooldown active.',
          true
        );
      }
    } catch (err: any) {
      updateQueuedMatchStatus(matchId, 'failed', err?.message || 'Network error.', true);
    } finally {
      setCheckingMatchId(null);
    }
  };

  return (
    <div className="steam-glass steam-panel rounded-xl p-5 border border-deadlock-border/80 shadow-lg flex flex-col gap-3">
      <div className="flex items-center justify-between border-b border-deadlock-border/50 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-deadlock-dark border border-deadlock-border/60 text-deadlock-brass">
            <Database className="w-4 h-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold uppercase tracking-wider text-deadlock-steam">
              File d&apos;Attente de Match ({matchQueue.length})
            </span>
            <span className="text-[10px] text-deadlock-muted">
              Matches awaiting Valve indexing or local verification
            </span>
          </div>
        </div>
      </div>

      {/* Manual Match ID Input with Date */}
      <form
        onSubmit={handleAddManualMatch}
        className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
      >
        <input
          type="text"
          placeholder="Queue Match ID (e.g. 106929743)..."
          value={manualMatchIdInput}
          onChange={(e) => setManualMatchIdInput(e.target.value.replace(/[^0-9]/g, ''))}
          className="flex-1 bg-deadlock-dark/80 border border-deadlock-border rounded-lg px-3 py-1.5 text-xs text-gray-200 placeholder-deadlock-muted/60 focus:outline-none focus:border-deadlock-accent font-mono transition-colors"
        />
        <input
          type="datetime-local"
          value={manualMatchDate}
          onChange={(e) => setManualMatchDate(e.target.value)}
          title="Date et heure approximative du match (requis pour l'ordre dans l'historique et le calcul de classement)"
          className="bg-deadlock-dark/80 border border-deadlock-border rounded-lg px-2.5 py-1.5 text-xs text-gray-300 font-mono focus:outline-none focus:border-deadlock-accent [color-scheme:dark]"
        />
        <button
          type="submit"
          disabled={!manualMatchIdInput.trim()}
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg btn-steampunk-primary text-black font-bold text-xs shadow-md disabled:opacity-50 transition-all shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Queue Match</span>
        </button>
      </form>

      {matchQueue.length === 0 ? (
        <div className="p-8 text-center flex flex-col items-center justify-center gap-2 text-deadlock-muted">
          <CheckCircle2 className="w-6 h-6 opacity-40 text-emerald-400" />
          <span className="text-xs">Queue is clear: all detected matches are processed.</span>
          <span className="text-[11px] text-deadlock-muted/70">
            Matches detected in-game automatically join this queue while awaiting Valve API
            indexing.
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-2 max-h-[380px] overflow-y-auto pr-1">
          {matchQueue.map((item) => {
            const elapsedFormatted = formatDurationDHM(item.detectedAt);
            const isChecking = checkingMatchId === item.matchId;
            const isImported = matches.some(
              (m) => m.matchId === item.matchId || m.id === String(item.matchId)
            );
            const displayStatus = isImported ? 'synced' : item.status;

            return (
              <div
                key={item.matchId}
                className="p-3 rounded-lg bg-deadlock-dark/60 border border-deadlock-border/50 flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {item.heroId ? <HeroAvatar heroId={item.heroId} size="sm" /> : null}
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-deadlock-steam">
                        #{item.matchId}
                      </span>
                      {item.heroName && (
                        <span className="text-[11px] text-deadlock-accent font-semibold">
                          {item.heroName}
                        </span>
                      )}
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.2 rounded border font-semibold ${
                          displayStatus === 'synced'
                            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                            : displayStatus === 'syncing'
                            ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
                            : displayStatus === 'not_ranked'
                            ? 'bg-zinc-500/20 border-zinc-500/40 text-zinc-300'
                            : displayStatus === 'failed'
                            ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                            : 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300'
                        }`}
                      >
                        {displayStatus.toUpperCase()}
                      </span>
                      <span
                        className={`text-[9px] font-mono px-1.5 py-0.2 rounded border font-semibold ${
                          item.source === 'log'
                            ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                            : 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                        }`}
                        title={
                          item.source === 'log'
                            ? 'Automatically detected in console.log'
                            : 'Manually added by ID'
                        }
                      >
                        {item.source === 'log' ? 'LOG' : 'MANUAL'}
                      </span>
                      {(item.attempts || 0) > 0 && (
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${
                            (item.attempts || 0) >= 5
                              ? 'bg-rose-500/20 border-rose-500/40 text-rose-300 font-bold'
                              : 'bg-deadlock-card border-deadlock-border/60 text-deadlock-muted'
                          }`}
                        >
                          {item.attempts} attempt{(item.attempts || 0) > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-deadlock-muted flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-deadlock-brass/70 shrink-0" />
                      <span>{elapsedFormatted} ago</span>
                      {item.message && (
                        <span className="text-gray-400 truncate">• {item.message}</span>
                      )}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {item.status !== 'synced' && (
                    <button
                      type="button"
                      onClick={() => handleCheckQueuedMatch(item.matchId)}
                      disabled={isChecking}
                      className="px-2.5 py-1 rounded bg-deadlock-card border border-deadlock-border hover:border-deadlock-brass text-[11px] text-deadlock-steam font-bold transition-all shadow-sm disabled:opacity-50"
                    >
                      {isChecking ? 'Checking...' : 'Check Now'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => removeMatchFromQueue(item.matchId)}
                    className="p-1 text-deadlock-muted hover:text-deadlock-loss transition-colors"
                    title="Remove from queue"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
