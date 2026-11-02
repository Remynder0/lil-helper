import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import 'echarts-liquidfill';
import { BaseVialGaugeProps } from './types';
import { DISTRICT_VESSEL_THEMES } from './vialDistrictThemes';

export const EChartsVialGauge: React.FC<BaseVialGaugeProps> = ({
  laneKey,
  stat,
  hoveredOutcome,
  onHoverOutcome,
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  const totalOutcomes = stat.laneWins + stat.laneEvens + stat.laneLosses;
  const winPct = totalOutcomes > 0 ? Math.round((stat.laneWins / totalOutcomes) * 100) : 0;
  const evenPct = totalOutcomes > 0 ? Math.round((stat.laneEvens / totalOutcomes) * 100) : 0;
  const lossPct = totalOutcomes > 0 ? Math.max(0, 100 - winPct - evenPct) : 0;

  const currentTheme = DISTRICT_VESSEL_THEMES[laneKey];

  // Geometry for interactive hover zones matching the ECharts liquid levels
  const liquidGeometry = {
    yellow: { topY: 14, height: 170 },
    blue: { topY: 16, height: 156 },
    green: { topY: 16, height: 168 },
  }[laneKey];

  const usableLiquidHeight = liquidGeometry.height;
  const liquidTopY = liquidGeometry.topY;

  const wonHeightPx = totalOutcomes > 0 ? (stat.laneWins / totalOutcomes) * usableLiquidHeight : 0;
  const evenHeightPx = totalOutcomes > 0 ? (stat.laneEvens / totalOutcomes) * usableLiquidHeight : 0;
  const lostHeightPx = Math.max(0, usableLiquidHeight - wonHeightPx - evenHeightPx);

  const yWon = liquidTopY;
  const yEven = liquidTopY + wonHeightPx;
  const yLost = yEven + evenHeightPx;

  useEffect(() => {
    if (!chartRef.current) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current, undefined, {
        renderer: 'svg',
      });
    }

    const chart = chartInstance.current;

    // ── SOLID OPAQUE COLORS BY HOVER STATE (PREVENTS BACKGROUND ALPHA BLEED-THROUGH) ──
    let currentWinColor = '#10b981';
    let currentEvenColor = '#eab308';
    let currentLossColor = '#f43f5e';

    if (hoveredOutcome === 'won') {
      currentWinColor = '#34d399';
      currentEvenColor = '#452b0d';
      currentLossColor = '#4a0d1b';
    } else if (hoveredOutcome === 'even') {
      currentWinColor = '#064e3b';
      currentEvenColor = '#fde047';
      currentLossColor = '#4a0d1b';
    } else if (hoveredOutcome === 'lost') {
      currentWinColor = '#064e3b';
      currentEvenColor = '#452b0d';
      currentLossColor = '#fb7185';
    }

    if (totalOutcomes === 0) {
      // Empty flask
      const emptyOption: echarts.EChartsOption = {
        series: [
          {
            type: 'liquidFill',
            data: [0.0],
            shape: currentTheme.vialPath,
            radius: '196px',
            center: ['50%', '50%'],
            waveAnimation: false,
            silent: true,
            backgroundStyle: {
              color: '#090807',
              borderColor: 'transparent',
              borderWidth: 0,
            },
            outline: {
              show: true,
              borderDistance: 0,
              itemStyle: {
                borderColor: currentTheme.outlineColor,
                borderWidth: 2,
                shadowBlur: 8,
                shadowColor: currentTheme.glowColor,
              },
            },
            label: {
              show: true,
              formatter: () => 'Empty',
              fontSize: 10,
              color: '#78716c',
              fontStyle: 'italic',
            },
          } as unknown as echarts.SeriesOption,
        ],
      };
      chart.setOption(emptyOption, true);
      return;
    }

    // Cumulative fraction heights (100% full liquid)
    const cumulativeLostFraction = lossPct / 100;
    const cumulativeEvenFraction = (lossPct + evenPct) / 100;
    const cumulativeTotalFraction = 1.0;

    const seriesData: unknown[] = [];

    // 1. LAYER 1: Full flask height (Wins on TOP)
    if (winPct > 0) {
      seriesData.push({
        value: cumulativeTotalFraction,
        direction: 'right',
        waveLength: '85%',
        amplitude: 2.2,
        period: 2600,
        itemStyle: {
          color: currentWinColor,
          opacity: 1.0,
        },
      });
    }

    // 2. LAYER 2: Even outcomes (MIDDLE)
    if (evenPct > 0 || lossPct > 0) {
      seriesData.push({
        value: cumulativeEvenFraction,
        direction: 'left',
        waveLength: '90%',
        amplitude: 2.5,
        period: 2900,
        itemStyle: {
          color: currentEvenColor,
          opacity: 1.0,
        },
      });
    }

    // 3. LAYER 3: Losses (BOTTOM)
    if (lossPct > 0) {
      seriesData.push({
        value: cumulativeLostFraction,
        direction: 'right',
        waveLength: '80%',
        amplitude: 2.0,
        period: 2400,
        itemStyle: {
          color: currentLossColor,
          opacity: 1.0,
        },
      });
    }

    const option: echarts.EChartsOption = {
      series: [
        {
          type: 'liquidFill',
          data: seriesData,
          shape: currentTheme.vialPath,
          radius: '196px',
          center: ['50%', '50%'],
          waveAnimation: true,
          silent: true,
          backgroundStyle: {
            color: '#100e0b',
            borderColor: 'transparent',
            borderWidth: 0,
          },
          outline: {
            show: true,
            borderDistance: 0,
            itemStyle: {
              borderColor: currentTheme.outlineColor,
              borderWidth: 2,
              shadowBlur: 10,
              shadowColor: currentTheme.glowColor,
            },
          },
          label: {
            show: false,
          },
        } as unknown as echarts.SeriesOption,
      ],
    };

    chart.setOption(option, true);
  }, [
    laneKey,
    stat,
    totalOutcomes,
    winPct,
    evenPct,
    lossPct,
    hoveredOutcome,
    currentTheme,
  ]);

  useEffect(() => {
    return () => {
      chartInstance.current?.dispose();
      chartInstance.current = null;
    };
  }, []);

  const fullTooltip = `${stat.matches} matches:\n• Won (Top): ${stat.laneWins} (${winPct}%)\n• Even (Middle): ${stat.laneEvens} (${evenPct}%)\n• Lost (Bottom): ${stat.laneLosses} (${lossPct}%)`;

  return (
    <div
      className="relative flex flex-col items-center select-none group cursor-pointer"
      title={fullTooltip}
    >

      {/* Main Container for ECharts Canvas + SVG Thematic District Overlay */}
      <div
        className="relative overflow-visible transition-transform duration-300 group-hover:scale-[1.02]"
        style={{ width: 88, height: 208 }}
        onMouseLeave={() => onHoverOutcome(null)}
      >
        {/* Underlying ECharts Canvas: Animated LiquidFill Waves */}
        <div
          ref={chartRef}
          style={{ width: 88, height: 208 }}
          className="relative"
        />

        {/* Thematic District SVG Architectural Overlay */}
        {currentTheme.renderOverlay(88, 208)}

        {/* Interactive Hover Hit-Test Zones for Win, Even, Loss */}
        {totalOutcomes > 0 && (
          <svg
            width={88}
            height={208}
            viewBox="0 0 88 208"
            className="absolute inset-0 z-20 overflow-visible select-none pointer-events-auto"
            onMouseLeave={() => onHoverOutcome(null)}
          >
            <defs>
              <clipPath id={`interactive-vial-clip-${laneKey}`}>
                <path d={currentTheme.vialPath.replace('path://', '')} />
              </clipPath>
            </defs>
            <g clipPath={`url(#interactive-vial-clip-${laneKey})`}>
              {wonHeightPx > 0 && (
                <rect
                  x="0"
                  y={yWon}
                  width="88"
                  height={wonHeightPx}
                  fill="white"
                  opacity="0"
                  style={{ pointerEvents: 'all', cursor: 'pointer' }}
                  onMouseEnter={() => onHoverOutcome('won')}
                  onMouseLeave={() => onHoverOutcome(null)}
                >
                  <title>{`Lane Won: ${stat.laneWins} games (${winPct}%) [+2 pts]`}</title>
                </rect>
              )}
              {evenHeightPx > 0 && (
                <rect
                  x="0"
                  y={yEven}
                  width="88"
                  height={evenHeightPx}
                  fill="white"
                  opacity="0"
                  style={{ pointerEvents: 'all', cursor: 'pointer' }}
                  onMouseEnter={() => onHoverOutcome('even')}
                  onMouseLeave={() => onHoverOutcome(null)}
                >
                  <title>{`Lane Even: ${stat.laneEvens} games (${evenPct}%) [+1 pt]`}</title>
                </rect>
              )}
              {lostHeightPx > 0 && (
                <rect
                  x="0"
                  y={yLost}
                  width="88"
                  height={lostHeightPx}
                  fill="white"
                  opacity="0"
                  style={{ pointerEvents: 'all', cursor: 'pointer' }}
                  onMouseEnter={() => onHoverOutcome('lost')}
                  onMouseLeave={() => onHoverOutcome(null)}
                >
                  <title>{`Lane Lost: ${stat.laneLosses} games (${lossPct}%) [-2 pts]`}</title>
                </rect>
              )}
            </g>
          </svg>
        )}
      </div>

     
    </div>
  );
};
