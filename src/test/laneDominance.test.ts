import { describe, it, expect } from 'vitest';
import {
  calculateLaneScore,
  calculateLaneDominance,
  calculateAverageLaneScore,
  getDominanceTier,
} from '../components/analytics/lanes/laneTypes';

describe('Lane Dominance & Tier Scoring System', () => {
  it('calculates raw lane score correctly', () => {
    // Win: +2, Even: +1, Loss: -2
    expect(calculateLaneScore(5, 2, 1)).toBe(5 * 2 + 2 * 1 - 1 * 2); // 10 + 2 - 2 = 10
    expect(calculateLaneScore(0, 0, 5)).toBe(-10);
    expect(calculateLaneScore(10, 0, 0)).toBe(20);
  });

  it('normalizes lane dominance on 0-100% scale regardless of volume', () => {
    // 100% wins -> 100%
    expect(calculateLaneDominance(10, 0, 0)).toBe(100);
    expect(calculateLaneDominance(1, 0, 0)).toBe(100);

    // 100% losses -> 0%
    expect(calculateLaneDominance(0, 0, 10)).toBe(0);
    expect(calculateLaneDominance(0, 0, 1)).toBe(0);

    // 100% evens -> 75% (even is +1 out of [-2, +2])
    expect(calculateLaneDominance(0, 10, 0)).toBe(75);

    // 50% Win / 50% Loss -> 50% (neutral balance)
    expect(calculateLaneDominance(10, 0, 10)).toBe(50);
    expect(calculateLaneDominance(1, 0, 1)).toBe(50);

    // Solves volume bias:
    // Lane A: 100 games (40W - 20E - 40L) -> dominance = 55%
    // Lane B: 10 games (9W - 1E - 0L) -> dominance = 98%
    const domA = calculateLaneDominance(40, 20, 40);
    const domB = calculateLaneDominance(9, 1, 0);
    expect(domB).toBeGreaterThan(domA);
    expect(domA).toBe(55);
    expect(domB).toBe(98);
  });

  it('calculates average score per match correctly', () => {
    expect(calculateAverageLaneScore(10, 0, 0)).toBe(2);
    expect(calculateAverageLaneScore(0, 0, 10)).toBe(-2);
    expect(calculateAverageLaneScore(5, 5, 0)).toBe(1.5);
    expect(calculateAverageLaneScore(0, 0, 0)).toBe(0);
  });

  it('categorizes dominance into the 5 color tiers', () => {
    // 1. Dominant (>= 80%)
    expect(getDominanceTier(100).id).toBe('dominant');
    expect(getDominanceTier(80).id).toBe('dominant');
    expect(getDominanceTier(80).colorClass).toBe('text-emerald-400');

    // 2. Advantage (65% - 79%)
    expect(getDominanceTier(79).id).toBe('advantage');
    expect(getDominanceTier(65).id).toBe('advantage');
    expect(getDominanceTier(70).colorClass).toBe('text-sky-400');

    // 3. Balanced (50% - 64%)
    expect(getDominanceTier(64).id).toBe('balanced');
    expect(getDominanceTier(50).id).toBe('balanced');
    expect(getDominanceTier(55).colorClass).toBe('text-yellow-400');

    // 4. Contested (35% - 49%)
    expect(getDominanceTier(49).id).toBe('contested');
    expect(getDominanceTier(35).id).toBe('contested');
    expect(getDominanceTier(40).colorClass).toBe('text-orange-400');

    // 5. Vulnerable (< 35%)
    expect(getDominanceTier(34).id).toBe('vulnerable');
    expect(getDominanceTier(0).id).toBe('vulnerable');
    expect(getDominanceTier(20).colorClass).toBe('text-rose-400');
  });
});
