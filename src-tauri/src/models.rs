//! # Models Module
//!
//! > 💡 **LEARNING & REFACTORING NOTE**:
//! > This file defines domain models with explicit serialization tags for TypeScript compatibility.
//! >
//! > **Idiomatic Rust features that can improve this code later:**
//! > 1. **Newtypes**: Wrap primitive types like `u32` into `HeroId(u32)` to prevent passing a random number as a Hero ID.
//! > 2. **Derive Macros**: Add `Default`, `Eq`, or custom validation traits (`validator` crate).
//! > 3. **Conversion Traits**: Implement `From` / `Into` or `TryFrom` / `TryInto` between DTOs and internal domain models.

use serde::{Deserialize, Serialize};

/// Represents the two opposing patron factions in Deadlock:
/// - The Hidden King
/// - The Archmother
///
/// Rust concept: `enum`
/// Unlike enums in Java or PHP, Rust enums are true "Algebraic Data Types" (ADT).
/// They are strongly typed, memory-safe, and exhaustive in `match` statements.
///
/// Attribute `#[derive(...)]`:
/// In Rust, functionality is added via "Traits" (interfaces).
/// Instead of writing boilerplate code manually, `derive` automatically implements:
/// - `Debug`: allows printing with `println!("{:?}", side)`
/// - `Clone`: allows duplicating the value in memory
/// - `PartialEq`: allows comparing with `==` (e.g. `side == Side::HiddenKing`)
/// - `Serialize`, `Deserialize`: provided by the `serde` crate for JSON conversion.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum Side {
    HiddenKing,
    Archmother,
}

/// Represents the final match outcome: Win, Loss, or Cancel (AFK / match abandoned).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum MatchResult {
    Win,
    Loss,
    Cancel,
}

/// Represents the three duo lanes in Deadlock: Yellow, Blue, Green.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum LaneColor {
    Yellow,
    Blue,
    Green,
}

/// Represents the lane phase outcome: Won, Lost, or Even.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum LaneOutcome {
    Won,
    Lost,
    Even,
}

/// Represents a single recorded Deadlock match.
///
/// Rust concept: `struct`
/// A struct defines a custom data structure (similar to a class with only fields in Java).
/// In Rust, data (structs) and behavior (functions/methods in `impl StructName`) are separated.
///
/// Memory & Types:
/// - `String`: an owned, heap-allocated, growable UTF-8 string.
/// - `u32`: an unsigned 32-bit integer (0 to 4,294,967,295), perfect for Hero IDs.
/// - `Vec<u32>`: a growable vector (dynamic array, like `ArrayList<Integer>` in Java or an array in JS).
/// - `Option<T>`: Rust has NO `null` or `undefined`!
///   Optional values use `Option<T>`, which can be either `Some(value)` or `None`.
///   This ensures 100% backwards-compatibility with existing matches.
///
/// `#[serde(rename_all = "camelCase")]`:
/// Rust idiomatic convention is `snake_case` (e.g. `my_hero_id`).
/// JavaScript / TypeScript convention is `camelCase` (e.g. `myHeroId`).
/// This attribute tells Serde to automatically convert between both conventions
/// during JSON serialization across the Tauri IPC bridge.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MatchRecord {
    pub id: String,
    pub match_id: Option<u64>,
    pub date: String,
    pub side: Side,
    pub my_hero_id: u32,
    pub allies: Vec<u32>,
    pub enemies: Vec<u32>,
    pub result: MatchResult,
    pub notes: Option<String>,

    // Duration tracking - Optional for backwards compatibility
    pub duration_seconds: Option<u32>,

    // Lane matchup tracking - Optional for backwards compatibility
    pub lane: Option<LaneColor>,
    pub lane_ally_id: Option<u32>,
    pub lane_opponents: Option<Vec<u32>>,
    pub lane_outcome: Option<LaneOutcome>,
    #[serde(default)]
    pub player_slot: Option<u32>,

    // Ranked progression tracking - Optional for backwards compatibility
    #[serde(default)]
    pub ranked_badge: Option<u32>,
    #[serde(default)]
    pub ranked_rank: Option<u32>,
    #[serde(default)]
    pub ranked_subrank: Option<u32>,
    #[serde(default)]
    pub ranked_delta: Option<i32>,
    #[serde(default)]
    pub ranked_progress: Option<u32>,
    #[serde(default)]
    pub ranked_initial_progress: Option<u32>,
    #[serde(default)]
    pub ranked_demotion_protection: Option<u32>,
    #[serde(default)]
    pub ranked_consumed_demotion_protection: Option<bool>,
}
