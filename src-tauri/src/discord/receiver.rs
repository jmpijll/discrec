use anyhow::Result;
use parking_lot::Mutex;
use serenity::async_trait;
use songbird::{Event, EventContext, EventHandler as VoiceEventHandler};
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::Arc;

use crate::audio::encoder::{create_encoder, AudioEncoder, AudioFormat};

/// Shared state between all VoiceHandler clones registered with songbird.
pub struct ReceiverState {
    ssrc_map: Mutex<HashMap<u32, u64>>,
    encoders: Mutex<HashMap<u32, Box<dyn AudioEncoder>>>,
    output_dir: String,
    format: AudioFormat,
    sample_rate: u32,
    channels: u16,
    pub is_recording: Arc<AtomicBool>,
    pub peak_level_bits: Arc<AtomicU32>,
}

impl ReceiverState {
    pub fn new(
        output_dir: &str,
        format: AudioFormat,
        is_recording: Arc<AtomicBool>,
        peak_level_bits: Arc<AtomicU32>,
    ) -> Arc<Self> {
        Arc::new(Self {
            ssrc_map: Mutex::new(HashMap::new()),
            encoders: Mutex::new(HashMap::new()),
            output_dir: output_dir.to_string(),
            format,
            sample_rate: 48000,
            channels: 1, // mono per speaker
            is_recording,
            peak_level_bits,
        })
    }

    /// Finalize all per-speaker encoders and return saved file paths.
    pub fn finalize_all(&self) -> Result<Vec<String>> {
        let mut encoders = self.encoders.lock();
        let ssrc_map = self.ssrc_map.lock();
        let mut paths = Vec::new();

        for (ssrc, encoder) in encoders.drain() {
            let path = encoder.path().to_string();
            log::info!(
                "Finalizing speaker {} (user {:?}): {}",
                ssrc,
                ssrc_map.get(&ssrc),
                path
            );
            encoder.finalize()?;
            paths.push(path);
        }

        Ok(paths)
    }

    fn get_or_create_encoder(&self, ssrc: u32) -> Result<()> {
        let mut encoders = self.encoders.lock();
        if encoders.contains_key(&ssrc) {
            return Ok(());
        }

        let ssrc_map = self.ssrc_map.lock();
        let label = if let Some(user_id) = ssrc_map.get(&ssrc) {
            format!("user-{}", user_id)
        } else {
            format!("ssrc-{}", ssrc)
        };
        drop(ssrc_map);

        let timestamp = chrono::Local::now().format("%Y-%m-%d_%H%M%S");
        let filename = format!(
            "discord-{}-{}.{}",
            timestamp,
            label,
            self.format.extension()
        );
        let path = std::path::Path::new(&self.output_dir)
            .join(&filename)
            .to_string_lossy()
            .to_string();

        let encoder = create_encoder(&path, self.channels, self.sample_rate, self.format)?;
        log::info!("Created encoder for speaker {} -> {}", ssrc, path);
        encoders.insert(ssrc, encoder);
        Ok(())
    }
}

/// Songbird event handler — wraps shared state via Arc so it can be cloned
/// and registered for multiple event types.
pub struct VoiceHandler(pub Arc<ReceiverState>);

impl VoiceHandler {
    pub fn new(state: Arc<ReceiverState>) -> Self {
        Self(state)
    }
}

#[async_trait]
impl VoiceEventHandler for VoiceHandler {
    async fn act(&self, ctx: &EventContext<'_>) -> Option<Event> {
        let state = &self.0;

        match ctx {
            EventContext::SpeakingStateUpdate(speaking) => {
                if let Some(user_id) = speaking.user_id {
                    let mut map = state.ssrc_map.lock();
                    map.insert(speaking.ssrc, user_id.0);
                    log::info!(
                        "Speaker mapping: SSRC {} -> user {}",
                        speaking.ssrc,
                        user_id.0
                    );
                }
            }
            EventContext::VoiceTick(tick) => {
                if !state.is_recording.load(Ordering::Relaxed) {
                    return None;
                }

                let mut global_peak: f32 = 0.0;

                for (&ssrc, voice_data) in &tick.speaking {
                    if let Some(ref audio) = voice_data.decoded_voice {
                        // Track peak level across all speakers
                        let peak = audio
                            .iter()
                            .fold(0.0f32, |max, &s| max.max((s as f32).abs()));
                        let norm_peak = peak / i16::MAX as f32;
                        if norm_peak > global_peak {
                            global_peak = norm_peak;
                        }

                        // Ensure we have an encoder for this speaker
                        if let Err(e) = state.get_or_create_encoder(ssrc) {
                            log::error!("Failed to create encoder for SSRC {}: {}", ssrc, e);
                            continue;
                        }

                        // Write samples
                        let mut encoders = state.encoders.lock();
                        if let Some(encoder) = encoders.get_mut(&ssrc) {
                            for &sample in audio.iter() {
                                let float_sample = sample as f32 / i16::MAX as f32;
                                if let Err(e) = encoder.write_sample(float_sample) {
                                    log::error!("Failed to write sample: {}", e);
                                    break;
                                }
                            }
                        }
                    }
                }

                state
                    .peak_level_bits
                    .store(global_peak.to_bits(), Ordering::Relaxed);
            }
            _ => {}
        }
        None
    }
}
