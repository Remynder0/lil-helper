/**
 * Global Application Constants & Developer Configurations
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

export const ANALYTICS_SAMPLE_CONFIG = {
  /**
   * Total recorded matches threshold at which the global representativeness rule
   * transitions from the initial sample requirement to the mature sample requirement.
   * Safe bounds: 50 to 250 matches.
   */
  MATURE_ACCOUNT_TOTAL_MATCHES_THRESHOLD: 100,

  /**
   * Minimum matches required with/against a hero to be considered statistically
   * representative when the account has fewer than MATURE_ACCOUNT_TOTAL_MATCHES_THRESHOLD games.
   * Safe bounds: 3 to 10 matches.
   */
  HERO_REPRESENTATIVE_MIN_GAMES_INITIAL: 5,

  /**
   * Minimum matches required with/against a hero to be considered statistically
   * representative once the account reaches MATURE_ACCOUNT_TOTAL_MATCHES_THRESHOLD games.
   * Safe bounds: 5 to 25 matches.
   */
  HERO_REPRESENTATIVE_MIN_GAMES_MATURE: 10,

  /**
   * Mid-tier total matches threshold used by lane-specific matchup analytics.
   * Safe bounds: 25 to 100 matches.
   */
  LANE_INTERMEDIATE_ACCOUNT_TOTAL_MATCHES_THRESHOLD: 50,

  /**
   * Minimum lane encounters required for lane matchup representativeness
   * across initial (< 50), intermediate (50–99), and mature (100+) match histories.
   */
  LANE_REPRESENTATIVE_MIN_GAMES_INITIAL: 2,
  LANE_REPRESENTATIVE_MIN_GAMES_INTERMEDIATE: 3,
  LANE_REPRESENTATIVE_MIN_GAMES_MATURE: 5,
} as const;

export const GAME_LOG_POLLING_CONFIG = {
  /**
   * Polling interval (in milliseconds) for reading Deadlock console logs
   * when the player is actively in a match or pre-game draft.
   * Safe bounds: 1000 to 5000 ms.
   */
  ACTIVE_MATCH_LOG_POLL_INTERVAL_MS: 2000,

  /**
   * Polling interval (in milliseconds) when the player is idle in the Hideout sandbox.
   * Safe bounds: 2500 to 8000 ms.
   */
  HIDEOUT_IDLE_LOG_POLL_INTERVAL_MS: 4000,

  /**
   * Polling interval (in milliseconds) when Deadlock is closed or disconnected.
   * Safe bounds: 5000 to 20000 ms.
   */
  DISCONNECTED_HEARTBEAT_POLL_INTERVAL_MS: 10000,

  /**
   * Throttled polling interval (in milliseconds) when the application window/tab is hidden.
   * Safe bounds: 10000 to 30000 ms.
   */
  BACKGROUND_HIDDEN_WINDOW_POLL_INTERVAL_MS: 15000,
} as const;

export const API_AND_TELEMETRY_CONFIG = {
  /**
   * Cooldown duration (in seconds) enforced between manual Deadlock API profile refreshes
   * to prevent rate-limiting (HTTP 429).
   * Safe bounds: 30 to 300 seconds.
   */
  MANUAL_API_REFRESH_COOLDOWN_SECONDS: 120,

  /**
   * Maximum number of recent outbound Deadlock API requests retained in the diagnostic ring buffer.
   * Safe bounds: 10 to 100 entries.
   */
  MAX_RETAINED_API_TELEMETRY_LOGS: 20,

  /**
   * Maximum number of recent OCR screen captures retained in local diagnostic history.
   * Safe bounds: 5 to 30 captures.
   */
  MAX_RETAINED_OCR_DIAGNOSTIC_CAPTURES: 10,

  /**
   * Default duration (in milliseconds) before a toast notification automatically dismisses.
   * Safe bounds: 2000 to 8000 ms.
   */
  DEFAULT_TOAST_AUTO_DISMISS_DURATION_MS: 4000,
} as const;
