import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { DemParseResult, RankedTodoContext } from '../types/demTypes';
import { convertDemResultToMatch } from '../services/deadlockApi';
import { calculateRankedProgression } from '../services/rankedCalculator';
import { Match } from '../types/match';

export type DemParserState = 'idle' | 'detecting' | 'parsing' | 'success' | 'error';

interface UseDemParserReturn {
  state: DemParserState;
  result: Match | null;
  error: string | null;
  rankedTodo: RankedTodoContext | null;
  /** Parse a .dem file at the given path */
  parseFile: (path: string, customDateMs?: number) => Promise<Match | null>;
  /** Try to detect the .dem file path from Steam replays folder */
  detectAndParse: (customDateMs?: number) => Promise<Match | null>;
  /** Reset state to idle */
  reset: () => void;
}

/**
 * Hook for parsing .dem replay files via the Tauri backend.
 * Handles detection, parsing, match conversion, and ranked todo generation.
 */
export function useDemParser(
  matchId: number,
  accountId: number,
  allMatches: Match[],
  fallbackDetectedAt?: number | null
): UseDemParserReturn {
  const [state, setState] = useState<DemParserState>('idle');
  const [result, setResult] = useState<Match | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rankedTodo, setRankedTodo] = useState<RankedTodoContext | null>(null);

  const reset = useCallback(() => {
    setState('idle');
    setResult(null);
    setError(null);
    setRankedTodo(null);
  }, []);

  /**
   * Builds the ranked context and calculates progression from the closest previous match.
   */
  const buildRankedContext = useCallback(
    (matchDate: string, matchResult: 'win' | 'loss' | 'cancel'): RankedTodoContext => {
      const calculated = calculateRankedProgression(matchResult, matchDate, allMatches);
      const previousMatch = allMatches
        .filter((m) => m.date < matchDate && m.rankedDelta !== undefined && m.rankedDelta !== null)
        .sort((a, b) => b.date.localeCompare(a.date))[0];

      return {
        matchResult,
        previousMatchDelta: previousMatch?.rankedDelta ?? null,
        previousMatchShields: previousMatch?.rankedDemotionProtection ?? null,
        calculated,
      };
    },
    [allMatches]
  );

  /**
   * Parse a .dem file at the given absolute path.
   */
  const parseFile = useCallback(
    async (path: string, customDateMs?: number): Promise<Match | null> => {
      setState('parsing');
      setError(null);

      try {
        const demResult = await invoke<DemParseResult>('parse_dem_file', {
          path,
          myAccountId: accountId,
          matchId: matchId,
        });

        // Build ranked data from context & deadlock rules
        const matchResult =
          demResult.myTeam === demResult.winningTeam ? 'win' as const :
          demResult.winningTeam === 0 ? 'cancel' as const :
          'loss' as const;

        // The parser strictly uses detectedAt (from live log or manual user input)
        // and NEVER uses the .dem file date from disk (which only reflects download time).
        const targetMs = customDateMs ?? fallbackDetectedAt;
        const effectiveDate =
          targetMs && targetMs > 0
            ? new Date(targetMs).toISOString()
            : new Date().toISOString();

        const rankedCtx = buildRankedContext(effectiveDate, matchResult);
        setRankedTodo(rankedCtx);

        // Convert to app Match with auto-calculated ranked fields & guaranteed date!
        const match = convertDemResultToMatch(demResult, rankedCtx.calculated, effectiveDate);

        setResult(match);
        setState('success');
        return match;
      } catch (err: any) {
        const msg = typeof err === 'string' ? err : err?.message || 'Unknown error';
        setError(msg);
        setState('error');
        return null;
      }
    },
    [accountId, matchId, fallbackDetectedAt, buildRankedContext]
  );

  /**
   * Try to detect the .dem file from Steam's replays folder,
   * then parse it if found.
   */
  const detectAndParse = useCallback(async (customDateMs?: number): Promise<Match | null> => {
    setState('detecting');
    setError(null);

    try {
      // Use the existing Tauri command that scans drives A-Z for Deadlock install
      const logPath = await invoke<string | null>('detect_deadlock_log_path');

      if (!logPath) {
        setError('Could not locate Deadlock installation path.');
        setState('error');
        return null;
      }

      // logPath looks like: K:\SteamLibrary\steamapps\common\Deadlock\game\citadel\console.log
      // We need:            K:\SteamLibrary\steamapps\common\Deadlock\game\citadel\replays\{matchId}.dem
      const basePath = logPath.replace(/console\.log$/i, '');
      const demPath = `${basePath}replays\\${matchId}.dem`;

      return await parseFile(demPath, customDateMs);
    } catch (err: any) {
      const msg = typeof err === 'string' ? err : err?.message || 'Replay detection error';
      setError(msg);
      setState('error');
      return null;
    }
  }, [matchId, parseFile]);

  return {
    state,
    result,
    error,
    rankedTodo,
    parseFile,
    detectAndParse,
    reset,
  };
}
