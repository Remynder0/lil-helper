/**
 * Service de gestion des préférences utilisateur et options d'affichage.
 * Persisté dans le localStorage et prêt pour la future page de Paramètres.
 */

import { saveAppSettings } from './storage';

export type ShieldDisplayMode = 'badges' | 'tooltip';
export type DraftMode = 'ocr' | 'manual';

export interface UserSettings {
  /**
   * Mode d'affichage des shields dans le graphique de progression classée :
   * - 'badges' : badges flottants au-dessus des nœuds du graphe (Bleu = Reset, Rose = Consumed, tooltip minimaliste)
   * - 'tooltip' : ancienne version, aucun badge au-dessus des points, badge shield affiché dans la bulle au hover
   */
  shieldDisplayMode: ShieldDisplayMode;
  /**
   * Mode du Draft Assistant :
   * - 'ocr' : Mode automatique basé sur la reconnaissance d'écran OCR et le Live Sync
   * - 'manual' : Mode manuel bac à sable pour concevoir des drafts et tester des compos
   */
  draftMode: DraftMode;
  /**
   * Bascule automatique vers le Draft Assistant lorsque le jeu entre en phase de draft / sélection
   */
  autoNavigateToDraft: boolean;
}

const SETTINGS_KEY = 'deadlock_user_settings_v1';

export const DEFAULT_SETTINGS: UserSettings = {
  shieldDisplayMode: 'badges',
  draftMode: 'ocr',
  autoNavigateToDraft: true,
};

export function loadUserSettings(): UserSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch (err) {
    console.error('Failed to load user settings:', err);
    return DEFAULT_SETTINGS;
  }
}

export function saveUserSettings(settings: Partial<UserSettings>): UserSettings {
  try {
    const current = loadUserSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event('deadlock_settings_updated'));
    saveAppSettings({ settings: updated }).catch(console.error);
    return updated;
  } catch (err) {
    console.error('Failed to save user settings:', err);
    return DEFAULT_SETTINGS;
  }
}
