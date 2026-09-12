import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MatchForm } from './components/MatchForm';
import { HistoryList } from './components/HistoryList';
import { AnalyticsView } from './components/AnalyticsView';
import { DraftAssistantView } from './components/DraftAssistantView';
import { ProfileConnectModal } from './components/ProfileConnectModal';
import { GameLogMonitor } from './components/GameLogMonitor';
import { AppHeader, AppTab } from './components/AppHeader';
import { ImportMatchByIdModal } from './components/ImportMatchByIdModal';
import { useProfileSync } from './hooks/useProfileSync';
import { useDeadlockGameState } from './hooks/useDeadlockGameState';
import {
  fetchAllMatches,
  removeMatch,
  saveTrackedPendingMatch,
  exportMatchesJson,
  importMatchesJson,
} from './services/storage';
import { Match } from './types/match';
import { RefreshCw } from 'lucide-react';

export const App: React.FC = () => {
  const { gameContext } = useDeadlockGameState();
  const [activeTab, setActiveTab] = useState<AppTab>('history');
  const [matches, setMatches] = useState<Match[]>([]);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    profile,
    isProfileModalOpen,
    setIsProfileModalOpen,
    isSyncing,
    syncStatusText,
    setSyncStatusText,
    cooldownRemaining,
    handleSyncMatches,
    handleConnectProfile,
    handleDisconnectProfile,
    isImportByIdModalOpen,
    setIsImportByIdModalOpen,
    importMatchIdInput,
    setImportMatchIdInput,
    isImportingById,
    importByIdError,
    handleImportMatchById,
  } = useProfileSync();

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

  // Automatically record active matchId from live game logs into tracked pending list
  useEffect(() => {
    if (gameContext.matchId && gameContext.matchId > 100000) {
      saveTrackedPendingMatch(gameContext.matchId);
    }
  }, [gameContext.matchId]);

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

  // Quick stats memoization (cancelled matches are excluded from winrate calculation)
  const totalMatches = matches.length;
  const totalWins = useMemo(() => matches.filter((m) => m.result === 'win').length, [matches]);
  const totalDecided = useMemo(
    () => matches.filter((m) => m.result === 'win' || m.result === 'loss').length,
    [matches]
  );
  const winRate = totalDecided > 0 ? Math.round((totalWins / totalDecided) * 100) : 0;

  return (
    <div className="min-h-screen bg-deadlock-dark text-gray-100 flex flex-col">
      {/* Top Header */}
      <AppHeader
        totalMatches={totalMatches}
        winRate={winRate}
        activeTab={activeTab}
        onTabChange={(tab) => {
          setEditingMatch(null);
          setActiveTab(tab);
        }}
        gameContext={gameContext}
        profile={profile}
        isSyncing={isSyncing}
        cooldownRemaining={cooldownRemaining}
        onSync={() => handleSyncMatches(matches, setMatches)}
        onOpenAddMatch={() => {
          setEditingMatch(null);
          setActiveTab('log_match');
        }}
        onOpenImportById={() => {
          setImportMatchIdInput('');
          setIsImportByIdModalOpen(true);
        }}
        onOpenDebugConsole={() => {
          setEditingMatch(null);
          setActiveTab('logs');
        }}
        onSwitchProfile={() => setIsProfileModalOpen(true)}
        onExport={handleExport}
        onTriggerImportFile={() => fileInputRef.current?.click()}
        onDisconnect={handleDisconnectProfile}
        onOpenConnectModal={() => setIsProfileModalOpen(true)}
      />

      {/* Hidden file input for Import */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImport}
        accept=".json"
        className="hidden"
      />

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
        onConnect={(newProfile) => handleConnectProfile(newProfile, matches, setMatches)}
        onDisconnect={handleDisconnectProfile}
      />

      {/* Import Match by ID Modal */}
      <ImportMatchByIdModal
        isOpen={isImportByIdModalOpen}
        onClose={() => setIsImportByIdModalOpen(false)}
        matchIdInput={importMatchIdInput}
        onMatchIdInputChange={setImportMatchIdInput}
        isImporting={isImportingById}
        error={importByIdError}
        onSubmit={() => handleImportMatchById(importMatchIdInput, setMatches)}
      />
    </div>
  );
};

export default App;

