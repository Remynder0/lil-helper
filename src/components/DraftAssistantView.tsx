import React, { useState } from 'react';
import { Match, Side, LaneColor, LANE_LABELS, SIDE_LABELS } from '../types/match';
import { getHeroById } from '../data/heroes';
import { HeroAvatar } from './HeroAvatar';
import { HeroPicker } from './HeroPicker';
import {
  calculateBestDraftActions,
  BestActionsAdvisorResult,
} from '../services/analytics';
import {
  Brain,
  RotateCcw,
  Users,
  Swords,
  Ban,
  ArrowRightLeft,
  Crown,
  Compass,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

interface DraftAssistantViewProps {
  matches: Match[];
}

type ActiveSlot =
  | { type: 'lane'; lane: LaneColor; team: 'allies' | 'enemies'; index: number }
  | { type: 'ban'; index: number };

export const DraftAssistantView: React.FC<DraftAssistantViewProps> = ({ matches }) => {
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

  // 5. Active slot targeting for one-click hero picker assignment
  const [activeSlot, setActiveSlot] = useState<ActiveSlot | null>({
    type: 'lane',
    lane: 'green',
    team: 'allies',
    index: 0,
  });

  // Calculate all currently unavailable heroes (unique hero rule across the whole game + bans)
  const pickedHeroIds: number[] = [];
  (['yellow', 'blue', 'green'] as const).forEach((l) => {
    lanes[l].allies.forEach((id) => id && pickedHeroIds.push(id));
    lanes[l].enemies.forEach((id) => id && pickedHeroIds.push(id));
  });

  const allUnavailableHeroIds = [
    ...pickedHeroIds,
    ...bannedHeroIds.filter((id): id is number => id !== null),
  ];

  // Combinatorial Best Actions Analysis (Hero switch x Lane swap)
  const bestActionsAdvisor: BestActionsAdvisorResult | null = myHeroId
    ? calculateBestDraftActions(
        matches,
        myHeroId,
        assignedLane,
        {
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
        },
        allUnavailableHeroIds
      )
    : null;

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

  return (
    <div className="flex flex-col gap-6">
      {/* 1. TOP SETUP HEADER: SIDES + BANS + RESET */}
      <div className="bg-deadlock-panel border border-deadlock-border/80 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        {/* Left: Title & Patron Side Selection */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div>
            <h2 className="text-base font-bold text-gray-100 flex items-center gap-2">
              <Brain className="w-5 h-5 text-deadlock-accent" />
              <span>Deadlock Draft & Pre-Match Assistant</span>
            </h2>
            <p className="text-xs text-deadlock-muted">
              Live optimal actions: Hero switch & Lane swap advice (with Plan B fallback)
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-deadlock-dark p-1 rounded-lg border border-deadlock-border">
            <button
              type="button"
              onClick={() => setSide('hidden_king')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                side === 'hidden_king'
                  ? 'bg-deadlock-hidden-king/25 border border-deadlock-hidden-king text-yellow-300 shadow-sm'
                  : 'text-deadlock-muted hover:text-white'
              }`}
            >
              <Crown className="w-3.5 h-3.5 text-deadlock-hidden-king" />
              <span>{SIDE_LABELS.hidden_king}</span>
            </button>
            <button
              type="button"
              onClick={() => setSide('archmother')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                side === 'archmother'
                  ? 'bg-deadlock-archmother/25 border border-deadlock-archmother text-blue-300 shadow-sm'
                  : 'text-deadlock-muted hover:text-white'
              }`}
            >
              <Crown className="w-3.5 h-3.5 text-deadlock-archmother" />
              <span>{SIDE_LABELS.archmother}</span>
            </button>
          </div>
        </div>

        {/* Right: The 2 Bans & Reset */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-red-400 flex items-center gap-1">
              <Ban className="w-3.5 h-3.5" /> Bans (2):
            </span>
            <div className="flex items-center gap-1.5">
              {[0, 1].map((banIdx) => {
                const banHeroId = bannedHeroIds[banIdx];
                const isActive = activeSlot?.type === 'ban' && activeSlot.index === banIdx;
                return (
                  <div
                    key={banIdx}
                    onClick={() => setActiveSlot({ type: 'ban', index: banIdx })}
                    className={`cursor-pointer p-1 rounded-lg border transition-all ${
                      isActive
                        ? 'border-red-500 bg-red-950/40 ring-1 ring-red-500'
                        : 'border-deadlock-border/80 bg-deadlock-dark hover:border-gray-500'
                    }`}
                  >
                    <HeroAvatar
                      heroId={banHeroId}
                      size="xs"
                      onRemove={
                        banHeroId
                          ? () => {
                              const next = [...bannedHeroIds];
                              next[banIdx] = null;
                              setBannedHeroIds(next);
                            }
                          : undefined
                      }
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-deadlock-border bg-deadlock-dark hover:bg-deadlock-border text-xs font-semibold text-deadlock-muted hover:text-white transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* 2. THE 3 DUO LANES BOARD (6v6: Yellow, Blue, Green) */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-deadlock-accent" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-200">
              The 3 Duo Lanes (6 Allies vs 6 Enemies)
            </h3>
          </div>
          <span className="text-xs text-deadlock-muted">
            Click any slot to target it, then click a hero in the picker below
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(['yellow', 'blue', 'green'] as const).map((laneColor) => {
            const laneData = lanes[laneColor];
            const isMyLane = assignedLane === laneColor;
            const borderColor =
              laneColor === 'yellow'
                ? 'border-yellow-500/40'
                : laneColor === 'blue'
                ? 'border-blue-500/40'
                : 'border-emerald-500/40';

            return (
              <div
                key={laneColor}
                className={`bg-deadlock-panel border rounded-xl p-4 flex flex-col gap-3 transition-all ${borderColor} ${
                  isMyLane ? 'ring-2 ring-deadlock-accent/60 shadow-lg shadow-deadlock-accent/10' : ''
                }`}
              >
                {/* Lane Header + Set as My Lane button */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-3 h-3 rounded-full ${
                        laneColor === 'yellow'
                          ? 'bg-yellow-400'
                          : laneColor === 'blue'
                          ? 'bg-blue-400'
                          : 'bg-emerald-400'
                      }`}
                    />
                    <span className="font-bold text-sm text-gray-200 capitalize">
                      {LANE_LABELS[laneColor]}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setAssignedLane(laneColor)}
                    className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider border transition-all ${
                      isMyLane
                        ? 'bg-deadlock-accent border-deadlock-accent text-white shadow-sm'
                        : 'bg-deadlock-dark border-deadlock-border text-deadlock-muted hover:text-white'
                    }`}
                  >
                    {isMyLane ? '★ Your Lane' : 'Set as My Lane'}
                  </button>
                </div>

                {/* Allies on this lane (2 slots) */}
                <div className="flex flex-col gap-1.5 p-2.5 rounded-lg bg-deadlock-dark/60 border border-deadlock-border/60">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-deadlock-archmother flex items-center gap-1">
                    <Users className="w-3 h-3" /> Allied Duo
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {[0, 1].map((idx) => {
                      const heroId = laneData.allies[idx];
                      const isYou = heroId !== null && heroId === myHeroId;
                      const isActive =
                        activeSlot?.type === 'lane' &&
                        activeSlot.lane === laneColor &&
                        activeSlot.team === 'allies' &&
                        activeSlot.index === idx;

                      return (
                        <div
                          key={idx}
                          onClick={() => {
                            setActiveSlot({ type: 'lane', lane: laneColor, team: 'allies', index: idx });
                            if (heroId) setMyHeroId(heroId);
                          }}
                          className={`flex flex-col items-center justify-center p-2 rounded-lg border cursor-pointer transition-all ${
                            isActive
                              ? 'border-deadlock-archmother bg-deadlock-archmother/20 ring-1 ring-deadlock-archmother'
                              : isYou
                              ? 'border-deadlock-accent bg-deadlock-accent/20'
                              : 'border-deadlock-border/40 bg-deadlock-panel hover:border-gray-500'
                          }`}
                        >
                          <HeroAvatar
                            heroId={heroId}
                            size="sm"
                            showName
                            onRemove={
                              heroId
                                ? () => {
                                    const next = { ...lanes };
                                    next[laneColor].allies[idx] = null;
                                    setLanes(next);
                                    if (myHeroId === heroId) setMyHeroId(null);
                                  }
                                : undefined
                            }
                          />
                          {isYou && (
                            <span className="text-[9px] text-deadlock-accent font-black mt-0.5">YOU</span>
                          )}
                          {!heroId && (
                            <span className="text-[10px] text-deadlock-muted font-mono mt-1">
                              Slot #{idx + 1}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Enemies on this lane (2 slots) */}
                <div className="flex flex-col gap-1.5 p-2.5 rounded-lg bg-deadlock-dark/60 border border-deadlock-border/60">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-deadlock-hidden-king flex items-center gap-1">
                    <Swords className="w-3 h-3" /> Enemy Duo
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {[0, 1].map((idx) => {
                      const heroId = laneData.enemies[idx];
                      const isActive =
                        activeSlot?.type === 'lane' &&
                        activeSlot.lane === laneColor &&
                        activeSlot.team === 'enemies' &&
                        activeSlot.index === idx;

                      return (
                        <div
                          key={idx}
                          onClick={() =>
                            setActiveSlot({ type: 'lane', lane: laneColor, team: 'enemies', index: idx })
                          }
                          className={`flex flex-col items-center justify-center p-2 rounded-lg border cursor-pointer transition-all ${
                            isActive
                              ? 'border-deadlock-hidden-king bg-deadlock-hidden-king/20 ring-1 ring-deadlock-hidden-king'
                              : 'border-deadlock-border/40 bg-deadlock-panel hover:border-gray-500'
                          }`}
                        >
                          <HeroAvatar
                            heroId={heroId}
                            size="sm"
                            showName
                            onRemove={
                              heroId
                                ? () => {
                                    const next = { ...lanes };
                                    next[laneColor].enemies[idx] = null;
                                    setLanes(next);
                                  }
                                : undefined
                            }
                          />
                          {!heroId && (
                            <span className="text-[10px] text-deadlock-muted font-mono mt-1">
                              Enemy #{idx + 1}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. OPTIMAL ACTIONS VISUAL DECISION TREE */}
      <div className="bg-deadlock-panel border border-deadlock-border rounded-xl p-5 flex flex-col gap-5 relative overflow-hidden">
        <div className="flex items-center justify-between pb-3 border-b border-deadlock-border/60">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-deadlock-accent" />
            <h3 className="font-bold text-sm uppercase tracking-wide text-gray-100">
              Recommended Draft & Lane Actions
            </h3>
          </div>
          {bestActionsAdvisor && myHeroId && (
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-deadlock-muted">Current projected WR:</span>
              <span className="font-black px-2 py-0.5 rounded bg-deadlock-dark border border-deadlock-border text-gray-200">
                {bestActionsAdvisor.currentProjectedWinRate}% WR
              </span>
            </div>
          )}
        </div>

        {!myHeroId ? (
          <div className="py-8 flex flex-col items-center justify-center text-center text-deadlock-muted">
            <Users className="w-8 h-8 mb-2 opacity-40 text-deadlock-accent" />
            <p className="text-xs italic">
              Click on an allied hero slot on your lane to set your hero and display action recommendations.
            </p>
          </div>
        ) : bestActionsAdvisor ? (
          (() => {
            const currentHero = bestActionsAdvisor.currentHero;
            const currentLane = bestActionsAdvisor.currentLane;
            const bestOverall = bestActionsAdvisor.bestOverallAction;
            const bestSafe = bestActionsAdvisor.bestSafeActionWithoutSwap;

            const isSwapSuggested = bestOverall.isSwapRequested && bestOverall.id !== bestSafe.id;

            return (
              <div className="w-full overflow-x-auto py-2">
                <div className="min-w-[700px] flex items-center">
                  {/* ROOT NODE: Current Hero + Current Lane + Current Projected WR */}
                  <div className="flex flex-col items-center p-3 rounded-xl bg-deadlock-dark border-2 border-deadlock-border shrink-0 w-[140px] shadow-md z-10">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-deadlock-muted mb-1.5 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-deadlock-accent animate-pulse" />
                      Current
                    </div>
                    <HeroAvatar heroId={myHeroId} size="md" />
                    <span className="text-xs font-black text-gray-100 mt-1 text-center truncate max-w-full">
                      {currentHero?.name || 'Unknown'}
                    </span>
                    <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-deadlock-panel border border-deadlock-border text-gray-300 mt-0.5">
                      {LANE_LABELS[currentLane]}
                    </span>
                    <div className="text-sm font-black font-mono text-gray-300 mt-1.5">
                      {bestActionsAdvisor.currentProjectedWinRate}% WR
                    </div>
                  </div>

                  {/* BRANCHES */}
                  {!isSwapSuggested ? (
                    /* CASE 1: SINGLE STRAIGHT BRANCH (NO SWAP NEEDED) */
                    <div className="flex items-center flex-1">
                      {/* CONNECTING ARROW WITH +XX% BADGE */}
                      <div className="relative flex-1 flex items-center justify-center min-w-[120px] px-2">
                        <div className="w-full h-0.5 bg-gradient-to-r from-deadlock-accent/60 to-deadlock-win" />
                        <div className="absolute right-0 text-deadlock-win">
                          <ArrowRight className="w-5 h-5 -mr-2.5" />
                        </div>
                        {/* +XX% badge on arrow */}
                        <div className="absolute -top-3.5 px-2 py-0.5 rounded-full bg-deadlock-win text-black text-[11px] font-black font-mono shadow-md whitespace-nowrap">
                          {bestOverall.deltaVsCurrent >= 0
                            ? `+${bestOverall.deltaVsCurrent}%`
                            : `${bestOverall.deltaVsCurrent}%`}
                        </div>
                      </div>

                      {/* TARGET NODE */}
                      <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-gradient-to-r from-deadlock-win/15 via-deadlock-dark to-deadlock-dark border-2 border-deadlock-win/50 flex-1 shadow-md">
                        <div className="flex items-center gap-3">
                          <HeroAvatar heroId={bestOverall.heroId} size="md" isHighlighted />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-black text-white">
                                {bestOverall.hero?.name}
                              </span>
                              <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-deadlock-dark border border-deadlock-border text-gray-300">
                                {LANE_LABELS[bestOverall.lane]}
                              </span>
                            </div>
                            <div className="text-xs text-deadlock-win font-semibold mt-0.5">
                              {bestOverall.type === 'stay_current'
                                ? 'Keep current configuration'
                                : `Switch to ${bestOverall.hero?.name}`}
                            </div>
                            <div className="text-[10px] text-deadlock-muted">
                              {bestOverall.deltaVsCurrent > 0
                                ? `Optimal matchup (+${bestOverall.deltaVsCurrent}% win rate)`
                                : 'Most balanced option'}
                            </div>
                          </div>
                        </div>

                        <div className="text-right font-mono shrink-0">
                          <div className="text-2xl font-black text-deadlock-win">
                            {bestOverall.projectedWinRate}%
                          </div>
                          <span className="text-[11px] text-deadlock-muted font-sans font-semibold">
                            Projected WR
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* CASE 2: FORKED TREE WITH 2 BRANCHES (OPTION 1 WITH SWAP vs OPTION 2 WITHOUT SWAP) */
                    <div className="flex items-center flex-1">
                      {/* SVG TREE CONNECTOR WITH LABELED ARROWS */}
                      <div className="relative w-[130px] h-[190px] shrink-0">
                        <svg className="w-full h-full" viewBox="0 0 130 190" fill="none">
                          {/* Stem from Root */}
                          <line x1="0" y1="95" x2="35" y2="95" stroke="#4ade80" strokeWidth="2.5" strokeOpacity="0.8" />
                          
                          {/* Top Branch (Option 1: Lane Swap) */}
                          <path
                            d="M 35 95 C 65 95, 65 40, 115 40"
                            stroke="#4ade80"
                            strokeWidth="2.5"
                            fill="none"
                          />
                          <polygon points="113,35 125,40 113,45" fill="#4ade80" />

                          {/* Bottom Branch (Option 2: Without Swap) */}
                          <path
                            d="M 35 95 C 65 95, 65 150, 115 150"
                            stroke="#60a5fa"
                            strokeWidth="2.5"
                            fill="none"
                          />
                          <polygon points="113,145 125,150 113,155" fill="#60a5fa" />
                        </svg>

                        {/* +XX% Badge on Top Branch (With Swap) */}
                        <div className="absolute top-[18px] left-[45px] px-2 py-0.5 rounded-full bg-deadlock-win text-black text-[10px] font-black font-mono shadow-md whitespace-nowrap">
                          {bestOverall.deltaVsCurrent >= 0
                            ? `+${bestOverall.deltaVsCurrent}%`
                            : `${bestOverall.deltaVsCurrent}%`}
                        </div>

                        {/* +XX% Badge on Bottom Branch (Without Swap) */}
                        <div className="absolute bottom-[18px] left-[45px] px-2 py-0.5 rounded-full bg-blue-500 text-white text-[10px] font-black font-mono shadow-md whitespace-nowrap">
                          {bestSafe.deltaVsCurrent >= 0
                            ? `+${bestSafe.deltaVsCurrent}%`
                            : `${bestSafe.deltaVsCurrent}%`}
                        </div>
                      </div>

                      {/* BRANCH CARDS */}
                      <div className="flex flex-col gap-3.5 flex-1">
                        {/* BRANCH 1: OPTION 1 (MAX WR WITH LANE SWAP) */}
                        <div className="flex items-center justify-between gap-4 p-3.5 rounded-xl bg-gradient-to-r from-deadlock-win/15 via-deadlock-dark to-deadlock-dark border-2 border-deadlock-win/50 shadow-md">
                          <div className="flex items-center gap-3">
                            <div className="flex flex-col min-w-[80px]">
                              <span className="text-[10px] font-black uppercase tracking-wider text-deadlock-win flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-deadlock-win" />
                                Option 1
                              </span>
                              <span className="text-[10px] text-deadlock-muted font-medium">
                                With lane swap
                              </span>
                            </div>

                            {/* Swap Visual: [Current Hero] ⇄ [Ally Hero] */}
                            <div className="flex items-center gap-2 p-1.5 rounded-lg bg-deadlock-panel/90 border border-deadlock-border">
                              <div className="flex flex-col items-center">
                                <HeroAvatar heroId={myHeroId} size="sm" />
                                <span className="text-[10px] font-semibold text-gray-300 mt-0.5">
                                  {currentHero?.name}
                                </span>
                              </div>

                              <div className="flex flex-col items-center text-amber-400 px-1">
                                <ArrowRightLeft className="w-4 h-4" />
                                <span className="text-[8px] uppercase font-bold tracking-wider">Swap</span>
                              </div>

                              <div className="flex flex-col items-center">
                                <HeroAvatar heroId={bestOverall.laneSwapWithAllyId} size="sm" />
                                <span className="text-[10px] font-semibold text-gray-300 mt-0.5">
                                  {getHeroById(bestOverall.laneSwapWithAllyId || 0)?.name}
                                </span>
                              </div>
                            </div>

                            {/* If hero switch is also needed after swap */}
                            {bestOverall.heroId !== myHeroId && (
                              <div className="flex items-center gap-2">
                                <ArrowRight className="w-4 h-4 text-deadlock-win" />
                                <div className="flex flex-col items-center p-1.5 rounded-lg bg-deadlock-win/10 border border-deadlock-win/40">
                                  <HeroAvatar heroId={bestOverall.heroId} size="sm" isHighlighted />
                                  <span className="text-[10px] font-bold text-deadlock-win mt-0.5">
                                    {bestOverall.hero?.name}
                                  </span>
                                </div>
                              </div>
                            )}

                            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-deadlock-dark border border-deadlock-border text-gray-300">
                              Lane {LANE_LABELS[bestOverall.lane]}
                            </span>
                          </div>

                          <div className="text-right font-mono shrink-0 pl-2">
                            <div className="text-2xl font-black text-deadlock-win">
                              {bestOverall.projectedWinRate}%
                            </div>
                            <span className="text-[10px] text-deadlock-muted font-sans font-semibold">
                              Max Projected WR
                            </span>
                          </div>
                        </div>

                        {/* BRANCH 2: OPTION 2 (WITHOUT SWAP / IF REFUSED) */}
                        <div className="flex items-center justify-between gap-4 p-3.5 rounded-xl bg-gradient-to-r from-blue-500/15 via-deadlock-dark to-deadlock-dark border-2 border-blue-500/40 shadow-md">
                          <div className="flex items-center gap-3">
                            <div className="flex flex-col min-w-[80px]">
                              <span className="text-[10px] font-black uppercase tracking-wider text-blue-400 flex items-center gap-1">
                                Option 2
                              </span>
                              <span className="text-[10px] text-deadlock-muted font-medium">
                                If swap denied
                              </span>
                            </div>

                            {/* Hero to pick or keep */}
                            <div className="flex items-center gap-2.5 p-1.5 rounded-lg bg-deadlock-panel/90 border border-deadlock-border">
                              <HeroAvatar heroId={bestSafe.heroId} size="sm" />
                              <div className="flex flex-col">
                                <span className="text-xs font-bold text-gray-100">
                                  {bestSafe.hero?.name}
                                </span>
                                <span className="text-[10px] text-deadlock-muted">
                                  {bestSafe.heroId === myHeroId
                                    ? 'Keep your current hero'
                                    : `Switch to ${bestSafe.hero?.name}`}
                                </span>
                              </div>
                            </div>

                            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-deadlock-dark border border-deadlock-border text-gray-300">
                              Lane {LANE_LABELS[bestSafe.lane]}
                            </span>
                          </div>

                          <div className="text-right font-mono shrink-0 pl-2">
                            <div className="text-2xl font-black text-blue-300">
                              {bestSafe.projectedWinRate}%
                            </div>
                            <span className="text-[10px] text-deadlock-muted font-sans font-semibold">
                              Safe Projected WR
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()
        ) : null}
      </div>

      {/* 4. FAST HERO PICKER (Disabled heroes = already picked in 6v6 or banned) */}
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
  );
};
