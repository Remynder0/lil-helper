import { Hero } from '../../data/heroes';

/* ==========================================================================
   GLOBAL STATISTICS & HERO PERFORMANCE TYPES
   ========================================================================== */

export interface StreakDetail {
  count: number;
  startDate?: string;
  endDate?: string;
  matchIds: string[];
}

export interface GlobalStats {
  totalMatches: number;
  totalWins: number;
  totalLosses: number;
  totalCancels: number;
  winRate: number; // 0-100 percentage excluding cancels
  bestWinStreak: StreakDetail;
  worstLoseStreak: StreakDetail;
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
  isRepresentative?: boolean;
  threshold?: number;
}

export interface FamiliarFaceStat {
  heroId: number;
  hero: Hero | undefined;
  appearances: number;
  asAlly: number;
  asEnemy: number;
  presenceRate: number; // 0-100 percentage
  wins: number;
  losses: number;
  winRate: number; // 0-100 percentage
  isRepresentative?: boolean;
  threshold?: number;
}

/* ==========================================================================
   ENEMY MATCHUP & ALLY SYNERGY TYPES
   ========================================================================== */

export interface EnemyMatchupStat {
  enemyHeroId: number;
  enemyHero: Hero | undefined;
  matchesAgainst: number;
  wins: number;
  losses: number;
  cancels: number;
  winRate: number; // 0-100 percentage
  isRepresentative?: boolean;
  threshold?: number;
}

export interface AllySynergyStat {
  allyHeroId: number;
  allyHero: Hero | undefined;
  matchesWith: number;
  wins: number;
  losses: number;
  cancels: number;
  winRate: number; // 0-100 percentage
  isRepresentative?: boolean;
  threshold?: number;
}

/* ==========================================================================
   DRAFT RECOMMENDATION TYPES
   ========================================================================== */

export interface HeroDraftRecommendation {
  heroId: number;
  hero: Hero | undefined;
  /** Composite score: higher means better pick recommendation */
  overallScore: number;
  /** Historical baseline win rate when piloting this hero (0-100) */
  baselineWinRate: number;
  totalGamesPiloted: number;
  isRepresentative?: boolean;
  threshold?: number;
  /** Average win rate against the current selected enemy draft */
  enemyMatchupScore: number | null;
  /** Explanations of matchups against picked enemies */
  enemyDetails: {
    enemyHeroId: number;
    enemyHeroName: string;
    winRate: number;
    matches: number;
    advantage: number; // positive = counters enemy, negative = countered by enemy
    isRepresentative?: boolean;
  }[];
  /** Average win rate alongside the current selected ally draft */
  allySynergyScore: number | null;
  /** Explanations of synergies with picked allies */
  allyDetails: {
    allyHeroId: number;
    allyHeroName: string;
    winRate: number;
    matches: number;
    synergy: number; // positive = strong combo with ally, negative = poor combo
    isRepresentative?: boolean;
  }[];
  /** Main reason summary (e.g. "Counters Bebop & Haze (+15% WR), strong with Dynamo") */
  primaryReason: string;
}

/* ==========================================================================
   LANE ANALYTICS TYPES
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
  isRepresentative?: boolean;
  threshold?: number;
}

export interface DirectLaneAllyStat {
  allyHeroId: number;
  allyHero: Hero | undefined;
  lanesTogether: number;
  laneWins: number;
  laneLosses: number;
  laneEvens: number;
  laneWinRate: number; // (laneWins / (laneWins + laneLosses)) * 100
  gameWins: number;
  gameLosses: number;
  gameWinRate: number; // match winrate with this lane partner
  isRepresentative?: boolean;
  threshold?: number;
}

export interface LaneAnalyticsSummary {
  totalLaneTrackedMatches: number;
  lanes: Record<'yellow' | 'blue' | 'green', LaneDistributionStat>;
  outcomes: Record<'won' | 'lost' | 'even', LaneOutcomeConversion>;
  opponents: DirectLaneOpponentStat[];
  allies: DirectLaneAllyStat[];
}

/* ==========================================================================
   DRAFT ADVISOR TYPES
   ========================================================================== */

export interface DraftAction {
  id: string;
  type: 'stay_current' | 'switch_hero_only' | 'swap_lane_only' | 'swap_lane_and_switch_hero';
  heroId: number;
  hero: Hero | undefined;
  lane: 'yellow' | 'blue' | 'green';
  laneSwapWithAllyId: number | null; // hero you ask to swap lane with (if any)
  duoPartnerId: number | null;
  opponents: number[];
  projectedWinRate: number; // 0-100 %
  deltaVsCurrent: number; // +/- difference compared to doing nothing
  isSwapRequested: boolean; // true if this requires a teammate to accept a lane swap
  isRepresentative?: boolean;
  threshold?: number;
  title: string;
  description: string;
}

export interface BestActionsAdvisorResult {
  currentProjectedWinRate: number;
  currentHero: Hero | undefined;
  currentLane: 'yellow' | 'blue' | 'green';
  currentPartner: Hero | undefined;
  currentOpponents: Hero[];
  
  /** Option 1: Absolute highest win rate action among ALL possibilities (may include a lane swap) */
  bestOverallAction: DraftAction;
  
  /** Option 2: Best action that does NOT require any lane swap (100% in your control if teammate denies swap) */
  bestSafeActionWithoutSwap: DraftAction;
  
  /** All evaluated top actions ranked */
  allRankedActions: DraftAction[];
}
