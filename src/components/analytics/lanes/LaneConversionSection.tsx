import React from 'react';
import { TrendingUp, Flame, ShieldAlert } from 'lucide-react';
import { LaneAnalyticsSummary } from '../../../services/analytics';

export interface LaneConversionSectionProps {
  outcomes: LaneAnalyticsSummary['outcomes'];
}

export const LaneConversionSection: React.FC<LaneConversionSectionProps> = ({ outcomes }) => {
  return (
    <div className="steam-glass steam-panel rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-deadlock-win" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-deadlock-steam">
            Lane Outcome Conversion to Match Victory
          </h3>
        </div>
        <span className="text-[11px] text-deadlock-muted">
          Correlation between laning phase result and final match victory
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Lane Won -> Snowball */}
        <div className="bg-deadlock-card/80 border border-deadlock-win/40 rounded-xl p-4 flex flex-col gap-2 relative overflow-hidden">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-deadlock-win flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5" />
              When Lane is Won
            </span>
            <span className="text-deadlock-muted font-mono">{outcomes.won.matches} times</span>
          </div>

          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-deadlock-win font-mono">
              {outcomes.won.matches > 0 ? `${outcomes.won.conversionWinRate}%` : 'N/A'}
            </span>
            <span className="text-xs text-deadlock-muted font-mono">
              {outcomes.won.gameWins}W - {outcomes.won.gameLosses}L
            </span>
          </div>
        </div>

        {/* Lane Even -> Neutral */}
        <div className="bg-deadlock-card/80 border border-amber-500/30 rounded-xl p-4 flex flex-col gap-2 relative overflow-hidden">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-yellow-300">When Lane is Even</span>
            <span className="text-deadlock-muted font-mono">{outcomes.even.matches} times</span>
          </div>

          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-yellow-300 font-mono">
              {outcomes.even.matches > 0 ? `${outcomes.even.conversionWinRate}%` : 'N/A'}
            </span>
            <span className="text-xs text-deadlock-muted font-mono">
              {outcomes.even.gameWins}W - {outcomes.even.gameLosses}L
            </span>
          </div>
        </div>

        {/* Lane Lost -> Comeback */}
        <div className="bg-deadlock-card/80 border border-deadlock-loss/40 rounded-xl p-4 flex flex-col gap-2 relative overflow-hidden">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-deadlock-loss flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5" />
              When Lane is Lost
            </span>
            <span className="text-deadlock-muted font-mono">{outcomes.lost.matches} times</span>
          </div>

          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-deadlock-loss font-mono">
              {outcomes.lost.matches > 0 ? `${outcomes.lost.conversionWinRate}%` : 'N/A'}
            </span>
            <span className="text-xs text-deadlock-muted font-mono">
              {outcomes.lost.gameWins}W - {outcomes.lost.gameLosses}L
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
