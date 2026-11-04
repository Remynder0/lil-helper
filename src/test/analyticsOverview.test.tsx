import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AnalyticsView, OVERVIEW_LOW_SAMPLE_THRESHOLD } from '../components/analytics/AnalyticsView';
import type { Match } from '../types/match';

const createMockMatch = (
  id: string,
  myHeroId: number,
  result: 'win' | 'loss' | 'cancel' = 'win',
  side: 'hidden_king' | 'archmother' = 'hidden_king'
): Match => ({
  id,
  date: '2024-01-01T12:00:00Z',
  myHeroId,
  result,
  side,
  allies: [2, 3, 4, 5, 6],
  enemies: [7, 8, 9, 10, 11, 12],
});

describe('AnalyticsView - Overview Low Sample and Selection Logic', () => {
  it('partitions heroes into representative and low-sample (< 5 games) with a delimiter banner', () => {
    // Hero 1 (Infernus): 6 matches (representative >= 5)
    // Hero 2 (Seven): 2 matches (low sample < 5)
    const matches: Match[] = [
      createMockMatch('1', 1, 'win'),
      createMockMatch('2', 1, 'win'),
      createMockMatch('3', 1, 'win'),
      createMockMatch('4', 1, 'loss'),
      createMockMatch('5', 1, 'win'),
      createMockMatch('6', 1, 'win'),
      createMockMatch('7', 2, 'win'),
      createMockMatch('8', 2, 'loss'),
    ];

    render(<AnalyticsView matches={matches} />);

    // Check that Overview is active
    expect(screen.getByText('Hero Performance')).toBeDefined();
    expect(screen.getByText('2 played')).toBeDefined();

    // Check the delimiter banner
    expect(
      screen.getByText(`Low Sample Size (< ${OVERVIEW_LOW_SAMPLE_THRESHOLD} matches)`)
    ).toBeDefined();

    // Hero 1 (6 matches) has representative stats
    expect(screen.getByText('6 matches')).toBeDefined();

    // Hero 2 (2 matches) has <5g badge
    expect(screen.getByText('<5g')).toBeDefined();
    expect(screen.getByText('2 matches')).toBeDefined();
  });

  it('selects a hero on click, shows the contextual filter banner, and updates metrics', () => {
    const matches: Match[] = [
      // Hero 1: 6 matches
      createMockMatch('1', 1, 'win'),
      createMockMatch('2', 1, 'win'),
      createMockMatch('3', 1, 'win'),
      createMockMatch('4', 1, 'win'),
      createMockMatch('5', 1, 'win'),
      createMockMatch('6', 1, 'win'),
      // Hero 2: 2 matches (low sample)
      createMockMatch('7', 2, 'win'),
      createMockMatch('8', 2, 'loss'),
    ];

    render(<AnalyticsView matches={matches} />);

    // Click on Seven (hero 2, low sample)
    const sevenHeroRow = screen.getByText(/Seven/i);
    fireEvent.click(sevenHeroRow);

    // Contextual banner should display with low sample warning
    expect(screen.getByText(/Showing overview statistics specifically when piloting Seven/i)).toBeDefined();
    expect(screen.getAllByText(/Low Sample Size \(< 5 matches\)/i).length).toBeGreaterThanOrEqual(1);

    // Clicking "✕ Show All Heroes" resets the selection
    const resetButton = screen.getByRole('button', { name: /✕ Show All Heroes/i });
    fireEvent.click(resetButton);

    // The hero-specific banner should be gone
    expect(screen.queryByText(/Showing overview statistics specifically when piloting Seven/i)).toBeNull();
  });

  it('allows toggling "All Heroes" directly from the left lateral panel', () => {
    const matches: Match[] = [
      createMockMatch('1', 1, 'win'),
      createMockMatch('2', 1, 'win'),
      createMockMatch('3', 1, 'win'),
      createMockMatch('4', 1, 'win'),
      createMockMatch('5', 1, 'win'),
    ];

    render(<AnalyticsView matches={matches} />);

    // Click on Infernus
    fireEvent.click(screen.getByText(/Infernus/i));
    expect(screen.getByText(/Showing overview statistics specifically when piloting Infernus/i)).toBeDefined();

    // Click on "All Heroes" in the left panel list
    const allHeroesButton = screen.getByRole('button', { name: /All Heroes 5 matches/i });
    fireEvent.click(allHeroesButton);

    expect(screen.queryByText(/Showing overview statistics specifically when piloting Infernus/i)).toBeNull();
  });
});
