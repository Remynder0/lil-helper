import React from 'react';
import { Swords, Users, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { DirectLaneOpponentStat, DirectLaneAllyStat } from '../../../services/analytics';
import { TableSortField, MatchupTab } from './laneTypes';
import { OpponentRow } from './OpponentRow';
import { AllyRow } from './AllyRow';

export interface LaneMatchupsTableProps {
  matchupTab: MatchupTab;
  onTabChange: (tab: MatchupTab) => void;
  tableSearch: string;
  onSearchChange: (search: string) => void;
  sortField: TableSortField;
  sortAsc: boolean;
  onSort: (field: TableSortField) => void;
  totalOpponentsCount: number;
  totalAlliesCount: number;
  repOpponents: DirectLaneOpponentStat[];
  lowSampleOpponents: DirectLaneOpponentStat[];
  repAllies: DirectLaneAllyStat[];
  lowSampleAllies: DirectLaneAllyStat[];
  currentThreshold: number;
  sortedOpponentsLength: number;
  sortedAlliesLength: number;
}

export const LaneMatchupsTable: React.FC<LaneMatchupsTableProps> = ({
  matchupTab,
  onTabChange,
  tableSearch,
  onSearchChange,
  sortField,
  sortAsc,
  onSort,
  totalOpponentsCount,
  totalAlliesCount,
  repOpponents,
  lowSampleOpponents,
  repAllies,
  lowSampleAllies,
  currentThreshold,
  sortedOpponentsLength,
  sortedAlliesLength,
}) => {
  return (
    <div className="steam-glass steam-panel rounded-xl overflow-hidden flex flex-col">
      {/* Toolbar Header */}
      <div className="p-4 border-b border-deadlock-border/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Mode Switcher Tabs */}
        <div className="flex items-center gap-1.5 bg-deadlock-dark/80 p-1 rounded-xl border border-deadlock-border/60">
          <button
            type="button"
            onClick={() => onTabChange('opponents')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              matchupTab === 'opponents'
                ? 'bg-deadlock-border text-deadlock-steam shadow-sm border border-white/20'
                : 'text-deadlock-muted hover:text-deadlock-steam'
            }`}
          >
            <Swords className="w-3.5 h-3.5 text-deadlock-hidden-king" />
            <span>Direct Opponents</span>
            <span className="text-[10px] font-mono opacity-70">({totalOpponentsCount})</span>
          </button>

          <button
            type="button"
            onClick={() => onTabChange('allies')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              matchupTab === 'allies'
                ? 'bg-deadlock-border text-deadlock-steam shadow-sm border border-white/20'
                : 'text-deadlock-muted hover:text-deadlock-steam'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-sky-400" />
            <span>Duo Lane Partners</span>
            <span className="text-[10px] font-mono opacity-70">({totalAlliesCount})</span>
          </button>
        </div>

        {/* Quick Search & Info Label */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-deadlock-muted hidden sm:inline">Click column headers to sort</span>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-deadlock-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={matchupTab === 'opponents' ? 'Search opponent...' : 'Search partner...'}
              value={tableSearch}
              onChange={(e) => onSearchChange(e.target.value)}
              className="bg-deadlock-dark border border-deadlock-border text-xs rounded-lg pl-8 pr-3 py-1.5 text-deadlock-steam focus:outline-none focus:border-deadlock-accent w-40 sm:w-48 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Matchup Table with Clickable Sorting Columns */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-deadlock-card/90 text-deadlock-muted border-b border-deadlock-border/60">
            <tr>
              {/* Hero Column */}
              <th
                onClick={() => onSort('hero')}
                className="py-3 px-4 font-semibold cursor-pointer hover:text-deadlock-steam transition-colors select-none"
              >
                <div className="flex items-center gap-1">
                  <span>Hero</span>
                  {sortField === 'hero' && (
                    sortAsc ? <ChevronUp className="w-3.5 h-3.5 text-deadlock-accent" /> : <ChevronDown className="w-3.5 h-3.5 text-deadlock-accent" />
                  )}
                </div>
              </th>

              {/* Lanes Count Column */}
              <th
                onClick={() => onSort('lanes')}
                className="py-3 px-4 font-semibold cursor-pointer hover:text-deadlock-steam transition-colors select-none"
              >
                <div className="flex items-center gap-1">
                  <span>{matchupTab === 'opponents' ? 'Lanes Faced' : 'Lanes Together'}</span>
                  {sortField === 'lanes' && (
                    sortAsc ? <ChevronUp className="w-3.5 h-3.5 text-deadlock-accent" /> : <ChevronDown className="w-3.5 h-3.5 text-deadlock-accent" />
                  )}
                </div>
              </th>

              {/* Record Column: xW - xE - xL (with E in Yellow) */}
              <th
                onClick={() => onSort('laneWins')}
                className="py-3 px-4 font-semibold cursor-pointer hover:text-deadlock-steam transition-colors select-none"
              >
                <div className="flex items-center gap-1">
                  <span>Laning Phase Record (W / E / L)</span>
                  {sortField === 'laneWins' && (
                    sortAsc ? <ChevronUp className="w-3.5 h-3.5 text-deadlock-accent" /> : <ChevronDown className="w-3.5 h-3.5 text-deadlock-accent" />
                  )}
                </div>
              </th>

              {/* Lane Dominance Column */}
              <th
                onClick={() => onSort('laneScore')}
                className="py-3 px-4 font-semibold cursor-pointer hover:text-deadlock-steam transition-colors select-none"
                title="Lane Dominance: Normalized rating (0% to 100%) based on Win (+2), Even (+1), Loss (-2) with 5 chromatic performance tiers"
              >
                <div className="flex items-center gap-1">
                  <span>Lane Dominance</span>
                  {sortField === 'laneScore' && (
                    sortAsc ? <ChevronUp className="w-3.5 h-3.5 text-deadlock-accent" /> : <ChevronDown className="w-3.5 h-3.5 text-deadlock-accent" />
                  )}
                </div>
              </th>

              {/* Final Match Win Rate Column */}
              <th
                onClick={() => onSort('gameWinRate')}
                className="py-3 px-4 font-semibold cursor-pointer hover:text-deadlock-steam transition-colors select-none text-right"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Final Game Win Rate</span>
                  {sortField === 'gameWinRate' && (
                    sortAsc ? <ChevronUp className="w-3.5 h-3.5 text-deadlock-accent" /> : <ChevronDown className="w-3.5 h-3.5 text-deadlock-accent" />
                  )}
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-deadlock-border/40">
            {matchupTab === 'opponents' ? (
              <>
                {repOpponents.map((opp) => (
                  <OpponentRow key={opp.opponentHeroId} opp={opp} isLowSample={false} />
                ))}

                {/* Delimiter row for low-sample opponents */}
                {lowSampleOpponents.length > 0 && (
                  <tr className="bg-deadlock-dark/95 border-y border-dashed border-amber-500/40">
                    <td colSpan={5} className="py-2.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-2 text-xs text-amber-200/90 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-sm shadow-amber-400/50" />
                        <span>
                          Low Sample Size (&lt; {currentThreshold} matches) — The following heroes do not have enough data to be statistically conclusive
                        </span>
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-sm shadow-amber-400/50" />
                      </div>
                    </td>
                  </tr>
                )}

                {lowSampleOpponents.map((opp) => (
                  <OpponentRow
                    key={opp.opponentHeroId}
                    opp={opp}
                    isLowSample={true}
                    threshold={currentThreshold}
                  />
                ))}

                {sortedOpponentsLength === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-deadlock-muted italic">
                      No direct lane opponents found matching your criteria.
                    </td>
                  </tr>
                )}
              </>
            ) : (
              <>
                {repAllies.map((ally) => (
                  <AllyRow key={ally.allyHeroId} ally={ally} isLowSample={false} />
                ))}

                {/* Delimiter row for low-sample allies */}
                {lowSampleAllies.length > 0 && (
                  <tr className="bg-deadlock-dark/95 border-y border-dashed border-amber-500/40">
                    <td colSpan={5} className="py-2.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-2 text-xs text-amber-200/90 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-sm shadow-amber-400/50" />
                        <span>
                          Low Sample Size (&lt; {currentThreshold} matches) — The following heroes do not have enough data to be statistically conclusive
                        </span>
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-sm shadow-amber-400/50" />
                      </div>
                    </td>
                  </tr>
                )}

                {lowSampleAllies.map((ally) => (
                  <AllyRow
                    key={ally.allyHeroId}
                    ally={ally}
                    isLowSample={true}
                    threshold={currentThreshold}
                  />
                ))}

                {sortedAlliesLength === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-deadlock-muted italic">
                      No duo lane partners recorded yet. When playing a duo lane, assign your lane ally in the match editor to track synergies!
                    </td>
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
