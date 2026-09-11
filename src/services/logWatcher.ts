import { invoke } from '@tauri-apps/api/core';
import { findHeroBySource2Name } from '../data/heroes';

export interface LogEvent {
  timestamp: string;
  rawLine: string;
  eventType: 'info' | 'match_found' | 'hero_detected' | 'status';
}

export type PlayerGameState = 'in_game' | 'hideout' | 'disconnected';

export interface ParsedGameContext {
  state: PlayerGameState;
  stateLabel: string;
  playerName: string | null;
  playerSlot: number | null;
  myHeroId: number | null;
  myHeroName: string | null;
  assignedLane: 'yellow' | 'blue' | 'green' | null;
  detectedHeroIds: number[];
  mapName: string | null;
  matchId: number | null;
  lastUpdated: string;
}

function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function detectDeadlockLogPath(): Promise<string | null> {
  if (isTauriEnvironment()) {
    try {
      const detected = await invoke<string | null>('detect_deadlock_log_path');
      return detected;
    } catch (err) {
      console.error('Failed to detect Deadlock log path via Tauri:', err);
    }
  }
  return null;
}

export async function readDeadlockLogEvents(
  path: string,
  maxBytes?: number
): Promise<LogEvent[]> {
  if (isTauriEnvironment()) {
    try {
      return await invoke<LogEvent[]>('read_deadlock_log_events', {
        path,
        maxBytes,
      });
    } catch (err) {
      throw new Error(`Log read failed: ${err}`);
    }
  }

  // Mock events for browser testing
  return [
    {
      timestamp: new Date().toLocaleTimeString(),
      rawLine: '[Browser Mock] Running in browser preview. Connect with Deadlock desktop app for live Source 2 log stream.',
      eventType: 'info',
    },
  ];
}

export async function saveDeadlockDebugLog(
  targetPath: string,
  content: string
): Promise<boolean> {
  if (isTauriEnvironment()) {
    try {
      return await invoke<boolean>('save_deadlock_debug_log', {
        targetPath,
        content,
      });
    } catch (err) {
      console.error('Failed to save log via Tauri:', err);
      throw err;
    }
  }

  // Fallback: browser download
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'deadlock_debug_log.txt';
  a.click();
  URL.revokeObjectURL(url);
  return true;
}

/**
 * Parses raw Deadlock log events to extract player state, hero picks, and game transitions.
 */
export function parseDeadlockLogEvents(events: LogEvent[]): ParsedGameContext {
  const result: ParsedGameContext = {
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
    lastUpdated: new Date().toLocaleTimeString(),
  };

  if (!events || events.length === 0) {
    return result;
  }

  // If we have active events, the client is at least in Hideout / Running
  result.state = 'hideout';
  result.stateLabel = 'In Hideout';

  const seenHeroIds = new Set<number>();

  for (const event of events) {
    const line = event.rawLine;

    // 1. Detect Local Player Name and Slot
    // e.g.: [Prediction] Added prediction for player slot 1 (Remynder)
    const playerMatch = line.match(/Added prediction for player slot\s+(\d+)\s*\(([^)]+)\)/i);
    if (playerMatch) {
      result.playerSlot = parseInt(playerMatch[1], 10);
      result.playerName = playerMatch[2].trim();
    }

    // 2. Detect Local Player's Active Hero (Camera Pose)
    // e.g.: [Client] VMDL Camera Pose Success! "models/heroes_wip/wraith/wraith.vmdl" has loaded camera poses
    if (line.includes('VMDL Camera Pose Success!') || line.includes('cached_hero_builds')) {
      const hero = findHeroBySource2Name(line);
      if (hero) {
        result.myHeroId = hero.id;
        result.myHeroName = hero.name;
        seenHeroIds.add(hero.id);
      }
    }

    // 3. Detect Map Name
    // e.g.: [Client] Created physics for dl_midtown
    const mapPhysicsMatch = line.match(/Created physics for\s+([a-zA-Z0-9_-]+)/i);
    if (mapPhysicsMatch) {
      result.mapName = mapPhysicsMatch[1];
    }
    const mapAttrMatch = line.match(/Map:\s*"([^"]+)"/i);
    if (mapAttrMatch) {
      result.mapName = mapAttrMatch[1];
    }

    // 5. Detect Assigned Lane
    const laneMatch = line.match(/(?:citadel_active_lane|assigned_lane|lane)[:=\s]+([a-zA-Z0-9_]+)/i);
    if (laneMatch) {
      const val = laneMatch[1].toLowerCase();
      if (val === '1' || val === 'yellow' || val === 'orange') {
        result.assignedLane = 'yellow';
      } else if (val === '3' || val === 'green') {
        result.assignedLane = 'green';
      } else if (val === '4' || val === 'blue') {
        result.assignedLane = 'blue';
      }
    }

    // 6. Detect Match ID
    const matchIdMatch = line.match(/match[_\s]?id[:=\s]+(\d{6,10})/i);
    if (matchIdMatch) {
      result.matchId = parseInt(matchIdMatch[1], 10);
    }

    // 6. Game State Transitions
    // e.g.: OnGameStateChanged: GameInProgress (7)
    if (line.includes('OnGameStateChanged: GameInProgress')) {
      result.state = 'in_game';
      result.stateLabel = 'In Game';
    } else if (line.includes('OnGameStateChanged: PreGameWait')) {
      result.state = 'in_game';
      result.stateLabel = 'Pre-Game Wait';
    } else if (line.includes('OnGameStateChanged: MatchIntro')) {
      result.state = 'in_game';
      result.stateLabel = 'Match Intro';
    } else if (line.includes('OnGameStateChanged: WaitForMapToLoad')) {
      result.state = 'in_game';
      result.stateLabel = 'Loading Game';
    } else if (line.includes('OnGameStateChanged: GameOver') || line.includes('Disconnecting from server')) {
      result.state = 'hideout';
      result.stateLabel = 'In Hideout';
    } else if (line.includes('Hideout Lobby Connection State') && result.state !== 'in_game') {
      result.state = 'hideout';
      result.stateLabel = 'In Hideout';
    }
  }

  // If connected to a game server or physics created for midtown, mark in_game
  if (result.mapName && result.mapName.includes('midtown') && result.state === 'hideout') {
    result.state = 'in_game';
    result.stateLabel = 'In Game';
  }

  // If player hero was not explicitly tagged by camera pose, but only 1 hero detected, set as player's hero
  if (!result.myHeroId && seenHeroIds.size === 1) {
    const onlyId = Array.from(seenHeroIds)[0];
    result.myHeroId = onlyId;
  }

  // Filter out the local player's hero from the general detected list to keep other draft heroes distinct
  result.detectedHeroIds = Array.from(seenHeroIds).filter(
    (id) => id !== result.myHeroId
  );

  return result;
}
