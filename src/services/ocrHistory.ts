import { Side } from '../types/match';

export interface OcrHeroDetail {
  id: number;
  name: string;
  iconUrl?: string;
}

export interface OcrCaptureEntry {
  id: string;
  timestamp: string;
  timeMs: number;
  detectedSide?: Side;
  allies: OcrHeroDetail[];
  enemies: OcrHeroDetail[];
  linesCount: number;
  matchedWordsCount: number;
  durationMs: number;
  capturedImagePreview?: string;
  rawText: string;
  statusLog: string[];
}

const STORAGE_KEY = 'deadlock_ocr_captures_log_v1';
const MAX_CAPTURES = 10;

type OcrHistoryListener = (captures: OcrCaptureEntry[]) => void;
const listeners = new Set<OcrHistoryListener>();

let memoryCaptures: OcrCaptureEntry[] = (() => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // Ignore parse error
  }
  return [];
})();

function notifyListeners(): void {
  const current = [...memoryCaptures];
  listeners.forEach((listener) => {
    try {
      listener(current);
    } catch (e) {
      console.error('Error in OcrHistoryListener:', e);
    }
  });
}

function persistCaptures(): void {
  try {
    // Strip or truncate large base64 strings if necessary to preserve localStorage space
    const safeToStore = memoryCaptures.map((entry) => {
      let preview = entry.capturedImagePreview;
      if (preview && preview.length > 200000) {
        // Truncate preview in localStorage to prevent quota exhaustion
        preview = undefined;
      }
      return {
        ...entry,
        capturedImagePreview: preview,
      };
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(safeToStore));
  } catch (err) {
    console.warn('Could not persist OCR captures to localStorage:', err);
  }
}

export function saveOcrCapture(
  entry: Omit<OcrCaptureEntry, 'id' | 'timestamp' | 'timeMs'>
): OcrCaptureEntry {
  const now = new Date();
  const newCapture: OcrCaptureEntry = {
    ...entry,
    id: `ocr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    timeMs: now.getTime(),
  };

  memoryCaptures = [newCapture, ...memoryCaptures].slice(0, MAX_CAPTURES);
  persistCaptures();
  notifyListeners();
  return newCapture;
}

export function getOcrCaptures(): OcrCaptureEntry[] {
  return [...memoryCaptures];
}

export function clearOcrCaptures(): void {
  memoryCaptures = [];
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
  notifyListeners();
}

export function subscribeToOcrCaptures(callback: OcrHistoryListener): () => void {
  listeners.add(callback);
  callback([...memoryCaptures]);
  return () => {
    listeners.delete(callback);
  };
}
