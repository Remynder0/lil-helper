import { invoke } from '@tauri-apps/api/core';
import { createWorker } from 'tesseract.js';
import { HEROES, Hero } from '../data/heroes';
import { Side } from '../types/match';
import { saveOcrCapture } from './ocrHistory';

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

import {
  isOcrStopWord,
  ALLIES_HEADER_REGEX,
  ENEMIES_HEADER_REGEX,
  ENEMY_FALLBACK_REGEX,
  detectFactionBilingual,
} from './ocr/ocrDictionaries';

interface CandidateMatch {
  hero: Hero;
  matchedToken: string;
  confidence: number; // 0 (lowest) to 100 (highest)
  distance: number;
  lineIndex: number;
}

function findBestHero(token: string): { hero: Hero; distance: number; confidence: number } | null {
  const clean = cleanWord(token);
  if (clean.length < 3) return null;

  if (isOcrStopWord(clean)) {
    return null;
  }

  let best: Hero | null = null;
  let minDistance = 999;
  let bestConfidence = 0;

  for (const hero of HEROES) {
    const hClean = cleanWord(hero.name);

    // 1. Exact match on full hero name
    if (hClean === clean) {
      return { hero, distance: 0, confidence: 100 };
    }

    // 2. Multi-word hero names matching individual tokens (e.g. "Grey Talon", "Mo & Krill")
    const heroWords = hero.name.split(/[\s&]+/).map(cleanWord).filter((w) => w.length >= 3);
    for (const hw of heroWords) {
      // Special protection: 'krill' vs 'kill'
      if (hw === 'krill' && clean === 'kill') continue;

      if (hw === clean) {
        return { hero, distance: 0, confidence: 95 };
      }

      // Fuzzy match on multi-word token only if token is at least 5 chars
      if (hw.length >= 5 && clean.length >= 4) {
        const d = levenshtein(clean, hw);
        if (d === 1 && d < minDistance) {
          minDistance = d;
          best = hero;
          bestConfidence = 75;
        }
      }
    }

    // 3. Short hero names (<= 4 chars: Ivy, Lash, Haze, Shiv, Rem) MUST MATCH EXACTLY
    if (hClean.length <= 4) {
      // No fuzzy matching for short names to avoid 'last'->Lash, 'have'->Haze, 'server'->Seven, 'ship'->Shiv
      continue;
    }

    // 4. Levenshtein fuzzy distance for longer names (>= 5 chars)
    // Allow distance 1 for 5-6 chars, distance 2 only for 7+ chars
    const maxAllowed = hClean.length >= 7 ? 2 : 1;
    // Length difference cannot exceed 1
    if (Math.abs(clean.length - hClean.length) <= 1) {
      const dist = levenshtein(clean, hClean);
      if (dist <= maxAllowed && dist < minDistance) {
        minDistance = dist;
        best = hero;
        bestConfidence = dist === 1 ? 80 : 60;
      }
    }
  }

  return best ? { hero: best, distance: minDistance, confidence: bestConfidence } : null;
}

/**
 * Extracts candidate heroes from a section with line-aware ordering and confidence.
 */
function extractHeroCandidates(
  lines: string[],
  startLineIdx: number,
  endLineIdx: number,
  allMatchedWords: HeroMatchDetail[]
): Hero[] {
  const candidates: CandidateMatch[] = [];
  const lineMatchedHeroIds = new Map<number, Set<number>>();

  for (let i = startLineIdx; i < endLineIdx; i++) {
    const rawLine = lines[i];
    if (!rawLine) continue;
    const cleanLine = cleanWord(rawLine);

    if (!lineMatchedHeroIds.has(i)) {
      lineMatchedHeroIds.set(i, new Set());
    }
    const matchedInThisLine = lineMatchedHeroIds.get(i)!;

    // 1. Direct multi-word check in line (ONLY for multi-word heroes like "Grey Talon", "Mo & Krill", "Lady Geist")
    for (const hero of HEROES) {
      const isMultiWord = hero.name.includes(' ') || hero.name.includes('&');
      if (!isMultiWord) continue;

      const hClean = cleanWord(hero.name);
      if (hClean.length >= 5 && cleanLine.includes(hClean)) {
        if (!matchedInThisLine.has(hero.id)) {
          matchedInThisLine.add(hero.id);
          candidates.push({
            hero,
            matchedToken: hero.name,
            confidence: 100,
            distance: 0,
            lineIndex: i,
          });
          allMatchedWords.push({
            word: hero.name,
            matchedHero: hero,
            distance: 0,
          });
        }
      }
    }

    // 2. Token-by-token check
    const tokens = rawLine.split(/[\s:,\-_./'"’`()\[\]{}|+=*<>!?;#~^]+/);
    for (const tok of tokens) {
      const match = findBestHero(tok);
      if (match && !matchedInThisLine.has(match.hero.id)) {
        matchedInThisLine.add(match.hero.id);
        candidates.push({
          hero: match.hero,
          matchedToken: tok,
          confidence: match.confidence,
          distance: match.distance,
          lineIndex: i,
        });
        allMatchedWords.push({
          word: tok,
          matchedHero: match.hero,
          distance: match.distance,
        });
      }
    }
  }

  // Deduplicate candidates by hero.id, retaining the highest confidence and earliest line
  const heroBestMap = new Map<number, CandidateMatch>();
  for (const c of candidates) {
    const existing = heroBestMap.get(c.hero.id);
    if (!existing) {
      heroBestMap.set(c.hero.id, c);
    } else {
      if (c.confidence > existing.confidence || (c.confidence === existing.confidence && c.distance < existing.distance)) {
        heroBestMap.set(c.hero.id, c);
      }
    }
  }

  // Convert to array and sort:
  // Primary: line appearance order (so lane order Yellow 1,2 -> Blue 1,2 -> Green 1,2 is respected)
  // But if there are more than 6 candidates, prioritize high confidence (exact matches > fuzzy)
  let heroList = Array.from(heroBestMap.values());

  if (heroList.length > 6) {
    // If over 6, drop the lowest confidence / fuzzy ones first
    heroList.sort((a, b) => {
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      if (a.distance !== b.distance) return a.distance - b.distance;
      return a.lineIndex - b.lineIndex;
    });
    // Keep top 6 by confidence
    heroList = heroList.slice(0, 6);
  }

  // Re-sort by line appearance order to preserve accurate lane assignments
  heroList.sort((a, b) => a.lineIndex - b.lineIndex);

  return heroList.map((c) => c.hero);
}

/**
 * Detects team header line indices robustly.
 */
function findSectionBoundaries(lines: string[]): {
  alliesStart: number;
  enemiesStart: number;
  alliesHeaderName: string;
  enemiesHeaderName: string;
} {
  let alliesStart = 0;
  let enemiesStart = -1;
  let alliesHeaderName = '';
  let enemiesHeaderName = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for Allies header
    if (ALLIES_HEADER_REGEX.test(line)) {
      alliesStart = i + 1;
      alliesHeaderName = line;
    }

    // Check for Enemies header (must appear after Allies if allies was found, or after start)
    if (ENEMIES_HEADER_REGEX.test(line) && i > alliesStart) {
      enemiesStart = i;
      enemiesHeaderName = line;
      break; // Stop at first valid enemy header
    }
  }

  // Fallback: If no explicit enemy header line was matched, look at raw string index
  if (enemiesStart === -1) {
    // Look for mid-point or word 'ennemi' in any line
    for (let i = alliesStart + 1; i < lines.length; i++) {
      if (ENEMY_FALLBACK_REGEX.test(lines[i])) {
        enemiesStart = i;
        enemiesHeaderName = lines[i];
        break;
      }
    }
  }

  // If still not found, split at halfway point
  if (enemiesStart === -1) {
    enemiesStart = Math.floor((lines.length + alliesStart) / 2);
  }

  return { alliesStart, enemiesStart, alliesHeaderName, enemiesHeaderName };
}

/**
 * Captures screen and performs OCR to detect allies, enemies, and faction sides.
 */
export async function scanEscapeMenuDraft(): Promise<ScreenScanResult> {
  const startTime = performance.now();
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

    // 3. Locate Section Boundaries (Allies vs Enemies)
    const { alliesStart, enemiesStart, alliesHeaderName, enemiesHeaderName } = findSectionBoundaries(lines);

    if (alliesHeaderName) {
      statusLog.push(`[${new Date().toLocaleTimeString()}] Found Allies header at line ${alliesStart}: "${alliesHeaderName}".`);
    }
    if (enemiesHeaderName) {
      statusLog.push(`[${new Date().toLocaleTimeString()}] Found Enemies header at line ${enemiesStart}: "${enemiesHeaderName}".`);
    }

    let allies = extractHeroCandidates(lines, alliesStart, enemiesStart, matchedWords);
    let enemies = extractHeroCandidates(lines, enemiesStart, lines.length, matchedWords);

    // Ensure no duplicate hero exists across both teams (e.g. if an enemy hero was parsed in allies section)
    const allyIds = new Set(allies.map((a) => a.id));
    enemies = enemies.filter((e) => !allyIds.has(e.id));

    // Cap strictly at 6 heroes maximum per team (Deadlock is strictly 6v6)
    allies = allies.slice(0, 6);
    enemies = enemies.slice(0, 6);

    // 4. Detect Faction Side (Patron) — Seamlessly supports French, English, or mixed clients
    const alliesRawText = lines.slice(alliesStart, enemiesStart).join(' ');
    const enemiesRawText = lines.slice(enemiesStart).join(' ');

    const factionResult = detectFactionBilingual(alliesRawText, enemiesRawText);
    const detectedSide: Side | undefined = factionResult?.side;
    if (factionResult) {
      statusLog.push(`[${new Date().toLocaleTimeString()}] ${factionResult.reason}.`);
    }

    // Ensure each recognized hero appears exactly once in the diagnostic log
    const finalizedHeroIds = new Set([...allies.map((a) => a.id), ...enemies.map((e) => e.id)]);
    const uniqueMatchedWords: HeroMatchDetail[] = [];
    const seenHeroIds = new Set<number>();
    for (const m of matchedWords) {
      if (finalizedHeroIds.has(m.matchedHero.id) && !seenHeroIds.has(m.matchedHero.id)) {
        seenHeroIds.add(m.matchedHero.id);
        uniqueMatchedWords.push(m);
      }
    }

    statusLog.push(
      `[${new Date().toLocaleTimeString()}] Parsed: ${allies.length} allies (${allies.map((h) => h.name).join(', ') || 'none'}), ${enemies.length} enemies (${enemies.map((h) => h.name).join(', ') || 'none'}).`
    );

    const durationMs = Math.round(performance.now() - startTime);

    saveOcrCapture({
      detectedSide,
      allies: allies.map((h) => ({ id: h.id, name: h.name, iconUrl: h.iconUrl })),
      enemies: enemies.map((h) => ({ id: h.id, name: h.name, iconUrl: h.iconUrl })),
      linesCount: lines.length,
      matchedWordsCount: uniqueMatchedWords.length,
      durationMs,
      capturedImagePreview: base64Image,
      rawText,
      statusLog,
    });

    return {
      allies,
      enemies,
      detectedSide,
      rawText,
      capturedImage: base64Image,
      lines,
      matchedWords: uniqueMatchedWords,
      statusLog,
    };
  } finally {
    await worker.terminate();
  }
}
