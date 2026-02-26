use crate::audio::capture::AudioCapture;
use crate::audio::encoder::AudioFormat;
use chrono::Local;
use parking_lot::Mutex;
use serde::Serialize;
use tauri::{AppHandle, State};
use tauri_plugin_notification::NotificationExt;

pub struct RecorderState(pub Mutex<AudioCapture>);

#[derive(Serialize, Clone)]
pub struct RecordingStatus {
    pub is_recording: bool,
    pub peak_level: f32,
}

#[tauri::command]
pub fn start_recording(
    state: State<'_, RecorderState>,
    format: Option<AudioFormat>,
) -> Result<String, String> {
    let mut recorder = state.0.lock();
    let fmt = format.unwrap_or(AudioFormat::Wav);

    let recordings_dir = dirs::audio_dir()
        .or_else(dirs::home_dir)
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("DiscRec");

    let timestamp = Local::now().format("%Y-%m-%d_%H%M%S");
    let filename = format!("discord-{}.{}", timestamp, fmt.extension());
    let output_path = recordings_dir.join(&filename);
    let path_str = output_path.to_string_lossy().to_string();

    recorder.start(&path_str, fmt).map_err(|e| e.to_string())?;
    Ok(path_str)
}

#[tauri::command]
pub fn stop_recording(
    app: AppHandle,
    state: State<'_, RecorderState>,
) -> Result<Option<String>, String> {
    let mut recorder = state.0.lock();
    let result = recorder.stop().map_err(|e| e.to_string())?;

    // Send desktop notification on successful save
    if let Some(ref path) = result {
        let filename = path.rsplit(['/', '\\']).next().unwrap_or(path);
        let _ = app
            .notification()
            .builder()
            .title("Recording saved")
            .body(filename)
            .show();
    }

    Ok(result)
}

#[tauri::command]
pub fn get_status(state: State<'_, RecorderState>) -> RecordingStatus {
    let recorder = state.0.lock();
    RecordingStatus {
        is_recording: recorder.is_recording(),
        peak_level: recorder.peak_level(),
    }
}

#[tauri::command]
pub fn get_recordings_dir() -> String {
    let dir = dirs::audio_dir()
        .or_else(dirs::home_dir)
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("DiscRec");
    dir.to_string_lossy().to_string()
}
