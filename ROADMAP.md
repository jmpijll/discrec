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
- [ ] First successful cross-platform build

## v0.2.0 — Polish

- [ ] Live audio level meter visualization
- [ ] Linux audio capture (PulseAudio/PipeWire monitor)
- [ ] macOS audio capture (ScreenCaptureKit / BlackHole detection)
- [ ] FLAC encoding (smaller lossless files)
- [ ] System tray with record/stop
- [ ] Notification on recording complete

## v1.0.0 — Discord Integration

- [ ] Discord Bot connection (serenity + songbird)
- [ ] Per-speaker audio recording (separate tracks)
- [ ] Channel selector in UI
- [ ] Secure token storage (OS keychain)

## v1.1.0 — Extras

- [ ] Auto-record on voice channel join
- [ ] Export to MP3 / OGG
- [ ] Tauri updater integration
- [ ] Recording history view
