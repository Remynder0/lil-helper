export interface ApiLogEntry {
  id: string;
  timestamp: string;
  timeMs: number;
  method: string;
  url: string;
  endpoint: string;
  status: number;
  statusText: string;
  durationMs: number;
  success: boolean;
  summary: string;
  error?: string;
}

const STORAGE_KEY = 'deadlock_api_requests_log_v1';
const MAX_LOGS = 20;

type ApiLogListener = (logs: ApiLogEntry[]) => void;
const listeners = new Set<ApiLogListener>();

let memoryLogs: ApiLogEntry[] = (() => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // Ignore storage parse errors
  }
  return [];
})();

function notifyListeners(): void {
  const current = [...memoryLogs];
  listeners.forEach((listener) => {
    try {
      listener(current);
    } catch (e) {
      console.error('Error in ApiLogListener:', e);
    }
  });
}

function persistLogs(): void {
  try {
    const serialized = JSON.stringify(memoryLogs);
    sessionStorage.setItem(STORAGE_KEY, serialized);
    localStorage.setItem(STORAGE_KEY, serialized);
  } catch {
    // Storage quota or unavailable
  }
}

export function logApiRequest(entry: Omit<ApiLogEntry, 'id' | 'timestamp' | 'timeMs'>): ApiLogEntry {
  const now = new Date();
  const newLog: ApiLogEntry = {
    ...entry,
    id: `req_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    timeMs: now.getTime(),
  };

  memoryLogs = [newLog, ...memoryLogs].slice(0, MAX_LOGS);
  persistLogs();
  notifyListeners();
  return newLog;
}

export function getApiLogs(): ApiLogEntry[] {
  return [...memoryLogs];
}

export function clearApiLogs(): void {
  memoryLogs = [];
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
  notifyListeners();
}

export function subscribeToApiLogs(callback: ApiLogListener): () => void {
  listeners.add(callback);
  callback([...memoryLogs]);
  return () => {
    listeners.delete(callback);
  };
}
