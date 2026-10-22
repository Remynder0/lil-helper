import { Match } from "../types/match";
import { DEADLOCK_RANK_NAMES } from "./deadlockApi";
import { calculateRankedProgression } from "./rankedCalculator";

// ============================================================================
// 1. RANK TIERS & SUBRANKS DEFINITION
// ============================================================================

export const ROMAN_NUMERALS = ["", "I", "II", "III", "IV", "V", "VI"];

/**
 * Official percentile thresholds for Eternus (Tier 11):
 * Eternus is percentile-based instead of flat point milestones:
 * - Eternus I   :  0%
 * - Eternus II  : 25%
 * - Eternus III : 50%
 * - Eternus IV  : 70%
 * - Eternus V   : 85%
 * - Eternus VI  : 95%
 */
export const ETERNUS_PERCENTILE_THRESHOLDS = [
  { subrank: 6, percentile: 95 },
  { subrank: 5, percentile: 85 },
  { subrank: 4, percentile: 70 },
  { subrank: 3, percentile: 50 },
  { subrank: 2, percentile: 25 },
  { subrank: 1, percentile: 0 },
] as const;

export function getEternusSubrankFromPercentile(percentile: number): number {
  const p = Math.max(0, percentile);
  for (const t of ETERNUS_PERCENTILE_THRESHOLDS) {
    if (p >= t.percentile) {
      return t.subrank;
    }
  }
  return 1;
}

export interface RankedShieldEvent {
  matchId: string;
  type: "gained" | "used";
  count: number;
  reason: string;
  subrankLabel: string;
  shieldsRemaining?: number;
}

export interface ProcessedRankedMatch {
  match: Match;
  index: number;
  startProgress: number;
  endProgress: number;
  effectiveDelta: number;
  rank: number;
  subrank: number;
  tierName: string;
  subrankRoman: string;
  subrankLabel: string;
  shieldEvent?: RankedShieldEvent;
  isGapBefore: boolean;
  gapPointsBefore: number;
  runningShields: number;
  streak: number;
}

/** Plotted point with strict absolute coordinates based on post-match rating (endProgress) */
export interface PlottedPoint {
  match: Match;
  index: number;
  progress: number;
  x: number;
  y: number;
  shieldEvent?: RankedShieldEvent;
  effectiveDelta: number;
  startProgress: number;
  endProgress: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

/** Caesura / break indicating an unrecorded match gap */
export interface RankedGapCaesura {
  index: number;
  prevMatch: Match;
  nextMatch: Match;
  x: number;
  gapPoints: number;
  prevY: number;
  nextY: number;
}

/** Line segment connecting two contiguous points without a gap */
export interface PlottedLineSegment {
  index: number;
  match: Match;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  effectiveDelta: number;
  isWin: boolean;
  isLoss: boolean;
}

export interface RankedThresholdLine {
  y: number;
  val: number;
  label: string;
}

/** Vertical rank transition marker (especially for percentile-based tiers like Eternus) */
export interface RankedVerticalTransitionMarker {
  index: number;
  x: number;
  fromRank: number;
  toRank: number;
  fromSubrank: number;
  toSubrank: number;
  type: 'promotion' | 'demotion';
  label: string;
  badgeImageUrl?: string;
}

export interface PlottedChartGeometry {
  width: number;
  height: number;
  padding: { top: number; right: number; bottom: number; left: number };
  points: PlottedPoint[];
  gaps: RankedGapCaesura[];
  segments: PlottedLineSegment[];
  verticalTransitions: RankedVerticalTransitionMarker[];
  finalEndpoint: { x: number; y: number; progress: number } | null;
  areaD: string;
  thresholdLines: RankedThresholdLine[];
  yMin: number;
  yMax: number;
}

/**
 * Maps a flat_progress value to official Deadlock Rank & Subrank:
 * - Each rank tier contains exactly 7,000 points (Tiers 1 to 10).
 * - Initiate I begins at 0 pts.
 * - Subranks 1 to 5: 1,000 points each.
 * - Subrank 6: 2,000 points (tier ascent threshold to next rank).
 * - Rank 11 (Eternus): begins at 70,000 pts and is percentile-based (0%, 25%, 50%, 70%, 85%, 95%).
 */
export function getRankTierFromFlatProgress(flatProgress: number, eternusPercentile?: number) {
  const p = Math.max(0, flatProgress);
  const tierIndex = Math.floor(p / 7000);

  if (tierIndex >= 10) {
    // Rank 11 : Eternus (percentiles based)
    const rank = 11;
    const subrank =
      eternusPercentile !== undefined
        ? getEternusSubrankFromPercentile(eternusPercentile)
        : 1;
    const tierName = DEADLOCK_RANK_NAMES[rank] || 'Eternus';
    const subrankRoman = ROMAN_NUMERALS[subrank] || String(subrank);

    return {
      rank,
      subrank,
      tierName,
      subrankRoman,
      label: `${tierName} ${subrankRoman}`,
      isPercentileBased: true,
    };
  }

  const rank = Math.min(11, tierIndex + 1);
  const rem = p % 7000;

  let subrank: number;
  if (rem < 1000) subrank = 1;
  else if (rem < 2000) subrank = 2;
  else if (rem < 3000) subrank = 3;
  else if (rem < 4000) subrank = 4;
  else if (rem < 5000) subrank = 5;
  else subrank = 6; // 5,000 to 7,000 pts (2,000 pts wide)

  const tierName = DEADLOCK_RANK_NAMES[rank] || `Tier ${rank}`;
  const subrankRoman = ROMAN_NUMERALS[subrank] || String(subrank);

  return {
    rank,
    subrank,
    tierName,
    subrankRoman,
    label: `${tierName} ${subrankRoman}`,
    isPercentileBased: false,
  };
}

/**
 * Computes official subrank floor for demotion protection:
 * - Subranks 1 to 5: tierBase + (subrank - 1) * 1000
 * - Subrank 6: tierBase + 5000
 */
export function getSubrankFloor(pts: number): number {
  const p = Math.max(0, pts);
  if (p >= 70000) {
    return 70000; // Floor of Eternus before demoting to Ascendant VI
  }
  const tierBase = Math.floor(p / 7000) * 7000;
  const rem = p % 7000;
  if (rem < 1000) return tierBase;
  if (rem < 2000) return tierBase + 1000;
  if (rem < 3000) return tierBase + 2000;
  if (rem < 4000) return tierBase + 3000;
  if (rem < 5000) return tierBase + 4000;
  return tierBase + 5000;
}

// ============================================================================
// 2. MATCH PROCESSING (Validation, Gaps, Shields, Deltas)
// ============================================================================

export function processRankedMatches(rawMatches: Match[]): {
  processedMatches: ProcessedRankedMatch[];
  shieldEventsMap: Map<string, RankedShieldEvent>;
  matchDeltasMap: Map<string, number>;
} {
  const rankedMatches = rawMatches
    .filter(
      (m) =>
        (m.rankedBadge ?? 0) > 0 ||
        (m.rankedRank ?? 0) > 0 ||
        ((m.rankedProgress ?? 0) > 0 && m.rankedDelta !== undefined && m.rankedDelta !== null)
    )
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const processedMatches: ProcessedRankedMatch[] = [];
  const shieldEventsMap = new Map<string, RankedShieldEvent>();
  const matchDeltasMap = new Map<string, number>();

  let runningShields = 5;
  let currentStreak = 0;

  for (let i = 0; i < rankedMatches.length; i++) {
    const curr = rankedMatches[i];
    const prevProcessed = i > 0 ? processedMatches[i - 1] : null;
    const prevEndProgress = prevProcessed ? prevProcessed.endProgress : null;

    let currStartProgress: number;
    let currEndProgress: number;
    let effectiveDelta: number;

    if (curr.rankedProgress !== null && curr.rankedProgress !== undefined &&
        curr.rankedInitialProgress !== null && curr.rankedInitialProgress !== undefined) {
      currStartProgress = curr.rankedInitialProgress;
      currEndProgress = curr.rankedProgress;
      effectiveDelta = curr.rankedDelta ?? (currEndProgress - currStartProgress);
    } else if (curr.rankedProgress !== null && curr.rankedProgress !== undefined) {
      effectiveDelta = curr.rankedDelta ?? 0;
      currStartProgress = curr.rankedProgress - effectiveDelta;
      currEndProgress = curr.rankedProgress;
    } else if (prevEndProgress !== null) {
      const calc = calculateRankedProgression(curr.result, curr.date, rankedMatches.slice(0, i));
      effectiveDelta = calc.rankedDelta ?? 0;
      currStartProgress = prevEndProgress;
      currEndProgress = currStartProgress + effectiveDelta;
    } else {
      currStartProgress = 0;
      effectiveDelta = curr.rankedDelta ?? 0;
      currEndProgress = currStartProgress + effectiveDelta;
    }

    const isGapBefore = prevEndProgress !== null && currStartProgress !== prevEndProgress;
    const gapPointsBefore = isGapBefore ? currStartProgress - prevEndProgress! : 0;

    const endRankInfo = getRankTierFromFlatProgress(currEndProgress);

    const currRank = curr.rankedRank ?? (curr.rankedBadge ? Math.floor(curr.rankedBadge / 10) : endRankInfo.rank);
    const currSubrank = curr.rankedSubrank ?? (curr.rankedBadge ? (curr.rankedBadge % 10) : endRankInfo.subrank);
    const currSubrankLabel = (DEADLOCK_RANK_NAMES[currRank] || endRankInfo.tierName) + " " + (ROMAN_NUMERALS[currSubrank] || endRankInfo.subrankRoman);
    const maxShields = currSubrank <= 2 ? 5 : 2;

    const prevRank = prevProcessed ? prevProcessed.rank : null;
    const prevSubrank = prevProcessed ? prevProcessed.subrank : null;

    let shieldEvent: RankedShieldEvent | undefined = undefined;

    const isPromotion =
      prevRank !== null &&
      (currRank > prevRank || (currRank === prevRank && currSubrank > (prevSubrank ?? 0)));
    const isDemotion =
      prevRank !== null &&
      (currRank < prevRank || (currRank === prevRank && currSubrank < (prevSubrank ?? 0)));

    if (i === 0) {
      runningShields = curr.rankedDemotionProtection !== null && curr.rankedDemotionProtection !== undefined
        ? Math.min(maxShields, Math.max(0, curr.rankedDemotionProtection))
        : maxShields;
    } else if (isGapBefore) {
      currentStreak = curr.result === "win" ? 1 : 0;
      runningShields = curr.rankedDemotionProtection !== null && curr.rankedDemotionProtection !== undefined
        ? Math.min(maxShields, Math.max(0, curr.rankedDemotionProtection))
        : maxShields;
    } else {
      if (curr.result === "win") {
        currentStreak += 1;
      } else if (curr.result === "loss") {
        currentStreak = 0;
      }
    }

    if (isPromotion || isDemotion) {
      const resetCount = maxShields;
      runningShields = resetCount;
      shieldEvent = {
        matchId: curr.id,
        type: "gained",
        count: resetCount,
        reason: (isPromotion ? "Promotion" : "Demotion") + " to " + currSubrankLabel + " (" + resetCount + " shields reset)",
        subrankLabel: currSubrankLabel,
        shieldsRemaining: runningShields,
      };
    } else {
      const isLoss = curr.result === "loss" || effectiveDelta < 0;
      const subrankFloor = getSubrankFloor(currStartProgress);
      const explicitConsumed = curr.rankedConsumedDemotionProtection === true;
      const isLossAtFloor = isLoss && (effectiveDelta === 0 || currEndProgress <= subrankFloor);

      if (isLoss && runningShields <= 0) {
        // Strict rule: with 0 shields left, defeat cannot be clamped to 0 delta
        if (effectiveDelta === 0) {
          effectiveDelta = curr.rankedDelta && curr.rankedDelta !== 0 ? curr.rankedDelta : -300;
          currEndProgress = Math.max(0, currStartProgress + effectiveDelta);
        }
      } else if (runningShields > 0 && (explicitConsumed || isLossAtFloor)) {
        // Consume shield strictly capped to available shields
        runningShields = Math.max(0, runningShields - 1);
        shieldEvent = {
          matchId: curr.id,
          type: "used",
          count: -1,
          reason: "Demotion protection activated (shield consumed)",
          subrankLabel: currSubrankLabel,
          shieldsRemaining: runningShields,
        };
      } else if (curr.rankedDemotionProtection !== null && curr.rankedDemotionProtection !== undefined) {
        runningShields = Math.min(runningShields, Math.min(maxShields, curr.rankedDemotionProtection));
      }
    }

    if (shieldEvent) {
      shieldEventsMap.set(curr.id, shieldEvent);
    }
    matchDeltasMap.set(curr.id, effectiveDelta);

    processedMatches.push({
      match: curr,
      index: i,
      startProgress: currStartProgress,
      endProgress: currEndProgress,
      effectiveDelta,
      rank: currRank,
      subrank: currSubrank,
      tierName: DEADLOCK_RANK_NAMES[currRank] || endRankInfo.tierName,
      subrankRoman: ROMAN_NUMERALS[currSubrank] || endRankInfo.subrankRoman,
      subrankLabel: currSubrankLabel,
      shieldEvent,
      isGapBefore,
      gapPointsBefore,
      runningShields,
      streak: currentStreak,
    });
  }

  return {
    processedMatches,
    shieldEventsMap,
    matchDeltasMap,
  };
}

// ============================================================================
// 3. POINT PLOTTING (Strict absolute mathematical pixel projection)
// ============================================================================

export interface PlottingContext {
  width: number;
  height: number;
  padding: { top: number; right: number; bottom: number; left: number };
  chartW: number;
  chartH: number;
  yMin: number;
  yMax: number;
  yRange: number;
  toY: (val: number) => number;
  getX: (idx: number) => number;
}

export function createPlottingContext(
  processedMatches: ProcessedRankedMatch[],
  options?: {
    width?: number;
    height?: number;
    padding?: { top: number; right: number; bottom: number; left: number };
  }
): PlottingContext {
  const width = options?.width ?? 860;
  const height = options?.height ?? 280;
  // Increased top padding to 55 to comfortably accommodate hierarchical Eternus badges without collision
  const padding = options?.padding ?? { top: 55, right: 35, bottom: 40, left: 80 };

  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const n = processedMatches.length;

  const allValues = processedMatches.flatMap((m) => [m.startProgress, m.endProgress]);
  const minVal = allValues.length > 0 ? Math.min(...allValues) : 0;
  const maxVal = allValues.length > 0 ? Math.max(...allValues) : 7000;

  const yMin = Math.max(0, Math.floor((minVal - 200) / 1000) * 1000);
  const yMax = Math.ceil((maxVal + 300) / 1000) * 1000;
  const yRange = Math.max(1000, yMax - yMin);

  const toY = (val: number) => padding.top + chartH - ((val - yMin) / yRange) * chartH;

  // X distribution with 2.2x enlarged spacing on timeline gaps
  const cumWeights: number[] = [0];
  for (let i = 1; i < n; i++) {
    const isGap = processedMatches[i].isGapBefore;
    const intervalWeight = isGap ? 2.2 : 1.0;
    cumWeights.push(cumWeights[i - 1] + intervalWeight);
  }
  const totalWeight = cumWeights[n - 1] || 1;

  const getX = (idx: number) => {
    if (n === 1) return padding.left + 0.5 * chartW;
    return padding.left + (cumWeights[idx] / totalWeight) * chartW;
  };

  return {
    width,
    height,
    padding,
    chartW,
    chartH,
    yMin,
    yMax,
    yRange,
    toY,
    getX,
  };
}

export function plotRawPoints(
  processedMatches: ProcessedRankedMatch[],
  ctx: PlottingContext
): PlottedPoint[] {
  return processedMatches.map((item, idx) => {
    const x = ctx.getX(idx);
    const startY = ctx.toY(item.startProgress);
    const endY = ctx.toY(item.endProgress);

    return {
      match: item.match,
      index: idx,
      progress: item.endProgress,
      x,
      y: endY, // Absolute position after match outcome
      shieldEvent: item.shieldEvent,
      effectiveDelta: item.effectiveDelta,
      startProgress: item.startProgress,
      endProgress: item.endProgress,
      startX: x,
      startY,
      endX: x,
      endY,
    };
  });
}

// ============================================================================
// 4. GAP & VERTICAL TRANSITIONS INSERTION
// ============================================================================

export function addRankedGaps(
  processedMatches: ProcessedRankedMatch[],
  ctx: PlottingContext
): RankedGapCaesura[] {
  const gaps: RankedGapCaesura[] = [];
  const n = processedMatches.length;

  for (let i = 1; i < n; i++) {
    const item = processedMatches[i];
    if (item.isGapBefore) {
      const prevX = ctx.getX(i - 1);
      const currX = ctx.getX(i);
      const gapX = (prevX + currX) / 2;
      const prevY = ctx.toY(processedMatches[i - 1].endProgress);
      const nextY = ctx.toY(item.startProgress);
      gaps.push({
        index: i,
        prevMatch: processedMatches[i - 1].match,
        nextMatch: item.match,
        x: gapX,
        gapPoints: item.gapPointsBefore,
        prevY,
        nextY,
      });
    }
  }

  return gaps;
}

/**
 * Creates vertical transition markers across the chart whenever an Eternus
 * subrank transition occurs (percentile-based), or when any promotion/demotion happens.
 * For Eternus, this avoids false horizontal lines where a lower MMR could appear above a higher subrank.
 */
export function addVerticalTransitions(
  processedMatches: ProcessedRankedMatch[],
  ctx: PlottingContext
): RankedVerticalTransitionMarker[] {
  const transitions: RankedVerticalTransitionMarker[] = [];
  const n = processedMatches.length;

  for (let i = 1; i < n; i++) {
    const prev = processedMatches[i - 1];
    const curr = processedMatches[i];

    // Detect if either prev or curr is in Eternus (rank 11) and subrank/rank changed
    const isEternusInvolved = curr.rank === 11 || prev.rank === 11;
    const rankChanged = curr.rank !== prev.rank || curr.subrank !== prev.subrank;

    if (isEternusInvolved && rankChanged) {
      const isPromo =
        curr.rank > prev.rank || (curr.rank === prev.rank && curr.subrank > prev.subrank);
      const x = ctx.getX(i);

      transitions.push({
        index: i,
        x,
        fromRank: prev.rank,
        toRank: curr.rank,
        fromSubrank: prev.subrank,
        toSubrank: curr.subrank,
        type: isPromo ? 'promotion' : 'demotion',
        label: `${curr.tierName} ${curr.subrankRoman}`,
        badgeImageUrl: `https://api.deadlock-api.com/v1/assets/ranks/${curr.rank}/${curr.subrank}/image`,
      });
    }
  }

  return transitions;
}

// ============================================================================
// 5. POINT CONNECTION (Segments and Area Path)
// ============================================================================

export function connectRankedPoints(
  points: PlottedPoint[],
  processedMatches: ProcessedRankedMatch[],
  ctx: PlottingContext
): { segments: PlottedLineSegment[]; areaD: string } {
  const segments: PlottedLineSegment[] = [];
  const n = points.length;

  if (n <= 1) {
    return { segments, areaD: "" };
  }

  // 1. Connection segments between contiguous points
  for (let i = 1; i < n; i++) {
    const currItem = processedMatches[i];
    if (currItem.isGapBefore) {
      continue;
    }

    const prevPt = points[i - 1];
    const currPt = points[i];

    segments.push({
      index: i,
      match: currPt.match,
      x1: prevPt.x,
      y1: prevPt.y,
      x2: currPt.x,
      y2: currPt.y,
      effectiveDelta: currPt.effectiveDelta,
      isWin: currPt.effectiveDelta > 0 || currPt.match.result === "win",
      isLoss: currPt.effectiveDelta < 0 || currPt.match.result === "loss",
    });
  }

  // 2. Closed SVG area path under contiguous sections (areaD)
  const bottomY = ctx.padding.top + ctx.chartH;
  let areaD = "";
  let inSubpath = false;
  let subpathStartX = 0;

  for (let i = 0; i < n; i++) {
    const isGap = i > 0 && processedMatches[i].isGapBefore;

    if (isGap && inSubpath) {
      areaD += ` L ${points[i - 1].x} ${bottomY} L ${subpathStartX} ${bottomY} Z `;
      inSubpath = false;
    }

    if (!inSubpath) {
      areaD += `M ${points[i].x} ${points[i].y}`;
      subpathStartX = points[i].x;
      inSubpath = true;
    } else {
      areaD += ` L ${points[i].x} ${points[i].y}`;
    }
  }

  if (inSubpath && n > 0) {
    areaD += ` L ${points[n - 1].x} ${bottomY} L ${subpathStartX} ${bottomY} Z`;
  }

  return { segments, areaD: areaD.trim() };
}

// ============================================================================
// FULL PIPELINE ORCHESTRATOR : plotRankedPoints
// ============================================================================

export function plotRankedPoints(
  processedMatches: ProcessedRankedMatch[],
  options?: {
    width?: number;
    height?: number;
    padding?: { top: number; right: number; bottom: number; left: number };
    tierOnlyThresholds?: boolean;
  }
): PlottedChartGeometry | null {
  if (processedMatches.length === 0) return null;

  // Step 3: Plot raw points
  const ctx = createPlottingContext(processedMatches, options);
  const points = plotRawPoints(processedMatches, ctx);

  // Step 4: Add caesuras for unrecorded gaps & vertical transitions for Eternus
  const gaps = addRankedGaps(processedMatches, ctx);
  const verticalTransitions = addVerticalTransitions(processedMatches, ctx);

  // Step 5: Connect contiguous points (segments & area)
  const { segments, areaD } = connectRankedPoints(points, processedMatches, ctx);

  const finalEndpoint =
    points.length > 0
      ? {
          x: points[points.length - 1].endX,
          y: ctx.toY(points[points.length - 1].endProgress),
          progress: points[points.length - 1].endProgress,
        }
      : null;

  // Horizontal threshold grid lines
  // If tierOnlyThresholds is true (Global view), display only major tier boundaries (every 7,000 pts)
  const thresholdLines: RankedThresholdLine[] = [];
  const minTier = Math.floor(ctx.yMin / 7000);
  const maxTier = Math.ceil(ctx.yMax / 7000);
  const subrankOffsets = options?.tierOnlyThresholds ? [0] : [0, 1000, 2000, 3000, 4000, 5000];

  for (let t = minTier; t <= maxTier; t++) {
    if (t >= 10) {
      // Eternus base floor entry threshold at 70,000 pts
      const v = 70000;
      if (v >= ctx.yMin && v <= ctx.yMax && !thresholdLines.some((l) => l.val === v)) {
        thresholdLines.push({
          y: ctx.toY(v),
          val: v,
          label: 'Eternus',
        });
      }
      continue;
    }
    const base = t * 7000;
    for (const off of subrankOffsets) {
      const v = base + off;
      if (v >= ctx.yMin && v <= ctx.yMax) {
        const info = getRankTierFromFlatProgress(v);
        thresholdLines.push({
          y: ctx.toY(v),
          val: v,
          label: options?.tierOnlyThresholds ? info.tierName : info.label,
        });
      }
    }
  }

  return {
    width: ctx.width,
    height: ctx.height,
    padding: ctx.padding,
    points,
    gaps,
    segments,
    verticalTransitions,
    finalEndpoint,
    areaD,
    thresholdLines,
    yMin: ctx.yMin,
    yMax: ctx.yMax,
  };
}
