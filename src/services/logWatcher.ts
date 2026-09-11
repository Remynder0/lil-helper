import { invoke } from '@tauri-apps/api/core';

export interface LogEvent {
  timestamp: string;
  rawLine: string;
  eventType: 'info' | 'match_found' | 'hero_detected' | 'status';
}

function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function detectDeadlockLogPath(): Promise<string | null> {
  if (isTauriEnvironment()) {
    try {
      const detected = await invoke<string | null>('detect_deadlock_log_path');
      return detected;
    } catch (err) {
      console.error('Failed to detect Deadlock log path via Tauri:', err);
    }
  }
  return null;
}

export async function readDeadlockLogEvents(
  path: string,
  maxBytes?: number
): Promise<LogEvent[]> {
  if (isTauriEnvironment()) {
    try {
      return await invoke<LogEvent[]>('read_deadlock_log_events', {
        path,
        maxBytes,
      });
    } catch (err) {
      throw new Error(`Log read failed: ${err}`);
    }
  }

  // Mock events for browser testing
  return [
    {
      timestamp: new Date().toLocaleTimeString(),
      rawLine: '[Browser Mock] Running in browser preview. Connect with Deadlock desktop app for live Source 2 log stream.',
      eventType: 'info',
    },
  ];
}

export async function saveDeadlockDebugLog(
  targetPath: string,
  content: string
): Promise<boolean> {
  if (isTauriEnvironment()) {
    try {
      return await invoke<boolean>('save_deadlock_debug_log', {
        targetPath,
        content,
      });
    } catch (err) {
      console.error('Failed to save log via Tauri:', err);
      throw err;
    }
  }

  // Fallback: browser download
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'deadlock_debug_log.txt';
  a.click();
  URL.revokeObjectURL(url);
  return true;
}
