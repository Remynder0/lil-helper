import React, { useState, useEffect } from 'react';
import { History, BarChart2, Brain, Gauge, Cloud, Loader2 } from 'lucide-react';
import { ConnectedProfile } from '../types/match';
import { PlayerStateBadge } from './PlayerStateBadge';
import { ProfileDropdownMenu } from './ProfileDropdownMenu';
import { ParsedGameContext } from '../services/logWatcher';
import { useUIStore, AppTab } from '../stores/useUIStore';
import { useMatchStore, selectTotalMatches, selectWinRate } from '../stores/useMatchStore';
import { subscribeToCloudSync, getCloudSyncState, CloudSyncState } from '../services/cloudSync';
import { syncMatchesWithCloud } from '../services/storage';
import { useToast } from './Toast';
import steamLogo from '../assets/steam-logo.svg';
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
  const toast = useToast();

  const totalMatches = useMatchStore(selectTotalMatches);
  const winRate = useMatchStore(selectWinRate);

  const [cloudState, setCloudState] = useState<CloudSyncState>(getCloudSyncState());
  const [isManualCloudSyncing, setIsManualCloudSyncing] = useState(false);

  useEffect(() => {
    const unsub = subscribeToCloudSync((state) => {
      setCloudState(state);
    });
    return () => unsub();
  }, []);

  const handleCloudSync = async () => {
    const targetAccountId = profile?.accountId ?? useMatchStore.getState().currentAccountId;
    if (!targetAccountId) {
      setProfileModalOpen(true);
      return;
    }
    if (isManualCloudSyncing || cloudState.isSyncing) return;
    setIsManualCloudSyncing(true);
    try {
      const res = await syncMatchesWithCloud(targetAccountId, profile);
      if (res.success) {
        toast.success(res.message);
        await useMatchStore.getState().loadMatches(targetAccountId);
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Cloud Sync failed');
    } finally {
      setIsManualCloudSyncing(false);
    }
  };

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
          {/* Art Deco Cartouche Stats: Matches & Winrate */}
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
          <div className="flex items-center gap-2 pl-2 border-l border-deadlock-border/60">
            <PlayerStateBadge
              state={gameContext.state}
              stateLabel={gameContext.stateLabel}
              playerName={gameContext.playerName}
              heroName={gameContext.myHeroName}
              heroId={gameContext.myHeroId}
              mapName={gameContext.mapName}
            />

            {/* Supabase Cloud Sync Status Pill */}
            <button
              type="button"
              onClick={handleCloudSync}
              title={
                cloudState.isConfigured
                  ? `Supabase Cloud Sync active. Last sync: ${cloudState.lastSyncedAt ? new Date(cloudState.lastSyncedAt).toLocaleTimeString() : 'Never'}. Click to sync now.`
                  : 'Supabase Cloud is offline or unconfigured. Matches are stored locally.'
              }
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                cloudState.isSyncing || isManualCloudSyncing
                  ? 'bg-deadlock-accent/20 text-deadlock-accent border-deadlock-accent/50'
                  : cloudState.isConfigured
                  ? 'bg-deadlock-dark/80 text-[#3ecf8e] border-[#3ecf8e]/35 hover:border-[#3ecf8e] shadow-sm'
                  : 'bg-deadlock-dark/60 text-deadlock-muted border-deadlock-border/40 hover:border-gray-600'
              }`}
            >
              {cloudState.isSyncing || isManualCloudSyncing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-deadlock-accent" />
              ) : (
                <Cloud className={`w-3.5 h-3.5 ${cloudState.isConfigured ? 'text-[#3ecf8e]' : 'text-deadlock-muted'}`} />
              )}
              <span className="hidden xl:inline text-[11px]">
                {cloudState.isSyncing || isManualCloudSyncing
                  ? 'Syncing...'
                  : cloudState.isConfigured
                  ? 'Cloud Synced'
                  : 'Cloud Offline'}
              </span>
            </button>

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
      </div>

      {/* Heavy Steampunk Steam Pipe along bottom edge of header */}
      <div className="absolute -bottom-1.5 left-0 right-0 pointer-events-none z-30">
        <img src={artDecoDivider} alt="" aria-hidden="true" className="w-full h-3 object-cover opacity-70" />
      </div>
    </header>
  );
};
