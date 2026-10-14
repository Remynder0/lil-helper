/**
 * ============================================================================
 * TESTS UNITAIRES : storage.ts (Migration & Versioning de Schéma de Données)
 * ============================================================================
 *
 * 🎯 CE QUE CE FICHIER TESTE :
 *  - La rétrocompatibilité avec les données brutes existantes (v1: tableau JSON simple [ ... ]).
 *  - La prise en charge du format versionné moderne (v2: { version: 2, matches: [ ... ] }).
 *  - La normalisation et la résilience face aux champs optionnels / manquants.
 *  - La gestion défensive des entrées invalides (null, {}, string).
 */

import { describe, it, expect } from 'vitest';
import { migrateMatchData, CURRENT_STORAGE_SCHEMA_VERSION } from '../services/storage';

describe('storageMigration – Versioning de Schéma de Données', () => {
  it('migrates legacy raw array format (v1) into current versioned schema', () => {
    const legacyArray = [
      {
        id: 'legacy_1',
        date: '2024-01-01T00:00:00Z',
        side: 'hidden_king',
        myHeroId: 1,
        allies: [2, 3, 4, 5, 6],
        enemies: [7, 8, 9, 10, 11, 12],
        result: 'win',
      },
    ];

    const result = migrateMatchData(legacyArray);
    expect(result.version).toBe(CURRENT_STORAGE_SCHEMA_VERSION);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].id).toBe('legacy_1');
    // Normalisation automatique des champs optionnels
    expect(result.matches[0].rankedProgress).toBeNull();
    expect(result.matches[0].lane).toBeUndefined();
  });

  it('reads versioned format (v2) seamlessly', () => {
    const versionedData = {
      version: 2,
      updatedAt: '2026-10-13T10:00:00Z',
      matches: [
        {
          id: 'v2_match',
          date: '2026-10-13T10:00:00Z',
          side: 'archmother',
          myHeroId: 5,
          allies: [1, 2, 3, 4, 6],
          enemies: [7, 8, 9, 10, 11, 12],
          result: 'loss',
          rankedProgress: 3500,
          lane: 'green',
        },
      ],
    };

    const result = migrateMatchData(versionedData);
    expect(result.version).toBe(2);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].id).toBe('v2_match');
    expect(result.matches[0].rankedProgress).toBe(3500);
    expect(result.matches[0].lane).toBe('green');
  });

  it('handles null, undefined or empty input safely', () => {
    expect(migrateMatchData(null).matches).toEqual([]);
    expect(migrateMatchData(undefined).matches).toEqual([]);
    expect(migrateMatchData({}).matches).toEqual([]);
    expect(migrateMatchData('invalid json string').matches).toEqual([]);
  });

  it('filters out corrupted items missing required fields', () => {
    const mixed = [
      { id: 'valid_1', result: 'win' },
      { garbage: true }, // Manque id ou result
      null,
    ];

    const result = migrateMatchData(mixed);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].id).toBe('valid_1');
  });

  it('saves and fetches app settings payload safely', async () => {
    const { saveAppSettings, fetchAppSettings } = await import('../services/storage');
    await saveAppSettings({
      activeAccountId: 98765432,
      profile: {
        accountId: 98765432,
        personaName: 'TestSteamUser',
      },
      settings: {
        shieldDisplayMode: 'badges',
        draftMode: 'ocr',
        autoNavigateToDraft: true,
      },
    });

    const loaded = await fetchAppSettings();
    expect(loaded.activeAccountId).toBe(98765432);
    expect(loaded.profile?.personaName).toBe('TestSteamUser');
    expect(loaded.settings?.shieldDisplayMode).toBe('badges');
  });
});
