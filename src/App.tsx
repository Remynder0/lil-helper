import React, { useEffect, useMemo, useRef } from 'react';
import { MatchForm } from './components/MatchForm';
import { HistoryList } from './components/HistoryList';
import { AnalyticsView } from './components/AnalyticsView';
import { DraftAssistantView } from './components/DraftAssistantView';
import { ProfileConnectModal } from './components/ProfileConnectModal';
import { LogDashboardView } from './components/LogDashboardView';
import { AppHeader } from './components/AppHeader';
import { ImportMatchByIdModal } from './components/ImportMatchByIdModal';
import { DesktopDownloadBanner } from './components/DesktopDownloadBanner';
import { useProfileSync } from './hooks/useProfileSync';
import { useDeadlockGameState } from './hooks/useDeadlockGameState';
import { PlayerGameState } from './services/logWatcher';
import { loadUserSettings } from './services/userSettings';
import { saveTrackedPendingMatch } from './services/storage';
import { addMatchToQueue, subscribeToMatchQueue, removeMatchFromQueue } from './services/matchQueue';
import { Match } from './types/match';
import { calculateHeroPerformance } from './services/analytics';
import { getHeroById } from './data/heroes';
import occultBadge from './assets/occult/badge.svg';
import { RefreshCw } from 'lucide-react';
import { ToastProvider, useToast } from './components/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useUIStore } from './stores/useUIStore';
import { useMatchStore, selectAllHistoryMatches } from './stores/useMatchStore';

const AppInner: React.FC = () => {
  const { gameContext } = useDeadlockGameState();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── UI Store (Routing, Modals, Highlights) ──
  const activeTab = useUIStore((s) => s.activeTab);
  const setActiveTab = useUIStore((s) => s.setActiveTab);
  const previewHeroId = useUIStore((s) => s.previewHeroId);
  const setPreviewHeroId = useUIStore((s) => s.setPreviewHeroId);
  const highlightedMatchIds = useUIStore((s) => s.highlightedMatchIds);
  const setHighlightedMatchIds = useUIStore((s) => s.setHighlightedMatchIds);
  const highlightedStreakType = useUIStore((s) => s.highlightedStreakType);
  const navigateToStreak = useUIStore((s) => s.navigateToStreak);
  const clearHighlight = useUIStore((s) => s.clearHighlight);
  const isProfileModalOpen = useUIStore((s) => s.isProfileModalOpen);
  const setProfileModalOpen = useUIStore((s) => s.setProfileModalOpen);
  const isImportByIdModalOpen = useUIStore((s) => s.isImportByIdModalOpen);
  const setImportByIdModalOpen = useUIStore((s) => s.setImportByIdModalOpen);

  // ── Match Store (Matches, Queue, CRUD) ──
  const matches = useMatchStore((s) => s.matches);
  const setMatches = useMatchStore((s) => s.setMatches);
  const editingMatch = useMatchStore((s) => s.editingMatch);
  const setEditingMatch = useMatchStore((s) => s.setEditingMatch);
  const matchQueue = useMatchStore((s) => s.matchQueue);
  const setMatchQueue = useMatchStore((s) => s.setMatchQueue);
  const loadMatches = useMatchStore((s) => s.loadMatches);
  const saveMatch = useMatchStore((s) => s.saveMatch);
  const deleteMatch = useMatchStore((s) => s.deleteMatch);
  const exportMatches = useMatchStore((s) => s.exportMatches);
  const importMatches = useMatchStore((s) => s.importMatches);

  // Combine persisted matches and pending queued matches memoized to avoid infinite re-renders
  const allHistoryMatches = useMemo(() => {
    return selectAllHistoryMatches({ matches, matchQueue });
  }, [matches, matchQueue]);

  // Subscribe to background match queue
  useEffect(() => {
    const unsub = subscribeToMatchQueue((queue) => {
      setMatchQueue(queue);
    });
    return () => unsub();
  }, [setMatchQueue]);

  // ── Profile Sync Hook ──
  const {
    profile,
    isSyncing,
    syncStatusText,
    setSyncStatusText,
    cooldownRemaining,
    handleSyncMatches,
    handleConnectProfile,
    handleDisconnectProfile,
    importMatchIdInput,
    setImportMatchIdInput,
    isImportingById,
    importByIdError,
    handleImportMatchById,
  } = useProfileSync();

  // Load matches from persistent storage on mount or account switch
  useEffect(() => {
    loadMatches(profile ? profile.accountId : null);
  }, [loadMatches, profile]);

  // Automatically switch to Draft Assistant view when game enters draft / selection phase
  const prevGameStateRef = useRef<PlayerGameState | null>(null);
  useEffect(() => {
    const prevState = prevGameStateRef.current;
    const currentState = gameContext.state;
    prevGameStateRef.current = currentState;

    const settings = loadUserSettings();
    if (settings.autoNavigateToDraft && currentState === 'draft' && prevState !== 'draft') {
      setActiveTab('assistant');
    }
  }, [gameContext.state, setActiveTab]);

  // Automatically record active matchId from live game logs into tracked pending list
  useEffect(() => {
    if (gameContext.matchId && gameContext.matchId > 100000) {
      saveTrackedPendingMatch(
        gameContext.matchId,
        Date.now(),
        gameContext.myHeroId,
        gameContext.myHeroName,
        'log'
      );
      addMatchToQueue(
        gameContext.matchId,
        Date.now(),
        gameContext.myHeroId,
        gameContext.myHeroName,
        'log'
      );
    }
  }, [gameContext.matchId, gameContext.myHeroId, gameContext.myHeroName]);

  const handleMatchSaved = (savedMatch: Match) => {
    saveMatch(savedMatch);
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
    const success = await deleteMatch(id);
    if (success) {
      toast.success('Match deleted from history');
    } else {
      toast.error('Could not delete match');
    }
  };

  // Export matches to a downloadable JSON file
  const handleExport = async () => {
    try {
      const jsonStr = await exportMatches();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `deadlock_matches_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
      toast.error('Failed to export matches');
    }
  };

  // Import matches from a selected JSON file
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const count = await importMatches(text);
      toast.success(`${count} matches imported successfully`);
    } catch (err) {
      console.error('Import failed:', err);
      toast.error('Invalid file format — expected a valid matches JSON file');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

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
    <div className="min-h-screen bg-deadlock-dark text-deadlock-steam flex flex-col relative">
      {/* Dynamic hero background — Full-size theatrical hero wallpaper */}
      {activeHeroBgUrl && (
        <div
          className="fixed inset-0 z-0 pointer-events-none overflow-hidden transition-all duration-700 select-none"
          aria-hidden="true"
        >
          {/* Rotating celestial sigil in background with warm brass illumination */}
          <div className="absolute top-12 right-12 opacity-80 pointer-events-none drop-shadow-[0_0_24px_rgba(232,192,106,0.35)]">
            <img src={occultBadge} alt="" aria-hidden="true" className="w-[480px] h-[480px] animate-[spin_25s_linear_infinite]" />
          </div>

          {/* Luminous brass/amber aura backlights behind the hero */}
          <div className="absolute top-1/4 right-8 w-[650px] h-[650px] bg-gradient-to-br from-deadlock-accent/25 via-amber-600/15 to-transparent rounded-full blur-3xl pointer-events-none" />
          <div className="absolute top-10 right-28 w-[400px] h-[400px] bg-amber-400/20 rounded-full blur-2xl pointer-events-none" />

          {/* Full-bleed hero artwork */}
          <div
            className="absolute inset-0 bg-cover bg-right bg-no-repeat transition-all duration-700 opacity-95"
            style={{
              backgroundImage: `url(${activeHeroBgUrl})`,
              filter: 'brightness(1.16) contrast(1.08) saturate(1.14) drop-shadow(0 0 45px rgba(232, 192, 106, 0.25))',
            }}
          />

          {/* Left-to-right fade mask */}
          <div className="absolute inset-0 bg-gradient-to-r from-deadlock-dark/85 via-deadlock-dark/35 to-transparent via-55%" />

          {/* Top and bottom vignette */}
          <div className="absolute inset-0 bg-gradient-to-b from-deadlock-dark/35 via-transparent to-deadlock-dark/70" />
        </div>
      )}

      {/* Top Header — Props reduced from 17 to 8 using Zustand */}
      <AppHeader
        gameContext={gameContext}
        profile={profile}
        isSyncing={isSyncing}
        cooldownRemaining={cooldownRemaining}
        onSync={() => handleSyncMatches(matches, setMatches)}
        onExport={handleExport}
        onTriggerImportFile={() => fileInputRef.current?.click()}
        onDisconnect={handleDisconnectProfile}
      />

      {/* Spacer for fixed header */}
      <div className="h-[74px] shrink-0 pointer-events-none" aria-hidden="true" />

      {/* Hidden file input for Import */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImport}
        accept=".json"
        className="hidden"
      />

      {/* Sync Status Banner */}
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
      <main className="flex-1 w-full max-w-6xl xl:max-w-7xl 2xl:max-w-[1680px] mx-auto p-6 2xl:p-8 flex flex-col gap-6 relative z-10 transition-all duration-300">
        <DesktopDownloadBanner />
        {activeTab === 'log_match' && (
          editingMatch ? (
            <MatchForm
              key={editingMatch.id}
              editingMatch={editingMatch}
              onMatchSaved={handleMatchSaved}
              onCancel={handleCancelEdit}
            />
          ) : (
            <LogDashboardView
              profile={profile}
              gameContext={gameContext}
              matches={matches}
              onMatchesUpdated={setMatches}
            />
          )
        )}
        {activeTab === 'history' && (
          <ErrorBoundary section="History">
            <HistoryList
              matches={allHistoryMatches}
              profile={profile}
              onEditMatch={handleEditMatch}
              onDeleteMatch={handleDeleteMatch}
              onHeroFilterChange={setPreviewHeroId}
              highlightedMatchIds={highlightedMatchIds}
              highlightedStreakType={highlightedStreakType}
              onClearHighlight={clearHighlight}
              onMatchImported={(imported) => {
                handleMatchSaved(imported);
                if (imported.matchId) {
                  removeMatchFromQueue(imported.matchId);
                }
              }}
            />
          </ErrorBoundary>
        )}
        {activeTab === 'analytics' && (
          <ErrorBoundary section="Analytics">
            <AnalyticsView
              matches={matches}
              profile={profile}
              onNavigateToStreak={navigateToStreak}
            />
          </ErrorBoundary>
        )}
        <div className={activeTab === 'assistant' ? 'contents' : 'hidden'}>
          <ErrorBoundary section="Draft Assistant">
            <DraftAssistantView matches={matches} gameContext={gameContext} />
          </ErrorBoundary>
        </div>
        {activeTab === 'logs' && (
          <LogDashboardView
            profile={profile}
            gameContext={gameContext}
            matches={matches}
            onMatchesUpdated={setMatches}
          />
        )}
      </main>

      {/* Profile Connect Modal */}
      <ProfileConnectModal
        isOpen={isProfileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        currentProfile={profile}
        onConnect={(newProfile) => handleConnectProfile(newProfile, matches, setMatches)}
        onDisconnect={handleDisconnectProfile}
      />

      {/* Import Match by ID Modal */}
      <ImportMatchByIdModal
        isOpen={isImportByIdModalOpen}
        onClose={() => setImportByIdModalOpen(false)}
        matchIdInput={importMatchIdInput}
        onMatchIdInputChange={setImportMatchIdInput}
        isImporting={isImportingById}
        error={importByIdError}
        onSubmit={async (customDateMs) => {
          const rawId = importMatchIdInput.trim();
          const targetMatchId = parseInt(rawId, 10);
          const res = await handleImportMatchById(rawId, setMatches, customDateMs);
          if (res?.added) {
            setActiveTab('history');
            const targetId = res.importedMatch ? res.importedMatch.id : `pending_${targetMatchId}`;
            setHighlightedMatchIds([targetId]);
          }
        }}
      />
    </div>
  );
};

export const App: React.FC = () => (
  <ErrorBoundary section="Lil Helper Application">
    <ToastProvider>
      <AppInner />
    </ToastProvider>
  </ErrorBoundary>
);

export default App;
