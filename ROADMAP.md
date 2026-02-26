# Roadmap

## v0.1.0 — MVP

- [x] Tauri v2 project scaffold (Rust + React + TailwindCSS)
- [x] Dark theme UI with record / stop / done flow
- [x] System audio loopback capture (Windows via WASAPI)
- [x] WAV recording to `~/Music/DiscRec/` (or equivalent)
- [x] Auto-naming: `discord-YYYY-MM-DD_HHmmss.wav`
- [x] GitHub Actions CI (lint + clippy + test)
- [x] GitHub Actions release workflow (multi-OS builds)
- [x] README, CONTRIBUTING, issue templates
- [x] First successful cross-platform build

## v0.2.0 — Polish

- [x] Live audio level meter visualization (smooth decay, peak hold, glow)
- [x] Linux audio capture (PulseAudio/PipeWire monitor detection)
- [x] macOS audio capture (BlackHole / virtual device detection)
- [x] FLAC encoding (smaller lossless files via `flacenc`)
- [x] System tray with record/stop/quit
- [x] Notification on recording complete
- [x] Format selector (WAV / FLAC)

## v1.0.0 — Discord Integration

- [x] Landscape layout + optimized window size
- [x] Settings menu (gear icon) with format selector + version
- [x] Fix open-in-folder button
- [x] Discord Bot connection (serenity + songbird)
- [x] Per-speaker audio recording (separate tracks)
- [x] Channel selector in UI
- [x] Secure token storage (OS keychain)

## v1.1.0 — Extras

- [ ] Auto-record on voice channel join
- [ ] Export to MP3 / OGG
- [ ] Tauri updater integration
- [ ] Recording history view
