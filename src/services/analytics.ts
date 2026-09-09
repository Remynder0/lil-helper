import { Match } from '../types/match';
import { getHeroById, HEROES, Hero } from '../data/heroes';

/* ==========================================================================
   GLOBAL STATISTICS & HERO PERFORMANCE
   ========================================================================== */

export interface GlobalStats {
  totalMatches: number;
  totalWins: number;
  totalLosses: number;
  totalCancels: number;
  winRate: number; // 0-100 percentage excluding cancels
}

export interface PatronStats {
  hiddenKing: {
    matches: number;
    wins: number;
    losses: number;
    cancels: number;
    winRate: number;
  };
  archmother: {
    matches: number;
    wins: number;
    losses: number;
    cancels: number;
    winRate: number;
  };
}

export interface HeroPerformance {
  heroId: number;
  hero: Hero | undefined;
  matches: number;
  wins: number;
  losses: number;
  cancels: number;
  winRate: number; // 0-100 percentage
}

/**
 * Calculates global statistics over a list of matches.
 * Note: cancelled matches are excluded from the winrate denominator.
 */
export function calculateGlobalStats(matches: Match[]): GlobalStats {
  let totalWins = 0;
  let totalLosses = 0;
  let totalCancels = 0;

  for (const m of matches) {
    if (m.result === 'win') totalWins += 1;
    else if (m.result === 'loss') totalLosses += 1;
    else if (m.result === 'cancel') totalCancels += 1;
  }

  const decided = totalWins + totalLosses;
  const winRate = decided > 0 ? Math.round((totalWins / decided) * 100) : 0;

  return {
    totalMatches: matches.length,
    totalWins,
    totalLosses,
    totalCancels,
    winRate,
  };
}

/**
 * Computes performance statistics comparing the two patrons:
 * The Hidden King vs The Archmother.
 */
export function calculatePatronStats(matches: Match[]): PatronStats {
  const stats: PatronStats = {
    hiddenKing: { matches: 0, wins: 0, losses: 0, cancels: 0, winRate: 0 },
    archmother: { matches: 0, wins: 0, losses: 0, cancels: 0, winRate: 0 },
  };

  for (const m of matches) {
    const bucket = m.side === 'hidden_king' ? stats.hiddenKing : stats.archmother;
    bucket.matches += 1;
    if (m.result === 'win') bucket.wins += 1;
    else if (m.result === 'loss') bucket.losses += 1;
    else if (m.result === 'cancel') bucket.cancels += 1;
  }

  const hkDecided = stats.hiddenKing.wins + stats.hiddenKing.losses;
  stats.hiddenKing.winRate = hkDecided > 0 ? Math.round((stats.hiddenKing.wins / hkDecided) * 100) : 0;

  const archDecided = stats.archmother.wins + stats.archmother.losses;
  stats.archmother.winRate = archDecided > 0 ? Math.round((stats.archmother.wins / archDecided) * 100) : 0;

  return stats;
}

/**
 * Computes performance breakdown per played hero (myHeroId).
 * Sorted by matches played descending by default.
 */
export function calculateHeroPerformance(matches: Match[]): HeroPerformance[] {
  const map = new Map<number, { matches: number; wins: number; losses: number; cancels: number }>();

  for (const m of matches) {
    const current = map.get(m.myHeroId) || { matches: 0, wins: 0, losses: 0, cancels: 0 };
    current.matches += 1;
    if (m.result === 'win') current.wins += 1;
    else if (m.result === 'loss') current.losses += 1;
    else if (m.result === 'cancel') current.cancels += 1;
    map.set(m.myHeroId, current);
  }

  const list: HeroPerformance[] = [];

  for (const [heroId, stat] of map.entries()) {
    const decided = stat.wins + stat.losses;
    const winRate = decided > 0 ? Math.round((stat.wins / decided) * 100) : 0;
    list.push({
      heroId,
      hero: getHeroById(heroId),
      matches: stat.matches,
      wins: stat.wins,
      losses: stat.losses,
      cancels: stat.cancels,
      winRate,
    });
  }

  // Sort by matches played descending
  list.sort((a, b) => b.matches - a.matches);

  return list;
}


/* ==========================================================================
   ENEMY MATCHUP MATRIX & NEMESES / COUNTERS
   ========================================================================== */

export interface EnemyMatchupStat {
  enemyHeroId: number;
  enemyHero: Hero | undefined;
  matchesAgainst: number;
  wins: number;
  losses: number;
  cancels: number;
  winRate: number; // 0-100 percentage
}

/**
 * Computes matchup statistics against enemy heroes.
 * If playerHeroId is provided, filters to matches where user played that hero (e.g. Abrams vs Bebop).
 * If playerHeroId is null, computes global matchup against each enemy hero across all user picks.
 */
export function calculateEnemyMatchups(
  matches: Match[],
  playerHeroId: number | null = null
): EnemyMatchupStat[] {
  const filtered = playerHeroId !== null
    ? matches.filter((m) => m.myHeroId === playerHeroId)
    : matches;

  const map = new Map<number, { matchesAgainst: number; wins: number; losses: number; cancels: number }>();

  for (const m of filtered) {
    for (const enemyId of m.enemies) {
      const current = map.get(enemyId) || { matchesAgainst: 0, wins: 0, losses: 0, cancels: 0 };
      current.matchesAgainst += 1;
      if (m.result === 'win') current.wins += 1;
      else if (m.result === 'loss') current.losses += 1;
      else if (m.result === 'cancel') current.cancels += 1;
      map.set(enemyId, current);
    }
  }

  const list: EnemyMatchupStat[] = [];
  for (const [enemyHeroId, stat] of map.entries()) {
    const decided = stat.wins + stat.losses;
    const winRate = decided > 0 ? Math.round((stat.wins / decided) * 100) : 0;
    list.push({
      enemyHeroId,
      enemyHero: getHeroById(enemyHeroId),
      matchesAgainst: stat.matchesAgainst,
      wins: stat.wins,
      losses: stat.losses,
      cancels: stat.cancels,
      winRate,
    });
  }

  return list;
}


/* ==========================================================================
   ALLY SYNERGY ENGINE (TEAM COMPATIBILITY & COMBOS)
   ========================================================================== */

export interface AllySynergyStat {
  allyHeroId: number;
  allyHero: Hero | undefined;
  matchesWith: number;
  wins: number;
  losses: number;
  cancels: number;
  winRate: number; // 0-100 percentage
}

/**
 * Computes ally synergy statistics.
 * If playerHeroId is provided, filters to matches where user played that hero (e.g. Abrams + Dynamo).
 * If playerHeroId is null, computes synergy across all matches played.
 */
export function calculateAllySynergies(
  matches: Match[],
  playerHeroId: number | null = null
): AllySynergyStat[] {
  const filtered = playerHeroId !== null
    ? matches.filter((m) => m.myHeroId === playerHeroId)
    : matches;

  const map = new Map<number, { matchesWith: number; wins: number; losses: number; cancels: number }>();

  for (const m of filtered) {
    for (const allyId of m.allies) {
      const current = map.get(allyId) || { matchesWith: 0, wins: 0, losses: 0, cancels: 0 };
      current.matchesWith += 1;
      if (m.result === 'win') current.wins += 1;
      else if (m.result === 'loss') current.losses += 1;
      else if (m.result === 'cancel') current.cancels += 1;
      map.set(allyId, current);
    }
  }

  const list: AllySynergyStat[] = [];
  for (const [allyHeroId, stat] of map.entries()) {
    const decided = stat.wins + stat.losses;
    const winRate = decided > 0 ? Math.round((stat.wins / decided) * 100) : 0;
    list.push({
      allyHeroId,
      allyHero: getHeroById(allyHeroId),
      matchesWith: stat.matchesWith,
      wins: stat.wins,
      losses: stat.losses,
      cancels: stat.cancels,
      winRate,
    });
  }

  return list;
}


/* ==========================================================================
   DRAFT PICK ASSISTANT & RECOMMENDATION ENGINE
   ========================================================================== */

export interface HeroDraftRecommendation {
  heroId: number;
  hero: Hero | undefined;
  /** Composite score: higher means better pick recommendation */
  overallScore: number;
  /** Historical baseline win rate when piloting this hero (0-100) */
  baselineWinRate: number;
  totalGamesPiloted: number;
  /** Average win rate against the current selected enemy draft */
  enemyMatchupScore: number | null;
  /** Explanations of matchups against picked enemies */
  enemyDetails: {
    enemyHeroId: number;
    enemyHeroName: string;
    winRate: number;
    matches: number;
    advantage: number; // positive = counters enemy, negative = countered by enemy
  }[];
  /** Average win rate alongside the current selected ally draft */
  allySynergyScore: number | null;
  /** Explanations of synergies with picked allies */
  allyDetails: {
    allyHeroId: number;
    allyHeroName: string;
    winRate: number;
    matches: number;
    synergy: number; // positive = strong synergy, negative = weak synergy
  }[];
  /** Main reason summary (e.g. "Counters Bebop & Haze (+15% WR), strong with Dynamo") */
  primaryReason: string;
}

/**
 * Computes draft recommendations for all available heroes given the current
 * allies and enemies drafted so far.
 *
 * Algorithm:
 * 1. Calculate baseline win rate for candidate hero H.
 * 2. For each selected enemy E: retrieve historical matchup win rate of H vs E.
 * 3. For each selected ally A: retrieve historical synergy win rate of H with A.
 * 4. Compute weighted overall score and human-readable explanations.
 */
export function calculateDraftRecommendations(
  matches: Match[],
  currentAllies: number[],
  currentEnemies: number[],
  unavailableHeroIds: number[]
): HeroDraftRecommendation[] {
  const recommendations: HeroDraftRecommendation[] = [];

  // Pre-calculate hero performance map
  const heroPerformances = calculateHeroPerformance(matches);
  const heroPerfMap = new Map<number, { winRate: number; matches: number }>();
  for (const hp of heroPerformances) {
    heroPerfMap.set(hp.heroId, { winRate: hp.winRate, matches: hp.matches });
  }

  // Iterate over all active Deadlock heroes
  for (const hero of HEROES) {
    // Skip heroes already picked or unavailable
    if (unavailableHeroIds.includes(hero.id)) {
      continue;
    }

    const perf = heroPerfMap.get(hero.id);
    const baselineWinRate = perf ? perf.winRate : 50; // default to 50% if unplayed
    const totalGamesPiloted = perf ? perf.matches : 0;

    // Filter matches where user piloted this hero
    const heroMatches = matches.filter((m) => m.myHeroId === hero.id);

    // 1. Analyze matchups against selected enemies
    const enemyDetails: HeroDraftRecommendation['enemyDetails'] = [];
    let enemyScoreSum = 0;
    let enemyCount = 0;

    for (const enemyId of currentEnemies) {
      const againstMatches = heroMatches.filter((m) => m.enemies.includes(enemyId));
      const decided = againstMatches.filter((m) => m.result === 'win' || m.result === 'loss');
      const wins = againstMatches.filter((m) => m.result === 'win').length;

      if (decided.length > 0) {
        const wr = Math.round((wins / decided.length) * 100);
        const advantage = wr - 50;
        const enemyObj = getHeroById(enemyId);
        enemyDetails.push({
          enemyHeroId: enemyId,
          enemyHeroName: enemyObj?.name || `Hero #${enemyId}`,
          winRate: wr,
          matches: decided.length,
          advantage,
        });
        enemyScoreSum += wr;
        enemyCount += 1;
      }
    }

    const enemyMatchupScore = enemyCount > 0 ? Math.round(enemyScoreSum / enemyCount) : null;

    // 2. Analyze synergies with selected allies
    const allyDetails: HeroDraftRecommendation['allyDetails'] = [];
    let allyScoreSum = 0;
    let allyCount = 0;

    for (const allyId of currentAllies) {
      const withMatches = heroMatches.filter((m) => m.allies.includes(allyId));
      const decided = withMatches.filter((m) => m.result === 'win' || m.result === 'loss');
      const wins = withMatches.filter((m) => m.result === 'win').length;

      if (decided.length > 0) {
        const wr = Math.round((wins / decided.length) * 100);
        const synergy = wr - 50;
        const allyObj = getHeroById(allyId);
        allyDetails.push({
          allyHeroId: allyId,
          allyHeroName: allyObj?.name || `Hero #${allyId}`,
          winRate: wr,
          matches: decided.length,
          synergy,
        });
        allyScoreSum += wr;
        allyCount += 1;
      }
    }

    const allySynergyScore = allyCount > 0 ? Math.round(allyScoreSum / allyCount) : null;

    // 3. Compute overall recommendation score
    // Baseline: 40% weight, Enemy counters: 35% weight, Ally synergies: 25% weight
    let overallScore = baselineWinRate;
    if (enemyMatchupScore !== null && allySynergyScore !== null) {
      overallScore = Math.round(baselineWinRate * 0.35 + enemyMatchupScore * 0.40 + allySynergyScore * 0.25);
    } else if (enemyMatchupScore !== null) {
      overallScore = Math.round(baselineWinRate * 0.45 + enemyMatchupScore * 0.55);
    } else if (allySynergyScore !== null) {
      overallScore = Math.round(baselineWinRate * 0.55 + allySynergyScore * 0.45);
    }


    // Small bonus for hero experience/confidence (up to +3 for 30+ games)
    if (totalGamesPiloted >= 30) {
      overallScore = Math.min(100, overallScore + 2);
    }

    // 4. Generate human-readable primary reason
    let primaryReason = '';
    const strongCounters = enemyDetails.filter((e) => e.advantage >= 15);
    const hardCountered = enemyDetails.filter((e) => e.advantage <= -15);
    const strongSynergies = allyDetails.filter((a) => a.synergy >= 15);

    if (strongCounters.length > 0 && strongSynergies.length > 0) {
      primaryReason = `Counters ${strongCounters[0].enemyHeroName} (${strongCounters[0].winRate}% WR) & synergizes with ${strongSynergies[0].allyHeroName} (${strongSynergies[0].winRate}% WR)`;
    } else if (strongCounters.length > 0) {
      primaryReason = `Strong counter against ${strongCounters.map((c) => c.enemyHeroName).join(', ')}`;
    } else if (hardCountered.length > 0) {
      primaryReason = `Caution: Countered by ${hardCountered.map((c) => c.enemyHeroName).join(', ')}`;
    } else if (strongSynergies.length > 0) {
      primaryReason = `High synergy alongside ${strongSynergies.map((s) => s.allyHeroName).join(', ')}`;
    } else if (totalGamesPiloted > 0) {
      primaryReason = `${baselineWinRate}% historical personal win rate over ${totalGamesPiloted} games`;
    } else {
      primaryReason = 'No match';
    }

    if (primaryReason != 'No match') {
      recommendations.push({
        heroId: hero.id,
        hero,
        overallScore,
        baselineWinRate,
        totalGamesPiloted,
        enemyMatchupScore,
        enemyDetails,
        allySynergyScore,
        allyDetails,
        primaryReason,
      });
    }
  }

  // Sort descending by overall score, then by experience
  recommendations.sort((a, b) => {
    if (b.overallScore !== a.overallScore) {
      return b.overallScore - a.overallScore;
    }
    return b.totalGamesPiloted - a.totalGamesPiloted;
  });

  return recommendations;
}


/* ==========================================================================
   LANE MATCHUP TRACKING & METRICS
   ========================================================================== */

export interface LaneDistributionStat {
  lane: 'yellow' | 'blue' | 'green';
  matches: number;
  wins: number;
  losses: number;
  cancels: number;
  winRate: number; // 0-100 percentage
  laneWins: number;
  laneLosses: number;
  laneEvens: number;
}

export interface LaneOutcomeConversion {
  outcome: 'won' | 'lost' | 'even';
  matches: number;
  gameWins: number;
  gameLosses: number;
  conversionWinRate: number; // win rate when achieving this lane outcome
}

export interface DirectLaneOpponentStat {
  opponentHeroId: number;
  opponentHero: Hero | undefined;
  lanesFaced: number;
  laneWins: number;
  laneLosses: number;
  laneEvens: number;
  laneWinRate: number; // (laneWins / (laneWins + laneLosses)) * 100
  gameWins: number;
  gameLosses: number;
  gameWinRate: number; // match winrate against this lane opponent
}

export interface DirectLaneAllyStat {
  allyHeroId: number;
  allyHero: Hero | undefined;
  lanesTogether: number;
  laneWins: number;
  laneLosses: number;
  laneEvens: number;
  laneWinRate: number;
  gameWins: number;
  gameLosses: number;
  gameWinRate: number;
}

export interface LaneAnalyticsSummary {
  totalLaneTrackedMatches: number;
  lanes: Record<'yellow' | 'blue' | 'green', LaneDistributionStat>;
  outcomes: Record<'won' | 'lost' | 'even', LaneOutcomeConversion>;
  opponents: DirectLaneOpponentStat[];
  allies: DirectLaneAllyStat[];
}

/**
 * Computes lane-specific metrics across 3 lanes (Yellow, Blue, Green).
 * Gracefully ignores matches without lane data for 100% backwards-compatibility.
 */
export function calculateLaneAnalytics(
  matches: Match[],
  playerHeroId: number | null = null
): LaneAnalyticsSummary {
  const filtered = playerHeroId !== null
    ? matches.filter((m) => m.myHeroId === playerHeroId)
    : matches;

  const lanesMap: Record<'yellow' | 'blue' | 'green', LaneDistributionStat> = {
    yellow: { lane: 'yellow', matches: 0, wins: 0, losses: 0, cancels: 0, winRate: 0, laneWins: 0, laneLosses: 0, laneEvens: 0 },
    blue: { lane: 'blue', matches: 0, wins: 0, losses: 0, cancels: 0, winRate: 0, laneWins: 0, laneLosses: 0, laneEvens: 0 },
    green: { lane: 'green', matches: 0, wins: 0, losses: 0, cancels: 0, winRate: 0, laneWins: 0, laneLosses: 0, laneEvens: 0 },
  };

  const outcomesMap: Record<'won' | 'lost' | 'even', LaneOutcomeConversion> = {
    won: { outcome: 'won', matches: 0, gameWins: 0, gameLosses: 0, conversionWinRate: 0 },
    lost: { outcome: 'lost', matches: 0, gameWins: 0, gameLosses: 0, conversionWinRate: 0 },
    even: { outcome: 'even', matches: 0, gameWins: 0, gameLosses: 0, conversionWinRate: 0 },
  };

  const opponentMap = new Map<number, { faced: number; lWins: number; lLosses: number; lEvens: number; gWins: number; gLosses: number }>();
  const allyMap = new Map<number, { together: number; lWins: number; lLosses: number; lEvens: number; gWins: number; gLosses: number }>();

  let trackedCount = 0;

  for (const m of filtered) {
    if (!m.lane) continue; // match has no lane data yet
    trackedCount += 1;

    // 1. Lane breakdown
    const laneStat = lanesMap[m.lane];
    if (laneStat) {
      laneStat.matches += 1;
      if (m.result === 'win') laneStat.wins += 1;
      else if (m.result === 'loss') laneStat.losses += 1;
      else if (m.result === 'cancel') laneStat.cancels += 1;

      if (m.laneOutcome === 'won') laneStat.laneWins += 1;
      else if (m.laneOutcome === 'lost') laneStat.laneLosses += 1;
      else if (m.laneOutcome === 'even') laneStat.laneEvens += 1;
    }

    // 2. Lane outcome to game win conversion
    if (m.laneOutcome) {
      const outcomeStat = outcomesMap[m.laneOutcome];
      if (outcomeStat) {
        outcomeStat.matches += 1;
        if (m.result === 'win') outcomeStat.gameWins += 1;
        else if (m.result === 'loss') outcomeStat.gameLosses += 1;
      }
    }

    // 3. Direct lane opponents
    if (m.laneOpponents && m.laneOpponents.length > 0) {
      for (const oppId of m.laneOpponents) {
        const cur = opponentMap.get(oppId) || { faced: 0, lWins: 0, lLosses: 0, lEvens: 0, gWins: 0, gLosses: 0 };
        cur.faced += 1;
        if (m.laneOutcome === 'won') cur.lWins += 1;
        else if (m.laneOutcome === 'lost') cur.lLosses += 1;
        else if (m.laneOutcome === 'even') cur.lEvens += 1;

        if (m.result === 'win') cur.gWins += 1;
        else if (m.result === 'loss') cur.gLosses += 1;
        opponentMap.set(oppId, cur);
      }
    }

    // 4. Direct lane partner ally
    if (m.laneAllyId) {
      const cur = allyMap.get(m.laneAllyId) || { together: 0, lWins: 0, lLosses: 0, lEvens: 0, gWins: 0, gLosses: 0 };
      cur.together += 1;
      if (m.laneOutcome === 'won') cur.lWins += 1;
      else if (m.laneOutcome === 'lost') cur.lLosses += 1;
      else if (m.laneOutcome === 'even') cur.lEvens += 1;

      if (m.result === 'win') cur.gWins += 1;
      else if (m.result === 'loss') cur.gLosses += 1;
      allyMap.set(m.laneAllyId, cur);
    }
  }

  // Calculate percentages for lanes
  (['yellow', 'blue', 'green'] as const).forEach((color) => {
    const l = lanesMap[color];
    const decided = l.wins + l.losses;
    l.winRate = decided > 0 ? Math.round((l.wins / decided) * 100) : 0;
  });

  // Calculate conversion rates
  (['won', 'lost', 'even'] as const).forEach((out) => {
    const o = outcomesMap[out];
    const decided = o.gameWins + o.gameLosses;
    o.conversionWinRate = decided > 0 ? Math.round((o.gameWins / decided) * 100) : 0;
  });

  // Opponents list
  const opponents: DirectLaneOpponentStat[] = [];
  for (const [oppId, stat] of opponentMap.entries()) {
    const lDecided = stat.lWins + stat.lLosses;
    const laneWinRate = lDecided > 0 ? Math.round((stat.lWins / lDecided) * 100) : 0;
    const gDecided = stat.gWins + stat.gLosses;
    const gameWinRate = gDecided > 0 ? Math.round((stat.gWins / gDecided) * 100) : 0;
    opponents.push({
      opponentHeroId: oppId,
      opponentHero: getHeroById(oppId),
      lanesFaced: stat.faced,
      laneWins: stat.lWins,
      laneLosses: stat.lLosses,
      laneEvens: stat.lEvens,
      laneWinRate,
      gameWins: stat.gWins,
      gameLosses: stat.gLosses,
      gameWinRate,
    });
  }
  opponents.sort((a, b) => b.lanesFaced - a.lanesFaced);

  // Allies list
  const allies: DirectLaneAllyStat[] = [];
  for (const [allyId, stat] of allyMap.entries()) {
    const lDecided = stat.lWins + stat.lLosses;
    const laneWinRate = lDecided > 0 ? Math.round((stat.lWins / lDecided) * 100) : 0;
    const gDecided = stat.gWins + stat.gLosses;
    const gameWinRate = gDecided > 0 ? Math.round((stat.gWins / gDecided) * 100) : 0;
    allies.push({
      allyHeroId: allyId,
      allyHero: getHeroById(allyId),
      lanesTogether: stat.together,
      laneWins: stat.lWins,
      laneLosses: stat.lLosses,
      laneEvens: stat.lEvens,
      laneWinRate,
      gameWins: stat.gWins,
      gameLosses: stat.gLosses,
      gameWinRate,
    });
  }
  allies.sort((a, b) => b.lanesTogether - a.lanesTogether);

  return {
    totalLaneTrackedMatches: trackedCount,
    lanes: lanesMap,
    outcomes: outcomesMap,
    opponents,
    allies,
  };
}


