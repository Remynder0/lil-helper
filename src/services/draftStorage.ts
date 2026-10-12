import { Side, LaneColor } from '../types/match';
import { ScreenScanResult } from './screenOcr';

export interface DraftSessionState {
  side: Side;
  bannedHeroIds: (number | null)[];
  myHeroId: number | null;
  assignedLane: LaneColor;
  lanes: Record<LaneColor, { allies: (number | null)[]; enemies: (number | null)[] }>;
  lastScanResult: ScreenScanResult | null;
  isLanesCollapsed: boolean;
}

export const INITIAL_DRAFT_SESSION_STATE: DraftSessionState = {
  side: 'hidden_king',
  bannedHeroIds: [null, null, null],
  myHeroId: null,
  assignedLane: 'green',
  lanes: {
    yellow: { allies: [null, null], enemies: [null, null] },
    blue: { allies: [null, null], enemies: [null, null] },
    green: { allies: [null, null], enemies: [null, null] },
  },
  lastScanResult: null,
  isLanesCollapsed: false,
};

const DRAFT_SESSION_STORAGE_KEY = 'deadlock_draft_session_v1';

/**
 * Loads the active draft session state from localStorage.
 */
export function loadDraftSessionState(): DraftSessionState {
  try {
    const raw = localStorage.getItem(DRAFT_SESSION_STORAGE_KEY);
    if (!raw) return INITIAL_DRAFT_SESSION_STATE;

    const parsed = JSON.parse(raw);
    return {
      side: parsed.side === 'archmother' ? 'archmother' : 'hidden_king',
      bannedHeroIds:
        Array.isArray(parsed.bannedHeroIds) && parsed.bannedHeroIds.length === 3
          ? parsed.bannedHeroIds
          : [null, null, null],
      myHeroId: typeof parsed.myHeroId === 'number' ? parsed.myHeroId : null,
      assignedLane:
        parsed.assignedLane === 'yellow' || parsed.assignedLane === 'blue' || parsed.assignedLane === 'green'
          ? parsed.assignedLane
          : 'green',
      lanes: {
        yellow: {
          allies: parsed.lanes?.yellow?.allies || [null, null],
          enemies: parsed.lanes?.yellow?.enemies || [null, null],
        },
        blue: {
          allies: parsed.lanes?.blue?.allies || [null, null],
          enemies: parsed.lanes?.blue?.enemies || [null, null],
        },
        green: {
          allies: parsed.lanes?.green?.allies || [null, null],
          enemies: parsed.lanes?.green?.enemies || [null, null],
        },
      },
      lastScanResult: parsed.lastScanResult || null,
      isLanesCollapsed: Boolean(parsed.isLanesCollapsed),
    };
  } catch (err) {
    console.error('Failed to load draft session state:', err);
    return INITIAL_DRAFT_SESSION_STATE;
  }
}

/**
 * Saves current draft session state into localStorage.
 */
export function saveDraftSessionState(state: Partial<DraftSessionState>): void {
  try {
    const current = loadDraftSessionState();
    const updated: DraftSessionState = {
      ...current,
      ...state,
    };
    localStorage.setItem(DRAFT_SESSION_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to save draft session state:', err);
  }
}

/**
 * Resets draft session state back to empty slots.
 */
export function resetDraftSessionState(): DraftSessionState {
  try {
    localStorage.removeItem(DRAFT_SESSION_STORAGE_KEY);
  } catch (err) {
    console.error('Failed to clear draft session state:', err);
  }
  return INITIAL_DRAFT_SESSION_STATE;
}
