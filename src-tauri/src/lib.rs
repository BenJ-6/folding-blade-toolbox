mod processor;
#[cfg(windows)]
mod screen_hud;
mod screen_picker;

#[tauri::command]
fn process_image(
    path: String,
    options: processor::ProcessOptions,
) -> Result<tauri::ipc::Response, String> {
    let bytes = processor::process(&path, &options)?;
    Ok(tauri::ipc::Response::new(bytes))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|_app| {
            #[cfg(windows)]
            {
                screen_hud::spawn();
                screen_picker::install_hooks();
            }
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            process_image,
            screen_picker::start_screen_pick
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
