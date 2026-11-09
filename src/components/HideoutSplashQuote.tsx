import React from 'react';

export interface HideoutSplashQuoteProps {
  quote: string;
  visible?: boolean;
  className?: string;
}

/**
 * Steampunk-Occult Floating Splash Quote in official Valve Oracle typeface.
 * Positioned behind foreground interface elements (z-[5]) with +10° diagonal rotation,
 * corner-anchored under the header, radiating through glassmorphism (.steam-glass).
 */
export const HideoutSplashQuote: React.FC<HideoutSplashQuoteProps> = ({
  quote,
  visible = true,
  className = '',
}) => {
  if (!visible || !quote) return null;

  // Authentic splash quotes end with an exclamation mark
  const formattedQuote = quote.endsWith('!') || quote.endsWith('?') ? quote : `${quote}!`;

  return (
    <div
      data-testid="hideout-splash-quote"
      className={`fixed top-[86px] right-4 sm:right-6 md:right-8 lg:right-10 z-[5] pointer-events-none select-none transition-all duration-500 ${className}`}
      aria-hidden="true"
    >
      <div className="animate-occult-splash pointer-events-none select-none">
        <span
          className="font-deadlock-oracle text-[#FFF2C6] font-bold text-sm sm:text-base md:text-lg lg:text-xl tracking-wider whitespace-nowrap"
          style={{
            textShadow:
              '0 0 10px rgba(254, 240, 138, 0.95), 0 0 22px rgba(232, 192, 106, 0.85), 0 0 40px rgba(245, 158, 11, 0.55), 0 0 70px rgba(217, 119, 6, 0.35), 2px 2px 0px #0b0907, -1px -1px 0px #0b0907, 1px -1px 0px #0b0907, -1px 1px 0px #0b0907',
          }}
        >
          {formattedQuote}
        </span>
      </div>
    </div>
  );
};
