import React from 'react';
import { Search, RefreshCw } from 'lucide-react';

interface ImportMatchByIdModalProps {
  isOpen: boolean;
  onClose: () => void;
  matchIdInput: string;
  onMatchIdInputChange: (val: string) => void;
  isImporting: boolean;
  error: string | null;
  onSubmit: (matchDateMs?: number) => void;
}

function getLocalDateTimeLocalString(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const min = pad(date.getMinutes());
  return `${y}-${m}-${d}T${h}:${min}`;
}

export const ImportMatchByIdModal: React.FC<ImportMatchByIdModalProps> = ({
  isOpen,
  onClose,
  matchIdInput,
  onMatchIdInputChange,
  isImporting,
  error,
  onSubmit,
}) => {
  const [matchDateTime, setMatchDateTime] = React.useState<string>(() =>
    getLocalDateTimeLocalString()
  );

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ts = matchDateTime ? new Date(matchDateTime).getTime() : Date.now();
    onSubmit(isNaN(ts) ? Date.now() : ts);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-md animate-fadeIn">
      <div className="liquid-glass-modal steam-panel rounded-2xl w-full max-w-md p-6 flex flex-col gap-4 relative overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Search className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold text-deadlock-steam">Import Match by ID</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-deadlock-muted hover:text-deadlock-steam text-lg p-1"
          >
            ✕
          </button>
        </div>

        <p className="text-xs text-deadlock-muted leading-relaxed">
          If a match was not listed in Valve's match history, enter its <strong>Match ID</strong> (e.g. <code>105073144</code>) to fetch its full metadata directly from the Deadlock API.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-300">Match ID</label>
            <input
              type="text"
              placeholder="e.g. 105073144"
              value={matchIdInput}
              onChange={(e) => onMatchIdInputChange(e.target.value)}
              className="bg-deadlock-card border border-deadlock-border rounded-lg px-3 py-2 text-sm text-deadlock-steam font-mono placeholder:text-deadlock-muted focus:outline-none focus:border-deadlock-accent"
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-gray-300">Match Date & Time</label>
              <span className="text-[10px] text-amber-400 font-medium">Required for history order & rating</span>
            </div>
            <input
              type="datetime-local"
              value={matchDateTime}
              onChange={(e) => setMatchDateTime(e.target.value)}
              className="bg-deadlock-card border border-deadlock-border rounded-lg px-3 py-2 text-xs text-deadlock-steam font-mono focus:outline-none focus:border-deadlock-accent [color-scheme:dark]"
            />
            <span className="text-[10px] text-deadlock-muted leading-tight">
              Inserts the match chronologically in your history and calculates rating progression using the correct preceding matches.
            </span>
          </div>

          {error && (
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 p-2.5 rounded-lg">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-semibold text-deadlock-muted hover:text-deadlock-steam rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isImporting || !matchIdInput.trim()}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-deadlock-dark bg-deadlock-accent hover:bg-deadlock-brass disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm transition-all"
            >
              {isImporting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Fetching Match...</span>
                </>
              ) : (
                <span>Import Match</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
