import React from 'react';

interface OccultEyeButtonProps {
  isScanning: boolean;
  onClick: () => void;
  disabled?: boolean;
}

export const OccultEyeButton: React.FC<OccultEyeButtonProps> = ({
  isScanning,
  onClick,
  disabled,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || isScanning}
      className={`relative group p-0 bg-transparent border-none cursor-pointer focus:outline-none transition-transform duration-300 ${
        isScanning ? 'scale-115 cursor-wait' : 'hover:scale-120 active:scale-95'
      } disabled:opacity-50 select-none`}
      title="Occult Sight (OCR): Divine both teams from game screen (Press Escape in Deadlock, then click)"
      aria-label="Occult Sight: Divine screen"
    >
      {/* Mystical purple/crimson expanding aura on hover & scan */}
      <div
        className={`absolute -inset-2.5 rounded-full transition-all duration-500 blur-md pointer-events-none ${
          isScanning
            ? 'bg-gradient-to-r from-[#8b3a3a]/70 via-[#9a6abf]/80 to-[#8b3a3a]/70 animate-pulse scale-125'
            : 'bg-gradient-to-r from-[#6b4c8a]/0 via-[#9a6abf]/0 to-[#6b4c8a]/0 group-hover:from-[#6b4c8a]/40 group-hover:via-[#9a6abf]/50 group-hover:to-[#6b4c8a]/40 group-hover:scale-110'
        }`}
      />

      <svg
        className={`w-12 h-12 md:w-14 md:h-14 relative z-10 transition-all duration-300 ${
          isScanning
            ? 'drop-shadow-[0_0_18px_rgba(200,120,255,1)] filter brightness-125'
            : 'drop-shadow-[0_0_8px_rgba(154,106,191,0.6)] group-hover:drop-shadow-[0_0_16px_rgba(154,106,191,0.95)] group-hover:filter group-hover:brightness-115'
        }`}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient id="oc-btn-eye-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#8b3a3a" stopOpacity="0.6" />
            <stop offset="60%" stopColor="#6b4c8a" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#110f0c" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="oc-btn-arcane-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d8b4fe" />
            <stop offset="50%" stopColor="#9a6abf" />
            <stop offset="100%" stopColor="#6b4c8a" />
          </linearGradient>
        </defs>

        {/* Ambient Ethereal Glow with breathing pulsation */}
        <circle cx="50" cy="50" r="46" fill="url(#oc-btn-eye-glow)">
          <animate
            attributeName="opacity"
            values={isScanning ? '0.6;1;0.6' : '0.4;0.75;0.4'}
            dur={isScanning ? '0.8s' : '3s'}
            repeatCount="indefinite"
          />
        </circle>

        {/* Active scan celestial ring */}
        {isScanning && (
          <circle
            cx="50"
            cy="50"
            r="44"
            stroke="#9a6abf"
            strokeWidth="1.2"
            strokeDasharray="6 4"
            opacity="0.8"
          >
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0 50 50"
              to="360 50 50"
              dur="4s"
              repeatCount="indefinite"
            />
          </circle>
        )}

        {/* Sacred Delta / Triangle of Sight */}
        <polygon
          points="50,14 84,74 16,74"
          stroke={isScanning ? '#d8b4fe' : '#9a6abf'}
          strokeWidth="1.8"
          fill="none"
        >
          {isScanning && (
            <animate
              attributeName="stroke-width"
              values="1.8;2.6;1.8"
              dur="0.8s"
              repeatCount="indefinite"
            />
          )}
        </polygon>
        <polygon
          points="50,22 78,70 22,70"
          stroke="#8b3a3a"
          strokeWidth="1"
          fill="none"
          opacity="0.6"
        />

        {/* Trinitarian vertex rings & nodes */}
        <circle cx="50" cy="14" r="3.5" stroke="#9a6abf" strokeWidth="1" fill="#110f0c" />
        <circle cx="50" cy="14" r="1.5" fill="#8b3a3a" />

        <circle cx="84" cy="74" r="3.5" stroke="#9a6abf" strokeWidth="1" fill="#110f0c" />
        <circle cx="84" cy="74" r="1.5" fill="#8b3a3a" />

        <circle cx="16" cy="74" r="3.5" stroke="#9a6abf" strokeWidth="1" fill="#110f0c" />
        <circle cx="16" cy="74" r="1.5" fill="#8b3a3a" />

        {/* Radiant Occult Bursts / Lashes - Shimmering */}
        <g stroke={isScanning ? '#e9d5ff' : '#9a6abf'}>
          {/* Top rays */}
          <line x1="50" y1="36" x2="50" y2="28" stroke="#c44569" strokeWidth="1.2">
            <animate attributeName="y2" values="28;25;28" dur="1.8s" repeatCount="indefinite" />
          </line>
          <line x1="42" y1="38" x2="36" y2="32" strokeWidth="1">
            <animate attributeName="x2" values="36;34;36" dur="2.1s" repeatCount="indefinite" />
          </line>
          <line x1="58" y1="38" x2="64" y2="32" strokeWidth="1">
            <animate attributeName="x2" values="64;66;64" dur="2.1s" repeatCount="indefinite" />
          </line>

          {/* Bottom rays */}
          <line x1="50" y1="62" x2="50" y2="67" stroke="#c44569" strokeWidth="1.2">
            <animate attributeName="y2" values="67;70;67" dur="1.8s" repeatCount="indefinite" />
          </line>
          <line x1="42" y1="60" x2="36" y2="65" strokeWidth="1">
            <animate attributeName="x2" values="36;34;36" dur="2.1s" repeatCount="indefinite" />
          </line>
          <line x1="58" y1="60" x2="64" y2="65" strokeWidth="1">
            <animate attributeName="x2" values="64;66;64" dur="2.1s" repeatCount="indefinite" />
          </line>
        </g>

        {/* Eye Shape */}
        <path
          d="M26 49 C34 38, 66 38, 74 49 C66 60, 34 60, 26 49 Z"
          stroke="url(#oc-btn-arcane-grad)"
          strokeWidth="1.8"
          fill="#130d1e"
        />

        {/* Iris & Pupil with reactive pulse */}
        <circle cx="50" cy="49" r="8" stroke="#8b3a3a" strokeWidth="1.2" fill="#1b1221">
          <animate
            attributeName="r"
            values={isScanning ? '7;9;7' : '7.5;8.5;7.5'}
            dur={isScanning ? '0.7s' : '2.5s'}
            repeatCount="indefinite"
          />
        </circle>
        <circle cx="50" cy="49" r="4.5" fill="#9a6abf" opacity="0.7">
          <animate
            attributeName="opacity"
            values={isScanning ? '0.5;1;0.5' : '0.5;0.8;0.5'}
            dur={isScanning ? '0.7s' : '2.5s'}
            repeatCount="indefinite"
          />
        </circle>

        {/* Slit pupil */}
        <path
          d="M50 43 C51.5 46, 51.5 52, 50 55 C48.5 52, 48.5 46, 50 43 Z"
          fill={isScanning ? '#ff6b6b' : '#c44569'}
        >
          <animate
            attributeName="d"
            values={
              isScanning
                ? 'M50 42 C52 46, 52 52, 50 56 C48 52, 48 46, 50 42 Z; M50 44 C51 46, 51 52, 50 54 C49 52, 49 46, 50 44 Z; M50 42 C52 46, 52 52, 50 56 C48 52, 48 46, 50 42 Z'
                : 'M50 43 C51.5 46, 51.5 52, 50 55 C48.5 52, 48.5 46, 50 43 Z; M50 44 C51 46, 51 52, 50 54 C49 52, 49 46, 50 44 Z; M50 43 C51.5 46, 51.5 52, 50 55 C48.5 52, 48.5 46, 50 43 Z'
            }
            dur={isScanning ? '0.7s' : '3s'}
            repeatCount="indefinite"
          />
        </path>

        {/* Triple-moon crowning crescent over apex */}
        <path d="M42 8 A9 9 0 0 1 58 8 A6.5 6.5 0 0 0 42 8" fill="#9a6abf" opacity="0.75" />

        {/* Inverted crescent beneath the eye base */}
        <path d="M36 82 A16 16 0 0 0 64 82 A13 13 0 0 1 36 82" fill="#8b3a3a" opacity="0.6" />

        {/* Hanging droplet / pearl */}
        <circle cx="50" cy="87" r="2" fill="#9a6abf">
          <animate attributeName="opacity" values="0.5;1;0.5" dur="2s" repeatCount="indefinite" />
        </circle>
        <line x1="50" y1="82" x2="50" y2="85" stroke="#9a6abf" strokeWidth="1" />
      </svg>
    </button>
  );
};
