import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import {
  isSupabaseConfigured,
  getSupabaseClient,
  configureSupabase,
  resetSupabaseConfig,
} from '../services/storage/supabaseClient';
import {
  fetchCloudMatchHistory,
  pushCloudMatchHistory,
} from '../services/storage/cloudSync';
import {
  fetchAllMatches,
  persistMatch,
  combineMatchesWithPriority,
} from '../services/storage/storage';
import { Match } from '../types/match';

describe('CloudSync & Supabase Priority Architecture', () => {
  beforeEach(() => {
    localStorage.clear();
    configureSupabase(null, null);
  });

  afterAll(() => {
    resetSupabaseConfig();
  });

  it('reports unconfigured when environment variables are empty', () => {
    expect(isSupabaseConfigured()).toBe(false);
    expect(getSupabaseClient()).toBeNull();
  });

  it('safely returns found: false when fetching unconfigured cloud history', async () => {
    const res = await fetchCloudMatchHistory(12345678);
    expect(res.found).toBe(false);
    expect(res.matches).toEqual([]);
  });

  it('safely returns false when pushing to unconfigured cloud history', async () => {
    const res = await pushCloudMatchHistory(12345678, []);
    expect(res).toBe(false);
  });

  it('prioritizes local storage seamlessly when Supabase is unconfigured', async () => {
    const dummyMatch: Match = {
      id: 'test_cloud_fallback_1',
      date: new Date().toISOString(),
      side: 'hidden_king',
      myHeroId: 1,
      allies: [2, 3, 4, 5, 6],
      enemies: [7, 8, 9, 10, 11, 12],
      result: 'win',
    };

    await persistMatch(dummyMatch, 99887766);
    const loaded = await fetchAllMatches(99887766);

    expect(loaded.length).toBe(1);
    expect(loaded[0].id).toBe('test_cloud_fallback_1');
  });

  it('never syncs guest mode (null accountId) to Supabase', async () => {
    const guestMatch: Match = {
      id: 'guest_local_1',
      date: new Date().toISOString(),
      side: 'archmother',
      myHeroId: 3,
      allies: [1, 2, 4, 5, 6],
      enemies: [7, 8, 9, 10, 11, 12],
      result: 'loss',
    };

    await persistMatch(guestMatch, null);
    const guestMatches = await fetchAllMatches(null);

    expect(guestMatches.some((m) => m.id === 'guest_local_1')).toBe(true);
  });

  it('routes fetch through server proxy when key starts with sb_secret_', async () => {
    configureSupabase('https://test.supabase.co', 'sb_secret_dummy_secret_key');
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        found: true,
        matches: [{ id: 'match_via_proxy', date: '2026-10-15T12:00:00Z', result: 'win', side: 'hidden_king', allies: [], enemies: [] }],
      }),
    });
    globalThis.fetch = fetchMock;

    try {
      const res = await fetchCloudMatchHistory(99887766);
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/cloud/fetch?account_id=99887766'));
      expect(res.found).toBe(true);
      expect(res.matches.length).toBe(1);
      expect(res.matches[0].id).toBe('match_via_proxy');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('routes push through server proxy when key starts with sb_secret_', async () => {
    configureSupabase('https://test.supabase.co', 'sb_secret_dummy_secret_key');
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, count: 1 }),
    });
    globalThis.fetch = fetchMock;

    try {
      const success = await pushCloudMatchHistory(99887766, [
        { id: 'match_via_proxy', date: '2026-10-15T12:00:00Z', result: 'win', side: 'hidden_king', allies: [], enemies: [] } as any,
      ]);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/cloud/push'),
        expect.objectContaining({ method: 'POST' })
      );
      expect(success).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('automatically triggers pushCloudMatchHistory when persistMatch is called for connected profile', async () => {
    configureSupabase('https://test.supabase.co', 'sb_secret_dummy_secret_key');
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, count: 1 }),
    });
    globalThis.fetch = fetchMock;

    try {
      const match: Match = {
        id: 'auto_sync_test_match_1',
        date: new Date().toISOString(),
        side: 'hidden_king',
        myHeroId: 1,
        allies: [2, 3, 4, 5, 6],
        enemies: [7, 8, 9, 10, 11, 12],
        result: 'win',
      };

      await persistMatch(match, 99887766);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/cloud/push'),
        expect.objectContaining({ method: 'POST' })
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  describe('Storage Combination & Priority Logic', () => {
    it('deduplicates matches using canonical match keys and prioritizes higher storage', () => {
      const localMatch: Match = {
        id: 'local_1',
        matchId: 1001,
        date: '2026-10-15T12:00:00Z',
        side: 'hidden_king',
        myHeroId: 1,
        result: 'win',
        allies: [2, 3, 4, 5, 6],
        enemies: [7, 8, 9, 10, 11, 12],
        notes: 'Hand-written local notes',
        lane: 'blue',
      };

      const cloudMatch: Match = {
        id: 'api_1001',
        matchId: 1001,
        date: '2026-10-15T12:00:00Z',
        side: 'hidden_king',
        myHeroId: 1,
        result: 'win',
        allies: [2, 3, 4, 5, 6],
        enemies: [7, 8, 9, 10, 11, 12],
        durationSeconds: 1850,
        rankedProgress: 850,
      };

      const combined = combineMatchesWithPriority([localMatch], [cloudMatch]);

      expect(combined.length).toBe(1);
      // Conflicting or new fields from higher priority (cloudMatch) are present
      expect(combined[0].durationSeconds).toBe(1850);
      expect(combined[0].rankedProgress).toBe(850);
      // Non-conflicting local annotations are preserved
      expect(combined[0].notes).toBe('Hand-written local notes');
      expect(combined[0].lane).toBe('blue');
    });

    it('unions matches from Local and Cloud storage without losing disjoint records', async () => {
      configureSupabase('https://test.supabase.co', 'sb_secret_dummy_secret_key');
      const originalFetch = globalThis.fetch;

      const localMatchOnly: Match = {
        id: 'match_only_local',
        matchId: 2001,
        date: '2026-10-10T10:00:00Z',
        side: 'hidden_king',
        myHeroId: 1,
        result: 'win',
        allies: [2, 3, 4, 5, 6],
        enemies: [7, 8, 9, 10, 11, 12],
        notes: 'Only on disk/local',
      };

      const sharedMatchLocal: Match = {
        id: 'match_shared',
        matchId: 2002,
        date: '2026-10-11T10:00:00Z',
        side: 'hidden_king',
        myHeroId: 1,
        result: 'win',
        allies: [2, 3, 4, 5, 6],
        enemies: [7, 8, 9, 10, 11, 12],
        notes: 'Shared notes from disk',
      };

      const sharedMatchCloud: Match = {
        id: 'api_2002',
        matchId: 2002,
        date: '2026-10-11T10:00:00Z',
        side: 'hidden_king',
        myHeroId: 1,
        result: 'win',
        allies: [2, 3, 4, 5, 6],
        enemies: [7, 8, 9, 10, 11, 12],
        rankedProgress: 920,
      };

      const cloudMatchOnly: Match = {
        id: 'api_2003',
        matchId: 2003,
        date: '2026-10-12T10:00:00Z',
        side: 'archmother',
        myHeroId: 2,
        result: 'loss',
        allies: [1, 3, 4, 5, 6],
        enemies: [7, 8, 9, 10, 11, 12],
        rankedProgress: 880,
      };

      // Put local matches in storage
      await persistMatch(localMatchOnly, 778899);
      await persistMatch(sharedMatchLocal, 778899);

      // Cloud fetch returns sharedMatchCloud + cloudMatchOnly
      const fetchMock = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/cloud/fetch')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              found: true,
              matches: [sharedMatchCloud, cloudMatchOnly],
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, count: 3 }),
        });
      });
      globalThis.fetch = fetchMock;

      try {
        const combinedResult = await fetchAllMatches(778899);

        // Combined should have 3 matches: 2003, 2002, 2001
        expect(combinedResult.length).toBe(3);

        const match2002 = combinedResult.find((m) => m.matchId === 2002);
        expect(match2002).toBeDefined();
        // Priority from cloud
        expect(match2002?.rankedProgress).toBe(920);
        // Preserved local note
        expect(match2002?.notes).toBe('Shared notes from disk');

        const match2001 = combinedResult.find((m) => m.matchId === 2001);
        expect(match2001).toBeDefined();

        const match2003 = combinedResult.find((m) => m.matchId === 2003);
        expect(match2003).toBeDefined();
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});

