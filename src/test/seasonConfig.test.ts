import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  isSeason2Match,
  isSeason1Match,
  getMatchSeason,
  SEASON_2_START_MATCH_ID,
  SEASON_2_START_TIMESTAMP_MS,
  SEASON_2_RANKED_DELTA_BASE,
  SEASON_1_RANKED_DELTA_BASE,
} from '../services/ranked/seasonConfig';
import { persistMatch, persistMatches, importMatchesJson, fetchLocalMatches } from '../services/storage/storage';
import { fetchPlayerRankedMatches, fetchSingleMatchResultById } from '../services/api/deadlockApi';
import { Match } from '../types/match';

describe('Ranked Season Boundaries & Configuration', () => {
  it('correctly exports the official worldwide Season 2 boundary constants', () => {
    expect(SEASON_2_START_MATCH_ID).toBe(131890899);
    expect(SEASON_2_START_TIMESTAMP_MS).toBe(1793912838000);
    expect(new Date(SEASON_2_START_TIMESTAMP_MS).toISOString()).toBe('2026-11-05T21:07:18.000Z');
    expect(SEASON_2_RANKED_DELTA_BASE).toBe(350);
    expect(SEASON_1_RANKED_DELTA_BASE).toBe(300);
  });

  describe('isSeason2Match identification', () => {
    it('returns false for null, undefined, or empty objects', () => {
      expect(isSeason2Match(null)).toBe(false);
      expect(isSeason2Match(undefined)).toBe(false);
      expect(isSeason2Match({})).toBe(false);
    });

    it('identifies Season 1 matches based on matchId < 131890899', () => {
      expect(isSeason2Match({ matchId: 131890898, date: '2026-11-05T21:07:00.000Z' })).toBe(false);
      expect(isSeason2Match({ match_id: 131793874, start_time: 1793900073 })).toBe(false);
      expect(isSeason1Match({ matchId: 131793874 })).toBe(true);
      expect(getMatchSeason({ matchId: 131793874 })).toBe(1);
    });

    it('identifies Season 2 matches based on matchId >= 131890899', () => {
      expect(isSeason2Match({ matchId: 131890899 })).toBe(true);
      expect(isSeason2Match({ match_id: 131897317 })).toBe(true);
      expect(isSeason2Match({ id: 'api_131890899' })).toBe(true);
      expect(isSeason1Match({ matchId: 131890899 })).toBe(false);
      expect(getMatchSeason({ matchId: 131890899 })).toBe(2);
    });

    it('identifies Season 2 matches based on ranked delta == 350', () => {
      expect(isSeason2Match({ rankedDelta: 350 })).toBe(true);
      expect(isSeason2Match({ rankedDelta: -350 })).toBe(true);
      expect(isSeason2Match({ ranked_delta: -350 })).toBe(true);
      expect(isSeason2Match({ desired_progress_change: -350 })).toBe(true);

      // Season 1 delta
      expect(isSeason2Match({ rankedDelta: 300, date: '2026-11-01T12:00:00.000Z' })).toBe(false);
      expect(isSeason2Match({ rankedDelta: -290, date: '2026-11-01T12:00:00.000Z' })).toBe(false);
    });

    it('identifies Season 2 matches based on date >= 2026-11-05T21:07:18.000Z', () => {
      expect(isSeason2Match({ date: '2026-11-05T21:07:18.000Z' })).toBe(true);
      expect(isSeason2Match({ date: '2026-11-06T12:00:00.000Z' })).toBe(true);
      expect(isSeason2Match({ date: '2026-11-05T21:07:17.000Z' })).toBe(false);
      expect(isSeason2Match({ start_time: 1793912838 })).toBe(true);
      expect(isSeason2Match({ start_time: 1793912837 })).toBe(false);
    });
  });

  describe('Storage persistence guarding', () => {
    beforeEach(() => {
      localStorage.clear();
      vi.restoreAllMocks();
    });

    const s1Match: Match = {
      id: 'match_s1_001',
      matchId: 131793874,
      date: '2026-11-05T17:34:33.000Z',
      side: 'hidden_king',
      myHeroId: 1,
      allies: [1, 2, 3, 4, 5, 6],
      enemies: [7, 8, 9, 10, 11, 12],
      result: 'win',
      rankedDelta: 300,
    };

    const s2Match: Match = {
      id: 'match_s2_001',
      matchId: 131897317,
      date: '2026-11-05T21:19:35.000Z',
      side: 'archmother',
      myHeroId: 2,
      allies: [1, 2, 3, 4, 5, 6],
      enemies: [7, 8, 9, 10, 11, 12],
      result: 'loss',
      rankedDelta: -350,
    };

    it('persistMatch blocks Season 2 matches from being saved to storage', async () => {
      const savedS1 = await persistMatch(s1Match, 903131553);
      expect(savedS1.id).toBe(s1Match.id);

      const savedS2 = await persistMatch(s2Match, 903131553);
      expect(savedS2.id).toBe(s2Match.id);

      const local = await fetchLocalMatches(903131553);
      expect(local.length).toBe(1);
      expect(local[0].id).toBe(s1Match.id);
      expect(local.some((m) => m.id === s2Match.id)).toBe(false);
    });

    it('persistMatches filters out Season 2 matches', async () => {
      const persisted = await persistMatches([s1Match, s2Match], 903131553);
      expect(persisted.length).toBe(1);
      expect(persisted[0].id).toBe(s1Match.id);

      const local = await fetchLocalMatches(903131553);
      expect(local.length).toBe(1);
      expect(local[0].id).toBe(s1Match.id);
    });

    it('importMatchesJson throws if import contains only Season 2 matches', async () => {
      const json = JSON.stringify({ matches: [s2Match] });
      await expect(importMatchesJson(json, 903131553)).rejects.toThrow(
        'Import data contains only Season 2 matches'
      );
    });

    it('importMatchesJson successfully imports Season 1 matches while ignoring Season 2 matches', async () => {
      const json = JSON.stringify({ matches: [s1Match, s2Match] });
      const count = await importMatchesJson(json, 903131553);
      expect(count).toBe(1);

      const local = await fetchLocalMatches(903131553);
      expect(local.length).toBe(1);
      expect(local[0].id).toBe(s1Match.id);
    });
  });

  describe('Deadlock API ingestion gating', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('fetchPlayerRankedMatches excludes Season 2 matches from API history', async () => {
      const mockRawMatches = [
        {
          account_id: 903131553,
          match_id: 131793874,
          hero_id: 1,
          hero_level: 1,
          start_time: 1793900073,
          game_mode: 1,
          match_mode: 4,
          player_team: 0,
          player_kills: 10,
          player_deaths: 2,
          player_assists: 5,
          net_worth: 20000,
          last_hits: 150,
          denies: 10,
          match_duration_s: 1800,
          match_result: 1,
          player_match_outcome: 1,
          ranked_delta: 300,
        },
        {
          account_id: 903131553,
          match_id: 131897317, // Season 2
          hero_id: 2,
          hero_level: 1,
          start_time: 1793913575,
          game_mode: 1,
          match_mode: 4,
          player_team: 1,
          player_kills: 5,
          player_deaths: 5,
          player_assists: 5,
          net_worth: 15000,
          last_hits: 100,
          denies: 5,
          match_duration_s: 1800,
          match_result: 0,
          player_match_outcome: 2,
          ranked_delta: -350,
        },
      ];

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockRawMatches,
      } as any);

      const results = await fetchPlayerRankedMatches(903131553);
      expect(results.length).toBe(1);
      expect(results[0].match_id).toBe(131793874);
    });

    it('fetchSingleMatchResultById returns season_2_blocked for Season 2 matches', async () => {
      const mockMetadataS2 = {
        match_info: {
          match_id: 131890899,
          start_time: 1793912838,
          match_mode: 4,
          players: [
            {
              account_id: 903131553,
              hero_id: 1,
              team: 0,
              player_rank_data: {
                desired_progress_change: -350,
              },
            },
          ],
        },
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockMetadataS2,
      } as any);

      const result = await fetchSingleMatchResultById(131890899, 903131553);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('season_2_blocked');
        expect(result.message).toContain('Season 2');
      }
    });
  });
});
