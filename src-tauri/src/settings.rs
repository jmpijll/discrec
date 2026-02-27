use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct AppSettings {
    #[serde(default)]
    pub output_dir: Option<String>,
    #[serde(default)]
    pub silence_trim: bool,
}

pub struct SettingsState(pub Mutex<AppSettings>);

impl SettingsState {
    pub fn load() -> Self {
        let settings = Self::read_from_disk().unwrap_or_default();
        Self(Mutex::new(settings))
    }

    fn config_path() -> PathBuf {
        dirs::config_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("DiscRec")
            .join("settings.json")
    }

    fn read_from_disk() -> Option<AppSettings> {
        let path = Self::config_path();
        let data = std::fs::read_to_string(path).ok()?;
        serde_json::from_str(&data).ok()
    }

    pub fn save(&self) {
        let path = Self::config_path();
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let settings = self.0.lock();
        let _ = std::fs::write(
            path,
            serde_json::to_string_pretty(&*settings).unwrap_or_default(),
        );
    }
}

/// Returns the effective recordings directory — custom if set, otherwise default.
pub fn recordings_dir(settings: &SettingsState) -> PathBuf {
    let s = settings.0.lock();
    if let Some(ref custom) = s.output_dir {
        let p = PathBuf::from(custom);
        if !custom.is_empty() && (p.exists() || std::fs::create_dir_all(&p).is_ok()) {
            return p;
        }
    }
    default_recordings_dir()
}

pub fn default_recordings_dir() -> PathBuf {
    dirs::audio_dir()
        .or_else(dirs::home_dir)
        .unwrap_or_else(|| PathBuf::from("."))
        .join("DiscRec")
}
