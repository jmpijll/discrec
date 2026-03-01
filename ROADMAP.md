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

- [x] Linux: capture only Discord audio via PulseAudio/PipeWire per-app routing (null sink + loopback + move-sink-input)
- [x] Customizable keyboard shortcuts (key capture UI, persisted, supports ctrl/shift/alt combos)
- [x] Max recording duration (5m/15m/30m/1h/2h/unlimited — auto-stops capture loop)
- [x] Recording notification in Discord (bot sends "🔴 Recording started" to voice channel text chat)

### Lessons learned
- PulseAudio per-app capture uses `pactl load-module module-null-sink` + `module-loopback` + `move-sink-input` — works on both PulseAudio and PipeWire (via PulseAudio compat). `Drop` trait ensures cleanup even on panic
- `recv_timeout(1s)` in the cpal capture loop is cleaner than busy-polling for max duration checks
- Key capture UI: listen for next `keydown`, build combo string from modifier flags + key, save via Tauri command. Escape cancels capture
- Discord voice channels have built-in text chat (since 2022) — `channel_id.say()` works directly without finding a separate text channel

## v2.0.0 — UX & Layout

- [x] Fix system tray icon invisible on Windows (missing `.icon()` on `TrayIconBuilder`)
- [x] Fix updater "blocked by ACL" — added `updater:default` + `process:allow-restart` to capabilities
- [x] Settings panel redesign — section-based layout with `Toggle`/`SettingRow`/`Section` components, proper spacing
- [x] Improved overall layout and visual hierarchy (larger text, rounded-xl corners, consistent spacing)
- [x] Minimalist modern styling pass across all views (CompletedView, FormatSelector, DiscordPanel, RecordingHistory, AudioMeter, StatusBar, RecordButton)
- [x] Custom scrollbar styling (thin, theme-aware)
- [x] Version bump to 2.0.0

### Lessons learned
- Tauri v2 ACL: `updater:default` and `process:allow-restart` must be in `capabilities/default.json` — plugins registered in Rust won’t work without frontend permissions
- `TrayIconBuilder::icon()` must be called explicitly; without it the tray entry exists but renders invisible on Windows
- Extracting reusable `Toggle`, `SettingRow`, `Section` components keeps settings panels maintainable as features grow
- A consistent sizing system (13px body text, 11px labels, rounded-xl containers, 3-4px gaps) creates visual calm without sacrificing density
## v2.1.0 — Quality & Performance

- [ ] Window position & size persistence (remember where user resized the app)
- [ ] Configurable window size (currently fixed 680×400 — some users may want smaller/larger)
- [ ] Recording pause/resume (currently only start/stop; pause is useful for live events)
- [ ] Batch delete in recording history (select multiple + delete all)
- [ ] Search/filter in recording history (by filename or date range)
- [ ] Import recordings from folder (index external files without moving them)
- [ ] Component-level test suite (vitest + @testing-library, focus on core UI logic)

### Benefits
- Better UX for laptops with smaller screens (1366×768, Chromebooks)
- Cleaner recording management for heavy users (100+ recordings)
- Pause/resume is critical for meetings with long quiet periods — saves disk space

## v2.2.0 — Integration

- [ ] Cloud upload helpers (Cloudinary, AWS S3 one-click; templates only, no keys stored)
- [ ] Discord webhook integration (post recording to a private channel automatically)
- [ ] Filename templating (patterns like `${GUILD}-${CHANNEL}-${DATE}.${EXT}`)
- [ ] Automatic file compression on save (background LAME quality reduction post-recording)

## Future — Refactoring & Architecture

### Module extraction
- [ ] Audio capture logic into separate library (`discrec-audio`)
- [ ] Discord bot as optional, de-coupled module (users who only need system audio don't load it)
- [ ] Settings into schema-driven layer with migration support (prepare for config format changes)

### Testing & CI
- [ ] E2E test framework (headless Tauri app testing)
- [ ] Cross-platform screenshot testing (verify UI doesn't drift)
- [ ] Audio quality validation (automated checks for distortion, clipping in test recordings)

### Developer experience
- [ ] Component Storybook (showcase UI in isolation for designers/contributors)
- [ ] Architecture documentation (audio pipeline, Discord integration, settings flow)
- [ ] Contributing guide expansion (code style, git workflow, how to add a new setting)