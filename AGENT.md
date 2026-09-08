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
- **Safety First**: Leverage Rust's borrow checker and type system. Avoid `unwrap()` or `expect()` in production paths; use `Result<T, AppError>` and idiomatic `?` error propagation.
- **Serialization**: Use `serde` (`Serialize`, `Deserialize`) for IPC structs transmitted between Rust and TypeScript.
- **Persistence**: Use SQLite via `tauri-plugin-sql` or embedded `rusqlite` for local structured data storage.
- **Separation of Concerns**:
  - `commands.rs`: Handlers decorated with `#[tauri::command]`. Keep them thin and delegate logic to dedicated domain modules.
  - `models.rs`: Domain entities, enums (`Side`, `MatchResult`), and database DTOs.

### 3. Frontend: React + TypeScript + Tailwind (`src/`)
- **Strict TypeScript**: `noImplicitAny: true`. Never use `any` unless interacting with untyped third-party data, and encapsulate it immediately.
- **Styling**: Tailwind CSS exclusively. Adopt a cohesive, dark-themed UI reminiscent of Deadlock's steam-punk / occult aesthetic.
- **Component Design**:
  - Modular, single-responsibility components (`HeroPicker`, `MatchCard`, `StatSummary`).
  - Optimize renders for list views (use keys properly, avoid re-rendering entire icon grids on single selections).
- **State Management**: Keep it simple. React hooks (`useState`, `useReducer`, `useMemo`) or lightweight stores (e.g. Zustand) if state crosses multiple views. Avoid Redux.

---

## 📊 Domain Knowledge: Deadlock

- **Teams**: 6 vs 6.
- **Sides (Patrons)**:
  - **The Hidden King** (Gold / Yellow patron)
  - **The Archmother** (Blue / Purple patron)
- **Draft Composition**:
  - Exactly 1 played hero (`my_hero`).
  - Exactly 5 allied heroes (`allies`).
  - Exactly 6 enemy heroes (`enemies`).
  - Total of 12 distinct heroes per match (no duplicates across or within teams).
- **Result**: `Win` or `Loss`.
- **Matchup Metrics**:
  - **Direct Counter**: A hero \(E\) on the enemy team against which your played hero \(H\) has a significantly lower Win Rate than your baseline.
  - **Synergy**: An allied hero \(A\) with which your played hero \(H\) achieves a significantly higher Win Rate than your baseline.

---

## 📋 Development Workflow

1. **Check Existing Tasks**: Refer to `implementation_plan.md` and the GitHub Project Kanban board before starting any task.
2. **Verification**: Always verify builds (`cargo check`, `npm run build` or `npm run tauri dev`) before marking a task complete.
3. **Keep Artifacts Updated**: If architectural decisions change, update both `README.md` and `implementation_plan.md`.
