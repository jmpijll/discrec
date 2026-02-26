use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AudioFormat {
    Wav,
    Flac,
}

impl AudioFormat {
    pub fn extension(&self) -> &str {
        match self {
            AudioFormat::Wav => "wav",
            AudioFormat::Flac => "flac",
        }
    }
}

pub trait AudioEncoder: Send {
    fn write_sample(&mut self, sample: f32) -> Result<()>;
    fn path(&self) -> &str;
    fn finalize(self: Box<Self>) -> Result<()>;
}

fn ensure_parent_dir(path: &str) -> Result<()> {
    if let Some(parent) = PathBuf::from(path).parent() {
        std::fs::create_dir_all(parent).context("Failed to create recording directory")?;
    }
    Ok(())
}

pub fn create_encoder(
    path: &str,
    channels: u16,
    sample_rate: u32,
    format: AudioFormat,
) -> Result<Box<dyn AudioEncoder>> {
    ensure_parent_dir(path)?;
    match format {
        AudioFormat::Wav => {
            let writer = WavWriter::new(path, channels, sample_rate)?;
            Ok(Box::new(writer))
        }
        AudioFormat::Flac => {
            let writer = FlacWriter::new(path, channels, sample_rate)?;
            Ok(Box::new(writer))
        }
    }
}

// --- WAV encoder (streams to disk) ---

struct WavWriter {
    writer: hound::WavWriter<std::io::BufWriter<std::fs::File>>,
    path: String,
}

impl WavWriter {
    fn new(path: &str, channels: u16, sample_rate: u32) -> Result<Self> {
        let spec = hound::WavSpec {
            channels,
            sample_rate,
            bits_per_sample: 32,
            sample_format: hound::SampleFormat::Float,
        };
        let writer = hound::WavWriter::create(path, spec).context("Failed to create WAV file")?;
        Ok(Self {
            writer,
            path: path.to_string(),
        })
    }
}

impl AudioEncoder for WavWriter {
    fn write_sample(&mut self, sample: f32) -> Result<()> {
        self.writer
            .write_sample(sample)
            .context("Failed to write audio sample")
    }

    fn path(&self) -> &str {
        &self.path
    }

    fn finalize(self: Box<Self>) -> Result<()> {
        self.writer
            .finalize()
            .context("Failed to finalize WAV file")
    }
}

// --- FLAC encoder (buffers samples, encodes on finalize) ---

struct FlacWriter {
    path: String,
    channels: u16,
    sample_rate: u32,
    samples: Vec<f32>,
}

impl FlacWriter {
    fn new(path: &str, channels: u16, sample_rate: u32) -> Result<Self> {
        Ok(Self {
            path: path.to_string(),
            channels,
            sample_rate,
            samples: Vec::new(),
        })
    }
}

impl AudioEncoder for FlacWriter {
    fn write_sample(&mut self, sample: f32) -> Result<()> {
        self.samples.push(sample);
        Ok(())
    }

    fn path(&self) -> &str {
        &self.path
    }

    fn finalize(self: Box<Self>) -> Result<()> {
        use flacenc::component::BitRepr;
        use flacenc::error::Verify;

        let bits_per_sample: usize = 24;
        let scale = (1i32 << (bits_per_sample - 1)) - 1;

        let int_samples: Vec<i32> = self
            .samples
            .iter()
            .map(|&s| (s.clamp(-1.0, 1.0) * scale as f32) as i32)
            .collect();

        let config = flacenc::config::Encoder::default()
            .into_verified()
            .map_err(|e| anyhow::anyhow!("FLAC config error: {:?}", e))?;

        let source = flacenc::source::MemSource::from_samples(
            &int_samples,
            self.channels as usize,
            bits_per_sample,
            self.sample_rate as usize,
        );

        let flac_stream = flacenc::encode_with_fixed_block_size(&config, source, config.block_size)
            .map_err(|e| anyhow::anyhow!("FLAC encode failed: {:?}", e))?;

        let mut sink = flacenc::bitsink::ByteSink::new();
        flac_stream
            .write(&mut sink)
            .map_err(|e| anyhow::anyhow!("FLAC write failed: {:?}", e))?;

        std::fs::write(&self.path, sink.as_slice()).context("Failed to write FLAC file")?;

        log::info!(
            "FLAC encoded: {} samples -> {} bytes",
            self.samples.len(),
            sink.as_slice().len()
        );
        Ok(())
    }
}
