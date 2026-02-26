mod audio;
mod commands;
mod discord;

use commands::{DiscordState, RecorderState};
use parking_lot::Mutex;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, Wry,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // System tray
            let show_i = MenuItem::with_id(app, "show", "Show DiscRec", true, None::<&str>)?;
            let record_i = MenuItem::with_id(app, "record", "Start Recording", true, None::<&str>)?;
            let stop_i = MenuItem::with_id(app, "stop", "Stop Recording", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let sep = PredefinedMenuItem::separator(app)?;
            let menu = Menu::with_items(app, &[&show_i, &record_i, &stop_i, &sep, &quit_i])?;

            let _tray = TrayIconBuilder::new()
                .tooltip("DiscRec")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app: &AppHandle<Wry>, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "record" => {
                        let state = app.state::<RecorderState>();
                        let mut recorder = state.0.lock();
                        if !recorder.is_recording() {
                            let recordings_dir = dirs::audio_dir()
                                .or_else(dirs::home_dir)
                                .unwrap_or_else(|| std::path::PathBuf::from("."))
                                .join("DiscRec");
                            let timestamp = chrono::Local::now().format("%Y-%m-%d_%H%M%S");
                            let filename = format!("discord-{}.wav", timestamp);
                            let path = recordings_dir.join(&filename);
                            let _ = recorder
                                .start(&path.to_string_lossy(), audio::encoder::AudioFormat::Wav);
                        }
                    }
                    "stop" => {
                        let state = app.state::<RecorderState>();
                        let mut recorder = state.0.lock();
                        if recorder.is_recording() {
                            let _ = recorder.stop();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray: &tauri::tray::TrayIcon<Wry>, event| {
                    if let TrayIconEvent::Click {
                        button: tauri::tray::MouseButton::Left,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .manage(RecorderState(Mutex::new(
            audio::capture::AudioCapture::new(),
        )))
        .manage(DiscordState(tokio::sync::Mutex::new(
            discord::bot::DiscordBot::new(),
        )))
        .invoke_handler(tauri::generate_handler![
            commands::start_recording,
            commands::stop_recording,
            commands::get_status,
            commands::get_recordings_dir,
            commands::open_folder,
            commands::discord_connect,
            commands::discord_disconnect,
            commands::discord_list_guilds,
            commands::discord_list_channels,
            commands::discord_start_recording,
            commands::discord_stop_recording,
            commands::discord_get_status,
            commands::save_bot_token,
            commands::load_bot_token,
            commands::delete_bot_token,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
