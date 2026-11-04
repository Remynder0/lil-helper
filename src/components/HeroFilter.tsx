import React, { useMemo } from 'react';
import { Filter, Sparkles, Swords, Users, Crown } from 'lucide-react';
import { HeroAvatar } from './HeroAvatar';
import { getHeroById, Hero } from '../data/heroes';
import { Side, SIDE_LABELS } from '../types/match';

export type MatchupTabType = 'opponents' | 'allies';
export type SideFilterType = 'all' | Side;

export interface PlayedHeroItem {
  hero: Hero;
  count: number;
}

export interface SideCounts {
  hiddenKing: number;
  archmother: number;
  total: number;
}

export interface MatchupTabOption<TTab extends string = string> {
  id: TTab;
  label: string;
  icon?: React.ReactNode;
  count?: number;
  activeClass?: string;
}

export interface HeroFilterProps<TTab extends string = string> {
  /**
   * Played heroes list.
   */
  playedHeroes: PlayedHeroItem[];

  /** Currently selected hero ID (or null for all heroes) */
  selectedPlayerHeroId?: number | null;
  selectedHeroId?: number | null;

  /** Hero selection change callback */
  onSelectHeroId: (heroId: number | null) => void;

  /** Total match count (displayed on the "All Heroes" pill) */
  totalTrackedMatches?: number;
  totalMatches?: number;

  /** Optional selected hero object */
  selectedHeroObj?: Hero | null;

  /** Section title (default: "Filter Lane Stats by Your Hero:") */
  title?: string;

  /** Custom subtitle, or function receiving the active Hero */
  subtitle?: React.ReactNode | ((selectedHero: Hero | null) => React.ReactNode);

  /** Slot for extra controls on the right of the header title (e.g. Reset button, W-L record) */
  headerExtra?: React.ReactNode;

  /** Slot for extra controls on the right of the hero pills row (e.g. Any hero selector dropdown) */
  heroRowExtra?: React.ReactNode;

  /** Active matchup tab identifier */
  matchupTab?: TTab;

  /** Matchup tab change callback */
  onTabChange?: (tab: TTab) => void;

  /** Custom tab options if different from standard opponents/allies */
  tabOptions?: MatchupTabOption<TTab>[];

  /** Total opponents count (used when tabOptions is omitted) */
  totalOpponentsCount?: number;

  /** Total allies count (used when tabOptions is omitted) */
  totalAlliesCount?: number;

  /** Selected map side: 'all' | 'hidden_king' | 'archmother' */
  selectedSide?: SideFilterType;

  /** Side change callback */
  onSideChange?: (side: SideFilterType) => void;

  /** Match counts per side */
  sideCounts?: SideCounts;

  /** Extra controls slot below (e.g. Outcome and Mode dropdowns) */
  children?: React.ReactNode;

  /** Additional classes for the outer panel */
  className?: string;
}

export function HeroFilter<TTab extends string = string>({
  playedHeroes,
  selectedPlayerHeroId,
  selectedHeroId,
  onSelectHeroId,
  totalTrackedMatches,
  totalMatches,
  selectedHeroObj,
  title = 'Filter Lane Stats by Your Hero:',
  subtitle,
  headerExtra,
  heroRowExtra,
  matchupTab,
  onTabChange,
  tabOptions,
  totalOpponentsCount,
  totalAlliesCount,
  selectedSide,
  onSideChange,
  sideCounts,
  children,
  className = '',
}: HeroFilterProps<TTab>) {
  const currentHeroId = selectedPlayerHeroId !== undefined ? selectedPlayerHeroId : (selectedHeroId ?? null);
  const totalCount = totalTrackedMatches !== undefined ? totalTrackedMatches : (totalMatches ?? 0);

  const heroObj = useMemo(() => {
    if (selectedHeroObj !== undefined) return selectedHeroObj;
    return currentHeroId ? getHeroById(currentHeroId) ?? null : null;
  }, [selectedHeroObj, currentHeroId]);

  const defaultSubtitle = useMemo(() => {
    if (typeof subtitle === 'function') {
      return subtitle(heroObj);
    }
    if (subtitle !== undefined) {
      return subtitle;
    }

    const sideSuffix =
      selectedSide && selectedSide !== 'all'
        ? ` on ${SIDE_LABELS[selectedSide]} side`
        : '';

    return heroObj
      ? `Showing performance specifically when you play ${heroObj.name}${sideSuffix}`
      : `Showing performance across all heroes (${totalCount} matches)${sideSuffix}`;
  }, [subtitle, heroObj, selectedSide, totalCount]);

  // Compute tabs to render: either custom tabOptions, or default opponents/allies
  const resolvedTabs: MatchupTabOption<TTab>[] = useMemo(() => {
    if (tabOptions) return tabOptions;
    if (!matchupTab) return [];
    return [
      {
        id: 'opponents' as TTab,
        label: 'Direct Opponents',
        icon: <Swords className="w-3.5 h-3.5 text-deadlock-hidden-king" />,
        count: totalOpponentsCount,
      },
      {
        id: 'allies' as TTab,
        label: 'Duo Lane Partners',
        icon: <Users className="w-3.5 h-3.5 text-sky-400" />,
        count: totalAlliesCount,
      },
    ];
  }, [tabOptions, matchupTab, totalOpponentsCount, totalAlliesCount]);

  return (
    <div className={`steam-glass steam-panel rounded-xl p-4 flex flex-col gap-3.5 ${className}`}>
      {/* ── 1. HEADER: Title, Extra actions & Dynamic Subtitle ── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-deadlock-accent" />
          <span className="text-xs font-bold uppercase tracking-wider text-deadlock-steam">
            {title}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {headerExtra}
          <span className="text-xs text-deadlock-muted">{defaultSubtitle}</span>
        </div>
      </div>

      {/* ── 2. HERO SELECTOR BUTTONS: Sorted by matches descending ── */}
      <div className="flex items-center gap-2 flex-wrap pt-0.5">
        {/* All Heroes Button */}
        <button
          type="button"
          onClick={() => onSelectHeroId(null)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 ${
            currentHeroId === null
              ? 'bg-deadlock-accent/20 border-deadlock-accent text-deadlock-steam shadow-sm ring-1 ring-deadlock-accent/40'
              : 'bg-deadlock-dark border-deadlock-border text-deadlock-muted hover:text-deadlock-steam hover:border-white/30'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-deadlock-accent" />
          <span>All Heroes</span>
          <span className="text-[10px] opacity-75 font-mono">({totalCount})</span>
        </button>

        {/* Individual Hero Buttons */}
        {playedHeroes.map(({ hero, count }) => {
          const isSelected = currentHeroId === hero.id;
          const isLowSample = count < 5;
          return (
            <button
              key={hero.id}
              type="button"
              onClick={() => onSelectHeroId(hero.id)}
              title={isLowSample ? `${hero.name} — Low sample size (< 5 matches)` : undefined}
              className={`flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs border transition-all ${
                isSelected
                  ? 'bg-deadlock-border border-white text-deadlock-steam shadow-md ring-1 ring-white/40'
                  : isLowSample
                  ? 'bg-deadlock-dark/60 border-deadlock-border/40 text-deadlock-muted/70 hover:text-deadlock-steam hover:border-amber-500/40'
                  : 'bg-deadlock-dark border-deadlock-border text-deadlock-muted hover:text-deadlock-steam hover:border-white/30'
              }`}
            >
              <div className="relative">
                <HeroAvatar heroId={hero.id} size="xs" />
                {isLowSample && (
                  <span
                    className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-amber-400 shadow-sm shadow-amber-400/60"
                    title="Low sample (< 5 matches)"
                  />
                )}
              </div>
              <span className="font-medium">{hero.name}</span>
              <span className="text-[10px] opacity-70 font-mono">({count})</span>
            </button>
          );
        })}

        {/* Right extra element on hero row (e.g. Any hero selector dropdown) */}
        {heroRowExtra}
      </div>

      {/* ── 3. SUB-FILTERS: MATCHUP TABS & MAP SIDE SELECTOR ── */}
      {(resolvedTabs.length > 0 || onSideChange) && (
        <div className="pt-2 border-t border-deadlock-border/60 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Matchup Tabs */}
          {resolvedTabs.length > 0 && onTabChange && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold uppercase tracking-wider text-deadlock-muted mr-1">
                Matchup:
              </span>
              <div className="flex items-center gap-1.5 bg-deadlock-dark/80 p-1 rounded-xl border border-deadlock-border/60">
                {resolvedTabs.map((tab) => {
                  const isActive = matchupTab === tab.id;
                  const activeStyle = tab.activeClass ?? 'bg-deadlock-border text-deadlock-steam shadow-sm border border-white/20';

                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => onTabChange(tab.id)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        isActive
                          ? activeStyle
                          : 'text-deadlock-muted hover:text-deadlock-steam'
                      }`}
                    >
                      {tab.icon}
                      <span>{tab.label}</span>
                      {tab.count !== undefined && (
                        <span className="text-[10px] font-mono opacity-70">({tab.count})</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Map Side Selector: Both Sides vs The Hidden King vs The Archmother */}
          {onSideChange && selectedSide && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold uppercase tracking-wider text-deadlock-muted mr-1">
                Map Side:
              </span>
              <div className="flex items-center gap-1.5 bg-deadlock-dark/80 p-1 rounded-xl border border-deadlock-border/60">
                {/* Both Sides */}
                <button
                  type="button"
                  onClick={() => onSideChange('all')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    selectedSide === 'all'
                      ? 'bg-deadlock-border text-deadlock-steam shadow-sm border border-white/20'
                      : 'text-deadlock-muted hover:text-deadlock-steam'
                  }`}
                >
                  <span>Both Sides</span>
                  {sideCounts && (
                    <span className="text-[10px] font-mono opacity-70">({sideCounts.total})</span>
                  )}
                </button>

                {/* The Hidden King (Amber) */}
                <button
                  type="button"
                  onClick={() => onSideChange('hidden_king')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    selectedSide === 'hidden_king'
                      ? 'bg-deadlock-hidden-king/20 border border-deadlock-hidden-king text-amber-300 shadow-sm ring-1 ring-deadlock-hidden-king/40'
                      : 'text-deadlock-muted hover:text-amber-200'
                  }`}
                >
                  <Crown className="w-3.5 h-3.5 text-deadlock-hidden-king" />
                  <span>{SIDE_LABELS.hidden_king}</span>
                  {sideCounts && (
                    <span className="text-[10px] font-mono opacity-70">({sideCounts.hiddenKing})</span>
                  )}
                </button>

                {/* The Archmother (Sapphire) */}
                <button
                  type="button"
                  onClick={() => onSideChange('archmother')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    selectedSide === 'archmother'
                      ? 'bg-deadlock-archmother/20 border border-deadlock-archmother text-sky-300 shadow-sm ring-1 ring-deadlock-archmother/40'
                      : 'text-deadlock-muted hover:text-sky-200'
                  }`}
                >
                  <Crown className="w-3.5 h-3.5 text-deadlock-archmother" />
                  <span>{SIDE_LABELS.archmother}</span>
                  {sideCounts && (
                    <span className="text-[10px] font-mono opacity-70">({sideCounts.archmother})</span>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 4. OPTIONAL CHILDREN / EXTRA FILTERS ── */}
      {children}
    </div>
  );
}
