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

## v1.0.1 — Windows Per-Process Capture

- [x] Fix: capture only Discord audio, not all system audio (Windows)
- [x] WASAPI per-process loopback via `wasapi` crate + `sysinfo` for PID detection
- [x] Auto-detect Discord.exe / DiscordPTB.exe / DiscordCanary.exe
- [x] Move Discord bot integration into Settings panel (clean main UI)
- [x] Increase record button / audio meter spacing (pulsation overlap fix)

### Lessons learned
- `cpal` does not support per-process audio capture on Windows; the `wasapi` crate provides `AudioClient::new_application_loopback_client` (Win10 20348+)
- Platform-specific code paths must be fully self-contained with their own imports to avoid unused-import warnings on other platforms
- Keeping the main UI minimal (just record button + meter) is the right UX — settings are rarely accessed

## v1.0.2 — Settings Polish

- [x] Redesign Settings panel with card-based layout (icons, descriptions, visual hierarchy)
- [x] Polished Discord panel: status indicators, chevron dropdowns, ready state
- [x] Improved format selector with inline descriptions
- [x] Consistent styling across all components

## v1.1.0 — Quality of Life

- [x] MP3 encoding via `mp3lame-encoder` crate (192 kbps, best quality)
- [x] Keyboard shortcuts: Ctrl+R to record, Ctrl+S / Escape to stop
- [x] Recording history view (browse, open folder, delete — inside settings)
- [x] Auto-record on voice channel join/leave (polls member count every 5s)
- [x] Dark/light theme toggle (persisted to localStorage)
- [x] Keyboard shortcuts reference card in settings

### Lessons learned
- `mp3lame-encoder` builds LAME from source via `mp3lame-sys` — works cross-platform without extra system deps (just needs a C compiler + cmake)
- OGG Vorbis (`vorbis_encoder`) requires system-installed `libvorbis-dev` — deferred to avoid CI complexity
- Polling-based auto-record (5s interval via `discord_get_channel_members`) is simpler and more reliable than event-based approach for v1
- CSS custom properties + `data-theme` attribute is the cleanest way to implement theme switching with TailwindCSS v4

## v1.2.0 — Advanced Features

- [ ] OGG Vorbis export (requires bundling libvorbis or finding pure-Rust encoder)
- [ ] Tauri updater integration (auto-update on new release)
- [ ] Audio source selector (choose which app to capture, not just Discord)
- [ ] Linux per-app capture (PipeWire filter nodes)
- [ ] Real-time audio waveform / spectrogram view
- [ ] Silence detection (auto-trim silence from recordings)
- [ ] Split recording by speaker (label tracks with Discord usernames)
- [ ] Configurable output directory

## v2.0.0 — Cloud & Sharing

- [ ] Cloud upload integration (Google Drive, Dropbox, S3)
- [ ] Shareable recording links
- [ ] Transcription via Whisper (local or API)
- [ ] Multi-language UI
- [ ] Plugin system for custom audio processors
