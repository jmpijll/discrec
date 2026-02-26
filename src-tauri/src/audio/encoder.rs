use anyhow::{Context, Result};
use hound;
use std::path::PathBuf;

pub struct WavWriter {
    writer: hound::WavWriter<std::io::BufWriter<std::fs::File>>,
    path: String,
}

impl WavWriter {
    pub fn new(path: &str, spec: hound::WavSpec) -> Result<Self> {
        // Ensure parent directory exists
        if let Some(parent) = PathBuf::from(path).parent() {
            std::fs::create_dir_all(parent).context("Failed to create recording directory")?;
        }

        let writer = hound::WavWriter::create(path, spec).context("Failed to create WAV file")?;

        Ok(Self {
            writer,
            path: path.to_string(),
        })
    }

    pub fn write_sample(&mut self, sample: f32) -> Result<()> {
        self.writer
            .write_sample(sample)
            .context("Failed to write audio sample")?;
        Ok(())
    }

    pub fn path(&self) -> &str {
        &self.path
    }

    pub fn finalize(self) -> Result<()> {
        self.writer
            .finalize()
            .context("Failed to finalize WAV file")?;
        Ok(())
    }
}
