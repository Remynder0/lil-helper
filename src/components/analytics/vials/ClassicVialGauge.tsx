import React from 'react';
import { BaseVialGaugeProps } from './types';

export const ClassicVialGauge: React.FC<BaseVialGaugeProps> = ({
  laneKey,
  stat,
  hoveredOutcome,
  onHoverOutcome,
}) => {
  const totalOutcomes = stat.laneWins + stat.laneEvens + stat.laneLosses;
  const winPct = totalOutcomes > 0 ? Math.round((stat.laneWins / totalOutcomes) * 100) : 0;
  const evenPct = totalOutcomes > 0 ? Math.round((stat.laneEvens / totalOutcomes) * 100) : 0;
  const lossPct = totalOutcomes > 0 ? Math.max(0, 100 - winPct - evenPct) : 0;

  // SVG Vial Interior Geometry:
  // Flask interior is between y = 16 (top rim) and y = 190 (bottom curve center y=172 + radius 18).
  // Total usable liquid height is exactly 174px (100% full liquid when matches exist).
  const usableLiquidHeight = 174;
  const liquidTopY = 16;

  // Layer heights: WIN on TOP, EVEN in MIDDLE, LOSS at BOTTOM
  const wonHeightPx = totalOutcomes > 0 ? (stat.laneWins / totalOutcomes) * usableLiquidHeight : 0;
  const evenHeightPx = totalOutcomes > 0 ? (stat.laneEvens / totalOutcomes) * usableLiquidHeight : 0;
  const lostHeightPx = usableLiquidHeight - wonHeightPx - evenHeightPx;

  // Vertical offsets from top to bottom
  const yWon = liquidTopY;
  const yEven = liquidTopY + wonHeightPx;
  const yLost = yEven + evenHeightPx;

  const fullTooltip = `Lane Outcomes (${totalOutcomes} total):\n• Won (Top): ${stat.laneWins} (${winPct}%)\n• Even (Middle): ${stat.laneEvens} (${evenPct}%)\n• Lost (Bottom): ${stat.laneLosses} (${lossPct}%)`;

  return (
    <div className="relative group cursor-pointer" title={fullTooltip}>
      <svg
        width="64"
        height="204"
        viewBox="0 0 64 204"
        className="overflow-visible drop-shadow-md select-none transition-transform duration-300 group-hover:scale-[1.02]"
      >
        <defs>
          {/* Clip path defining the interior cavity of the glass flask */}
          <clipPath id={`vial-cavity-${laneKey}`}>
            <path d="M 14 14 L 14 172 A 18 18 0 0 0 50 172 L 50 14 Z" />
          </clipPath>

          {/* Gradients for the 3 distinct fluid layers */}
          <linearGradient id={`fluid-won-${laneKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#047857" />
          </linearGradient>

          <linearGradient id={`fluid-even-${laneKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fde047" />
            <stop offset="100%" stopColor="#d97706" />
          </linearGradient>

          <linearGradient id={`fluid-lost-${laneKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fb7185" />
            <stop offset="100%" stopColor="#9f1239" />
          </linearGradient>
        </defs>

        {/* 1. Empty flask dark interior background */}
        <path
          d="M 14 14 L 14 172 A 18 18 0 0 0 50 172 L 50 14 Z"
          fill="#14110e"
          stroke="#26211b"
          strokeWidth="1"
        />

        {/* 2. Full Liquid Contents (clipped to flask interior) */}
        {stat.matches > 0 && totalOutcomes > 0 ? (
          <g clipPath={`url(#vial-cavity-${laneKey})`}>
            {/* Green / Won Fluid (TOP) */}
            {wonHeightPx > 0 && (
              <rect
                x="10"
                y={yWon}
                width="44"
                height={wonHeightPx + (evenHeightPx > 0 || lostHeightPx > 0 ? 0.5 : 2)}
                fill={`url(#fluid-won-${laneKey})`}
                className={`transition-all duration-200 cursor-pointer ${
                  hoveredOutcome === 'won'
                    ? 'brightness-125 filter drop-shadow'
                    : hoveredOutcome !== null
                    ? 'opacity-65'
                    : 'hover:brightness-110'
                }`}
                onMouseEnter={() => onHoverOutcome('won')}
                onMouseLeave={() => onHoverOutcome(null)}
              >
                <title>{`Lane Won: ${stat.laneWins} games (${winPct}%) [+2 pts]`}</title>
              </rect>
            )}

            {/* Amber-Yellow / Even Fluid (MIDDLE) */}
            {evenHeightPx > 0 && (
              <rect
                x="10"
                y={yEven}
                width="44"
                height={evenHeightPx + (lostHeightPx > 0 ? 0.5 : 2)}
                fill={`url(#fluid-even-${laneKey})`}
                className={`transition-all duration-200 cursor-pointer ${
                  hoveredOutcome === 'even'
                    ? 'brightness-125 filter drop-shadow'
                    : hoveredOutcome !== null
                    ? 'opacity-65'
                    : 'hover:brightness-110'
                }`}
                onMouseEnter={() => onHoverOutcome('even')}
                onMouseLeave={() => onHoverOutcome(null)}
              >
                <title>{`Lane Even: ${stat.laneEvens} games (${evenPct}%) [+1 pt]`}</title>
              </rect>
            )}

            {/* Crimson / Lost Fluid (BOTTOM) */}
            {lostHeightPx > 0 && (
              <rect
                x="10"
                y={yLost}
                width="44"
                height={lostHeightPx + 4}
                fill={`url(#fluid-lost-${laneKey})`}
                className={`transition-all duration-200 cursor-pointer ${
                  hoveredOutcome === 'lost'
                    ? 'brightness-125 filter drop-shadow'
                    : hoveredOutcome !== null
                    ? 'opacity-65'
                    : 'hover:brightness-110'
                }`}
                onMouseEnter={() => onHoverOutcome('lost')}
                onMouseLeave={() => onHoverOutcome(null)}
              >
                <title>{`Lane Lost: ${stat.laneLosses} games (${lossPct}%) [-2 pts]`}</title>
              </rect>
            )}

            {/* Glowing meniscus line at the fluid surface (top) */}
            <path
              d="M 14 16 Q 32 13.5, 50 16 L 50 19 L 14 19 Z"
              fill="rgba(255, 255, 255, 0.45)"
            />
            <line
              x1="14"
              y1={liquidTopY}
              x2="50"
              y2={liquidTopY}
              stroke="rgba(255, 255, 255, 0.85)"
              strokeWidth="1.5"
            />
          </g>
        ) : (
          <text
            x="32"
            y="105"
            textAnchor="middle"
            fill="#8b8273"
            fontSize="10"
            fontStyle="italic"
          >
            Empty
          </text>
        )}

        {/* 3. Calibration / Measurement Tick Marks */}
        <line x1="44" y1="58" x2="50" y2="58" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
        <line x1="41" y1="102" x2="50" y2="102" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" />
        <line x1="44" y1="146" x2="50" y2="146" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />

        {/* 4. Glass tube contour & rim */}
        <path
          d="M 14 14 L 14 172 A 18 18 0 0 0 50 172 L 50 14 Z"
          fill="none"
          stroke="#4d4233"
          strokeWidth="2.5"
        />

        {/* Beveled top flask mouth */}
        <rect
          x="11"
          y="10"
          width="42"
          height="4.5"
          rx="2"
          fill="#1c1814"
          stroke="#5a4e3c"
          strokeWidth="1.5"
        />

        {/* 5. Glass Specular Glare Highlights */}
        {/* Left main curved reflection highlight */}
        <path
          d="M 18 18 L 18 166 A 14 14 0 0 0 25 183"
          fill="none"
          stroke="rgba(255, 255, 255, 0.3)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        {/* Right subtle secondary highlight */}
        <path
          d="M 47 24 L 47 160"
          fill="none"
          stroke="rgba(255, 255, 255, 0.12)"
          strokeWidth="1"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
};
