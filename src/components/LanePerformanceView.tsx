import React, { useState, useMemo } from 'react';
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
  const playedHeroes = useMemo(() => {
    const playedHeroIds = Array.from(new Set(matches.map((m) => m.myHeroId)));
    return playedHeroIds
      .map((id) => getHeroById(id))
      .filter((h): h is NonNullable<typeof h> => h !== undefined);
  }, [matches]);

  const laneStats: LaneAnalyticsSummary = useMemo(
    () => calculateLaneAnalytics(matches, selectedPlayerHeroId),
    [matches, selectedPlayerHeroId]
  );

  const selectedHeroObj = selectedPlayerHeroId ? getHeroById(selectedPlayerHeroId) : null;

  if (laneStats.totalLaneTrackedMatches === 0) {
    return (
      <div className="steam-glass steam-panel rounded-xl p-12 text-center flex flex-col items-center justify-center gap-3">
        <Compass className="w-12 h-12 text-deadlock-muted opacity-40" />
        <h2 className="text-lg font-bold text-deadlock-steam">No lane data tracked yet</h2>
        <p className="text-sm text-deadlock-muted max-w-md">
          When recording or editing matches in the <strong>Log Match</strong> / <strong>History</strong> tabs, fill in the <strong>Lane Assignment</strong> section (Yellow, Blue, or Green lane) to unlock lane statistics and opponent tracking!
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* FILTER HEADER: Choose "All My Heroes" or a specific hero piloted */}
      <div className="steam-glass steam-panel rounded-xl p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-deadlock-accent" />
            <span className="text-xs font-bold uppercase tracking-wider text-deadlock-steam">
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
                ? 'bg-deadlock-accent/20 border-deadlock-accent text-deadlock-steam shadow-sm'
                : 'bg-deadlock-dark border-deadlock-border text-deadlock-muted hover:text-deadlock-steam hover:border-white/30'
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
                    ? 'bg-deadlock-border border-white text-deadlock-steam shadow-md ring-1 ring-white/40'
                    : 'bg-deadlock-dark border-deadlock-border text-deadlock-muted hover:text-deadlock-steam hover:border-white/30'
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

      {/* SECTION 1: 3 LANE CARDS (Yellow, Blue, Green) WITH VERTICAL GAUGES */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-deadlock-steam mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-deadlock-accent" />
            <span>Lane Performance & Outcome Gauges</span>
          </div>
          <span className="text-[11px] text-deadlock-muted font-normal lowercase">
            gauge height scaled by games played ({laneStats.totalLaneTrackedMatches} total games)
          </span>
        </h3>

        {(() => {
          const totalGames = Math.max(laneStats.totalLaneTrackedMatches, 1);

          const lanesConfig = [
            {
              key: 'yellow' as const,
              label: 'Yellow Lane',
              colorClass: 'text-yellow-300',
              borderClass: 'border-yellow-500/40',
              dotClass: 'bg-yellow-400 shadow-yellow-400',
              glowClass: 'bg-yellow-500/5',
              stat: laneStats.lanes.yellow,
            },
            {
              key: 'blue' as const,
              label: 'Blue Lane',
              colorClass: 'text-blue-300',
              borderClass: 'border-blue-500/40',
              dotClass: 'bg-blue-400 shadow-blue-400',
              glowClass: 'bg-blue-500/5',
              stat: laneStats.lanes.blue,
            },
            {
              key: 'green' as const,
              label: 'Green Lane',
              colorClass: 'text-emerald-300',
              borderClass: 'border-emerald-500/40',
              dotClass: 'bg-emerald-400 shadow-emerald-400',
              glowClass: 'bg-emerald-500/5',
              stat: laneStats.lanes.green,
            },
          ];

          return (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              {lanesConfig.map(({ key, label, colorClass, borderClass, dotClass, glowClass, stat }) => {
                const totalOutcomes = stat.laneWins + stat.laneEvens + stat.laneLosses;

                // Scale gauge height relative to total games played across all lanes (min 15% so bar remains visible if played)
                const heightFraction = stat.matches / totalGames;
                const gaugeHeightPercent = stat.matches > 0 ? Math.max(15, Math.round(heightFraction * 100)) : 0;

                const winPct = totalOutcomes > 0 ? Math.round((stat.laneWins / totalOutcomes) * 100) : 0;
                const evenPct = totalOutcomes > 0 ? Math.round((stat.laneEvens / totalOutcomes) * 100) : 0;
                const lossPct = totalOutcomes > 0 ? Math.round((stat.laneLosses / totalOutcomes) * 100) : 0;

                const fullTooltip = `Lane Outcomes (${totalOutcomes} total):\n• Won: ${stat.laneWins} (${winPct}%)\n• Even: ${stat.laneEvens} (${evenPct}%)\n• Lost: ${stat.laneLosses} (${lossPct}%)`;

                return (
                  <div
                    key={key}
                    className={`steam-glass steam-panel border ${borderClass} rounded-xl p-4 flex flex-col gap-4 relative overflow-hidden transition-all`}
                  >
                    <div className={`absolute top-0 right-0 w-28 h-28 ${glowClass} rounded-full blur-xl pointer-events-none`} />

                    {/* Lane Header */}
                    <div className="flex items-center justify-between z-10">
                      <div className="flex items-center gap-2">
                        <span className={`w-3 h-3 rounded-full shadow-sm ${dotClass}`} />
                        <span className={`font-bold text-sm ${colorClass}`}>{label}</span>
                      </div>
                      <span className="text-xs text-deadlock-muted font-mono bg-deadlock-dark/80 px-2 py-0.5 rounded border border-deadlock-border/60">
                        {stat.matches} {stat.matches === 1 ? 'game' : 'games'}
                      </span>
                    </div>

                    {/* Gauge & Win Rate Row */}
                    <div className="flex items-center justify-center gap-5 z-10 py-1">
                      {/* Vertical Segmented Gauge (Green / White / Red) */}
                      <div className="flex flex-col items-center gap-1.5">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-deadlock-muted">
                          Lane Outcome
                        </span>
                        {/* Gauge Container (fixed height 192px / h-48, width w-11, inner bar height scaled to total games) */}
                        <div
                          className="w-11 h-48 bg-deadlock-dark/90 rounded-xl p-1.5 border border-deadlock-border/70 flex flex-col justify-end relative shadow-inner cursor-pointer"
                          title={fullTooltip}
                        >
                          {stat.matches > 0 && totalOutcomes > 0 ? (
                            <div
                              style={{ height: `${gaugeHeightPercent}%` }}
                              className="w-full rounded-lg overflow-hidden flex flex-col-reverse gap-0.5 transition-all duration-500 shadow-md p-0.5 bg-black/40"
                              title={fullTooltip}
                            >
                              {/* Discrete segments for Lost (Red) */}
                              {Array.from({ length: stat.laneLosses }).map((_, i) => (
                                <div
                                  key={`loss-${i}`}
                                  className="w-full flex-1 min-h-[3px] rounded-[2px] bg-red-500 hover:brightness-125 transition-all"
                                  title={`Lane Lost: ${stat.laneLosses} (${lossPct}%)\n${fullTooltip}`}
                                />
                              ))}

                              {/* Discrete segments for Even (White) */}
                              {Array.from({ length: stat.laneEvens }).map((_, i) => (
                                <div
                                  key={`even-${i}`}
                                  className="w-full flex-1 min-h-[3px] rounded-[2px] bg-gray-100 hover:bg-white transition-all"
                                  title={`Lane Even: ${stat.laneEvens} (${evenPct}%)\n${fullTooltip}`}
                                />
                              ))}

                              {/* Discrete segments for Won (Green) */}
                              {Array.from({ length: stat.laneWins }).map((_, i) => (
                                <div
                                  key={`win-${i}`}
                                  className="w-full flex-1 min-h-[3px] rounded-[2px] bg-emerald-500 hover:brightness-125 transition-all"
                                  title={`Lane Won: ${stat.laneWins} (${winPct}%)\n${fullTooltip}`}
                                />
                              ))}
                            </div>
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px] text-deadlock-muted italic text-center px-1">
                              No lane data
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Game Winrate to the right of the gauge (compact width) */}
                      <div className="flex flex-col items-center justify-center py-4 px-3 rounded-xl bg-deadlock-dark/70 border border-deadlock-border/40 text-center w-32 shrink-0">
                        <span className="text-[10px] uppercase tracking-wider font-bold text-deadlock-muted whitespace-nowrap">
                          Game Win Rate
                        </span>
                        <div className="text-2xl font-black text-deadlock-steam font-mono mt-1">
                          {stat.wins + stat.losses > 0 ? `${stat.winRate}%` : 'N/A'}
                        </div>
                        <span className="text-[11px] text-deadlock-muted font-mono mt-1 whitespace-nowrap">
                          {stat.wins}W - {stat.losses}L {stat.cancels > 0 ? `(${stat.cancels} C)` : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* SECTION 2: LANE RESULT CONVERSION (Win rate when winning vs losing lane) */}
      <div className="steam-glass steam-panel rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-deadlock-win" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-deadlock-steam">
            Lane Outcome Conversion to Match Victory
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Lane Won */}
          <div className="bg-deadlock-card/80 border border-deadlock-win/30 rounded-xl p-3.5 flex flex-col gap-2">
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
          <div className="bg-deadlock-card/80 border border-yellow-500/30 rounded-xl p-3.5 flex flex-col gap-2">
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
          <div className="bg-deadlock-card/80 border border-deadlock-loss/30 rounded-xl p-3.5 flex flex-col gap-2">
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
        <div className="steam-glass steam-panel rounded-xl overflow-hidden flex flex-col">
          <div className="p-4 border-b border-deadlock-border/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Swords className="w-4 h-4 text-deadlock-hidden-king" />
              <h3 className="text-sm font-bold tracking-wide uppercase text-deadlock-steam">
                Direct Lane Opponents Faced ({laneStats.opponents.length} heroes)
              </h3>
            </div>
            <span className="text-xs text-deadlock-muted">
              Opponents you faced in your lane
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-deadlock-card/80 text-deadlock-muted border-b border-deadlock-border/60">
                <tr>
                  <th className="py-3 px-4 font-semibold">Opponent Hero</th>
                  <th className="py-3 px-4 font-semibold">Lanes Faced</th>
                  <th className="py-3 px-4 font-semibold">Lane Record</th>
                  <th className="py-3 px-4 font-semibold">Lane Winrate</th>
                  <th className="py-3 px-4 font-semibold text-right">Final Game Winrate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-deadlock-border/40">
                {laneStats.opponents.map((opp) => {
                  const isRep = opp.isRepresentative;
                  return (
                    <tr
                      key={opp.opponentHeroId}
                      className={`transition-all duration-200 ${
                        !isRep
                          ? 'opacity-40 blur-[1px] hover:blur-none hover:opacity-100'
                          : 'hover:bg-deadlock-card/40'
                      }`}
                      title={!isRep ? `Low sample (< ${opp.threshold} matches)` : undefined}
                    >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <HeroAvatar heroId={opp.opponentHeroId} size="xs" />
                        <span className="font-bold text-deadlock-steam">{opp.opponentHero?.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-deadlock-steam">
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
                );
              })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
