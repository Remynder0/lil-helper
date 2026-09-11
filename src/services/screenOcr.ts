import { invoke } from '@tauri-apps/api/core';
import { createWorker } from 'tesseract.js';
import { HEROES, Hero } from '../data/heroes';
import { Side } from '../types/match';

export interface HeroMatchDetail {
  word: string;
  matchedHero: Hero;
  distance: number;
}

export interface ScreenScanResult {
  allies: Hero[];
  enemies: Hero[];
  detectedSide?: Side;
  rawText: string;
  capturedImage: string;
  lines: string[];
  matchedWords: HeroMatchDetail[];
  statusLog: string[];
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

function findBestHero(token: string): { hero: Hero; distance: number } | null {
  const clean = cleanWord(token);
  if (clean.length < 3) return null;

  // Ignore common UI words in the menu
  if (clean === 'niveau' || clean === 'contacts' || clean === 'occultistes' || clean === 'equipe' || clean === 'ennemie') {
    return null;
  }

  let best: Hero | null = null;
  let minDistance = 999;

  for (const hero of HEROES) {
    const hClean = cleanWord(hero.name);

    // 1. Exact match on full hero name
    if (hClean === clean) return { hero, distance: 0 };

    // 2. Multi-word hero names matching individual tokens (e.g. "Grey Talon" -> token "talon" or "grey")
    const heroWords = hero.name.split(' ').map(cleanWord);
    for (const hw of heroWords) {
      if (hw.length >= 4) {
        if (hw === clean) return { hero, distance: 0 };
        const d = levenshtein(clean, hw);
        if (d <= 1 && d < minDistance) {
          minDistance = d;
          best = hero;
        }
      }
    }

    // 3. Levenshtein fuzzy distance
    const dist = levenshtein(clean, hClean);
    const maxAllowed = hClean.length <= 4 ? 1 : 2;
    if (dist <= maxAllowed && dist < minDistance) {
      minDistance = dist;
      best = hero;
    }
  }

  return best ? { hero: best, distance: minDistance } : null;
}

function parseSectionWithDebug(text: string, matchedWords: HeroMatchDetail[]): Hero[] {
  const lines = text.split('\n');
  const detected: Hero[] = [];

  for (const line of lines) {
    const cleanLine = cleanWord(line);

    // Check line for multi-word exact names first (e.g. Grey Talon, Mo & Krill)
    for (const hero of HEROES) {
      const hClean = cleanWord(hero.name);
      if (hClean.length >= 5 && cleanLine.includes(hClean)) {
        if (!detected.some((h) => h.id === hero.id)) {
          detected.push(hero);
          matchedWords.push({
            word: line.trim(),
            matchedHero: hero,
            distance: 0,
          });
        }
      }
    }

    const words = line.split(/[\s:,\-_./'"’`()]+/);
    for (const w of words) {
      const match = findBestHero(w);
      if (match) {
        matchedWords.push({
          word: w,
          matchedHero: match.hero,
          distance: match.distance,
        });
        if (!detected.some((h) => h.id === match.hero.id)) {
          detected.push(match.hero);
        }
      }
    }
  }

  return detected;
}

/**
 * Captures screen and performs OCR to detect allies, enemies, and faction sides.
 */
export async function scanEscapeMenuDraft(): Promise<ScreenScanResult> {
  const statusLog: string[] = [];
  statusLog.push(`[${new Date().toLocaleTimeString()}] Starting screen capture via Rust native bridge...`);

  // 1. Capture right 30% of display from Rust (pre-processed and upscaled x2)
  const base64Image = await invoke<string>('capture_screen_image', {
    rightHalfOnly: true,
  });

  statusLog.push(`[${new Date().toLocaleTimeString()}] Screen capture received (${Math.round(base64Image.length / 1024)} KB). Initializing OCR worker...`);

  // 2. Perform OCR using Tesseract (English)
  const worker = await createWorker('eng');
  try {
    statusLog.push(`[${new Date().toLocaleTimeString()}] Running optical character recognition on image...`);
    const ret = await worker.recognize(base64Image);
    const rawText = ret.data.text || '';
    const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);

    statusLog.push(`[${new Date().toLocaleTimeString()}] OCR completed: extracted ${lines.length} lines of text.`);

    const matchedWords: HeroMatchDetail[] = [];

    // 3. Split sections by Enemy Team header (case-insensitive)
    const parts = rawText.split(/EQUIPE ENNEMIE|ÉQUIPE ENNEMIE|ENNEMIE|ENEMY TEAM|ENEMY/i);
    const alliesSection = parts[0] || '';
    const enemiesSection = parts[1] || '';

    const allies = parseSectionWithDebug(alliesSection, matchedWords);
    const enemies = parseSectionWithDebug(enemiesSection, matchedWords);

    // 4. Detect Faction Side (Patron)
    // If enemy side has "Roi de l'Ombre", player is "The Archmother"
    // If enemy side has "Matriarche", player is "The Hidden King"
    let detectedSide: Side | undefined = undefined;
    if (/roi\s*de\s*(?:l\s*['’]?)?ombre/i.test(enemiesSection)) {
      detectedSide = 'archmother'; // Allied side is Archmother
      statusLog.push(`[${new Date().toLocaleTimeString()}] Detected Enemy Patron: Roi de l'Ombre -> Player Side: The Archmother.`);
    } else if (/matriarche/i.test(enemiesSection)) {
      detectedSide = 'hidden_king'; // Allied side is Hidden King
      statusLog.push(`[${new Date().toLocaleTimeString()}] Detected Enemy Patron: Matriarche -> Player Side: The Hidden King.`);
    } else if (/matriarche/i.test(alliesSection)) {
      detectedSide = 'archmother';
      statusLog.push(`[${new Date().toLocaleTimeString()}] Detected Allied Patron: Matriarche -> Player Side: The Archmother.`);
    } else if (/roi\s*de\s*(?:l\s*['’]?)?ombre/i.test(alliesSection)) {
      detectedSide = 'hidden_king';
      statusLog.push(`[${new Date().toLocaleTimeString()}] Detected Allied Patron: Roi de l'Ombre -> Player Side: The Hidden King.`);
    }

    statusLog.push(
      `[${new Date().toLocaleTimeString()}] Parsed: ${allies.length} allies (${allies.map((h) => h.name).join(', ') || 'none'}), ${enemies.length} enemies (${enemies.map((h) => h.name).join(', ') || 'none'}).`
    );

    return {
      allies,
      enemies,
      detectedSide,
      rawText,
      capturedImage: base64Image,
      lines,
      matchedWords,
      statusLog,
    };
  } finally {
    await worker.terminate();
  }
}
