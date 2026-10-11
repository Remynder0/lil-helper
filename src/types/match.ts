export type Side = 'hidden_king' | 'archmother';
export type MatchResult = 'win' | 'loss' | 'cancel';

// Deadlock lanes: Yellow, Blue, Green (3 lanes for 6v6)
export type LaneColor = 'yellow' | 'blue' | 'green';
export type LaneOutcome = 'won' | 'lost' | 'even';

export const LANE_LABELS: Record<LaneColor, string> = {
  yellow: 'Yellow Lane',
  blue: 'Blue Lane',
  green: 'Green Lane',
};

export const LANE_OUTCOME_LABELS: Record<LaneOutcome, string> = {
  won: 'Lane Won',
  lost: 'Lane Lost',
  even: 'Lane Even',
};

export const RESULT_LABELS: Record<MatchResult, string> = {
  win: 'Victory',
  loss: 'Defeat',
  cancel: 'Cancelled',
};

export const SIDE_LABELS: Record<Side, string> = {
  hidden_king: 'The Hidden King',
  archmother: 'The Archmother',
};

export interface ConnectedProfile {
  accountId: number;
  personaName: string;
  avatarUrl?: string;
  profileUrl?: string;
  lastSyncedAt?: string;
}

export interface Match {
  id: string;
  matchId?: number; // External Deadlock match ID from API
  date: string; // ISO string
  side: Side;
  myHeroId: number;
  allies: number[]; // exactly 5 hero IDs
  enemies: number[]; // exactly 6 hero IDs
  result: MatchResult;
  notes?: string;

  // Duration tracking
  durationSeconds?: number;

  // Lane matchup tracking - Optional for backwards compatibility
  lane?: LaneColor;
  laneAllyId?: number; // 1 ally on your duo lane
  laneOpponents?: number[]; // 1 or 2 enemies on your duo lane
  laneOutcome?: LaneOutcome;
  playerSlot?: number; // 1-indexed (1 to 6) draft slot in the team

  // Ranked progression tracking - Auto-retrieved from Deadlock API
  rankedBadge?: number | null; // e.g. 13 (badge code)
  rankedRank?: number | null; // e.g. 1 (Initiate)
  rankedSubrank?: number | null; // e.g. 3 (III)
  rankedDelta?: number | null; // e.g. +300, -300 points gained/lost
  rankedProgress?: number | null; // final flat progress (1000 pts per subrank)
  rankedInitialProgress?: number | null; // initial flat progress before match
  rankedDemotionProtection?: number | null; // number of demotion protection shields remaining
  rankedConsumedDemotionProtection?: boolean | null; // true if demotion protection shield was consumed this match

  // Incomplete / pending match state in history
  isIncomplete?: boolean;
  queuedMatch?: {
    matchId: number;
    detectedAt: number;
    heroId?: number | null;
    heroName?: string | null;
    status: string;
    attempts: number;
    source?: 'log' | 'manual';
    message?: string;
  };
}

export interface MatchDraftInput {
  side: Side;
  myHeroId: number | null;
  allies: number[];
  enemies: number[];
  result: MatchResult | null;
  notes?: string;

  // Lane matchup tracking - Optional
  lane?: LaneColor | null;
  laneAllyId?: number | null;
  laneOpponents?: number[];
  laneOutcome?: LaneOutcome | null;
}

export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Validates a match input before persistence:
 * - Exactly 1 played hero
 * - Exactly 5 allies
 * - Exactly 6 enemies
 * - Valid side and result
 * - Total 12 unique heroes (no duplicate hero across teams or within a team)
 */
export function validateMatchInput(input: MatchDraftInput): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!input.myHeroId) {
    errors.push({ field: 'myHeroId', message: 'You must select your played hero.' });
  }

  if (input.allies.length !== 5) {
    errors.push({ field: 'allies', message: `Allied team must have exactly 5 teammates (currently ${input.allies.length}).` });
  }

  if (input.enemies.length !== 6) {
    errors.push({ field: 'enemies', message: `Enemy team must have exactly 6 opponents (currently ${input.enemies.length}).` });
  }

  if (!input.side) {
    errors.push({ field: 'side', message: 'Side (The Hidden King or The Archmother) is required.' });
  }

  if (!input.result) {
    errors.push({ field: 'result', message: 'Match outcome (Win or Loss) is required.' });
  }

  // Check for duplicate heroes
  const allHeroIds: number[] = [];
  if (input.myHeroId) allHeroIds.push(input.myHeroId);
  allHeroIds.push(...input.allies);
  allHeroIds.push(...input.enemies);

  const duplicates = allHeroIds.filter((id, index) => allHeroIds.indexOf(id) !== index);
  if (duplicates.length > 0) {
    errors.push({ field: 'draft', message: 'A hero cannot be picked more than once in the same match.' });
  }

  return errors;
}
