import React from 'react';

interface BroadwayVialOverlayProps {
  width: number;
  height: number;
}

export const BroadwayVialOverlay: React.FC<BroadwayVialOverlayProps> = ({ width, height }) => {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 88 208"
      className="absolute inset-0 pointer-events-none select-none"
    >
      {/* Defs for Neon Glow */}
      <defs>
        <filter id="neonGlowBlue" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Open Glass Test Tube Lip Rim */}
      <ellipse cx="44" cy="12" rx="16" ry="3.5" fill="rgba(56, 189, 248, 0.15)" stroke="#38bdf8" strokeWidth="1.6" />
      <ellipse cx="44" cy="11.5" rx="13" ry="2.2" fill="none" stroke="rgba(255, 255, 255, 0.45)" strokeWidth="0.9" />

      {/* Scientific / Electric Graduation Level Marks */}
      <g opacity="0.85">
        {/* Level 80% */}
        <line x1="48" y1="46" x2="58" y2="46" stroke="#38bdf8" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="45" cy="46" r="1.4" fill="#e0f2fe" />
        <line x1="53" y1="60" x2="58" y2="60" stroke="#38bdf8" strokeWidth="1" strokeLinecap="round" opacity="0.6" />

        {/* Level 60% */}
        <line x1="47" y1="74" x2="58" y2="74" stroke="#38bdf8" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="44" cy="74" r="1.4" fill="#e0f2fe" />
        <line x1="53" y1="88" x2="58" y2="88" stroke="#38bdf8" strokeWidth="1" strokeLinecap="round" opacity="0.6" />

        {/* Level 40% (Mid Mark) */}
        <line x1="46" y1="102" x2="58" y2="102" stroke="#38bdf8" strokeWidth="2.0" strokeLinecap="round" />
        <circle cx="43" cy="102" r="1.6" fill="#e0f2fe" />
        <line x1="53" y1="116" x2="58" y2="116" stroke="#38bdf8" strokeWidth="1" strokeLinecap="round" opacity="0.6" />

        {/* Level 20% */}
        <line x1="48" y1="130" x2="58" y2="130" stroke="#38bdf8" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="45" cy="130" r="1.4" fill="#e0f2fe" />
      </g>

      {/* Boiling Thermal Bubbles Rising (Slightly Slower) and Popping */}
      <style>{`
        @keyframes boilBubble {
          0% {
            transform: translateY(0) scale(0.45);
            opacity: 0;
          }
          12% {
            opacity: 0.95;
          }
          50% {
            transform: translateY(-50px) scale(0.85);
            opacity: 0.95;
          }
          78% {
            transform: translateY(-95px) scale(1.3);
            opacity: 0.95;
          }
          90% {
            transform: translateY(-112px) scale(1.75);
            opacity: 0.85;
          }
          96% {
            transform: translateY(-118px) scale(2.4);
            opacity: 0.35;
          }
          100% {
            transform: translateY(-122px) scale(2.7);
            opacity: 0;
          }
        }
      `}</style>
      <g className="boiling-bubbles">
        {/* Staggered boiling bubbles expanding and popping at surface */}
        <circle
          cx="44"
          cy="158"
          r="2.8"
          fill="rgba(224, 242, 254, 0.45)"
          stroke="#38bdf8"
          strokeWidth="1"
          style={{
            animation: 'boilBubble 3.2s infinite cubic-bezier(0.4, 0, 0.2, 1)',
            animationDelay: '0.0s',
            transformBox: 'fill-box',
            transformOrigin: 'center',
          }}
        />
        <circle
          cx="38"
          cy="156"
          r="3.5"
          fill="rgba(255, 255, 255, 0.55)"
          stroke="#38bdf8"
          strokeWidth="1.2"
          style={{
            animation: 'boilBubble 3.8s infinite cubic-bezier(0.4, 0, 0.2, 1)',
            animationDelay: '0.8s',
            transformBox: 'fill-box',
            transformOrigin: 'center',
          }}
        />
        <circle
          cx="49"
          cy="154"
          r="2.2"
          fill="rgba(224, 242, 254, 0.45)"
          stroke="#38bdf8"
          strokeWidth="0.9"
          style={{
            animation: 'boilBubble 2.9s infinite cubic-bezier(0.4, 0, 0.2, 1)',
            animationDelay: '1.6s',
            transformBox: 'fill-box',
            transformOrigin: 'center',
          }}
        />
        <circle
          cx="42"
          cy="157"
          r="3.8"
          fill="rgba(224, 242, 254, 0.5)"
          stroke="#38bdf8"
          strokeWidth="1.2"
          style={{
            animation: 'boilBubble 4.0s infinite cubic-bezier(0.4, 0, 0.2, 1)',
            animationDelay: '2.3s',
            transformBox: 'fill-box',
            transformOrigin: 'center',
          }}
        />
        <circle
          cx="47"
          cy="155"
          r="2.0"
          fill="rgba(255, 255, 255, 0.6)"
          stroke="#38bdf8"
          strokeWidth="0.9"
          style={{
            animation: 'boilBubble 3.1s infinite cubic-bezier(0.4, 0, 0.2, 1)',
            animationDelay: '1.1s',
            transformBox: 'fill-box',
            transformOrigin: 'center',
          }}
        />
        <circle
          cx="35"
          cy="155"
          r="2.6"
          fill="rgba(224, 242, 254, 0.45)"
          stroke="#38bdf8"
          strokeWidth="1"
          style={{
            animation: 'boilBubble 3.5s infinite cubic-bezier(0.4, 0, 0.2, 1)',
            animationDelay: '2.9s',
            transformBox: 'fill-box',
            transformOrigin: 'center',
          }}
        />
        <circle
          cx="51"
          cy="156"
          r="1.8"
          fill="rgba(255, 255, 255, 0.6)"
          stroke="#38bdf8"
          strokeWidth="0.8"
          style={{
            animation: 'boilBubble 2.7s infinite cubic-bezier(0.4, 0, 0.2, 1)',
            animationDelay: '2.0s',
            transformBox: 'fill-box',
            transformOrigin: 'center',
          }}
        />
        <circle
          cx="41"
          cy="158"
          r="3.2"
          fill="rgba(224, 242, 254, 0.5)"
          stroke="#38bdf8"
          strokeWidth="1.1"
          style={{
            animation: 'boilBubble 3.7s infinite cubic-bezier(0.4, 0, 0.2, 1)',
            animationDelay: '0.4s',
            transformBox: 'fill-box',
            transformOrigin: 'center',
          }}
        />
      </g>

      {/* Crisp Fluorescent Tube Reflection */}
      <path
        d="M 33 30 L 33 150"
        fill="none"
        stroke="rgba(255, 255, 255, 0.45)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M 55 30 L 55 145"
        fill="none"
        stroke="rgba(255, 255, 255, 0.15)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
};
