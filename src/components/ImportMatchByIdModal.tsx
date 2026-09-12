import React from 'react';
import { Search, RefreshCw } from 'lucide-react';

interface ImportMatchByIdModalProps {
  isOpen: boolean;
  onClose: () => void;
  matchIdInput: string;
  onMatchIdInputChange: (val: string) => void;
  isImporting: boolean;
  error: string | null;
  onSubmit: () => void;
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
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="bg-deadlock-panel border border-deadlock-border rounded-2xl w-full max-w-md p-6 shadow-2xl flex flex-col gap-4 relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Search className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold text-white">Import Match by ID</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-deadlock-muted hover:text-white text-lg p-1"
          >
            ✕
          </button>
        </div>

        <p className="text-xs text-deadlock-muted leading-relaxed">
          If a match was not listed in Valve's match history, enter its <strong>Match ID</strong> (e.g. <code>105073144</code>) to fetch its full metadata directly from the Deadlock API.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
          className="flex flex-col gap-3"
        >
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-300">Match ID</label>
            <input
              type="text"
              placeholder="e.g. 105073144"
              value={matchIdInput}
              onChange={(e) => onMatchIdInputChange(e.target.value)}
              className="bg-deadlock-dark border border-deadlock-border rounded-lg px-3 py-2 text-sm text-white font-mono placeholder:text-deadlock-muted focus:outline-none focus:border-deadlock-accent"
              autoFocus
            />
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
              className="px-3.5 py-1.5 text-xs font-semibold text-deadlock-muted hover:text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isImporting || !matchIdInput.trim()}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-deadlock-accent hover:bg-deadlock-accent/80 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm transition-all"
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
