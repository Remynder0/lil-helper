import React from 'react';

interface GreenwichVialOverlayProps {
  width: number;
  height: number;
}

export const GreenwichVialOverlay: React.FC<GreenwichVialOverlayProps> = ({ width, height }) => {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 88 208"
      className="absolute inset-0 pointer-events-none select-none"
    >
      {/* Natural Cork Stopper (Wider, Hand-Carved Cork Oak) */}
      <polygon points="31,2 57,2 54,15 34,15" fill="#c68b59" stroke="#7c4a24" strokeWidth="1.2" />
      <ellipse cx="44" cy="2" rx="13" ry="3.2" fill="#d9a066" stroke="#8c582f" strokeWidth="1.2" />
      {/* Natural Cork Grain & Pores Texture */}
      <g opacity="0.65" stroke="#663b18" strokeWidth="0.8" strokeLinecap="round">
        <line x1="36" y1="5" x2="41" y2="5" />
        <line x1="47" y1="6" x2="52" y2="6" />
        <line x1="38" y1="8.5" x2="43" y2="8.5" />
        <line x1="45" y1="10" x2="50" y2="10" />
        <line x1="35" y1="12" x2="40" y2="12" />
        <line x1="43" y1="12.5" x2="49" y2="12.5" />
      </g>
      {/* Cork Top Soft Highlight */}
      <ellipse cx="43" cy="1.8" rx="10" ry="1.8" fill="none" stroke="rgba(255, 255, 255, 0.4)" strokeWidth="0.8" />

      {/* Clean Glass Fracture (Starting Lower on Right Edge, Continuously Ascending to 60° Upward) */}
      <g>
        {/* Dark glass refraction underlay for realism and thickness */}
        <path
          d="M 65 170 L 52 158 L 42 140"
          fill="none"
          stroke="rgba(0, 20, 10, 0.65)"
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="miter"
        />
        {/* Main sharp glass fracture */}
        <path
          d="M 65 170 L 52 158 L 42 140"
          fill="none"
          stroke="#ffffff"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="miter"
        />
      </g>

      {/* Wide Cauldron Belly Curved Glass Reflection */}
      <path
        d="M 38 28 L 38 48 C 28 65 20 90 20 124 C 20 156 26 172 36 180"
        fill="none"
        stroke="rgba(255, 255, 255, 0.45)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M 50 28 L 50 48 C 58 65 66 90 66 122"
        fill="none"
        stroke="rgba(255, 255, 255, 0.15)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
};
