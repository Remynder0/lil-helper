import React from 'react';
import { History, BarChart2, Brain, User, Gauge } from 'lucide-react';
import { ConnectedProfile } from '../types/match';
import { PlayerStateBadge } from './PlayerStateBadge';
import { ProfileDropdownMenu } from './ProfileDropdownMenu';
import { ParsedGameContext } from '../services/logWatcher';
import victorianBadge from '../assets/victorian-metal/badge.svg';
import artDecoDivider from '../assets/art-deco/divider.svg';
import artDecoCartouche from '../assets/art-deco/cartouche.svg';

export type AppTab = 'log_match' | 'history' | 'analytics' | 'assistant' | 'logs';

interface AppHeaderProps {
  totalMatches: number;
  winRate: number;
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  gameContext: ParsedGameContext;
  profile: ConnectedProfile | null;
  isSyncing: boolean;
  cooldownRemaining: number;
  onSync: () => void;
  onOpenAddMatch: () => void;
  onOpenImportById: () => void;
  onOpenDebugConsole: () => void;
  onSwitchProfile: () => void;
  onExport: () => void;
  onTriggerImportFile: () => void;
  onDisconnect: () => void;
  onOpenConnectModal: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  totalMatches,
  winRate,
  activeTab,
  onTabChange,
  gameContext,
  profile,
  isSyncing,
  cooldownRemaining,
  onSync,
  onOpenAddMatch,
  onOpenImportById,
  onOpenDebugConsole,
  onSwitchProfile,
  onExport,
  onTriggerImportFile,
  onDisconnect,
  onOpenConnectModal,
}) => {
  return (
    <header className="border-b-2 border-deadlock-brass/40 bg-deadlock-panel/80 backdrop-blur-lg px-6 py-3.5 flex items-center justify-between fixed top-0 left-0 right-0 w-full z-40 shadow-[0_4px_20px_rgba(0,0,0,0.7)]">
      {/* Decorative background brass conduit line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-deadlock-accent/60 to-transparent" />

      {/* Brand & Steampunk Apparatus Emblem */}
      <div className="flex items-center gap-3 relative z-10">
        <div className="flex items-center gap-2"> 
          {/* Prominent mechanical turning gears */}
          <img src={victorianBadge} alt="" aria-hidden="true" className="w-8 h-8 shrink-0 animate-[spin_12s_linear_infinite] drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]" />
        </div>

      </div>

      {/* Global Quick Stats & Navigation */}
      <div className="flex items-center gap-4 text-xs relative z-10">
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
              <span>Winrate:</span>
              <strong
                className={`font-mono font-bold px-1.5 py-0.5 rounded text-xs ${
                  winRate >= 50
                    ? 'bg-deadlock-win/20 text-deadlock-win border border-deadlock-win/40 shadow-[0_0_8px_rgba(95,143,122,0.3)]'
                    : totalMatches > 0
                    ? 'bg-deadlock-loss/20 text-deadlock-loss border border-deadlock-loss/40 shadow-[0_0_8px_rgba(169,68,66,0.3)]'
                    : 'text-deadlock-steam'
                }`}
              >
                {totalMatches > 0 ? `${winRate}%` : 'N/A'}
              </strong>
            </div>
          </div>
        </div>

        {/* Tactile Navigation Tabs */}
        <div className="flex items-center bg-deadlock-dark/90 p-1 rounded-lg border border-deadlock-brass/40 shadow-inner">
          <button
            type="button"
            onClick={() => onTabChange('history')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-bold text-xs transition-all ${
              activeTab === 'history'
                ? 'btn-steampunk-primary text-black shadow-md'
                : 'text-deadlock-muted hover:text-deadlock-steam hover:bg-deadlock-card/40'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>History ({totalMatches})</span>
          </button>
          <button
            type="button"
            onClick={() => onTabChange('analytics')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-bold text-xs transition-all ${
              activeTab === 'analytics'
                ? 'btn-steampunk-primary text-black shadow-md'
                : 'text-deadlock-muted hover:text-deadlock-steam hover:bg-deadlock-card/40'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span>Analytics</span>
          </button>
          <button
            type="button"
            onClick={() => onTabChange('assistant')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-bold text-xs transition-all ${
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
              onOpenAddMatch={onOpenAddMatch}
              onOpenImportById={onOpenImportById}
              onOpenDebugConsole={onOpenDebugConsole}
              onSwitchProfile={onSwitchProfile}
              onExport={onExport}
              onTriggerImportFile={onTriggerImportFile}
              onDisconnect={onDisconnect}
            />
          ) : (
            <button
              type="button"
              onClick={onOpenConnectModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-deadlock-dark/80 border border-deadlock-accent/50 hover:border-deadlock-accent text-xs font-bold text-deadlock-accent hover:text-deadlock-steam transition-all shadow-sm steam-card"
            >
              <User className="w-3.5 h-3.5" />
              <span>Connect Profile</span>
            </button>
          )}
        </div>
      </div>

      {/* Heavy Steampunk Steam Pipe along bottom edge of header */}
      <div className="absolute -bottom-1.5 left-0 right-0 pointer-events-none z-30">
        <img src={artDecoDivider} alt="" aria-hidden="true" className="w-full h-3 object-cover opacity-70" />
      </div>
    </header>
  );
};
