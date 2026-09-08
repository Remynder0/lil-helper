export type Side = 'hidden_king' | 'archmother';
export type MatchResult = 'win' | 'loss';

export const SIDE_LABELS: Record<Side, string> = {
  hidden_king: 'The Hidden King',
  archmother: 'The Archmother',
};

export interface Match {
  id: string;
  date: string; // ISO string
  side: Side;
  myHeroId: number;
  allies: number[]; // exactly 5 hero IDs
  enemies: number[]; // exactly 6 hero IDs
  result: MatchResult;
  notes?: string;
}

export interface MatchDraftInput {
  side: Side;
  myHeroId: number | null;
  allies: number[];
  enemies: number[];
  result: MatchResult | null;
  notes?: string;
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
