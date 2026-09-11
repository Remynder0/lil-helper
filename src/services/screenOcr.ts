import { invoke } from '@tauri-apps/api/core';
import { createWorker } from 'tesseract.js';
import { HEROES, Hero } from '../data/heroes';

export interface ScreenScanResult {
  allies: Hero[];
  enemies: Hero[];
  rawText: string;
}

function cleanWord(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function levenshtein(a: string, b: string): number {
  const an = a.length;
  const bn = b.length;
  if (an === 0) return bn;
  if (bn === 0) return an;
  const matrix: number[][] = Array(an + 1)
    .fill(0)
    .map(() => Array(bn + 1).fill(0));

  for (let i = 0; i <= an; i++) matrix[i][0] = i;
  for (let j = 0; j <= bn; j++) matrix[0][j] = j;

  for (let i = 1; i <= an; i++) {
    for (let j = 1; j <= bn; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[an][bn];
}

function findBestHero(token: string): Hero | null {
  const clean = cleanWord(token);
  if (clean.length < 3) return null;

  let best: Hero | null = null;
  let minDistance = 999;

  for (const hero of HEROES) {
    const hName = cleanWord(hero.name);
    if (hName === clean) return hero;

    const dist = levenshtein(clean, hName);
    // Allow 1 typo for short names (<=4 chars), 2 typos for longer names
    const maxAllowed = hName.length <= 4 ? 1 : 2;
    if (dist <= maxAllowed && dist < minDistance) {
      minDistance = dist;
      best = hero;
    }
  }

  return best;
}

function parseSection(text: string): Hero[] {
  const lines = text.split('\n');
  const detected: Hero[] = [];

  for (const line of lines) {
    const words = line.split(/[\s:,\-_./]+/);
    for (const w of words) {
      const match = findBestHero(w);
      if (match && !detected.some((h) => h.id === match.id)) {
        detected.push(match);
      }
    }
  }

  return detected;
}

/**
 * Captures screen and performs OCR to detect allies and enemies.
 */
export async function scanEscapeMenuDraft(): Promise<ScreenScanResult> {
  // 1. Capture right half of primary display from Rust
  const base64Image = await invoke<string>('capture_screen_image', {
    rightHalfOnly: true,
  });

  // 2. Perform OCR using Tesseract (English)
  const worker = await createWorker('eng');
  try {
    const ret = await worker.recognize(base64Image);
    const rawText = ret.data.text;

    // 3. Split sections by Enemy Team header (case-insensitive)
    const parts = rawText.split(/EQUIPE ENNEMIE|ÉQUIPE ENNEMIE|ENNEMIE|ENEMY TEAM/i);
    const alliesSection = parts[0] || '';
    const enemiesSection = parts[1] || '';

    const allies = parseSection(alliesSection);
    const enemies = parseSection(enemiesSection);

    return {
      allies,
      enemies,
      rawText,
    };
  } finally {
    await worker.terminate();
  }
}

