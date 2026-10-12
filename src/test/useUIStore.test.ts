/**
 * ============================================================================
 * TESTS UNITAIRES : useUIStore.ts (Gestion d'état UI & Hash Routing)
 * ============================================================================
 *
 * 🎯 CE QUE CE FICHIER TESTE :
 *  - La gestion de l'onglet actif et la synchronisation avec le hash de l'URL (#/history, etc.).
 *  - La navigation ciblée vers une série de matchs (navigateToStreak).
 *  - La réinitialisation des surbrillances (clearHighlight).
 *  - L'ouverture / fermeture des modales (Profile, ImportById).
 *
 * 🔍 GUIDE DE DIAGNOSTIC EN CAS D'ÉCHEC :
 *  1. Si setActiveTab ne met pas à jour le hash :
 *     -> CODE : Vérifier la fonction updateHash dans useUIStore.ts.
 *  2. Si navigateToStreak ne bascule pas sur l'onglet 'history' :
 *     -> CODE : Vérifier que navigateToStreak appelle bien updateHash('history') et set activeTab.
 * ============================================================================
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from '../stores/useUIStore';

describe('useUIStore – Navigation & Hash Routing', () => {
  beforeEach(() => {
    useUIStore.setState({
      activeTab: 'history',
      previewHeroId: null,
      highlightedMatchIds: null,
      highlightedStreakType: null,
      isProfileModalOpen: false,
      isImportByIdModalOpen: false,
    });
  });

  it('updates activeTab and syncs window hash on setActiveTab', () => {
    useUIStore.getState().setActiveTab('analytics');
    expect(useUIStore.getState().activeTab).toBe('analytics');
    expect(window.location.hash).toBe('#/analytics');
  });

  it('switches to draft assistant tab', () => {
    useUIStore.getState().setActiveTab('assistant');
    expect(useUIStore.getState().activeTab).toBe('assistant');
    expect(window.location.hash).toBe('#/assistant');
  });

  it('navigates to streak, sets highlight match IDs and activates history tab', () => {
    useUIStore.getState().setActiveTab('analytics');
    useUIStore.getState().navigateToStreak(['m1', 'm2', 'm3'], 'win');

    const state = useUIStore.getState();
    expect(state.activeTab).toBe('history');
    expect(state.highlightedMatchIds).toEqual(['m1', 'm2', 'm3']);
    expect(state.highlightedStreakType).toBe('win');
    expect(window.location.hash).toBe('#/history');
  });

  it('clears highlights with clearHighlight', () => {
    useUIStore.getState().navigateToStreak(['m1'], 'loss');
    useUIStore.getState().clearHighlight();

    const state = useUIStore.getState();
    expect(state.highlightedMatchIds).toBeNull();
    expect(state.highlightedStreakType).toBeNull();
  });

  it('manages modal visibility states', () => {
    useUIStore.getState().setProfileModalOpen(true);
    expect(useUIStore.getState().isProfileModalOpen).toBe(true);

    useUIStore.getState().setProfileModalOpen(false);
    expect(useUIStore.getState().isProfileModalOpen).toBe(false);

    useUIStore.getState().setImportByIdModalOpen(true);
    expect(useUIStore.getState().isImportByIdModalOpen).toBe(true);
  });
});
