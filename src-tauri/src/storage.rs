//! # Storage Module
//!
//! Provides thread-safe, crash-resilient persistence for match records.
//! Key guarantees:
//! 1. **Thread Safety**: Operations are synchronized via `STORAGE_MUTEX`.
//! 2. **Atomic Writes**: Writes first to a temporary file, flushes & syncs to disk,
//!    creates/updates a `.bak` backup copy of the valid database, then atomically renames.
//! 3. **Crash Recovery**: If the primary JSON file is corrupt or truncated upon loading,
//!    it automatically attempts to recover from the `.bak` backup.

use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Manager;
use crate::models::MatchRecord;

const STORAGE_FILE_NAME: &str = "deadlock_matches.json";
const BACKUP_FILE_NAME: &str = "deadlock_matches.json.bak";

/// Mutex ensuring mutually exclusive file access across all Tauri threads.
static STORAGE_MUTEX: Mutex<()> = Mutex::new(());

/// Resolves the absolute path to the data storage file on the user's computer.
fn get_storage_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Could not get app data directory: {}", e))?;

    if !app_data_dir.exists() {
        fs::create_dir_all(&app_data_dir)
            .map_err(|e| format!("Could not create storage directory: {}", e))?;
    }

    Ok(app_data_dir.join(STORAGE_FILE_NAME))
}

/// Atomically writes content to a file:
/// 1. Writes to a temporary file in the same directory.
/// 2. Flushes and syncs to disk (`sync_all`).
/// 3. Backs up the existing file if present (`.bak`).
/// 4. Atomically renames temporary file over target file.
fn atomic_write_file(target_path: &Path, content: &[u8]) -> Result<(), String> {
    let parent = target_path
        .parent()
        .ok_or_else(|| "Target path has no parent directory".to_string())?;

    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let tmp_path = parent.join(format!(
        ".{}.tmp.{}",
        target_path.file_name().and_then(|n| n.to_str()).unwrap_or("storage"),
        timestamp
    ));

    // Step 1: Write and sync to temporary file
    let mut file = fs::File::create(&tmp_path)
        .map_err(|e| format!("Failed to create temporary file {}: {}", tmp_path.display(), e))?;

    file.write_all(content)
        .map_err(|e| format!("Failed to write to temporary file: {}", e))?;
    file.flush()
        .map_err(|e| format!("Failed to flush temporary file: {}", e))?;
    file.sync_all()
        .map_err(|e| format!("Failed to sync temporary file to disk: {}", e))?;
    drop(file);

    // Step 2: Backup existing target file before overwriting
    let bak_path = target_path.with_file_name(BACKUP_FILE_NAME);
    if target_path.exists() {
        if let Err(e) = fs::copy(target_path, &bak_path) {
            eprintln!(
                "[storage] Warning: Failed to create backup file {}: {}",
                bak_path.display(),
                e
            );
        }
    }

    // Step 3: Atomic rename with Windows fallback
    if let Err(err) = fs::rename(&tmp_path, target_path) {
        #[cfg(windows)]
        {
            // On Windows, if target exists and rename failed, remove target and retry rename
            if target_path.exists() {
                let _ = fs::remove_file(target_path);
                fs::rename(&tmp_path, target_path).map_err(|e| {
                    let _ = fs::remove_file(&tmp_path);
                    format!("Failed to replace target file after removal: {}", e)
                })?;
            } else {
                let _ = fs::remove_file(&tmp_path);
                return Err(format!("Failed to rename temp file to target: {}", err));
            }
        }
        #[cfg(not(windows))]
        {
            let _ = fs::remove_file(&tmp_path);
            return Err(format!("Failed to rename temp file to target: {}", err));
        }
    }

    Ok(())
}

/// Internal helper: Reads and parses matches from a specific file path with backup fallback.
fn load_matches_internal(file_path: &Path) -> Result<Vec<MatchRecord>, String> {
    let bak_path = file_path.with_file_name(BACKUP_FILE_NAME);

    // If main file exists, attempt to read and parse it
    if file_path.exists() {
        match fs::read_to_string(file_path) {
            Ok(content) => {
                let trimmed = content.trim();
                if trimmed.is_empty() {
                    return Ok(Vec::new());
                }
                match serde_json::from_str::<Vec<MatchRecord>>(trimmed) {
                    Ok(records) => return Ok(records),
                    Err(parse_err) => {
                        eprintln!(
                            "[storage] Primary JSON file {} is corrupted ({}). Attempting backup recovery...",
                            file_path.display(),
                            parse_err
                        );
                    }
                }
            }
            Err(read_err) => {
                eprintln!(
                    "[storage] Could not read primary file {} ({}). Attempting backup recovery...",
                    file_path.display(),
                    read_err
                );
            }
        }
    }

    // Attempt recovery from .bak if primary was missing or corrupt
    if bak_path.exists() {
        if let Ok(bak_content) = fs::read_to_string(&bak_path) {
            let trimmed = bak_content.trim();
            if !trimmed.is_empty() {
                if let Ok(records) = serde_json::from_str::<Vec<MatchRecord>>(trimmed) {
                    eprintln!(
                        "[storage] Successfully recovered {} matches from backup {}",
                        records.len(),
                        bak_path.display()
                    );
                    // Restore main file from healthy backup
                    let _ = fs::copy(&bak_path, file_path);
                    return Ok(records);
                }
            }
        }
    }

    // If neither exists or primary was newly created, return empty list
    if !file_path.exists() {
        return Ok(Vec::new());
    }

    // Quarantine corrupted file if neither primary nor backup were parseable
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let corrupt_quarantine = file_path.with_extension(format!("corrupt.{}", timestamp));
    let _ = fs::rename(file_path, &corrupt_quarantine);

    Err(format!(
        "Primary storage was corrupted and no valid backup was found. Corrupted file quarantined to {}",
        corrupt_quarantine.display()
    ))
}

/// Reads and returns all matches stored in the JSON file.
/// If the file does not exist yet, returns an empty list.
/// Automatically recovers from `.bak` if corrupted.
pub fn load_matches(app: &tauri::AppHandle) -> Result<Vec<MatchRecord>, String> {
    let _lock = STORAGE_MUTEX
        .lock()
        .map_err(|e| format!("Storage mutex poisoned: {}", e))?;

    let file_path = get_storage_path(app)?;
    load_matches_internal(&file_path)
}

/// Writes the full list of matches to the JSON file atomically with backup.
pub fn save_all_matches(app: &tauri::AppHandle, matches: &[MatchRecord]) -> Result<(), String> {
    let _lock = STORAGE_MUTEX
        .lock()
        .map_err(|e| format!("Storage mutex poisoned: {}", e))?;

    let file_path = get_storage_path(app)?;
    save_all_matches_internal(&file_path, matches)
}

/// Internal helper for saving matches atomically to a specific file path.
fn save_all_matches_internal(file_path: &Path, matches: &[MatchRecord]) -> Result<(), String> {
    let json_text = serde_json::to_string_pretty(matches)
        .map_err(|e| format!("JSON serialization failed: {}", e))?;

    atomic_write_file(file_path, json_text.as_bytes())
}

/// Adds a new match or updates an existing one if the ID already exists.
pub fn add_or_update_match(app: &tauri::AppHandle, new_record: MatchRecord) -> Result<MatchRecord, String> {
    let _lock = STORAGE_MUTEX
        .lock()
        .map_err(|e| format!("Storage mutex poisoned: {}", e))?;

    let file_path = get_storage_path(app)?;
    let mut current_matches = load_matches_internal(&file_path)?;

    // Search if a match with the same ID already exists
    if let Some(pos) = current_matches.iter().position(|m| m.id == new_record.id) {
        current_matches[pos] = new_record.clone();
    } else {
        // Insert at beginning so newest matches appear first
        current_matches.insert(0, new_record.clone());
    }

    save_all_matches_internal(&file_path, &current_matches)?;
    Ok(new_record)
}

/// Deletes a match by its unique ID string.
pub fn delete_match_by_id(app: &tauri::AppHandle, match_id: &str) -> Result<bool, String> {
    let _lock = STORAGE_MUTEX
        .lock()
        .map_err(|e| format!("Storage mutex poisoned: {}", e))?;

    let file_path = get_storage_path(app)?;
    let mut current_matches = load_matches_internal(&file_path)?;

    let initial_len = current_matches.len();
    current_matches.retain(|m| m.id != match_id);

    if current_matches.len() < initial_len {
        save_all_matches_internal(&file_path, &current_matches)?;
        Ok(true)
    } else {
        Ok(false)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{Side, MatchResult};
    use std::fs;

    fn create_test_record(id: &str) -> MatchRecord {
        MatchRecord {
            id: id.to_string(),
            match_id: None,
            date: "2026-09-12T10:00:00Z".to_string(),
            side: Side::HiddenKing,
            my_hero_id: 1,
            allies: vec![2, 3, 4, 5, 6],
            enemies: vec![7, 8, 9, 10, 11, 12],
            result: MatchResult::Win,
            duration_seconds: Some(1500),
            notes: Some("Test note".to_string()),
            lane: None,
            lane_ally_id: None,
            lane_opponents: Some(Vec::new()),
            lane_outcome: None,
            ranked_badge: None,
            ranked_rank: None,
            ranked_subrank: None,
            ranked_delta: None,
            ranked_progress: None,
            ranked_initial_progress: None,
            ranked_demotion_protection: None,
            ranked_consumed_demotion_protection: None,
            player_slot: None,
        }
    }

    #[test]
    fn test_atomic_write_and_backup() {
        let temp_dir = std::env::temp_dir().join(format!("deadlock_test_atomic_{}", SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis()));
        fs::create_dir_all(&temp_dir).unwrap();
        let file_path = temp_dir.join("deadlock_matches.json");
        let bak_path = temp_dir.join("deadlock_matches.json.bak");

        // 1. Initial write
        let records = vec![create_test_record("match_1")];
        save_all_matches_internal(&file_path, &records).unwrap();
        assert!(file_path.exists());
        assert!(!bak_path.exists());

        // 2. Second write should produce .bak of first write
        let records2 = vec![create_test_record("match_1"), create_test_record("match_2")];
        save_all_matches_internal(&file_path, &records2).unwrap();
        assert!(file_path.exists());
        assert!(bak_path.exists());

        // Verify content in main file
        let loaded = load_matches_internal(&file_path).unwrap();
        assert_eq!(loaded.len(), 2);

        // Verify backup has previous 1 record
        let loaded_bak = load_matches_internal(&bak_path).unwrap();
        assert_eq!(loaded_bak.len(), 1);

        let _ = fs::remove_dir_all(temp_dir);
    }

    #[test]
    fn test_recovery_from_corrupted_primary() {
        let temp_dir = std::env::temp_dir().join(format!("deadlock_test_recovery_{}", SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis()));
        fs::create_dir_all(&temp_dir).unwrap();
        let file_path = temp_dir.join("deadlock_matches.json");
        let bak_path = temp_dir.join("deadlock_matches.json.bak");

        // 1. Save valid initial records
        let records = vec![create_test_record("match_1"), create_test_record("match_2")];
        save_all_matches_internal(&file_path, &records).unwrap();
        // Force creation of backup
        save_all_matches_internal(&file_path, &records).unwrap();
        assert!(bak_path.exists());

        // 2. Corrupt primary file with truncated/invalid JSON
        fs::write(&file_path, "{ broken json [").unwrap();

        // 3. Loading should automatically recover from .bak!
        let recovered = load_matches_internal(&file_path).unwrap();
        assert_eq!(recovered.len(), 2);
        assert_eq!(recovered[0].id, "match_1");

        let _ = fs::remove_dir_all(temp_dir);
    }

    #[test]
    fn test_concurrent_writes_thread_safety() {
        use std::sync::Arc;
        use std::thread;

        let temp_dir = std::env::temp_dir().join(format!("deadlock_test_concurrency_{}", SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis()));
        fs::create_dir_all(&temp_dir).unwrap();
        let file_path = Arc::new(temp_dir.join("deadlock_matches.json"));

        let mut handles = Vec::new();
        for thread_idx in 0..10 {
            let path_clone = Arc::clone(&file_path);
            handles.push(thread::spawn(move || {
                for i in 0..5 {
                    let _lock = STORAGE_MUTEX.lock().unwrap();
                    let mut current = load_matches_internal(&path_clone).unwrap_or_default();
                    current.push(create_test_record(&format!("t_{}_{}", thread_idx, i)));
                    save_all_matches_internal(&path_clone, &current).unwrap();
                }
            }));
        }

        for handle in handles {
            handle.join().unwrap();
        }

        let final_records = load_matches_internal(&file_path).unwrap();
        assert_eq!(final_records.len(), 50);

        let _ = fs::remove_dir_all(temp_dir);
    }
}
