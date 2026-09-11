import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ParsedGameContext,
  detectDeadlockLogPath,
  readDeadlockLogEvents,
  parseDeadlockLogEvents,
} from '../services/logWatcher';

const DEFAULT_LOG_PATH =
  'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Deadlock\\game\\citadel\\console.log';

export function useDeadlockGameState() {
  const [logPath, setLogPath] = useState<string>(() => {
    return localStorage.getItem('deadlock_custom_log_path') || DEFAULT_LOG_PATH;
  });

  const [gameContext, setGameContext] = useState<ParsedGameContext>({
    state: 'disconnected',
    stateLabel: 'Offline',
    playerName: null,
    playerSlot: null,
    myHeroId: null,
    myHeroName: null,
    assignedLane: null,
    detectedHeroIds: [],
    mapName: null,
    matchId: null,
    lastUpdated: '',
  });

  const [isWatching, setIsWatching] = useState<boolean>(true);
  const consecutiveFailuresRef = useRef<number>(0);

  // Auto-detect log path on start
  useEffect(() => {
    async function autoDetect() {
      const detected = await detectDeadlockLogPath();
      if (detected) {
        setLogPath(detected);
        localStorage.setItem('deadlock_custom_log_path', detected);
      }
    }
    autoDetect();
  }, []);

  const pollLogs = useCallback(async () => {
    if (!logPath.trim()) return;

    try {
      const events = await readDeadlockLogEvents(logPath.trim(), 131072); // 128KB buffer
      consecutiveFailuresRef.current = 0;
      const parsed = parseDeadlockLogEvents(events);
      setGameContext(parsed);
    } catch {
      consecutiveFailuresRef.current += 1;
      // If fails 2 times in a row, mark disconnected
      if (consecutiveFailuresRef.current >= 2) {
        setGameContext((prev) => ({
          ...prev,
          state: 'disconnected',
          stateLabel: 'Offline',
        }));
      }
    }
  }, [logPath]);

  // Polling loop
  useEffect(() => {
    pollLogs();
    if (!isWatching) return;

    const interval = setInterval(() => {
      pollLogs();
    }, 2500);

    return () => clearInterval(interval);
  }, [pollLogs, isWatching]);

  return {
    gameContext,
    isWatching,
    setIsWatching,
    logPath,
    setLogPath,
    refreshNow: pollLogs,
  };
}
