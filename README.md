# Deadlock Draft & Match Analyzer

[![Tauri](https://img.shields.io/badge/Tauri-v2-blue?logo=tauri)](https://tauri.app/)
[![Rust](https://img.shields.io/badge/Rust-1.75+-orange?logo=rust)](https://www.rust-lang.org/)
[![React](https://img.shields.io/badge/React-18+-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4+-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

An ultra-lightweight desktop companion application for Valve's **Deadlock**. It records match drafts and outcomes to analyze personal matchup counters, ally synergies, and side win rates—helping players understand draft dynamics and overcome counter-picks in ranked games.

---

## 🎯 Motivation

In Deadlock ranked matches, individual execution is critical, but team drafts heavily dictate matchup dynamics. Facing unfavorable compositions without noticing drafting patterns often leads to feeling helpless during matches. 

This application provides:
- **Fast Post-Match Logging**: Record an entire 6v6 draft in under 20 seconds via a responsive hero icon picker.
- **Matchup Matrix (Nemesis Detection)**: Uncover which enemy heroes consistently lower your win rate when playing specific heroes.
- **Ally Synergies**: Identify which teammate heroes maximize your winning chances.
- **Side Impact**: Track performance disparities between **The Amber Hand** and **The Sapphire Flame**.
- **Minimal System Footprint**: Engineered with Tauri v2 to use under **35 MB of RAM**, guaranteeing zero FPS drop while Deadlock runs.

---

## 🛠️ Tech Stack

| Layer | Technology | Rationale |
| :--- | :--- | :--- |
| **Desktop Runtime** | [Tauri v2](https://tauri.app/) | Native Windows WebView2 integration, sub-35 MB memory footprint, secure IPC. |
| **Backend / Core** | [Rust](https://www.rust-lang.org/) | High performance, memory safety, zero-cost abstractions, robust error handling. |
| **Database** | [SQLite](https://www.sqlite.org/) via `tauri-plugin-sql` | Local embedded storage, zero external database daemon, fast relational aggregations. |
| **Frontend UI** | [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) | Type-safe component architecture with instant reactivity. |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) | Utility-first styling with a dark gaming aesthetic tailored for Deadlock. |
| **Build Tool** | [Vite](https://vitejs.dev/) | Lightning-fast HMR and minimal bundle footprint. |

---

## 🚀 Roadmap & Milestones

This project is tracked using a **GitHub Projects Kanban Board**:

- **Milestone 1: Core Foundation & Tauri v2 Setup**
  - Project scaffolding (Rust backend + Vite React TypeScript frontend).
  - Deadlock hero registry and compressed WebP portrait assets.
  - Local SQLite schema initialization and IPC command layer.
- **Milestone 2: Match Logging & History**
  - Visual hero icon grid with one-click toggling and search filters.
  - Match recording form (Side, My Hero, 5 Allies, 6 Enemies, Win/Loss, Notes).
  - Match history dashboard with composition inspection and record deletion.
- **Milestone 3: Analytics Engine (V1)**
  - Win rate dashboard: Overall, per-hero, and Side breakdown (*Amber* vs *Sapphire*).
  - Matchup counter matrix: Favorable targets vs Nemesis heroes.
  - Teammate synergy scoring.
- **Milestone 4: Draft Assistant & Deep Stats (V2)**
  - Real-time draft advisor during pick phase based on historical matchups.
  - Lane opponent assignment tracking.
  - Match ID auto-import integration.

---

## 📂 Project Structure

```
deadlock-analyse/
├── src-tauri/                 # Rust backend (Tauri v2)
│   ├── src/
│   │   ├── main.rs            # Application entrypoint & Tauri builder
│   │   ├── commands.rs        # IPC commands exposed to the frontend
│   │   └── models.rs          # Data structures (Match, Hero, Analytics)
│   ├── Cargo.toml             # Rust dependencies and configuration
│   └── tauri.conf.json        # Tauri window and capability settings
├── src/                       # Frontend application
│   ├── assets/
│   │   └── heroes/            # Compressed WebP hero portraits
│   ├── components/
│   │   ├── HeroPicker.tsx     # Visual hero grid selector
│   │   ├── MatchForm.tsx      # Quick match recording form
│   │   ├── HistoryList.tsx    # Chronological match history cards
│   │   └── AnalyticsView.tsx  # Win rates, matchups & synergies charts
│   ├── data/
│   │   └── heroes.ts          # Static hero metadata (IDs, names, roles)
│   ├── services/
│   │   ├── db.ts              # SQLite queries and migrations
│   │   └── analytics.ts       # Mathematical and statistical aggregations
│   ├── types/                 # Shared TypeScript interfaces
│   ├── App.tsx                # Main layout and view navigation
│   └── main.tsx               # Frontend entrypoint
├── AGENT.md                   # AI Agent guidance and development standards
└── package.json               # Frontend dependencies & scripts
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

---

## 🤝 Commit Conventions

This repository strictly enforces **Conventional Commits**:
- `feat:` New features (e.g. `feat(ui): add hero selection icon grid (#4)`)
- `fix:` Bug fixes (e.g. `fix(db): prevent duplicate hero selection in draft (#5)`)
- `docs:` Documentation changes (e.g. `docs: update setup guide in README (#1)`)
- `refactor:` Code refactoring without behavioral change
- `chore:` Dependency bumps, build configs, tooling

All commit messages, code comments, and documentation must be written in **English**.