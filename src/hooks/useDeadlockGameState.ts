import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ParsedGameContext,
  PlayerGameState,
  detectDeadlockLogPath,
  readDeadlockLogEvents,
  parseDeadlockLogEvents,
  isDeadlockGameRunning,
} from '../services/logWatcher';

const DEFAULT_LOG_PATH =
  'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Deadlock\\game\\citadel\\console.log';

/**
 * Adaptive polling intervals in milliseconds.
 * - Active match/draft: fast updates for immediate lane & hero detection.
 * - Hideout / Idle: moderate pace to detect match launches without wasting CPU.
 * - Disconnected: slow heartbeat to check if Deadlock was launched.
 * - Background / Tab hidden: throttled to minimize resource usage.
 */
export const ADAPTIVE_POLL_INTERVALS = {
  ACTIVE_MATCH: 2000,
  HIDEOUT: 4000,
  DISCONNECTED: 10000,
  BACKGROUND: 15000,
} as const;

function calculatePollingDelay(state: PlayerGameState, isVisible: boolean): number {
  if (!isVisible) {
    return ADAPTIVE_POLL_INTERVALS.BACKGROUND;
  }
  switch (state) {
    case 'in_game':
    case 'draft':
      return ADAPTIVE_POLL_INTERVALS.ACTIVE_MATCH;
    case 'hideout':
      return ADAPTIVE_POLL_INTERVALS.HIDEOUT;
    case 'disconnected':
    default:
      return ADAPTIVE_POLL_INTERVALS.DISCONNECTED;
  }
}

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
  const latestStateRef = useRef<PlayerGameState>('disconnected');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep latestStateRef in sync with gameContext.state
  useEffect(() => {
    latestStateRef.current = gameContext.state;
  }, [gameContext.state]);

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

  const pollLogs = useCallback(async (): Promise<PlayerGameState> => {
    if (!logPath.trim()) return 'disconnected';

    try {
      // 1. Verify if Deadlock game window/process is currently running
      const isRunning = await isDeadlockGameRunning();
      if (!isRunning) {
        const nextState: PlayerGameState = 'disconnected';
        latestStateRef.current = nextState;
        setGameContext((prev) => ({
          ...prev,
          state: nextState,
          stateLabel: 'Offline',
          lastUpdated: new Date().toLocaleTimeString(),
        }));
        return nextState;
      }

      // 2. Read and parse recent log events
      const events = await readDeadlockLogEvents(logPath.trim(), 131072); // 128KB buffer
      consecutiveFailuresRef.current = 0;
      const parsed = parseDeadlockLogEvents(events);
      latestStateRef.current = parsed.state;
      setGameContext(parsed);
      return parsed.state;
    } catch {
      consecutiveFailuresRef.current += 1;
      // If fails 2 times in a row, mark disconnected
      if (consecutiveFailuresRef.current >= 2) {
        const nextState: PlayerGameState = 'disconnected';
        latestStateRef.current = nextState;
        setGameContext((prev) => ({
          ...prev,
          state: nextState,
          stateLabel: 'Offline',
          lastUpdated: new Date().toLocaleTimeString(),
        }));
        return nextState;
      }
      return latestStateRef.current;
    }
  }, [logPath]);

  // Adaptive Polling loop with visibility listener
  useEffect(() => {
    if (!isWatching) return;

    let isSubscribed = true;

    const clearExistingTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const scheduleNextPoll = (currentState: PlayerGameState) => {
      clearExistingTimer();
      if (!isSubscribed) return;

      const isVisible = typeof document !== 'undefined' ? document.visibilityState === 'visible' : true;
      const delay = calculatePollingDelay(currentState, isVisible);

      timerRef.current = setTimeout(async () => {
        if (!isSubscribed) return;
        const nextState = await pollLogs();
        scheduleNextPoll(nextState);
      }, delay);
    };

    // Immediate initial poll, then start adaptive scheduler
    pollLogs().then((initialState) => {
      if (isSubscribed) {
        scheduleNextPoll(initialState);
      }
    });

    // When user refocuses the app, trigger an instant refresh
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        pollLogs().then((currentState) => {
          scheduleNextPoll(currentState);
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isSubscribed = false;
      clearExistingTimer();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
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
