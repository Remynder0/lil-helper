import React from 'react';
import { LaneColor, LANE_LABELS } from '../../types/match';
import { HeroAvatar } from '../HeroAvatar';
import { Compass, Users, Swords } from 'lucide-react';
import { ActiveSlot } from './types';

interface DraftLanesBoardProps {
  lanes: Record<LaneColor, { allies: (number | null)[]; enemies: (number | null)[] }>;
  assignedLane: LaneColor;
  myHeroId: number | null;
  activeSlot: ActiveSlot | null;
  onSelectSlot: (slot: ActiveSlot) => void;
  onSetMyHeroId: (heroId: number | null) => void;
  onRemoveHero: (lane: LaneColor, team: 'allies' | 'enemies', index: number) => void;
  onSetAssignedLane: (lane: LaneColor) => void;
}

export const DraftLanesBoard: React.FC<DraftLanesBoardProps> = ({
  lanes,
  assignedLane,
  myHeroId,
  activeSlot,
  onSelectSlot,
  onSetMyHeroId,
  onRemoveHero,
  onSetAssignedLane,
}) => {
  return (
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
                  onClick={() => onSetAssignedLane(laneColor)}
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
                          onSelectSlot({ type: 'lane', lane: laneColor, team: 'allies', index: idx });
                          if (heroId) onSetMyHeroId(heroId);
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
                              ? () => onRemoveHero(laneColor, 'allies', idx)
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
                          onSelectSlot({ type: 'lane', lane: laneColor, team: 'enemies', index: idx })
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
                              ? () => onRemoveHero(laneColor, 'enemies', idx)
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
  );
};
