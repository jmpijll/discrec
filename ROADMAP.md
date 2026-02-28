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

- [x] Tauri updater integration (auto-update via GitHub releases, signed artifacts)
- [x] Configurable output directory (persisted settings.json, folder picker in settings)
- [x] Silence detection — leading silence gate (skips silence at start of recordings)

### Lessons learned
- Tauri v2 updater requires `tauri-plugin-updater` + `tauri-plugin-process`, signing keys via `tauri signer generate`, and `TAURI_SIGNING_PRIVATE_KEY` as a GitHub Actions secret
- The updater endpoint `https://github.com/user/repo/releases/latest/download/latest.json` works out of the box with `tauri-action` when `createUpdaterArtifacts: true`
- Settings persistence via a simple JSON file in `dirs::config_dir()/DiscRec/settings.json` is the cleanest approach — no database needed
- Leading silence gate (amplitude threshold 0.005) in the capture thread is simple, effective, and format-agnostic

## v1.2.1 — UX Refinements

- [x] Full silence trim — `SilenceTrimEncoder` wrapper trims both leading AND trailing silence at the encoder layer
- [x] Simplified Settings panel (8 cards → 3: Discord Bot, Recording, History + compact footer)
- [x] Close-to-tray — window close hides to system tray instead of quitting; quit via tray menu
- [x] Theme toggle moved to settings header; updates + keyboard shortcuts collapsed into footer

### Lessons learned
- A decorator/wrapper encoder (`SilenceTrimEncoder`) is cleaner than scattering silence gate logic across platform-specific capture code — format-agnostic, single source of truth
- Trailing silence trim uses a buffer that flushes on non-silence and discards on finalize — simple and memory-efficient
- `on_window_event` + `CloseRequested { api.prevent_close() }` + `window.hide()` is the standard Tauri v2 close-to-tray pattern

## v1.3.0 — Polish & Parity

- [ ] Linux: capture only Discord audio via PipeWire per-app filtering (parity with Windows WASAPI per-process capture)
- [ ] Customizable keyboard shortcuts (currently hardcoded Ctrl+R / Ctrl+S)
- [ ] Max recording duration / file size limit (safety against filling disk)
- [ ] Recording notification in Discord (bot sends message when recording starts)

## v2.0.0 — Intelligence

- [ ] Transcription via Whisper (local or API — meeting notes, podcast recap)
- [ ] Recording summary / highlights (auto-detect key moments)
