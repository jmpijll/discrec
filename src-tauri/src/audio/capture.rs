use anyhow::{Context, Result};
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{SampleFormat, StreamConfig};
use parking_lot::Mutex;
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::mpsc;
use std::sync::Arc;
use std::thread;

use super::encoder::WavWriter;

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

    pub fn start(&mut self, output_path: &str) -> Result<()> {
        if self.is_recording() {
            anyhow::bail!("Already recording");
        }

        let (stop_tx, stop_rx) = mpsc::channel();
        let is_recording = Arc::clone(&self.is_recording);
        let peak_level_bits = Arc::clone(&self.peak_level_bits);
        let path = output_path.to_string();

        let handle = thread::spawn(move || -> Result<Option<String>> {
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

            let spec = hound::WavSpec {
                channels: config.channels(),
                sample_rate: config.sample_rate().0,
                bits_per_sample: 32,
                sample_format: hound::SampleFormat::Float,
            };

            let writer = WavWriter::new(&path, spec)?;
            let writer = Arc::new(Mutex::new(Some(writer)));

            let writer_ref = Arc::clone(&writer);
            let rec_flag = Arc::clone(&is_recording);
            let peak_bits = Arc::clone(&peak_level_bits);
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
                        let peak = data
                            .iter()
                            .fold(0.0f32, |max, &s| max.max((s as f32 / i16::MAX as f32).abs()));
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
                format => anyhow::bail!("Unsupported sample format: {:?}", format),
            }
            .context("Failed to build input stream")?;

            stream.play().context("Failed to start audio stream")?;
            log::info!("Recording started: {}", path);

            // Block until stop signal
            let _ = stop_rx.recv();

            // Drop stream first to stop callbacks
            drop(stream);

            // Finalize the WAV file
            let result = if let Some(w) = writer.lock().take() {
                let p = w.path().to_string();
                w.finalize()?;
                log::info!("Recording saved: {}", p);
                Some(p)
            } else {
                None
            };

            Ok(result)
        });

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
        self.peak_level_bits.store(0f32.to_bits(), Ordering::Relaxed);

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

#[cfg(target_os = "windows")]
fn get_loopback_device(host: &cpal::Host) -> Result<cpal::Device> {
    host.default_output_device()
        .context("No output device available for loopback capture")
}

#[cfg(target_os = "linux")]
fn get_loopback_device(host: &cpal::Host) -> Result<cpal::Device> {
    if let Some(device) = host.input_devices()?.find(|d| {
        d.name()
            .map(|n| n.to_lowercase().contains("monitor"))
            .unwrap_or(false)
    }) {
        return Ok(device);
    }
    host.default_input_device()
        .context("No input device available")
}

#[cfg(target_os = "macos")]
fn get_loopback_device(host: &cpal::Host) -> Result<cpal::Device> {
    if let Some(device) = host.input_devices()?.find(|d| {
        d.name()
            .map(|n| {
                let lower = n.to_lowercase();
                lower.contains("blackhole")
                    || lower.contains("loopback")
                    || lower.contains("soundflower")
            })
            .unwrap_or(false)
    }) {
        return Ok(device);
    }
    host.default_input_device()
        .context("No input device available. Install BlackHole for system audio capture on macOS.")
}
