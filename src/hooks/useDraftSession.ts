import { useState, useEffect, useMemo, useRef } from 'react';
import { Side, LaneColor } from '../types/match';
import { ParsedGameContext } from '../services/logWatcher';
import { ScreenScanResult } from '../services/screenOcr';
import { loadUserSettings, saveUserSettings } from '../services/userSettings';
import {
  loadDraftSessionState,
  saveDraftSessionState,
  resetDraftSessionState,
} from '../services/draftStorage';

export interface UseDraftSessionReturn {
  side: Side;
  setSide: React.Dispatch<React.SetStateAction<Side>>;
  bannedHeroIds: (number | null)[];
  setBannedHeroIds: React.Dispatch<React.SetStateAction<(number | null)[]>>;
  myHeroId: number | null;
  setMyHeroId: React.Dispatch<React.SetStateAction<number | null>>;
  assignedLane: LaneColor;
  handleSetAssignedLane: (newLane: LaneColor) => void;
  lanes: Record<LaneColor, { allies: (number | null)[]; enemies: (number | null)[] }>;
  setLanes: React.Dispatch<React.SetStateAction<Record<LaneColor, { allies: (number | null)[]; enemies: (number | null)[] }>>>;
  lastScanResult: ScreenScanResult | null;
  setLastScanResult: React.Dispatch<React.SetStateAction<ScreenScanResult | null>>;
  isLanesCollapsed: boolean;
  setIsLanesCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  handleToggleLanesCollapse: () => void;
  triggerAutoCollapse: () => void;
  isManualMode: boolean;
  handleToggleManualMode: (
    assignedLaneCurrent: LaneColor,
    setActiveSlot: React.Dispatch<React.SetStateAction<import('./useDraftSession').ActiveSlotRef | null>>
  ) => void;
  handleResetDraft: (
    isManualModeCurrent: boolean,
    setActiveSlot: React.Dispatch<React.SetStateAction<import('./useDraftSession').ActiveSlotRef | null>>
  ) => void;
}

// Re-exported minimal ActiveSlot type needed by handleToggleManualMode / handleResetDraft callbacks
export type ActiveSlotRef =
  | { type: 'ban'; index: number }
  | { type: 'lane'; lane: LaneColor; team: 'allies' | 'enemies'; index: number };

interface UseDraftSessionOptions {
  gameContext?: ParsedGameContext;
}

/**
 * Manages all persistent draft session state, auto-save, manual-mode preference,
 * and game-context sync that were previously inline in DraftAssistantView.
 */
export function useDraftSession({ gameContext }: UseDraftSessionOptions): UseDraftSessionReturn {
  // Persistent Draft Session State across tab changes & reloads
  const initialSession = useMemo(() => loadDraftSessionState(), []);

  // Mode Manuel vs Mode Auto (OCR & Sync)
  const [isManualMode, setIsManualMode] = useState<boolean>(() => {
    return loadUserSettings().draftMode === 'manual';
  });

  // Collapsible state for The 3 Duo Lanes Astral Alignment board
  const [isLanesCollapsed, setIsLanesCollapsed] = useState<boolean>(() => initialSession.isLanesCollapsed);
  const autoCollapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearAutoCollapseTimer = () => {
    if (autoCollapseTimerRef.current) {
      clearTimeout(autoCollapseTimerRef.current);
      autoCollapseTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => clearAutoCollapseTimer();
  }, []);

  const handleToggleLanesCollapse = () => {
    clearAutoCollapseTimer();
    setIsLanesCollapsed((prev) => !prev);
  };

  /**
   * Expands board, then auto-collapses after 3 seconds to reveal swap/switch recommendations.
   * Called after a successful OCR scan.
   */
  const triggerAutoCollapse = () => {
    setIsLanesCollapsed(false);
    clearAutoCollapseTimer();
    autoCollapseTimerRef.current = setTimeout(() => {
      setIsLanesCollapsed(true);
      autoCollapseTimerRef.current = null;
    }, 3000);
  };

  const handleToggleManualMode = (
    assignedLaneCurrent: LaneColor,
    setActiveSlot: React.Dispatch<React.SetStateAction<ActiveSlotRef | null>>
  ) => {
    clearAutoCollapseTimer();
    setIsLanesCollapsed(false); // Keep board open in manual mode for slot selection
    setIsManualMode((prev) => {
      const next = !prev;
      saveUserSettings({ draftMode: next ? 'manual' : 'ocr' });
      if (!next) {
        setActiveSlot(null);
      } else {
        setActiveSlot({ type: 'lane', lane: assignedLaneCurrent, team: 'allies', index: 0 });
      }
      return next;
    });
  };

  // 1. Patron Factions (Side)
  const [side, setSide] = useState<Side>(() => initialSession.side);

  // 2. Bans (Exactly 3 banned heroes in the match)
  const [bannedHeroIds, setBannedHeroIds] = useState<(number | null)[]>(() => initialSession.bannedHeroIds);

  // 3. Your Hero & Assigned Lane
  const [myHeroId, setMyHeroId] = useState<number | null>(() => initialSession.myHeroId);
  const [assignedLane, setAssignedLane] = useState<LaneColor>(() => initialSession.assignedLane);

  // 4. The 3 Duo Lanes Draft (Yellow, Blue, Green: 2 allies & 2 enemies each = exactly 6v6)
  const [lanes, setLanes] = useState<Record<LaneColor, { allies: (number | null)[]; enemies: (number | null)[] }>>(
    () => initialSession.lanes
  );

  const handleSetAssignedLane = (newLane: LaneColor) => {
    setAssignedLane(newLane);
    if (myHeroId) {
      setLanes((prev) => {
        const next = {
          yellow: { allies: [...prev.yellow.allies], enemies: [...prev.yellow.enemies] },
          blue: { allies: [...prev.blue.allies], enemies: [...prev.blue.enemies] },
          green: { allies: [...prev.green.allies], enemies: [...prev.green.enemies] },
        };

        // Remove my hero from any current ally slot
        (['yellow', 'blue', 'green'] as const).forEach((l) => {
          if (next[l].allies[0] === myHeroId) next[l].allies[0] = null;
          if (next[l].allies[1] === myHeroId) next[l].allies[1] = null;
        });

        // Place my hero into slot 0 of the new assigned lane
        next[newLane].allies[0] = myHeroId;
        return next;
      });
    }
  };

  // Auto-sync player's assigned lane from gameContext if detected
  useEffect(() => {
    if (gameContext?.assignedLane && gameContext.assignedLane !== assignedLane) {
      handleSetAssignedLane(gameContext.assignedLane);
    }
  }, [gameContext?.assignedLane]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-sync player's hero from gameContext if detected
  useEffect(() => {
    if (gameContext?.myHeroId && gameContext.myHeroId !== myHeroId) {
      setMyHeroId(gameContext.myHeroId);
      setLanes((prev) => {
        const next = {
          yellow: { allies: [...prev.yellow.allies], enemies: [...prev.yellow.enemies] },
          blue: { allies: [...prev.blue.allies], enemies: [...prev.blue.enemies] },
          green: { allies: [...prev.green.allies], enemies: [...prev.green.enemies] },
        };
        // Remove from anywhere else
        (['yellow', 'blue', 'green'] as const).forEach((l) => {
          if (next[l].allies[0] === gameContext.myHeroId) next[l].allies[0] = null;
          if (next[l].allies[1] === gameContext.myHeroId) next[l].allies[1] = null;
        });
        next[assignedLane].allies[0] = gameContext.myHeroId;
        return next;
      });
    }
  }, [gameContext?.myHeroId, assignedLane, myHeroId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Screen scan result persistence
  const [lastScanResult, setLastScanResult] = useState<ScreenScanResult | null>(() => initialSession.lastScanResult);

  // Persist draft slots and state so they survive tab changes & reloads until Reset or new Scan
  useEffect(() => {
    saveDraftSessionState({
      side,
      bannedHeroIds,
      myHeroId,
      assignedLane,
      lanes,
      lastScanResult,
      isLanesCollapsed,
    });
  }, [side, bannedHeroIds, myHeroId, assignedLane, lanes, lastScanResult, isLanesCollapsed]);

  const handleResetDraft = (
    isManualModeCurrent: boolean,
    setActiveSlot: React.Dispatch<React.SetStateAction<ActiveSlotRef | null>>
  ) => {
    clearAutoCollapseTimer();
    resetDraftSessionState();
    setBannedHeroIds([null, null, null]);
    setMyHeroId(null);
    setAssignedLane('green');
    setSide('hidden_king');
    setLanes({
      yellow: { allies: [null, null], enemies: [null, null] },
      blue: { allies: [null, null], enemies: [null, null] },
      green: { allies: [null, null], enemies: [null, null] },
    });
    setLastScanResult(null);
    setIsLanesCollapsed(false);
    if (isManualModeCurrent) {
      setActiveSlot({ type: 'lane', lane: 'green', team: 'allies', index: 0 });
    } else {
      setActiveSlot(null);
    }
  };

  return {
    side,
    setSide,
    bannedHeroIds,
    setBannedHeroIds,
    myHeroId,
    setMyHeroId,
    assignedLane,
    handleSetAssignedLane,
    lanes,
    setLanes,
    lastScanResult,
    setLastScanResult,
    isLanesCollapsed,
    setIsLanesCollapsed,
    handleToggleLanesCollapse,
    triggerAutoCollapse,
    isManualMode,
    handleToggleManualMode,
    handleResetDraft,
  };
}
