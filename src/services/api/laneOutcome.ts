import { LaneColor, LaneOutcome } from '../../types/match';
import type { RawMatchPlayerMetadata, RawMatchObjective } from './deadlockApi';

/**
 * Maps Deadlock raw assigned_lane integer to our app's `LaneColor`:
 * 1 = Yellow, 4 = Blue, 6 = Green
 * Exported so it can be reused by the .dem parser path.
 */
export function mapRawLaneToLaneColor(rawLane?: number): LaneColor | undefined {
  if (rawLane === 1) return 'yellow';
  if (rawLane === 4) return 'blue';
  if (rawLane === 6) return 'green';
  return undefined;
}

/**
 * Maps Source 2 objective ID to assigned lane:
 * 1 = Yellow, 4 = Blue, 3 = Green
 */
export function mapObjectiveToRawLane(objectiveId: number): number | null {
  if (objectiveId === 1) return 1;
  if (objectiveId === 4) return 4;
  if (objectiveId === 3) return 6;
  return null;
}

/**
 * Source-agnostic input for lane outcome calculation.
 * Can be populated from API net_worth stats OR from .dem m_unNetWorth at tick ~720s.
 */
export interface LaneNWSample {
  myLaneSouls: number;
  enemyLaneSouls: number;
}

export interface GuardianTiming {
  myGuardianDestroyedAt?: number;
  enemyGuardianDestroyedAt?: number;
}

/**
 * Pure lane outcome calculation — source agnostic (works for API and .dem).
 * Rules:
 * - Soul difference >= 5000: sufficient on its own (won / lost)
 * - Guardian destroyed >= 4 minutes (240s) before enemy/own: sufficient on its own (won / lost)
 * - Soul difference >= 3000 AND >= 2 minutes (120s) guardian advance: won / lost
 * - Otherwise: even
 * Returns undefined if no soul data available.
 */
export function computeLaneOutcome(
  nwSample: LaneNWSample,
  guardians?: GuardianTiming
): LaneOutcome | undefined {
  const { myLaneSouls, enemyLaneSouls } = nwSample;

  if (myLaneSouls === 0 && enemyLaneSouls === 0) return undefined;

  const soulDiff = myLaneSouls - enemyLaneSouls;

  const myGuardianDeathTime = guardians?.myGuardianDestroyedAt ?? 99999;
  const enemyGuardianDeathTime = guardians?.enemyGuardianDestroyedAt ?? 99999;
  // Positive if enemy guardian died before ours (we took down their guardian earlier)
  const guardianTimeAdvantage = myGuardianDeathTime - enemyGuardianDeathTime;

  // Rule 1: 5000 soul difference is sufficient on its own
  if (soulDiff >= 5000) return 'won';
  if (soulDiff <= -5000) return 'lost';

  // Rule 2: >= 4 minutes (240s) guardian difference is notable on its own
  if (guardianTimeAdvantage >= 240) return 'won';
  if (guardianTimeAdvantage <= -240) return 'lost';

  // Rule 3: >= 3000 soul difference AND >= 2 minutes (120s) guardian advantage
  if (soulDiff >= 3000 && guardianTimeAdvantage >= 120) return 'won';
  if (soulDiff <= -3000 && guardianTimeAdvantage <= -120) return 'lost';

  return 'even';
}

/**
 * Calculates lane outcome at 12 minutes (time_stamp_s === 720, or fallback to 540 if unavailable).
 * Wraps computeLaneOutcome with API-specific data extraction.
 */
export function calculateLaneOutcome(
  players: RawMatchPlayerMetadata[],
  objectives: RawMatchObjective[] | undefined,
  myLane: number,
  myTeam: number
): LaneOutcome | undefined {
  const enemyTeam = myTeam === 0 ? 1 : myTeam === 1 ? 0 : myTeam === 2 ? 3 : 2;

  const myDuo = players.filter((p) => p.team === myTeam && p.assigned_lane === myLane);
  const enemyDuo = players.filter((p) => p.team === enemyTeam && p.assigned_lane === myLane);

  // Preferred timestamp: 12 minutes (720s). Fallback to 9 minutes (540s) for shorter games.
  const targetTime = 720;
  const fallbackTime = 540;

  let myNW = myDuo.reduce(
    (sum, p) => sum + (p.stats?.find((s) => s.time_stamp_s === targetTime)?.net_worth || 0),
    0
  );
  let enemyNW = enemyDuo.reduce(
    (sum, p) => sum + (p.stats?.find((s) => s.time_stamp_s === targetTime)?.net_worth || 0),
    0
  );

  if (myNW === 0 && enemyNW === 0) {
    myNW = myDuo.reduce(
      (sum, p) => sum + (p.stats?.find((s) => s.time_stamp_s === fallbackTime)?.net_worth || 0),
      0
    );
    enemyNW = enemyDuo.reduce(
      (sum, p) => sum + (p.stats?.find((s) => s.time_stamp_s === fallbackTime)?.net_worth || 0),
      0
    );
  }

  const myGuardian = objectives?.find(
    (o) => o.team === myTeam && mapObjectiveToRawLane(o.team_objective_id) === myLane && o.destroyed_time_s > 0
  );
  const enemyGuardian = objectives?.find(
    (o) => o.team === enemyTeam && mapObjectiveToRawLane(o.team_objective_id) === myLane && o.destroyed_time_s > 0
  );

  return computeLaneOutcome(
    { myLaneSouls: myNW, enemyLaneSouls: enemyNW },
    {
      myGuardianDestroyedAt: myGuardian?.destroyed_time_s,
      enemyGuardianDestroyedAt: enemyGuardian?.destroyed_time_s,
    }
  );
}
