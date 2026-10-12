import { create } from 'zustand';

export type AppTab = 'log_match' | 'history' | 'analytics' | 'assistant' | 'logs';

const VALID_TABS: Record<string, AppTab> = {
  history: 'history',
  analytics: 'analytics',
  assistant: 'assistant',
  logs: 'logs',
  log_match: 'log_match',
};

function getTabFromHash(): AppTab {
  if (typeof window === 'undefined') return 'history';
  const hash = window.location.hash.replace(/^#\/?/, '').toLowerCase();
  return VALID_TABS[hash] || 'history';
}

function updateHash(tab: AppTab): void {
  if (typeof window === 'undefined') return;
  const currentHash = window.location.hash.replace(/^#\/?/, '').toLowerCase();
  if (currentHash !== tab) {
    window.location.hash = `#/${tab}`;
  }
}

interface UIState {
  // Navigation & Routing
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;

  // Streak & Match Highlights
  previewHeroId: number | null;
  setPreviewHeroId: (id: number | null) => void;
  highlightedMatchIds: string[] | null;
  setHighlightedMatchIds: (ids: string[] | null) => void;
  highlightedStreakType: 'win' | 'loss' | null;
  setHighlightedStreakType: (type: 'win' | 'loss' | null) => void;
  navigateToStreak: (matchIds: string[], type: 'win' | 'loss') => void;
  clearHighlight: () => void;

  // Modals
  isProfileModalOpen: boolean;
  setProfileModalOpen: (open: boolean) => void;
  isImportByIdModalOpen: boolean;
  setImportByIdModalOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => {
  // Listen to browser back/forward or manual hash change
  if (typeof window !== 'undefined') {
    window.addEventListener('hashchange', () => {
      const tab = getTabFromHash();
      set({ activeTab: tab });
    });
  }

  const initialTab = getTabFromHash();
  // Ensure hash is set on launch
  updateHash(initialTab);

  return {
    activeTab: initialTab,
    setActiveTab: (tab) => {
      updateHash(tab);
      set({ activeTab: tab });
    },

    previewHeroId: null,
    setPreviewHeroId: (id) => set({ previewHeroId: id }),

    highlightedMatchIds: null,
    setHighlightedMatchIds: (ids) => set({ highlightedMatchIds: ids }),

    highlightedStreakType: null,
    setHighlightedStreakType: (type) => set({ highlightedStreakType: type }),

    navigateToStreak: (matchIds, type) => {
      updateHash('history');
      set({
        highlightedMatchIds: matchIds,
        highlightedStreakType: type,
        activeTab: 'history',
      });
    },

    clearHighlight: () =>
      set({
        highlightedMatchIds: null,
        highlightedStreakType: null,
      }),

    isProfileModalOpen: false,
    setProfileModalOpen: (open) => set({ isProfileModalOpen: open }),

    isImportByIdModalOpen: false,
    setImportByIdModalOpen: (open) => set({ isImportByIdModalOpen: open }),
  };
});
