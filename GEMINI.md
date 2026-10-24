# GEMINI.md - AI Developer Guide

This document defines the instructions, architectural standards, and workflow rules for any AI assistant or agent collaborating on the **Lil Helper — Deadlock Companion** repository.

---

## 🌐 Language & Formatting Policy

1. **Strict English Policy for Code & Repository Artifacts**:
   - All code, interfaces, variables, functions, tests, and comments MUST be written in **English**.
   - All Git commit messages, Pull Requests, Issue descriptions, and English markdown documentation MUST be in **English** (bilingual `-FR.md` pages in `lil-helper.wiki/` are written in French).
   - User communications (chat/dialogue) may be in French or English depending on user preferences, but code and commit messages are strictly English.
2. **Commit Convention**:
   - Strictly follow **Conventional Commits**:
     - `feat:` for new user-facing features
     - `fix:` for bug fixes
     - `docs:` for documentation updates
     - `refactor:` for code restructuring without behavioral changes
     - `chore:` for dependencies, tooling, and build maintenance
   - Reference GitHub issues when applicable (e.g. `feat(ui): add hero selection icon grid (#4)`).

---

## 🏗️ Technical Architecture & Principles

### 1. Desktop Engine (Tauri v2) & Hybrid Web Companion
- **Runtime Constraint**: The desktop app must remain ultra-lightweight (**< 35 MB RAM usage**) so that it can run simultaneously with Deadlock without causing frame drops.
- **Hybrid Web & Cloud Mode**: The frontend also runs as a standalone web application (deployed on Vercel) with **Steam OpenID 2.0 authentication** (`api/auth/steam/`) and **Supabase Cloud Sync** (`supabase/schema.sql`) so users can access and synchronize their match history across desktop and web.
- Do not introduce heavy frontend or backend dependencies (no Electron, no unnecessary background daemons).

### 2. Backend: Rust (`src-tauri/`)

The Rust backend provides **13 IPC commands** and is organized into **8 modules**:

| Module | Responsibility |
| :--- | :--- |
| `main.rs` | Application entrypoint, delegates to `lib.rs`. |
| `lib.rs` | Module declarations, Tauri plugin registration (`tauri-plugin-opener`), and IPC command wiring. |
| `commands.rs` | Thin `#[tauri::command]` handlers that delegate to domain modules. All commands return `Result<T, String>`. |
| `models.rs` | Domain entities: `MatchRecord`, `Side`, `MatchResult`, `LaneColor`, `LaneOutcome`, `LogEvent`. All structs derive `Serialize`/`Deserialize` with `#[serde(rename_all = "camelCase")]`. |
| `storage.rs` | Multi-account resilient JSON persistence (`deadlock_matches_{accountId}.json` with automatic legacy migration). Thread-safe (`STORAGE_MUTEX`), atomic writes with `.tmp` staging, automated `.bak` backups, and `.corrupt` quarantine. |
| `log_watcher.rs` | Deadlock console log detection (scans drives C–Z + Steam `libraryfolders.vdf`) and tail-based log parsing with lossy UTF-8 decoding. Returns structured `LogEvent` items. |
| `screen_ocr.rs` | Win32 window detection (`FindWindowW`), screen capture via `screenshots` crate, image preprocessing (grayscale, binary thresholding, 2x bilinear upscale), and base64 PNG encoding. OCR runs in the frontend via Tesseract.js. |
| `dem_parser.rs` | Offline Source 2 `.dem` replay parser powered by `boon-deadlock` (`0.8`). Extracts all 12 players, heroes, teams, assigned lanes, 12-min/9-min soul net worths (`m_iGoldNetWorth`), Tier 1 Guardian destruction timings (`k_EUserMsg_BossKilled`), and match winner (`k_EUserMsg_GameOver`). |

#### IPC Commands Reference

| Command | Description |
| :--- | :--- |
| `get_matches` | Returns all saved `MatchRecord` entries for a given `account_id` (with automatic backup recovery and legacy migration). |
| `save_match` | Adds a new match or updates an existing one (matched by `id`) for `account_id` via atomic rename and backup generation. |
| `delete_match` | Deletes a record by `id` for `account_id`. |
| `export_matches` | Serializes matches for `account_id` to a pretty-printed JSON string. |
| `import_matches` | Deserializes a JSON string and merges records into `account_id` storage. |
| `detect_deadlock_log_path` | Scans drives and Steam library folders for `console.log`. |
| `read_deadlock_log_events` | Reads the tail of `console.log` and returns parsed `LogEvent` items. |
| `save_deadlock_debug_log` | Dumps raw log content to a specified path on disk. |
| `capture_screen_image` | Captures the game window, crops right 30%, preprocesses, and returns base64 PNG data URL. |
| `is_deadlock_running` | Checks via Win32 API if the Deadlock window is active and visible. |
| `parse_dem_replay` | Parses a `.dem` replay file on disk via `boon-deadlock` and returns `DemParseResult`. |
| `find_replay_file` | Searches Deadlock's `citadel/replays/` directory for `{match_id}.dem` (or `.dem.bz2`). |
| `list_available_replays` | Lists all `.dem` replay files discovered in Deadlock's replay folder. |

#### Rust Coding Standards
- **Safety First**: Leverage Rust's borrow checker and type system. Avoid `unwrap()` or `expect()` in production paths; use `Result<T, String>` and idiomatic `?` error propagation.
- **Serialization**: Use `serde` (`Serialize`, `Deserialize`) for all IPC structs transmitted between Rust and TypeScript.
- **Separation of Concerns**: Keep `commands.rs` handlers thin—delegate business logic to `storage.rs`, `log_watcher.rs`, `screen_ocr.rs`, or `dem_parser.rs`.

---

### 3. Frontend: React 19 + TypeScript 6 + Tailwind CSS 4 + Zustand 5 (`src/`)

#### Architecture Overview
- **Centralized Configuration (`src/config.ts`)**: Single source of truth for application constants and thresholds across 4 domains:
  - `RANKED_CHART_CONFIG` (sliding window size, presets, gap spacing expansion multiplier, SVG dimensions).
  - `ANALYTICS_SAMPLE_CONFIG` (5/10 representativeness rule thresholds for heroes and lanes).
  - `GAME_LOG_POLLING_CONFIG` (adaptive polling intervals: 2s active match, 4s hideout, 10s disconnected, 15s background).
  - `API_AND_TELEMETRY_CONFIG` (API refresh cooldown, telemetry buffer limits, toast auto-dismiss duration).
- **State Management (`src/stores/`)**:
  - `useMatchStore.ts`: Zustand store managing `matches`, `incompleteMatches`, `currentAccountId`, CRUD actions, and memoized selectors (`selectAllHistoryMatches`, `selectTotalMatches`, `selectWinRate`).
  - `useUIStore.ts`: Zustand store managing active tab routing (`'history' | 'analytics' | 'assistant' | 'logs'`), modals (`isProfileModalOpen`, `isImportByIdModalOpen`), and streak/match highlighting (`highlightedMatchIds`, `highlightedStreakType`).
- **Dual-Environment & Cloud Persistence (`src/services/storage/`)**:
  - `storage.ts` abstracts Tauri `invoke()` in desktop mode and `localStorage` in web mode, scoped by `accountId`.
  - `cloudSync.ts` + `supabaseClient.ts` provide bidirectional synchronization with Supabase PostgreSQL (`profiles` and `matches` tables) and an offline retry queue (`deadlock_cloud_pending_sync_v1`).

#### Domain-Based Directory Structure (`src/`)

```text
src/
├── config.ts                                 # Centralized app-wide configuration & thresholds
├── data/
│   └── heroes.ts                             # Static hero registry (45+ heroes, Source 2 lookups, roles, lore)
├── types/
│   ├── match.ts                              # Domain models (Match, Side, MatchResult, LaneColor, validation)
│   └── demTypes.ts                           # .dem replay parser types & converter (demResultToMatch)
├── stores/
│   ├── useMatchStore.ts                      # Zustand match & account store
│   └── useUIStore.ts                         # Zustand UI navigation & modal store
├── hooks/
│   ├── useDeadlockGameState.ts               # Adaptive polling hook for live Source 2 console.log state
│   ├── useProfileSync.ts                     # Profile lifecycle, Steam OpenID callback & API sync hook
│   ├── useDraftSession.ts                    # Draft assistant session state, undo history & OCR integration
│   └── useDemParser.ts                       # Tauri .dem replay parser hook
├── services/
│   ├── api/                                  # Deadlock API & HTTP telemetry
│   │   ├── apiClient.ts                      # Instrumented HTTP client (apiFetch, headers, base URL)
│   │   ├── steamSearch.ts                    # SteamID64 / AccountID resolution & Steam profile search
│   │   ├── laneOutcome.ts                    # Source-agnostic lane outcome algorithm (souls + guardians)
│   │   ├── rankStanding.ts                   # Player rank standing, demotion shields & global percentiles
│   │   ├── deadlockApi.ts                    # Ranked match history sync, metadata enrichment & re-exports
│   │   └── apiLogger.ts                      # Ring-buffer HTTP telemetry logger
│   ├── storage/                              # Local & Cloud persistence
│   │   ├── storage.ts                        # Multi-account Tauri IPC / localStorage abstraction
│   │   ├── cloudSync.ts                      # Bidirectional Supabase Cloud Sync & offline retry queue
│   │   ├── supabaseClient.ts                 # Supabase client initialization
│   │   ├── userSettings.ts                   # User settings persistence (API key, log path)
│   │   └── draftStorage.ts                   # Defensive localStorage persistence for Draft Assistant
│   ├── ranked/                               # Ranked MMR & Chart engine
│   │   ├── rankedCalculator.ts               # Win-streak points, subrank floors, demotion shields & simulation
│   │   └── rankedChart.ts                    # Valve badge thresholds, backward pass, gap detection & SVG geometry
│   ├── ocr/                                  # Screen OCR pipeline
│   │   ├── screenOcr.ts                      # Tesseract.js worker, section splitting & Levenshtein matching
│   │   ├── ocrDictionaries.ts                # Stop words, header regexes & faction patterns
│   │   └── ocrHistory.ts                     # Ring-buffer OCR diagnostic capture history
│   ├── logs/                                 # Source 2 log parsing & match queue
│   │   ├── logWatcher.ts                     # Console.log state machine & regex event extraction
│   │   └── matchQueue.ts                     # Pub/sub queue for pending/blocked matches awaiting indexing
│   └── analytics/                            # Statistical & Combinatorial engine
│       ├── index.ts                          # Barrel export
│       ├── cache.ts                          # Reference-equality memoization cache for analytics
│       ├── types.ts                          # Analytics interfaces & contracts
│       ├── global.ts                         # Global stats, 5/10 representativeness rule, streaks & patrons
│       ├── matchups.ts                       # Head-to-head enemy nemeses & ally synergies
│       ├── lanes.ts                          # Lane distribution, win conversion & duo stats
│       ├── draftRecommendations.ts           # Composite pick scoring engine
│       └── draftAdvisor.ts                   # Combinatorial lane swap & hero switch optimizer
├── components/
│   ├── ranked/                               # Ranked progression & SVG chart
│   │   ├── RankedProgressionView.tsx         # Ranked Progression sub-tab, KPIs & interactive match log
│   │   └── RankedProgressionChart.tsx        # Interactive SVG timeline chart with shields & dashed gaps
│   ├── analytics/                            # Analytics dashboard views
│   │   ├── AnalyticsView.tsx                 # Analytics shell (Overview, Matchups & Synergies, Lanes, Ranked)
│   │   ├── HeroMatchupsAndSynergiesView.tsx  # Unified Enemy Matchups & Ally Synergies view
│   │   └── LanePerformanceView.tsx           # Lane outcome gauges, conversion stats & opponent table
│   ├── draft/                                # Draft Assistant views
│   │   ├── DraftAssistantView.tsx            # Draft Assistant root orchestrator
│   │   ├── DraftHeader.tsx                   # Side selector, bans, OCR trigger & live sync banner
│   │   ├── DraftLanesBoard.tsx               # 3-lane duo grid layout & slot picker
│   │   ├── DraftDecisionTree.tsx             # SVG visual decision tree (Option 1 vs Option 2)
│   │   ├── OcrInspectorModal.tsx             # OCR inspection & diagnostic modal
│   │   └── types.ts                          # Shared draft component contracts
│   ├── history/                              # Match history & recording views
│   │   ├── HistoryList.tsx                   # Filter toolbar, filtered stats & match list orchestrator
│   │   ├── HistoryRankStandingCards.tsx      # Official rank badge, demotion shields & server percentile banner
│   │   ├── HistoryMatchCard.tsx              # Individual 6v6 laned match card, details drawer & incomplete card
│   │   ├── MatchForm.tsx                     # Manual match entry modal/drawer
│   │   ├── ReplayRecoveryModal.tsx           # Offline .dem replay recovery modal for blocked matches
│   │   └── ImportMatchByIdModal.tsx          # Direct match import modal by numeric ID & timestamp
│   ├── profile/                              # Steam profile & account management
│   │   ├── ProfileConnectModal.tsx           # Steam profile search, Steam OpenID login & connection modal
│   │   └── ProfileDropdownMenu.tsx           # Profile dropdown (Cloud Sync, JSON export/import, switch profile)
│   ├── logs/                                 # Diagnostic & Logs Dashboard
│   │   ├── LogDashboardView.tsx              # Diagnostic & Logs Dashboard orchestrator
│   │   ├── ApiTelemetryPanel.tsx             # Last 10 HTTP API requests panel
│   │   ├── MatchQueuePanel.tsx               # Pending match queue & manual match queuing panel
│   │   ├── OcrHistoryPanel.tsx               # Last 10 OCR captures history panel
│   │   └── ConsoleLogsPanel.tsx              # Live Source 2 game context cards & raw console.log terminal
│   ├── AppHeader.tsx                         # Top navigation bar, quick stats cartouches & Cloud Sync pill
│   ├── DesktopDownloadBanner.tsx             # Web-mode banner prompting desktop app download
│   ├── ErrorBoundary.tsx                     # React error boundary for fault isolation
│   ├── HeroAvatar.tsx                        # Atomic hero portrait with faction border & size variants
│   ├── HeroPicker.tsx                        # Reusable hero grid with text search & role filters
│   ├── PlayerStateBadge.tsx                  # Live game state badge (In Game / In Hideout / Disconnected)
│   └── Toast.tsx                             # Global toast notification provider & hook
└── test/                                     # Vitest + Testing Library unit & integration test suites (16 files)
```

#### Frontend Coding Standards
- **Strict TypeScript**: `noImplicitAny: true`. Never use `any` unless interacting with untyped third-party data, and encapsulate it immediately.
- **Configuration First**: Place tunable thresholds, polling intervals, and chart geometry constants in `src/config.ts` rather than hardcoding magic numbers in components or services.
- **Styling**: Tailwind CSS 4 exclusively. Maintain the Art Deco / Occult / Steampunk dark aesthetic (`deadlock-hidden-king`, `deadlock-archmother`, `deadlock-win`, `deadlock-loss`, `deadlock-panel`, `deadlock-brass`, `deadlock-accent`).
- **Component Design**: Keep components modular and domain-grouped under `src/components/<domain>/`. Avoid files over ~600 lines; extract sub-components when views grow complex.
- **Performance**: Use `useMemo` and `src/services/analytics/cache.ts` for expensive computations.

---

## 📊 Domain Knowledge: Deadlock

- **Teams**: 6 vs 6 (`The Hidden King` vs `The Archmother`).
- **Lanes**: 3 duo lanes per team (`Yellow`, `Blue`, `Green` — 2 allied heroes vs 2 enemy heroes per lane).
- **Draft Composition**: 1 played hero (`myHeroId`), 5 allied heroes (`allies`), 6 enemy heroes (`enemies`) = 12 unique heroes per match.
- **Result**: `win`, `loss`, or `cancel` (Safe to Leave when an ally abandons on a loss).
- **Lane Outcome**: `won`, `lost`, or `even` (computed by `src/services/api/laneOutcome.ts` using duo soul differential at 12m/9m and Tier 1 Guardian destruction timestamps).
- **Ranked Rules (`src/services/ranked/`)**:
  - 11 Tiers (Initiate to Eternus), 6 subranks (I–VI) per tier, 1,000 points per subrank.
  - Win streak points: `[+300, +300, +370, +390, +410, +430]`; standard loss: `-300`.
  - **Demotion Shields**: Granted on **Promotion to Subrank 1 or Subrank 2 (5 shields)**, **Promotion to Subranks 3–6 (2 shields)**, and **Demotion to a lower subrank (2 shields)**. Consumed when a loss would drop points below the current subrank floor (`Math.floor(progress / 1000) * 1000`). When shields are `0` at the floor, a loss applies the full `-300` demotion and resets shields to `2`.
  - **Gap Detection**: When unrecorded matches create a discrepancy between expected delta and actual progress between two chronological matches, `rankedChart.ts` connects them with a dashed gap line (`isGapBefore`) and expands horizontal spacing.

---

## 📋 Development Workflow

1. **Verification**: Always run TypeScript check (`npx tsc --noEmit`), the automated test suite (`npx vitest run`), and production build (`npm run build` / `cargo check`) before completing a task.
2. **Keep Documentation Updated**: When architectural decisions, domain rules, or module paths change, update `GEMINI.md`, `README.md`, and the bilingual wiki in `lil-helper.wiki/`.
3. **Dual-Environment Awareness**: Ensure features degrade gracefully in browser web mode (`'__TAURI_INTERNALS__' in window` check) and synchronize properly with Supabase when configured.
