pub mod models;
pub mod storage;
pub mod commands;
pub mod log_watcher;
pub mod screen_ocr;
pub mod dem_parser;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::get_matches,
            commands::save_match,
            commands::delete_match,
            commands::export_matches,
            commands::import_matches,
            commands::detect_deadlock_log_path,
            commands::read_deadlock_log_events,
            commands::save_deadlock_debug_log,
            commands::capture_screen_image,
            commands::is_deadlock_running,
            commands::parse_dem_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
