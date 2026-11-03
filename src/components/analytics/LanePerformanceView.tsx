import React, { useState, useMemo, useEffect } from 'react';
import { Match } from '../../types/match';
import {
  calculateLaneAnalytics,
  LaneAnalyticsSummary,
  DirectLaneOpponentStat,
  DirectLaneAllyStat,
} from '../../services/analytics';
import { getHeroById } from '../../data/heroes';
import { Compass } from 'lucide-react';
import { loadUserSettings, VialDisplayMode } from '../../services/storage/userSettings';
import {
  TableSortField,
  MatchupTab,
  calculateLaneScore,
  calculateLaneDominance,
  LaneCardConfig,
  LaneHeroFilter,
  LaneVialsSection,
  LaneConversionSection,
  LaneMatchupsTable,
} from './lanes';
import { SideFilterType } from '../HeroFilter';
import { ClassicVialGauge } from './vials';

// Re-export for backwards compatibility
export { calculateLaneScore, calculateLaneDominance };
export { ClassicVialGauge as AlchemicalVialGauge };

interface LanePerformanceViewProps {
  matches: Match[];
}

export const LanePerformanceView: React.FC<LanePerformanceViewProps> = ({ matches }) => {
  const [selectedPlayerHeroId, setSelectedPlayerHeroId] = useState<number | null>(null);
  const [matchupTab, setMatchupTab] = useState<MatchupTab>('opponents');
  const [selectedSide, setSelectedSide] = useState<SideFilterType>('all');
  const [tableSearch, setTableSearch] = useState<string>('');
  const [sortField, setSortField] = useState<TableSortField>('lanes');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Preference for vial display: 'echarts' (animated liquid waves) vs 'classic' (calibrated flat SVG)
  const [vialDisplayMode, setVialDisplayMode] = useState<VialDisplayMode>(
    () => loadUserSettings().vialDisplayMode ?? 'echarts'
  );

  useEffect(() => {
    const handleSettingsUpdate = () => {
      setVialDisplayMode(loadUserSettings().vialDisplayMode ?? 'echarts');
    };
    window.addEventListener('deadlock_settings_updated', handleSettingsUpdate);
    return () => {
      window.removeEventListener('deadlock_settings_updated', handleSettingsUpdate);
    };
  }, []);

  // Match counts per side for matches with lane data
  const sideCounts = useMemo(() => {
    let hiddenKing = 0;
    let archmother = 0;
    for (const m of matches) {
      if (m.lane) {
        if (m.side === 'hidden_king') hiddenKing++;
        else if (m.side === 'archmother') archmother++;
      }
    }
    return { hiddenKing, archmother, total: hiddenKing + archmother };
  }, [matches]);

  // Filter matches based on selected map side
  const filteredMatches = useMemo(() => {
    if (selectedSide === 'all') return matches;
    return matches.filter((m) => m.side === selectedSide);
  }, [matches, selectedSide]);

  // Distinct heroes piloted by player with lane data, sorted by matches played descending
  const playedHeroes = useMemo(() => {
    const heroCounts = new Map<number, number>();
    for (const m of filteredMatches) {
      if (m.lane) {
        heroCounts.set(m.myHeroId, (heroCounts.get(m.myHeroId) || 0) + 1);
      }
    }
    const playedHeroIds = Array.from(heroCounts.keys());
    return playedHeroIds
      .map((id) => ({
        hero: getHeroById(id),
        count: heroCounts.get(id) || 0,
      }))
      .filter((item): item is { hero: NonNullable<typeof item.hero>; count: number } => item.hero !== undefined)
      .sort((a, b) => b.count - a.count);
  }, [filteredMatches]);

  const laneStats: LaneAnalyticsSummary = useMemo(
    () => calculateLaneAnalytics(filteredMatches, selectedPlayerHeroId),
    [filteredMatches, selectedPlayerHeroId]
  );

  const selectedHeroObj = selectedPlayerHeroId ? (getHeroById(selectedPlayerHeroId) ?? null) : null;

  const handleSort = (field: TableSortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(field === 'hero'); // Ascending for hero name, descending for stats
    }
  };

  // Filter and sort opponents
  const sortedOpponents = useMemo(() => {
    let list = [...laneStats.opponents];
    if (tableSearch.trim()) {
      const q = tableSearch.toLowerCase().trim();
      list = list.filter((o) => o.opponentHero?.name.toLowerCase().includes(q));
    }
    return list.sort((a, b) => {
      let diff = 0;
      if (sortField === 'hero') {
        const nameA = a.opponentHero?.name || '';
        const nameB = b.opponentHero?.name || '';
        diff = nameA.localeCompare(nameB);
      } else if (sortField === 'lanes') {
        diff = b.lanesFaced - a.lanesFaced;
      } else if (sortField === 'laneWins') {
        diff = b.laneWins - a.laneWins;
      } else if (sortField === 'laneScore') {
        const domA = calculateLaneDominance(a.laneWins, a.laneEvens, a.laneLosses);
        const domB = calculateLaneDominance(b.laneWins, b.laneEvens, b.laneLosses);
        diff = domB - domA;
        if (diff === 0) {
          diff = calculateLaneScore(b.laneWins, b.laneEvens, b.laneLosses) - calculateLaneScore(a.laneWins, a.laneEvens, a.laneLosses);
        }
      } else if (sortField === 'gameWinRate') {
        diff = b.gameWinRate - a.gameWinRate;
      }
      return sortAsc ? -diff : diff;
    });
  }, [laneStats.opponents, tableSearch, sortField, sortAsc]);

  // Filter and sort allies (duo lane partners)
  const sortedAllies = useMemo(() => {
    let list = [...laneStats.allies];
    if (tableSearch.trim()) {
      const q = tableSearch.toLowerCase().trim();
      list = list.filter((a) => a.allyHero?.name.toLowerCase().includes(q));
    }
    return list.sort((a, b) => {
      let diff = 0;
      if (sortField === 'hero') {
        const nameA = a.allyHero?.name || '';
        const nameB = b.allyHero?.name || '';
        diff = nameA.localeCompare(nameB);
      } else if (sortField === 'lanes') {
        diff = b.lanesTogether - a.lanesTogether;
      } else if (sortField === 'laneWins') {
        diff = b.laneWins - a.laneWins;
      } else if (sortField === 'laneScore') {
        const domA = calculateLaneDominance(a.laneWins, a.laneEvens, a.laneLosses);
        const domB = calculateLaneDominance(b.laneWins, b.laneEvens, b.laneLosses);
        diff = domB - domA;
        if (diff === 0) {
          diff = calculateLaneScore(b.laneWins, b.laneEvens, b.laneLosses) - calculateLaneScore(a.laneWins, a.laneEvens, a.laneLosses);
        }
      } else if (sortField === 'gameWinRate') {
        diff = b.gameWinRate - a.gameWinRate;
      }
      return sortAsc ? -diff : diff;
    });
  }, [laneStats.allies, tableSearch, sortField, sortAsc]);

  // Partition opponents into representative and low-sample
  const { repOpponents, lowSampleOpponents } = useMemo(() => {
    const rep: DirectLaneOpponentStat[] = [];
    const low: DirectLaneOpponentStat[] = [];
    for (const item of sortedOpponents) {
      if (item.isRepresentative) {
        rep.push(item);
      } else {
        low.push(item);
      }
    }
    return { repOpponents: rep, lowSampleOpponents: low };
  }, [sortedOpponents]);

  // Partition allies into representative and low-sample
  const { repAllies, lowSampleAllies } = useMemo(() => {
    const rep: DirectLaneAllyStat[] = [];
    const low: DirectLaneAllyStat[] = [];
    for (const item of sortedAllies) {
      if (item.isRepresentative) {
        rep.push(item);
      } else {
        low.push(item);
      }
    }
    return { repAllies: rep, lowSampleAllies: low };
  }, [sortedAllies]);

  const currentThreshold = useMemo(() => {
    if (matchupTab === 'opponents' && laneStats.opponents.length > 0) {
      return laneStats.opponents[0].threshold ?? 3;
    }
    if (matchupTab === 'allies' && laneStats.allies.length > 0) {
      return laneStats.allies[0].threshold ?? 3;
    }
    return 3;
  }, [matchupTab, laneStats]);

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

  const lanesConfig: LaneCardConfig[] = [
    {
      key: 'yellow',
      label: 'York (Yellow)',
      colorClass: 'text-yellow-400',
      borderClass: 'border-yellow-500/40',
      bgGlowClass: 'bg-yellow-500/5',
      dotClass: 'bg-yellow-400 shadow-yellow-400/50',
      stat: laneStats.lanes.yellow,
    },
    {
      key: 'blue',
      label: 'Broadway (Blue)',
      colorClass: 'text-sky-400',
      borderClass: 'border-sky-500/40',
      bgGlowClass: 'bg-sky-500/5',
      dotClass: 'bg-sky-400 shadow-sky-400/50',
      stat: laneStats.lanes.blue,
    },
    {
      key: 'green',
      label: 'Greenwich (Green)',
      colorClass: 'text-emerald-400',
      borderClass: 'border-emerald-500/40',
      bgGlowClass: 'bg-emerald-500/5',
      dotClass: 'bg-emerald-400 shadow-emerald-400/50',
      stat: laneStats.lanes.green,
    },
  ];

  const totalTrackedGames = Math.max(laneStats.totalLaneTrackedMatches, 1);

  return (
    <div className="flex flex-col gap-6">
      {/* ── SECTION 1: FILTER BY YOUR HERO, MATCHUP & MAP SIDE ── */}
      <LaneHeroFilter
        playedHeroes={playedHeroes}
        selectedPlayerHeroId={selectedPlayerHeroId}
        onSelectHeroId={setSelectedPlayerHeroId}
        selectedHeroObj={selectedHeroObj}
        totalTrackedMatches={laneStats.totalLaneTrackedMatches}
        matchupTab={matchupTab}
        onTabChange={setMatchupTab}
        totalOpponentsCount={laneStats.opponents.length}
        totalAlliesCount={laneStats.allies.length}
        selectedSide={selectedSide}
        onSideChange={setSelectedSide}
        sideCounts={sideCounts}
      />

      {/* ── SECTION 2: VERTICAL ALCHEMICAL LIQUID VIALS & LANE SCORE ── */}
      <LaneVialsSection
        lanesConfig={lanesConfig}
        totalTrackedGames={totalTrackedGames}
        vialDisplayMode={vialDisplayMode}
        onVialDisplayModeChange={setVialDisplayMode}
      />

      {/* ── SECTION 3: LANE CONVERSION TO MATCH VICTORY (SNOWBALL & COMEBACK) ── */}
      <LaneConversionSection outcomes={laneStats.outcomes} />

      {/* ── SECTION 4: DIRECT LANE MATCHUPS TABLE (CLICKABLE SORTABLE COLUMNS) ── */}
      <LaneMatchupsTable
        matchupTab={matchupTab}
        tableSearch={tableSearch}
        onSearchChange={setTableSearch}
        sortField={sortField}
        sortAsc={sortAsc}
        onSort={handleSort}
        totalOpponentsCount={laneStats.opponents.length}
        totalAlliesCount={laneStats.allies.length}
        repOpponents={repOpponents}
        lowSampleOpponents={lowSampleOpponents}
        repAllies={repAllies}
        lowSampleAllies={lowSampleAllies}
        currentThreshold={currentThreshold}
        sortedOpponentsLength={sortedOpponents.length}
        sortedAlliesLength={sortedAllies.length}
      />
    </div>
  );
};
