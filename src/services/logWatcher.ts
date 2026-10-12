import { invoke } from '@tauri-apps/api/core';
import { findHeroBySource2Name } from '../data/heroes';

export interface LogEvent {
  timestamp: string;
  rawLine: string;
  eventType: 'info' | 'match_found' | 'hero_detected' | 'status';
}

export type PlayerGameState = 'in_game' | 'draft' | 'hideout' | 'disconnected';

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

export async function isDeadlockGameRunning(): Promise<boolean> {
  if (isTauriEnvironment()) {
    try {
      return await invoke<boolean>('is_deadlock_running');
    } catch (err) {
      console.error('Failed to check if Deadlock is running:', err);
    }
  }
  return true; // Browser preview default
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

  let isHideout = true;

  for (const event of events) {
    const line = event.rawLine;

    // Check if connecting to or playing a remote match
    if (
      line.includes('Host activate: Remote Connect') ||
      line.includes('Hideout Lobby Connection State: Invalid') ||
      line.includes('Connected to \'=[A:') ||
      line.includes('Connecting to =[A:') ||
      line.includes('dl_midtown') ||
      (line.includes('Lobby ') && line.includes('for Match '))
    ) {
      isHideout = false;
      if (result.mapName && result.mapName.toLowerCase().includes('hideout')) {
        result.mapName = null;
      }
    }

    // Check if returning to Hideout
    if (
      line.includes('Created physics for dl_hideout') ||
      line.includes('Loading map "dl_hideout"') ||
      line.includes('Spawn Server: dl_hideout') ||
      line.includes('OnGameStateChanged: GameOver') ||
      line.includes('OnGameStateChanged: End') ||
      line.includes('Disconnecting from server')
    ) {
      isHideout = true;
      result.mapName = 'dl_hideout';
      result.state = 'hideout';
      result.stateLabel = 'In Hideout';
    }

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
    // e.g.: [Client] Created physics for dl_hideout / dl_midtown
    // or: [HostStateManager] Host activate: Loading (dl_hideout)
    const mapPhysicsMatch = line.match(/(?:Created physics for|Host activate: Loading \()([a-zA-Z0-9_-]+)/i);
    if (mapPhysicsMatch) {
      result.mapName = mapPhysicsMatch[1];
      if (mapPhysicsMatch[1].toLowerCase().includes('hideout')) {
        isHideout = true;
      } else {
        isHideout = false;
      }
    }
    const mapAttrMatch = line.match(/Map:\s*"([^"]+)"/i);
    if (mapAttrMatch) {
      result.mapName = mapAttrMatch[1];
      if (mapAttrMatch[1].toLowerCase().includes('hideout')) {
        isHideout = true;
      } else {
        isHideout = false;
      }
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

    // 7. Game State Transitions (Source 2 / Deadlock)
    // dl_hideout boots dummy bots and briefly executes states in <0.1s.
    // In actual matches, draft, intro and pregame states persist for 20-90 seconds.
    if (line.includes('HeroSelection')) {
      if (!isHideout) {
        result.state = 'draft';
        result.stateLabel = 'Hero Selection';
      }
    } else if (line.includes('WaitingForPlayersToJoin')) {
      if (!isHideout) {
        result.state = 'draft';
        result.stateLabel = 'Hero Selection';
      }
    } else if (line.includes('MatchIntro')) {
      if (!isHideout) {
        result.state = 'draft';
        result.stateLabel = 'Match Intro';
      }
    } else if (line.includes('PreGameWait')) {
      if (!isHideout) {
        result.state = 'draft';
        result.stateLabel = 'Pre-Game Draft';
      }
    } else if (line.includes('WaitForMapToLoad')) {
      if (!isHideout) {
        if (result.state !== 'draft') {
          result.state = 'draft';
        }
        result.stateLabel = 'Loading Match';
      }
    } else if (line.includes('GameInProgress')) {
      if (isHideout) {
        result.state = 'hideout';
        result.stateLabel = 'In Hideout';
      } else {
        result.state = 'in_game';
        result.stateLabel = 'In Game';
      }
    } else if (line.includes('PostGame')) {
      if (!isHideout) {
        result.state = 'in_game';
        result.stateLabel = 'Post Game';
      }
    } else if (
      line.includes('OnGameStateChanged: GameOver') ||
      line.includes('OnGameStateChanged: End') ||
      line.includes('Disconnecting from server') ||
      (line.includes('CLoopModeRemoteConnect::OnClientFrameSimulate switching to "levelload"') && line.includes('dl_hideout'))
    ) {
      isHideout = true;
      result.state = 'hideout';
      result.stateLabel = 'In Hideout';
    } else if (line.includes('Hideout Lobby Connection State: NoLobby') || line.includes('Created physics for dl_hideout')) {
      isHideout = true;
      result.state = 'hideout';
      result.stateLabel = 'In Hideout';
    }
  }

  // Final check: If explicitly marked hideout, player is in Hideout
  if (isHideout || (result.mapName && result.mapName.toLowerCase().includes('hideout'))) {
    result.state = 'hideout';
    result.stateLabel = 'In Hideout';
  } else if (result.state !== 'draft' && result.mapName && result.mapName.toLowerCase().includes('midtown')) {
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
