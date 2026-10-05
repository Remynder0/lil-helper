import React, { useState } from 'react';
import { AlertTriangle, X, RefreshCw, Disc, Clock, FileSearch, Loader2, CheckCircle, AlertCircle, Calendar } from 'lucide-react';
import { QueuedMatch, formatDurationDHM, updateQueuedMatchDate } from '../services/matchQueue';
import { HeroAvatar } from './HeroAvatar';
import { useDemParser } from '../hooks/useDemParser';
import { Match } from '../types/match';
import { persistMatch } from '../services/storage';
import { findPreviousRankedMatch } from '../services/rankedCalculator';

interface BlockedMatchesRecoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  blockedMatches: QueuedMatch[];
  allMatches: Match[];
  accountId: number;
  onCheckMatch?: (matchId: number) => void;
  onRemoveMatch?: (matchId: number) => void;
  onMatchImported?: (match: Match) => void;
}

function timestampToDatetimeLocal(ts: number): string {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Per-match row component with integrated .dem parser controls.
 */
const BlockedMatchRow: React.FC<{
  item: QueuedMatch;
  accountId: number;
  allMatches: Match[];
  onCheckMatch?: (matchId: number) => void;
  onRemoveMatch?: (matchId: number) => void;
  onMatchImported?: (match: Match) => void;
}> = ({ item, accountId, allMatches, onCheckMatch, onRemoveMatch, onMatchImported }) => {
  const [matchDateMs, setMatchDateMs] = useState<number>(item.detectedAt);
  const [dateInputVal, setDateInputVal] = useState<string>(() =>
    timestampToDatetimeLocal(item.detectedAt)
  );

  const { state, result, error, rankedTodo, parseFile, detectAndParse, reset } = useDemParser(
    item.matchId,
    accountId,
    allMatches,
    matchDateMs
  );
  const [manualPath, setManualPath] = useState('');

  const handleDateChange = (val: string) => {
    setDateInputVal(val);
    const ts = new Date(val).getTime();
    if (!isNaN(ts) && ts > 0) {
      setMatchDateMs(ts);
      updateQueuedMatchDate(item.matchId, ts);
    }
  };

  const olderIncomplete = allMatches.filter(
    (m) =>
      m.isIncomplete &&
      (m.matchId || m.id) !== (item.matchId || String(item.matchId)) &&
      new Date(m.date).getTime() < matchDateMs
  );
  const hasOlderIncomplete = olderIncomplete.length > 0;
  const oldestIncomplete = olderIncomplete.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  )[0];

  const handleAutoDetect = async () => {
    if (hasOlderIncomplete) return;
    const match = await detectAndParse(matchDateMs);
    if (match && onMatchImported) {
      try {
        await persistMatch(match);
        onMatchImported(match);
      } catch (err) {
        console.error('Failed to save parsed match:', err);
      }
    }
  };

  const handleManualParse = async () => {
    if (hasOlderIncomplete || !manualPath.trim()) return;
    const match = await parseFile(manualPath.trim(), matchDateMs);
    if (match && onMatchImported) {
      try {
        await persistMatch(match);
        onMatchImported(match);
      } catch (err) {
        console.error('Failed to save parsed match:', err);
      }
    }
  };

  const prevMatch = findPreviousRankedMatch(new Date(matchDateMs).toISOString(), allMatches);

  return (
    <div className="p-3 rounded-xl bg-deadlock-dark/80 border border-deadlock-border/70 flex flex-col gap-2.5 text-xs">
      {/* Match info row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {item.heroId ? (
            <HeroAvatar heroId={item.heroId} size="sm" />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-deadlock-card border border-deadlock-border flex items-center justify-center text-deadlock-muted text-xs font-bold">
              ?
            </div>
          )}

          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-gray-200">
                Match #{item.matchId}
              </span>
              
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold">
                {item.attempts} attempts
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-[11px] text-deadlock-accent">
                {item.heroName || (item.heroId ? `Hero #${item.heroId}` : 'Hero not detected')}
              </span>
              <span className="text-[10px] text-deadlock-muted flex items-center gap-1 font-mono">
                <Clock className="w-3 h-3 text-deadlock-brass/70 shrink-0" />
                <span>{formatDurationDHM(matchDateMs)} ago</span>
              </span>
            </div>
            {item.message && (
              <span className="text-[10px] text-deadlock-muted truncate max-w-sm">
                {item.message}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onCheckMatch && (
            <button
              type="button"
              onClick={() => onCheckMatch(item.matchId)}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-deadlock-card border border-deadlock-border hover:border-deadlock-brass text-[11px] text-deadlock-steam font-bold transition-all shadow-sm"
              title="Retry API check"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry</span>
            </button>
          )}
          {onRemoveMatch && (
            <button
              type="button"
              onClick={() => onRemoveMatch(item.matchId)}
              className="p-1 text-deadlock-muted hover:text-deadlock-loss transition-colors"
              title="Retirer de la file d'attente"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Date selector & previous match context */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-lg bg-deadlock-card/50 border border-deadlock-border/40 text-[11px]">
        <div className="flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-deadlock-accent shrink-0" />
          <span className="text-gray-300 font-medium">Match date:</span>
          <input
            type="datetime-local"
            value={dateInputVal}
            onChange={(e) => handleDateChange(e.target.value)}
            className="px-2 py-0.5 rounded bg-deadlock-dark border border-deadlock-border text-gray-200 font-mono text-[11px] focus:outline-none focus:border-amber-400/80 [color-scheme:dark]"
            title="Exact date used for history order and rating calculation"
          />
        </div>
        <div className="text-[10px] font-mono text-deadlock-muted">
          {prevMatch ? (
            <span className="text-gray-300">
              Previous: <strong className="text-deadlock-steam">#{prevMatch.matchId || prevMatch.id}</strong> (
              <span className={prevMatch.result === 'win' ? 'text-emerald-400' : 'text-rose-400'}>
                {prevMatch.result === 'win' ? 'W' : 'L'}
              </span>
              , {prevMatch.rankedProgress ?? '?'} pts)
            </span>
          ) : (
            <span className="text-amber-400/80 italic">First ranked match</span>
          )}
        </div>
      </div>

      {/* DEM Parser controls */}
      <div className="flex items-center gap-2 pt-1 border-t border-deadlock-border/40">
        {state === 'idle' && (
          <>
            <button
              type="button"
              onClick={handleAutoDetect}
              disabled={hasOlderIncomplete}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-950/30 border border-purple-500/40 hover:border-purple-400 text-purple-300 hover:text-purple-200 text-[11px] font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              title={
                hasOlderIncomplete
                  ? `Import blocked: resolve earlier match #${oldestIncomplete.matchId} first`
                  : 'Auto-detects .dem file in Steam directory'
              }
            >
              <FileSearch className="w-3.5 h-3.5" />
              Scan .dem
            </button>
            <div className="flex items-center gap-1.5 flex-1">
              <input
                type="text"
                value={manualPath}
                disabled={hasOlderIncomplete}
                onChange={(e) => setManualPath(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleManualParse();
                }}
                placeholder="Or enter path to .dem..."
                className="flex-1 px-2 py-1 rounded-lg bg-deadlock-dark border border-deadlock-border/60 text-[11px] text-gray-300 placeholder-deadlock-muted/60 focus:border-purple-500/60 focus:outline-none disabled:opacity-40"
              />
              {manualPath.trim().length > 0 && (
                <button
                  onClick={handleManualParse}
                  disabled={hasOlderIncomplete}
                  className="px-2 py-1 rounded-lg bg-purple-600/80 hover:bg-purple-600 text-white font-medium text-[11px] transition-colors disabled:opacity-40"
                >
                  Parse
                </button>
              )}
            </div>
          </>
        )}

        {(state === 'detecting' || state === 'parsing') && (
          <div className="flex items-center gap-2 text-purple-300 text-[11px]">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>{state === 'detecting' ? 'Searching for replay file...' : 'Parsing replay in progress...'}</span>
          </div>
        )}

        {state === 'success' && result && (
          <div className="flex items-center gap-2 text-green-400 text-[11px]">
            <CheckCircle className="w-4 h-4" />
            <span>
              Match imported! {result.result === 'win' ? '✅ Victory' : result.result === 'loss' ? '❌ Defeat' : '⚪ Cancelled'}
              {result.durationSeconds ? ` — ${Math.floor(result.durationSeconds / 60)}min` : ''}
            </span>
          </div>
        )}

        {state === 'error' && (
          <div className="flex items-center gap-2 text-[11px]">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <span className="text-red-300 truncate max-w-md">{error}</span>
            <button
              type="button"
              onClick={reset}
              className="px-2 py-1 rounded bg-deadlock-card border border-deadlock-border text-[10px] text-gray-400 hover:text-gray-200 transition-colors"
            >
              Retry
            </button>
          </div>
        )}
      </div>

      {/* Ranked calculated progression preview */}
      {state === 'success' && rankedTodo && rankedTodo.calculated && (
        <div className="p-2.5 rounded-lg bg-amber-950/20 border border-amber-500/30 text-[10px] text-amber-200/90 font-mono leading-relaxed flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-amber-400 font-bold uppercase tracking-wider text-[9px]">
              Ranked :
            </span>
            {rankedTodo.calculated.rankedDelta !== null && rankedTodo.calculated.rankedDelta !== undefined && (
              <span className={`px-2 py-0.5 rounded font-bold text-xs ${
                rankedTodo.calculated.rankedDelta > 0
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : rankedTodo.calculated.rankedDelta < 0
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  : 'bg-gray-500/20 text-gray-300'
              }`}>
                {rankedTodo.calculated.rankedDelta > 0 ? '+' : ''}{rankedTodo.calculated.rankedDelta} pts
              </span>
            )}
            {rankedTodo.calculated.rankedProgress !== null && (
              <span className="text-gray-300">
                ({rankedTodo.calculated.rankedProgress} pts)
              </span>
            )}
          </div>
          {rankedTodo.calculated.rankedDemotionProtection !== null && (
            <div className="text-[10px] text-amber-300/80">
              {rankedTodo.calculated.rankedConsumedDemotionProtection && (
                <span className="text-rose-400 font-bold mr-1.5">🛡️ Shield Consumed</span>
              )}
              <span>{rankedTodo.calculated.rankedDemotionProtection} shield{rankedTodo.calculated.rankedDemotionProtection > 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const BlockedMatchesRecoveryModal: React.FC<BlockedMatchesRecoveryModalProps> = ({
  isOpen,
  onClose,
  blockedMatches,
  allMatches,
  accountId,
  onCheckMatch,
  onRemoveMatch,
  onMatchImported,
}) => {
  if (!isOpen || blockedMatches.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
      <div className="liquid-glass-modal steam-panel rounded-2xl w-full max-w-2xl p-6 flex flex-col gap-5 relative overflow-hidden border border-amber-500/40 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-deadlock-border/60 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <h3 className="text-base font-bold text-deadlock-steam flex items-center gap-2">
                <span>API Blocked Matches ({blockedMatches.length})</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  &gt; 24h without API sync
                </span>
              </h3>
              <p className="text-xs text-deadlock-muted">
                Detected in logs more than 24h ago and not indexed by Valve Web API
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-deadlock-muted hover:text-deadlock-steam text-lg p-1 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* List of Blocked Matches with DEM Parser */}
        <div className="flex flex-col gap-2.5 max-h-72 overflow-y-auto pr-1">
          {blockedMatches.map((item) => (
            <BlockedMatchRow
              key={item.matchId}
              item={item}
              accountId={accountId}
              allMatches={allMatches}
              onCheckMatch={onCheckMatch}
              onRemoveMatch={onRemoveMatch}
              onMatchImported={onMatchImported}
            />
          ))}
        </div>

        {/* Process & Explanation */}
        <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/30 flex flex-col gap-2.5">
          <div className="flex items-center gap-2 text-purple-300 font-bold text-xs uppercase tracking-wider">
            <Disc className="w-4 h-4 text-purple-400" />
            <span>Recovery Process: Parse Replay (.dem)</span>
          </div>
          <div className="text-xs text-gray-300 space-y-1.5 leading-relaxed">
            <p>
              These matches are visible in your Deadlock client, but Valve Web servers have not indexed them:
            </p>
            <ol className="list-decimal list-inside space-y-1 text-deadlock-muted text-[11px]">
              <li>
                <strong className="text-gray-200">In Deadlock:</strong> Open your in-game profile &rarr; Match History &rarr; Click match &rarr; <strong>"Download Replay"</strong>.
              </li>
              <li>
                <strong className="text-gray-200">Scan:</strong> Click "Scan .dem" to auto-detect the replay in your Steam folder, or enter the path manually.
              </li>
              <li>
                <strong className="text-gray-200">Import:</strong> The application parses the local replay and imports match and rank progression data.
              </li>
            </ol>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] text-deadlock-muted">
            Matches remain in your pending queue while awaiting sync.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl btn-steampunk-primary text-black font-bold text-xs shadow-md transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
