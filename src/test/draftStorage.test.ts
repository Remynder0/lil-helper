/**
 * ============================================================================
 * TESTS UNITAIRES : draftStorage.ts (Persistance de la Session de Draft)
 * ============================================================================
 *
 * 🎯 CE QUE CE FICHIER TESTE :
 *  - Le cycle complet de vie de la session de draft (load, save, partial update, reset).
 *  - La robustesse face aux données corrompues ou altérées dans le localStorage.
 *  - Le respect strict du schéma DraftSessionState :
 *      * Faction par défaut ('hidden_king').
 *      * Exactement 3 slots de bans ([null, null, null]).
 *      * Voie assignée par défaut ('green').
 *      * État rétracté du plateau de lanes (isLanesCollapsed = false).
 *  - Le merge partiel : une mise à jour d'un champ ne doit pas effacer les autres.
 *  - La désérialisation défensive : repli automatique vers les valeurs par défaut en cas d'incohérence.
 *
 * 🔍 GUIDE DE DIAGNOSTIC EN CAS D'ÉCHEC :
 *  1. Si un test de round-trip échoue (save puis load donne un résultat inattendu) :
 *     -> CODE : Vérifier la clé de stockage DRAFT_SESSION_STORAGE_KEY ('deadlock_draft_session_v1')
 *        ou la méthode saveDraftSessionState / loadDraftSessionState.
 *  2. Si un test de validation défensive échoue :
 *     -> CODE : Vérifier les gardes de type dans loadDraftSessionState (ex: parsed.side === 'archmother',
 *        Array.isArray(parsed.bannedHeroIds) && length === 3).
 *  3. Si le test de JSON corrompu lève une exception non interceptée :
 *     -> CODE : Le bloc try / catch dans loadDraftSessionState a été supprimé ou n'attrape plus SyntaxError.
 * ============================================================================
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadDraftSessionState,
  saveDraftSessionState,
  resetDraftSessionState,
  INITIAL_DRAFT_SESSION_STATE,
} from '../services/draftStorage';

// ─── Setup ──────────────────────────────────────────────────────────────────

// Nettoie le mock localStorage avant chaque test pour garantir l'indépendance des cas
beforeEach(() => {
  localStorage.clear();
});

// ────────────────────────────────────────────────────────────────────────────
// 1. ÉTAT INITIAL SUR STOCKAGE VIDE
// ────────────────────────────────────────────────────────────────────────────
describe('loadDraftSessionState – Stockage vide', () => {
  // Vérifie que le retour sur localStorage vierge est strictement identique à INITIAL_DRAFT_SESSION_STATE
  // En cas d'échec : loadDraftSessionState ne retourne pas l'objet constant par défaut.
  it('returns INITIAL_DRAFT_SESSION_STATE when localStorage is empty', () => {
    const state = loadDraftSessionState();
    expect(state).toEqual(INITIAL_DRAFT_SESSION_STATE);
  });

  // Faction par défaut = The Hidden King
  it('initial state has side = hidden_king', () => {
    expect(loadDraftSessionState().side).toBe('hidden_king');
  });

  // Exactement 3 emplacements de bannissement vides
  it('initial state has 3 null ban slots', () => {
    expect(loadDraftSessionState().bannedHeroIds).toEqual([null, null, null]);
  });

  // Le plateau des lanes est ouvert par défaut au démarrage
  it('initial state has isLanesCollapsed = false', () => {
    expect(loadDraftSessionState().isLanesCollapsed).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 2. PERSISTANCE ET RELECTURE (ROUND-TRIP)
// ────────────────────────────────────────────────────────────────────────────
describe('saveDraftSessionState + loadDraftSessionState – Relecture fidèle', () => {
  // Persistance du choix de faction (The Archmother)
  it('persists side and reads it back', () => {
    saveDraftSessionState({ side: 'archmother' });
    expect(loadDraftSessionState().side).toBe('archmother');
  });

  // Persistance des 3 slots de héros bannis
  it('persists bannedHeroIds and reads them back', () => {
    saveDraftSessionState({ bannedHeroIds: [10, 20, null] });
    expect(loadDraftSessionState().bannedHeroIds).toEqual([10, 20, null]);
  });

  // Persistance du héros personnel sélectionné
  it('persists myHeroId and reads it back', () => {
    saveDraftSessionState({ myHeroId: 42 });
    expect(loadDraftSessionState().myHeroId).toBe(42);
  });

  // Persistance de la couleur de voie assignée (Yellow / Blue / Green)
  it('persists assignedLane and reads it back', () => {
    saveDraftSessionState({ assignedLane: 'yellow' });
    expect(loadDraftSessionState().assignedLane).toBe('yellow');
  });

  // Persistance de l'état réduit/déplié du plateau astral de draft
  it('persists isLanesCollapsed = true', () => {
    saveDraftSessionState({ isLanesCollapsed: true });
    expect(loadDraftSessionState().isLanesCollapsed).toBe(true);
  });

  // Règle de fusion : mettre à jour un champ partiel ne doit PAS écraser les autres champs déjà enregistrés
  // En cas d'échec : saveDraftSessionState écrase tout au lieu de merger avec l'état existant.
  it('partial save merges with existing state (does not wipe unrelated fields)', () => {
    saveDraftSessionState({ side: 'archmother', myHeroId: 5 });
    saveDraftSessionState({ myHeroId: 99 }); // mise à jour partielle
    const state = loadDraftSessionState();
    expect(state.side).toBe('archmother'); // doit être préservé
    expect(state.myHeroId).toBe(99);       // doit être mis à jour
  });

  // Persistance complète de la grille des 3 lanes (Yellow, Blue, Green avec alliés et ennemis)
  it('persists and restores a full lanes object', () => {
    const lanes = {
      yellow: { allies: [1, 2], enemies: [3, 4] },
      blue: { allies: [5, 6], enemies: [7, 8] },
      green: { allies: [9, 10], enemies: [11, 12] },
    };
    saveDraftSessionState({ lanes });
    expect(loadDraftSessionState().lanes).toEqual(lanes);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 3. RÉINITIALISATION DU DRAFT (RESET)
// ────────────────────────────────────────────────────────────────────────────
describe('resetDraftSessionState – Nettoyage de session', () => {
  // Effacement complet du localStorage et retour à l'état vierge
  // En cas d'échec : localStorage.removeItem('deadlock_draft_session_v1') n'est pas appelé correctement.
  it('clears saved state and returns initial state', () => {
    saveDraftSessionState({ side: 'archmother', myHeroId: 7 });
    const reset = resetDraftSessionState();
    expect(reset).toEqual(INITIAL_DRAFT_SESSION_STATE);
    expect(loadDraftSessionState()).toEqual(INITIAL_DRAFT_SESSION_STATE);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 4. SÉCURITÉ ET VALIDATION DÉFENSIVE FACE AUX DONNÉES INVALIDES
// ────────────────────────────────────────────────────────────────────────────
describe('loadDraftSessionState – Désérialisation défensive', () => {
  // Si une chaîne inconnue a été injectée dans 'side', repli automatique vers 'hidden_king'
  // En cas d'échec : Le fallback parsed.side === 'archmother' ? 'archmother' : 'hidden_king' a été altéré.
  it('returns hidden_king when side value is unknown', () => {
    localStorage.setItem(
      'deadlock_draft_session_v1',
      JSON.stringify({ side: 'unknown_faction' })
    );
    expect(loadDraftSessionState().side).toBe('hidden_king');
  });

  // Si le tableau de bans n'a pas exactement 3 éléments (ex: 2 éléments), repli vers [null, null, null]
  // En cas d'échec : La vérification parsed.bannedHeroIds.length === 3 ne protège plus le format.
  it('returns [null, null, null] when bannedHeroIds has wrong length', () => {
    localStorage.setItem(
      'deadlock_draft_session_v1',
      JSON.stringify({ bannedHeroIds: [1, 2] })
    );
    expect(loadDraftSessionState().bannedHeroIds).toEqual([null, null, null]);
  });

  // Si une couleur de voie non reconnue est stockée (ex: 'purple'), repli vers 'green'
  it('returns green when assignedLane value is unknown', () => {
    localStorage.setItem(
      'deadlock_draft_session_v1',
      JSON.stringify({ assignedLane: 'purple' })
    );
    expect(loadDraftSessionState().assignedLane).toBe('green');
  });

  // Si myHeroId est du mauvais type (chaîne de caractères au lieu de number), repli vers null
  it('returns null for myHeroId when the stored value is a string', () => {
    localStorage.setItem(
      'deadlock_draft_session_v1',
      JSON.stringify({ myHeroId: 'Wraith' })
    );
    expect(loadDraftSessionState().myHeroId).toBeNull();
  });

  // Si le contenu stocké dans le localStorage est un JSON corrompu ou incomplet (crash navigateur / coupure) :
  // Ne doit JAMAIS lever d'exception non gérée, mais retourner silencieusement INITIAL_DRAFT_SESSION_STATE.
  // En cas d'échec : Le bloc catch(err) de loadDraftSessionState ne gère plus l'erreur de JSON.parse.
  it('returns INITIAL_DRAFT_SESSION_STATE when JSON is corrupted', () => {
    localStorage.setItem('deadlock_draft_session_v1', '{ broken json !!!');
    expect(loadDraftSessionState()).toEqual(INITIAL_DRAFT_SESSION_STATE);
  });
});
