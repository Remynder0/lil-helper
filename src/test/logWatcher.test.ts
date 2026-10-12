/**
 * ============================================================================
 * TESTS UNITAIRES : logWatcher.ts (Parseur de console.log Source 2 Deadlock)
 * ============================================================================
 *
 * 🎯 CE QUE CE FICHIER TESTE :
 *  - La machine à états (FSM) de détection en temps réel du jeu :
 *      * 'disconnected' : quand aucun log n'est présent ou le jeu est éteint.
 *      * 'hideout' : joueur dans le salon d'entraînement local (dl_hideout).
 *      * 'draft' : joueur en phase de sélection de héros / match intro / pré-game.
 *      * 'in_game' : partie multijoueur active sur la carte (dl_midtown).
 *  - La protection ANTI-FAUX-POSITIFS du Hideout :
 *      * En mode entraînement (dl_hideout), le moteur Source 2 instancie des bots factices
 *        qui émettent brièvement les événements 'HeroSelection' ou 'MatchIntro' en < 100ms.
 *      * Le parseur doit IGNORER ces événements tant que le joueur est dans le hideout,
 *        pour ne pas faire basculer l'interface en mode draft par erreur !
 *  - L'extraction de données clés depuis les lignes de log (-condebug) :
 *      * ID du match (regex /match[_\s]?id[:=\s]+(\d{6,10})/i).
 *      * Slot (1 à 6) et pseudo du joueur local (via les lignes [Prediction]).
 *      * Détection du retour au menu ou de la fin de match ('GameOver', 'Disconnecting').
 *
 * 🔍 GUIDE DE DIAGNOSTIC EN CAS D'ÉCHEC :
 *  1. Si un test de détection de draft échoue :
 *     -> CODE : Vérifier la distinction isHideout. Une ligne indiquant une connexion distante
 *        (ex: 'dl_midtown', 'Connecting to =[A:', 'Connected to') est indispensable pour
 *        valider que le joueur n'est pas dans le Hideout.
 *  2. Si un test d'extraction de Match ID échoue :
 *     -> CODE : Vérifier la regex dans logWatcher.ts. Elle attend 'match id: <chiffres>'
 *        ou 'match_id=<chiffres>' avec entre 6 et 10 chiffres.
 *  3. Si un test de fin de partie ('GameOver') échoue :
 *     -> CODE : Vérifier que les événements de transition réinitialisent bien isHideout à true
 *        et result.state à 'hideout'.
 * ============================================================================
 */

import { describe, it, expect } from 'vitest';
import { parseDeadlockLogEvents } from '../services/logWatcher';
import type { LogEvent } from '../services/logWatcher';

/**
 * Utilitaire pour simuler un événement de log unitaire.
 */
function makeEvent(rawLine: string): LogEvent {
  return { timestamp: '00:00:00', rawLine, eventType: 'info' };
}

/**
 * Utilitaire pour simuler un flux séquentiel de lignes de log.
 */
function makeEvents(...lines: string[]): LogEvent[] {
  return lines.map(makeEvent);
}

// ────────────────────────────────────────────────────────────────────────────
// 1. ÉTAT DÉCONNECTÉ (DISCONNECTED)
// ────────────────────────────────────────────────────────────────────────────
describe('parseDeadlockLogEvents – État déconnecté / inactif', () => {
  // Aucun événement dans le log : Deadlock n'est pas lancé ou console.log est vide
  // En cas d'échec : Le résultat par défaut de parseDeadlockLogEvents n'a plus state='disconnected'.
  it('returns disconnected state for empty event list', () => {
    const ctx = parseDeadlockLogEvents([]);
    expect(ctx.state).toBe('disconnected');
  });

  // Libellé d'affichage pour l'UI (badge d'état)
  it('sets stateLabel to Offline for empty events', () => {
    expect(parseDeadlockLogEvents([]).stateLabel).toBe('Offline');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 2. ÉTAT DANS LE SALON D'ENTRAÎNEMENT (HIDEOUT)
// ────────────────────────────────────────────────────────────────────────────
describe('parseDeadlockLogEvents – Salon d\'entraînement (Hideout)', () => {
  // Détection explicite de la carte d'entraînement dl_hideout
  // En cas d'échec : La regex de détection de map ou le mot-clé 'Created physics for dl_hideout' n'est plus pris en compte.
  it('returns hideout when only hideout physics line is present', () => {
    const events = makeEvents('Created physics for dl_hideout');
    const ctx = parseDeadlockLogEvents(events);
    expect(ctx.state).toBe('hideout');
  });

  // Par défaut, si des logs circulent mais sans indication de match distant, le joueur est considéré au Hideout
  it('returns hideout for any non-game events (basic log activity)', () => {
    const events = makeEvents('[Random log] some info');
    const ctx = parseDeadlockLogEvents(events);
    expect(ctx.state).toBe('hideout');
  });

  // Le nom de la map est extrait et enregistré
  it('sets mapName to dl_hideout when Created physics for dl_hideout is seen', () => {
    const events = makeEvents('Created physics for dl_hideout');
    expect(parseDeadlockLogEvents(events).mapName).toBe('dl_hideout');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 3. ÉTAT DE PHASE DE DRAFT / SÉLECTION (DRAFT)
// ────────────────────────────────────────────────────────────────────────────
describe('parseDeadlockLogEvents – Détection de la phase de draft multijoueur', () => {
  // Transition 'HeroSelection' détectée après une connexion distante
  // En cas d'échec : Si le joueur est bien connecté en réseau, 'HeroSelection' doit passer le statut à 'draft'.
  it('returns draft for HeroSelection in a real match (not hideout)', () => {
    const events = makeEvents(
      'Connected to \'=[A:1:12345]:1234\'',
      'OnGameStateChanged HeroSelection'
    );
    const ctx = parseDeadlockLogEvents(events);
    expect(ctx.state).toBe('draft');
  });

  // Libellé de phase pour l'en-tête de l'application
  it('returns draft stateLabel Hero Selection for HeroSelection', () => {
    const events = makeEvents(
      'Connecting to =[A:1:12345]:1234',
      'OnGameStateChanged HeroSelection'
    );
    expect(parseDeadlockLogEvents(events).stateLabel).toBe('Hero Selection');
  });

  // Transition 'WaitingForPlayersToJoin' sur la carte multijoueur (dl_midtown)
  it('returns draft for WaitingForPlayersToJoin in a real match', () => {
    const events = makeEvents(
      'dl_midtown',
      'OnGameStateChanged WaitingForPlayersToJoin'
    );
    expect(parseDeadlockLogEvents(events).state).toBe('draft');
  });

  // Transition 'MatchIntro' : cinématique d'introduction avant le début de match
  it('returns draft for MatchIntro in a real match', () => {
    const events = makeEvents(
      'dl_midtown',
      'OnGameStateChanged MatchIntro'
    );
    expect(parseDeadlockLogEvents(events).state).toBe('draft');
  });

  // Transition 'PreGameWait' : phase d'attente avant le spawn sur les ziplines
  it('returns draft for PreGameWait in a real match', () => {
    const events = makeEvents(
      'dl_midtown',
      'OnGameStateChanged PreGameWait'
    );
    expect(parseDeadlockLogEvents(events).state).toBe('draft');
  });

  it('draft stateLabel is Pre-Game Draft for PreGameWait', () => {
    const events = makeEvents(
      'dl_midtown',
      'OnGameStateChanged PreGameWait'
    );
    expect(parseDeadlockLogEvents(events).stateLabel).toBe('Pre-Game Draft');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 4. GARDE ANTI-FAUX-POSITIFS (BOTS DU HIDEOUT)
// ────────────────────────────────────────────────────────────────────────────
describe('parseDeadlockLogEvents – Garde anti-faux-positifs (Warmup des bots au Hideout)', () => {
  // ⚠️ RÈGLE CRITIQUE : Dans dl_hideout, le moteur Source 2 démarre des bots et passe
  // brièvement par l'état 'HeroSelection'. Le parseur DOIT l'ignorer tant qu'on est au hideout !
  // En cas d'échec : Le check if (!isHideout) a sauté devant la détection 'HeroSelection'.
  it('does NOT set draft state when HeroSelection occurs in hideout context', () => {
    const events = makeEvents(
      'Created physics for dl_hideout',
      'OnGameStateChanged HeroSelection'
    );
    const ctx = parseDeadlockLogEvents(events);
    expect(ctx.state).toBe('hideout');
  });

  // Même garde pour 'MatchIntro' dans dl_hideout
  it('does NOT set draft for MatchIntro if still in hideout', () => {
    const events = makeEvents(
      'Spawn Server: dl_hideout',
      'OnGameStateChanged MatchIntro'
    );
    expect(parseDeadlockLogEvents(events).state).toBe('hideout');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 5. ÉTAT EN PARTIE (IN_GAME)
// ────────────────────────────────────────────────────────────────────────────
describe('parseDeadlockLogEvents – Partie en cours (In Game)', () => {
  // 'GameInProgress' sur dl_midtown : partie multijoueur lancée
  // En cas d'échec : Le joueur n'est pas marqué 'in_game'.
  it('returns in_game for GameInProgress in a real match', () => {
    const events = makeEvents(
      'dl_midtown',
      'OnGameStateChanged GameInProgress'
    );
    expect(parseDeadlockLogEvents(events).state).toBe('in_game');
  });

  // 'GameInProgress' au hideout (dummy training) : reste classé en 'hideout'
  it('returns hideout for GameInProgress while in hideout context', () => {
    const events = makeEvents(
      'Created physics for dl_hideout',
      'OnGameStateChanged GameInProgress'
    );
    expect(parseDeadlockLogEvents(events).state).toBe('hideout');
  });

  // Détection de map multijoueur dl_midtown directe
  it('returns in_game when mapName includes midtown and no draft/game state logged', () => {
    const events = makeEvents('Map: "dl_midtown"');
    expect(parseDeadlockLogEvents(events).state).toBe('in_game');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 6. EXTRACTION DU NUMÉRO DE MATCH (MATCH ID)
// ────────────────────────────────────────────────────────────────────────────
describe('parseDeadlockLogEvents – Extraction du Match ID', () => {
  // Format standard Deadlock : 'match id: <id>'
  // ⚠️ ATTENTION : La regex attend 'match id: ' ou 'match_id=', avec 6 à 10 chiffres numériques.
  // En cas d'échec : Vérifier la regex /(?:match[_\s]?id)[:=\s]+(\d{6,10})/i dans logWatcher.ts.
  it('extracts a match ID from a "match id: " log line', () => {
    const events = makeEvents('match id: 98765432');
    const ctx = parseDeadlockLogEvents(events);
    expect(ctx.matchId).toBe(98765432);
  });

  // Format avec underscore et égal : 'match_id=12345678'
  it('extracts match_id from another format', () => {
    const events = makeEvents('match_id=12345678');
    expect(parseDeadlockLogEvents(events).matchId).toBe(12345678);
  });

  // Si aucune ligne ne contient de match ID : retourne null
  it('returns null matchId when no match ID line is present', () => {
    expect(parseDeadlockLogEvents(makeEvents('[Info] nothing here')).matchId).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 7. DÉTECTION DU SLOT ET DU PSEUDO DU JOUEUR LOCAL
// ────────────────────────────────────────────────────────────────────────────
describe('parseDeadlockLogEvents – Détection du joueur local', () => {
  // Ligne de prédiction moteur : [Prediction] Added prediction for player slot 3 (Remynder)
  // Permet d'identifier quel joueur de l'équipe est l'utilisateur de l'application
  // En cas d'échec : La regex /Added prediction for player slot\s+(\d+)\s*\(([^)]+)\)/i a été modifiée.
  it('extracts playerSlot and playerName from prediction line', () => {
    const events = makeEvents(
      '[Prediction] Added prediction for player slot 3 (Remynder)'
    );
    const ctx = parseDeadlockLogEvents(events);
    expect(ctx.playerSlot).toBe(3);
    expect(ctx.playerName).toBe('Remynder');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 8. TRANSITIONS DE FIN DE PARTIE ET RETOUR AU SALON
// ────────────────────────────────────────────────────────────────────────────
describe('parseDeadlockLogEvents – Fin de match et retour au Hideout', () => {
  // Événement GameOver : fin de partie, le statut doit basculer en 'hideout'
  // En cas d'échec : L'application resterait bloquée sur 'in_game' après la fin du match.
  it('resets state to hideout on OnGameStateChanged: GameOver', () => {
    const events = makeEvents(
      'dl_midtown',
      'OnGameStateChanged GameInProgress',
      'OnGameStateChanged: GameOver'
    );
    expect(parseDeadlockLogEvents(events).state).toBe('hideout');
  });

  // Déconnexion du serveur : bascule en 'hideout'
  it('resets state to hideout on Disconnecting from server', () => {
    const events = makeEvents(
      'dl_midtown',
      'OnGameStateChanged GameInProgress',
      'Disconnecting from server'
    );
    expect(parseDeadlockLogEvents(events).state).toBe('hideout');
  });
});
