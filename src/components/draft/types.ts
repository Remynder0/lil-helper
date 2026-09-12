import { LaneColor } from '../../types/match';

export type ActiveSlot =
  | { type: 'lane'; lane: LaneColor; team: 'allies' | 'enemies'; index: number }
  | { type: 'ban'; index: number };
