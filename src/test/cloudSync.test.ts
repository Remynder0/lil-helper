import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import {
  isSupabaseConfigured,
  getSupabaseClient,
  configureSupabase,
  resetSupabaseConfig,
} from '../services/supabaseClient';
import {
  fetchCloudMatchHistory,
  pushCloudMatchHistory,
} from '../services/cloudSync';
import { fetchAllMatches, persistMatch } from '../services/storage';
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
});

