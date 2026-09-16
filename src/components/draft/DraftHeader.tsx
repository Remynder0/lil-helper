import React from 'react';
import { Side, LaneColor, LANE_LABELS, SIDE_LABELS } from '../../types/match';
import { HeroAvatar } from '../HeroAvatar';
import {
  RotateCcw,
  Ban,
  Crown,
  Gamepad2,
  Loader2,
  CheckCircle2,
  Terminal,
  Sparkles,
} from 'lucide-react';
import { OccultEyeButton } from './OccultEyeButton';
import { ParsedGameContext } from '../../services/logWatcher';
import { ActiveSlot } from './types';

interface DraftHeaderProps {
  side: Side;
  onSideChange: (side: Side) => void;
  bannedHeroIds: (number | null)[];
  onSelectBanSlot: (index: number) => void;
  onRemoveBan: (index: number) => void;
  activeSlot: ActiveSlot | null;
  isScanningScreen: boolean;
  onScanScreen: () => void;
  hasLastScanResult: boolean;
  onOpenOcrInspector: () => void;
  onReset: () => void;
  scanStatusMessage: string | null;
  gameContext?: ParsedGameContext;
  assignedLane: LaneColor;
  onSetAssignedLane: (lane: LaneColor) => void;
}

export const DraftHeader: React.FC<DraftHeaderProps> = ({
  side,
  onSideChange,
  bannedHeroIds,
  onSelectBanSlot,
  onRemoveBan,
  activeSlot,
  isScanningScreen,
  onScanScreen,
  hasLastScanResult,
  onOpenOcrInspector,
  onReset,
  scanStatusMessage,
  gameContext,
  assignedLane,
  onSetAssignedLane,
}) => {
  return (
    <>
      {/* 1. TOP SETUP HEADER: SIDES + BANS + RESET */}
      <div className="bg-gradient-to-b from-[#181124]/95 via-[#120d1c]/95 to-[#160e22]/95 steam-panel steam-card border border-deadlock-arcane/45 shadow-[0_0_25px_rgba(107,76,138,0.16)] rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        {/* Left: Title & Patron Side Selection */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div>
            <h2 className="text-base font-bold text-gray-100 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-deadlock-arcane" />
              <span>Deadlock Draft & Pre-Match Assistant</span>
            </h2>
            <p className="text-xs text-purple-300/70">
              Live optimal actions: Hero switch & Lane swap advice (with Plan B fallback)
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-[#1a1226]/80 p-1 rounded-lg border border-deadlock-arcane/35">
            <button
              type="button"
              onClick={() => onSideChange('hidden_king')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                side === 'hidden_king'
                  ? 'bg-deadlock-hidden-king/25 border border-deadlock-hidden-king text-yellow-300 shadow-sm'
                  : 'text-deadlock-muted hover:text-deadlock-steam'
              }`}
            >
              <Crown className="w-3.5 h-3.5 text-deadlock-hidden-king" />
              <span>{SIDE_LABELS.hidden_king}</span>
            </button>
            <button
              type="button"
              onClick={() => onSideChange('archmother')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                side === 'archmother'
                  ? 'bg-deadlock-archmother/25 border border-deadlock-archmother text-amber-300 shadow-sm'
                  : 'text-deadlock-muted hover:text-deadlock-steam'
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
                    onClick={() => onSelectBanSlot(banIdx)}
                    className={`cursor-pointer p-1 rounded-lg border transition-all ${
                      isActive
                        ? 'border-red-500 bg-red-950/40 ring-1 ring-red-500'
                        : 'border-deadlock-border/80 bg-deadlock-card hover:border-gray-500'
                    }`}
                  >
                    <HeroAvatar
                      heroId={banHeroId}
                      size="xs"
                      onRemove={banHeroId ? () => onRemoveBan(banIdx) : undefined}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <OccultEyeButton
            isScanning={isScanningScreen}
            onClick={onScanScreen}
          />

          {hasLastScanResult && (
            <button
              type="button"
              onClick={onOpenOcrInspector}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-500/40 bg-blue-950/40 hover:bg-blue-900/60 text-xs font-bold text-blue-300 transition-all shadow-sm cursor-pointer"
              title="Inspect raw captured image, detected words and OCR diagnostic log"
            >
              <Terminal className="w-3.5 h-3.5 text-blue-400" />
              <span>OCR Log</span>
            </button>
          )}

          <button
            type="button"
            onClick={onReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-deadlock-border bg-deadlock-card hover:bg-deadlock-border text-xs font-semibold text-deadlock-muted hover:text-deadlock-steam transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Screen OCR Status Alert */}
      {scanStatusMessage && (
        <div className="bg-purple-950/40 border border-purple-500/50 text-purple-200 px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-md animate-fade-in">
          {isScanningScreen ? (
            <Loader2 className="w-4 h-4 animate-spin text-purple-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0" />
          )}
          <span className="font-medium">{scanStatusMessage}</span>
        </div>
      )}

      {/* Live Game Sync Callout Banner */}
      {gameContext && (gameContext.state === 'in_game' || gameContext.myHeroId || gameContext.detectedHeroIds.length > 0) && (
        <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl p-3.5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shrink-0">
              <Gamepad2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-deadlock-steam uppercase tracking-wider">
                  Live Game Sync
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                  {gameContext.stateLabel}
                </span>
                {gameContext.mapName && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/40 text-deadlock-muted border border-deadlock-border">
                    {gameContext.mapName}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-300 mt-0.5">
                {gameContext.playerName ? `${gameContext.playerName} • ` : ''}
                {gameContext.myHeroName ? `Playing ${gameContext.myHeroName}` : 'Connected to Deadlock'}
              </p>
            </div>
          </div>

          {/* Quick Lane Selector */}
          <div className="flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-deadlock-border/80">
            <span className="text-[10px] font-bold text-gray-400 px-1 uppercase tracking-wider">
              Lane:
            </span>
            {(['yellow', 'blue', 'green'] as const).map((l) => {
              const isSelected = assignedLane === l;
              const colorDot = l === 'yellow' ? 'bg-yellow-400' : l === 'blue' ? 'bg-blue-400' : 'bg-emerald-400';
              return (
                <button
                  key={l}
                  type="button"
                  onClick={() => onSetAssignedLane(l)}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold capitalize transition-all ${
                    isSelected
                      ? 'bg-deadlock-accent text-black shadow-sm'
                      : 'text-deadlock-muted hover:text-deadlock-steam hover:bg-white/5'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${colorDot}`} />
                  <span>{LANE_LABELS[l]}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
};
