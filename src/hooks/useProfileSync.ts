import { useState, useEffect } from 'react';
import { Match, ConnectedProfile } from '../types/match';
import {
  persistMatches,
  getTrackedPendingMatches,
  removeTrackedPendingMatch,
  saveTrackedPendingMatch,
  saveAppSettings,
  fetchAppSettings,
} from '../services/storage';
import { useMatchStore } from '../stores/useMatchStore';
import {
  syncRankedMatchesForAccount,
  fetchSingleMatchResultById,
  backfillRankedDataForMatches,
} from '../services/deadlockApi';
import {
  updateQueuedMatchStatus,
  removeMatchFromQueue,
  addMatchToQueue,
} from '../services/matchQueue';

export const PROFILE_STORAGE_KEY = 'deadlock_connected_profile';

export function useProfileSync() {
  const [profile, setProfile] = useState<ConnectedProfile | null>(() => {
    try {
      const saved = localStorage.getItem(PROFILE_STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Hydrate profile from settings.json on mount
  useEffect(() => {
    fetchAppSettings().then((appSettings) => {
      if (appSettings.profile) {
        setProfile(appSettings.profile);
        localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(appSettings.profile));
      }
    }).catch(console.error);
  }, []);

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusText, setSyncStatusText] = useState<string | null>(null);

  // Import match by ID modal state
  const [isImportByIdModalOpen, setIsImportByIdModalOpen] = useState(false);
  const [importMatchIdInput, setImportMatchIdInput] = useState('');
  const [isImportingById, setIsImportingById] = useState(false);
  const [importByIdError, setImportByIdError] = useState<string | null>(null);

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

  // Sync ranked matches for connected profile in incremental mode
  const handleSyncMatches = async (
    matches: Match[],
    onMatchesUpdated: (updater: (prev: Match[]) => Match[]) => void,
    targetProfile = profile,
    forceUpdate = false
  ) => {
    if (!targetProfile || isSyncing || (cooldownRemaining > 0 && !forceUpdate)) return;

    setIsSyncing(true);
    setSyncStatusText('Checking for new ranked matches...');
    try {
      const existingIds = new Set<string | number>();
      matches.forEach((m) => {
        existingIds.add(m.id);
        if (m.matchId) {
          existingIds.add(m.matchId);
          existingIds.add(String(m.matchId));
        }
      });

      const { addedMatches, totalRankedFound } = await syncRankedMatchesForAccount(
        targetProfile.accountId,
        existingIds,
        forceUpdate
      );

      // Check tracked pending matches from game logs
      const pendingList = getTrackedPendingMatches();
      const twoHoursMs = 2 * 60 * 60 * 1000;
      const nowMs = Date.now();
      const recoveredMatches: Match[] = [];

      for (const item of pendingList) {
        const isAlreadyImported =
          existingIds.has(item.matchId) ||
          existingIds.has(String(item.matchId)) ||
          existingIds.has(`api_${item.matchId}`) ||
          addedMatches.some((m) => m.matchId === item.matchId);

        if (isAlreadyImported) {
          removeMatchFromQueue(item.matchId);
        } else if (nowMs - item.detectedAt >= twoHoursMs) {
          try {
            updateQueuedMatchStatus(item.matchId, 'syncing', 'Checking API recovery...', false);
            const directResult = await fetchSingleMatchResultById(item.matchId, targetProfile.accountId);
            if (directResult.success) {
              if (item.source === 'log') {
                directResult.match.notes = `Ranked Match #${item.matchId} (Auto-imported from Game Logs)`;
              } else if (item.source === 'manual') {
                directResult.match.notes = `Ranked Match #${item.matchId} (Manual ID Import)`;
              } else {
                directResult.match.notes = `Ranked Match #${item.matchId} (Auto-imported from Deadlock API)`;
              }
              recoveredMatches.push(directResult.match);
              updateQueuedMatchStatus(item.matchId, 'synced', 'Recovered and synced into matches!', false);
              removeMatchFromQueue(item.matchId);
            } else if (directResult.error === 'not_ranked') {
              updateQueuedMatchStatus(item.matchId, 'not_ranked', 'Match is Casual / Unranked.', false);
              removeMatchFromQueue(item.matchId);
            } else if (directResult.error === 'not_in_match') {
              updateQueuedMatchStatus(item.matchId, 'failed', 'Profile was not part of this match.', false);
              removeMatchFromQueue(item.matchId);
            } else if (directResult.error === 'rate_limited') {
              // Rate limit quota: do not count as a match attempt failure
              updateQueuedMatchStatus(
                item.matchId,
                'failed',
                directResult.message || 'API rate limit cooldown active (3 requests/hour).',
                false
              );
            } else {
              // Real match failure (e.g. 503, 404, server error)
              updateQueuedMatchStatus(
                item.matchId,
                'failed',
                directResult.message || 'Waiting for Valve index or server recovery.',
                true
              );
            }
          } catch (fetchErr: any) {
            console.warn(`Could not recover pending match #${item.matchId}:`, fetchErr);
            updateQueuedMatchStatus(item.matchId, 'failed', fetchErr?.message || 'Network error.', true);
          }
        }
      }

      const allNewMatches = [...addedMatches, ...recoveredMatches];

      if (allNewMatches.length > 0) {
        await persistMatches(allNewMatches);
        onMatchesUpdated((prev) => {
          const map = new Map<string, Match>();
          allNewMatches.forEach((m) => map.set(m.id, m));
          prev.forEach((m) => {
            if (!map.has(m.id)) {
              map.set(m.id, m);
            }
          });
          return Array.from(map.values()).sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
          );
        });

        const recoveredMsg = recoveredMatches.length > 0
          ? ` (${recoveredMatches.length} recovered from logs)`
          : '';
        setSyncStatusText(`+${allNewMatches.length} new ranked match${allNewMatches.length > 1 ? 'es' : ''} imported!${recoveredMsg}`);
      } else {
        setSyncStatusText(`Up to date (${totalRankedFound} ranked found in history)`);
      }

      // Automatically backfill any existing matches missing ranked points
      const allCurrentMatches = [...matches, ...allNewMatches];
      const needsBackfill = allCurrentMatches.some(
        (m) => m.matchId && (m.rankedDelta === undefined || m.rankedDelta === null)
      );
      if (needsBackfill) {
        const { updatedMatches, updatedCount } = await backfillRankedDataForMatches(
          allCurrentMatches,
          targetProfile.accountId
        );
        if (updatedCount > 0) {
          await persistMatches(updatedMatches);
          onMatchesUpdated(() => updatedMatches);
        }
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
      saveAppSettings({ profile: updatedProfile, activeAccountId: updatedProfile.accountId }).catch(console.error);
    } catch (err) {
      console.error('Sync failed:', err);
      setSyncStatusText('Sync failed. Please try again.');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatusText(null), 5000);
    }
  };

  const handleImportMatchById = async (
    targetIdStr: string,
    onMatchesUpdated: (updater: (prev: Match[]) => Match[]) => void,
    customDateMs?: number
  ): Promise<{ added: boolean; isIncomplete?: boolean; importedMatch?: Match; matchId?: number } | void> => {
    const trimmed = targetIdStr.trim();
    if (!trimmed || !profile) return;
    const matchId = parseInt(trimmed, 10);
    if (isNaN(matchId) || matchId <= 0) {
      setImportByIdError('Please enter a valid numeric Match ID.');
      return;
    }

    const effectiveTimestamp = customDateMs && customDateMs > 0 ? customDateMs : Date.now();

    setIsImportingById(true);
    setImportByIdError(null);
    try {
      const result = await fetchSingleMatchResultById(matchId, profile.accountId);
      if (!result.success) {
        if (result.error === 'not_in_match') {
          setImportByIdError(
            `Match #${matchId} was found on Valve API, but your connected Steam account was not a player in this match.`
          );
          return { added: false, matchId };
        }

        if (result.error === 'not_ranked') {
          setImportByIdError(
            `Match #${matchId} exists, but it is not a Ranked match. Only ranked matches are imported.`
          );
          return { added: false, matchId };
        }

        // For all other cases (not_found, rate_limited, steam_unavailable, network_error, server_error):
        // Add to queue as incomplete match so the user sees it in their history and can sync/parse replay
        saveTrackedPendingMatch(matchId, effectiveTimestamp, null, null, 'manual');
        addMatchToQueue(matchId, effectiveTimestamp, null, null, 'manual');
        setIsImportByIdModalOpen(false);
        setImportMatchIdInput('');
        setImportByIdError(null);
        setSyncStatusText(`Match #${matchId} added to history as incomplete (awaiting sync or replay).`);
        return { added: true, isIncomplete: true, matchId };
      }

      const imported = result.match;

      await persistMatches([imported]);
      onMatchesUpdated((prev) => {
        const existingIdx = prev.findIndex((m) => m.id === imported.id || m.matchId === imported.matchId);
        let nextList: Match[];
        if (existingIdx >= 0) {
          nextList = [...prev];
          nextList[existingIdx] = imported;
        } else {
          nextList = [imported, ...prev];
        }
        return nextList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      });

      removeTrackedPendingMatch(matchId);
      removeMatchFromQueue(matchId);
      setIsImportByIdModalOpen(false);
      setImportMatchIdInput('');
      setImportByIdError(null);
      setSyncStatusText(`Match #${matchId} imported successfully!`);
      return { added: true, isIncomplete: false, importedMatch: imported, matchId };
    } catch (err) {
      console.error('Failed to import match by ID:', err);
      saveTrackedPendingMatch(matchId, effectiveTimestamp, null, null, 'manual');
      addMatchToQueue(matchId, effectiveTimestamp, null, null, 'manual');
      setIsImportByIdModalOpen(false);
      setImportMatchIdInput('');
      setImportByIdError(null);
      setSyncStatusText(`Match #${matchId} added to history as incomplete.`);
      return { added: true, isIncomplete: true, matchId };
    } finally {
      setIsImportingById(false);
    }
  };

  const handleConnectProfile = async (
    newProfile: ConnectedProfile,
    _matches: Match[],
    onMatchesUpdated: (updater: (prev: Match[]) => Match[]) => void
  ) => {
    setProfile(newProfile);
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(newProfile));
    await saveAppSettings({ profile: newProfile, activeAccountId: newProfile.accountId });

    // Switch match history to the connected profile
    await useMatchStore.getState().loadMatches(newProfile.accountId);
    const newAccountMatches = useMatchStore.getState().matches;

    handleSyncMatches(newAccountMatches, onMatchesUpdated, newProfile);
  };

  const handleDisconnectProfile = async () => {
    setProfile(null);
    localStorage.removeItem(PROFILE_STORAGE_KEY);
    await saveAppSettings({ profile: null, activeAccountId: null });
    setSyncStatusText(null);

    // Switch back to default match history
    await useMatchStore.getState().loadMatches(null);
  };

  return {
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
    setImportByIdError,
    handleImportMatchById,
  };
}
