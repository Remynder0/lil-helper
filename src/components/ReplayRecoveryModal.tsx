import React, { useState } from 'react';
import { Disc, FileSearch, Loader2, CheckCircle, AlertCircle, AlertTriangle, X } from 'lucide-react';
import { Match } from '../types/match';
import { useDemParser } from '../hooks/useDemParser';
import { persistMatch } from '../services/storage';
import { removeMatchFromQueue } from '../services/matchQueue';

interface ReplayRecoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  match: Match | null;
  accountId: number;
  allMatches: Match[];
  onMatchImported: (match: Match) => void;
}

export const ReplayRecoveryModal: React.FC<ReplayRecoveryModalProps> = ({
  isOpen,
  onClose,
  match,
  accountId,
  allMatches,
  onMatchImported,
}) => {
  if (!isOpen || !match) return null;

  const matchId = match.matchId || parseInt(match.id.replace(/\D/g, ''), 10) || 0;
  const matchTimestamp = new Date(match.date).getTime();

  const { state, result, error, parseFile, detectAndParse, reset } = useDemParser(
    matchId,
    accountId,
    allMatches,
    matchTimestamp
  );

  const [manualPath, setManualPath] = useState('');

  // Chronological integrity check: are there older incomplete matches?
  const olderIncompleteMatches = allMatches
    .filter(
      (m) =>
        m.isIncomplete &&
        (m.matchId || m.id) !== (match.matchId || match.id) &&
        new Date(m.date).getTime() < matchTimestamp
    )
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const hasOlderIncomplete = olderIncompleteMatches.length > 0;
  const oldestIncomplete = olderIncompleteMatches[0];

  const handleAutoDetect = async () => {
    if (hasOlderIncomplete) return;
    const importedMatch = await detectAndParse(matchTimestamp);
    if (importedMatch) {
      try {
        await persistMatch(importedMatch);
        onMatchImported(importedMatch);
        setTimeout(() => onClose(), 1000);
      } catch (err) {
        console.error('Failed to save parsed match:', err);
      }
    }
  };

  const handleManualParse = async () => {
    if (hasOlderIncomplete || !manualPath.trim()) return;
    const importedMatch = await parseFile(manualPath.trim(), matchTimestamp);
    if (importedMatch) {
      try {
        await persistMatch(importedMatch);
        onMatchImported(importedMatch);
        setTimeout(() => onClose(), 1000);
      } catch (err) {
        console.error('Failed to save parsed match:', err);
      }
    }
  };

  const formattedDate = new Date(match.date).toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
      <div className="liquid-glass-modal steam-panel rounded-2xl w-full max-w-xl p-6 flex flex-col gap-4 relative overflow-hidden border border-purple-500/40 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-deadlock-border/60 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/15 border border-purple-500/40 text-purple-300">
              <Disc className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <h3 className="text-base font-bold text-gray-100 flex items-center gap-2">
                <span>Replay Recovery</span>
                <span className="font-mono text-purple-300">#{matchId}</span>
              </h3>
              <span className="text-[11px] text-deadlock-muted font-mono">{formattedDate}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-deadlock-muted hover:text-gray-200 hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Older incomplete match blocking banner */}
        {hasOlderIncomplete && (
          <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs flex flex-col gap-1.5">
            <div className="flex items-center gap-2 font-bold text-amber-300">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Import blocked: earlier incomplete match</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              To maintain rating and progression integrity, matches must be imported in chronological order.
              Match <strong>#{oldestIncomplete.matchId}</strong> ({new Date(oldestIncomplete.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}) was played earlier and must be synchronized first.
            </p>
          </div>
        )}

        {/* Purple Process Frame */}
        <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/30 flex flex-col gap-2.5">
          <div className="flex items-center gap-2 text-purple-300 font-bold text-xs uppercase tracking-wider">
            <Disc className="w-4 h-4 text-purple-400" />
            <span>Recovery Process: Parse Replay (.dem)</span>
          </div>
          <div className="text-xs text-gray-300 space-y-1.5 leading-relaxed">
            <p>
              This match is visible in your Deadlock client, but Valve Web servers haven't indexed it after 5+ hours:
            </p>
            <ol className="list-decimal list-inside space-y-1 text-deadlock-muted text-[11px]">
              <li>
                <strong className="text-gray-200">In Deadlock:</strong> Open your profile &rarr; Match History &rarr; Click match &rarr; <strong>"Download Replay"</strong>.
              </li>
              <li>
                <strong className="text-gray-200">Scan:</strong> Click <strong>"Import Replay (.dem)"</strong> to auto-detect <code>{matchId}.dem</code> in your Steam directory.
              </li>
              <li>
                <strong className="text-gray-200">Import:</strong> The application parses the local replay and imports match and rank progression data.
              </li>
            </ol>
          </div>
        </div>

        {/* Actions & Status */}
        <div className="flex flex-col gap-2.5 pt-1">
          {state === 'idle' && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <button
                type="button"
                onClick={handleAutoDetect}
                disabled={hasOlderIncomplete}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs shadow-lg shadow-purple-950/40 transition-all shrink-0 cursor-pointer"
                title={
                  hasOlderIncomplete
                    ? `Please resolve earlier match #${oldestIncomplete.matchId} first`
                    : 'Auto-detects the .dem in your Steam directory and parses it'
                }
              >
                <FileSearch className="w-4 h-4" />
                <span>Import Replay (.dem)</span>
              </button>

              <div className="flex items-center gap-1.5 flex-1">
                <input
                  type="text"
                  placeholder="Or enter path to .dem..."
                  value={manualPath}
                  disabled={hasOlderIncomplete}
                  onChange={(e) => setManualPath(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl bg-deadlock-dark border border-deadlock-border/70 text-xs text-gray-200 placeholder-deadlock-muted/60 focus:border-purple-400 focus:outline-none disabled:opacity-40"
                />
                <button
                  type="button"
                  onClick={handleManualParse}
                  disabled={hasOlderIncomplete || !manualPath.trim()}
                  className="px-3 py-2 rounded-xl bg-purple-950/40 border border-purple-500/50 hover:bg-purple-900/50 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold text-purple-200 transition-all"
                >
                  Parse
                </button>
              </div>
            </div>
          )}

          {(state === 'detecting' || state === 'parsing') && (
            <div className="p-3.5 rounded-xl bg-purple-950/30 border border-purple-500/40 flex items-center gap-3 text-purple-200 text-xs font-semibold animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin text-purple-400 shrink-0" />
              <span>
                {state === 'detecting'
                  ? 'Searching for replay file in your Steam directory...'
                  : 'Parsing Source 2 replay in progress...'}
              </span>
            </div>
          )}

          {state === 'error' && (
            <div className="flex flex-col gap-2">
              <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/40 flex items-center justify-between gap-3 text-rose-300 text-xs">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{error}</span>
                </div>
                <button
                  type="button"
                  onClick={reset}
                  className="px-2.5 py-1 rounded bg-black/40 hover:bg-black/60 text-gray-300 border border-rose-500/30 text-[11px] font-bold transition-all"
                >
                  Retry
                </button>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-black/40 border border-rose-950/40 mt-1">
                <span className="text-[11px] text-deadlock-muted leading-relaxed max-w-[65%]">
                  <strong className="text-gray-300 block mb-1">Match not found?</strong>
                  Make sure you actually clicked <em>"Download Replay"</em> in-game. If this match was cancelled early (AFK) and never had a replay, you can safely discard it.
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Discard this match? It will be removed from your history completely.')) {
                      removeMatchFromQueue(matchId);
                      onClose();
                    }
                  }}
                  className="px-3 py-2 rounded-lg bg-rose-950/50 hover:bg-rose-900/60 text-rose-300 border border-rose-500/30 text-[11px] font-bold transition-all whitespace-nowrap"
                >
                  Discard Match
                </button>
              </div>
            </div>
          )}

          {state === 'success' && result && (
            <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/40 flex items-center gap-2 text-emerald-300 text-xs font-semibold">
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Match #{result.matchId || matchId} imported successfully!</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
