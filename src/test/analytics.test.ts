/**
 * ============================================================================
 * TESTS UNITAIRES : analytics/global.ts (Statistiques Globales & Héros)
 * ============================================================================
 *
 * 🎯 CE QUE CE FICHIER TESTE :
 *  - Le moteur d'analyse statistique globale de Deadlock Analyse :
 *      * Calcul du taux de victoire global (winRate) : les matchs annulés ('cancel')
 *        doivent STRICTEMENT être exclus du dénominateur (décidés = victoires + défaites).
 *      * Calcul chronologique des séries de victoires (bestWinStreak) et de défaites (worstLoseStreak) :
 *        les matchs doivent être triés par date croissante pour refléter la véritable chronologie.
 *      * Agrégation des performances par héros (calculateHeroPerformance) :
 *        comptage des victoires, défaites et calcul de winrate individuel par heroId.
 *
 * 🔍 GUIDE DE DIAGNOSTIC EN CAS D'ÉCHEC :
 *  1. Si le test de winrate avec match annulé échoue (ex: 33% au lieu de 50%) :
 *     -> CODE : Les matchs annulés ont été inclus par erreur dans le dénominateur de calcul
 *        de winRate dans global.ts (formule attendue : totalWins / (totalWins + totalLosses)).
 *  2. Si un test de streak échoue (mauvais matchIds ou mauvais count) :
 *     -> CODE : Vérifier que le tri chronologique (...sort((a,b) => date - date)) est bien effectué
 *        avant de parcourir la liste dans calculateGlobalStats.
 *  3. Si une propriété sur worstLoseStreak est 'undefined' :
 *     -> RAPPEL NOMMAGE : L'interface TypeScript s'appelle 'worstLoseStreak' (avec 'Lose' et non 'Loss').
 * ============================================================================
 */

import { describe, it, expect } from 'vitest';
import { calculateGlobalStats, calculateHeroPerformance } from '../services/analytics/global';
import { Match } from '../types/match';

/**
 * Utilitaire pour fabriquer un match avec les champs requis pour le calcul de statistiques.
 */
function createMatch(
  id: string,
  date: string,
  result: 'win' | 'loss' | 'cancel',
  myHeroId: number = 1,
  side: 'hidden_king' | 'archmother' = 'hidden_king'
): Match {
  return {
    id,
    date,
    side,
    myHeroId,
    allies: [2, 3, 4, 5, 6],
    enemies: [7, 8, 9, 10, 11, 12],
    result,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 1. STATISTIQUES GLOBALES (calculateGlobalStats)
// ────────────────────────────────────────────────────────────────────────────
describe('calculateGlobalStats – Statistiques globales du profil', () => {
  // Cas liste vide : l'application démarre sans historique
  // Doit retourner 0 partout sans générer de division par zéro (NaN).
  // En cas d'échec : Vérifier la garde decided > 0 ? ... : 0 dans calculateGlobalStats.
  it('handles empty match list', () => {
    const stats = calculateGlobalStats([]);
    expect(stats.totalMatches).toBe(0);
    expect(stats.totalWins).toBe(0);
    expect(stats.totalLosses).toBe(0);
    expect(stats.totalCancels).toBe(0);
    expect(stats.winRate).toBe(0);
    expect(stats.bestWinStreak.count).toBe(0);
    expect(stats.worstLoseStreak.count).toBe(0);
  });

  // Règle métier : les matchs annulés ('cancel') sont comptés dans totalMatches et totalCancels,
  // mais sont EXCLUS du dénominateur du winrate.
  // Exemple : 1 victoire, 1 défaite, 1 match annulé -> 1 win sur 2 matchs décidés = 50% de winrate.
  // En cas d'échec : Si le résultat vaut 33%, le dénominateur inclut à tort les matchs annulés.
  it('calculates win rate excluding cancelled matches', () => {
    const matches: Match[] = [
      createMatch('1', '2024-01-01', 'win'),
      createMatch('2', '2024-01-02', 'loss'),
      createMatch('3', '2024-01-03', 'cancel'),
    ];
    const stats = calculateGlobalStats(matches);
    expect(stats.totalMatches).toBe(3);
    expect(stats.totalWins).toBe(1);
    expect(stats.totalLosses).toBe(1);
    expect(stats.totalCancels).toBe(1);
    expect(stats.winRate).toBe(50);
  });

  // Calcul des séries consécutives ordonnées chronologiquement :
  // Ordre temporel :
  // 01-01 : Win (streak win = 1)
  // 01-02 : Win (streak win = 2)
  // 01-03 : Loss (streak loss = 1, streak win réinitialisé)
  // 01-04 : Win (streak win = 1)
  // 01-05 : Win (streak win = 2)
  // 01-06 : Win (streak win = 3 -> meilleur streak historique !)
  // En cas d'échec : Le tri par date avant le calcul de streak est absent ou inverse.
  it('computes win streak and loss streak chronologically', () => {
    const matches: Match[] = [
      createMatch('1', '2024-01-01', 'win'),
      createMatch('2', '2024-01-02', 'win'),
      createMatch('3', '2024-01-03', 'loss'),
      createMatch('4', '2024-01-04', 'win'),
      createMatch('5', '2024-01-05', 'win'),
      createMatch('6', '2024-01-06', 'win'),
    ];
    const stats = calculateGlobalStats(matches);
    expect(stats.bestWinStreak.count).toBe(3);
    expect(stats.bestWinStreak.matchIds).toEqual(['4', '5', '6']);
    expect(stats.worstLoseStreak.count).toBe(1);
    expect(stats.worstLoseStreak.matchIds).toEqual(['3']);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 2. PERFORMANCES PAR HÉROS (calculateHeroPerformance)
// ────────────────────────────────────────────────────────────────────────────
describe('calculateHeroPerformance – Agrégation des performances par personnage', () => {
  // Agrège les victoires et défaites pour chaque heroId joué
  // Hero 1 : 2 victoires, 1 défaite sur 3 matchs -> 67% de winrate (arrondi)
  // Hero 2 : 1 victoire sur 1 match -> 100% de winrate
  // En cas d'échec : Vérifier la logique de regroupement par heroId dans global.ts.
  it('aggregates hero matches and win rates', () => {
    const matches: Match[] = [
      createMatch('1', '2024-01-01', 'win', 1),
      createMatch('2', '2024-01-02', 'win', 1),
      createMatch('3', '2024-01-03', 'loss', 1),
      createMatch('4', '2024-01-04', 'win', 2),
    ];
    const performances = calculateHeroPerformance(matches);
    expect(performances.length).toBe(2);

    const hero1 = performances.find((p) => p.heroId === 1);
    expect(hero1).toBeDefined();
    expect(hero1?.matches).toBe(3);
    expect(hero1?.wins).toBe(2);
    expect(hero1?.losses).toBe(1);
    expect(hero1?.winRate).toBe(67);

    const hero2 = performances.find((p) => p.heroId === 2);
    expect(hero2).toBeDefined();
    expect(hero2?.matches).toBe(1);
    expect(hero2?.wins).toBe(1);
    expect(hero2?.winRate).toBe(100);
  });
});
