use anyhow::Result;
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::mpsc;
use std::sync::Arc;
use std::thread;

use super::encoder::{create_encoder, AudioFormat};

enum StreamMsg {
    Stop,
}

pub struct AudioCapture {
    stop_tx: Option<mpsc::Sender<StreamMsg>>,
    thread_handle: Option<thread::JoinHandle<Result<Option<String>>>>,
    is_recording: Arc<AtomicBool>,
    peak_level_bits: Arc<AtomicU32>,
}

// SAFETY: The cpal::Stream lives entirely on the dedicated thread
// and is never moved across threads. Only Send+Sync atomics are shared.
unsafe impl Send for AudioCapture {}
unsafe impl Sync for AudioCapture {}

impl AudioCapture {
    pub fn new() -> Self {
        Self {
            stop_tx: None,
            thread_handle: None,
            is_recording: Arc::new(AtomicBool::new(false)),
            peak_level_bits: Arc::new(AtomicU32::new(0)),
        }
    }

    pub fn is_recording(&self) -> bool {
        self.is_recording.load(Ordering::Relaxed)
    }

    pub fn peak_level(&self) -> f32 {
        f32::from_bits(self.peak_level_bits.load(Ordering::Relaxed))
    }

    pub fn start(&mut self, output_path: &str, format: AudioFormat) -> Result<()> {
        if self.is_recording() {
            anyhow::bail!("Already recording");
        }

        let (stop_tx, stop_rx) = mpsc::channel();
        let is_recording = Arc::clone(&self.is_recording);
        let peak_level_bits = Arc::clone(&self.peak_level_bits);
        let path = output_path.to_string();

        #[cfg(target_os = "windows")]
        let handle = {
            thread::spawn(move || -> Result<Option<String>> {
                capture_windows(&path, format, &is_recording, &peak_level_bits, &stop_rx)
            })
        };

        #[cfg(not(target_os = "windows"))]
        let handle = {
            thread::spawn(move || -> Result<Option<String>> {
                capture_cpal(&path, format, &is_recording, &peak_level_bits, &stop_rx)
            })
        };

        self.is_recording.store(true, Ordering::Relaxed);
        self.stop_tx = Some(stop_tx);
        self.thread_handle = Some(handle);

        Ok(())
    }

    pub fn stop(&mut self) -> Result<Option<String>> {
        if !self.is_recording() {
            return Ok(None);
        }

        self.is_recording.store(false, Ordering::Relaxed);
        self.peak_level_bits
            .store(0f32.to_bits(), Ordering::Relaxed);

        // Signal the recording thread to stop
        if let Some(tx) = self.stop_tx.take() {
            let _ = tx.send(StreamMsg::Stop);
        }

        // Wait for thread to finish and get the file path
        if let Some(handle) = self.thread_handle.take() {
            match handle.join() {
                Ok(result) => return result,
                Err(_) => anyhow::bail!("Recording thread panicked"),
            }
        }

        Ok(None)
    }
}

// ---------------------------------------------------------------------------
// Windows: per-process audio capture via WASAPI (captures only Discord audio)
// ---------------------------------------------------------------------------

#[cfg(target_os = "windows")]
fn find_discord_pid() -> Result<u32> {
    use std::ffi::OsStr;
    use sysinfo::{ProcessRefreshKind, RefreshKind, System};

    let refreshes = RefreshKind::nothing().with_processes(ProcessRefreshKind::everything());
    let system = System::new_with_specifics(refreshes);

    // Discord on Windows runs as Discord.exe; we want the root/parent process
    let discord_names = [
        "Discord.exe",
        "discord.exe",
        "DiscordPTB.exe",
        "DiscordCanary.exe",
    ];

    for name in &discord_names {
        let mut pids: Vec<_> = system.processes_by_name(OsStr::new(name)).collect();
        if !pids.is_empty() {
            // Use the parent PID if available (captures entire process tree)
            pids.sort_by_key(|p| p.pid());
            let process = pids[0];
            let pid = process.parent().unwrap_or(process.pid()).as_u32();
            log::info!(
                "Found {} with PID {} (tree root: {})",
                name,
                process.pid(),
                pid
            );
            return Ok(pid);
        }
    }

    anyhow::bail!("Discord is not running. Please start Discord before recording.")
}

#[cfg(target_os = "windows")]
fn capture_windows(
    path: &str,
    format: AudioFormat,
    is_recording: &Arc<AtomicBool>,
    peak_level_bits: &Arc<AtomicU32>,
    stop_rx: &mpsc::Receiver<StreamMsg>,
) -> Result<Option<String>> {
    use std::collections::VecDeque;
    use wasapi::*;

    let discord_pid = find_discord_pid()?;
    log::info!(
        "Starting per-process capture for Discord PID {}",
        discord_pid
    );

    // Initialize COM for this thread
    let hr = initialize_mta();
    if hr.is_err() {
        anyhow::bail!("COM init failed: {:?}", hr);
    }

    let sample_rate = 48000u32;
    let channels = 2u16;
    let bits_per_sample = 32u32;

    let desired_format = WaveFormat::new(
        bits_per_sample as usize,
        bits_per_sample as usize,
        &SampleType::Float,
        sample_rate as usize,
        channels as usize,
        None,
    );
    let blockalign = desired_format.get_blockalign();

    let mut audio_client = AudioClient::new_application_loopback_client(discord_pid, true)
        .map_err(|e| anyhow::anyhow!("Failed to create loopback client for Discord: {:?}", e))?;

    let mode = StreamMode::EventsShared {
        autoconvert: true,
        buffer_duration_hns: 0,
    };
    audio_client
        .initialize_client(&desired_format, &Direction::Capture, &mode)
        .map_err(|e| anyhow::anyhow!("Failed to init WASAPI client: {:?}", e))?;

    let h_event = audio_client
        .set_get_eventhandle()
        .map_err(|e| anyhow::anyhow!("Failed to get event handle: {:?}", e))?;

    let capture_client = audio_client
        .get_audiocaptureclient()
        .map_err(|e| anyhow::anyhow!("Failed to get capture client: {:?}", e))?;

    let mut encoder = create_encoder(path, channels, sample_rate, format)?;

    audio_client
        .start_stream()
        .map_err(|e| anyhow::anyhow!("Failed to start stream: {:?}", e))?;

    log::info!("WASAPI per-process capture started: {}", path);

    let mut sample_queue: VecDeque<u8> = VecDeque::new();
    let bytes_per_frame = blockalign as usize;

    loop {
        // Check for stop signal (non-blocking)
        if stop_rx.try_recv().is_ok() || !is_recording.load(Ordering::Relaxed) {
            break;
        }

        // Wait for audio data (up to 200ms timeout)
        let _ = h_event.wait_for_event(200);

        // Read available packets
        loop {
            let next = capture_client
                .get_next_packet_size()
                .unwrap_or(Some(0))
                .unwrap_or(0);
            if next == 0 {
                break;
            }
            let additional = (next as usize * bytes_per_frame)
                .saturating_sub(sample_queue.capacity() - sample_queue.len());
            sample_queue.reserve(additional);
            if capture_client
                .read_from_device_to_deque(&mut sample_queue)
                .is_err()
            {
                break;
            }
        }

        // Process buffered samples as f32
        while sample_queue.len() >= 4 {
            let b = [
                sample_queue.pop_front().unwrap(),
                sample_queue.pop_front().unwrap(),
                sample_queue.pop_front().unwrap(),
                sample_queue.pop_front().unwrap(),
            ];
            let sample = f32::from_le_bytes(b);

            // Update peak level (per-sample for responsiveness)
            let current_peak = f32::from_bits(peak_level_bits.load(Ordering::Relaxed));
            let abs_sample = sample.abs();
            if abs_sample > current_peak {
                peak_level_bits.store(abs_sample.to_bits(), Ordering::Relaxed);
            }

            if let Err(e) = encoder.write_sample(sample) {
                log::error!("Failed to write sample: {}", e);
                break;
            }
        }

        // Decay peak level slightly each loop iteration
        let current = f32::from_bits(peak_level_bits.load(Ordering::Relaxed));
        if current > 0.001 {
            peak_level_bits.store((current * 0.95).to_bits(), Ordering::Relaxed);
        }
    }

    // Stop and finalize
    let _ = audio_client.stop_stream();
    let p = encoder.path().to_string();
    encoder.finalize()?;
    log::info!("Recording saved: {}", p);
    Ok(Some(p))
}

// ---------------------------------------------------------------------------
// Linux / macOS: cpal-based loopback capture (system audio)
// ---------------------------------------------------------------------------

#[cfg(not(target_os = "windows"))]
fn capture_cpal(
    path: &str,
    format: AudioFormat,
    is_recording: &Arc<AtomicBool>,
    peak_level_bits: &Arc<AtomicU32>,
    stop_rx: &mpsc::Receiver<StreamMsg>,
) -> Result<Option<String>> {
    use super::encoder::AudioEncoder;
    use anyhow::Context;
    use cpal::traits::{DeviceTrait, StreamTrait};
    use cpal::{SampleFormat, StreamConfig};
    use parking_lot::Mutex;

    let host = cpal::default_host();
    let device = get_loopback_device(&host)?;
    let config = device
        .default_output_config()
        .context("Failed to get default output config")?;

    log::info!(
        "Recording from: {} (format: {:?}, rate: {}, channels: {})",
        device.name().unwrap_or_default(),
        config.sample_format(),
        config.sample_rate().0,
        config.channels()
    );

    let encoder = create_encoder(path, config.channels(), config.sample_rate().0, format)?;
    let encoder: Arc<Mutex<Option<Box<dyn AudioEncoder>>>> = Arc::new(Mutex::new(Some(encoder)));

    let writer_ref = Arc::clone(&encoder);
    let rec_flag = Arc::clone(is_recording);
    let peak_bits = Arc::clone(peak_level_bits);
    let sample_format = config.sample_format();
    let stream_config: StreamConfig = config.into();

    let err_fn = |err: cpal::StreamError| {
        log::error!("Audio stream error: {}", err);
    };

    let stream = match sample_format {
        SampleFormat::F32 => device.build_input_stream(
            &stream_config,
            move |data: &[f32], _: &cpal::InputCallbackInfo| {
                if !rec_flag.load(Ordering::Relaxed) {
                    return;
                }
                let peak = data.iter().fold(0.0f32, |max, &s| max.max(s.abs()));
                peak_bits.store(peak.to_bits(), Ordering::Relaxed);

                if let Some(ref mut w) = *writer_ref.lock() {
                    for &sample in data {
                        if let Err(e) = w.write_sample(sample) {
                            log::error!("Failed to write sample: {}", e);
                            return;
                        }
                    }
                }
            },
            err_fn,
            None,
        ),
        SampleFormat::I16 => device.build_input_stream(
            &stream_config,
            move |data: &[i16], _: &cpal::InputCallbackInfo| {
                if !rec_flag.load(Ordering::Relaxed) {
                    return;
                }
                let peak = data.iter().fold(0.0f32, |max, &s| {
                    max.max((s as f32 / i16::MAX as f32).abs())
                });
                peak_bits.store(peak.to_bits(), Ordering::Relaxed);

                if let Some(ref mut w) = *writer_ref.lock() {
                    for &sample in data {
                        let float_sample = sample as f32 / i16::MAX as f32;
                        if let Err(e) = w.write_sample(float_sample) {
                            log::error!("Failed to write sample: {}", e);
                            return;
                        }
                    }
                }
            },
            err_fn,
            None,
        ),
        fmt => anyhow::bail!("Unsupported sample format: {:?}", fmt),
    }
    .context("Failed to build input stream")?;

    stream.play().context("Failed to start audio stream")?;
    log::info!("Recording started: {}", path);

    // Block until stop signal
    let _ = stop_rx.recv();

    // Drop stream first to stop callbacks
    drop(stream);

    // Finalize the encoded file
    let result = if let Some(w) = encoder.lock().take() {
        let p = w.path().to_string();
        w.finalize()?;
        log::info!("Recording saved: {}", p);
        Some(p)
    } else {
        None
    };

    Ok(result)
}

#[cfg(target_os = "linux")]
fn get_loopback_device(host: &cpal::Host) -> Result<cpal::Device> {
    use anyhow::Context;
    use cpal::traits::{DeviceTrait, HostTrait};

    // Log available input devices for debugging
    if let Ok(devices) = host.input_devices() {
        let names: Vec<String> = devices.filter_map(|d| d.name().ok()).collect();
        log::info!("Available input devices: {:?}", names);
    }

    // PulseAudio/PipeWire monitor sources contain "monitor" in the name
    let monitor_keywords = ["monitor", "Monitor"];
    if let Some(device) = host.input_devices()?.find(|d| {
        d.name()
            .map(|n| monitor_keywords.iter().any(|kw| n.contains(kw)))
            .unwrap_or(false)
    }) {
        log::info!(
            "Found monitor device: {}",
            device.name().unwrap_or_default()
        );
        return Ok(device);
    }

    // Fallback to default input (e.g. microphone)
    log::warn!("No monitor device found, falling back to default input");
    host.default_input_device()
        .context("No input device available. Ensure PulseAudio or PipeWire is running.")
}

#[cfg(target_os = "macos")]
fn get_loopback_device(host: &cpal::Host) -> Result<cpal::Device> {
    use anyhow::Context;
    use cpal::traits::{DeviceTrait, HostTrait};

    // Log available input devices for debugging
    if let Ok(devices) = host.input_devices() {
        let names: Vec<String> = devices.filter_map(|d| d.name().ok()).collect();
        log::info!("Available input devices: {:?}", names);
    }

    // Look for known virtual audio devices used for system audio capture
    let virtual_keywords = [
        "blackhole",
        "loopback",
        "soundflower",
        "virtual",
        "screencapture",
    ];
    if let Some(device) = host.input_devices()?.find(|d| {
        d.name()
            .map(|n| {
                let lower = n.to_lowercase();
                virtual_keywords.iter().any(|kw| lower.contains(kw))
            })
            .unwrap_or(false)
    }) {
        log::info!(
            "Found virtual audio device: {}",
            device.name().unwrap_or_default()
        );
        return Ok(device);
    }

    log::warn!("No virtual audio device found. Install BlackHole (https://existential.audio/blackhole/) for system audio capture.");
    host.default_input_device()
        .context("No input device available. Install BlackHole for system audio capture on macOS.")
}
