import React from 'react';
import { PlayerGameState } from '../services/logWatcher';
import { Swords, Home, WifiOff } from 'lucide-react';

interface PlayerStateBadgeProps {
  state: PlayerGameState;
  stateLabel: string;
  playerName?: string | null;
  heroName?: string | null;
  mapName?: string | null;
}

export const PlayerStateBadge: React.FC<PlayerStateBadgeProps> = ({
  state,
  stateLabel,
  playerName,
  heroName,
  mapName,
}) => {
  if (state === 'in_game') {
    return (
      <div
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 shadow-sm transition-all"
        title={`Playing ${heroName || 'Match'} on ${mapName || 'Midtown'}${
          playerName ? ` (${playerName})` : ''
        }`}
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        <Swords className="w-3.5 h-3.5 text-emerald-400" />
        <div className="flex flex-col text-left">
          <span className="text-[11px] font-black uppercase tracking-wider leading-none">
            {stateLabel || 'IN GAME'}
          </span>
          {heroName && (
            <span className="text-[9px] text-emerald-400/80 font-medium font-mono leading-none mt-0.5">
              {heroName}
            </span>
          )}
        </div>
      </div>
    );
  }

  if (state === 'hideout') {
    return (
      <div
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-sky-950/50 border border-sky-500/40 text-sky-300 shadow-sm transition-all"
        title={`In Hideout / Lobby${playerName ? ` (${playerName})` : ''}`}
      >
        <span className="h-2 w-2 rounded-full bg-sky-400" />
        <Home className="w-3.5 h-3.5 text-sky-400" />
        <div className="flex flex-col text-left">
          <span className="text-[11px] font-black uppercase tracking-wider leading-none">
            IN HIDEOUT
          </span>
          {playerName && (
            <span className="text-[9px] text-sky-400/80 font-medium font-mono leading-none mt-0.5">
              {playerName}
            </span>
          )}
        </div>
      </div>
    );
  }

  // Disconnected / Offline
  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/40 border border-deadlock-border text-deadlock-muted transition-all"
      title="Deadlock is offline or -condebug log file is not detected"
    >
      <span className="h-2 w-2 rounded-full bg-neutral-600" />
      <WifiOff className="w-3.5 h-3.5 opacity-60" />
      <span className="text-[11px] font-bold uppercase tracking-wider leading-none">
        DISCONNECTED
      </span>
    </div>
  );
};
