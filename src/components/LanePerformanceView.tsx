import React, { useState } from 'react';
import { Match } from '../types/match';
import { HeroAvatar } from './HeroAvatar';
import {
  calculateLaneAnalytics,
  LaneAnalyticsSummary,
} from '../services/analytics';
import { getHeroById } from '../data/heroes';
import {
  Compass,
  Swords,
  Filter,
  TrendingUp,
} from 'lucide-react';

interface LanePerformanceViewProps {
  matches: Match[];
}

export const LanePerformanceView: React.FC<LanePerformanceViewProps> = ({ matches }) => {
  const [selectedPlayerHeroId, setSelectedPlayerHeroId] = useState<number | null>(null);

  // Distinct heroes piloted by player
  const playedHeroIds = Array.from(new Set(matches.map((m) => m.myHeroId)));
  const playedHeroes = playedHeroIds
    .map((id) => getHeroById(id))
    .filter((h): h is NonNullable<typeof h> => h !== undefined);

  const laneStats: LaneAnalyticsSummary = calculateLaneAnalytics(matches, selectedPlayerHeroId);

  const selectedHeroObj = selectedPlayerHeroId ? getHeroById(selectedPlayerHeroId) : null;

  if (laneStats.totalLaneTrackedMatches === 0) {
    return (
      <div className="bg-deadlock-panel border border-deadlock-border rounded-xl p-12 text-center flex flex-col items-center justify-center gap-3">
        <Compass className="w-12 h-12 text-deadlock-muted opacity-40" />
        <h2 className="text-lg font-bold text-gray-200">No lane data tracked yet</h2>
        <p className="text-sm text-deadlock-muted max-w-md">
          When recording or editing matches in the <strong>Log Match</strong> / <strong>History</strong> tabs, fill in the <strong>Lane Assignment</strong> section (Yellow, Blue, or Green lane) to unlock lane statistics and opponent tracking!
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* FILTER HEADER: Choose "All My Heroes" or a specific hero piloted */}
      <div className="bg-deadlock-panel border border-deadlock-border/80 rounded-xl p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-deadlock-accent" />
            <span className="text-xs font-bold uppercase tracking-wider text-gray-200">
              Filter Lane Stats by Your Hero:
            </span>
          </div>
          <span className="text-xs text-deadlock-muted">
            {selectedHeroObj
              ? `Showing lane performance specifically when you play ${selectedHeroObj.name}`
              : `Showing lane performance across all heroes (${laneStats.totalLaneTrackedMatches} matches with lane data)`}
          </span>
        </div>

        {/* Hero Selector Buttons */}
        <div className="flex items-center gap-2 flex-wrap pt-1">
          <button
            type="button"
            onClick={() => setSelectedPlayerHeroId(null)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              selectedPlayerHeroId === null
                ? 'bg-deadlock-accent/20 border-deadlock-accent text-white shadow-sm'
                : 'bg-deadlock-dark border-deadlock-border text-deadlock-muted hover:text-white hover:border-white/30'
            }`}
          >
            All Heroes
          </button>

          {playedHeroes.map((hero) => {
            const isSelected = selectedPlayerHeroId === hero.id;
            const heroMatchCount = matches.filter((m) => m.myHeroId === hero.id && m.lane).length;
            if (heroMatchCount === 0) return null; // only show heroes that have lane data
            return (
              <button
                key={hero.id}
                type="button"
                onClick={() => setSelectedPlayerHeroId(hero.id)}
                className={`flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs border transition-all ${
                  isSelected
                    ? 'bg-deadlock-border border-white text-white shadow-md ring-1 ring-white/40'
                    : 'bg-deadlock-dark border-deadlock-border text-deadlock-muted hover:text-white hover:border-white/30'
                }`}
              >
                <HeroAvatar heroId={hero.id} size="xs" />
                <span className="font-medium">{hero.name}</span>
                <span className="text-[10px] opacity-70 font-mono">({heroMatchCount})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* SECTION 1: 3 LANE CARDS (Yellow, Blue, Green) */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300 mb-3 flex items-center gap-2">
          <Compass className="w-4 h-4 text-deadlock-accent" />
          <span>Performance Across the 3 Lanes</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Yellow Lane */}
          {(() => {
            const stat = laneStats.lanes.yellow;
            return (
              <div className="bg-deadlock-panel border border-yellow-500/40 rounded-xl p-4 flex flex-col gap-3 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-500/5 rounded-full blur-xl pointer-events-none" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-yellow-400 shadow-sm shadow-yellow-400" />
                    <span className="font-bold text-sm text-yellow-300">Yellow Lane</span>
                  </div>
                  <span className="text-xs text-deadlock-muted font-mono">{stat.matches} games</span>
                </div>

                <div className="flex items-baseline justify-between mt-1">
                  <div>
                    <div className="text-3xl font-black text-white font-mono">
                      {stat.wins + stat.losses > 0 ? `${stat.winRate}%` : 'N/A'}
                    </div>
                    <div className="text-[11px] text-deadlock-muted mt-0.5">
                      Match: {stat.wins}W - {stat.losses}L
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs font-bold text-gray-200">
                      Lane: <span className="text-deadlock-win">{stat.laneWins}W</span> - <span className="text-deadlock-loss">{stat.laneLosses}L</span>
                    </div>
                    <div className="text-[10px] text-deadlock-muted">
                      {stat.laneEvens} even
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Blue Lane */}
          {(() => {
            const stat = laneStats.lanes.blue;
            return (
              <div className="bg-deadlock-panel border border-blue-500/40 rounded-xl p-4 flex flex-col gap-3 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-xl pointer-events-none" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-blue-400 shadow-sm shadow-blue-400" />
                    <span className="font-bold text-sm text-blue-300">Blue Lane</span>
                  </div>
                  <span className="text-xs text-deadlock-muted font-mono">{stat.matches} games</span>
                </div>

                <div className="flex items-baseline justify-between mt-1">
                  <div>
                    <div className="text-3xl font-black text-white font-mono">
                      {stat.wins + stat.losses > 0 ? `${stat.winRate}%` : 'N/A'}
                    </div>
                    <div className="text-[11px] text-deadlock-muted mt-0.5">
                      Match: {stat.wins}W - {stat.losses}L
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs font-bold text-gray-200">
                      Lane: <span className="text-deadlock-win">{stat.laneWins}W</span> - <span className="text-deadlock-loss">{stat.laneLosses}L</span>
                    </div>
                    <div className="text-[10px] text-deadlock-muted">
                      {stat.laneEvens} even
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Green Lane */}
          {(() => {
            const stat = laneStats.lanes.green;
            return (
              <div className="bg-deadlock-panel border border-emerald-500/40 rounded-xl p-4 flex flex-col gap-3 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400" />
                    <span className="font-bold text-sm text-emerald-300">Green Lane</span>
                  </div>
                  <span className="text-xs text-deadlock-muted font-mono">{stat.matches} games</span>
                </div>

                <div className="flex items-baseline justify-between mt-1">
                  <div>
                    <div className="text-3xl font-black text-white font-mono">
                      {stat.wins + stat.losses > 0 ? `${stat.winRate}%` : 'N/A'}
                    </div>
                    <div className="text-[11px] text-deadlock-muted mt-0.5">
                      Match: {stat.wins}W - {stat.losses}L
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs font-bold text-gray-200">
                      Lane: <span className="text-deadlock-win">{stat.laneWins}W</span> - <span className="text-deadlock-loss">{stat.laneLosses}L</span>
                    </div>
                    <div className="text-[10px] text-deadlock-muted">
                      {stat.laneEvens} even
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* SECTION 2: LANE RESULT CONVERSION (Win rate when winning vs losing lane) */}
      <div className="bg-deadlock-panel border border-deadlock-border/80 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-deadlock-win" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-200">
            Lane Outcome Conversion to Match Victory
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Lane Won */}
          <div className="bg-deadlock-dark/70 border border-deadlock-win/30 rounded-xl p-3.5 flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-deadlock-win">When Lane is Won</span>
              <span className="text-deadlock-muted font-mono">{laneStats.outcomes.won.matches} times</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-deadlock-win font-mono">
                {laneStats.outcomes.won.matches > 0 ? `${laneStats.outcomes.won.conversionWinRate}%` : 'N/A'}
              </span>
              <span className="text-[11px] text-deadlock-muted">
                {laneStats.outcomes.won.gameWins}W - {laneStats.outcomes.won.gameLosses}L
              </span>
            </div>
          </div>

          {/* Lane Even */}
          <div className="bg-deadlock-dark/70 border border-yellow-500/30 rounded-xl p-3.5 flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-yellow-300">When Lane is Even</span>
              <span className="text-deadlock-muted font-mono">{laneStats.outcomes.even.matches} times</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-yellow-300 font-mono">
                {laneStats.outcomes.even.matches > 0 ? `${laneStats.outcomes.even.conversionWinRate}%` : 'N/A'}
              </span>
              <span className="text-[11px] text-deadlock-muted">
                {laneStats.outcomes.even.gameWins}W - {laneStats.outcomes.even.gameLosses}L
              </span>
            </div>
          </div>

          {/* Lane Lost */}
          <div className="bg-deadlock-dark/70 border border-deadlock-loss/30 rounded-xl p-3.5 flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-deadlock-loss">When Lane is Lost</span>
              <span className="text-deadlock-muted font-mono">{laneStats.outcomes.lost.matches} times</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-deadlock-loss font-mono">
                {laneStats.outcomes.lost.matches > 0 ? `${laneStats.outcomes.lost.conversionWinRate}%` : 'N/A'}
              </span>
              <span className="text-[11px] text-deadlock-muted">
                {laneStats.outcomes.lost.gameWins}W - {laneStats.outcomes.lost.gameLosses}L
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 3: DIRECT LANE OPPONENTS TABLE */}
      {laneStats.opponents.length > 0 && (
        <div className="bg-deadlock-panel border border-deadlock-border/80 rounded-xl overflow-hidden flex flex-col">
          <div className="p-4 border-b border-deadlock-border/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Swords className="w-4 h-4 text-deadlock-hidden-king" />
              <h3 className="text-sm font-bold tracking-wide uppercase text-gray-200">
                Direct Lane Opponents Faced ({laneStats.opponents.length} heroes)
              </h3>
            </div>
            <span className="text-xs text-deadlock-muted">
              Opponents you faced in your lane
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-deadlock-dark/60 text-deadlock-muted border-b border-deadlock-border/60">
                <tr>
                  <th className="py-3 px-4 font-semibold">Opponent Hero</th>
                  <th className="py-3 px-4 font-semibold">Lanes Faced</th>
                  <th className="py-3 px-4 font-semibold">Lane Record</th>
                  <th className="py-3 px-4 font-semibold">Lane Winrate</th>
                  <th className="py-3 px-4 font-semibold text-right">Final Game Winrate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-deadlock-border/40">
                {laneStats.opponents.map((opp) => (
                  <tr key={opp.opponentHeroId} className="hover:bg-deadlock-dark/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <HeroAvatar heroId={opp.opponentHeroId} size="xs" />
                        <span className="font-bold text-gray-200">{opp.opponentHero?.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-gray-300">
                      {opp.lanesFaced}
                    </td>
                    <td className="py-3 px-4 font-mono">
                      <span className="text-deadlock-win font-bold">{opp.laneWins}W</span> - <span className="text-deadlock-loss font-bold">{opp.laneLosses}L</span> ({opp.laneEvens}E)
                    </td>
                    <td className="py-3 px-4 font-mono">
                      {opp.laneWins + opp.laneLosses > 0 ? (
                        <span className={opp.laneWinRate >= 50 ? 'text-deadlock-win font-bold' : 'text-deadlock-loss font-bold'}>
                          {opp.laneWinRate}%
                        </span>
                      ) : (
                        <span className="text-deadlock-muted">Even</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-right">
                      <span className={opp.gameWinRate >= 50 ? 'text-deadlock-win font-bold' : 'text-deadlock-loss font-bold'}>
                        {opp.gameWinRate}% ({opp.gameWins}W-{opp.gameLosses}L)
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
