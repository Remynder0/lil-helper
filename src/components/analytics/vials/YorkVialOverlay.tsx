import React from 'react';

interface YorkVialOverlayProps {
  width: number;
  height: number;
}

export const YorkVialOverlay: React.FC<YorkVialOverlayProps> = ({ width, height }) => {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 88 208"
      className="absolute inset-0 pointer-events-none select-none"
    >
      <defs>
        <linearGradient id="yorkGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="50%" stopColor="#eab308" />
          <stop offset="100%" stopColor="#854d0e" />
        </linearGradient>
      </defs>

      {/* Stepped Art Deco Gold Bullion Crown (Heavy & Bolted) */}
      <path d="M 30 2 L 58 2 L 58 7 L 30 7 Z" fill="url(#yorkGoldGrad)" stroke="#78350f" strokeWidth="1" />
      <path d="M 24 7 L 64 7 L 64 14 L 24 14 Z" fill="#ca8a04" stroke="#fef08a" strokeWidth="1.2" />
      <rect x="22" y="14" width="44" height="4" fill="#854d0e" />

      {/* Stepped Maritime Pier 16 Bolted Pedestal Base */}
      <path d="M 18 184 L 70 184 L 74 198 L 14 198 Z" fill="url(#yorkGoldGrad)" stroke="#78350f" strokeWidth="1.5" />
      <line x1="14" y1="198" x2="74" y2="198" stroke="#fef08a" strokeWidth="2" />

      {/* High-Pressure Steam Gauge / Bank Vault Combination Dial at the base */}
      <circle cx="44" cy="180" r="10" fill="#0f172a" stroke="#eab308" strokeWidth="2.5" />
      <circle cx="44" cy="180" r="8" fill="#1e293b" />
      {/* Gauge needle & markings */}
      <line x1="44" y1="180" x2="48" y2="174" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" />
      <circle cx="44" cy="180" r="2" fill="#fef08a" />
      <line x1="39" y1="175" x2="41" y2="177" stroke="#eab308" strokeWidth="1" />
      <line x1="49" y1="175" x2="47" y2="177" stroke="#eab308" strokeWidth="1" />

      {/* Faceted Art Deco Beveled Ingot Glare Reflection */}
      <path
        d="M 24 16 L 18 28 L 18 142 L 25 162 L 23 178"
        fill="none"
        stroke="rgba(255, 255, 255, 0.45)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M 64 16 L 70 28 L 70 142 L 63 162"
        fill="none"
        stroke="rgba(255, 255, 255, 0.15)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};
