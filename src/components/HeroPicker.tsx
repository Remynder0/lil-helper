import React, { useState, useMemo } from 'react';
import { HEROES, Hero } from '../data/heroes';
import { Search, Check, Shield, Crosshair, Sparkles, Zap, X } from 'lucide-react';

export interface HeroPickerProps {
  /** Array of currently selected hero IDs */
  selectedHeroIds: number[];
  /** Array of hero IDs that are disabled (e.g. already picked elsewhere in the draft) */
  disabledHeroIds?: number[];
  /** Callback fired when a hero is clicked */
  onSelectHero: (heroId: number) => void;
  /** Accent faction color for selected outline and glow */
  accentColor?: 'hidden_king' | 'archmother' | 'default';
  /** Optional title shown above the picker */
  title?: string;
  /** Optional subtitle or instruction */
  subtitle?: string;
  /** Custom extra CSS classes */
  className?: string;
}

type HeroTypeFilter = 'all' | 'brawler' | 'marksman' | 'mystic' | 'assassin';

const ROLE_TABS: { id: HeroTypeFilter; label: string; icon: React.ReactNode }[] = [
  { id: 'all', label: 'All', icon: null },
  { id: 'brawler', label: 'Brawler', icon: <Shield className="w-3.5 h-3.5" /> },
  { id: 'marksman', label: 'Marksman', icon: <Crosshair className="w-3.5 h-3.5" /> },
  { id: 'mystic', label: 'Mystic', icon: <Sparkles className="w-3.5 h-3.5" /> },
  { id: 'assassin', label: 'Assassin', icon: <Zap className="w-3.5 h-3.5" /> },
];

export const HeroPicker: React.FC<HeroPickerProps> = ({
  selectedHeroIds,
  disabledHeroIds = [],
  onSelectHero,
  accentColor = 'default',
  title,
  subtitle,
  className = '',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<HeroTypeFilter>('all');

  // Filter heroes based on search query and active role tab
  const filteredHeroes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return HEROES.filter((hero: Hero) => {
      // Role filter
      if (activeTab !== 'all' && hero.heroType !== activeTab) {
        return false;
      }
      // Text search filter
      if (query) {
        const matchesName = hero.name.toLowerCase().includes(query);
        const matchesTags = hero.tags.some((tag) => tag.toLowerCase().includes(query));
        const matchesRole = hero.role.toLowerCase().includes(query);
        return matchesName || matchesTags || matchesRole;
      }
      return true;
    });
  }, [searchQuery, activeTab]);

  // Accent styling helper
  const getSelectedStyles = () => {
    if (accentColor === 'hidden_king') {
      return 'border-deadlock-hidden-king ring-2 ring-deadlock-hidden-king/50 shadow-lg shadow-deadlock-hidden-king/25 scale-105';
    }
    if (accentColor === 'archmother') {
      return 'border-deadlock-archmother ring-2 ring-deadlock-archmother/50 shadow-lg shadow-deadlock-archmother/25 scale-105';
    }
    return 'border-white ring-2 ring-white/50 scale-105';
  };

  const getBadgeColor = () => {
    if (accentColor === 'hidden_king') return 'bg-deadlock-hidden-king text-black';
    if (accentColor === 'archmother') return 'bg-deadlock-archmother text-black';
    return 'bg-white text-black';
  };

  return (
    <div className={`bg-deadlock-panel/80 backdrop-blur border border-deadlock-border rounded-xl p-4 flex flex-col gap-3 ${className}`}>
      {/* Header with Title & Search Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 pb-2 border-b border-deadlock-border/60">
        <div>
          {title && <h3 className="text-sm font-semibold tracking-wide text-gray-100 uppercase">{title}</h3>}
          {subtitle && <p className="text-xs text-deadlock-muted">{subtitle}</p>}
        </div>

        {/* Search input */}
        <div className="relative w-full sm:w-56">
          <Search className="w-4 h-4 text-deadlock-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search hero..."
            className="w-full bg-deadlock-dark border border-deadlock-border rounded-lg pl-8 pr-7 py-1.5 text-xs text-gray-200 placeholder-deadlock-muted/60 focus:outline-none focus:border-deadlock-muted transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-deadlock-muted hover:text-white"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Role Filter Tabs */}
      <div className="flex flex-wrap gap-1.5 items-center">
        {ROLE_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                isActive
                  ? 'bg-deadlock-border text-white shadow-sm'
                  : 'text-deadlock-muted hover:text-gray-300 hover:bg-deadlock-border/40'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
        <span className="ml-auto text-[11px] text-deadlock-muted/70">
          {filteredHeroes.length} hero{filteredHeroes.length !== 1 ? 'es' : ''}
        </span>
      </div>

      {/* Hero Icon Grid */}
      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-9 gap-2 max-h-[380px] overflow-y-auto p-1 pr-2">
        {filteredHeroes.map((hero: Hero) => {
          const isSelected = selectedHeroIds.includes(hero.id);
          const isDisabled = disabledHeroIds.includes(hero.id) && !isSelected;

          return (
            <button
              key={hero.id}
              type="button"
              disabled={isDisabled}
              onClick={() => onSelectHero(hero.id)}
              title={`${hero.name} (${hero.heroType}) - ${hero.role}`}
              className={`relative group flex flex-col items-center p-1 rounded-lg border transition-all duration-150 ${
                isDisabled
                  ? 'opacity-25 grayscale cursor-not-allowed border-transparent'
                  : isSelected
                  ? `${getSelectedStyles()} bg-deadlock-dark/80 z-10`
                  : 'border-deadlock-border/40 hover:border-gray-400 bg-deadlock-dark/40 hover:bg-deadlock-dark/90 hover:scale-105'
              }`}
            >
              {/* Hero Portrait */}
              <div className="w-12 h-12 rounded-md overflow-hidden bg-deadlock-panel">
                <img
                  src={hero.iconUrl}
                  alt={hero.name}
                  className="w-full h-full object-cover select-none"
                  loading="lazy"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>

              {/* Selected Checkmark Badge */}
              {isSelected && (
                <div
                  className={`absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center shadow-md ${getBadgeColor()}`}
                >
                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                </div>
              )}

              {/* Hero Name */}
              <span
                className={`mt-1 text-[11px] font-medium truncate max-w-full text-center ${
                  isSelected ? 'text-white font-bold' : 'text-gray-300 group-hover:text-white'
                }`}
              >
                {hero.name}
              </span>
            </button>
          );
        })}

        {filteredHeroes.length === 0 && (
          <div className="col-span-full py-8 text-center text-deadlock-muted text-xs">
            No heroes match &quot;{searchQuery}&quot;
          </div>
        )}
      </div>
    </div>
  );
};
