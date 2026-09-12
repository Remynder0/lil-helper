import React from 'react';
import { History, BarChart2, Brain, User } from 'lucide-react';
import { ConnectedProfile } from '../types/match';
import { PlayerStateBadge } from './PlayerStateBadge';
import { ProfileDropdownMenu } from './ProfileDropdownMenu';
import { ParsedGameContext } from '../services/logWatcher';

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
    <header className="border-b border-deadlock-border/80 bg-deadlock-panel/90 backdrop-blur px-6 py-3 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded bg-gradient-to-br from-deadlock-hidden-king to-deadlock-archmother flex items-center justify-center text-black font-extrabold text-sm shadow-md">
          D
        </div>
        <div>
          <h1 className="text-base font-bold tracking-wide">Deadlock Draft & Match Analyzer</h1>
          <p className="text-xs text-deadlock-muted">Ranked Matchup & Synergy Companion</p>
        </div>
      </div>

      {/* Global Quick Stats */}
      <div className="flex items-center gap-4 text-xs">
        <div className="bg-deadlock-dark px-3 py-1.5 rounded-lg border border-deadlock-border flex items-center gap-3">
          <span className="text-deadlock-muted">
            Matches: <strong className="text-white">{totalMatches}</strong>
          </span>
          <span className="h-3 w-px bg-deadlock-border" />
          <span className="text-deadlock-muted">
            Winrate:{' '}
            <strong
              className={winRate >= 50 ? 'text-deadlock-win' : totalMatches > 0 ? 'text-deadlock-loss' : 'text-white'}
            >
              {totalMatches > 0 ? `${winRate}%` : 'N/A'}
            </strong>
          </span>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center bg-deadlock-dark p-1 rounded-lg border border-deadlock-border">
          <button
            type="button"
            onClick={() => onTabChange('history')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium text-xs transition-all ${
              activeTab === 'history'
                ? 'bg-deadlock-border text-white shadow-sm'
                : 'text-deadlock-muted hover:text-white'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>History ({totalMatches})</span>
          </button>
          <button
            type="button"
            onClick={() => onTabChange('analytics')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium text-xs transition-all ${
              activeTab === 'analytics'
                ? 'bg-deadlock-border text-white shadow-sm'
                : 'text-deadlock-muted hover:text-white'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span>Analytics</span>
          </button>
          <button
            type="button"
            onClick={() => onTabChange('assistant')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium text-xs transition-all ${
              activeTab === 'assistant'
                ? 'bg-deadlock-accent text-white shadow-sm'
                : 'text-deadlock-muted hover:text-white'
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-deadlock-dark border border-deadlock-accent/50 hover:border-deadlock-accent text-xs font-bold text-deadlock-accent hover:text-white transition-all shadow-sm"
            >
              <User className="w-3.5 h-3.5" />
              <span>Connect Profile</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
