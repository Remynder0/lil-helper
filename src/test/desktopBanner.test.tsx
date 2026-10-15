import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DesktopDownloadBanner } from '../components/DesktopDownloadBanner';

describe('DesktopDownloadBanner', () => {
  beforeEach(() => {
    sessionStorage.clear();
    delete (window as any).__TAURI_INTERNALS__;
  });

  afterEach(() => {
    delete (window as any).__TAURI_INTERNALS__;
    sessionStorage.clear();
  });

  it('renders download banner in web environment', () => {
    render(<DesktopDownloadBanner />);
    expect(
      screen.getByText(/Playing Deadlock\? Download the Windows Desktop App!/i)
    ).toBeDefined();
    expect(screen.getByText(/Download \(\.exe \/ \.msi\)/i)).toBeDefined();
  });

  it('dismisses banner when close button is clicked', () => {
    render(<DesktopDownloadBanner />);
    const closeBtn = screen.getByRole('button', { name: /Dismiss banner/i });
    fireEvent.click(closeBtn);

    expect(
      screen.queryByText(/Playing Deadlock\? Download the Windows Desktop App!/i)
    ).toBeNull();
    expect(sessionStorage.getItem('deadlock_desktop_banner_dismissed')).toBe('true');
  });

  it('does not render when inside Tauri desktop environment', () => {
    (window as any).__TAURI_INTERNALS__ = {};
    render(<DesktopDownloadBanner />);
    expect(
      screen.queryByText(/Playing Deadlock\? Download the Windows Desktop App!/i)
    ).toBeNull();
  });
});
