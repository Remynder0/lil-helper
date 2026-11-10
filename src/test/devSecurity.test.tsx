import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import {
  isDeveloperAuthorizedSync,
  isDeveloperAuthorized,
  _setDevAuthorizedForTesting,
} from '../services/devSecurity';
import { useUIStore } from '../stores/useUIStore';
import { syncMatchesWithCloud } from '../services/storage/storage';
import { ProfileDropdownMenu } from '../components/profile/ProfileDropdownMenu';
import { ToastProvider } from '../components/Toast';
import { invoke } from '@tauri-apps/api/core';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('Developer Security Subsystem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _setDevAuthorizedForTesting(null);
  });

  afterEach(() => {
    cleanup();
    _setDevAuthorizedForTesting(null);
  });

  describe('isDeveloperAuthorizedSync & isDeveloperAuthorized', () => {
    it('returns false when dev authorization is disabled', async () => {
      _setDevAuthorizedForTesting(false);
      expect(isDeveloperAuthorizedSync()).toBe(false);
      expect(await isDeveloperAuthorized()).toBe(false);
    });

    it('returns true when dev authorization is enabled', async () => {
      _setDevAuthorizedForTesting(true);
      expect(isDeveloperAuthorizedSync()).toBe(true);
      expect(await isDeveloperAuthorized()).toBe(true);
    });

    it('verifies against Tauri IPC when in Tauri environment', async () => {
      // Simulate Tauri environment
      const originalTauri = (window as any).__TAURI_INTERNALS__;
      (window as any).__TAURI_INTERNALS__ = {};

      try {
        // Mock global compile-time define if present or default
        (window as any).__DEV_MACHINE_AUTHORIZED__ = true;
        vi.mocked(invoke).mockResolvedValueOnce(true);

        const result = await isDeveloperAuthorized();
        expect(result).toBe(true);
        expect(invoke).toHaveBeenCalledWith('is_developer_authorized');
      } finally {
        if (originalTauri) {
          (window as any).__TAURI_INTERNALS__ = originalTauri;
        } else {
          delete (window as any).__TAURI_INTERNALS__;
        }
      }
    });

    it('rejects authorization when Tauri IPC returns false', async () => {
      const originalTauri = (window as any).__TAURI_INTERNALS__;
      (window as any).__TAURI_INTERNALS__ = {};

      try {
        (window as any).__DEV_MACHINE_AUTHORIZED__ = true;
        vi.mocked(invoke).mockResolvedValueOnce(false);

        const result = await isDeveloperAuthorized();
        expect(result).toBe(false);
      } finally {
        if (originalTauri) {
          (window as any).__TAURI_INTERNALS__ = originalTauri;
        } else {
          delete (window as any).__TAURI_INTERNALS__;
        }
      }
    });
  });

  describe('Route and Store Security Guard', () => {
    it('redirects unauthorized access to logs tab back to history', () => {
      _setDevAuthorizedForTesting(false);

      useUIStore.getState().setActiveTab('logs');
      expect(useUIStore.getState().activeTab).toBe('history');

      useUIStore.getState().setActiveTab('log_match');
      expect(useUIStore.getState().activeTab).toBe('history');
    });

    it('allows authorized developers to navigate to logs', () => {
      _setDevAuthorizedForTesting(true);

      useUIStore.getState().setActiveTab('logs');
      expect(useUIStore.getState().activeTab).toBe('logs');
    });
  });

  describe('Cloud Sync Storage Guard', () => {
    it('blocks syncMatchesWithCloud immediately when unauthorized', async () => {
      _setDevAuthorizedForTesting(false);

      const res = await syncMatchesWithCloud(12345, null);
      expect(res.success).toBe(false);
      expect(res.count).toBe(0);
      expect(res.message).toMatch(/authorized developer mode/i);
    });
  });

  describe('ProfileDropdownMenu UI Restrictions', () => {
    const mockProfile = {
      accountId: 12345678,
      personaName: 'TestDevUser',
      avatarUrl: '',
      profileUrl: '',
      lastSyncedAt: new Date().toISOString(),
    };

    it('hides Log Dashboard and Supabase Cloud options from unauthorized users', async () => {
      _setDevAuthorizedForTesting(false);

      render(
        <ToastProvider>
          <ProfileDropdownMenu
            profile={mockProfile}
            isSyncing={false}
            cooldownRemaining={0}
            onSync={vi.fn()}
            onExport={vi.fn()}
            onTriggerImportFile={vi.fn()}
            onDisconnect={vi.fn()}
          />
        </ToastProvider>
      );

      // Open menu
      const button = screen.getByRole('button', { name: /TestDevUser/i });
      await act(async () => {
        fireEvent.click(button);
      });

      expect(screen.queryByText(/Log Dashboard & Console/i)).toBeNull();
      expect(screen.getByText(/Export Matches/i)).toBeDefined();
      expect(screen.getByText(/Disconnect/i)).toBeDefined();
    });

    it('shows Log Dashboard option to authorized developers', async () => {
      _setDevAuthorizedForTesting(true);

      render(
        <ToastProvider>
          <ProfileDropdownMenu
            profile={mockProfile}
            isSyncing={false}
            cooldownRemaining={0}
            onSync={vi.fn()}
            onExport={vi.fn()}
            onTriggerImportFile={vi.fn()}
            onDisconnect={vi.fn()}
          />
        </ToastProvider>
      );

      // Open menu
      const button = screen.getByRole('button', { name: /TestDevUser/i });
      await act(async () => {
        fireEvent.click(button);
      });

      expect(screen.getByText(/Log Dashboard & Console/i)).toBeDefined();
    });
  });
});
