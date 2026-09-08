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

/// Retrieves the complete list of matches.
#[tauri::command]
pub fn get_matches(app: tauri::AppHandle) -> Result<Vec<MatchRecord>, String> {
    let result = storage::load_matches(&app);
    return result;
}

/// Saves a match record (creates new or updates existing).
#[tauri::command]
pub fn save_match(app: tauri::AppHandle, match_record: MatchRecord) -> Result<MatchRecord, String> {
    let result = storage::add_or_update_match(&app, match_record);
    return result;
}

/// Deletes a match record by its ID string.
#[tauri::command]
pub fn delete_match(app: tauri::AppHandle, id: String) -> Result<bool, String> {
    let result = storage::delete_match_by_id(&app, &id);
    return result;
}

/// Exports all matches to a formatted JSON string.
#[tauri::command]
pub fn export_matches(app: tauri::AppHandle) -> Result<String, String> {
    // 1. Load matches
    let matches: Vec<MatchRecord> = match storage::load_matches(&app) {
        Ok(list) => list,
        Err(error) => {
            return Err(error);
        }
    };

    // 2. Format as JSON string
    let json_result = serde_json::to_string_pretty(&matches);
    match json_result {
        Ok(json_text) => {
            return Ok(json_text);
        }
        Err(error) => {
            let error_message = format!("Export formatting failed: {}", error);
            return Err(error_message);
        }
    }
}

/// Imports matches from a JSON string into current storage.
#[tauri::command]
pub fn import_matches(app: tauri::AppHandle, json_data: String) -> Result<usize, String> {
    // 1. Parse JSON
    let parse_result: Result<Vec<MatchRecord>, serde_json::Error> = serde_json::from_str(&json_data);
    let imported_list: Vec<MatchRecord> = match parse_result {
        Ok(list) => list,
        Err(error) => {
            let error_message = format!("Invalid JSON format: {}", error);
            return Err(error_message);
        }
    };

    let imported_count: usize = imported_list.len();

    // 2. Load existing matches
    let mut current_matches: Vec<MatchRecord> = match storage::load_matches(&app) {
        Ok(list) => list,
        Err(error) => return Err(error),
    };

    // 3. Merge: if match ID exists, update it. Otherwise, add it.
    for record in imported_list {
        let mut found_index: Option<usize> = None;
        let mut i: usize = 0;
        while i < current_matches.len() {
            if current_matches[i].id == record.id {
                found_index = Some(i);
                break;
            }
            i = i + 1;
        }

        match found_index {
            Some(idx) => {
                current_matches[idx] = record;
            }
            None => {
                current_matches.push(record);
            }
        }
    }

    // 4. Save merged list to disk
    let save_result = storage::save_all_matches(&app, &current_matches);
    match save_result {
        Ok(()) => {
            return Ok(imported_count);
        }
        Err(error) => {
            return Err(error);
        }
    }
}
