/**
 * ============================================================================
 * TESTS UNITAIRES : match.ts -> validateMatchInput (Validation de Saisie Match)
 * ============================================================================
 *
 * 🎯 CE QUE CE FICHIER TESTE :
 *  - La validation stricte de la composition d'une partie Deadlock 6v6 :
 *      * Exactement 1 héros joué par l'utilisateur (myHeroId obligatoire et non nul).
 *      * Exactement 5 alliés (tableau allies de taille 5).
 *      * Exactement 6 ennemis (tableau enemies de taille 6).
 *      * Présence obligatoire d'une faction ('hidden_king' ou 'archmother') et d'un résultat.
 *      * Règle d'unicité absolue : 12 héros uniques par partie. Aucun doublon permis,
 *        ni entre alliés, ni entre ennemis, ni entre le joueur et une équipe.
 *
 * 🔍 GUIDE DE DIAGNOSTIC EN CAS D'ÉCHEC :
 *  1. Si un test de format valide échoue :
 *     -> CODE : Vérifier si un nouveau champ obligatoire a été ajouté à MatchDraftInput
 *        sans valeur par défaut dans validateMatchInput.
 *  2. Si un test de doublons échoue :
 *     -> CODE : Vérifier la logique de détection des doublons (allHeroIds.filter(...))
 *        dans validateMatchInput.
 *  3. Si un test de nombre d'alliés ou d'ennemis échoue :
 *     -> RÈGLE MÉTIER : Deadlock se joue exclusivement en 6v6 (1 joueur + 5 alliés vs 6 ennemis).
 *        Si le jeu introduit un mode 4v4 ou 1v1 futur, la fonction et ce test devront évoluer.
 * ============================================================================
 */

import { describe, it, expect } from 'vitest';
import { validateMatchInput } from '../types/match';
import type { MatchDraftInput } from '../types/match';

/**
 * Générateur de payload valide par défaut (1 héros joueur + 5 alliés + 6 ennemis = 12 héros uniques de 1 à 12).
 */
function validInput(overrides: Partial<MatchDraftInput> = {}): MatchDraftInput {
  return {
    side: 'hidden_king',
    myHeroId: 1,
    allies: [2, 3, 4, 5, 6],      // exactement 5 alliés
    enemies: [7, 8, 9, 10, 11, 12], // exactement 6 ennemis
    result: 'win',
    ...overrides,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 1. MATCH VALIDE (CAS NOMINAUX)
// ────────────────────────────────────────────────────────────────────────────
describe('validateMatchInput – Matchs valides', () => {
  // Valide qu'un match conforme ne renvoie aucune erreur
  // En cas d'échec : Une règle de validation trop stricte a été ajoutée dans validateMatchInput.
  it('returns no errors for a fully valid match', () => {
    expect(validateMatchInput(validInput())).toHaveLength(0);
  });

  // Valide que le résultat 'loss' est bien accepté
  it('accepts loss result', () => {
    expect(validateMatchInput(validInput({ result: 'loss' }))).toHaveLength(0);
  });

  // Valide que le résultat 'cancel' (match annulé / safe to leave) est bien accepté
  it('accepts cancel result', () => {
    expect(validateMatchInput(validInput({ result: 'cancel' }))).toHaveLength(0);
  });

  // Valide que la faction 'archmother' (The Archmother) est acceptée autant que 'hidden_king'
  it('accepts archmother side', () => {
    expect(validateMatchInput(validInput({ side: 'archmother' }))).toHaveLength(0);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 2. ABSENCE DU HÉROS DU JOUEUR (myHeroId)
// ────────────────────────────────────────────────────────────────────────────
describe('validateMatchInput – Héros du joueur manquant', () => {
  // myHeroId est null : l'utilisateur n'a pas sélectionné son propre personnage
  // En cas d'échec : L'erreur sur le champ 'myHeroId' n'est plus générée.
  it('returns error when myHeroId is null', () => {
    const errors = validateMatchInput(validInput({ myHeroId: null }));
    expect(errors.some((e) => e.field === 'myHeroId')).toBe(true);
  });

  // myHeroId est 0 : la valeur 0 est invalide (IDs de héros Deadlock commencent à 1+)
  it('returns error when myHeroId is 0 (falsy)', () => {
    const errors = validateMatchInput(validInput({ myHeroId: 0 }));
    expect(errors.some((e) => e.field === 'myHeroId')).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 3. COMPOSITION DE L'ÉQUIPE ALLIÉE (allies.length === 5)
// ────────────────────────────────────────────────────────────────────────────
describe('validateMatchInput – Nombre d\'alliés invalide', () => {
  // 4 alliés au lieu de 5 : composition incomplète
  // En cas d'échec : La vérification input.allies.length !== 5 a sauté.
  it('returns error for 4 allies (one short)', () => {
    const errors = validateMatchInput(validInput({ allies: [2, 3, 4, 5] }));
    expect(errors.some((e) => e.field === 'allies')).toBe(true);
  });

  // 6 alliés au lieu de 5 : trop d'alliés
  it('returns error for 6 allies (one too many)', () => {
    const errors = validateMatchInput(validInput({ allies: [2, 3, 4, 5, 6, 13] }));
    expect(errors.some((e) => e.field === 'allies')).toBe(true);
  });

  // Tableau d'alliés vide
  it('returns error for empty allies array', () => {
    const errors = validateMatchInput(validInput({ allies: [] }));
    expect(errors.some((e) => e.field === 'allies')).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 4. COMPOSITION DE L'ÉQUIPE ENNEMIE (enemies.length === 6)
// ────────────────────────────────────────────────────────────────────────────
describe('validateMatchInput – Nombre d\'ennemis invalide', () => {
  // 5 ennemis au lieu de 6 : équipe adverse incomplète
  // En cas d'échec : La vérification input.enemies.length !== 6 a sauté.
  it('returns error for 5 enemies (one short)', () => {
    const errors = validateMatchInput(validInput({ enemies: [7, 8, 9, 10, 11] }));
    expect(errors.some((e) => e.field === 'enemies')).toBe(true);
  });

  // 7 ennemis au lieu de 6 : trop d'adversaires
  it('returns error for 7 enemies (one too many)', () => {
    const errors = validateMatchInput(validInput({ enemies: [7, 8, 9, 10, 11, 12, 13] }));
    expect(errors.some((e) => e.field === 'enemies')).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 5. RÈGLE D'UNICITÉ DES HÉROS (AUCUN DOUBLON SUR LA PARTIE)
// ────────────────────────────────────────────────────────────────────────────
describe('validateMatchInput – Détection des doublons de héros', () => {
  // Un héros présent deux fois dans l'équipe alliée (ex: hero 2 en double)
  // En cas d'échec : Le filtre de doublons n'inspecte pas correctement le tableau 'allies'.
  it('returns error when same hero appears twice in allies', () => {
    const errors = validateMatchInput(validInput({ allies: [2, 2, 4, 5, 6] }));
    expect(errors.some((e) => e.field === 'draft')).toBe(true);
  });

  // Même héros présent dans l'équipe alliée ET ennemie (ex: hero 7 présent des deux côtés)
  // En cas d'échec : Règle Deadlock violée (il n'y a pas de mirror match dans Deadlock).
  it('returns error when same hero appears in both allies and enemies', () => {
    const errors = validateMatchInput(validInput({ allies: [7, 3, 4, 5, 6] }));
    expect(errors.some((e) => e.field === 'draft')).toBe(true);
  });

  // Le héros joué par l'utilisateur (myHeroId = 1) figure aussi dans la liste des alliés
  it('returns error when myHeroId also appears in allies', () => {
    const errors = validateMatchInput(validInput({ allies: [1, 3, 4, 5, 6] }));
    expect(errors.some((e) => e.field === 'draft')).toBe(true);
  });

  // Le héros joué par l'utilisateur (myHeroId = 1) figure dans la liste des ennemis
  it('returns error when myHeroId also appears in enemies', () => {
    const errors = validateMatchInput(validInput({ enemies: [1, 8, 9, 10, 11, 12] }));
    expect(errors.some((e) => e.field === 'draft')).toBe(true);
  });

  // Un héros présent deux fois dans l'équipe adverse (ex: hero 7 en double)
  it('returns error when same hero appears twice in enemies', () => {
    const errors = validateMatchInput(validInput({ enemies: [7, 7, 9, 10, 11, 12] }));
    expect(errors.some((e) => e.field === 'draft')).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 6. CUMUL D'ERREURS MULTIPLES
// ────────────────────────────────────────────────────────────────────────────
describe('validateMatchInput – Cumul de plusieurs erreurs simultanées', () => {
  // Vérifie que toutes les anomalies sont remontées en une seule passe de validation (UX réactive)
  // En cas d'échec : validateMatchInput s'arrête à la première erreur rencontrée au lieu de toutes les accumuler.
  it('returns multiple errors for multiple problems', () => {
    const errors = validateMatchInput({
      side: 'hidden_king',
      myHeroId: null, // Erreur 1
      allies: [2, 3],  // Erreur 2 (2 au lieu de 5)
      enemies: [7, 8, 9, 10, 11, 12],
      result: null,   // Erreur 3
    });
    expect(errors.length).toBeGreaterThanOrEqual(3);
  });
});
