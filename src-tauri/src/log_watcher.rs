//! # Log Watcher & Parser Module for Deadlock Source 2 (-condebug)
//!
//! Watches `citadel/console.log` in the background and extracts:
//! - Match ID connection
//! - Player slot assignments and heroes
//! - Game state transitions (Lobby, Connecting, Pre-Match Draft, Ended)

use std::fs::{self, File};
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogEvent {
    pub timestamp: String,
    pub raw_line: String,
    pub event_type: String, // "info", "match_found", "hero_detected", "status"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WatcherStatus {
    pub is_watching: bool,
    pub log_path: Option<String>,
    pub last_detected_match_id: Option<u64>,
    pub status_message: String,
}

/// Automatically searches Steam paths across all system drive letters (A to Z) for Deadlock's console.log
pub fn detect_default_log_path() -> Option<PathBuf> {
    let candidate_subpaths = [
        "SteamLibrary\\steamapps\\common\\Deadlock\\game\\citadel\\console.log",
        "SteamLibrary\\steamapps\\common\\Deadlock\\game\\citadel\\consol.log",
        "Program Files (x86)\\Steam\\steamapps\\common\\Deadlock\\game\\citadel\\console.log",
        "Program Files (x86)\\Steam\\steamapps\\common\\Deadlock\\game\\citadel\\consol.log",
        "Program Files\\Steam\\steamapps\\common\\Deadlock\\game\\citadel\\console.log",
        "Steam\\steamapps\\common\\Deadlock\\game\\citadel\\console.log",
        "Steam\\steamapps\\common\\Deadlock\\game\\citadel\\consol.log",
        "Games\\SteamLibrary\\steamapps\\common\\Deadlock\\game\\citadel\\console.log",
        "Jeux\\SteamLibrary\\steamapps\\common\\Deadlock\\game\\citadel\\console.log",
    ];

    // 1. Scan primary drives C..=Z
    for drive_char in b'C'..=b'Z' {
        let drive = drive_char as char;
        for subpath in &candidate_subpaths {
            let candidate = PathBuf::from(format!("{}:\\{}", drive, subpath));
            if candidate.exists() {
                return Some(candidate);
            }
        }
    }

    // Also check A: and B:
    for drive in ['A', 'B'] {
        for subpath in &candidate_subpaths {
            let candidate = PathBuf::from(format!("{}:\\{}", drive, subpath));
            if candidate.exists() {
                return Some(candidate);
            }
        }
    }

    // 2. Also try reading libraryfolders.vdf from common Steam paths
    let steam_vdf_candidates = [
        "C:\\Program Files (x86)\\Steam\\steamapps\\libraryfolders.vdf",
        "C:\\Program Files\\Steam\\steamapps\\libraryfolders.vdf",
        "C:\\Steam\\steamapps\\libraryfolders.vdf",
        "D:\\SteamLibrary\\steamapps\\libraryfolders.vdf",
    ];

    for vdf_path_str in &steam_vdf_candidates {
        let vdf_path = Path::new(vdf_path_str);
        if vdf_path.exists() {
            if let Ok(content) = fs::read_to_string(vdf_path) {
                for line in content.lines() {
                    let trimmed = line.trim();
                    if trimmed.starts_with("\"path\"") {
                        let parts: Vec<&str> = trimmed.split('"').collect();
                        if parts.len() >= 4 {
                            let lib_path = parts[3].replace("\\\\", "\\");
                            for log_file in ["console.log", "consol.log"] {
                                let deadlock_log = PathBuf::from(&lib_path)
                                    .join("steamapps")
                                    .join("common")
                                    .join("Deadlock")
                                    .join("game")
                                    .join("citadel")
                                    .join(log_file);
                                if deadlock_log.exists() {
                                    return Some(deadlock_log);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    None
}

/// Reads the last N bytes of a log file and returns newly appended lines
pub fn read_recent_log_lines(path_str: &str, max_bytes: u64) -> Result<Vec<LogEvent>, String> {
    let path = Path::new(path_str);
    if !path.exists() {
        return Err(format!("Log file not found at: {}", path_str));
    }

    let mut file = match File::open(path) {
        Ok(f) => f,
        Err(e) => return Err(format!("Failed to open log file: {}", e)),
    };

    let file_len = match file.metadata() {
        Ok(m) => m.len(),
        Err(e) => return Err(format!("Failed to read metadata: {}", e)),
    };

    let seek_offset = if file_len > max_bytes {
        file_len - max_bytes
    } else {
        0
    };

    if let Err(e) = file.seek(SeekFrom::Start(seek_offset)) {
        return Err(format!("Failed to seek file: {}", e));
    }

    let mut buffer = String::new();
    if let Err(_) = file.read_to_string(&mut buffer) {
        // In case of non-UTF8 characters in game log, read lossy
        let mut byte_buf = Vec::new();
        let _ = file.seek(SeekFrom::Start(seek_offset));
        let _ = file.read_to_end(&mut byte_buf);
        buffer = String::from_utf8_lossy(&byte_buf).to_string();
    }

    let mut events = Vec::new();
    for line in buffer.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let mut event_type = "info".to_string();
        let lower = trimmed.to_lowercase();

        if lower.contains("match_id") || lower.contains("connected to") || lower.contains("entering lobby") {
            event_type = "match_found".to_string();
        } else if lower.contains("hero") || lower.contains("assigned_lane") || lower.contains("citadel_player") {
            event_type = "hero_detected".to_string();
        }

        events.push(LogEvent {
            timestamp: chrono_now(),
            raw_line: trimmed.to_string(),
            event_type,
        });
    }

    // Return the last 300 events max to keep UI snappy
    if events.len() > 300 {
        events = events.split_off(events.len() - 300);
    }

    Ok(events)
}

/// Saves raw debug logs or exported lines to a local destination file
pub fn save_debug_log_to_file(target_path: &str, content: &str) -> Result<(), String> {
    fs::write(target_path, content).map_err(|e| format!("Failed to write debug log file: {}", e))
}

/// Simple timestamp helper without heavy extra dependencies
fn chrono_now() -> String {
    let now = std::time::SystemTime::now();
    match now.duration_since(std::time::UNIX_EPOCH) {
        Ok(dur) => {
            let total_secs = dur.as_secs();
            let hours = (total_secs / 3600) % 24;
            let minutes = (total_secs / 60) % 60;
            let seconds = total_secs % 60;
            format!("{:02}:{:02}:{:02}", hours, minutes, seconds)
        }
        Err(_) => "00:00:00".to_string(),
    }
}
