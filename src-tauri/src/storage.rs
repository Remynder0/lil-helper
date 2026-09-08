//! # Storage Module
//!
//! > 💡 **LEARNING & REFACTORING NOTE**:
//! > This file is intentionally written using explicit, step-by-step generic programming
//! > patterns (explicit `match` blocks, traditional `while`/`for` loops, explicit `return`)
//! > to make the logic crystal clear for developers transitioning from Java, PHP, or JavaScript.
//! >
//! > **Idiomatic Rust features that can improve this code later:**
//! > 1. **The `?` Operator**: Replace repetitive `match` error handling with `?` (e.g. `let data = fs::read_to_string(&path)?;`).
//! > 2. **Iterator Combinators**: Replace manual `while` index loops with `.iter().position(|m| m.id == id)` and `.retain()`.
//! > 3. **Slice Borrowing**: Accept `&[MatchRecord]` instead of `&Vec<MatchRecord>` to be more idiomatic and flexible.
//! > 4. **Custom Error Enums**: Use a typed `enum AppError` with `thiserror` crate instead of raw `String` error messages.

use std::fs;
use std::path::PathBuf;
use tauri::Manager;
use crate::models::MatchRecord;

const STORAGE_FILE_NAME: &str = "deadlock_matches.json";

/// Resolves the absolute path to the data storage file on the user's computer.
///
/// In this function, we explicitly check every step using `match` instead of shortcuts.
fn get_storage_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    // Step 1: Request the OS application data folder from Tauri
    let app_data_result = app.path().app_data_dir();
    
    // We explicitly handle the Result: Ok vs Err
    let mut directory_path: PathBuf = match app_data_result {
        Ok(path) => path,
        Err(error) => {
            let error_message = format!("Could not get app data directory: {}", error);
            return Err(error_message);
        }
    };

    // Step 2: Create the folder if it does not exist yet
    if directory_path.exists() == false {
        let create_result = fs::create_dir_all(&directory_path);
        match create_result {
            Ok(()) => (), // Folder created successfully
            Err(error) => {
                let error_message = format!("Could not create storage directory: {}", error);
                return Err(error_message);
            }
        }
    }

    // Step 3: Add the file name to the directory path
    directory_path.push(STORAGE_FILE_NAME);
    
    return Ok(directory_path);
}

/// Reads and returns all matches stored in the JSON file.
/// If the file does not exist yet, returns an empty list.
pub fn load_matches(app: &tauri::AppHandle) -> Result<Vec<MatchRecord>, String> {
    let file_path: PathBuf = match get_storage_path(app) {
        Ok(path) => path,
        Err(error) => return Err(error),
    };

    // If the file doesn't exist yet (first launch), return an empty list:
    if file_path.exists() == false {
        let empty_list: Vec<MatchRecord> = Vec::new();
        return Ok(empty_list);
    }

    // Read the text content of the file
    let file_content_result = fs::read_to_string(&file_path);
    let file_content: String = match file_content_result {
        Ok(text) => text,
        Err(error) => {
            let error_message = format!("Could not read file {}: {}", file_path.display(), error);
            return Err(error_message);
        }
    };

    // If file is empty, return empty list
    if file_content.trim().is_empty() {
        let empty_list: Vec<MatchRecord> = Vec::new();
        return Ok(empty_list);
    }

    // Parse the JSON string into Rust structs
    let parse_result: Result<Vec<MatchRecord>, serde_json::Error> = serde_json::from_str(&file_content);
    match parse_result {
        Ok(matches_list) => {
            return Ok(matches_list);
        }
        Err(error) => {
            let error_message = format!("JSON parsing failed: {}", error);
            return Err(error_message);
        }
    }
}

/// Writes the full list of matches to the JSON file.
pub fn save_all_matches(app: &tauri::AppHandle, matches: &Vec<MatchRecord>) -> Result<(), String> {
    let file_path: PathBuf = match get_storage_path(app) {
        Ok(path) => path,
        Err(error) => return Err(error),
    };

    // Convert Rust structs to formatted JSON text
    let json_result = serde_json::to_string_pretty(matches);
    let json_text: String = match json_result {
        Ok(text) => text,
        Err(error) => {
            let error_message = format!("JSON serialization failed: {}", error);
            return Err(error_message);
        }
    };

    // Write text to the file on disk
    let write_result = fs::write(&file_path, json_text);
    match write_result {
        Ok(()) => {
            return Ok(());
        }
        Err(error) => {
            let error_message = format!("Failed to write to file: {}", error);
            return Err(error_message);
        }
    }
}

/// Adds a new match or updates an existing one if the ID already exists.
pub fn add_or_update_match(app: &tauri::AppHandle, new_record: MatchRecord) -> Result<MatchRecord, String> {
    // 1. Load current list
    let mut current_matches: Vec<MatchRecord> = match load_matches(app) {
        Ok(list) => list,
        Err(error) => return Err(error),
    };

    // 2. Search if a match with the same ID already exists
    let mut existing_index: Option<usize> = None;
    let mut index: usize = 0;
    while index < current_matches.len() {
        if current_matches[index].id == new_record.id {
            existing_index = Some(index);
            break;
        }
        index = index + 1;
    }

    // 3. Update or Insert
    match existing_index {
        Some(idx) => {
            // Replace the existing record
            current_matches[idx] = new_record.clone();
        }
        None => {
            // Insert at the beginning (index 0) so newest matches appear first
            current_matches.insert(0, new_record.clone());
        }
    }

    // 4. Save to disk
    let save_result = save_all_matches(app, &current_matches);
    match save_result {
        Ok(()) => {
            return Ok(new_record);
        }
        Err(error) => {
            return Err(error);
        }
    }
}

/// Deletes a match by its unique ID string.
pub fn delete_match_by_id(app: &tauri::AppHandle, match_id: &str) -> Result<bool, String> {
    let current_matches: Vec<MatchRecord> = match load_matches(app) {
        Ok(list) => list,
        Err(error) => return Err(error),
    };

    let mut filtered_matches: Vec<MatchRecord> = Vec::new();
    let mut item_was_found: bool = false;

    // Explicit loop through all matches
    for item in current_matches {
        if item.id == match_id {
            item_was_found = true;
            // Skip adding this item to filtered_matches (it is deleted)
        } else {
            filtered_matches.push(item);
        }
    }

    // If found and removed, save the new list to disk
    if item_was_found == true {
        let save_result = save_all_matches(app, &filtered_matches);
        match save_result {
            Ok(()) => return Ok(true),
            Err(error) => return Err(error),
        }
    } else {
        // Nothing was deleted because ID was not found
        return Ok(false);
    }
}
