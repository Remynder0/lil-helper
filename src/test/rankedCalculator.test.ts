/**
 * ============================================================================
 * TESTS UNITAIRES : rankedCalculator.ts (Progression Classée Deadlock)
 * ============================================================================
 *
 * 🎯 CE QUE CE FICHIER TESTE :
 *  - Le barème officiel des victoires consécutives (WINSTREAK_POINTS).
 *  - Le calcul du streak de victoires avant une date donnée (calculateWinStreakBefore).
 *  - Le calcul complet de progression ranked (calculateRankedProgression) :
 *      * Paliers de points par victoire (+300 à +430 selon streak).
 *      * Paliers de sous-rangs (1000 pts/sous-rang) et de rangs (6000 pts/rang).
 *      * Mécanique des boucliers anti-rétrogradation (absorption, consommation, réinitialisation).
 *      * Cas limites (0 pts minimum, matchs annulés, seuils exacts).
 *
 * 🔍 GUIDE DE DIAGNOSTIC EN CAS D'ÉCHEC :
 *  1. Si un test de streak échoue (ex: attendu 370 mais reçu 390) :
 *     -> LOGIQUE DU TEST : Vérifier que 'prevMatch' n'est pas déjà comptabilisé comme victoire.
 *        Rappel : calculateWinStreakBefore compte TOUS les matchs antérieurs avec result='win'.
 *  2. Si un test de points/delta échoue après une défaite :
 *     -> CODE : Vérifier si la logique de plancher (subrankFloor = Math.floor(pts/1000)*1000)
 *        ou la consommation de bouclier dans rankedCalculator.ts a été altérée.
 *  3. Si un test de promotion échoue :
 *     -> RÈGLE MÉTIER : En sous-rang 1 (I), Deadlock accorde 5 boucliers. Pour les sous-rangs
 *        2 à 6, Deadlock accorde 2 boucliers.
 * ============================================================================
 */

import { describe, it, expect } from 'vitest';
import {
  calculateRankedProgression,
  calculateWinStreakBefore,
  WINSTREAK_POINTS,
} from '../services/rankedCalculator';
import { Match } from '../types/match';

/**
 * Utilitaire de test pour créer un match minimaliste avec progression ranked.
 */
function makeMatch(
  id: string,
  date: string,
  result: 'win' | 'loss' | 'cancel',
  rankedProgress?: number,
  rankedDemotionProtection?: number,
  rankedRank?: number,
  rankedSubrank?: number
): Match {
  return {
    id,
    date,
    side: 'hidden_king',
    myHeroId: 1,
    allies: [2, 3, 4, 5, 6],
    enemies: [7, 8, 9, 10, 11, 12],
    result,
    rankedProgress: rankedProgress ?? null,
    rankedDemotionProtection: rankedDemotionProtection ?? null,
    rankedRank: rankedRank ?? null,
    rankedSubrank: rankedSubrank ?? null,
  };
}

/**
 * Match précédent de référence (base de départ pour calculer le delta du match suivant).
 * Attention : par défaut result='win', donc il compte pour 1 victoire dans un streak ultérieur !
 */
function prevMatch(progress: number, shields: number = 2, rank?: number, subrank?: number) {
  return makeMatch('prev', '2024-01-01T00:00:00Z', 'win', progress, shields, rank, subrank);
}

// ────────────────────────────────────────────────────────────────────────────
// 1. BARÈME DES POINTS DE VICTOIRES CONSÉCUTIVES (WINSTREAK_POINTS)
// ────────────────────────────────────────────────────────────────────────────
describe('WINSTREAK_POINTS – Barème officiel Deadlock', () => {
  // Ce test garantit que le tableau des paliers contient bien 6 entrées
  // En cas d'échec : La constante WINSTREAK_POINTS dans rankedCalculator.ts a été modifiée par erreur.
  it('has 6 entries', () => {
    expect(WINSTREAK_POINTS).toHaveLength(6);
  });

  // Valide les valeurs exactes : victoires 1 et 2 (+300), 3 (+370), 4 (+390), 5 (+410), 6+ (+430)
  // En cas d'échec : Si Valve modifie les gains de streak dans une mise à jour, mettre à jour le code ET ce test.
  it('first two are 300, then increases to 430', () => {
    expect(WINSTREAK_POINTS[0]).toBe(300);
    expect(WINSTREAK_POINTS[1]).toBe(300);
    expect(WINSTREAK_POINTS[2]).toBe(370);
    expect(WINSTREAK_POINTS[3]).toBe(390);
    expect(WINSTREAK_POINTS[4]).toBe(410);
    expect(WINSTREAK_POINTS[5]).toBe(430);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 2. COMPTAGE DU NOMBRE DE VICTOIRES AVANT UNE DATE (calculateWinStreakBefore)
// ────────────────────────────────────────────────────────────────────────────
describe('calculateWinStreakBefore – Calcul de la série de victoires antérieures', () => {
  // Cas sans antécédent : streak = 0
  // En cas d'échec : Problème dans la gestion de tableau vide dans calculateWinStreakBefore.
  it('returns 0 with no prior matches', () => {
    const result = calculateWinStreakBefore('2024-01-05T00:00:00Z', []);
    expect(result).toBe(0);
  });

  // Cas normal : 3 victoires consécutives avant la date cible -> streak = 3
  // En cas d'échec : Problème de filtrage de date (< matchDate) ou de tri chronologique décroissant.
  it('counts consecutive wins before the given date', () => {
    const matches: Match[] = [
      makeMatch('m1', '2024-01-01T00:00:00Z', 'win'),
      makeMatch('m2', '2024-01-02T00:00:00Z', 'win'),
      makeMatch('m3', '2024-01-03T00:00:00Z', 'win'),
    ];
    expect(calculateWinStreakBefore('2024-01-04T00:00:00Z', matches)).toBe(3);
  });

  // Cas rupture de série : dès qu'une défaite est rencontrée en remontant l'historique, le comptage s'arrête
  // En cas d'échec : Le code continue de compter au lieu de faire un 'break' sur 'loss'.
  it('stops counting at a loss', () => {
    const matches: Match[] = [
      makeMatch('m1', '2024-01-01T00:00:00Z', 'win'),
      makeMatch('m2', '2024-01-02T00:00:00Z', 'loss'),
      makeMatch('m3', '2024-01-03T00:00:00Z', 'win'),
      makeMatch('m4', '2024-01-04T00:00:00Z', 'win'),
    ];
    // En remontant depuis 01-05 : m4 (win), m3 (win), m2 (loss -> STOP). Résultat attendu = 2.
    expect(calculateWinStreakBefore('2024-01-05T00:00:00Z', matches)).toBe(2);
  });

  // Règle métier : les matchs annulés (AFK / safe to leave) ne brisent PAS la série
  // En cas d'échec : Le filtre m.result !== 'cancel' a sauté dans calculateWinStreakBefore.
  it('ignores cancelled matches in streak counting', () => {
    const matches: Match[] = [
      makeMatch('m1', '2024-01-01T00:00:00Z', 'win'),
      makeMatch('m2', '2024-01-02T00:00:00Z', 'cancel'),
      makeMatch('m3', '2024-01-03T00:00:00Z', 'win'),
    ];
    // Le match annulé m2 est ignoré : m3 (win) + m1 (win) -> streak = 2
    expect(calculateWinStreakBefore('2024-01-04T00:00:00Z', matches)).toBe(2);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 3. PROGRESSION RANKED SANS MATCH PRÉCÉDENT
// ────────────────────────────────────────────────────────────────────────────
describe('calculateRankedProgression – Premier match / aucun historique classé', () => {
  // Si aucun match préalable ne contient rankedProgress, le calculateur ne peut pas deviner le score initial
  // En cas d'échec : calculateRankedProgression ne renvoie plus d'objet avec champs nulls et note explicative.
  it('returns all nulls when no previous ranked match exists', () => {
    const result = calculateRankedProgression('win', '2024-01-02T00:00:00Z', []);
    expect(result.rankedProgress).toBeNull();
    expect(result.rankedDelta).toBeNull();
    expect(result.summaryNote).toContain('Initial ranked data not found');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 4. BONUS DE SÉRIE DE VICTOIRES (WINSTREAK)
// ────────────────────────────────────────────────────────────────────────────
describe('calculateRankedProgression – Bonus de points selon la série', () => {
  // 1ère victoire (streak antérieur = 0 ou 1) : gain standard de +300 pts
  // En cas d'échec : Vérifier la formule streakIndex ou le tableau WINSTREAK_POINTS.
  it('awards +300 pts on first win (no streak)', () => {
    const matches = [prevMatch(3000, 2)];
    const result = calculateRankedProgression('win', '2024-01-02T00:00:00Z', matches);
    expect(result.rankedDelta).toBe(300);
    expect(result.rankedProgress).toBe(3300);
  });

  // 3ème victoire consécutive :
  // Antécédents : prevMatch (win @01-01) + w1 (win @01-02) = 2 victoires antérieures -> index 2 -> +370 pts
  // ⚠️ ATTENTION TEST : Si ce test échoue avec +390, c'est qu'un 3ème match de win a été injecté dans matches (off-by-one test).
  it('awards +370 pts on 3rd consecutive win (streak index 2)', () => {
    const matches = [
      prevMatch(3000, 2),
      makeMatch('w1', '2024-01-02T00:00:00Z', 'win'),
    ];
    const result = calculateRankedProgression('win', '2024-01-03T00:00:00Z', matches);
    expect(result.rankedDelta).toBe(370);
  });

  // 5ème victoire consécutive :
  // Antécédents : prevMatch (win) + w1 + w2 + w3 = 4 victoires antérieures -> index 4 -> +410 pts
  it('awards +410 pts on 5th consecutive win (streak index 4)', () => {
    const matches = [
      prevMatch(3000, 2),
      makeMatch('w1', '2024-01-02T00:00:00Z', 'win'),
      makeMatch('w2', '2024-01-03T00:00:00Z', 'win'),
      makeMatch('w3', '2024-01-04T00:00:00Z', 'win'),
    ];
    const result = calculateRankedProgression('win', '2024-01-05T00:00:00Z', matches);
    expect(result.rankedDelta).toBe(410);
  });

  // 6ème victoire consécutive et au-delà :
  // Le bonus plafonne à l'index 5 (+430 pts max)
  // En cas d'échec : Math.min(streak, WINSTREAK_POINTS.length - 1) ne plafonne plus correctement.
  it('awards +430 pts on 6th+ consecutive win (streak capped at index 5)', () => {
    const matches = [
      prevMatch(3000, 2),
      makeMatch('w1', '2024-01-02T00:00:00Z', 'win'),
      makeMatch('w2', '2024-01-03T00:00:00Z', 'win'),
      makeMatch('w3', '2024-01-04T00:00:00Z', 'win'),
      makeMatch('w4', '2024-01-05T00:00:00Z', 'win'),
      makeMatch('w5', '2024-01-06T00:00:00Z', 'win'),
    ];
    const result = calculateRankedProgression('win', '2024-01-07T00:00:00Z', matches);
    expect(result.rankedDelta).toBe(430);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 5. PALIERS DE SOUS-RANGS ET PROMOTIONS
// ────────────────────────────────────────────────────────────────────────────
describe('calculateRankedProgression – Franchissement de paliers et promotions', () => {
  // Passage de sous-rang à l'intérieur d'un même rang (1000 pts par sous-rang)
  // 3900 pts + 300 pts = 4200 pts -> Sous-rang passe de 4 à 5
  // En cas d'échec : La formule Math.floor((pts % 6000) / 1000) + 1 est erronée.
  it('increments subrank when crossing a 1000-pt boundary on win', () => {
    const matches = [prevMatch(3900, 2)];
    const result = calculateRankedProgression('win', '2024-01-02T00:00:00Z', matches);
    expect(result.rankedProgress).toBe(4200);
    expect(result.rankedRank).toBe(1);
    expect(result.rankedSubrank).toBe(5);
  });

  // Promotion de rang complet : passage du seuil des 6000 pts
  // 5800 pts + 300 pts = 6100 pts -> Passe de Rang 1 (Sous-rang 6) à Rang 2 (Sous-rang 1)
  // En cas d'échec : La formule Math.floor(pts / 6000) + 1 est erronée.
  it('promotes to next rank when crossing the 6000-pt boundary', () => {
    const matches = [prevMatch(5800, 2)];
    const result = calculateRankedProgression('win', '2024-01-02T00:00:00Z', matches);
    expect(result.rankedProgress).toBe(6100);
    expect(result.rankedRank).toBe(2);
    expect(result.rankedSubrank).toBe(1);
  });

  // Règle officielle Deadlock : une promotion en Sous-rang I (1) attribue 5 boucliers de protection
  // En cas d'échec : La condition newSubrank === 1 ? 5 : 2 n'est plus respectée.
  it('awards 5 demotion shields on Subrank I (subrank === 1)', () => {
    const matches = [prevMatch(5800, 2)];
    const result = calculateRankedProgression('win', '2024-01-02T00:00:00Z', matches);
    expect(result.rankedDemotionProtection).toBe(5);
  });

  // Promotion vers un sous-rang supérieur différent de I (ex: 1 -> 2) : réinitialisation à 2 boucliers
  // En cas d'échec : remainingShields n'a pas été remis à 2.
  it('awards 2 demotion shields on promotion to non-Subrank-I', () => {
    const matches = [prevMatch(900, 2, 1, 1)];
    const result = calculateRankedProgression('win', '2024-01-02T00:00:00Z', matches);
    expect(result.rankedProgress).toBe(1200);
    expect(result.rankedSubrank).toBe(2);
    expect(result.rankedDemotionProtection).toBe(2);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 6. MÉCANIQUE DES BOUCLIERS DE RÉTROGRADATION (SHIELDS)
// ────────────────────────────────────────────────────────────────────────────
describe('calculateRankedProgression – Boucliers anti-rétrogradation', () => {
  // Cas d'absorption par bouclier :
  // À 2100 pts (plancher de sous-rang à 2000), une perte théorique de -300 amènerait à 1800 (rétrogradation).
  // Avec des boucliers restants, le bouclier absorbe : score bloqué à 2000, perte effective limitée à -100, 1 bouclier consommé.
  // En cas d'échec : Le bouclier n'a pas consommé, le score n'a pas été calé au plancher, ou delta != -100.
  it('consumes a shield when loss would go below subrank floor', () => {
    const matches = [prevMatch(2100, 2)];
    const result = calculateRankedProgression('loss', '2024-01-02T00:00:00Z', matches);
    expect(result.rankedConsumedDemotionProtection).toBe(true);
    expect(result.rankedDemotionProtection).toBe(1); // 2 -> 1
    expect(result.rankedProgress).toBe(2000); // calé au plancher 2000
    expect(result.rankedDelta).toBe(-100); // 2100 - 2000 = -100
  });

  // Cas normal sans consommation :
  // À 2500 pts, perdre 300 amène à 2200 (toujours au-dessus du plancher 2000). Aucun bouclier n'est dépensé.
  // En cas d'échec : Un bouclier a été consommé à tort alors que la défaite restait dans le sous-rang.
  it('does NOT consume a shield for a normal loss within subrank', () => {
    const matches = [prevMatch(2500, 2)];
    const result = calculateRankedProgression('loss', '2024-01-02T00:00:00Z', matches);
    expect(result.rankedConsumedDemotionProtection).toBe(false);
    expect(result.rankedDemotionProtection).toBe(2);
    expect(result.rankedProgress).toBe(2200);
    expect(result.rankedDelta).toBe(-300);
  });

  // Cas rétrogradation sans bouclier :
  // À 2100 pts avec 0 bouclier restant, perdre 300 fait chuter à 1800 (rétrogradation sous-rang inférieur).
  // En cas d'échec : Le joueur n'a pas été rétrogradé ou la perte n'a pas été de -300.
  it('demotes without shield when shields are exhausted', () => {
    const matches = [prevMatch(2100, 0)];
    const result = calculateRankedProgression('loss', '2024-01-02T00:00:00Z', matches);
    expect(result.rankedConsumedDemotionProtection).toBe(false);
    expect(result.rankedProgress).toBe(1800);
    expect(result.rankedDelta).toBe(-300);
  });

  // Règle officielle : rétrograder vers un Sous-rang I accorde 5 boucliers de sécurité pour protéger le palier
  // En cas d'échec : La réinitialisation à 5 boucliers sur demotion vers subrank 1 a échoué.
  it('awards 5 shields on demotion to Subrank I', () => {
    const matches = [prevMatch(1000, 0)];
    const result = calculateRankedProgression('loss', '2024-01-02T00:00:00Z', matches);
    expect(result.rankedProgress).toBe(700);
    expect(result.rankedSubrank).toBe(1);
    expect(result.rankedDemotionProtection).toBe(5);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 7. CAS LIMITES (EDGE CASES)
// ────────────────────────────────────────────────────────────────────
describe('calculateRankedProgression – Cas limites', () => {
  // Score minimum = 0 pts (ne peut jamais devenir négatif)
  // En cas d'échec : Math.max(0, finalProgress) manquant dans le calcul de perte.
  it('0 points: loss clamps to 0 (no negative progress)', () => {
    const matches = [prevMatch(0, 0)];
    const result = calculateRankedProgression('loss', '2024-01-02T00:00:00Z', matches);
    expect(result.rankedProgress).toBeGreaterThanOrEqual(0);
  });

  // Match annulé : delta = 0, progression inchangée
  // En cas d'échec : Un résultat 'cancel' a modifié les points ou le rang.
  it('cancelled match: delta is 0 and progress unchanged', () => {
    const matches = [prevMatch(3000, 2)];
    const result = calculateRankedProgression('cancel', '2024-01-02T00:00:00Z', matches);
    expect(result.rankedDelta).toBe(0);
    expect(result.rankedProgress).toBe(3000);
  });

  // Limite exacte de palier : à 3000 pts (floor exact de sous-rang 4)
  // En cas d'échec : Problème d'arrondi ou de borne stricte dans l'indexation de sous-rang.
  it('exact subrank boundary (3000 pts, no win streak): correct subrank', () => {
    const matches = [prevMatch(3000, 2)];
    const result = calculateRankedProgression('win', '2024-01-02T00:00:00Z', matches);
    expect(result.rankedSubrank).toBe(4);
  });
});
