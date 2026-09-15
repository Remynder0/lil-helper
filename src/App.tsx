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
import { calculateHeroPerformance } from './services/analytics';
import { getHeroById } from './data/heroes';
import occultBadge from './assets/occult/badge.svg';
import { RefreshCw } from 'lucide-react';

export const App: React.FC = () => {
  const { gameContext } = useDeadlockGameState();
  const [activeTab, setActiveTab] = useState<AppTab>('history');
  const [matches, setMatches] = useState<Match[]>([]);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [previewHeroId, setPreviewHeroId] = useState<number | null>(null);
  const [highlightedMatchIds, setHighlightedMatchIds] = useState<string[] | null>(null);
  const [highlightedStreakType, setHighlightedStreakType] = useState<'win' | 'loss' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleNavigateToStreak = (matchIds: string[], type: 'win' | 'loss') => {
    setHighlightedMatchIds(matchIds);
    setHighlightedStreakType(type);
    setActiveTab('history');
  };

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

  // Dynamic hero background artwork
  // Priority: 1) filtered/previewed hero, 2) live in-game hero, 3) most-played hero, 4) fallback: Celeste
  const activeHeroBgUrl = useMemo(() => {
    // 1. Manually filtered / previewed hero
    if (previewHeroId) {
      const hero = getHeroById(previewHeroId);
      if (hero?.backgroundUrl) return hero.backgroundUrl;
      if (hero) return `/heroes/backgrounds/${hero.key}_bg.webp`;
    }

    // 2. Live in-game hero
    if (gameContext.myHeroId) {
      const liveHero = getHeroById(gameContext.myHeroId);
      if (liveHero?.backgroundUrl) return liveHero.backgroundUrl;
      if (liveHero) return `/heroes/backgrounds/${liveHero.key}_bg.webp`;
    }

    // 3. Most-played hero from match history
    if (matches.length > 0) {
      const performances = calculateHeroPerformance(matches);
      if (performances.length > 0) {
        const topHero = performances[0];
        const hero = getHeroById(topHero.heroId);
        if (hero?.backgroundUrl) return hero.backgroundUrl;
        if (hero) return `/heroes/backgrounds/${hero.key}_bg.webp`;
      }
    }

    // 4. Default showcase: Celeste
    return '/heroes/backgrounds/celeste_bg.webp';
  }, [previewHeroId, gameContext.myHeroId, matches]);

  return (
    <div className="min-h-screen bg-deadlock-dark text-deadlock-steam flex flex-col relative overflow-x-hidden">
      {/* Dynamic hero background — Full-size theatrical hero wallpaper */}
      {activeHeroBgUrl && (
        <div
          className="fixed inset-0 z-0 pointer-events-none overflow-hidden transition-all duration-700 select-none"
          aria-hidden="true"
        >
          {/* Rotating celestial sigil in background — clearly visible behind hero */}
          <div className="absolute top-16 right-16 opacity-65 pointer-events-none">
            <img src={occultBadge} alt="" aria-hidden="true" className="w-[420px] h-[420px] animate-[spin_20s_linear_infinite] opacity-60" />
          </div>

          {/* Full-bleed un-shrunk hero artwork: covers full screen height at the right */}
          <div
            className="absolute inset-0 bg-cover bg-right bg-no-repeat transition-all duration-700 opacity-80"
            style={{ backgroundImage: `url(${activeHeroBgUrl})` }}
          />

          {/* Left-to-right fade: dark on left for card legibility, transparent on right for full hero visibility */}
          <div className="absolute inset-0 bg-gradient-to-r from-deadlock-dark via-deadlock-dark/60 to-transparent via-40%" />

          {/* Subtle top and bottom atmospheric vignette */}
          <div className="absolute inset-0 bg-gradient-to-b from-deadlock-dark/50 via-transparent to-deadlock-dark/80" />

          {/* Warm brass occult ambient glow behind hero */}
          <div className="absolute top-1/4 right-20 w-[450px] h-[450px] bg-deadlock-accent/5 rounded-full blur-3xl pointer-events-none" />
        </div>
      )}

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
      <main className="flex-1 max-w-6xl w-full mx-auto p-6 flex flex-col gap-6 relative z-10">
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
            onHeroFilterChange={setPreviewHeroId}
            highlightedMatchIds={highlightedMatchIds}
            highlightedStreakType={highlightedStreakType}
            onClearHighlight={() => {
              setHighlightedMatchIds(null);
              setHighlightedStreakType(null);
            }}
          />
        )}
        {activeTab === 'analytics' && (
          <AnalyticsView
            matches={matches}
            onNavigateToStreak={handleNavigateToStreak}
          />
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

