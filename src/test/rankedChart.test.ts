import { describe, it, expect } from "vitest";
import {
  getRankTierFromFlatProgress,
  getSubrankFloor,
  processRankedMatches,
  plotRankedPoints,
  getEternusSubrankFromPercentile,
  ETERNUS_PERCENTILE_THRESHOLDS,
} from "../services/rankedChart";
import { Match } from "../types/match";

const createMockMatch = (partial: Partial<Match>): Match => ({
  id: "m_" + Math.random().toString(36).substring(7),
  date: "2026-10-01T12:00:00Z",
  side: "hidden_king",
  myHeroId: 1,
  allies: [2, 3, 4, 5, 6],
  enemies: [7, 8, 9, 10, 11, 12],
  result: "win",
  ...partial,
});

describe("rankedChart - getRankTierFromFlatProgress (Deadlock Ladder 7000 pts per tier)", () => {
  it("maps correctly flat progress to official Deadlock tiers", () => {
    // Initiate (Tier 1): 0 - 7,000 pts
    expect(getRankTierFromFlatProgress(0).label).toBe("Initiate I");
    expect(getRankTierFromFlatProgress(1000).label).toBe("Initiate II");
    expect(getRankTierFromFlatProgress(2000).label).toBe("Initiate III");
    expect(getRankTierFromFlatProgress(3000).label).toBe("Initiate IV");
    expect(getRankTierFromFlatProgress(4000).label).toBe("Initiate V");
    expect(getRankTierFromFlatProgress(5000).label).toBe("Initiate VI");
    // 2 000 pts to reach Seeker I
    expect(getRankTierFromFlatProgress(6999).label).toBe("Initiate VI");
    expect(getRankTierFromFlatProgress(7000).label).toBe("Seeker I");

    // Oracle (Tier 8): 49,000 - 56,000 pts
    expect(getRankTierFromFlatProgress(49000).label).toBe("Oracle I");
    expect(getRankTierFromFlatProgress(50000).label).toBe("Oracle II");
    expect(getRankTierFromFlatProgress(51000).label).toBe("Oracle III");
    expect(getRankTierFromFlatProgress(52000).label).toBe("Oracle IV");
    expect(getRankTierFromFlatProgress(53000).label).toBe("Oracle V");
    expect(getRankTierFromFlatProgress(54000).label).toBe("Oracle VI");
    expect(getRankTierFromFlatProgress(55999).label).toBe("Oracle VI");

    // Phantom (Tier 9): 56,000 - 63,000 pts
    expect(getRankTierFromFlatProgress(56000).label).toBe("Phantom I");
    expect(getRankTierFromFlatProgress(57000).label).toBe("Phantom II");

    // Ascendant (Tier 10): 63,000 - 70,000 pts
    expect(getRankTierFromFlatProgress(63000).label).toBe("Ascendant I");
    expect(getRankTierFromFlatProgress(68000).label).toBe("Ascendant VI");
    expect(getRankTierFromFlatProgress(69999).label).toBe("Ascendant VI");

    // Eternus (Tier 11): 70,000+ pts, percentile-based subranks
    expect(getRankTierFromFlatProgress(70000).label).toBe("Eternus I");
    expect(getRankTierFromFlatProgress(70000, 0).label).toBe("Eternus I");
    expect(getRankTierFromFlatProgress(70000, 25).label).toBe("Eternus II");
    expect(getRankTierFromFlatProgress(70000, 50).label).toBe("Eternus III");
    expect(getRankTierFromFlatProgress(70000, 70).label).toBe("Eternus IV");
    expect(getRankTierFromFlatProgress(70000, 85).label).toBe("Eternus V");
    expect(getRankTierFromFlatProgress(70000, 95).label).toBe("Eternus VI");
    expect(getRankTierFromFlatProgress(75000, 99).label).toBe("Eternus VI");
  });

  it("calculates Eternus subranks from official percentile thresholds", () => {
    expect(ETERNUS_PERCENTILE_THRESHOLDS).toHaveLength(6);
    expect(getEternusSubrankFromPercentile(0)).toBe(1);
    expect(getEternusSubrankFromPercentile(24.9)).toBe(1);
    expect(getEternusSubrankFromPercentile(25)).toBe(2);
    expect(getEternusSubrankFromPercentile(49.9)).toBe(2);
    expect(getEternusSubrankFromPercentile(50)).toBe(3);
    expect(getEternusSubrankFromPercentile(69.9)).toBe(3);
    expect(getEternusSubrankFromPercentile(70)).toBe(4);
    expect(getEternusSubrankFromPercentile(84.9)).toBe(4);
    expect(getEternusSubrankFromPercentile(85)).toBe(5);
    expect(getEternusSubrankFromPercentile(94.9)).toBe(5);
    expect(getEternusSubrankFromPercentile(95)).toBe(6);
    expect(getEternusSubrankFromPercentile(100)).toBe(6);
  });

  it("calculates subrank floors including 2000 pts on Subrank VI and 70000 for Eternus", () => {
    expect(getSubrankFloor(52400)).toBe(52000); // Oracle IV floor
    expect(getSubrankFloor(53360)).toBe(53000); // Oracle V floor
    expect(getSubrankFloor(55590)).toBe(54000); // Oracle VI floor (54000 to 56000)
    expect(getSubrankFloor(56100)).toBe(56000); // Phantom I floor
    expect(getSubrankFloor(70000)).toBe(70000); // Eternus floor
    expect(getSubrankFloor(74500)).toBe(70000); // Eternus floor
  });
});

describe("rankedChart - Strict Shield Validation Rules", () => {
  it("never consumes more than 2 shields in Subrank 3-6 even if raw data has 3 losses at floor", () => {
    // In Subrank 4 (Oracle IV, badge 84), max shields is 2
    const matches = [
      createMockMatch({
        id: "m1",
        date: "2026-08-15T10:00:00Z",
        result: "loss",
        rankedBadge: 84,
        rankedRank: 8,
        rankedSubrank: 4,
        rankedInitialProgress: 52000,
        rankedProgress: 52000,
        rankedDelta: 0,
        rankedConsumedDemotionProtection: true,
      }),
      createMockMatch({
        id: "m2",
        date: "2026-08-15T11:00:00Z",
        result: "loss",
        rankedBadge: 84,
        rankedRank: 8,
        rankedSubrank: 4,
        rankedInitialProgress: 52000,
        rankedProgress: 52000,
        rankedDelta: 0,
        rankedConsumedDemotionProtection: true,
      }),
      // 3rd loss at floor: shields are exhausted (0 remaining). CANNOT consume a 3rd shield!
      createMockMatch({
        id: "m3",
        date: "2026-08-15T12:00:00Z",
        result: "loss",
        rankedBadge: 84,
        rankedRank: 8,
        rankedSubrank: 4,
        rankedInitialProgress: 52000,
        rankedProgress: 52000,
        rankedDelta: 0,
        rankedConsumedDemotionProtection: true,
      }),
    ];

    const { processedMatches, shieldEventsMap } = processRankedMatches(matches);

    // m1 uses 1st shield (2 -> 1)
    expect(shieldEventsMap.get("m1")?.type).toBe("used");
    expect(processedMatches[0].runningShields).toBe(1);

    // m2 uses 2nd shield (1 -> 0)
    expect(shieldEventsMap.get("m2")?.type).toBe("used");
    expect(processedMatches[1].runningShields).toBe(0);

    // m3: NO shield used, runningShields stays 0, and delta cannot be 0!
    expect(shieldEventsMap.get("m3")).toBeUndefined();
    expect(processedMatches[2].runningShields).toBe(0);
    expect(processedMatches[2].effectiveDelta).not.toBe(0);
    expect(processedMatches[2].effectiveDelta).toBeLessThan(0);
  });

  it("never consumes more than 5 shields in Subrank 1-2 even with 6 losses at floor", () => {
    // In Subrank 1 (Phantom I, badge 91), max shields is 5
    const matches: Match[] = [];
    for (let i = 1; i <= 6; i++) {
      matches.push(
        createMockMatch({
          id: `m${i}`,
          date: `2026-10-01T1${i}:00:00Z`,
          result: "loss",
          rankedBadge: 91,
          rankedRank: 9,
          rankedSubrank: 1,
          rankedInitialProgress: 56000,
          rankedProgress: 56000,
          rankedDelta: 0,
          rankedConsumedDemotionProtection: true,
        })
      );
    }

    const { processedMatches, shieldEventsMap } = processRankedMatches(matches);

    // First 5 matches consume 1 shield each
    for (let i = 1; i <= 5; i++) {
      expect(shieldEventsMap.get(`m${i}`)?.type).toBe("used");
    }
    expect(processedMatches[4].runningShields).toBe(0);

    // 6th match CANNOT consume a shield!
    expect(shieldEventsMap.get("m6")).toBeUndefined();
    expect(processedMatches[5].runningShields).toBe(0);
    expect(processedMatches[5].effectiveDelta).not.toBe(0);
  });
});

describe("rankedChart - processRankedMatches and Absolute Plotting", () => {
  it("places points directly at absolute positions without cumulative distortion", () => {
    const matches = [
      createMockMatch({
        id: "m1",
        date: "2026-08-18T07:08:38Z",
        result: "loss",
        rankedBadge: 85,
        rankedInitialProgress: 53360,
        rankedProgress: 53060,
        rankedDelta: -300,
      }),
      createMockMatch({
        id: "m2",
        date: "2026-08-18T20:17:25Z",
        result: "loss",
        rankedBadge: 85,
        rankedInitialProgress: 53060,
        rankedProgress: 53000,
        rankedDelta: -60,
      }),
    ];

    const { processedMatches } = processRankedMatches(matches);
    expect(processedMatches[0].startProgress).toBe(53360);
    expect(processedMatches[0].endProgress).toBe(53060);

    const geom = plotRankedPoints(processedMatches);
    expect(geom).not.toBeNull();
    expect(geom?.points).toHaveLength(2);
    expect(geom?.points[0].startProgress).toBe(53360);
    expect(geom?.points[1].startProgress).toBe(53060);
  });
});
