import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HeroFilter } from '../components/HeroFilter';
import type { Hero } from '../data/heroes';

const mockHeroes = [
  { id: 1, name: 'Infernus', role: 'Carry', heroType: 'DPS', iconUrl: '/icons/infernus.png' },
  { id: 2, name: 'Seven', role: 'Mage', heroType: 'Spirit', iconUrl: '/icons/seven.png' },
] as unknown as Hero[];

describe('HeroFilter component', () => {
  it('renders "All Heroes" button and hero pills with counts', () => {
    const handleSelect = vi.fn();
    render(
      <HeroFilter
        playedHeroes={[
          { hero: mockHeroes[0], count: 12 },
          { hero: mockHeroes[1], count: 5 },
        ]}
        selectedHeroId={null}
        onSelectHeroId={handleSelect}
        totalMatches={17}
      />
    );

    expect(screen.getByText('All Heroes')).toBeDefined();
    expect(screen.getByText('(17)')).toBeDefined();
    expect(screen.getByText('Infernus')).toBeDefined();
    expect(screen.getByText('(12)')).toBeDefined();
    expect(screen.getByText('Seven')).toBeDefined();
    expect(screen.getByText('(5)')).toBeDefined();
  });

  it('triggers onSelectHeroId with hero ID when a hero pill is clicked', () => {
    const handleSelect = vi.fn();
    render(
      <HeroFilter
        playedHeroes={[
          { hero: mockHeroes[0], count: 12 },
          { hero: mockHeroes[1], count: 5 },
        ]}
        selectedHeroId={null}
        onSelectHeroId={handleSelect}
        totalMatches={17}
      />
    );

    fireEvent.click(screen.getByText('Infernus'));
    expect(handleSelect).toHaveBeenCalledWith(1);
  });

  it('triggers onSelectHeroId with null when "All Heroes" is clicked', () => {
    const handleSelect = vi.fn();
    render(
      <HeroFilter
        playedHeroes={[
          { hero: mockHeroes[0], count: 12 },
          { hero: mockHeroes[1], count: 5 },
        ]}
        selectedHeroId={1}
        onSelectHeroId={handleSelect}
        totalMatches={17}
      />
    );

    fireEvent.click(screen.getByText('All Heroes'));
    expect(handleSelect).toHaveBeenCalledWith(null);
  });

  it('renders dynamic subtitle correctly', () => {
    render(
      <HeroFilter
        playedHeroes={[{ hero: mockHeroes[0], count: 12 }]}
        selectedHeroId={1}
        onSelectHeroId={vi.fn()}
        subtitle={(hero) => `Currently inspecting ${hero?.name}`}
      />
    );

    expect(screen.getByText('Currently inspecting Infernus')).toBeDefined();
  });

  it('renders and toggles matchup tabs (opponents vs allies)', () => {
    const handleTabChange = vi.fn();
    render(
      <HeroFilter
        playedHeroes={[{ hero: mockHeroes[0], count: 12 }]}
        selectedHeroId={null}
        onSelectHeroId={vi.fn()}
        matchupTab="opponents"
        onTabChange={handleTabChange}
        totalOpponentsCount={10}
        totalAlliesCount={4}
      />
    );

    expect(screen.getByText('Direct Opponents')).toBeDefined();
    expect(screen.getByText('(10)')).toBeDefined();
    expect(screen.getByText('Duo Lane Partners')).toBeDefined();
    expect(screen.getByText('(4)')).toBeDefined();

    fireEvent.click(screen.getByText('Duo Lane Partners'));
    expect(handleTabChange).toHaveBeenCalledWith('allies');
  });

  it('renders and toggles side selection (both, hidden king, archmother)', () => {
    const handleSideChange = vi.fn();
    render(
      <HeroFilter
        playedHeroes={[{ hero: mockHeroes[0], count: 12 }]}
        selectedHeroId={null}
        onSelectHeroId={vi.fn()}
        selectedSide="all"
        onSideChange={handleSideChange}
        sideCounts={{ hiddenKing: 8, archmother: 6, total: 14 }}
      />
    );

    expect(screen.getByText('Both Sides')).toBeDefined();
    expect(screen.getByText('(14)')).toBeDefined();
    expect(screen.getByText('The Hidden King')).toBeDefined();
    expect(screen.getByText('(8)')).toBeDefined();
    expect(screen.getByText('The Archmother')).toBeDefined();
    expect(screen.getByText('(6)')).toBeDefined();

    fireEvent.click(screen.getByText('The Hidden King'));
    expect(handleSideChange).toHaveBeenCalledWith('hidden_king');
  });
});
