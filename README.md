# Lil Helper — Deadlock Companion

[![Tauri](https://img.shields.io/badge/Tauri-v2-blue?logo=tauri)](https://tauri.app/)
[![Rust](https://img.shields.io/badge/Rust-2021+-orange?logo=rust)](https://www.rust-lang.org/)
[![React](https://img.shields.io/badge/React-19+-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0+-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4.3+-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![Zustand](https://img.shields.io/badge/Zustand-5.0+-orange)](https://zustand.docs.pmnd.rs/)
[![Supabase](https://img.shields.io/badge/Supabase-Cloud_Sync-3ECF8E?logo=supabase)](https://supabase.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

An ultra-lightweight desktop and web companion application for Valve's **Deadlock**. It records 6v6 match drafts, lane outcomes, and ranked MMR progression—via automatic Deadlock API sync, live Source 2 console log detection, offline `.dem` replay parsing, or manual entry—to analyze personal matchup counters, ally synergies, lane performance, and ranked climb trajectory. A built-in **Draft Assistant** provides real-time lane swap and pick recommendations during matches using historical data, live game log parsing, and Escape menu OCR scanning.

---

## 🎯 Motivation

In Deadlock ranked matches, individual execution is critical, but team drafts and duo lane matchups heavily dictate game dynamics. Facing unfavorable compositions without noticing drafting patterns often leads to feeling helpless during matches.

**Lil Helper** provides:
- **Zero-Friction Match Tracking**: Sync your ranked matches automatically from the Deadlock API, recover unindexed matches offline from `.dem` replay files, or log a 6v6 draft manually in under 20 seconds.
- **Ranked Progression & Shield Simulation**: Visualize your ranked climb across all 11 Deadlock tiers (Initiate to Eternus) on an interactive SVG chart featuring subrank bands, demotion protection shield tracking, and automatic dashed gap detection for missing matches.
- **Unified Matchups & Synergies**: Uncover which enemy heroes consistently lower your win rate (**Nemeses**) and which allied heroes maximize your winning chances (**Best Synergies**), governed by the adaptive **5/10 Representativeness Rule**.
- **Lane Performance**: Track duo lane outcomes (Yellow, Blue, Green) computed from 12-minute soul differentials and Tier 1 Guardian destruction timings, lane-to-game win conversion rates, and direct lane opponent records.
- **Draft Assistant**: Get real-time lane swap and hero switch recommendations during the 45s pre-game swap window, powered by a combinatorial optimization engine and visualized as an interactive SVG decision tree.
- **Live Game Integration & Diagnostic Telemetry**: Automatic hero, lane, and match ID detection via Source 2 `console.log` parsing, Escape menu OCR via Tesseract.js, and a dedicated **Diagnostic & Logs Dashboard**.
- **Hybrid Desktop + Web Cloud Sync**: Engineered with **Tauri v2** to use under **35 MB of RAM** on desktop (zero FPS drop in-game), while supporting **Steam OpenID 2.0** login and bidirectional **Supabase Cloud Sync** across devices.

---

## 🛠️ Tech Stack

| Layer | Technology | Rationale |
| :--- | :--- | :--- |
| **Desktop Runtime** | [Tauri v2](https://tauri.app/) | Native Windows WebView2 integration, sub-35 MB memory footprint, secure IPC. |
| **Backend / Core** | [Rust (2021)](https://www.rust-lang.org/) | Win32 screen capture, image preprocessing, tail log parsing, `.dem` replay parsing, and atomic file I/O. |
| **Replay Parser** | [`boon-deadlock` 0.8](https://crates.io/crates/boon-deadlock) | Native Rust Source 2 protobuf `.dem` replay parser for offline match recovery. |
| **Local Persistence** | Multi-account Atomic JSON | Per-account `deadlock_matches_{accountId}.json` with atomic `.tmp` writes, `.bak` backups, and `.corrupt` quarantine. |
| **Cloud & Auth** | [Supabase](https://supabase.com/) + Steam OpenID 2.0 | Bidirectional cloud synchronization (`profiles` & `matches`) with an offline retry queue and Vercel serverless Steam auth. |
| **Frontend UI** | [React 19](https://react.dev/) + [TypeScript 6](https://www.typescriptlang.org/) | Strict type-safe component architecture with domain-grouped modules. |
| **State Management** | [Zustand 5](https://zustand.docs.pmnd.rs/) | Lightweight reactive stores (`useMatchStore`, `useUIStore`) with memoized selectors. |
| **Styling** | [Tailwind CSS 4](https://tailwindcss.com/) | Art Deco / Occult / Victorian Metal dark gaming aesthetic tailored for Deadlock. |
| **OCR Engine** | [Tesseract.js 7](https://tesseract.projectnaptha.com/) | Client-side Optical Character Recognition with Levenshtein hero matching and bilingual section detection. |
| **Testing & Build** | [Vitest 4](https://vitest.dev/) + [Vite 8](https://vitejs.dev/) | 16 automated unit/integration test suites (141 tests) and fast production bundling. |

---

## ✨ Features

### 1. Match History & Ranked Standing (`src/components/history/`)
- **Official Rank Standing Banner**: Displays your current Deadlock rank badge, subrank progress bar (`pts / 1,000`), active Demotion Protection Shields, and global server percentile.
- **Laned 6v6 Match Cards**: Organizes every match into its authentic Yellow, Blue, and Green lane duos, highlighting your hero, lane partner, direct opponents, and lane outcome (`Won`, `Lost`, `Even`).
- **Incomplete Match Queue & `.dem` Replay Recovery**: Matches detected live in `console.log` appear immediately in history and can be synchronized via the Deadlock API or recovered offline from local `.dem` replays (`ReplayRecoveryModal`) when API rate limits (HTTP 429) or coordinator delays occur.
- **Multi-Account & Cloud Sync**: Scoped storage per Steam `accountId` with one-click JSON export/import and automatic Supabase Cloud Sync.

### 2. Analytics & Ranked Progression (`src/components/analytics/`, `src/components/ranked/`)
- **Overview**: Global winrate, win/loss streaks (with one-click jump to highlight those matches in History), Patron faction winrates (**The Hidden King** vs **The Archmother**), and per-hero breakdown.
- **Ranked Progression Chart**: Interactive SVG timeline across all 11 tiers and 66 subranks:
  - Simulates win-streak points (`+300` to `+430`), standard defeats (`-300`), and **Demotion Protection Shields** (5 shields on promotion to subrank I or II, 2 shields on subranks III–VI, 2 shields on demotion).
  - Anchors to official API snapshots via a backward pass and renders **dashed gap connectors** when unrecorded matches exist between two games.
  - Supports sliding 40-match window navigation, quick presets (`Last 20`, `Last 50`, `All`), and custom match range sliders.
- **Matchups & Synergies**: Unified view combining head-to-head Enemy Matchups (Nemeses & Favorable targets) and Ally Synergies, filtered by the **5/10 Representativeness Rule**.
- **Lane Performance**: Per-lane (Yellow, Blue, Green) outcome gauges, lane-to-game win conversion rates, and direct lane opponent / partner tables.

### 3. Draft Assistant (`src/components/draft/`)
- **3-Lane Draft Board**: Organize the 6v6 composition into Yellow, Blue, and Green duo lanes with ban slots and undo history.
- **Escape Menu OCR Scan**: Captures the right 30% of Deadlock's Escape menu via Win32, preprocesses the image in Rust, and extracts all 12 heroes and Patron sides via Tesseract.js.
- **Combinatorial Optimizer & SVG Decision Tree**: Evaluates all hero switches and teammate lane swaps, presenting **Option 1** (best overall action, including lane swaps) vs **Option 2** (best action 100% under your own control without swapping lanes).

### 4. Diagnostic & Logs Dashboard (`src/components/logs/`)
- **API Telemetry Panel**: Live inspection of the last 10 HTTP requests to `api.deadlock-api.com` (status codes, latency, payloads, rate-limit diagnostics).
- **Match Queue Panel**: Manage pending matches awaiting Valve indexing or queue a Match ID manually with a custom date/time.
- **OCR History Panel**: Inspect the last 10 OCR captures with raw text, detected heroes, and screenshot previews.
- **Console Logs Panel**: Real-time Source 2 game context cards (State, Active Hero, Assigned Lane, Match ID, Active Map) and a searchable raw `console.log` terminal.

---

## 📂 Project Structure

```text
lil-helper/
├── api/                                # Vercel Serverless Functions (Web Steam OpenID 2.0 Auth)
│   └── auth/steam/
│       ├── login.ts                    # Redirects user to Steam OpenID 2.0 provider
│       └── callback.ts                 # Verifies Steam signature & redirects with accountId
├── supabase/
│   └── schema.sql                      # PostgreSQL schema & RLS policies for Cloud Sync
├── src-tauri/                          # Rust backend (Tauri v2)
│   ├── src/
│   │   ├── main.rs                     # Application entrypoint
│   │   ├── lib.rs                      # Module declarations & 13 IPC commands registration
│   │   ├── commands.rs                 # Thin #[tauri::command] handlers
│   │   ├── models.rs                   # Domain entities (MatchRecord, Side, MatchResult, etc.)
│   │   ├── storage.rs                  # Multi-account atomic JSON persistence & backup recovery
│   │   ├── log_watcher.rs              # Deadlock console.log drive scanner & tail parser
│   │   ├── screen_ocr.rs               # Win32 window capture & OCR image preprocessing
│   │   └── dem_parser.rs               # Source 2 .dem replay parser (boon-deadlock)
│   ├── Cargo.toml                      # Rust dependencies
│   └── tauri.conf.json                 # Tauri window config & capabilities
├── src/                                # Frontend application (React 19 + TS 6 + Tailwind 4)
│   ├── config.ts                       # Centralized app-wide configuration & thresholds
│   ├── assets/                         # Art Deco, Occult & Victorian Metal SVG ornaments
│   ├── components/
│   │   ├── ranked/                     # RankedProgressionView, RankedProgressionChart
│   │   ├── analytics/                  # AnalyticsView, HeroMatchupsAndSynergiesView, LanePerformanceView
│   │   ├── draft/                      # DraftAssistantView, DraftHeader, DraftLanesBoard, DraftDecisionTree, OcrInspectorModal
│   │   ├── history/                    # HistoryList, HistoryRankStandingCards, HistoryMatchCard, MatchForm, ReplayRecoveryModal, ImportMatchByIdModal
│   │   ├── profile/                    # ProfileConnectModal, ProfileDropdownMenu
│   │   ├── logs/                       # LogDashboardView, ApiTelemetryPanel, MatchQueuePanel, OcrHistoryPanel, ConsoleLogsPanel
│   │   ├── AppHeader.tsx               # Top navigation header, stats cartouches & Cloud Sync pill
│   │   ├── DesktopDownloadBanner.tsx   # Web-mode desktop download prompt
│   │   ├── ErrorBoundary.tsx           # Fault-isolating React Error Boundary
│   │   ├── HeroAvatar.tsx              # Reusable hero portrait component
│   │   ├── HeroPicker.tsx              # Searchable hero selection grid
│   │   ├── PlayerStateBadge.tsx        # Live game state indicator badge
│   │   └── Toast.tsx                   # Toast notification system
│   ├── services/
│   │   ├── api/                        # deadlockApi, apiClient, steamSearch, laneOutcome, rankStanding, apiLogger
│   │   ├── storage/                    # storage, cloudSync, supabaseClient, userSettings, draftStorage
│   │   ├── ranked/                     # rankedCalculator, rankedChart
│   │   ├── ocr/                        # screenOcr, ocrDictionaries, ocrHistory
│   │   ├── logs/                       # logWatcher, matchQueue
│   │   └── analytics/                  # index, cache, types, global, matchups, lanes, draftAdvisor, draftRecommendations
│   ├── stores/
│   │   ├── useMatchStore.ts            # Zustand match & account state store
│   │   └── useUIStore.ts               # Zustand navigation, modals & highlight store
│   ├── hooks/
│   │   ├── useDeadlockGameState.ts     # Adaptive polling hook for live Source 2 game context
│   │   ├── useProfileSync.ts           # Profile lifecycle, Steam OpenID & API sync hook
│   │   ├── useDraftSession.ts          # Draft Assistant state & undo stack hook
│   │   └── useDemParser.ts             # Offline .dem replay parser hook
│   ├── data/
│   │   └── heroes.ts                   # Static hero registry & Source 2 class name resolvers
│   ├── types/
│   │   ├── match.ts                    # Core domain models & draft validation
│   │   └── demTypes.ts                 # .dem replay structures & converter
│   ├── test/                           # 16 Vitest unit & integration test suites (141 tests)
│   ├── App.tsx                         # Root layout & view orchestration
│   ├── main.tsx                        # Frontend entrypoint
│   └── index.css                       # Tailwind CSS 4 imports & custom theme tokens
├── lil-helper.wiki/                    # Bilingual (EN/FR) technical & domain wiki
├── GEMINI.md                           # AI Developer Guide & architectural standards
├── package.json                        # Scripts & dependencies
└── vite.config.ts                      # Vite 8 & Vitest configuration
```

---

## 💻 Prerequisites & Installation

### Prerequisites
- **Node.js** (v18 or later) & **npm**
- **Rust toolchain** (`rustc` and `cargo` via [rustup.rs](https://rustup.rs/))
- **Windows C++ Build Tools** (Visual Studio Build Tools with C++ workload)

### Development Setup
```bash
# 1. Clone the repository
git clone https://github.com/Remynder0/lil-helper.git
cd lil-helper

# 2. Install frontend dependencies
npm install

# 3. Launch Tauri in desktop development mode (with Hot Reload)
npm run tauri dev
```

### Verification & Testing
```bash
# Type-check TypeScript
npm run check

# Run the automated Vitest test suite (141 tests across 16 suites)
npx vitest run

# Build production frontend bundle
npm run build
```

### Frontend-Only Mode (Browser Preview)
To run the React application in your browser without compiling the Rust backend:
```bash
npm run dev
```
*(Storage automatically falls back to browser `localStorage` and can sync with Supabase Cloud if `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are configured in `.env`).*

### Deadlock Game Integration (Recommended)
To enable live game state detection and automatic match queuing, launch Deadlock with the `-condebug` Steam launch option:
1. Open Steam → Library → Right-click **Deadlock** → Properties.
2. In **Launch Options**, add: `-condebug`
3. This instructs Source 2 to write `console.log`, which **Lil Helper** reads non-invasively in read-only mode (no memory injection, zero VAC risk).

---

## 🤝 Commit Conventions

This repository strictly enforces **Conventional Commits**:
- `feat:` New features (e.g. `feat(ranked): add dashed gap connectors for missing matches`)
- `fix:` Bug fixes (e.g. `fix(ranked): grant 5 demotion shields on subrank 2 promotion`)
- `docs:` Documentation changes (e.g. `docs: update wiki and GEMINI.md with domain architecture`)
- `refactor:` Code refactoring without behavioral change
- `chore:` Dependency bumps, build configs, cleanup

All commit messages, code comments, and source documentation must be written in **English**.
