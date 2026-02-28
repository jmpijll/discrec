<div align="center">

# DiscRec

**Beautiful, minimal Discord audio recorder.**

[![CI](https://github.com/jmpijll/discrec/actions/workflows/ci.yml/badge.svg)](https://github.com/jmpijll/discrec/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

</div>

---

DiscRec captures Discord audio with a single click. No configuration, no bloat — just press record.

Built with [Tauri v2](https://tauri.app) (Rust) and React. Cross-platform: Windows, macOS, and Linux.

## Features

- **One-click recording** — press record to capture Discord audio instantly
- **Multiple formats** — WAV (lossless), FLAC (lossless compressed), MP3 (192 kbps)
- **Discord bot integration** — connect a bot to record per-speaker audio tracks with Discord usernames
- **Auto-record** — automatically start recording when someone joins a voice channel
- **Per-process capture** — records only Discord audio, not your entire system (Windows)
- **Silence trim** — automatically skips leading silence in recordings
- **Auto-updater** — get notified and install updates directly from the app
- **Configurable output directory** — choose where recordings are saved
- **Keyboard shortcuts** — Ctrl+R to record, Ctrl+S or Escape to stop
- **Dark / light theme** — switch in settings, persisted across sessions
- **Live audio meter** — real-time level visualization with smooth decay and peak hold
- **Recording history** — browse, open folder, or delete past recordings from settings
- **System tray** — record, stop, and quit from the tray icon

## Install

Download the latest release for your platform from the [Releases](https://github.com/jmpijll/discrec/releases) page. DiscRec will notify you when updates are available.

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

DiscRec uses OS-level audio capture to record what Discord outputs:

- **Windows** — WASAPI per-process loopback (captures only Discord, not system audio)
- **Linux** — PulseAudio / PipeWire monitor source
- **macOS** — Virtual audio device (BlackHole)

Recordings are saved to `~/Music/DiscRec/` by default (configurable in settings).

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Roadmap

See [ROADMAP.md](ROADMAP.md) for what's planned.

## License

[MIT](LICENSE)
