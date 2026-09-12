# AGENT.md - AI Developer Guide

This document defines the instructions, architectural standards, and workflow rules for any AI assistant or agent collaborating on the **Deadlock Draft & Match Analyzer** repository.

---

## 🌐 Language & Formatting Policy

1. **Strict English Policy**:
   - All code, interfaces, variables, functions, tests, and comments MUST be written in **English**.
   - All Git commit messages, Pull Requests, Issue descriptions, and markdown documentation MUST be in **English**.
   - User communications (chat/dialogue) may be in French or English depending on user preferences, but the repository artifacts are strictly English.
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

### 1. Desktop Engine: Tauri v2
- **Runtime Constraint**: The app must remain ultra-lightweight (**< 35 MB RAM usage**) so that it can run simultaneously with Deadlock without causing frame drops.
- Do not introduce heavy frontend or backend dependencies (no Electron, no large bundles, no unnecessary background daemons).
- Keep window management efficient and lean.

### 2. Backend: Rust (`src-tauri/`)

The Rust backend provides 10 IPC commands and is organized into the following modules:

| Module | Responsibility |
| :--- | :--- |
| `main.rs` | Application entrypoint, delegates to `lib.rs`. |
| `lib.rs` | Module declarations, Tauri plugin registration (`tauri-plugin-opener`), and IPC command wiring. |
| `commands.rs` | Thin `#[tauri::command]` handlers that delegate to domain modules. All commands return `Result<T, String>`. |
| `models.rs` | Domain entities: `MatchRecord`, `Side`, `MatchResult`, `LaneColor`, `LaneOutcome`, `LogEvent`. All structs derive `Serialize`/`Deserialize` with `#[serde(rename_all = "camelCase")]`. |
| `storage.rs` | Resilient JSON persistence. Thread-safe (`STORAGE_MUTEX`), atomic writes with `.tmp` staging, automated `.bak` backups, and auto-recovery/quarantine for corrupted data. |
| `log_watcher.rs` | Deadlock console log detection (scans drives + Steam `libraryfolders.vdf`) and tail-based log parsing. Returns structured `LogEvent` items. |
| `screen_ocr.rs` | Win32 window detection (`FindWindowW`), screen capture via `screenshots` crate, image preprocessing (grayscale, binary thresholding, 2x upscale), and base64 PNG encoding. OCR itself runs in the frontend via Tesseract.js. |

#### IPC Commands Reference

| Command | Description |
| :--- | :--- |
| `get_matches` | Returns all saved `MatchRecord` entries from JSON storage (with automatic backup recovery fallback). |
| `save_match` | Adds a new match or updates an existing one (matched by `id`) via atomic rename and backup generation. |
| `delete_match` | Deletes a record by UUID `id`. |
| `export_matches` | Serializes matches to a pretty-printed JSON string. |
| `import_matches` | Deserializes a JSON string and merges records into storage. |
| `detect_deadlock_log_path` | Scans drives and Steam library folders for `console.log`. |
| `read_deadlock_log_events` | Reads the tail of `console.log` (default 64KB) and returns parsed `LogEvent` items. |
| `save_deadlock_debug_log` | Dumps raw log content to a specified path on disk. |
| `capture_screen_image` | Captures the game window, crops right 30%, preprocesses, and returns base64 PNG data URL. |
| `is_deadlock_running` | Checks via Win32 API if the Deadlock window is active and visible. |

#### Rust Coding Standards
- **Safety First**: Leverage Rust's borrow checker and type system. Avoid `unwrap()` or `expect()` in production paths; use `Result<T, String>` and idiomatic `?` error propagation.
- **Serialization**: Use `serde` (`Serialize`, `Deserialize`) for all IPC structs transmitted between Rust and TypeScript.
- **Persistence**: Thread-safe, atomic JSON storage with backups (`STORAGE_MUTEX`, atomic `.tmp` swap, `.bak` fallback, and `.corrupt` quarantine in `storage.rs`). Future migration to SQLite is planned.
- **Separation of Concerns**: Keep `commands.rs` handlers thin—delegate business logic to `storage.rs`, `log_watcher.rs`, or `screen_ocr.rs`.

### 3. Frontend: React + TypeScript + Tailwind (`src/`)

#### Architecture Overview
- **State Management**: Decentralized React hooks (`useState`, `useRef`, `useMemo`). No external state manager. `App.tsx` coordinates high-level state, delegating profile sync and logic to dedicated hooks (`useProfileSync.ts`).
- **Navigation**: Tab-based view switching via `activeTab` state (`'log_match' | 'history' | 'analytics' | 'assistant' | 'logs'`). No URL routing.
- **Persistence Layer**: `services/storage.ts` abstracts environment detection—calls Tauri `invoke()` in desktop mode or falls back to `localStorage` in browser preview mode.

#### Module Responsibilities

| Module | File(s) | Responsibility |
| :--- | :--- | :--- |
| **Types** | `types/match.ts` | Domain models (`Match`, `Side`, `MatchResult`, `LaneColor`, `LaneOutcome`, `MatchDraftInput`), validation logic (`validateMatchInput`). |
| **Data** | `data/heroes.ts` | Static hero registry (35 heroes) with lookup maps (`HERO_MAP`, `HERO_BY_KEY`, `HERO_BY_CLASS_NAME`) and multi-strategy name resolution (`findHeroBySource2Name`). |
| **Storage** | `services/storage.ts` | Dual-environment persistence abstraction (Tauri IPC or `localStorage`), pending match tracking. |
| **Analytics** | `services/analytics/` & `services/analytics.ts` | Modular statistical engine: `types.ts`, `global.ts` (patron & heroes), `matchups.ts` (nemeses & synergies), `lanes.ts` (lane distribution & duos), `draftRecommendations.ts`, and `draftAdvisor.ts` (combinatorial draft optimization). |
| **API Client** | `services/deadlockApi.ts` | Deadlock REST API integration (`api.deadlock-api.com/v1`): Steam player search, ranked match history fetch, match metadata retrieval, lane outcome calculation (soul differentials + guardian timestamps), entity conversion. |
| **Log Parser** | `services/logWatcher.ts` | Console log bridge: detects log path, checks game running state, parses game transitions (hideout/pregame/ingame), extracts player name, hero, lane, and match ID. |
| **OCR Pipeline** | `services/screenOcr.ts` | Captures screen via Rust IPC, runs Tesseract.js OCR, splits allied/enemy sections, matches hero names via Levenshtein distance, detects patron side. |
| **Game Hooks** | `hooks/useDeadlockGameState.ts`, `hooks/useProfileSync.ts` | Background polling hook (2.5s interval) for live game context, and profile sync lifecycle hook. |

#### Component Inventory

| Component | Lines | Purpose |
| :--- | :--- | :--- |
| `DraftAssistantView` | ~360 | Draft advisor root orchestrator: 3-lane grid, bans, live game state integration, OCR scan. |
| `draft/DraftLanesBoard` | ~190 | 3-lane duo grid layout (Yellow, Blue, Green) and active slot selectors. |
| `draft/DraftDecisionTree` | ~160 | SVG visual decision tree comparing Option 1 vs Option 2/safe fallback. |
| `draft/DraftHeader` | ~150 | Team side selector, bans, OCR trigger button, and live game sync badge. |
| `draft/OcrInspectorModal`| ~140 | OCR diagnostic modal showing captured screenshot, raw text, and parsed hero tokens. |
| `MatchForm` | ~700 | Manual match entry: side/result selection, 6v6 draft slots with auto-advance, lane assignment, notes, validation. |
| `HistoryList` | ~575 | Match history table: hero/outcome/side filters, filtered winrate badge, expandable detail drawer, edit/delete. |
| `AnalyticsView` | ~440 | Analytics shell with sub-tab navigation (Overview, Enemy Matchups, Ally Synergies, Lane Performance). Memoized stats. |
| `GameLogMonitor` | ~440 | Live console log viewer: category filters, text search, auto-scroll, clipboard copy, file export. |
| `LanePerformanceView` | ~380 | Lane analytics: 3 lane outcome gauges, conversion stats, direct opponent table. Memoized aggregations. |
| `EnemyMatchupsView` | ~345 | Enemy matchup matrix: Nemesis/Favorable highlights, sortable table, hero filter. Memoized metrics. |
| `AllySynergiesView` | ~345 | Ally synergy matrix: Best/Anti-Synergy highlights, sortable table, hero filter. Memoized metrics. |
| `AppHeader` | ~190 | App navbar banner with live game state badge, navigation tabs, and profile dropdown menu. |
| `ProfileConnectModal` | ~265 | Steam profile search, connection, and ranked sync trigger. |
| `ProfileDropdownMenu` | ~160 | Profile settings dropdown with match stats, sync actions, manual import, and DB management. |
| `ImportMatchByIdModal` | ~100 | Direct match fetch modal by numeric ID. |
| `HeroPicker` | ~200 | Reusable hero grid: text search, role tabs, disabled/selected states, faction glow. |
| `HeroAvatar` | ~100 | Atomic hero portrait: size variants, faction border, hover remove, empty placeholder. |
| `PlayerStateBadge` | ~90 | Game state indicator: In Game (with hero), In Hideout (with lore text), Disconnected. |

#### Frontend Coding Standards
- **Strict TypeScript**: `noImplicitAny: true`. Never use `any` unless interacting with untyped third-party data, and encapsulate it immediately.
- **Styling**: Tailwind CSS exclusively. Maintain the dark-themed UI with custom Deadlock theme colors (`deadlock-hidden-king`, `deadlock-archmother`, `deadlock-win`, `deadlock-loss`, `deadlock-panel`).
- **Component Design**: Aim for single-responsibility components. Keep components modular and under ~400 lines whenever possible.
- **Performance**: Use `useMemo` for expensive computations (analytics calculations, sorting, filtering, combinatorial draft advisor). Wrap callbacks passed to children in `useCallback`.
- **State Management**: Keep it simple with React hooks (`useState`, `useReducer`, `useMemo`). Consider Zustand only if state needs to cross multiple unrelated view trees. Avoid Redux.

---

## 📊 Domain Knowledge: Deadlock

- **Teams**: 6 vs 6.
- **Sides (Patrons)**:
  - **The Hidden King** (Gold / Yellow patron)
  - **The Archmother** (Blue / Purple patron)
- **Lanes**: 3 duo lanes per team:
  - **Yellow Lane**
  - **Blue Lane**
  - **Green Lane**
  - Each lane has 2 allied heroes vs 2 enemy heroes.
- **Draft Composition**:
  - Exactly 1 played hero (`my_hero`).
  - Exactly 5 allied heroes (`allies`).
  - Exactly 6 enemy heroes (`enemies`).
  - Total of 12 distinct heroes per match (no duplicates across or within teams).
- **Result**: `Win`, `Loss`, or `Cancel` (leaver/abandon).
- **Lane Outcome**: `Won`, `Lost`, or `Even` (determined by soul differentials at 12 minutes and guardian destruction timing).
- **Matchup Metrics**:
  - **Direct Counter**: A hero \(E\) on the enemy team against which your played hero \(H\) has a significantly lower Win Rate than your baseline.
  - **Synergy**: An allied hero \(A\) with which your played hero \(H\) achieves a significantly higher Win Rate than your baseline.
  - **Lane Score**: Weighted heuristic combining direct lane encounter history (weight 3.0), duo partner synergy (weight 2.0), general matchup winrate (weight 1.5), and personal hero baseline (weight 1.0).

---

## 🔌 Data Flow

```
Input Sources                    Storage Layer                    Consumers
─────────────                    ─────────────                    ─────────
MatchForm (manual entry)    ──→  storage.ts ──→ Tauri IPC ──→    App.tsx (matches state)
Deadlock API (ranked sync)  ──→  (or localStorage fallback)      │
Game Logs (pending match IDs)──→                                  ├──→ AnalyticsView ──→ analytics.ts
                                                                  ├──→ DraftAssistantView ──→ analytics.ts
                                                                  ├──→ HistoryList
                                                                  └──→ Global stats banner
```

---

## 📋 Development Workflow

1. **Check Existing Tasks**: Refer to `implementation_plan.md` and the GitHub Project Kanban board before starting any task.
2. **Verification**: Always verify builds (`cargo check`, `npm run build` or `npm run tauri dev`) before marking a task complete.
3. **Keep Artifacts Updated**: If architectural decisions change, update both `README.md` and this `AGENT.md`.
4. **Dual-Environment Testing**: Test critical features in both Tauri desktop mode (`npm run tauri dev`) and browser preview mode (`npm run dev`) when the feature touches `storage.ts` or environment detection.
5. **Performance Awareness**: Wrap expensive analytics computations in `useMemo` with appropriate dependency arrays. Avoid recalculating on every render.
