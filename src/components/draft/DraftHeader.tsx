import React from 'react';
import { Side, SIDE_LABELS } from '../../types/match';
import { HeroAvatar } from '../HeroAvatar';
import {
  RotateCcw,
  Ban,
  Crown,
  Loader2,
  CheckCircle2,
  Terminal,
  Sparkles,
  Eye,
  Pencil,
} from 'lucide-react';
import { OccultEyeButton } from './OccultEyeButton';
import { ActiveSlot } from './types';
import { BanHeroPopover } from './BanHeroPopover';

interface DraftHeaderProps {
  side: Side;
  onSideChange: (side: Side) => void;
  bannedHeroIds: (number | null)[];
  onSelectBanSlot: (index: number) => void;
  onRemoveBan: (index: number) => void;
  onSelectHeroForBan?: (heroId: number) => void;
  disabledHeroIds?: number[];
  onCloseBanPopover?: () => void;
  activeSlot: ActiveSlot | null;
  isScanningScreen: boolean;
  onScanScreen: () => void;
  hasLastScanResult: boolean;
  onOpenOcrInspector: () => void;
  onReset: () => void;
  scanStatusMessage: string | null;
  isManualMode: boolean;
  onToggleManualMode: () => void;
}

export const DraftHeader: React.FC<DraftHeaderProps> = ({
  side,
  onSideChange,
  bannedHeroIds,
  onSelectBanSlot,
  onRemoveBan,
  onSelectHeroForBan,
  disabledHeroIds = [],
  onCloseBanPopover,
  activeSlot,
  isScanningScreen,
  onScanScreen,
  hasLastScanResult,
  onOpenOcrInspector,
  onReset,
  scanStatusMessage,
  isManualMode,
  onToggleManualMode,
}) => {
  return (
    <>
      {/* 1. TOP SETUP HEADER: MODE SWITCH + SIDES + BANS + RESET */}
      <div className="occult-panel arcane-glow rounded-xl p-4 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 relative z-40">
        {/* Left: Title & Mode Toggle & Patron Side */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 md:gap-4 flex-wrap">
          <div>
            <h2 className="text-base font-bold text-gray-100 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-deadlock-arcane" />
              <span>Deadlock Draft & Pre-Match Assistant</span>
            </h2>
            <p className="text-xs text-purple-300/70">
              {isManualMode
                ? 'Manual Draft Mode: Freely build teams & test lane synergies'
                : 'Auto Mode (OCR & Live Sync): Automatic analysis of detected match'}
            </p>
          </div>

          {/* Mode Switcher: Auto (OCR) vs Manual */}
          <div className="flex items-center bg-[#130d1e] p-1 rounded-lg border border-deadlock-arcane/40 shadow-inner">
            <button
              type="button"
              onClick={() => isManualMode && onToggleManualMode()}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                !isManualMode
                  ? 'bg-deadlock-arcane/30 border border-deadlock-arcane text-purple-100 shadow-[0_0_12px_rgba(154,106,191,0.35)]'
                  : 'text-purple-300/60 hover:text-purple-200 border border-transparent'
              }`}
              title="Automatic mode based on OCR screen capture and game logs"
            >
              <Eye className="w-3.5 h-3.5 text-deadlock-arcane" />
              <span>Auto (OCR)</span>
            </button>
            <button
              type="button"
              onClick={() => !isManualMode && onToggleManualMode()}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                isManualMode
                  ? 'bg-deadlock-accent/25 border border-deadlock-accent text-yellow-300 shadow-[0_0_12px_rgba(234,179,8,0.3)]'
                  : 'text-purple-300/60 hover:text-purple-200 border border-transparent'
              }`}
              title="Manual sandbox mode to design and test custom drafts"
            >
              <Pencil className="w-3.5 h-3.5 text-deadlock-accent" />
              <span>Manual Mode</span>
            </button>
          </div>

          {/* Side Indicator / Selector */}
          {isManualMode ? (
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
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1a1226]/80 border border-deadlock-arcane/30 text-xs">
              <Crown
                className={`w-3.5 h-3.5 ${
                  side === 'hidden_king' ? 'text-deadlock-hidden-king' : 'text-deadlock-archmother'
                }`}
              />
              <span className="text-gray-400 font-medium">Patron:</span>
              <span className={`font-bold ${side === 'hidden_king' ? 'text-yellow-300' : 'text-amber-300'}`}>
                {SIDE_LABELS[side]}
              </span>
            </div>
          )}
        </div>

        {/* Right: Bans (3) in both modes + OCR buttons + Reset */}
        <div className="flex items-center gap-3 md:gap-4 flex-wrap">
          <div className="relative flex items-center gap-2 z-50">
            <span className="text-xs font-bold uppercase tracking-wider text-red-400 flex items-center gap-1">
              <Ban className="w-3.5 h-3.5" /> Bans (3):
            </span>
            <div className="flex items-center gap-1.5">
              {[0, 1, 2].map((banIdx) => {
                const banHeroId = bannedHeroIds[banIdx];
                const isActive = activeSlot?.type === 'ban' && activeSlot.index === banIdx;
                return (
                  <div
                    key={banIdx}
                    onClick={() => onSelectBanSlot(banIdx)}
                    className={`cursor-pointer p-1 rounded-lg border transition-all ${
                      isActive
                        ? 'border-red-500 bg-red-950/40 ring-1 ring-red-500 shadow-[0_0_12px_rgba(239,68,68,0.4)]'
                        : 'border-deadlock-arcane/40 bg-[#1a1226]/80 hover:border-purple-400'
                    }`}
                    title={banHeroId ? `Ban #${banIdx + 1}` : `Click to ban hero #${banIdx + 1}`}
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

            {/* In OCR mode: popover bubble directly under the ban slots to avoid scrolling down */}
            {!isManualMode && activeSlot?.type === 'ban' && onSelectHeroForBan && (
              <BanHeroPopover
                activeBanIndex={activeSlot.index}
                bannedHeroIds={bannedHeroIds}
                disabledHeroIds={disabledHeroIds}
                onSelectHero={onSelectHeroForBan}
                onClose={onCloseBanPopover || (() => onSelectBanSlot(activeSlot.index))}
              />
            )}
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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-deadlock-arcane/40 bg-[#1a1226]/80 hover:bg-[#231834] text-xs font-semibold text-purple-200 hover:text-white transition-all shadow-sm"
          >
            <RotateCcw className="w-3.5 h-3.5 text-deadlock-arcane" />
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
    </>
  );
};
