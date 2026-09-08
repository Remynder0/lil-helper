import React, { useState, useEffect } from 'react';
import { MatchForm } from './components/MatchForm';
import { HistoryList } from './components/HistoryList';
import { AnalyticsView } from './components/AnalyticsView';
import { fetchAllMatches, removeMatch } from './services/storage';
import { Match } from './types/match';
import { PlusCircle, History, BarChart2, Download, Upload } from 'lucide-react';
import { exportMatchesJson, importMatchesJson } from './services/storage';

type AppTab = 'log_match' | 'history' | 'analytics';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppTab>('log_match');
  const [matches, setMatches] = useState<Match[]>([]);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Load matches from storage on mount
  const loadMatches = async () => {
    try {
      const data = await fetchAllMatches();
      setMatches(data);
    } catch (err) {
      console.error('Failed to load matches:', err);
    }
  };

  useEffect(() => {
    loadMatches();
  }, []);

  const handleMatchSaved = (savedMatch: Match) => {
    setMatches((prev) => {
      const existingIdx = prev.findIndex((m) => m.id === savedMatch.id);
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = savedMatch;
        return updated;
      }
      return [savedMatch, ...prev];
    });

    if (editingMatch) {
      setEditingMatch(null);
      setActiveTab('history');
    }
  };

  const handleEditMatch = (match: Match) => {
    setEditingMatch(match);
    setActiveTab('log_match');
  };

  const handleCancelEdit = () => {
    setEditingMatch(null);
    setActiveTab('history');
  };

  const handleDeleteMatch = async (id: string) => {
    const success = await removeMatch(id);
    if (success) {
      setMatches((prev) => prev.filter((m) => m.id !== id));
      if (editingMatch && editingMatch.id === id) {
        setEditingMatch(null);
      }
    }
  };

  // Export matches to a downloadable JSON file
  const handleExport = async () => {
    try {
      const jsonStr = await exportMatchesJson();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `deadlock_matches_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  // Import matches from a selected JSON file
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const count = await importMatchesJson(text);
      await loadMatches();
      alert(`${count} matches successfully loaded!`);
    } catch (err) {
      console.error('Import failed:', err);
      alert('Invalid match data file format.');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Quick stats (cancelled matches are excluded from winrate calculation)
  const totalMatches = matches.length;
  const totalWins = matches.filter((m) => m.result === 'win').length;
  const totalDecided = matches.filter((m) => m.result === 'win' || m.result === 'loss').length;
  const winRate = totalDecided > 0 ? Math.round((totalWins / totalDecided) * 100) : 0;

  return (
    <div className="min-h-screen bg-deadlock-dark text-gray-100 flex flex-col">
      {/* Top Header */}
      <header className="border-b border-deadlock-border/80 bg-deadlock-panel/90 backdrop-blur px-6 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-gradient-to-br from-deadlock-hidden-king to-deadlock-archmother flex items-center justify-center text-black font-extrabold text-sm shadow-md">
            D
          </div>
          <div>
            <h1 className="text-base font-bold tracking-wide">Deadlock Draft & Match Analyzer</h1>
            <p className="text-xs text-deadlock-muted">Ranked Matchup & Synergy Companion</p>
          </div>
        </div>

        {/* Global Quick Stats */}
        <div className="flex items-center gap-4 text-xs">
          <div className="bg-deadlock-dark px-3 py-1.5 rounded-lg border border-deadlock-border flex items-center gap-3">
            <span className="text-deadlock-muted">
              Matches: <strong className="text-white">{totalMatches}</strong>
            </span>
            <span className="h-3 w-px bg-deadlock-border" />
            <span className="text-deadlock-muted">
              Winrate:{' '}
              <strong
                className={winRate >= 50 ? 'text-deadlock-win' : totalMatches > 0 ? 'text-deadlock-loss' : 'text-white'}
              >
                {totalMatches > 0 ? `${winRate}%` : 'N/A'}
              </strong>
            </span>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center bg-deadlock-dark p-1 rounded-lg border border-deadlock-border">
            <button
              type="button"
              onClick={() => {
                setActiveTab('log_match');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium text-xs transition-all ${
                activeTab === 'log_match'
                  ? 'bg-deadlock-border text-white shadow-sm'
                  : 'text-deadlock-muted hover:text-white'
              }`}
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>{editingMatch ? 'Edit Match' : 'Log Match'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingMatch(null);
                setActiveTab('history');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium text-xs transition-all ${
                activeTab === 'history'
                  ? 'bg-deadlock-border text-white shadow-sm'
                  : 'text-deadlock-muted hover:text-white'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>History ({totalMatches})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingMatch(null);
                setActiveTab('analytics');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium text-xs transition-all ${
                activeTab === 'analytics'
                  ? 'bg-deadlock-border text-white shadow-sm'
                  : 'text-deadlock-muted hover:text-white'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>Analytics</span>
            </button>
          </div>

          {/* Backup / Restore buttons */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleExport}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-deadlock-border bg-deadlock-dark hover:bg-deadlock-border/40 text-xs font-medium text-deadlock-muted hover:text-white transition-colors"
              title="Download backup file of all matches"
            >
              <Download className="w-3.5 h-3.5 text-deadlock-hidden-king" />
              <span className="hidden sm:inline">Export</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-deadlock-border bg-deadlock-dark hover:bg-deadlock-border/40 text-xs font-medium text-deadlock-muted hover:text-white transition-colors"
              title="Import matches from a JSON backup file"
            >
              <Upload className="w-3.5 h-3.5 text-deadlock-archmother" />
              <span className="hidden sm:inline">Import</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImport}
              accept=".json"
              className="hidden"
            />
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-6 flex flex-col gap-6">
        {activeTab === 'log_match' && (
          <MatchForm
            key={editingMatch ? editingMatch.id : 'new_match'}
            editingMatch={editingMatch}
            onMatchSaved={handleMatchSaved}
            onCancel={editingMatch ? handleCancelEdit : undefined}
          />
        )}
        {activeTab === 'history' && (
          <HistoryList
            matches={matches}
            onEditMatch={handleEditMatch}
            onDeleteMatch={handleDeleteMatch}
          />
        )}
        {activeTab === 'analytics' && (
          <AnalyticsView matches={matches} />
        )}
      </main>
    </div>
  );
};

export default App;
