import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

let cachedTauriAuth: boolean | null = null;
let testAuthOverride: boolean | null = null;

/**
 * Checks whether the current runtime is running inside the Tauri native desktop shell.
 */
export function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/**
 * Allows automated tests to simulate developer authorization state.
 * @internal
 */
export function _setDevAuthorizedForTesting(value: boolean | null): void {
  testAuthOverride = value;
  cachedTauriAuth = value;
}

/**
 * Synchronous developer authorization check.
 * Evaluates compile-time macro `__DEV_MACHINE_AUTHORIZED__` injected by Vite.
 * In production release builds or non-developer machines, this is statically `false`.
 */
export function isDeveloperAuthorizedSync(): boolean {
  if (testAuthOverride !== null) {
    return testAuthOverride;
  }

  if (cachedTauriAuth === false) {
    return false;
  }

  try {
    if (typeof __DEV_MACHINE_AUTHORIZED__ !== 'undefined') {
      return Boolean(__DEV_MACHINE_AUTHORIZED__);
    }
  } catch {
    return false;
  }

  return false;
}

/**
 * Asynchronous developer authorization check with native Tauri verification.
 * In addition to the build-time define, it validates host operating system
 * username, hostname, and debug assertions via the native Rust backend.
 */
export async function isDeveloperAuthorized(): Promise<boolean> {
  if (testAuthOverride !== null) {
    return testAuthOverride;
  }

  // 1. Fast compile-time / sync check
  if (!isDeveloperAuthorizedSync()) {
    cachedTauriAuth = false;
    return false;
  }

  // 2. In Tauri native shell, verify through Rust command
  if (isTauriEnvironment()) {
    try {
      const authorized = await invoke<boolean>('is_developer_authorized');
      cachedTauriAuth = Boolean(authorized);
      return cachedTauriAuth;
    } catch (err) {
      console.warn('Failed to verify developer authorization via Tauri IPC:', err);
      cachedTauriAuth = false;
      return false;
    }
  }

  // In non-Tauri dev browser environment, fall back to sync define
  return true;
}

/**
 * React hook providing developer authorization status.
 * Re-validates with the native Tauri backend on mount.
 */
export function useDevAuthorization(): boolean {
  const [authorized, setAuthorized] = useState<boolean>(() => isDeveloperAuthorizedSync());

  useEffect(() => {
    let isMounted = true;
    isDeveloperAuthorized().then((result) => {
      if (isMounted) {
        setAuthorized(result);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  return authorized;
}
