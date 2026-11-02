import React, { useState, useEffect } from 'react';
import { LaneVialGaugeProps } from './types';
import { EChartsVialGauge } from './EChartsVialGauge';
import { ClassicVialGauge } from './ClassicVialGauge';
import { loadUserSettings, VialDisplayMode } from '../../../services/storage/userSettings';

export const LaneVialGauge: React.FC<LaneVialGaugeProps> = ({
  laneKey,
  stat,
  hoveredOutcome,
  onHoverOutcome,
  displayMode: propDisplayMode,
}) => {
  const [activeMode, setActiveMode] = useState<VialDisplayMode>(
    () => propDisplayMode ?? loadUserSettings().vialDisplayMode ?? 'echarts'
  );

  useEffect(() => {
    if (propDisplayMode) {
      setActiveMode(propDisplayMode);
      return;
    }

    const handleSettingsUpdate = () => {
      setActiveMode(loadUserSettings().vialDisplayMode ?? 'echarts');
    };

    window.addEventListener('deadlock_settings_updated', handleSettingsUpdate);
    return () => {
      window.removeEventListener('deadlock_settings_updated', handleSettingsUpdate);
    };
  }, [propDisplayMode]);

  if (activeMode === 'classic') {
    return (
      <ClassicVialGauge
        laneKey={laneKey}
        stat={stat}
        hoveredOutcome={hoveredOutcome}
        onHoverOutcome={onHoverOutcome}
      />
    );
  }

  return (
    <EChartsVialGauge
      laneKey={laneKey}
      stat={stat}
      hoveredOutcome={hoveredOutcome}
      onHoverOutcome={onHoverOutcome}
    />
  );
};
