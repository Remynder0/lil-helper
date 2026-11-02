import React from 'react';
import { Compass, Waves, FlaskConical } from 'lucide-react';
import { LaneCardConfig } from './laneTypes';
import { LaneVialCard } from './LaneVialCard';
import { VialDisplayMode, saveUserSettings } from '../../../services/storage/userSettings';

export interface LaneVialsSectionProps {
  lanesConfig: LaneCardConfig[];
  totalTrackedGames: number;
  vialDisplayMode: VialDisplayMode;
  onVialDisplayModeChange: (mode: VialDisplayMode) => void;
}

export const LaneVialsSection: React.FC<LaneVialsSectionProps> = ({
  lanesConfig,
  totalTrackedGames,
  vialDisplayMode,
  onVialDisplayModeChange,
}) => {
  const handleModeChange = (mode: VialDisplayMode) => {
    onVialDisplayModeChange(mode);
    saveUserSettings({ vialDisplayMode: mode });
  };

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-deadlock-accent" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-deadlock-steam">
            Lane Performance & Outcome Vials
          </h3>
        </div>

        {/* Display Mode Switcher: ECharts LiquidFill vs Classic Flat SVG */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-deadlock-muted hidden sm:inline">
            Vial Style:
          </span>
          <div className="flex items-center p-0.5 bg-deadlock-dark/80 rounded-lg border border-deadlock-border/60">
            <button
              type="button"
              onClick={() => handleModeChange('echarts')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                vialDisplayMode === 'echarts'
                  ? 'bg-deadlock-border text-deadlock-steam shadow-sm border border-white/20'
                  : 'text-deadlock-muted hover:text-deadlock-steam'
              }`}
              title="Animated alchemical liquid waves with custom Deadlock district themes"
            >
              <Waves className="w-3 h-3 text-sky-400" />
              <span>ECharts</span>
            </button>
            <button
              type="button"
              onClick={() => handleModeChange('classic')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                vialDisplayMode === 'classic'
                  ? 'bg-deadlock-border text-deadlock-steam shadow-sm border border-white/20'
                  : 'text-deadlock-muted hover:text-deadlock-steam'
              }`}
              title="Classic calibrated flat SVG alchemical vial gauge"
            >
              <FlaskConical className="w-3 h-3 text-emerald-400" />
              <span>Classique</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {lanesConfig.map((laneConf) => (
          <LaneVialCard
            key={laneConf.key}
            laneConfig={laneConf}
            totalTrackedGames={totalTrackedGames}
            displayMode={vialDisplayMode}
          />
        ))}
      </div>
    </div>
  );
};
