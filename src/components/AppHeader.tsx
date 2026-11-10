import React from 'react';
import { History, BarChart2, Brain, Gauge } from 'lucide-react';
import { ConnectedProfile } from '../types/match';
import { PlayerStateBadge } from './PlayerStateBadge';
import { ProfileDropdownMenu } from './profile/ProfileDropdownMenu';
import { ParsedGameContext } from '../services/logs/logWatcher';
import { useUIStore, AppTab } from '../stores/useUIStore';
import { useMatchStore, selectTotalMatches, selectWinRate } from '../stores/useMatchStore';
import steamLogo from '../assets/steam-logo.svg';
import artDecoDivider from '../assets/art-deco/divider.svg';
import lilHelperLogo from '../assets/lil-helper.png';

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

      <div className="w-full max-w-6xl xl:max-w-7xl 2xl:max-w-[1680px] mx-auto flex items-center justify-between relative min-h-[44px]">
        {/* Brand & Global Quick Stats */}
        <div className="flex items-center gap-3 sm:gap-4 relative z-10">
          <div className="flex items-center gap-2.5">
            <img src={lilHelperLogo} alt="Lil Helper" className="w-8 h-8 shrink-0 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] object-contain" />
            <div className="flex flex-col">
              <span className="font-bold text-sm tracking-wide text-deadlock-steam leading-none">Lil Helper</span>
              <span className="text-[10px] text-deadlock-muted tracking-wider font-mono">DEADLOCK COMPANION</span>
            </div>
          </div>

          {/* Quick Stats Pill (Base format) */}
          <div className="flex items-center bg-deadlock-dark/80 p-0.5 rounded-lg border border-deadlock-border/80 steam-card text-xs">
            {/* Account Matches */}
            <div
              className="group relative flex items-center gap-1.5 px-2.5 py-1 rounded-md text-deadlock-muted hover:text-deadlock-steam hover:bg-deadlock-card/50 transition-all cursor-default"
              title="account matches"
            >
              <Gauge className="w-3.5 h-3.5 text-deadlock-accent shrink-0 group-hover:scale-110 transition-transform" />
              <strong className="text-deadlock-steam font-mono font-bold text-xs">{totalMatches}</strong>
              <span className="pointer-events-none absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-deadlock-dark/95 px-2 py-0.5 text-[10px] font-medium text-deadlock-steam border border-deadlock-brass/40 shadow-lg opacity-0 transition-opacity duration-150 group-hover:opacity-100 z-50">
                account matches
              </span>
            </div>

            <span className="w-px h-3.5 bg-deadlock-border/60 mx-0.5" />

            {/* Account Winrate */}
            <div
              className="group relative flex items-center gap-1.5 px-2.5 py-1 rounded-md text-deadlock-muted hover:text-deadlock-steam hover:bg-deadlock-card/50 transition-all cursor-default"
              title="account winrate"
            >
              <BarChart2 className="w-3.5 h-3.5 text-deadlock-accent shrink-0 group-hover:scale-110 transition-transform" />
              <strong className={`font-mono font-bold text-xs ${winRate >= 50 ? 'text-deadlock-win' : 'text-deadlock-loss'}`}>{winRate}%</strong>
              <span className="pointer-events-none absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-deadlock-dark/95 px-2 py-0.5 text-[10px] font-medium text-deadlock-steam border border-deadlock-brass/40 shadow-lg opacity-0 transition-opacity duration-150 group-hover:opacity-100 z-50">
                account winrate
              </span>
            </div>
          </div>
        </div>

        {/* Section Navigation Controls — Centered */}
        <nav aria-label="Sections principales" className="md:absolute md:left-1/2 md:-translate-x-1/2 flex items-center z-20">
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
        </nav>

        {/* Live Player Status & Steam Profile Sync */}
        <div className="flex items-center gap-2 pl-2 relative z-30">
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
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-deadlock-dark/80 border border-deadlock-accent/50 hover:border-deadlock-accent text-xs font-bold text-gray-200 hover:text-white transition-all shadow-sm steam-card cursor-pointer"
            >
              <img src={steamLogo} alt="Steam" className="w-4 h-4 shrink-0 drop-shadow" />
              <span>connect ?</span>
            </button>
          )}
        </div>
      </div>

      {/* Heavy Steampunk Steam Pipe along bottom edge of header */}
      <div className="absolute -bottom-1.5 left-0 right-0 pointer-events-none z-10">
        <img src={artDecoDivider} alt="" aria-hidden="true" className="w-full h-3 object-cover opacity-70" />
      </div>
    </header>
  );
};
