/**
 * ============================================================================
 * OCR DICTIONARIES & BILINGUAL TOKENS (Deadlock Escape Menu)
 * ============================================================================
 *
 * Supporte le français et l'anglais de façon totalement MIXTE et SIMULTANÉE :
 * - Le jeu peut être en français avec des éléments ou pseudos en anglais (ou inversement).
 * - L'en-tête allié peut être détecté en français ("Mon équipe") et l'ennemi en anglais ("Enemy Team").
 * - Les factions (Patrons) sont reconnues indifféremment en français ("Roi de l'Ombre", "Matriarche")
 *   ou en anglais ("Hidden King", "Archmother"), même mélangées.
 */

import { Side } from '../../types/match';

// ─── UI Stop Words (Mots parasites HUD / Interface FR & EN mélangés) ─────────

export const OCR_STOP_WORDS_FR = [
  'niveau',
  'contacts',
  'occultistes',
  'equipe',
  'équipe',
  'ennemie',
  'ennemi',
  'allies',
  'alliés',
  'mort',
  'morts',
  'serveur',
  'signaler',
  'vocal',
  'partie',
  'spectateur',
  'patron',
  'ombre',
  'matriarche',
  'echap',
  'abandonner',
  'rejoindre',
  'joueur',
  'profil',
] as const;

export const OCR_STOP_WORDS_EN = [
  'level',
  'contacts',
  'occultists',
  'team',
  'enemy',
  'enemies',
  'allies',
  'allied',
  'kills',
  'kill',
  'death',
  'deaths',
  'assists',
  'assist',
  'ping',
  'fps',
  'server',
  'report',
  'mute',
  'voice',
  'chat',
  'match',
  'stat',
  'stats',
  'spectator',
  'patron',
  'shadow',
  'archmother',
  'hidden',
  'king',
  'menu',
  'escape',
  'abandon',
  'rejoin',
  'pause',
  'player',
  'profile',
  'steam',
] as const;

// Ensemble unifié insensible à la langue et normalisé (minuscules sans caractères spéciaux)
export const COMBINED_STOP_WORDS = new Set<string>([
  ...OCR_STOP_WORDS_FR.map((w) => w.toLowerCase().replace(/[^a-z0-9]/g, '')),
  ...OCR_STOP_WORDS_EN.map((w) => w.toLowerCase().replace(/[^a-z0-9]/g, '')),
]);

/**
 * Vérifie si un token nettoyé est un mot d'interface parasite (FR ou EN).
 */
export function isOcrStopWord(cleanToken: string): boolean {
  return COMBINED_STOP_WORDS.has(cleanToken);
}

// ─── Détection des En-têtes d'Équipes (Bilingue / Mixte) ──────────────────────

/**
 * En-têtes d'équipe alliée en français OU en anglais.
 * Exemples : "Mon équipe", "Équipe alliée", "Allied Team", "Your Team", "Allies"
 */
export const ALLIES_HEADER_REGEX =
  /(?:mon\s*equipe|mon\s*équipe|équipe\s*alli[ée]e?|equipe\s*alliee|allied\s*team|allies|your\s*team)/i;

/**
 * En-têtes d'équipe ennemie en français OU en anglais.
 * Exemples : "Équipe ennemie", "Ennemis", "Enemy Team", "Enemies"
 */
export const ENEMIES_HEADER_REGEX =
  /(?:equipe\s*ennemie|équipe\s*ennemie|ennemie|ennemi|enemy\s*team|enemies|enemy)/i;

/**
 * Repli d'urgence pour trouver le mot ennemi dans une ligne si l'en-tête principal est manqué.
 */
export const ENEMY_FALLBACK_REGEX = /(?:ennemi|enemy)/i;

// ─── Détection des Factions / Patrons (Bilingue / Mixte) ─────────────────────

/**
 * Patron "The Hidden King" (Roi de l'Ombre en français ou Hidden King en anglais)
 */
export const HIDDEN_KING_PATRON_REGEX =
  /(?:roi\s*de\s*(?:l\s*['’]?)?ombre|hidden\s*king)/i;

/**
 * Patron "The Archmother" (Matriarche en français ou Archmother en anglais)
 */
export const ARCHMOTHER_PATRON_REGEX =
  /(?:matriarche|archmother)/i;

export interface DetectedFactionResult {
  side: Side;
  reason: string;
}

/**
 * Déduit la faction du joueur (The Hidden King vs The Archmother) à partir du texte brut
 * extrait des sections alliées et ennemies, qu'il soit en français, en anglais ou mélangé.
 */
export function detectFactionBilingual(
  alliesRawText: string,
  enemiesRawText: string
): DetectedFactionResult | null {
  // 1. Si le côté ennemi contient le Roi de l'Ombre / Hidden King -> le joueur est Archmother
  if (HIDDEN_KING_PATRON_REGEX.test(enemiesRawText)) {
    return {
      side: 'archmother',
      reason: "Enemy Patron: Hidden King / Roi de l'Ombre -> Player Side: The Archmother",
    };
  }

  // 2. Si le côté ennemi contient la Matriarche / Archmother -> le joueur est Hidden King
  if (ARCHMOTHER_PATRON_REGEX.test(enemiesRawText)) {
    return {
      side: 'hidden_king',
      reason: "Enemy Patron: Archmother / Matriarche -> Player Side: The Hidden King",
    };
  }

  // 3. Si le côté allié contient la Matriarche / Archmother -> le joueur est Archmother
  if (ARCHMOTHER_PATRON_REGEX.test(alliesRawText)) {
    return {
      side: 'archmother',
      reason: "Allied Patron: Archmother / Matriarche -> Player Side: The Archmother",
    };
  }

  // 4. Si le côté allié contient le Roi de l'Ombre / Hidden King -> le joueur est Hidden King
  if (HIDDEN_KING_PATRON_REGEX.test(alliesRawText)) {
    return {
      side: 'hidden_king',
      reason: "Allied Patron: Hidden King / Roi de l'Ombre -> Player Side: The Hidden King",
    };
  }

  return null;
}
