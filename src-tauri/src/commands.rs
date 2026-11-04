//! # IPC Commands Layer
//!
//! > 💡 **LEARNING & REFACTORING NOTE**:
//! > This file is written using explicit syntax and functions to make the IPC bridge
//! > between JavaScript and Rust easy to read and understand.
//! >
//! > **Idiomatic Rust features that can improve this code later:**
//! > 1. **Early Return & `?` Operator**: Eliminate boilerplate `match` when serializing JSON.
//! > 2. **State Management**: Use `tauri::State<'_, AppState>` with a thread-safe `Mutex` or `RwLock`
//! >    instead of re-reading from disk on every single command call.
//! > 3. **Typed Commands**: Return strongly typed `Result<T, CustomError>` mapped to JavaScript errors.

use crate::models::MatchRecord;
use crate::storage;
use crate::log_watcher::{self, LogEvent};
use sha2::{Digest, Sha256};

const DEV_WORKSTATION_SALT: &str = "lil-helper-dev-workstation-salt-v1";
// Precomputed salted SHA-256 fingerprint of the authorized developer workstation.
// Ensures zero personal or sensitive identity information is stored in cleartext.
const AUTHORIZED_MACHINE_FINGERPRINT: &str =
    "6ec329fb6e0e578f96d0e2cc94d17b1adf3a866565979917dc0a895a72d6bb8f";

/// Retrieves the complete list of matches for a specific account or default.
#[tauri::command]
pub fn get_matches(app: tauri::AppHandle, account_id: Option<u64>) -> Result<Vec<MatchRecord>, String> {
    storage::load_matches(&app, account_id)
}

/// Saves a match record for a specific account or default (creates new or updates existing).
#[tauri::command]
pub fn save_match(app: tauri::AppHandle, match_record: MatchRecord, account_id: Option<u64>) -> Result<MatchRecord, String> {
    storage::add_or_update_match(&app, match_record, account_id)
}

/// Deletes a match record by its ID string.
#[tauri::command]
pub fn delete_match(app: tauri::AppHandle, id: String, account_id: Option<u64>) -> Result<bool, String> {
    storage::delete_match_by_id(&app, &id, account_id)
}

/// Exports all matches for a specific account to a formatted JSON string.
#[tauri::command]
pub fn export_matches(app: tauri::AppHandle, account_id: Option<u64>) -> Result<String, String> {
    let matches = storage::load_matches(&app, account_id)?;
    serde_json::to_string_pretty(&matches).map_err(|e| format!("Export formatting failed: {}", e))
}

/// Imports matches from a JSON string into current storage.
#[tauri::command]
pub fn import_matches(app: tauri::AppHandle, json_data: String, account_id: Option<u64>) -> Result<usize, String> {
    let parse_result: Result<Vec<MatchRecord>, serde_json::Error> = serde_json::from_str(&json_data);
    let imported_list: Vec<MatchRecord> = match parse_result {
        Ok(list) => list,
        Err(error) => {
            return Err(format!("Invalid JSON format: {}", error));
        }
    };

    let imported_count = imported_list.len();
    let mut current_matches = storage::load_matches(&app, account_id)?;

    for record in imported_list {
        if let Some(pos) = current_matches.iter().position(|m| m.id == record.id) {
            current_matches[pos] = record;
        } else {
            current_matches.push(record);
        }
    }

    storage::save_all_matches(&app, &current_matches, account_id)?;
    Ok(imported_count)
}

/// Retrieves stored application settings (Steam profile, preferences, paths).
#[tauri::command]
pub fn get_settings(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    storage::load_settings(&app)
}

/// Saves application settings atomically to settings.json.
#[tauri::command]
pub fn save_settings(app: tauri::AppHandle, settings: serde_json::Value) -> Result<(), String> {
    storage::save_settings(&app, settings)
}

/// Tries to automatically detect the Deadlock console.log file path.
#[tauri::command]
pub fn detect_deadlock_log_path() -> Option<String> {
    log_watcher::detect_default_log_path().map(|p| p.to_string_lossy().to_string())
}

/// Reads the last N bytes of the specified Deadlock console.log.
#[tauri::command]
pub fn read_deadlock_log_events(path: String, max_bytes: Option<u64>) -> Result<Vec<LogEvent>, String> {
    let bytes = max_bytes.unwrap_or(65536); // default to 64KB
    log_watcher::read_recent_log_lines(&path, bytes)
}

/// Saves raw log contents or debug dump to a specified output file.
#[tauri::command]
pub fn save_deadlock_debug_log(target_path: String, content: String) -> Result<bool, String> {
    log_watcher::save_debug_log_to_file(&target_path, &content)?;
    Ok(true)
}

/// Captures the primary display (or the right portion containing the escape menu) as base64 PNG.
#[tauri::command]
pub fn capture_screen_image(right_half_only: Option<bool>) -> Result<String, String> {
    let right_only = right_half_only.unwrap_or(true);
    crate::screen_ocr::capture_screen_right_half(right_only)
}

/// Checks if Deadlock game window is currently running and visible.
#[tauri::command]
pub fn is_deadlock_running() -> bool {
    crate::screen_ocr::find_deadlock_window_bounds().is_some()
}

/// Parses a Deadlock .dem replay file and returns match data as JSON.
/// 
/// # Arguments
/// * `path` — Absolute path to the .dem file
/// * `my_account_id` — Steam Account ID (32-bit) of the player to identify
/// * `match_id` — Match ID (from file name or queue)
#[tauri::command]
pub fn parse_dem_file(path: String, my_account_id: u32, match_id: u64) -> Result<serde_json::Value, String> {
    let result = crate::dem_parser::parse_dem_file(&path, my_account_id, match_id)?;
    serde_json::to_value(&result).map_err(|e| format!("Erreur de sérialisation : {e}"))
}

/// Verifies that the app is executing in development mode on an authorized developer workstation.
/// Enforces debug mode (debug_assertions enabled) and salted cryptographic fingerprint verification.
/// No personal or sensitive developer identity information is exposed in cleartext.
#[tauri::command]
pub fn is_developer_authorized() -> bool {
    // 1. Must be compiled in debug mode (debug_assertions enabled)
    if !cfg!(debug_assertions) {
        return false;
    }

    // 2. Hardware / OS user salted fingerprint verification
    let username = std::env::var("USERNAME")
        .or_else(|_| std::env::var("USER"))
        .unwrap_or_default()
        .to_lowercase();
    let computername = std::env::var("COMPUTERNAME")
        .or_else(|_| std::env::var("HOSTNAME"))
        .unwrap_or_default()
        .to_lowercase();

    let mut hasher = Sha256::new();
    hasher.update(format!("{}:{}:{}", username.trim(), computername.trim(), DEV_WORKSTATION_SALT).as_bytes());
    let computed_hash = format!("{:x}", hasher.finalize());

    computed_hash == AUTHORIZED_MACHINE_FINGERPRINT
}

