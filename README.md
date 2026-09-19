# Deadlock Draft & Match Analyzer

[![Tauri](https://img.shields.io/badge/Tauri-v2-blue?logo=tauri)](https://tauri.app/)
[![Rust](https://img.shields.io/badge/Rust-2021+-orange?logo=rust)](https://www.rust-lang.org/)
[![React](https://img.shields.io/badge/React-19+-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0+-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4.3+-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

An ultra-lightweight desktop companion application for Valve's **Deadlock**. It records match drafts and outcomes—manually or via automatic API sync—to analyze personal matchup counters, ally synergies, lane performance, and side win rates. A built-in **Draft Assistant** provides real-time lane swap recommendations during matches using historical data, live game log parsing, and OCR screen scanning.

---

## 🎯 Motivation

In Deadlock ranked matches, individual execution is critical, but team drafts heavily dictate matchup dynamics. Facing unfavorable compositions without noticing drafting patterns often leads to feeling helpless during matches.

This application provides:
- **Fast Post-Match Logging**: Record an entire 6v6 draft in under 20 seconds via a responsive hero icon picker, or sync automatically from the Deadlock API.
- **Matchup Matrix (Nemesis Detection)**: Uncover which enemy heroes consistently lower your win rate when playing specific heroes.
- **Ally Synergies**: Identify which teammate heroes maximize your winning chances.
- **Lane Performance**: Track duo lane outcomes (Yellow, Blue, Green), lane-to-game win conversion rates, and direct lane opponent matchups.
- **Side Impact**: Track performance disparities between **The Hidden King** and **The Archmother**.
- **Draft Assistant**: Get real-time lane swap and hero switch recommendations during draft phase, powered by a combinatorial optimization engine and visualized as an interactive decision tree.
- **Live Game Integration**: Automatic hero, lane, and match ID detection via Source 2 console log parsing and Escape menu OCR.
- **Minimal System Footprint**: Engineered with Tauri v2 to use under **35 MB of RAM**, guaranteeing zero FPS drop while Deadlock runs.

---

## 🛠️ Tech Stack

| Layer | Technology | Rationale |
| :--- | :--- | :--- |
| **Desktop Runtime** | [Tauri v2](https://tauri.app/) | Native Windows WebView2 integration, sub-35 MB memory footprint, secure IPC. |
| **Backend / Core** | [Rust](https://www.rust-lang.org/) | Screen capture, image preprocessing, log file parsing, and local file I/O. |
| **Persistence** | Resilient JSON file storage | Local `deadlock_matches.json` in the OS app data directory, secured with atomic writes, automated `.bak` backups, and corrupted file quarantine. |
| **Frontend UI** | [React 19](https://react.dev/) + [TypeScript 6](https://www.typescriptlang.org/) | Type-safe component architecture with instant reactivity. |
| **Styling** | [Tailwind CSS 4](https://tailwindcss.com/) | Utility-first styling with a dark gaming aesthetic tailored for Deadlock. |
| **OCR** | [Tesseract.js 7](https://tesseract.projectnaptha.com/) | Client-side Optical Character Recognition for in-game Escape menu scanning. |
| **Icons** | [Lucide React](https://lucide.dev/) | Lightweight, consistent icon set. |
| **Build Tool** | [Vite 8](https://vitejs.dev/) | Lightning-fast HMR and minimal bundle footprint. |

---

## ✨ Features

### Match Logging
- **Manual entry**: Side selection, hero icon grid with search & role filters, lane assignment (partner + opponents + outcome), notes.
- **API sync**: Connect your Steam profile, automatically import ranked match history with full draft compositions, durations, and algorithmically computed lane outcomes (soul differentials at 12 min + guardian destruction timestamps).
- **Import by Match ID**: Directly fetch a single match by its numeric ID.
- **JSON export/import**: Full backup and restore of your match database.

### Analytics Dashboard
- **Global stats**: Overall winrate, total matches, patron faction comparison (Hidden King vs Archmother).
- **Hero performance**: Per-hero winrate table with sorting by matches, wins, or winrate.
- **Enemy matchups**: Head-to-head matrix with Nemesis detection (top 3 worst matchups) and Favorable targets (top 3 best matchups), filterable by played hero.
- **Ally synergies**: Teammate synergy matrix with Best Synergies and Anti-Synergies highlights, filterable by played hero.
- **Lane performance**: Per-lane (Yellow, Blue, Green) outcome gauges, lane-to-game win conversion stats, and direct lane opponent records.

### Draft Assistant
- **3-lane draft grid**: Organize the 6v6 composition into Yellow, Blue, Green duo lanes with ban slots.
- **Live game state**: Auto-detects your hero, assigned lane, and match ID from Deadlock's console log (`-condebug`).
- **OCR screen scan**: Captures the Escape menu via native Win32 screen capture, preprocesses for OCR (grayscale, thresholding, 2x upscale), and recognizes hero names via Tesseract.js with Levenshtein matching.
- **Combinatorial optimizer**: Evaluates all lane swap and hero switch permutations, scoring each by lane encounter history, partner synergy, general matchup winrate, and personal hero baseline.
- **SVG decision tree**: Visual 2-option recommendation—Option 1 (best overall, may require teammate lane swap) vs Option 2 (best without swap, immediate fallback).
- **OCR diagnostic modal**: Full debug inspector showing captured screenshot, extracted raw text, and recognized tokens.

### Game Log Monitor
- Developer console for Deadlock's Source 2 `console.log` output.
- Category filters (Match, Hero/Player, Info), text search, auto-scroll, clipboard copy, and file export.
- Automatic match ID detection for pending match recovery.

---


## 📂 Project Structure

```
deadlock-analyse/
├── src-tauri/                          # Rust backend (Tauri v2)
│   ├── src/
│   │   ├── main.rs                     # Application entrypoint & Tauri builder
│   │   ├── lib.rs                      # Module declarations, plugin registration & IPC command wiring
│   │   ├── commands.rs                 # 10 IPC commands exposed to the frontend
│   │   ├── models.rs                   # Domain entities (MatchRecord, Side, MatchResult, LaneColor, etc.)
│   │   ├── storage.rs                  # Resilient JSON persistence (atomic write, backups & quarantine)
│   │   ├── log_watcher.rs             # Deadlock console.log detection & tail parsing
│   │   └── screen_ocr.rs             # Win32 window capture & image preprocessing for OCR
│   ├── Cargo.toml                      # Rust dependencies (tauri, serde, image, screenshots, windows)
│   └── tauri.conf.json                 # Tauri window config & capabilities
├── src/                                # Frontend application
│   ├── assets/                         # Static assets (SVG icons)
│   ├── components/
│   │   ├── draft/                      # Modular draft assistant components
│   │   │   ├── DraftHeader.tsx         # Side selector, bans, OCR trigger & live sync banner
│   │   │   ├── DraftLanesBoard.tsx     # 3-lane duo grid layout & slot picker
│   │   │   ├── DraftDecisionTree.tsx   # SVG visual decision tree
│   │   │   ├── OcrInspectorModal.tsx   # OCR inspection and diagnostic modal
│   │   │   └── types.ts                # Shared draft component contracts
│   │   ├── AppHeader.tsx              # Top navigation header & live game state indicator
│   │   ├── ProfileDropdownMenu.tsx    # Profile actions, DB maintenance & backup dropdown
│   │   ├── ImportMatchByIdModal.tsx   # Single match import modal by ID
│   │   ├── MatchForm.tsx              # Quick match recording form with draft composition & lane selector
│   │   ├── HeroPicker.tsx             # Visual hero grid with search, role tabs & selection states
│   │   ├── HeroAvatar.tsx             # Reusable hero portrait with faction glow & size variants
│   │   ├── HistoryList.tsx            # Match history table with filters, expandable details & edit/delete
│   │   ├── AnalyticsView.tsx          # Analytics dashboard shell with sub-tab navigation
│   │   ├── EnemyMatchupsView.tsx      # Enemy matchup matrix with Nemesis & Favorable highlights
│   │   ├── AllySynergiesView.tsx      # Ally synergy matrix with Best & Anti-Synergy highlights
│   │   ├── LanePerformanceView.tsx    # Lane outcome gauges, conversion stats & opponent table
│   │   ├── DraftAssistantView.tsx     # Draft assistant root orchestrator
│   │   ├── GameLogMonitor.tsx         # Live console.log viewer with filters & search
│   │   ├── PlayerStateBadge.tsx       # Real-time game state indicator (In Game / In Hideout / Disconnected)
│   │   └── ProfileConnectModal.tsx    # Steam profile search, connection & ranked sync trigger
│   ├── data/
│   │   └── heroes.ts                  # Static hero registry (35 heroes: IDs, roles, tags, class names, lore)
│   ├── hooks/
│   │   ├── useDeadlockGameState.ts    # Polling hook for live game context (hero, lane, match ID)
│   │   └── useProfileSync.ts          # Hook managing profile state, cooldowns & background match recovery
│   ├── services/
│   │   ├── analytics/                 # Modular analytics engine
│   │   │   ├── types.ts               # Analytics contracts & interfaces
│   │   │   ├── global.ts              # Global stats, patrons & hero metrics
│   │   │   ├── matchups.ts            # Head-to-head nemeses & synergies
│   │   │   ├── lanes.ts               # Lane distribution, conversions & duos
│   │   │   ├── draftRecommendations.ts# Pick recommendations engine
│   │   │   ├── draftAdvisor.ts        # Combinatorial draft actions optimizer
│   │   │   └── index.ts               # Barrel export
│   │   ├── analytics.ts              # Backward-compatible barrel re-export
│   │   ├── storage.ts                 # Persistence abstraction (Tauri IPC or localStorage fallback)
│   │   ├── deadlockApi.ts            # Deadlock REST API client (Steam search, match history, metadata)
│   │   ├── logWatcher.ts             # Console log parser (game state, hero, lane, match ID extraction)
│   │   └── screenOcr.ts              # OCR pipeline (Tesseract.js, Levenshtein matching, section parsing)
│   ├── types/
│   │   └── match.ts                   # Domain types (Match, Side, MatchResult, LaneColor, validation)
│   ├── App.tsx                         # Root layout, tab navigation & global state orchestration
│   ├── main.tsx                        # Frontend entrypoint
│   └── index.css                       # Tailwind CSS imports & custom theme variables
├── scripts/
│   └── setup-heroes.mjs               # Hero asset setup utility
├── AGENT.md                            # AI Agent guidance and development standards
├── package.json                        # Frontend dependencies & scripts
└── vite.config.ts                      # Vite configuration (Tauri dev server integration)
```

---

## 💻 Prerequisites & Installation

### Prerequisites
- **Node.js** (v18 or later) & **npm** / **pnpm**
- **Rust toolchain** (`rustc` and `cargo` via [rustup.rs](https://rustup.rs/))
- **Windows C++ Build Tools** (Visual Studio Build Tools with C++ workload)

### Development Setup
```bash
# 1. Clone the repository
git clone https://github.com/Remynder0/deadlock-analyse.git
cd deadlock-analyse

# 2. Install frontend dependencies
npm install

# 3. Launch Tauri in development mode (with Hot Reload)
npm run tauri dev
```

### ⚠️ Common Issues & Troubleshooting

- **`cargo metadata ... program not found`**:
  If you recently installed Rust, your current PowerShell / terminal session does not have the updated `PATH` yet.
  - **Quick Fix (PowerShell)**: Reload environment variables in your current session:
    ```powershell
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    ```
  - **Alternative**: Close and reopen your terminal or IDE (VS Code, etc.) so it reloads the system `PATH`.
  - Check that Cargo is recognized by running `cargo --version`.
- **Frontend-only Mode (Browser preview)**:
  To run the React application in your browser without compiling the Tauri / Rust backend:
  ```bash
  npm run dev
  ```
  *(Note: Storage automatically falls back to browser `localStorage` in web-only mode).*

### Deadlock Game Integration (Optional)
To enable live game state detection and log monitoring, launch Deadlock with the `-condebug` Steam launch option:
1. Open Steam → Library → Right-click **Deadlock** → Properties.
2. In **Launch Options**, add: `-condebug`
3. This generates a `console.log` file that the application reads non-invasively (no memory injection, zero VAC risk).

---

## 🤝 Commit Conventions

This repository strictly enforces **Conventional Commits**:
- `feat:` New features (e.g. `feat(ui): add hero selection icon grid (#4)`)
- `fix:` Bug fixes (e.g. `fix(storage): prevent duplicate hero selection in draft (#5)`)
- `docs:` Documentation changes (e.g. `docs: update setup guide in README (#1)`)
- `refactor:` Code refactoring without behavioral change
- `chore:` Dependency bumps, build configs, tooling

All commit messages, code comments, and documentation must be written in **English**.