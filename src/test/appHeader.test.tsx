import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppHeader } from '../components/AppHeader';
import { ProfileDropdownMenu } from '../components/profile/ProfileDropdownMenu';
import { ToastProvider } from '../components/Toast';
import { ParsedGameContext } from '../services/logs/logWatcher';

const mockGameContext: ParsedGameContext = {
  state: 'hideout',
  stateLabel: 'In Hideout',
  playerName: 'Player1',
  playerSlot: null,
  myHeroName: 'Infernus',
  myHeroId: 1,
  assignedLane: null,
  detectedHeroIds: [],
  mapName: 'citadel',
  matchId: null,
  lastUpdated: new Date().toISOString(),
};

const mockProfile = {
  accountId: 98765432,
  personaName: 'DeadlockAgent',
  avatarUrl: 'https://example.com/avatar.png',
  profileUrl: 'https://steamcommunity.com/id/test',
  lastSyncedAt: new Date().toISOString(),
};

describe('AppHeader Navigation & Layout', () => {
  it('renders centered navigation section buttons for History, Analytics, and Draft Assistant', () => {
    render(
      <ToastProvider>
        <AppHeader
          gameContext={mockGameContext}
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

    const nav = screen.getByRole('navigation', { name: /Sections principales/i });
    expect(nav).toBeDefined();
    expect(nav.className).toContain('md:absolute');
    expect(nav.className).toContain('md:left-1/2');

    expect(screen.getByRole('button', { name: /History/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Analytics/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Draft Assistant/i })).toBeDefined();
  });

  it('renders stats pill as base format with hover indicators for account matches and account winrate', () => {
    render(
      <ToastProvider>
        <AppHeader
          gameContext={mockGameContext}
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

    const matchesPill = screen.getByTitle('account matches');
    expect(matchesPill).toBeDefined();
    expect(matchesPill.textContent).toContain('account matches');

    const winratePill = screen.getByTitle('account winrate');
    expect(winratePill).toBeDefined();
    expect(winratePill.textContent).toContain('account winrate');
  });
});

describe('ProfileDropdownMenu Refresh Button', () => {
  it('renders refresh button with icon and no static text when idle', () => {
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

    const refreshBtn = screen.getByRole('button', { name: /Refresh & sync matches/i });
    expect(refreshBtn).toBeDefined();
    expect(refreshBtn.textContent).toBe('');
    expect(screen.queryByText(/Refresh/i)).toBeNull();
  });

  it('displays only the countdown timer when cooldown is active', () => {
    render(
      <ToastProvider>
        <ProfileDropdownMenu
          profile={mockProfile}
          isSyncing={false}
          cooldownRemaining={105} // 1m 45s
          onSync={vi.fn()}
          onExport={vi.fn()}
          onTriggerImportFile={vi.fn()}
          onDisconnect={vi.fn()}
        />
      </ToastProvider>
    );

    const refreshBtn = screen.getByRole('button', { name: /Cooldown active/i });
    expect(refreshBtn).toBeDefined();
    expect(screen.getByText('1:45')).toBeDefined();
    expect(screen.queryByText(/Refresh/i)).toBeNull();
  });
});
