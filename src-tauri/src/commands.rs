use crate::audio::capture::AudioCapture;
use crate::audio::encoder::AudioFormat;
use crate::discord::bot::{DiscordBot, GuildInfo, VoiceChannelInfo};
use chrono::Local;
use parking_lot::Mutex;
use serde::Serialize;
use std::path::Path;
use tauri::{AppHandle, State};
use tauri_plugin_notification::NotificationExt;
use tokio::sync::Mutex as TokioMutex;

pub struct RecorderState(pub Mutex<AudioCapture>);
pub struct DiscordState(pub TokioMutex<DiscordBot>);

#[derive(Serialize, Clone)]
pub struct RecordingStatus {
    pub is_recording: bool,
    pub peak_level: f32,
}

#[derive(Serialize, Clone)]
pub struct DiscordStatus {
    pub connected: bool,
    pub recording: bool,
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

#[tauri::command]
pub fn open_folder(path: String) -> Result<(), String> {
    let file_path = std::path::Path::new(&path);
    let folder = file_path.parent().unwrap_or(file_path);

    if !folder.exists() {
        return Err(format!("Folder does not exist: {}", folder.display()));
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(folder.as_os_str())
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(folder.as_os_str())
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(folder.as_os_str())
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }

    Ok(())
}

// --- Recording history commands ---

#[derive(Serialize, Clone)]
pub struct RecordingInfo {
    pub path: String,
    pub filename: String,
    pub size: u64,
    pub modified: String,
    pub format: String,
}

#[tauri::command]
pub fn list_recordings() -> Result<Vec<RecordingInfo>, String> {
    let dir = dirs::audio_dir()
        .or_else(dirs::home_dir)
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("DiscRec");

    if !dir.exists() {
        return Ok(Vec::new());
    }

    let mut recordings = Vec::new();
    let entries = std::fs::read_dir(&dir).map_err(|e| e.to_string())?;

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }

        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();

        if !matches!(ext.as_str(), "wav" | "flac" | "mp3") {
            continue;
        }

        let metadata = std::fs::metadata(&path).map_err(|e| e.to_string())?;
        let modified = metadata
            .modified()
            .ok()
            .map(|t| {
                let dt: chrono::DateTime<chrono::Local> = t.into();
                dt.format("%Y-%m-%d %H:%M:%S").to_string()
            })
            .unwrap_or_default();

        recordings.push(RecordingInfo {
            path: path.to_string_lossy().to_string(),
            filename: path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string(),
            size: metadata.len(),
            modified,
            format: ext,
        });
    }

    // Sort newest first
    recordings.sort_by(|a, b| b.modified.cmp(&a.modified));
    Ok(recordings)
}

#[tauri::command]
pub fn delete_recording(path: String) -> Result<(), String> {
    let file_path = Path::new(&path);

    // Security: ensure the file is inside the DiscRec directory
    let recordings_dir = dirs::audio_dir()
        .or_else(dirs::home_dir)
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("DiscRec");

    let canonical_file = file_path
        .canonicalize()
        .map_err(|e| format!("Invalid path: {}", e))?;
    let canonical_dir = recordings_dir
        .canonicalize()
        .map_err(|e| format!("Recordings dir not found: {}", e))?;

    if !canonical_file.starts_with(&canonical_dir) {
        return Err("Cannot delete files outside the recordings directory".to_string());
    }

    std::fs::remove_file(file_path).map_err(|e| format!("Failed to delete: {}", e))
}

// --- Discord bot commands ---

fn recordings_dir() -> String {
    dirs::audio_dir()
        .or_else(dirs::home_dir)
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("DiscRec")
        .to_string_lossy()
        .to_string()
}

#[tauri::command]
pub async fn discord_connect(state: State<'_, DiscordState>, token: String) -> Result<(), String> {
    let mut bot = state.0.lock().await;
    bot.connect(&token).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn discord_disconnect(state: State<'_, DiscordState>) -> Result<(), String> {
    let mut bot = state.0.lock().await;
    bot.disconnect().await;
    Ok(())
}

#[tauri::command]
pub async fn discord_list_guilds(state: State<'_, DiscordState>) -> Result<Vec<GuildInfo>, String> {
    let bot = state.0.lock().await;
    bot.list_guilds().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn discord_list_channels(
    state: State<'_, DiscordState>,
    guild_id: String,
) -> Result<Vec<VoiceChannelInfo>, String> {
    let id: u64 = guild_id.parse().map_err(|_| "Invalid guild ID")?;
    let bot = state.0.lock().await;
    bot.list_voice_channels(id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn discord_start_recording(
    state: State<'_, DiscordState>,
    guild_id: String,
    channel_id: String,
    format: Option<AudioFormat>,
) -> Result<(), String> {
    let gid: u64 = guild_id.parse().map_err(|_| "Invalid guild ID")?;
    let cid: u64 = channel_id.parse().map_err(|_| "Invalid channel ID")?;
    let fmt = format.unwrap_or(AudioFormat::Wav);
    let output_dir = recordings_dir();

    let bot = state.0.lock().await;
    bot.start_recording(gid, cid, &output_dir, fmt)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn discord_stop_recording(
    app: AppHandle,
    state: State<'_, DiscordState>,
) -> Result<Vec<String>, String> {
    let bot = state.0.lock().await;
    let paths = bot.stop_recording().await.map_err(|e| e.to_string())?;

    if !paths.is_empty() {
        let count = paths.len();
        let _ = app
            .notification()
            .builder()
            .title("Recording saved")
            .body(format!("{} speaker track(s) saved", count))
            .show();
    }

    Ok(paths)
}

#[tauri::command]
pub async fn discord_get_status(state: State<'_, DiscordState>) -> Result<DiscordStatus, String> {
    let bot = state.0.lock().await;
    Ok(DiscordStatus {
        connected: bot.is_connected(),
        recording: bot.is_recording(),
        peak_level: bot.peak_level(),
    })
}

#[tauri::command]
pub async fn discord_get_channel_members(
    state: State<'_, DiscordState>,
    guild_id: String,
    channel_id: String,
) -> Result<usize, String> {
    let gid: u64 = guild_id.parse().map_err(|_| "Invalid guild ID")?;
    let cid: u64 = channel_id.parse().map_err(|_| "Invalid channel ID")?;
    let bot = state.0.lock().await;
    bot.get_channel_member_count(gid, cid)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_bot_token(token: String) -> Result<(), String> {
    crate::discord::bot::save_token(&token).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn load_bot_token() -> Result<Option<String>, String> {
    crate::discord::bot::load_token().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_bot_token() -> Result<(), String> {
    crate::discord::bot::delete_token().map_err(|e| e.to_string())
}
