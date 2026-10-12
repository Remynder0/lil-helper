import React from 'react';
import { History, BarChart2, Brain, User, Gauge } from 'lucide-react';
import { ConnectedProfile } from '../types/match';
import { PlayerStateBadge } from './PlayerStateBadge';
import { ProfileDropdownMenu } from './ProfileDropdownMenu';
import { ParsedGameContext } from '../services/logWatcher';
import { useUIStore, AppTab } from '../stores/useUIStore';
import { useMatchStore, selectTotalMatches, selectWinRate } from '../stores/useMatchStore';
import victorianBadge from '../assets/victorian-metal/badge.svg';
import artDecoDivider from '../assets/art-deco/divider.svg';
import artDecoCartouche from '../assets/art-deco/cartouche.svg';

export type { AppTab };

interface AppHeaderProps {
  gameContext: ParsedGameContext;
  profile: ConnectedProfile | null;
  isSyncing: boolean;
  cooldownRemaining: number;
  onSync: () => void;
  onExport: () => void;
  onTriggerImportFile: () => void;
  onDisconnect: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  gameContext,
  profile,
  isSyncing,
  cooldownRemaining,
  onSync,
  onExport,
  onTriggerImportFile,
  onDisconnect,
}) => {
  const activeTab = useUIStore((s) => s.activeTab);
  const setActiveTab = useUIStore((s) => s.setActiveTab);
  const setProfileModalOpen = useUIStore((s) => s.setProfileModalOpen);

  const totalMatches = useMatchStore(selectTotalMatches);
  const winRate = useMatchStore(selectWinRate);

  return (
    <header className="steam-glass border-b-2 border-deadlock-brass/40 px-4 sm:px-6 py-3.5 fixed top-0 left-0 right-0 w-full z-40 shadow-[0_4px_20px_rgba(0,0,0,0.7)]">
      {/* Decorative background brass conduit line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-deadlock-accent/60 to-transparent" />

      <div className="w-full max-w-6xl xl:max-w-7xl 2xl:max-w-[1680px] mx-auto flex items-center justify-between">
        {/* Brand & Steampunk Apparatus Emblem */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="flex items-center gap-2">
            {/* Prominent mechanical turning gears */}
            <img src={victorianBadge} alt="" aria-hidden="true" className="w-8 h-8 shrink-0 animate-[spin_12s_linear_infinite] drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]" />
          </div>
        </div>

        {/* Global Quick Stats & Navigation */}
        <div className="flex items-center gap-2.5 sm:gap-4 text-xs relative z-10">
        {/* Art Deco Cartouche Stats: Matches & Winrate with preserved 160:50 ratio */}
        <div className="flex items-center gap-2.5">
          {/* Matches Cartouche */}
          <div className="relative h-[44px] w-[140px] flex items-center justify-center group drop-shadow-[0_2px_10px_rgba(0,0,0,0.7)]">
            <img
              src={artDecoCartouche}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-contain pointer-events-none transition-all duration-300 filter drop-shadow-[0_0_8px_rgba(232,192,106,0.25)] group-hover:drop-shadow-[0_0_14px_rgba(232,192,106,0.5)]"
            />
            <div className="relative z-10 flex items-center gap-1.5 text-deadlock-muted text-xs px-2.5">
              <Gauge className="w-4 h-4 text-deadlock-accent shrink-0" />
              <span className="truncate">Matches: <strong className="text-deadlock-steam font-mono font-bold text-sm">{totalMatches}</strong></span>
            </div>
          </div>

          {/* Winrate Cartouche */}
          <div className="relative h-[44px] w-[140px] flex items-center justify-center group drop-shadow-[0_2px_10px_rgba(0,0,0,0.7)]">
            <img
              src={artDecoCartouche}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-contain pointer-events-none transition-all duration-300 filter drop-shadow-[0_0_8px_rgba(232,192,106,0.25)] group-hover:drop-shadow-[0_0_14px_rgba(232,192,106,0.5)]"
            />
            <div className="relative z-10 flex items-center gap-1.5 text-deadlock-muted text-xs px-2.5">
              <BarChart2 className="w-4 h-4 text-deadlock-accent shrink-0" />
              <span className="truncate">Winrate: <strong className={`font-mono font-bold text-sm ${winRate >= 50 ? 'text-deadlock-win' : 'text-deadlock-loss'}`}>{winRate}%</strong></span>
            </div>
          </div>
        </div>

        {/* Tab Navigation Controls */}
        <div className="flex bg-deadlock-dark/80 p-1 rounded-lg border border-deadlock-border/80 steam-card">
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-bold transition-all ${
              activeTab === 'history'
                ? 'bg-deadlock-accent text-black shadow-md'
                : 'text-deadlock-muted hover:text-deadlock-steam hover:bg-deadlock-card/40'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>History</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-bold transition-all ${
              activeTab === 'analytics'
                ? 'bg-deadlock-accent text-black shadow-md'
                : 'text-deadlock-muted hover:text-deadlock-steam hover:bg-deadlock-card/40'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span>Analytics</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('assistant')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-bold transition-all ${
              activeTab === 'assistant'
                ? 'bg-linear-to-b from-[#8b5da8] via-deadlock-arcane to-[#45285c] text-white border border-[#b388eb] shadow-md shadow-purple-900/50'
                : 'text-deadlock-muted hover:text-deadlock-steam hover:bg-deadlock-card/40'
            }`}
          >
            <Brain className="w-3.5 h-3.5" />
            <span>Draft Assistant</span>
          </button>
        </div>

        {/* Live Player Status & Steam Profile Sync */}
        <div className="flex items-center gap-2.5 pl-2 border-l border-deadlock-border/60">
          <PlayerStateBadge
            state={gameContext.state}
            stateLabel={gameContext.stateLabel}
            playerName={gameContext.playerName}
            heroName={gameContext.myHeroName}
            heroId={gameContext.myHeroId}
            mapName={gameContext.mapName}
          />

          {profile ? (
            <ProfileDropdownMenu
              profile={profile}
              isSyncing={isSyncing}
              cooldownRemaining={cooldownRemaining}
              onSync={onSync}
              onExport={onExport}
              onTriggerImportFile={onTriggerImportFile}
              onDisconnect={onDisconnect}
            />
          ) : (
            <button
              type="button"
              onClick={() => setProfileModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-deadlock-dark/80 border border-deadlock-accent/50 hover:border-deadlock-accent text-xs font-bold text-deadlock-accent hover:text-deadlock-steam transition-all shadow-sm steam-card"
            >
              <User className="w-3.5 h-3.5" />
              <span>Connect Profile</span>
            </button>
          )}
        </div>
      </div>
      </div>

      {/* Heavy Steampunk Steam Pipe along bottom edge of header */}
      <div className="absolute -bottom-1.5 left-0 right-0 pointer-events-none z-30">
        <img src={artDecoDivider} alt="" aria-hidden="true" className="w-full h-3 object-cover opacity-70" />
      </div>
    </header>
  );
};
