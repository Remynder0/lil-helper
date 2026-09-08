import React, { useState, useEffect } from 'react';
import { MatchForm } from './components/MatchForm';
import { HeroAvatar } from './components/HeroAvatar';
import { fetchAllMatches, removeMatch } from './services/storage';
import { Match } from './types/match';
import { PlusCircle, History, Trophy, Skull, Trash2, Swords, Download, Upload } from 'lucide-react';
import { exportMatchesJson, importMatchesJson } from './services/storage';

type AppTab = 'log_match' | 'history';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppTab>('log_match');
  const [matches, setMatches] = useState<Match[]>([]);
  const [isLoadingMatches, setIsLoadingMatches] = useState<boolean>(true);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Load matches from storage on mount
  const loadMatches = async () => {
    setIsLoadingMatches(true);
    try {
      const data = await fetchAllMatches();
      setMatches(data);
    } catch (err) {
      console.error('Failed to load matches:', err);
    } finally {
      setIsLoadingMatches(false);
    }
  };

  useEffect(() => {
    loadMatches();
  }, []);

  const handleMatchSaved = (savedMatch: Match) => {
    setMatches((prev) => [savedMatch, ...prev]);
  };

  const handleDeleteMatch = async (id: string) => {
    const success = await removeMatch(id);
    if (success) {
      setMatches((prev) => prev.filter((m) => m.id !== id));
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

  // Quick stats
  const totalMatches = matches.length;
  const totalWins = matches.filter((m) => m.result === 'win').length;
  const winRate = totalMatches > 0 ? Math.round((totalWins / totalMatches) * 100) : 0;

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
              onClick={() => setActiveTab('log_match')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium text-xs transition-all ${
                activeTab === 'log_match'
                  ? 'bg-deadlock-border text-white shadow-sm'
                  : 'text-deadlock-muted hover:text-white'
              }`}
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Log Match</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium text-xs transition-all ${
                activeTab === 'history'
                  ? 'bg-deadlock-border text-white shadow-sm'
                  : 'text-deadlock-muted hover:text-white'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>History ({totalMatches})</span>
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
        {activeTab === 'log_match' ? (
          <MatchForm onMatchSaved={handleMatchSaved} />
        ) : (
          /* Match History View (Issue #6 Preview) */
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between pb-2 border-b border-deadlock-border/60">
              <div>
                <h2 className="text-base font-bold text-white">Recorded Match History</h2>
                <p className="text-xs text-deadlock-muted">
                  {totalMatches} match{totalMatches !== 1 ? 'es' : ''} logged in local storage
                </p>
              </div>
            </div>

            {isLoadingMatches ? (
              <div className="py-12 text-center text-deadlock-muted text-xs">Loading match history...</div>
            ) : matches.length === 0 ? (
              <div className="bg-deadlock-panel border border-deadlock-border rounded-xl p-12 flex flex-col items-center justify-center gap-3 text-center">
                <Swords className="w-10 h-10 text-deadlock-muted/50" />
                <h3 className="text-sm font-semibold text-gray-200">No matches recorded yet</h3>
                <p className="text-xs text-deadlock-muted max-w-sm">
                  Switch to the &quot;Log Match&quot; tab to record your first 6v6 draft outcome.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('log_match')}
                  className="mt-2 px-4 py-2 rounded-lg bg-white text-black font-bold text-xs hover:bg-gray-200 transition-colors"
                >
                  Record a Match
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {matches.map((m) => {
                  const enemySide = m.side === 'hidden_king' ? 'archmother' : 'hidden_king';
                  const dateStr = new Date(m.date).toLocaleString([], {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  });

                  return (
                    <div
                      key={m.id}
                      className="bg-deadlock-panel border border-deadlock-border hover:border-gray-500 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-colors"
                    >
                      {/* Left: Result Badge + Date + Notes */}
                      <div className="flex items-center gap-3 min-w-[200px]">
                        <div
                          className={`flex items-center justify-center w-9 h-9 rounded-lg shadow-md ${
                            m.result === 'win'
                              ? 'bg-deadlock-win/20 border border-deadlock-win/60 text-deadlock-win'
                              : 'bg-deadlock-loss/20 border border-deadlock-loss/60 text-deadlock-loss'
                          }`}
                        >
                          {m.result === 'win' ? (
                            <Trophy className="w-5 h-5" />
                          ) : (
                            <Skull className="w-5 h-5" />
                          )}
                        </div>
                        <div className="flex flex-col">
                          <span
                            className={`text-xs font-black uppercase tracking-wider ${
                              m.result === 'win' ? 'text-deadlock-win' : 'text-deadlock-loss'
                            }`}
                          >
                            {m.result === 'win' ? 'VICTORY' : 'DEFEAT'}
                          </span>
                          <span className="text-[11px] text-deadlock-muted">{dateStr}</span>
                          {m.notes && (
                            <span className="text-xs text-gray-300 italic mt-0.5 line-clamp-1">
                              &quot;{m.notes}&quot;
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Middle: 6v6 Team Draft Visuals */}
                      <div className="flex-1 flex flex-wrap items-center justify-center gap-4">
                        {/* Your Team */}
                        <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-deadlock-dark/60 border border-deadlock-border/40">
                          {/* My Hero (Highlighted) */}
                          <div title="Your Played Hero">
                            <HeroAvatar
                              heroId={m.myHeroId}
                              size="sm"
                              accentColor={m.side}
                              isHighlighted={true}
                            />
                          </div>
                          <span className="w-px h-6 bg-deadlock-border/60 mx-0.5" />
                          {/* Allies */}
                          {m.allies.map((allyId, idx) => (
                            <HeroAvatar key={idx} heroId={allyId} size="xs" accentColor={m.side} />
                          ))}
                        </div>

                        <span className="text-xs font-bold font-mono text-deadlock-muted">VS</span>

                        {/* Enemy Team */}
                        <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-deadlock-dark/60 border border-deadlock-border/40">
                          {m.enemies.map((enemyId, idx) => (
                            <HeroAvatar key={idx} heroId={enemyId} size="xs" accentColor={enemySide} />
                          ))}
                        </div>
                      </div>

                      {/* Right: Delete Action */}
                      <button
                        type="button"
                        onClick={() => handleDeleteMatch(m.id)}
                        className="p-2 text-deadlock-muted hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors"
                        title="Delete Match"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
