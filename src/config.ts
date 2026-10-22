/**
 * Application Constants & Developer Configurations
 * 
 * Rules for configurable variables in this file:
 * - A configurable variable is any parameter whose value can be safely modified
 *   (within its documented bounds) without breaking functionality, logic, or display layout.
 * - Names MUST be explicit, descriptive, and verbose so their exact intent is instantly clear.
 * - User-modifiable settings belong in `userSettings.ts` (stored in localStorage/backend).
 */

export const RANKED_CHART_CONFIG = {
  /**
   * Number of contiguous ranked matches displayed at once in the sliding timeline view.
   * Modifying this value safely scales the match slice, chart x-axis spacing, button label, and slider bounds.
   * Recommended safe bounds: 10 to 60 matches.
   */
  TIMELINE_SLIDING_WINDOW_MATCH_COUNT: 40,

  /**
   * Number of matches shown in the 'Last X' quick presets.
   */
  PRESET_LAST_MATCHES_PRIMARY_COUNT: 50,
  PRESET_LAST_MATCHES_SECONDARY_COUNT: 20,

  /**
   * Spacing multiplier applied between two consecutive match points on the X axis
   * whenever an unrecorded match gap (discontinuity in flat progress) is detected.
   * Safe bounds: 1.5 to 3.5.
   */
  TIMELINE_GAP_SPACING_EXPANSION_MULTIPLIER: 2.2,

  /**
   * Vertical spacing (in SVG pixels) between stacked Eternus percentile subrank badges
   * displayed along the upper horizontal band.
   * Safe bounds: 14 to 28 pixels.
   */
  ETERNUS_SUBRANK_BADGE_VERTICAL_STEP_PIXELS: 20,

  /**
   * Top inner padding (in SVG pixels) reserved for chart geometry to ensure
   * top badges and guidelines never overlap with plotted match points.
   * Safe bounds: 35 to 70 pixels.
   */
  SVG_CHART_HEADER_TOP_PADDING_PIXELS: 55,
} as const;
