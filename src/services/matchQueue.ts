import {
  getTrackedPendingMatches,
  saveTrackedPendingMatch,
  removeTrackedPendingMatch,
} from './storage';

export type QueueMatchStatus = 'pending' | 'syncing' | 'synced' | 'failed' | 'not_ranked';

export interface QueuedMatch {
  matchId: number;
  detectedAt: number;
  status: QueueMatchStatus;
  lastAttempt?: number;
  message?: string;
}

const STORAGE_KEY = 'deadlock_rich_match_queue_v1';

type QueueListener = (queue: QueuedMatch[]) => void;
const listeners = new Set<QueueListener>();

let memoryQueue: QueuedMatch[] = (() => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // Ignore parse error
  }

  // Fallback: seed from basic tracked pending matches
  const basic = getTrackedPendingMatches();
  return basic.map((item) => ({
    matchId: item.matchId,
    detectedAt: item.detectedAt,
    status: 'pending',
  }));
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

export function getMatchQueue(): QueuedMatch[] {
  return [...memoryQueue];
}

export function addMatchToQueue(matchId: number, detectedAt = Date.now(), _heroId?: number | null, _heroName?: string | null): QueuedMatch {
  const existing = memoryQueue.find((m) => m.matchId === matchId);
  if (existing) {
    return existing;
  }

  const newEntry: QueuedMatch = {
    matchId,
    detectedAt,
    status: 'pending',
  };

  memoryQueue = [newEntry, ...memoryQueue];
  saveTrackedPendingMatch(matchId, detectedAt);
  persist();
  notify();
  return newEntry;
}

export function updateQueuedMatchStatus(
  matchId: number,
  status: QueueMatchStatus,
  message?: string,
  _incrementAttempt = false
): void {
  const item = memoryQueue.find((m) => m.matchId === matchId);
  if (item) {
    item.status = status;
    item.lastAttempt = Date.now();
    if (message !== undefined) item.message = message;
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
  memoryQueue = memoryQueue.filter((m) => m.status !== 'synced' && m.status !== 'not_ranked');
  persist();
  notify();
}

export function clearEntireMatchQueue(): void {
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
