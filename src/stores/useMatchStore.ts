import { create } from 'zustand';
import { Match } from '../types/match';
import {
  fetchAllMatches,
  removeMatch,
  exportMatchesJson,
  importMatchesJson,
} from '../services/storage';
import {
  removeMatchFromQueue,
  QueuedMatch,
} from '../services/matchQueue';

interface MatchState {
  matches: Match[];
  matchQueue: QueuedMatch[];
  editingMatch: Match | null;
  isLoading: boolean;

  setMatches: (matchesOrUpdater: Match[] | ((prev: Match[]) => Match[])) => void;
  setMatchQueue: (queue: QueuedMatch[]) => void;
  setEditingMatch: (match: Match | null) => void;

  loadMatches: () => Promise<void>;
  saveMatch: (savedMatch: Match) => void;
  deleteMatch: (id: string) => Promise<boolean>;
  exportMatches: () => Promise<string>;
  importMatches: (jsonText: string) => Promise<number>;
}

export const useMatchStore = create<MatchState>((set, get) => ({
  matches: [],
  matchQueue: [],
  editingMatch: null,
  isLoading: false,

  setMatches: (matchesOrUpdater) => {
    if (typeof matchesOrUpdater === 'function') {
      set((state) => ({ matches: matchesOrUpdater(state.matches) }));
    } else {
      set({ matches: matchesOrUpdater });
    }
  },

  setMatchQueue: (queue) => set({ matchQueue: queue }),

  setEditingMatch: (match) => set({ editingMatch: match }),

  loadMatches: async () => {
    set({ isLoading: true });
    try {
      const data = await fetchAllMatches();
      const sorted = [...data].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      set({ matches: sorted, isLoading: false });
    } catch (err) {
      console.error('Failed to load matches:', err);
      set({ isLoading: false });
    }
  },

  saveMatch: (savedMatch: Match) => {
    set((state) => {
      const existingIdx = state.matches.findIndex((m) => m.id === savedMatch.id);
      let nextList: Match[];
      if (existingIdx >= 0) {
        nextList = [...state.matches];
        nextList[existingIdx] = savedMatch;
      } else {
        nextList = [savedMatch, ...state.matches];
      }
      const sorted = nextList.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      return { matches: sorted };
    });
  },

  deleteMatch: async (id: string): Promise<boolean> => {
    if (id.startsWith('queue_')) {
      const matchId = parseInt(id.replace('queue_', ''), 10);
      if (!isNaN(matchId)) {
        removeMatchFromQueue(matchId);
      }
      return true;
    }

    const success = await removeMatch(id);
    if (success) {
      set((state) => ({
        matches: state.matches.filter((m) => m.id !== id),
        editingMatch: state.editingMatch?.id === id ? null : state.editingMatch,
      }));
      return true;
    }
    return false;
  },

  exportMatches: async () => {
    return await exportMatchesJson();
  },

  importMatches: async (jsonText: string) => {
    const count = await importMatchesJson(jsonText);
    await get().loadMatches();
    return count;
  },
}));

// ─── Selectors ───────────────────────────────────────────────────────────────

export const selectTotalMatches = (state: MatchState) => state.matches.length;

export const selectTotalWins = (state: MatchState) =>
  state.matches.filter((m) => m.result === 'win').length;

export const selectWinRate = (state: MatchState) => {
  const decided = state.matches.filter(
    (m) => m.result === 'win' || m.result === 'loss'
  ).length;
  const wins = selectTotalWins(state);
  return decided > 0 ? Math.round((wins / decided) * 100) : 0;
};

export const selectAllHistoryMatches = (state: MatchState): Match[] => {
  const unsyncedQueued = state.matchQueue.filter(
    (q) =>
      q.status !== 'synced' &&
      !state.matches.some(
        (m) =>
          m.matchId === q.matchId ||
          m.id === String(q.matchId) ||
          m.id === `dem_${q.matchId}`
      )
  );

  const placeholders: Match[] = unsyncedQueued.map((q) => ({
    id: `pending_${q.matchId}`,
    matchId: q.matchId,
    date: new Date(q.detectedAt).toISOString(),
    side: 'hidden_king',
    myHeroId: q.heroId || 0,
    allies: [],
    enemies: [],
    result: 'cancel',
    isIncomplete: true,
    queuedMatch: q,
  }));

  return [...state.matches, ...placeholders].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
};
