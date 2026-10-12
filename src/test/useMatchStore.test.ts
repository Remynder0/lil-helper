/**
 * ============================================================================
 * TESTS UNITAIRES : useMatchStore.ts (Gestion d'état des Matchs & Sélecteurs)
 * ============================================================================
 *
 * 🎯 CE QUE CE FICHIER TESTE :
 *  - Les sélecteurs de calculs dérivés : selectTotalMatches, selectTotalWins, selectWinRate.
 *  - L'insertion / mise à jour atomique de match (saveMatch).
 *  - L'agrégation de l'historique complet avec placeholders (selectAllHistoryMatches).
 *
 * 🔍 GUIDE DE DIAGNOSTIC EN CAS D'ÉCHEC :
 *  1. Si selectWinRate calcule un pourcentage faux :
 *     -> CODE : Vérifier que les matchs 'cancel' sont exclus du dénominateur dans selectWinRate.
 *  2. Si saveMatch ne met pas à jour un match existant mais l'ajoute en double :
 *     -> CODE : Vérifier la recherche d'index existingIdx = state.matches.findIndex(m => m.id === savedMatch.id).
 * ============================================================================
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  useMatchStore,
  selectTotalMatches,
  selectTotalWins,
  selectWinRate,
  selectAllHistoryMatches,
} from '../stores/useMatchStore';
import { Match } from '../types/match';

function makeMockMatch(id: string, date: string, result: 'win' | 'loss' | 'cancel'): Match {
  return {
    id,
    date,
    side: 'hidden_king',
    myHeroId: 1,
    allies: [2, 3, 4, 5, 6],
    enemies: [7, 8, 9, 10, 11, 12],
    result,
  };
}

describe('useMatchStore – Sélecteurs et mutations d\'état', () => {
  beforeEach(() => {
    useMatchStore.setState({
      matches: [],
      matchQueue: [],
      editingMatch: null,
      isLoading: false,
    });
  });

  it('calculates total matches, total wins, and winrate', () => {
    const mockList: Match[] = [
      makeMockMatch('1', '2024-01-01', 'win'),
      makeMockMatch('2', '2024-01-02', 'win'),
      makeMockMatch('3', '2024-01-03', 'loss'),
      makeMockMatch('4', '2024-01-04', 'cancel'),
    ];

    useMatchStore.setState({ matches: mockList });
    const state = useMatchStore.getState();

    expect(selectTotalMatches(state)).toBe(4);
    expect(selectTotalWins(state)).toBe(2);
    // 2 victoires sur 3 décidés (win + loss) = 67%
    expect(selectWinRate(state)).toBe(67);
  });

  it('saveMatch inserts a new match in sorted chronological order', () => {
    const m1 = makeMockMatch('1', '2024-01-01', 'win');
    const m2 = makeMockMatch('2', '2024-01-05', 'loss');

    useMatchStore.getState().saveMatch(m1);
    useMatchStore.getState().saveMatch(m2);

    const matches = useMatchStore.getState().matches;
    expect(matches).toHaveLength(2);
    // Tri décroissant : m2 (01-05) puis m1 (01-01)
    expect(matches[0].id).toBe('2');
    expect(matches[1].id).toBe('1');
  });

  it('saveMatch updates an existing match in place', () => {
    const m1 = makeMockMatch('1', '2024-01-01', 'win');
    useMatchStore.getState().saveMatch(m1);

    const updated = { ...m1, result: 'loss' as const };
    useMatchStore.getState().saveMatch(updated);

    const matches = useMatchStore.getState().matches;
    expect(matches).toHaveLength(1);
    expect(matches[0].result).toBe('loss');
  });

  it('selectAllHistoryMatches creates placeholders for unsynced queue items', () => {
    const m1 = makeMockMatch('100', '2024-01-01', 'win');
    useMatchStore.setState({
      matches: [m1],
      matchQueue: [
        {
          matchId: 200,
          detectedAt: new Date('2024-01-02').getTime(),
          status: 'pending',
          attempts: 0,
        },
      ],
    });

    const all = selectAllHistoryMatches(useMatchStore.getState());
    expect(all).toHaveLength(2);
    // Le match en file d'attente (200) a un placeholder
    const placeholder = all.find((m) => m.id === 'pending_200');
    expect(placeholder).toBeDefined();
    expect(placeholder?.isIncomplete).toBe(true);
  });
});
