import React, { useState, useEffect, useMemo } from 'react';
import occultCorner from '../assets/occult/corner.svg';
import { Match, Side, LaneColor, LANE_LABELS } from '../types/match';
import { HeroPicker } from './HeroPicker';
import { calculateBestDraftActions } from '../services/analytics';
import { ParsedGameContext } from '../services/logWatcher';
import { scanEscapeMenuDraft, ScreenScanResult } from '../services/screenOcr';
import { ActiveSlot } from './draft/types';
import { DraftHeader } from './draft/DraftHeader';
import { DraftLanesBoard } from './draft/DraftLanesBoard';
import { DraftDecisionTree } from './draft/DraftDecisionTree';
import { OcrInspectorModal } from './draft/OcrInspectorModal';

interface DraftAssistantViewProps {
  matches: Match[];
  gameContext?: ParsedGameContext;
}

export const DraftAssistantView: React.FC<DraftAssistantViewProps> = ({ matches, gameContext }) => {
  // 1. Patron Factions (Side)
  const [side, setSide] = useState<Side>('hidden_king');
  const enemySide: Side = side === 'hidden_king' ? 'archmother' : 'hidden_king';

  // 2. Bans (Exactly 2 banned heroes in the game)
  const [bannedHeroIds, setBannedHeroIds] = useState<(number | null)[]>([null, null]);

  // 3. Your Hero & Assigned Lane
  const [myHeroId, setMyHeroId] = useState<number | null>(null);
  const [assignedLane, setAssignedLane] = useState<LaneColor>('green');

  // 4. The 3 Duo Lanes Draft (Yellow, Blue, Green: 2 allies & 2 enemies each = exactly 6v6)
  const [lanes, setLanes] = useState<Record<LaneColor, { allies: (number | null)[]; enemies: (number | null)[] }>>({
    yellow: { allies: [null, null], enemies: [null, null] },
    blue: { allies: [null, null], enemies: [null, null] },
    green: { allies: [null, null], enemies: [null, null] },
  });

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
  }, [gameContext?.assignedLane]);

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
  }, [gameContext?.myHeroId, assignedLane, myHeroId]);

  // 5. Active slot targeting for one-click hero picker assignment
  const [activeSlot, setActiveSlot] = useState<ActiveSlot | null>({
    type: 'lane',
    lane: 'green',
    team: 'allies',
    index: 0,
  });

  // Memoized: Calculate all picked heroes across all lanes
  const pickedHeroIds = useMemo(() => {
    const ids: number[] = [];
    (['yellow', 'blue', 'green'] as const).forEach((l) => {
      lanes[l].allies.forEach((id) => id && ids.push(id));
      lanes[l].enemies.forEach((id) => id && ids.push(id));
    });
    return ids;
  }, [lanes]);

  // Memoized: Calculate all currently unavailable heroes (unique hero rule across the whole game + bans)
  const allUnavailableHeroIds = useMemo(() => {
    return [
      ...pickedHeroIds,
      ...bannedHeroIds.filter((id): id is number => id !== null),
    ];
  }, [pickedHeroIds, bannedHeroIds]);

  // Memoized: Lanes filtered of nulls for draft advisor input
  const advisorLanes = useMemo(() => {
    return {
      yellow: {
        allies: lanes.yellow.allies.filter((id): id is number => id !== null),
        enemies: lanes.yellow.enemies.filter((id): id is number => id !== null),
      },
      blue: {
        allies: lanes.blue.allies.filter((id): id is number => id !== null),
        enemies: lanes.blue.enemies.filter((id): id is number => id !== null),
      },
      green: {
        allies: lanes.green.allies.filter((id): id is number => id !== null),
        enemies: lanes.green.enemies.filter((id): id is number => id !== null),
      },
    };
  }, [lanes]);

  // Memoized: Combinatorial Best Actions Analysis (Hero switch x Lane swap)
  const bestActionsAdvisor = useMemo(() => {
    if (!myHeroId) return null;
    return calculateBestDraftActions(
      matches,
      myHeroId,
      assignedLane,
      advisorLanes,
      allUnavailableHeroIds
    );
  }, [matches, myHeroId, assignedLane, advisorLanes, allUnavailableHeroIds]);

  // Handle hero click in the HeroPicker
  const handleSelectHero = (heroId: number) => {
    // 1. If hero is already in bans, remove it
    if (bannedHeroIds.includes(heroId)) {
      setBannedHeroIds(bannedHeroIds.map((id) => (id === heroId ? null : id)));
      return;
    }

    // 2. If hero is already in one of the lanes, remove it
    const nextLanes = {
      yellow: { allies: [...lanes.yellow.allies], enemies: [...lanes.yellow.enemies] },
      blue: { allies: [...lanes.blue.allies], enemies: [...lanes.blue.enemies] },
      green: { allies: [...lanes.green.allies], enemies: [...lanes.green.enemies] },
    };

    (['yellow', 'blue', 'green'] as const).forEach((l) => {
      nextLanes[l].allies = nextLanes[l].allies.map((id) => (id === heroId ? null : id));
      nextLanes[l].enemies = nextLanes[l].enemies.map((id) => (id === heroId ? null : id));
    });

    if (pickedHeroIds.includes(heroId)) {
      if (myHeroId === heroId) setMyHeroId(null);
      setLanes(nextLanes);
      return;
    }

    // 3. Otherwise assign to current active slot
    if (!activeSlot) return;

    if (activeSlot.type === 'ban') {
      const nextBans = [...bannedHeroIds];
      nextBans[activeSlot.index] = heroId;
      setBannedHeroIds(nextBans);
      // Auto-advance to next ban or first ally slot
      if (activeSlot.index === 0 && nextBans[1] === null) {
        setActiveSlot({ type: 'ban', index: 1 });
      } else {
        setActiveSlot({ type: 'lane', lane: assignedLane, team: 'allies', index: 0 });
      }
    } else {
      const { lane: l, team, index } = activeSlot;
      nextLanes[l][team][index] = heroId;

      // If assigning to your lane slot 0 and you have no hero set, assign to you
      if (l === assignedLane && team === 'allies' && !myHeroId) {
        setMyHeroId(heroId);
      }

      setLanes(nextLanes);

      // Auto advance to next empty slot
      if (index === 0 && nextLanes[l][team][1] === null) {
        setActiveSlot({ type: 'lane', lane: l, team, index: 1 });
      } else if (team === 'allies') {
        setActiveSlot({ type: 'lane', lane: l, team: 'enemies', index: 0 });
      }
    }
  };

  const handleReset = () => {
    setBannedHeroIds([null, null]);
    setMyHeroId(null);
    setAssignedLane('green');
    setLanes({
      yellow: { allies: [null, null], enemies: [null, null] },
      blue: { allies: [null, null], enemies: [null, null] },
      green: { allies: [null, null], enemies: [null, null] },
    });
    setActiveSlot({ type: 'lane', lane: 'green', team: 'allies', index: 0 });
  };

  // Screen OCR Scanning (reads Deadlock Escape Menu on demand)
  const [isScanningScreen, setIsScanningScreen] = useState(false);
  const [scanStatusMessage, setScanStatusMessage] = useState<string | null>(null);
  const [lastScanResult, setLastScanResult] = useState<ScreenScanResult | null>(null);
  const [showOcrInspector, setShowOcrInspector] = useState(false);

  const handleScanScreen = async () => {
    try {
      setIsScanningScreen(true);
      setScanStatusMessage('Capturing game screen & running OCR...');

      const result = await scanEscapeMenuDraft();
      setLastScanResult(result);
      
      let alliesPlaced = 0;
      let enemiesPlaced = 0;

      setLanes((prev) => {
        const nextLanes = {
          yellow: { allies: [...prev.yellow.allies], enemies: [...prev.yellow.enemies] },
          blue: { allies: [...prev.blue.allies], enemies: [...prev.blue.enemies] },
          green: { allies: [...prev.green.allies], enemies: [...prev.green.enemies] },
        };

        // Deadlock lists heroes in exact lane order:
        // Indices 0,1: Yellow lane | Indices 2,3: Blue lane | Indices 4,5: Green lane
        const orderedLanes: LaneColor[] = ['yellow', 'blue', 'green'];

        // Map Allies (Indices 0..5 -> Yellow[0,1], Blue[0,1], Green[0,1])
        result.allies.forEach((ally, i) => {
          if (i < 6) {
            const laneIndex = Math.floor(i / 2);
            const slotIndex = i % 2;
            const targetLane = orderedLanes[laneIndex];
            nextLanes[targetLane].allies[slotIndex] = ally.id;
            alliesPlaced++;
          }
        });

        // Map Enemies (Indices 0..5 -> Yellow[0,1], Blue[0,1], Green[0,1])
        result.enemies.forEach((enemy, i) => {
          if (i < 6) {
            const laneIndex = Math.floor(i / 2);
            const slotIndex = i % 2;
            const targetLane = orderedLanes[laneIndex];
            nextLanes[targetLane].enemies[slotIndex] = enemy.id;
            enemiesPlaced++;
          }
        });

        return nextLanes;
      });

      // Auto-assign player's side/patron if detected
      if (result.detectedSide) {
        setSide(result.detectedSide);
      }

      setScanStatusMessage(`Scan complete: ${alliesPlaced} allies & ${enemiesPlaced} enemies detected! Click "Journal OCR" to inspect details.`);
      setTimeout(() => setScanStatusMessage(null), 8000);
    } catch (err) {
      console.error('Screen OCR scan failed:', err);
      setScanStatusMessage(`Scan error: ${err}`);
      setTimeout(() => setScanStatusMessage(null), 8000);
    } finally {
      setIsScanningScreen(false);
    }
  };

  return (
    <div className="relative">
      {/* Massive Occult Corners placed directly beneath the App Header adapting dynamically to window width */}
      <div className="fixed top-[74px] left-0 right-0 pointer-events-none z-20 flex justify-between overflow-hidden">
        <img
          src={occultCorner}
          alt=""
          aria-hidden="true"
          className="w-36 h-36 sm:w-48 sm:h-48 md:w-64 md:h-64 opacity-85 drop-shadow-[0_0_24px_rgba(107,76,138,0.8)] select-none"
        />
        <img
          src={occultCorner}
          alt=""
          aria-hidden="true"
          className="w-36 h-36 sm:w-48 sm:h-48 md:w-64 md:h-64 opacity-85 -scale-x-100 drop-shadow-[0_0_24px_rgba(107,76,138,0.8)] select-none"
        />
      </div>

      <div className="flex flex-col gap-6 relative z-10">
        {/* 1. TOP SETUP HEADER: SIDES + BANS + RESET + LIVE SYNC */}
        <DraftHeader
          side={side}
          onSideChange={setSide}
          bannedHeroIds={bannedHeroIds}
          onSelectBanSlot={(index) => setActiveSlot({ type: 'ban', index })}
          onRemoveBan={(index) => {
            const next = [...bannedHeroIds];
            next[index] = null;
            setBannedHeroIds(next);
          }}
          activeSlot={activeSlot}
          isScanningScreen={isScanningScreen}
          onScanScreen={handleScanScreen}
          hasLastScanResult={lastScanResult !== null}
          onOpenOcrInspector={() => setShowOcrInspector(true)}
          onReset={handleReset}
          scanStatusMessage={scanStatusMessage}
          gameContext={gameContext}
          assignedLane={assignedLane}
          onSetAssignedLane={handleSetAssignedLane}
        />

        {/* 2. THE 3 DUO LANES BOARD */}
        <DraftLanesBoard
          lanes={lanes}
          assignedLane={assignedLane}
          myHeroId={myHeroId}
          activeSlot={activeSlot}
          onSelectSlot={setActiveSlot}
          onSetMyHeroId={setMyHeroId}
          onRemoveHero={(lane, team, index) => {
            const heroToRemove = lanes[lane][team][index];
            const next = { ...lanes };
            next[lane][team][index] = null;
            setLanes(next);
            if (team === 'allies' && myHeroId === heroToRemove) {
              setMyHeroId(null);
            }
          }}
          onSetAssignedLane={handleSetAssignedLane}
        />

        {/* 3. OPTIMAL ACTIONS VISUAL DECISION TREE & 4. FAST HERO PICKER */}
        {/* Stacks vertically on base/small screens, splits side-by-side on wide/2K screens */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          <div className="xl:col-span-7 flex flex-col gap-6">
            <DraftDecisionTree
              bestActionsAdvisor={bestActionsAdvisor}
              myHeroId={myHeroId}
            />
          </div>

          <div className="xl:col-span-5 xl:sticky xl:top-[90px]">
            <HeroPicker
              title={
                activeSlot?.type === 'ban'
                  ? `Select Hero to Ban #${activeSlot.index + 1}`
                  : activeSlot
                  ? `Pick Hero for ${activeSlot.team === 'allies' ? 'Allied Duo' : 'Enemy Duo'} (${LANE_LABELS[activeSlot.lane]} Slot #${activeSlot.index + 1})`
                  : 'Select a hero'
              }
              subtitle="Only 1 copy per hero allowed in the match. Banned heroes and already picked heroes are disabled."
              selectedHeroIds={allUnavailableHeroIds}
              disabledHeroIds={allUnavailableHeroIds}
              onSelectHero={handleSelectHero}
              accentColor={activeSlot?.type === 'ban' ? 'default' : activeSlot?.team === 'allies' ? side : enemySide}
            />
          </div>
        </div>

      {/* 5. OCR JOURNAL & DIAGNOSTIC MODAL */}
      <OcrInspectorModal
        isOpen={showOcrInspector}
        onClose={() => setShowOcrInspector(false)}
        lastScanResult={lastScanResult}
      />
    </div>
    </div>
  );
};


