/**
 * ============================================================================
 * TESTS UNITAIRES : ocrDictionaries.ts (Dictionnaires Multilingues & Mixtes OCR)
 * ============================================================================
 *
 * 🎯 CE QUE CE FICHIER TESTE :
 *  - La détection simultanée des mots vides (stop words) d'interface en français et en anglais.
 *  - La détection bilingue et MIXTE des en-têtes d'équipes (ex: Alliés FR + Ennemis EN).
 *  - La détection bilingue et MIXTE des factions/patrons (The Hidden King vs The Archmother,
 *    Le Roi de l'Ombre vs La Matriarche).
 *
 * 🔍 GUIDE DE DIAGNOSTIC EN CAS D'ÉCHEC :
 *  1. Si un terme d'interface Deadlock est confondu avec un héros :
 *     -> CODE : Ajouter le terme dans OCR_STOP_WORDS_FR ou OCR_STOP_WORDS_EN.
 *  2. Si une faction en anglais n'est pas détectée alors que le client est en anglais ou mixte :
 *     -> CODE : Vérifier HIDDEN_KING_PATRON_REGEX ou ARCHMOTHER_PATRON_REGEX dans ocrDictionaries.ts.
 * ============================================================================
 */

import { describe, it, expect } from 'vitest';
import {
  isOcrStopWord,
  ALLIES_HEADER_REGEX,
  ENEMIES_HEADER_REGEX,
  detectFactionBilingual,
} from '../services/ocr/ocrDictionaries';

describe('ocrDictionaries – Stop Words & Header Matching (FR & EN mixtes)', () => {
  it('recognizes French UI stop words', () => {
    expect(isOcrStopWord('niveau')).toBe(true);
    expect(isOcrStopWord('equipe')).toBe(true);
    expect(isOcrStopWord('ennemie')).toBe(true);
    expect(isOcrStopWord('joueur')).toBe(true);
  });

  it('recognizes English UI stop words', () => {
    expect(isOcrStopWord('level')).toBe(true);
    expect(isOcrStopWord('enemy')).toBe(true);
    expect(isOcrStopWord('deaths')).toBe(true);
    expect(isOcrStopWord('player')).toBe(true);
  });

  it('does not classify hero names as stop words', () => {
    expect(isOcrStopWord('infernus')).toBe(false);
    expect(isOcrStopWord('vindicta')).toBe(false);
    expect(isOcrStopWord('seven')).toBe(false);
    expect(isOcrStopWord('wraith')).toBe(false);
  });

  it('matches various Allies headers in French and English', () => {
    expect(ALLIES_HEADER_REGEX.test('MON ÉQUIPE')).toBe(true);
    expect(ALLIES_HEADER_REGEX.test('Mon equipe')).toBe(true);
    expect(ALLIES_HEADER_REGEX.test('Équipe alliée')).toBe(true);
    expect(ALLIES_HEADER_REGEX.test('Allied Team')).toBe(true);
    expect(ALLIES_HEADER_REGEX.test('Your Team')).toBe(true);
    expect(ALLIES_HEADER_REGEX.test('Allies')).toBe(true);
  });

  it('matches various Enemies headers in French and English', () => {
    expect(ENEMIES_HEADER_REGEX.test('ÉQUIPE ENNEMIE')).toBe(true);
    expect(ENEMIES_HEADER_REGEX.test('Equipe ennemie')).toBe(true);
    expect(ENEMIES_HEADER_REGEX.test('Ennemis')).toBe(true);
    expect(ENEMIES_HEADER_REGEX.test('Enemy Team')).toBe(true);
    expect(ENEMIES_HEADER_REGEX.test('Enemies')).toBe(true);
  });
});

describe('ocrDictionaries – Détection de faction bilingue et mixte', () => {
  it('detects Archmother player side when enemy text contains French Roi de l\'Ombre', () => {
    const res = detectFactionBilingual('Mon équipe Seven Infernus', 'Équipe ennemie Roi de l\'Ombre Warden');
    expect(res).not.toBeNull();
    expect(res?.side).toBe('archmother');
  });

  it('detects Archmother player side when enemy text contains English Hidden King', () => {
    const res = detectFactionBilingual('Allied Team Seven Infernus', 'Enemy Team The Hidden King Warden');
    expect(res).not.toBeNull();
    expect(res?.side).toBe('archmother');
  });

  it('detects Hidden King player side when enemy text contains French Matriarche', () => {
    const res = detectFactionBilingual('Mon équipe Seven Infernus', 'Équipe ennemie La Matriarche Abrams');
    expect(res).not.toBeNull();
    expect(res?.side).toBe('hidden_king');
  });

  it('detects Hidden King player side when enemy text contains English Archmother', () => {
    const res = detectFactionBilingual('Allies Seven Infernus', 'Enemies The Archmother Abrams');
    expect(res).not.toBeNull();
    expect(res?.side).toBe('hidden_king');
  });

  it('detects faction correctly when languages are mixed (French UI with English patron term)', () => {
    // Cas réel : interface en français mais patron affiché en anglais ou vice versa
    const res = detectFactionBilingual('Mon équipe alliée', 'Équipe ennemie The Archmother');
    expect(res).not.toBeNull();
    expect(res?.side).toBe('hidden_king');
  });
});
