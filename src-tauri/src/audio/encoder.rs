use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AudioFormat {
    Wav,
    Flac,
    Mp3,
}

impl AudioFormat {
    pub fn extension(&self) -> &str {
        match self {
            AudioFormat::Wav => "wav",
            AudioFormat::Flac => "flac",
            AudioFormat::Mp3 => "mp3",
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
        AudioFormat::Mp3 => {
            let writer = Mp3Writer::new(path, channels, sample_rate)?;
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

// --- MP3 encoder (buffers samples, encodes on finalize via LAME) ---

struct Mp3Writer {
    path: String,
    channels: u16,
    sample_rate: u32,
    samples: Vec<f32>,
}

impl Mp3Writer {
    fn new(path: &str, channels: u16, sample_rate: u32) -> Result<Self> {
        Ok(Self {
            path: path.to_string(),
            channels,
            sample_rate,
            samples: Vec::new(),
        })
    }
}

impl AudioEncoder for Mp3Writer {
    fn write_sample(&mut self, sample: f32) -> Result<()> {
        self.samples.push(sample);
        Ok(())
    }

    fn path(&self) -> &str {
        &self.path
    }

    fn finalize(self: Box<Self>) -> Result<()> {
        use mp3lame_encoder::{Builder, FlushNoGap, InterleavedPcm};

        let mut builder =
            Builder::new().ok_or_else(|| anyhow::anyhow!("Failed to create MP3 encoder"))?;

        builder
            .set_sample_rate(self.sample_rate)
            .map_err(|e| anyhow::anyhow!("MP3: failed to set sample rate: {:?}", e))?;
        builder
            .set_num_channels(self.channels as u8)
            .map_err(|e| anyhow::anyhow!("MP3: failed to set channels: {:?}", e))?;
        builder
            .set_brate(mp3lame_encoder::Bitrate::Kbps192)
            .map_err(|e| anyhow::anyhow!("MP3: failed to set bitrate: {:?}", e))?;
        builder
            .set_quality(mp3lame_encoder::Quality::Best)
            .map_err(|e| anyhow::anyhow!("MP3: failed to set quality: {:?}", e))?;

        let mut encoder = builder
            .build()
            .map_err(|e| anyhow::anyhow!("MP3: failed to build encoder: {:?}", e))?;

        // Convert f32 samples to i16 for LAME
        let int_samples: Vec<i16> = self
            .samples
            .iter()
            .map(|&s| (s.clamp(-1.0, 1.0) * i16::MAX as f32) as i16)
            .collect();

        let input = InterleavedPcm(&int_samples);
        let mut mp3_buffer =
            Vec::with_capacity(mp3lame_encoder::max_required_buffer_size(int_samples.len()));

        let encoded_size = encoder
            .encode(input, mp3_buffer.spare_capacity_mut())
            .map_err(|e| anyhow::anyhow!("MP3 encode failed: {:?}", e))?;
        unsafe {
            mp3_buffer.set_len(mp3_buffer.len().wrapping_add(encoded_size));
        }

        let flush_size = encoder
            .flush::<FlushNoGap>(mp3_buffer.spare_capacity_mut())
            .map_err(|e| anyhow::anyhow!("MP3 flush failed: {:?}", e))?;
        unsafe {
            mp3_buffer.set_len(mp3_buffer.len().wrapping_add(flush_size));
        }

        std::fs::write(&self.path, &mp3_buffer).context("Failed to write MP3 file")?;

        log::info!(
            "MP3 encoded: {} samples -> {} bytes",
            self.samples.len(),
            mp3_buffer.len()
        );
        Ok(())
    }
}
