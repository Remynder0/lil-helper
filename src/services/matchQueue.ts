import {
  getTrackedPendingMatches,
  saveTrackedPendingMatch,
  removeTrackedPendingMatch,
} from './storage';

export type QueueMatchStatus = 'pending' | 'syncing' | 'synced' | 'failed' | 'not_ranked';

export interface QueuedMatch {
  matchId: number;
  detectedAt: number;
  heroId?: number | null;
  heroName?: string | null;
  status: QueueMatchStatus;
  lastAttempt?: number;
  attempts: number;
  message?: string;
  source?: 'log' | 'manual';
}

const STORAGE_KEY = 'deadlock_rich_match_queue_v1';

type QueueListener = (queue: QueuedMatch[]) => void;
const listeners = new Set<QueueListener>();

export const BACKUP_QUEUE: QueuedMatch[] = [
  {
    matchId: 107170447,
    detectedAt: 1790108637922,
    status: 'pending',
    attempts: 0,
    source: 'log',
  },
  {
    matchId: 107163519,
    detectedAt: 1790106127899,
    status: 'failed',
    attempts: 0,
    lastAttempt: 1790114789757,
    message: 'Steam query quota reached (3 requests/hour per IP). Next request allowed in 1160s.',
    source: 'log',
  },
  {
    matchId: 106977153,
    detectedAt: 1790018026273,
    status: 'pending',
    attempts: 0,
    source: 'log',
  },
  {
    matchId: 106969583,
    detectedAt: 1790015333776,
    status: 'pending',
    attempts: 0,
    source: 'log',
  },
  {
    matchId: 105629982,
    detectedAt: 1790004401732,
    status: 'failed',
    attempts: 0,
    lastAttempt: 1790114787794,
    message: 'Steam query quota reached (3 requests/hour per IP). Next request allowed in 1162s.',
    source: 'manual',
  },
  {
    matchId: 105637177,
    detectedAt: 1790004437044,
    status: 'failed',
    attempts: 0,
    lastAttempt: 1790114788234,
    message: 'Steam query quota reached (3 requests/hour per IP). Next request allowed in 1161s.',
    source: 'manual',
  },
  {
    matchId: 105659741,
    detectedAt: 1790004465068,
    status: 'failed',
    attempts: 0,
    lastAttempt: 1790114788619,
    message: 'Steam query quota reached (3 requests/hour per IP). Next request allowed in 1161s.',
    source: 'manual',
  },
  {
    matchId: 105830407,
    detectedAt: 1790004795361,
    status: 'failed',
    attempts: 0,
    lastAttempt: 1790114788997,
    message: 'Steam query quota reached (3 requests/hour per IP). Next request allowed in 1160s.',
    source: 'manual',
  },
  {
    matchId: 106010381,
    detectedAt: 1790004882279,
    status: 'failed',
    attempts: 2,
    lastAttempt: 1790114789379,
    message: 'Steam query quota reached (3 requests/hour per IP). Next request allowed in 1160s.',
    source: 'manual',
  },
];

let memoryQueue: QueuedMatch[] = (() => {
  let list: QueuedMatch[] = [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      list = JSON.parse(raw);
    }
  } catch {
    // Ignore parse error
  }

  // Fallback: seed from basic tracked pending matches
  if (!list || list.length === 0) {
    const basic = getTrackedPendingMatches();
    if (basic.length > 0) {
      list = basic.map((item) => ({
        matchId: item.matchId,
        detectedAt: item.detectedAt,
        heroId: item.heroId,
        heroName: item.heroName,
        status: 'pending',
        attempts: 0,
        source: item.source || 'manual',
      }));
    }
  }

  // Auto-restore backup if queue was emptied or not yet restored
  if (list.length === 0 || localStorage.getItem('deadlock_queue_backup_restored_v2') !== 'true') {
    BACKUP_QUEUE.forEach((b) => {
      if (!list.some((existing) => existing.matchId === b.matchId)) {
        list.push({ ...b });
      }
      saveTrackedPendingMatch(b.matchId, b.detectedAt, b.heroId, b.heroName, b.source);
    });
    try {
      localStorage.setItem('deadlock_queue_backup_restored_v2', 'true');
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {}
  }

  return list;
})();

function notify(): void {
  const current = [...memoryQueue];
  listeners.forEach((fn) => {
    try {
      fn(current);
    } catch (e) {
      console.error('Error in QueueListener:', e);
    }
  });
}

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryQueue));
  } catch {
    // Storage quota
  }
}

export function restoreBackupQueue(): void {
  BACKUP_QUEUE.forEach((b) => {
    if (!memoryQueue.some((existing) => existing.matchId === b.matchId)) {
      memoryQueue.push({ ...b });
    }
    saveTrackedPendingMatch(b.matchId, b.detectedAt, b.heroId, b.heroName, b.source);
  });
  persist();
  notify();
}

export function getMatchQueue(): QueuedMatch[] {
  return [...memoryQueue];
}

export function addMatchToQueue(
  matchId: number,
  detectedAt = Date.now(),
  heroId?: number | null,
  heroName?: string | null,
  source: 'log' | 'manual' = 'manual'
): QueuedMatch {
  const existing = memoryQueue.find((m) => m.matchId === matchId);
  if (existing) {
    if (heroId && !existing.heroId) {
      existing.heroId = heroId;
      existing.heroName = heroName;
    }
    if (detectedAt) {
      existing.detectedAt = detectedAt;
    }
    if (source) {
      existing.source = source;
    }
    if (existing.status === 'synced') {
      existing.status = 'pending';
    }
    saveTrackedPendingMatch(
      matchId,
      existing.detectedAt,
      existing.heroId,
      existing.heroName,
      existing.source
    );
    persist();
    notify();
    return existing;
  }

  const newEntry: QueuedMatch = {
    matchId,
    detectedAt,
    heroId,
    heroName,
    status: 'pending',
    attempts: 0,
    source,
  };

  memoryQueue = [newEntry, ...memoryQueue];
  saveTrackedPendingMatch(matchId, detectedAt, heroId, heroName, source);
  persist();
  notify();
  return newEntry;
}

export function updateQueuedMatchDate(matchId: number, detectedAt: number): void {
  const item = memoryQueue.find((m) => m.matchId === matchId);
  if (item) {
    item.detectedAt = detectedAt;
    saveTrackedPendingMatch(matchId, detectedAt, item.heroId, item.heroName, item.source);
    persist();
    notify();
  }
}

export function updateQueuedMatchStatus(
  matchId: number,
  status: QueueMatchStatus,
  message?: string,
  incrementAttempt = false
): void {
  const item = memoryQueue.find((m) => m.matchId === matchId);
  if (item) {
    item.status = status;
    item.lastAttempt = Date.now();
    if (incrementAttempt) {
      item.attempts += 1;
    }
    if (message !== undefined) {
      item.message = message;
    }
    if (status === 'synced' || status === 'not_ranked') {
      removeTrackedPendingMatch(matchId);
    }
    persist();
    notify();
  }
}

export function removeMatchFromQueue(matchId: number): void {
  memoryQueue = memoryQueue.filter((m) => m.matchId !== matchId);
  removeTrackedPendingMatch(matchId);
  persist();
  notify();
}

export function clearFinishedMatches(): void {
  // Clear any that are synced, not_ranked, or failed
  const finishedIds = memoryQueue
    .filter((m) => m.status === 'synced' || m.status === 'not_ranked' || m.status === 'failed')
    .map((m) => m.matchId);
  finishedIds.forEach((id) => removeTrackedPendingMatch(id));
  memoryQueue = memoryQueue.filter((m) => m.status === 'pending' || m.status === 'syncing');
  persist();
  notify();
}

export function clearEntireMatchQueue(): void {
  memoryQueue.forEach((m) => removeTrackedPendingMatch(m.matchId));
  memoryQueue = [];
  persist();
  notify();
}

export function subscribeToMatchQueue(callback: QueueListener): () => void {
  listeners.add(callback);
  callback([...memoryQueue]);
  return () => {
    listeners.delete(callback);
  };
}

/**
 * Formate un timestamp sous forme de durée écoulée en jour / heure / minute :
 * - >= 1 jour : "Xj Yh Zm" (ex: "7j 2h 15m")
 * - >= 1 heure : "Xh Ym" (ex: "3h 45m")
 * - < 1 heure : "Xm" (ex: "12m")
 * - < 1 minute : "< 1m"
 */
export function formatDurationDHM(timestampMs?: number | null): string {
  if (!timestampMs || isNaN(timestampMs)) return 'Unknown';
  const diffMs = Math.max(0, Date.now() - timestampMs);
  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    if (hours > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    }
    return `${days}d ${minutes}m`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }
  return '< 1m';
}

export const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;

/**
 * Un match est considéré bloqué s'il a été détecté il y a plus de 5h
 * et n'a jamais été synchronisé avec succès.
 */
export function isMatchBlocked(match: QueuedMatch, now = Date.now()): boolean {
  return match.status !== 'synced' && (now - match.detectedAt >= FIVE_HOURS_MS);
}

