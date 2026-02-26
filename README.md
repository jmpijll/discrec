<div align="center">

# DiscRec

**Beautiful, minimal Discord audio recorder.**

[![CI](https://github.com/jmpijll/discrec/actions/workflows/ci.yml/badge.svg)](https://github.com/jmpijll/discrec/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

</div>

---

DiscRec captures Discord audio output with a single click. No configuration, no bloat — just press record and get a lossless WAV file.

Built with [Tauri v2](https://tauri.app) (Rust) and React. Cross-platform: Windows, macOS, and Linux.

## Install

Download the latest release for your platform from the [Releases](https://github.com/jmpijll/discrec/releases) page.

| Platform | Format |
|----------|--------|
| Windows | `.msi` / `.exe` |
| macOS | `.dmg` |
| Linux | `.AppImage` / `.deb` |

> **macOS note:** System audio capture requires [BlackHole](https://existential.audio/blackhole/) or a similar virtual audio device.

## Build from source

### Prerequisites

- [Rust](https://rustup.rs/) (stable)
- [Node.js](https://nodejs.org/) (LTS)
- [pnpm](https://pnpm.io/)
- Platform dependencies — see [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)

```bash
git clone https://github.com/jmpijll/discrec.git
cd discrec
pnpm install
pnpm tauri:dev    # development
pnpm tauri:build  # production build
```

## How it works

DiscRec uses OS-level audio loopback capture to record what Discord outputs to your speakers:

- **Windows** — WASAPI loopback capture
- **Linux** — PulseAudio / PipeWire monitor source
- **macOS** — Virtual audio device (BlackHole)

Recordings are saved as lossless WAV files to your system's audio/music directory under `DiscRec/`.

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Roadmap

See [ROADMAP.md](ROADMAP.md) for what's planned.

## License

[MIT](LICENSE)
