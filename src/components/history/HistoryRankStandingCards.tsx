import React from 'react';
import { Shield, TrendingUp } from 'lucide-react';
import { PlayerRankStanding } from '../../services/api/deadlockApi';
import occultBadge from '../../assets/occult/badge.svg';

interface HistoryRankStandingCardsProps {
  accountId: number;
  rankStanding: PlayerRankStanding | null;
  isLoadingRank: boolean;
}

export const HistoryRankStandingCards: React.FC<HistoryRankStandingCardsProps> = ({
  accountId,
  rankStanding,
  isLoadingRank,
}) => {
  if (isLoadingRank && !rankStanding) {
    return (
      <div className="steam-glass steam-panel rounded-xl p-5 border border-deadlock-brass/30 animate-pulse flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-xl bg-deadlock-dark/60 border border-deadlock-border/50" />
          <div className="flex flex-col gap-2">
            <div className="w-24 h-3 bg-deadlock-dark/60 rounded" />
            <div className="w-36 h-5 bg-deadlock-dark/60 rounded" />
          </div>
        </div>
        <div className="w-48 h-10 bg-deadlock-dark/60 rounded" />
      </div>
    );
  }

  if (!rankStanding) {
    return null;
  }

  return (
    <div className="steam-glass steam-panel rounded-xl p-4 sm:p-5 border border-deadlock-brass/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.6)]">
      {/* Rotating celestial sigil in corner background */}
      <div className="absolute -right-4 -top-6 pointer-events-none opacity-30">
        <img
          src={occultBadge}
          alt=""
          aria-hidden="true"
          className="w-[180px] h-[180px] animate-[spin_30s_linear_infinite]"
        />
      </div>

      <div className="flex items-center gap-4 relative z-10">
        {/* Rank badge from Deadlock API */}
        <div className="relative shrink-0 flex items-center justify-center">
          <div className="w-16 h-16 sm:w-20 sm:h-20 relative flex items-center justify-center drop-shadow-[0_4px_16px_rgba(230,175,46,0.35)]">
            <img
              src={rankStanding.badgeImageUrl}
              alt={`${rankStanding.tierName} ${rankStanding.subrankRoman}`}
              className="w-full h-full object-contain filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] hover:scale-105 transition-transform duration-200"
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://api.deadlock-api.com/v1/players/${accountId}/rank/image`;
              }}
            />
          </div>
        </div>

        <div className="flex flex-col">
          {rankStanding.calibrationGamesRemaining > 0 && (
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/50 text-amber-300">
                Calibrating ({rankStanding.calibrationGamesRemaining} left)
              </span>
            </div>
          )}
          <h2 className="text-xl sm:text-2xl font-bold text-deadlock-steam tracking-wide drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] flex items-center gap-2">
            <span>{rankStanding.tierName}</span>
            <span className="text-deadlock-accent font-serif tracking-wider">
              {rankStanding.subrankRoman}
            </span>
          </h2>

          {/* Subrank progress bar or Eternus absolute points */}
          {rankStanding.rank === 11 ? (
            <div className="flex flex-col gap-1 mt-1 w-48 sm:w-56">
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-deadlock-muted">Standing</span>
                <span className="text-deadlock-accent font-bold">
                  {(rankStanding.flatProgress ?? rankStanding.progress).toLocaleString()} pts
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-deadlock-dark/80 overflow-hidden border border-deadlock-border/40">
                <div
                  className="h-full bg-gradient-to-r from-deadlock-brass to-deadlock-accent transition-all duration-500 rounded-full"
                  style={{ width: '100%' }}
                />
              </div>
            </div>
          ) : rankStanding.progressMax > 0 ? (
            <div className="flex flex-col gap-1 mt-1 w-48 sm:w-56">
              <div
                className="flex items-center justify-between text-[10px] font-mono"
                title={
                  rankStanding.flatProgress !== undefined
                    ? `${rankStanding.flatProgress.toLocaleString()} ladder points`
                    : undefined
                }
              >
                <span className="text-deadlock-muted">Progress</span>
                <span className="text-deadlock-accent font-bold">
                  {rankStanding.progress.toLocaleString()} /{' '}
                  {rankStanding.progressMax.toLocaleString()} pts
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-deadlock-dark/80 overflow-hidden border border-deadlock-border/40">
                <div
                  className="h-full bg-gradient-to-r from-deadlock-brass to-deadlock-accent transition-all duration-500 rounded-full"
                  style={{
                    width: `${Math.min(100, Math.max(0, (rankStanding.progress / rankStanding.progressMax) * 100))}%`,
                  }}
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Right section: Demotion Protection Shields & Global Server Percentile */}
      <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 relative z-10 w-full md:w-auto justify-start md:justify-end">
        {/* Demotion Protection Shields (hidden above Eternus I) */}
        {!(rankStanding.rank === 11 && rankStanding.subrank > 1) && (
          <div
            className="steam-glass px-3.5 py-2.5 rounded-xl border border-deadlock-brass/30 flex items-center justify-center bg-deadlock-dark/50 shadow-inner"
            title={`${rankStanding.demotionProtectionGames ?? 0} / ${rankStanding.maxDemotionProtectionGames || (rankStanding.subrank <= 2 ? 5 : 2)} Demotion Protection`}
          >
            <div className="flex items-center gap-1.5">
              {Array.from({
                length:
                  rankStanding.maxDemotionProtectionGames ||
                  (rankStanding.subrank <= 2 ? 5 : 2),
              }).map((_, i) => {
                const isFilled = i < (rankStanding.demotionProtectionGames ?? 0);
                return isFilled ? (
                  <Shield
                    key={i}
                    className="w-6 h-6 fill-emerald-400 text-emerald-300 drop-shadow-[0_0_10px_rgba(52,211,153,0.8)] transition-transform hover:scale-110"
                  />
                ) : (
                  <Shield
                    key={i}
                    className="w-6 h-6 text-zinc-500/60 fill-zinc-900/60 stroke-[1.5] transition-transform hover:scale-110"
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Global Server Percentile */}
        <div className="steam-glass px-3.5 py-2 rounded-xl border border-deadlock-brass/30 flex items-center gap-3 bg-deadlock-dark/40 shadow-inner">
          <div className="p-1.5 rounded-lg bg-deadlock-card/80 border border-deadlock-border/60">
            <TrendingUp className="w-4 h-4 text-deadlock-accent" />
          </div>
          <div className="flex flex-col text-left">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase font-bold tracking-wider text-deadlock-muted">
                Percentile
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-deadlock-accent/20 text-deadlock-accent font-mono font-bold">
                {rankStanding.topPercentileFormatted}
              </span>
            </div>
            <span className="text-xs font-semibold text-deadlock-steam">
              {rankStanding.betterThanFormatted}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
