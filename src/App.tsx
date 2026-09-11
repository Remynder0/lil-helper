import React, { useState, useEffect } from 'react';
import { MatchForm } from './components/MatchForm';
import { HistoryList } from './components/HistoryList';
import { AnalyticsView } from './components/AnalyticsView';
import { DraftAssistantView } from './components/DraftAssistantView';
import { ProfileConnectModal } from './components/ProfileConnectModal';
import { fetchAllMatches, removeMatch, persistMatches } from './services/storage';
import { Match, ConnectedProfile } from './types/match';
import { syncRankedMatchesForAccount } from './services/deadlockApi';
import {
  PlusCircle,
  History,
  BarChart2,
  Brain,
  Download,
  Upload,
  User,
  RefreshCw,
  Terminal,
  ChevronDown,
  LogOut,
  FolderSync,
} from 'lucide-react';
import { exportMatchesJson, importMatchesJson } from './services/storage';
import { GameLogMonitor } from './components/GameLogMonitor';
import { PlayerStateBadge } from './components/PlayerStateBadge';
import { useDeadlockGameState } from './hooks/useDeadlockGameState';

const PROFILE_STORAGE_KEY = 'deadlock_connected_profile';

type AppTab = 'log_match' | 'history' | 'analytics' | 'assistant' | 'logs';

export const App: React.FC = () => {
  const { gameContext } = useDeadlockGameState();
  const [activeTab, setActiveTab] = useState<AppTab>('history');
  const [matches, setMatches] = useState<Match[]>([]);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const profileMenuRef = React.useRef<HTMLDivElement>(null);

  // Connected Steam profile state
  const [profile, setProfile] = useState<ConnectedProfile | null>(() => {
    try {
      const saved = localStorage.getItem(PROFILE_STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusText, setSyncStatusText] = useState<string | null>(null);

  // 2-minute cooldown timer for API refresh
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(() => {
    try {
      const lastSync = localStorage.getItem('last_api_refresh_timestamp');
      if (lastSync) {
        const elapsedSec = Math.floor((Date.now() - parseInt(lastSync, 10)) / 1000);
        return Math.max(0, 120 - elapsedSec);
      }
    } catch {}
    return 0;
  });

  useEffect(() => {
    if (cooldownRemaining <= 0) return;
    const interval = setInterval(() => {
      setCooldownRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldownRemaining]);

  // Load matches from storage on mount (sorted newest to oldest)
  const loadMatches = async () => {
    try {
      const data = await fetchAllMatches();
      const sorted = [...data].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      setMatches(sorted);
    } catch (err) {
      console.error('Failed to load matches:', err);
    }
  };

  useEffect(() => {
    loadMatches();
  }, []);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target as Node)
      ) {
        setIsProfileMenuOpen(false);
      }
    };
    if (isProfileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isProfileMenuOpen]);

  // Sync ranked matches for connected profile in incremental mode (only fetches new matches)
  const handleSyncMatches = async (targetProfile = profile, forceUpdate = false) => {
    if (!targetProfile || isSyncing || (cooldownRemaining > 0 && !forceUpdate)) return;

    setIsSyncing(true);
    setSyncStatusText('Checking for new ranked matches...');
    try {
      const existingIds = new Set<string | number>();
      matches.forEach((m) => {
        existingIds.add(m.id);
        if (m.matchId) existingIds.add(m.matchId);
      });

      const { addedMatches, totalRankedFound } = await syncRankedMatchesForAccount(
        targetProfile.accountId,
        existingIds,
        forceUpdate
      );

      if (addedMatches.length > 0) {
        await persistMatches(addedMatches);
        setMatches((prev) => {
          const map = new Map<string, Match>();
          // Put updated matches first
          addedMatches.forEach((m) => map.set(m.id, m));
          // Put existing manual or non-overlapping matches
          prev.forEach((m) => {
            if (!map.has(m.id)) {
              map.set(m.id, m);
            }
          });
          return Array.from(map.values()).sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
          );
        });
        setSyncStatusText(`+${addedMatches.length} new ranked match${addedMatches.length > 1 ? 'es' : ''} imported!`);
      } else {
        setSyncStatusText(`Up to date (${totalRankedFound} ranked found in history)`);
      }

      // Update lastSyncedAt and trigger 2-minute cooldown (120s)
      const now = Date.now();
      localStorage.setItem('last_api_refresh_timestamp', String(now));
      setCooldownRemaining(120);

      const updatedProfile: ConnectedProfile = {
        ...targetProfile,
        lastSyncedAt: new Date(now).toISOString(),
      };
      setProfile(updatedProfile);
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(updatedProfile));
    } catch (err) {
      console.error('Sync failed:', err);
      setSyncStatusText('Sync failed. Please try again.');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatusText(null), 5000);
    }
  };

  const handleConnectProfile = (newProfile: ConnectedProfile) => {
    setProfile(newProfile);
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(newProfile));
    handleSyncMatches(newProfile);
  };

  const handleDisconnectProfile = () => {
    setProfile(null);
    localStorage.removeItem(PROFILE_STORAGE_KEY);
    setSyncStatusText(null);
  };

  const handleMatchSaved = (savedMatch: Match) => {
    setMatches((prev) => {
      const existingIdx = prev.findIndex((m) => m.id === savedMatch.id);
      let nextList: Match[];
      if (existingIdx >= 0) {
        nextList = [...prev];
        nextList[existingIdx] = savedMatch;
      } else {
        nextList = [savedMatch, ...prev];
      }
      return nextList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
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
            <button
              type="button"
              onClick={() => {
                setEditingMatch(null);
                setActiveTab('assistant');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium text-xs transition-all ${
                activeTab === 'assistant'
                  ? 'bg-deadlock-accent text-white shadow-sm'
                  : 'text-deadlock-muted hover:text-white'
              }`}
            >
              <Brain className="w-3.5 h-3.5" />
              <span>Draft Assistant</span>
            </button>
          </div>

          {/* Hidden file input for Import */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImport}
            accept=".json"
            className="hidden"
          />

          {/* Live Player Status & Steam Profile Sync */}
          <div className="flex items-center gap-2.5 pl-2 border-l border-deadlock-border/60">
            <PlayerStateBadge
              state={gameContext.state}
              stateLabel={gameContext.stateLabel}
              playerName={gameContext.playerName}
              heroName={gameContext.myHeroName}
              mapName={gameContext.mapName}
            />

            {profile ? (
              <div className="flex items-center gap-2 bg-deadlock-dark p-1 rounded-lg border border-deadlock-border relative">
                {/* Profile Pill Dropdown Trigger */}
                <div ref={profileMenuRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setIsProfileMenuOpen((prev) => !prev)}
                    className="flex items-center gap-2 px-2 py-1 rounded hover:bg-deadlock-panel transition-colors text-left"
                    title="Profile & Options Menu"
                  >
                    {profile.avatarUrl ? (
                      <img
                        src={profile.avatarUrl}
                        alt={profile.personaName}
                        className="w-5 h-5 rounded-full object-cover border border-deadlock-border shrink-0"
                      />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-deadlock-panel border border-deadlock-border flex items-center justify-center text-deadlock-accent text-[10px] shrink-0 font-black">
                        {profile.personaName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="text-xs font-bold text-gray-200 max-w-[90px] truncate hidden sm:inline">
                      {profile.personaName}
                    </span>
                    <ChevronDown className={`w-3 h-3 text-deadlock-muted transition-transform ${isProfileMenuOpen ? 'rotate-180 text-white' : ''}`} />
                  </button>

                  {/* Profile Dropdown Menu */}
                  {isProfileMenuOpen && (
                    <div className="absolute right-0 top-full mt-2 w-56 rounded-xl bg-deadlock-panel border border-deadlock-border shadow-2xl py-1.5 z-50 flex flex-col text-xs animate-fadeIn">
                      {/* Header in dropdown */}
                      <div className="px-3 py-2 border-b border-deadlock-border/60 flex flex-col">
                        <span className="text-[11px] font-bold text-white truncate">
                          {profile.personaName}
                        </span>
                        <span className="text-[10px] text-deadlock-muted font-mono">
                          ID: {profile.accountId}
                        </span>
                      </div>

                      {/* Add Match Option */}
                      <button
                        type="button"
                        onClick={() => {
                          setEditingMatch(null);
                          setActiveTab('log_match');
                          setIsProfileMenuOpen(false);
                        }}
                        className="flex items-center gap-2.5 px-3 py-2 text-gray-200 hover:bg-deadlock-border/40 hover:text-white transition-colors text-left"
                      >
                        <PlusCircle className="w-4 h-4 text-deadlock-accent shrink-0" />
                        <span>Add Match (Manual)</span>
                      </button>

                      {/* Debug Console Option */}
                      <button
                        type="button"
                        onClick={() => {
                          setEditingMatch(null);
                          setActiveTab('logs');
                          setIsProfileMenuOpen(false);
                        }}
                        className="flex items-center gap-2.5 px-3 py-2 text-gray-200 hover:bg-deadlock-border/40 hover:text-white transition-colors text-left"
                      >
                        <Terminal className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>Debug Console</span>
                      </button>

                      {/* Switch Account */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsProfileModalOpen(true);
                          setIsProfileMenuOpen(false);
                        }}
                        className="flex items-center gap-2.5 px-3 py-2 text-gray-200 hover:bg-deadlock-border/40 hover:text-white transition-colors text-left"
                      >
                        <FolderSync className="w-4 h-4 text-blue-400 shrink-0" />
                        <span>Switch Profile</span>
                      </button>

                      <div className="h-px bg-deadlock-border/60 my-1" />

                      {/* Export Matches */}
                      <button
                        type="button"
                        onClick={() => {
                          handleExport();
                          setIsProfileMenuOpen(false);
                        }}
                        className="flex items-center gap-2.5 px-3 py-2 text-gray-200 hover:bg-deadlock-border/40 hover:text-white transition-colors text-left"
                      >
                        <Download className="w-4 h-4 text-deadlock-hidden-king shrink-0" />
                        <span>Export Matches (JSON)</span>
                      </button>

                      {/* Import Matches */}
                      <button
                        type="button"
                        onClick={() => {
                          fileInputRef.current?.click();
                          setIsProfileMenuOpen(false);
                        }}
                        className="flex items-center gap-2.5 px-3 py-2 text-gray-200 hover:bg-deadlock-border/40 hover:text-white transition-colors text-left"
                      >
                        <Upload className="w-4 h-4 text-deadlock-archmother shrink-0" />
                        <span>Import Matches (JSON)</span>
                      </button>

                      <div className="h-px bg-deadlock-border/60 my-1" />

                      {/* Disconnect Profile */}
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm('Disconnect your profile? Existing saved matches will remain stored locally.')) {
                            handleDisconnectProfile();
                            setIsProfileMenuOpen(false);
                          }
                        }}
                        className="flex items-center gap-2.5 px-3 py-2 text-red-400 hover:bg-red-950/30 hover:text-red-300 transition-colors text-left"
                      >
                        <LogOut className="w-4 h-4 shrink-0" />
                        <span>Disconnect</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Manual Sync / Refresh Button with 2-min cooldown */}
                <button
                  type="button"
                  onClick={() => handleSyncMatches()}
                  disabled={isSyncing || cooldownRemaining > 0}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold transition-all ${
                    isSyncing
                      ? 'bg-deadlock-accent/20 text-deadlock-accent cursor-not-allowed'
                      : cooldownRemaining > 0
                      ? 'bg-deadlock-border/40 text-deadlock-muted border border-deadlock-border/60 cursor-not-allowed'
                      : 'bg-deadlock-accent text-black hover:bg-yellow-400 shadow-sm'
                  }`}
                  title={
                    cooldownRemaining > 0
                      ? `Please wait ${Math.floor(cooldownRemaining / 60)}m ${cooldownRemaining % 60}s before refreshing again to prevent API rate limits.`
                      : 'Refresh & sync new ranked matches from Deadlock API'
                  }
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span className="hidden md:inline">
                    {isSyncing
                      ? 'Syncing...'
                      : cooldownRemaining > 0
                      ? `Refresh (${Math.floor(cooldownRemaining / 60)}:${String(cooldownRemaining % 60).padStart(2, '0')})`
                      : 'Refresh'}
                  </span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsProfileModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-deadlock-dark border border-deadlock-accent/50 hover:border-deadlock-accent text-xs font-bold text-deadlock-accent hover:text-white transition-all shadow-sm"
              >
                <User className="w-3.5 h-3.5" />
                <span>Connect Profile</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Sync Status Banner / Toast */}
      {syncStatusText && (
        <div className="bg-deadlock-panel/90 border-b border-deadlock-accent/40 px-6 py-2 text-xs flex items-center justify-between text-gray-200 animate-fadeIn">
          <div className="flex items-center gap-2">
            <RefreshCw className={`w-3.5 h-3.5 text-deadlock-accent ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{syncStatusText}</span>
          </div>
          <button
            type="button"
            onClick={() => setSyncStatusText(null)}
            className="text-deadlock-muted hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

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
        {activeTab === 'assistant' && (
          <DraftAssistantView matches={matches} gameContext={gameContext} />
        )}
        {activeTab === 'logs' && (
          <GameLogMonitor />
        )}
      </main>

      {/* Profile Connect Modal */}
      <ProfileConnectModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        currentProfile={profile}
        onConnect={handleConnectProfile}
        onDisconnect={handleDisconnectProfile}
      />
    </div>
  );
};

export default App;
