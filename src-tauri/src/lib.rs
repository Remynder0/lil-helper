pub mod models;
pub mod storage;
pub mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::get_matches,
            commands::save_match,
            commands::delete_match,
            commands::export_matches,
            commands::import_matches
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
