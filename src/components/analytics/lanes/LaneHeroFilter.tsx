import React from 'react';
import { Filter, Sparkles } from 'lucide-react';
import { HeroAvatar } from '../../HeroAvatar';
import type { Hero } from '../../../data/heroes';

export interface PlayedHeroItem {
  hero: Hero;
  count: number;
}

export interface LaneHeroFilterProps {
  playedHeroes: PlayedHeroItem[];
  selectedPlayerHeroId: number | null;
  onSelectHeroId: (heroId: number | null) => void;
  selectedHeroObj: Hero | null;
  totalTrackedMatches: number;
}

export const LaneHeroFilter: React.FC<LaneHeroFilterProps> = ({
  playedHeroes,
  selectedPlayerHeroId,
  onSelectHeroId,
  selectedHeroObj,
  totalTrackedMatches,
}) => {
  return (
    <div className="steam-glass steam-panel rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-deadlock-accent" />
          <span className="text-xs font-bold uppercase tracking-wider text-deadlock-steam">
            Filter Lane Stats by Your Hero:
          </span>
        </div>
        <span className="text-xs text-deadlock-muted">
          {selectedHeroObj
            ? `Showing lane performance specifically when you play ${selectedHeroObj.name}`
            : `Showing lane performance across all heroes (${totalTrackedMatches} matches with lane data)`}
        </span>
      </div>

      {/* Hero Selector Buttons: Sorted by games descending */}
      <div className="flex items-center gap-2 flex-wrap pt-1">
        <button
          type="button"
          onClick={() => onSelectHeroId(null)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 ${
            selectedPlayerHeroId === null
              ? 'bg-deadlock-accent/20 border-deadlock-accent text-deadlock-steam shadow-sm ring-1 ring-deadlock-accent/40'
              : 'bg-deadlock-dark border-deadlock-border text-deadlock-muted hover:text-deadlock-steam hover:border-white/30'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-deadlock-accent" />
          <span>All Heroes</span>
          <span className="text-[10px] opacity-75 font-mono">({totalTrackedMatches})</span>
        </button>

        {playedHeroes.map(({ hero, count }) => {
          const isSelected = selectedPlayerHeroId === hero.id;
          return (
            <button
              key={hero.id}
              type="button"
              onClick={() => onSelectHeroId(hero.id)}
              className={`flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs border transition-all ${
                isSelected
                  ? 'bg-deadlock-border border-white text-deadlock-steam shadow-md ring-1 ring-white/40'
                  : 'bg-deadlock-dark border-deadlock-border text-deadlock-muted hover:text-deadlock-steam hover:border-white/30'
              }`}
            >
              <HeroAvatar heroId={hero.id} size="xs" />
              <span className="font-medium">{hero.name}</span>
              <span className="text-[10px] opacity-70 font-mono">({count})</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
