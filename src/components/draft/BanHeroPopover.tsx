import React, { useState, useMemo, useRef, useEffect } from 'react';
import { HEROES, Hero } from '../../data/heroes';
import { HeroAvatar } from '../HeroAvatar';
import { Ban, Search, X, Shield, Crosshair, Sparkles, Zap } from 'lucide-react';

export interface BanHeroPopoverProps {
  /** The 0-indexed ban slot currently being targeted (0, 1, or 2) */
  activeBanIndex: number;
  /** Currently banned hero IDs across the 3 slots */
  bannedHeroIds: (number | null)[];
  /** Hero IDs that are disabled (picked in lanes or banned) */
  disabledHeroIds: number[];
  /** Callback fired when a hero is selected for this ban slot */
  onSelectHero: (heroId: number) => void;
  /** Callback to close the popover */
  onClose: () => void;
}

type HeroTypeFilter = 'all' | 'brawler' | 'marksman' | 'mystic' | 'assassin';

const ROLE_TABS: { id: HeroTypeFilter; label: string; icon: React.ReactNode }[] = [
  { id: 'all', label: 'All', icon: null },
  { id: 'brawler', label: 'Brawler', icon: <Shield className="w-3 h-3" /> },
  { id: 'marksman', label: 'Marksman', icon: <Crosshair className="w-3 h-3" /> },
  { id: 'mystic', label: 'Mystic', icon: <Sparkles className="w-3 h-3" /> },
  { id: 'assassin', label: 'Assassin', icon: <Zap className="w-3 h-3" /> },
];

export const BanHeroPopover: React.FC<BanHeroPopoverProps> = ({
  activeBanIndex,
  bannedHeroIds,
  disabledHeroIds,
  onSelectHero,
  onClose,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<HeroTypeFilter>('all');
  const popoverRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus search input on mount
  useEffect(() => {
    searchInputRef.current?.focus();
  }, [activeBanIndex]);

  // Click outside and Escape key listeners
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Filter heroes
  const filteredHeroes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return HEROES.filter((hero: Hero) => {
      if (activeTab !== 'all' && hero.heroType !== activeTab) {
        return false;
      }
      if (query) {
        const matchesName = hero.name.toLowerCase().includes(query);
        const matchesTags = hero.tags.some((tag) => tag.toLowerCase().includes(query));
        const matchesRole = hero.role.toLowerCase().includes(query);
        return matchesName || matchesTags || matchesRole;
      }
      return true;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [searchQuery, activeTab]);

  return (
    <div
      ref={popoverRef}
      className="absolute right-0 top-full mt-2.5 z-[100] w-72 sm:w-80 bg-[#140c1f]/98 backdrop-blur-2xl border-2 border-red-500/60 rounded-xl p-3 shadow-[0_20px_50px_rgba(0,0,0,0.95),0_0_30px_rgba(239,68,68,0.35)] flex flex-col gap-2.5 animate-in fade-in zoom-in-95 duration-150"
    >
      {/* Popover Header */}
      <div className="flex items-center justify-between pb-2 border-b border-red-500/30">
        <div className="flex items-center gap-1.5">
          <Ban className="w-4 h-4 text-red-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-red-200">
            Ban Hero #{activeBanIndex + 1} of 3
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-md text-purple-300/60 hover:text-white hover:bg-white/10 transition-colors"
          title="Close ban selection"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-purple-400/60" />
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter heroes..."
          className="w-full bg-[#0d0716]/90 border border-deadlock-arcane/40 rounded-lg pl-8 pr-7 py-1.5 text-xs text-gray-100 placeholder-purple-300/40 focus:outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400/40 transition-all"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-purple-400/60 hover:text-white"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Role Filter Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
        {ROLE_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold capitalize whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-red-500/20 text-red-300 border border-red-500/50 shadow-sm'
                  : 'bg-white/5 text-purple-300/60 hover:text-white hover:bg-white/10 border border-transparent'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Scrollable Hero List */}
      <div className="max-h-60 overflow-y-auto pr-1 flex flex-col gap-1 custom-scrollbar">
        {filteredHeroes.length === 0 ? (
          <div className="py-6 text-center text-xs text-purple-300/50 italic">
            No heroes found
          </div>
        ) : (
          filteredHeroes.map((hero) => {
            const isBannedHere = bannedHeroIds[activeBanIndex] === hero.id;
            const isBannedOther = bannedHeroIds.some((id, idx) => id === hero.id && idx !== activeBanIndex);
            const isDisabled = disabledHeroIds.includes(hero.id) && !isBannedHere;

            return (
              <button
                key={hero.id}
                type="button"
                disabled={isDisabled}
                onClick={() => onSelectHero(hero.id)}
                className={`flex items-center justify-between p-1.5 rounded-lg border transition-all text-left ${
                  isBannedHere
                    ? 'bg-red-950/60 border-red-500/80 ring-1 ring-red-500 text-red-100 shadow-sm'
                    : isDisabled
                    ? 'opacity-40 cursor-not-allowed bg-black/20 border-transparent text-gray-500'
                    : 'bg-[#181026]/70 border-deadlock-arcane/25 hover:bg-red-950/40 hover:border-red-500/50 text-gray-200 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <HeroAvatar heroId={hero.id} size="xs" />
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold truncate leading-tight">
                      {hero.name}
                    </span>
                    <span className="text-[10px] text-purple-300/60 font-mono capitalize">
                      {hero.heroType}
                    </span>
                  </div>
                </div>

                {isBannedOther && (
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-red-950 border border-red-500/40 text-red-300 shrink-0">
                    Banned
                  </span>
                )}
                {isDisabled && !isBannedOther && (
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-950/50 border border-amber-500/30 text-amber-300 shrink-0">
                    In Match
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};
