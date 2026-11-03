import React, { useMemo } from 'react';
import { Swords, Users, Search } from 'lucide-react';
import { DirectLaneOpponentStat, DirectLaneAllyStat } from '../../../services/analytics';
import { TableSortField, MatchupTab, calculateLaneScore, calculateLaneDominance, getDominanceTier } from './laneTypes';
import { HeroAvatar } from '../../HeroAvatar';
import { HeroTable, HeroTableColumn } from '../../template/HeroTable';

export interface LaneMatchupsTableProps {
  matchupTab: MatchupTab;
  onTabChange?: (tab: MatchupTab) => void;
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
}) => {
  // Shared column renderers
  const renderRecord = (wins: number, evens: number, losses: number) => (
    <div className="flex items-center gap-1.5 font-mono font-bold">
      <span className="text-deadlock-win">{wins}W</span>
      <span className="text-deadlock-muted font-normal">-</span>
      <span className="text-yellow-400">{evens}E</span>
      <span className="text-deadlock-muted font-normal">-</span>
      <span className="text-deadlock-loss">{losses}L</span>
    </div>
  );

  const renderDominance = (wins: number, evens: number, losses: number) => {
    const score = calculateLaneScore(wins, evens, losses);
    const dominance = calculateLaneDominance(wins, evens, losses);
    const tier = getDominanceTier(dominance);
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-bold border font-mono cursor-help transition-all ${tier.bgClass} ${tier.colorClass} ${tier.borderClass}`}
        title={`Lane Dominance: ${dominance}% (${tier.label})\n• Cumulative score: ${score > 0 ? `+${score}` : score} pts\n• Scoring rules: Win (+2), Even (+1), Loss (-2)`}
      >
        <span>{dominance}%</span>
      </span>
    );
  };

  const renderWinRate = (winRate: number, wins: number, losses: number) => (
    <div className="flex items-center justify-end font-mono">
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border ${
          winRate >= 50
            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
            : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
        }`}
      >
        {winRate}%
      </span>
      <span className="text-[11px] text-deadlock-muted ml-2">
        ({wins}W - {losses}L)
      </span>
    </div>
  );

  // Column definitions for Direct Lane Opponents
  const opponentColumns: HeroTableColumn<DirectLaneOpponentStat>[] = useMemo(
    () => [
      {
        key: 'hero',
        header: 'Hero',
        sortField: 'hero',
        render: (opp, _idx, isLow) => (
          <div className="flex items-center gap-2.5">
            <HeroAvatar heroId={opp.opponentHeroId} size="xs" />
            <span className="font-bold text-deadlock-steam">{opp.opponentHero?.name}</span>
            {isLow && (
              <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-mono">
                Low Sample
              </span>
            )}
          </div>
        ),
      },
      {
        key: 'lanes',
        header: 'Lanes Faced',
        sortField: 'lanes',
        render: (opp) => (
          <span className="font-mono text-deadlock-steam font-semibold">{opp.lanesFaced}</span>
        ),
      },
      {
        key: 'record',
        header: 'Laning Phase Record (W / E / L)',
        sortField: 'laneWins',
        render: (opp) => renderRecord(opp.laneWins, opp.laneEvens, opp.laneLosses),
      },
      {
        key: 'dominance',
        header: 'Lane Dominance',
        sortField: 'laneScore',
        titleTooltip:
          'Lane Dominance: Normalized rating (0% to 100%) based on Win (+2), Even (+1), Loss (-2) with 5 chromatic performance tiers',
        render: (opp) => renderDominance(opp.laneWins, opp.laneEvens, opp.laneLosses),
      },
      {
        key: 'gameWinRate',
        header: 'Final Game Win Rate',
        sortField: 'gameWinRate',
        align: 'right',
        render: (opp) => renderWinRate(opp.gameWinRate, opp.gameWins, opp.gameLosses),
      },
    ],
    []
  );

  // Column definitions for Duo Lane Partners
  const allyColumns: HeroTableColumn<DirectLaneAllyStat>[] = useMemo(
    () => [
      {
        key: 'hero',
        header: 'Hero',
        sortField: 'hero',
        render: (ally, _idx, isLow) => (
          <div className="flex items-center gap-2.5">
            <HeroAvatar heroId={ally.allyHeroId} size="xs" />
            <span className="font-bold text-deadlock-steam">{ally.allyHero?.name}</span>
            {isLow && (
              <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-mono">
                Low Sample
              </span>
            )}
          </div>
        ),
      },
      {
        key: 'lanes',
        header: 'Lanes Together',
        sortField: 'lanes',
        render: (ally) => (
          <span className="font-mono text-deadlock-steam font-semibold">{ally.lanesTogether}</span>
        ),
      },
      {
        key: 'record',
        header: 'Laning Phase Record (W / E / L)',
        sortField: 'laneWins',
        render: (ally) => renderRecord(ally.laneWins, ally.laneEvens, ally.laneLosses),
      },
      {
        key: 'dominance',
        header: 'Lane Dominance',
        sortField: 'laneScore',
        titleTooltip:
          'Lane Dominance: Normalized rating (0% to 100%) based on Win (+2), Even (+1), Loss (-2) with 5 chromatic performance tiers',
        render: (ally) => renderDominance(ally.laneWins, ally.laneEvens, ally.laneLosses),
      },
      {
        key: 'gameWinRate',
        header: 'Final Game Win Rate',
        sortField: 'gameWinRate',
        align: 'right',
        render: (ally) => renderWinRate(ally.gameWinRate, ally.gameWins, ally.gameLosses),
      },
    ],
    []
  );

  // Header Toolbar with active dataset indicator & Search Input
  const headerToolbar = (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      {/* Current Dataset Indicator */}
      <div className="flex items-center gap-2">
        {matchupTab === 'opponents' ? (
          <Swords className="w-4 h-4 text-deadlock-hidden-king" />
        ) : (
          <Users className="w-4 h-4 text-sky-400" />
        )}
        <h3 className="font-bold text-xs uppercase tracking-wider text-deadlock-steam">
          {matchupTab === 'opponents'
            ? `Direct Lane Opponents (${totalOpponentsCount})`
            : `Duo Lane Partners (${totalAlliesCount})`}
        </h3>
      </div>

      {/* Quick Search & Sort Hint */}
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
  );

  return matchupTab === 'opponents' ? (
    <HeroTable<DirectLaneOpponentStat>
      data={repOpponents}
      lowSampleData={lowSampleOpponents}
      threshold={currentThreshold}
      columns={opponentColumns}
      getRowKey={(opp) => opp.opponentHeroId}
      sortField={sortField}
      sortAsc={sortAsc}
      onSort={(field) => onSort(field as TableSortField)}
      headerContent={headerToolbar}
      emptyMessage="No direct lane opponents found matching your criteria."
    />
  ) : (
    <HeroTable<DirectLaneAllyStat>
      data={repAllies}
      lowSampleData={lowSampleAllies}
      threshold={currentThreshold}
      columns={allyColumns}
      getRowKey={(ally) => ally.allyHeroId}
      sortField={sortField}
      sortAsc={sortAsc}
      onSort={(field) => onSort(field as TableSortField)}
      headerContent={headerToolbar}
      emptyMessage="No duo lane partners recorded yet. When playing a duo lane, assign your lane ally in the match editor to track synergies!"
    />
  );
};
