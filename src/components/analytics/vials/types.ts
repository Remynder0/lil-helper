import { LaneDistributionStat } from '../../../services/analytics';
import { VialDisplayMode } from '../../../services/storage/userSettings';

export type OutcomeType = 'won' | 'even' | 'lost';
export type { VialDisplayMode };

export interface BaseVialGaugeProps {
  laneKey: 'yellow' | 'blue' | 'green';
  stat: LaneDistributionStat;
  hoveredOutcome: OutcomeType | null;
  onHoverOutcome: (outcome: OutcomeType | null) => void;
}

export interface LaneVialGaugeProps extends BaseVialGaugeProps {
  displayMode?: VialDisplayMode;
}
