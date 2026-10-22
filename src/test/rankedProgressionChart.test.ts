import { describe, it, expect } from 'vitest';
import {
  computeRankedChartGeometry,
  getRankTierFromFlatProgress,
  ROMAN_NUMERALS,
} from '../components/RankedProgressionChart';
import { Match } from '../types/match';

describe('RankedProgressionChart - computeRankedChartGeometry', () => {
  const createMockMatch = (partial: Partial<Match>): Match => ({
    id: 'match_' + Math.random().toString(36).substring(7),
    date: '2026-10-01T12:00:00.000Z',
    side: 'hidden_king',
    myHeroId: 1,
    allies: [2, 3, 4, 5, 6],
    enemies: [7, 8, 9, 10, 11, 12],
    result: 'win',
    ...partial,
  });

  it('returns null when filteredMatches is empty', () => {
    const res = computeRankedChartGeometry([], new Map(), new Map());
    expect(res).toBeNull();
  });

  it('computes valid chart geometry for a single match', () => {
    const match = createMockMatch({
      id: 'm1',
      rankedProgress: 56300,
      rankedInitialProgress: 56000,
      rankedDelta: 300,
    });
    const deltasMap = new Map([['m1', 300]]);
    const shieldsMap = new Map();

    const result = computeRankedChartGeometry([match], shieldsMap, deltasMap);
    expect(result).not.toBeNull();
    if (!result) return;

    expect(result.width).toBe(860);
    expect(result.height).toBe(280);
    expect(result.points).toHaveLength(1);
    expect(result.points[0].startProgress).toBe(56000);
    expect(result.points[0].endProgress).toBe(56300);
    expect(result.points[0].effectiveDelta).toBe(300);
    expect(result.finalEndpoint).toEqual({
      x: result.points[0].endX,
      y: result.points[0].endY,
      progress: 56300,
    });
    expect(result.yMin).toBeLessThanOrEqual(56000);
    expect(result.yMax).toBeGreaterThanOrEqual(56300);
    expect(result.thresholdLines.length).toBeGreaterThan(0);
  });

  it('computes valid chart coordinates and points for multiple matches with gaps', () => {
    const match1 = createMockMatch({
      id: 'm1',
      rankedInitialProgress: 56000,
      rankedProgress: 56300,
      rankedDelta: 300,
    });
    // Missing match in-between: match2 starts at 57000 instead of 56300!
    const match2 = createMockMatch({
      id: 'm2',
      rankedInitialProgress: 57000,
      rankedProgress: 57250,
      rankedDelta: 250,
    });
    const deltasMap = new Map([
      ['m1', 300],
      ['m2', 250],
    ]);
    const shieldsMap = new Map();

    const result = computeRankedChartGeometry([match1, match2], shieldsMap, deltasMap);
    expect(result).not.toBeNull();
    if (!result) return;

    expect(result.points).toHaveLength(2);
    expect(result.points[0].endProgress).toBe(56300);
    expect(result.points[1].startProgress).toBe(57000);
    expect(result.points[1].startProgress).not.toBe(result.points[0].endProgress);

    // Verify area path handles unrecorded gap without crashing
    expect(result.areaD).toBeDefined();
    expect(result.finalEndpoint?.progress).toBe(57250);
  });
});

describe('RankedProgressionChart - getRankTierFromFlatProgress', () => {
  it('correctly maps roman numerals and tier names from flat ranked points', () => {
    // 0 points -> Initiate I (Rank 1, subrank 1)
    const tier0 = getRankTierFromFlatProgress(0);
    expect(tier0.tierName).toBe('Initiate');
    expect(tier0.subrankRoman).toBe('I');

    // 1000 points -> Initiate II (Rank 1, subrank 2)
    const tier1_2 = getRankTierFromFlatProgress(1000);
    expect(tier1_2.rank).toBe(1);
    expect(tier1_2.subrank).toBe(2);
    expect(tier1_2.subrankRoman).toBe('II');
    expect(tier1_2.label).toBe('Initiate II');

    // 56000 points -> Phantom I (Rank 9, subrank 1)
    const phantomTier = getRankTierFromFlatProgress(56000);
    expect(phantomTier.tierName).toBe('Phantom');
    expect(phantomTier.subrankRoman).toBe('I');
    expect(phantomTier.label).toBe('Phantom I');
  });

  it('exports valid ROMAN_NUMERALS mapping', () => {
    expect(ROMAN_NUMERALS[1]).toBe('I');
    expect(ROMAN_NUMERALS[2]).toBe('II');
    expect(ROMAN_NUMERALS[3]).toBe('III');
    expect(ROMAN_NUMERALS[4]).toBe('IV');
    expect(ROMAN_NUMERALS[5]).toBe('V');
    expect(ROMAN_NUMERALS[6]).toBe('VI');
  });
});
