import React from 'react';
import { getHeroById, Hero } from '../data/heroes';
import { X } from 'lucide-react';

interface HeroAvatarProps {
  heroId: number | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showName?: boolean;
  onRemove?: () => void;
  accentColor?: 'hidden_king' | 'archmother' | 'default';
  isHighlighted?: boolean;
  className?: string;
}

const SIZE_MAP = {
  xs: 'w-7 h-7 text-xs',
  sm: 'w-10 h-10 text-xs',
  md: 'w-14 h-14 text-sm',
  lg: 'w-18 h-18 text-base',
  xl: 'w-24 h-24 text-lg',
};

const IMAGE_SIZE_MAP = {
  xs: 'w-7 h-7',
  sm: 'w-10 h-10',
  md: 'w-14 h-14',
  lg: 'w-18 h-18',
  xl: 'w-24 h-24',
};

export const HeroAvatar: React.FC<HeroAvatarProps> = ({
  heroId,
  size = 'md',
  showName = false,
  onRemove,
  accentColor = 'default',
  isHighlighted = false,
  className = '',
}) => {
  const hero: Hero | undefined = heroId ? getHeroById(heroId) : undefined;

  let borderColor = 'border-deadlock-brass/40';
  let hoverBorder = 'hover:border-deadlock-brass';

  if (accentColor === 'hidden_king') {
    borderColor = isHighlighted
      ? 'border-deadlock-hidden-king ring-2 ring-deadlock-hidden-king/40 shadow-lg shadow-deadlock-hidden-king/20'
      : 'border-deadlock-hidden-king/50';
    hoverBorder = isHighlighted
      ? 'hover:border-deadlock-hidden-king'
      : 'hover:border-deadlock-hidden-king/80';
  } else if (accentColor === 'archmother') {
    borderColor = isHighlighted
      ? 'border-deadlock-archmother ring-2 ring-deadlock-archmother/40 shadow-lg shadow-deadlock-archmother/20'
      : 'border-deadlock-archmother/50';
    hoverBorder = isHighlighted
      ? 'hover:border-deadlock-archmother'
      : 'hover:border-deadlock-archmother/80';
  } else if (isHighlighted) {
    borderColor = 'border-deadlock-accent ring-2 ring-deadlock-accent/30';
    hoverBorder = 'hover:border-deadlock-accent';
  }

  return (
    <div className={`flex flex-col items-center gap-1.5 ${className}`}>
      <div className={`relative group/avatar ${SIZE_MAP[size]}`}>
        {hero ? (
          <div
            className={`relative overflow-hidden rounded-lg border-2 ${borderColor} ${hoverBorder} bg-deadlock-panel transition-all duration-150`}
          >
            <img
              src={hero.iconUrl}
              alt={hero.name}
              className={`${IMAGE_SIZE_MAP[size]} object-cover select-none`}
              loading="lazy"
              onError={(e) => {
                // Fallback to placeholder if image fails to load
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            {onRemove && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove();
                }}
                className="absolute inset-0 bg-black/60 opacity-0 group-hover/avatar:opacity-100 flex items-center justify-center transition-opacity text-deadlock-steam hover:text-red-400"
                title={`Remove ${hero.name}`}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        ) : (
          <div
            className={`w-full h-full rounded-lg border-2 border-dashed border-deadlock-border/70 bg-deadlock-panel/40 flex items-center justify-center text-deadlock-rivet transition-colors hover:border-deadlock-muted`}
          >
            <span className="text-xs font-mono font-bold">?</span>
          </div>
        )}
      </div>

      {showName && hero && (
        <span className="text-xs font-medium text-deadlock-steam truncate max-w-[80px] text-center">
          {hero.name}
        </span>
      )}
    </div>
  );
};
