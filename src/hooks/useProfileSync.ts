import { useState, useEffect } from 'react';
import { Match, ConnectedProfile } from '../types/match';
import {
  persistMatches,
  getTrackedPendingMatches,
  removeTrackedPendingMatch,
  saveTrackedPendingMatch,
} from '../services/storage';
import { syncRankedMatchesForAccount, fetchSingleMatchResultById } from '../services/deadlockApi';

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
          removeTrackedPendingMatch(item.matchId);
        } else if (nowMs - item.detectedAt >= twoHoursMs) {
          try {
            const directResult = await fetchSingleMatchResultById(item.matchId, targetProfile.accountId);
            if (directResult.success) {
              recoveredMatches.push(directResult.match);
              removeTrackedPendingMatch(item.matchId);
            } else if (
              directResult.error === 'not_ranked' ||
              directResult.error === 'not_in_match'
            ) {
              // Permanently invalid for this ranked profile; remove from pending list
              removeTrackedPendingMatch(item.matchId);
            }
            // If steam_unavailable, rate_limited, or not_found, keep in pending to retry later
          } catch (fetchErr) {
            console.warn(`Could not recover pending match #${item.matchId}:`, fetchErr);
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

  const handleImportMatchById = async (
    targetIdStr: string,
    onMatchesUpdated: (updater: (prev: Match[]) => Match[]) => void
  ) => {
    const trimmed = targetIdStr.trim();
    if (!trimmed || !profile) return;
    const matchId = parseInt(trimmed, 10);
    if (isNaN(matchId) || matchId <= 0) {
      setImportByIdError('Please enter a valid numeric Match ID.');
      return;
    }

    setIsImportingById(true);
    setImportByIdError(null);
    try {
      const result = await fetchSingleMatchResultById(matchId, profile.accountId);
      if (!result.success) {
        const isPermanentError =
          result.error === 'not_found' ||
          result.error === 'not_ranked' ||
          result.error === 'not_in_match';

        if (!isPermanentError) {
          // Queue into pending matches with elapsed timestamp so next sync will retry it
          saveTrackedPendingMatch(matchId, Date.now() - 2 * 60 * 60 * 1000);
        }

        if (result.error === 'steam_unavailable') {
          setImportByIdError(
            `Steam servers are currently unavailable to retrieve match #${matchId} (HTTP 503). It has been added to your pending queue and will be imported automatically on the next sync once Steam responds.`
          );
        } else if (result.error === 'rate_limited') {
          const waitStr = result.retryAfterSeconds
            ? `${result.retryAfterSeconds}s`
            : 'a few minutes';
          setImportByIdError(
            `Rate limit reached for direct Steam queries (HTTP 429). The Deadlock API limits direct Steam queries to 3/hour per IP (retry in ${waitStr}). Match #${matchId} has been added to pending queue and will be imported automatically.`
          );
        } else if (result.error === 'not_ranked') {
          setImportByIdError(
            `Match #${matchId} exists, but it is not a Ranked match. Only ranked matches are imported.`
          );
        } else if (result.error === 'not_in_match') {
          setImportByIdError(
            `Match #${matchId} was found, but your connected Steam account was not a player in this match.`
          );
        } else if (result.error === 'not_found') {
          setImportByIdError(
            `Match #${matchId} was not found on Steam or Deadlock API. Please verify the Match ID.`
          );
        } else if (result.error === 'network_error') {
          setImportByIdError(
            `Network error while contacting Deadlock API. Match #${matchId} has been added to pending queue to retry automatically.`
          );
        } else {
          setImportByIdError(
            `${result.message || `Failed to fetch match #${matchId} (HTTP ${result.status || 'unknown'}).`} Added to pending queue to retry automatically.`
          );
        }
        return;
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
      setIsImportByIdModalOpen(false);
      setImportMatchIdInput('');
      setSyncStatusText(`Match #${matchId} imported successfully!`);
    } catch (err) {
      console.error('Failed to import match by ID:', err);
      saveTrackedPendingMatch(matchId, Date.now() - 2 * 60 * 60 * 1000);
      setImportByIdError(
        `Failed to fetch match: ${err instanceof Error ? err.message : String(err)}. Added to pending queue to retry automatically.`
      );
    } finally {
      setIsImportingById(false);
    }
  };

  const handleConnectProfile = (
    newProfile: ConnectedProfile,
    matches: Match[],
    onMatchesUpdated: (updater: (prev: Match[]) => Match[]) => void
  ) => {
    setProfile(newProfile);
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(newProfile));
    handleSyncMatches(matches, onMatchesUpdated, newProfile);
  };

  const handleDisconnectProfile = () => {
    setProfile(null);
    localStorage.removeItem(PROFILE_STORAGE_KEY);
    setSyncStatusText(null);
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
