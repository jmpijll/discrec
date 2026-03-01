# DiscRec AI Agent Guidelines

<!-- This file guides AI agents contributing to DiscRec. See CONTRIBUTING.md for human contributors. -->

## Code Style

### React (TypeScript + Vite)

- **Functional components with hooks only** — no classes. See [src/components/AudioMeter.tsx](../../src/components/AudioMeter.tsx) for patterns.
- **Extract reusable pieces** — toggle logic → `Toggle` component, setting rows → `SettingRow`, sections → `Section` (see [SettingsPanel.tsx](../../src/components/SettingsPanel.tsx) for examples).
- **Naming:** PascalCase for components/files (`AudioMeter.tsx`), camelCase for hooks/utilities.
- **Styling:** Tailwind-first (v4), custom CSS only in `src/index.css` for theme variables. Use `clsx()`/`cn()` for conditional classes (see [src/lib/utils.ts](../../src/lib/utils.ts)).
- **Types:** Strict TypeScript (`noUnusedLocals`, `noUnusedParameters` enabled). Define interfaces above components.
- **Tauri IPC:** Use `invoke()` from `@tauri-apps/api/core`; always wrap in try-catch. See [useRecorder.ts](../../src/hooks/useRecorder.ts) for polling patterns.

### Rust (Tauri v2)

- **Format with `cargo fmt`** — enforced in CI.
- **Lint with `cargo clippy --all-targets -- -D warnings`** — no warnings allowed.
- **State management:** Use `parking_lot::Mutex` (not `std::sync::Mutex`) for sync contexts, `tokio::sync::Mutex` for async. See [commands.rs](../../src-tauri/src/commands.rs) for `RecorderState` / `DiscordState` patterns.
- **Tauri commands:** `#[tauri::command]` functions return `Result<T, String>`. Errors are JSON serialized to frontend.
- **Platform code:** Wrap in `#[cfg(target_os = "...")]` — see [audio/capture.rs](../../src-tauri/src/audio/mod.rs) for Windows/Linux/macOS splits.
- **Module structure:** `mod.rs` for public API, separate files for implementation detail.

### CSS & Styling

- **TailwindCSS v4 only** — no custom CSS except theme variables in `:root` and `[data-theme="light"]` (in [src/index.css](../../src/index.css)).
- **Sizing system:** 13px for body text, 11px for labels, rounded-xl for containers, 3-4px gaps.
- **Colors:** `text-text-primary`, `bg-bg-card`, `border-border` (custom theme vars, see [index.css](../../src/index.css) for full list).

## Architecture

### Frontend (`src/`)

```
src/
├── App.tsx              # Main UI, state orchestration (record/stop, theme, settings overlay)
├── components/          # UI components (20+ files)
│   ├── RecordButton.tsx # Record/stop button, pulsing glow
│   ├── AudioMeter.tsx   # Live audio level bars
│   ├── SettingsPanel.tsx # Section-based settings UI with reusable Toggle/SettingRow/Section
│   └── ...              # Other UI components
├── hooks/               # Custom hooks
│   ├── useRecorder.ts   # Local recording state machine
│   ├── useDiscord.ts    # Discord bot connection state
│   ├── useUpdater.ts    # Tauri updater plugin wrapper
│   └── useKeyboardShortcuts.ts # Keyboard event listener
├── lib/utils.ts         # cn(), formatDuration()
└── index.css            # Tailwind imports + custom theme
```

### Backend (`src-tauri/src/`)

```
src-tauri/
├── main.rs              # Windows subsystem, delegates to lib.rs
├── lib.rs               # Tauri setup, system tray, plugin init, IPC handlers
├── commands.rs          # All Tauri commands (start_recording, discord_connect, etc.)
├── settings.rs          # Settings persistence (~/.config/DiscRec/settings.json)
├── audio/
│   ├── mod.rs           # Public API
│   ├── capture.rs       # Platform-specific: Windows WASAPI, Linux PulseAudio, macOS BlackHole
│   └── encoder.rs       # WAV/FLAC/MP3 encoding
└── discord/
    ├── bot.rs           # Serenity + Songbird, per-speaker track receiver
    ├── receiver.rs      # Voice frame receiver, saves to encoder
    └── mod.rs           # Public API
```

### Key Data Flows

1. **Start recording** → `App.tsx` calls `invoke("start_recording", {format})` → `commands.rs` → `RecorderState::start()` → `audio::capture` starts capture loop → returns path string
2. **Discord mode** → `useDiscord` hook calls `invoke("discord_connect", {token})` → `DiscordState` → Serenity client connects → `discord::bot` listens for voice users → `songbird::receive` streams PCM → encoder writes tracks
3. **Settings save** → UI calls `invoke("set_output_dir", {path})` → `settings.rs` writes JSON → returns new settings
4. **Auto-update** → `useUpdater` hook calls Tauri updater plugin → GitHub releases endpoint → downloads + install + relaunch

### IPC Commands

All commands are in [commands.rs](../../src-tauri/src/commands.rs) and exposed in [lib.rs](../../src-tauri/src/lib.rs). Each command maps to a frontend `invoke()` call:

- Recording: `start_recording`, `stop_recording`, `get_status`
- Discord: `discord_connect`, `discord_disconnect`, `discord_list_guilds`, `discord_list_channels`, `discord_start_recording`, `discord_get_channel_members`
- Settings: `get_output_dir`, `set_output_dir`, `get_silence_trim`, `set_silence_trim`, `get_shortcuts`, `set_shortcuts`
- File: `list_recordings`, `delete_recording`, `open_folder`

## Build & Test

### Development

```bash
pnpm install          # Install deps (uses pnpm v9)
pnpm tauri:dev        # Start Tauri dev server (Vite + Rust watch)
```

### Linting & Formatting (runs in CI)

```bash
pnpm lint             # ESLint (TS + React hooks)
cargo fmt --manifest-path src-tauri/Cargo.toml --all
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
```

### Production Build

```bash
pnpm tauri:build      # Full build (tsc, vite, cargo build --release)
# Outputs: src-tauri/target/release/*.exe (Windows), .dmg (macOS), .AppImage (Linux)
```

### CI/CD

- **CI flow** (`.github/workflows/ci.yml`): On push/PR to `main` → lint frontend → check Rust (fmt, clippy, test on 3 platforms)
- **Release flow** (`.github/workflows/release.yml`): On tag `v*` → build all platforms → sign with TAURI_SIGNING_PRIVATE_KEY → upload to GitHub releases
- **⚠️ CRITICAL: Check CI/CD results after every push** — Visit [GitHub Actions](../../actions) tab after pushing to verify all workflows pass (lint, fmt, clippy, cargo test on Ubuntu/Windows/macOS). Do NOT merge failing builds. If tests fail locally, fix before pushing. Failed builds block releases and waste CI minutes.
- **Version bumping:** Update `version` in `tauri.conf.json`, `Cargo.toml`, `package.json`, and SettingsPanel footer simultaneously

## Project Conventions

### Versioning & Releases

- **Semantic versioning:** `v{major}.{minor}.{patch}` (e.g., `v2.0.0`)
- **Version locations:** Must update all 4 places (or script will fail):
  1. `src-tauri/tauri.conf.json` → `version`
  2. `src-tauri/Cargo.toml` → `version`
  3. `package.json` → `version`
  4. `src/components/SettingsPanel.tsx` → footer text
- **Commit style:** [Conventional Commits](https://www.conventionalcommits.org/) — `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`
- **Release notes:** Create with `gh release create v{VERSION} --title "..." -F notes.txt`

### Tauri v2 ACL (Security)

- All Tauri plugins require ACL entries in [capabilities/default.json](../../src-tauri/capabilities/default.json)
- **Example:** Adding updater plugin requires both `tauri-plugin-updater` in `Cargo.toml` AND `"updater:default"` in ACL
- See `capabilities/default.json` for current permissions: `core:default`, `shell:allow-open`, `dialog:default`, `notification:default`, `updater:default`, `process:allow-restart`

### State Management

- **Frontend:** React hooks (`useState`, `useRef`, `useCallback`) + custom hooks (`useRecorder`, `useDiscord`, etc.)
- **Backend:** `parking_lot::Mutex` for sync state, `tokio::sync::Mutex` for async. Wrapped in Tauri `State<T>` for IPC access.
- **Persistence:** JSON files in `~/.config/DiscRec/` (settings, bot tokens in OS keychain via `keyring` crate)

### Theme System

- **Implementation:** CSS custom properties + `data-theme` attribute on `<html>`
- **Dark mode colors** (default in `:root`): `#0f0f13` primary, `#5865f2` accent, `#ed4245` record
- **Light mode colors** (in `[data-theme="light"]`): `#f5f5f7` primary, same accent/record
- **Switching:** `document.documentElement.setAttribute("data-theme", theme)` (see [App.tsx](../../src/App.tsx) for pattern)

## Integration Points

### External Dependencies

- **Tauri:** Core framework (window, IPC, auto-updater, system tray, plugins)
- **Serenity + Songbird:** Discord bot, voice receive streams
- **CPAL:** Cross-platform audio I/O (discovery only; Windows uses WASAPI directly)
- **Hound/Flacenc/LAME:** Audio encoding (WAV, FLAC, MP3)
- **Keyring:** OS secure storage (Discord bot token)
- **React + Vite:** Frontend build
- **TailwindCSS v4:** Styling

### GitHub Actions

- **Runners:** Ubuntu 22.04, Windows Latest, macOS Latest (for cross-platform builds)
- **Secrets required** (for releases):
  - `TAURI_SIGNING_PRIVATE_KEY` — for auto-updater artifact signing
  - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — passphrase for private key
- **Node/Rust versions:** LTS Node, stable Rust (dtolnay)

### Bot Token Management

- Users paste Discord bot token in Settings UI
- Frontend calls `invoke("save_bot_token", {token: "..."})`
- Backend stores in OS keychain (not local file) via `keyring` crate
- On app restart, `invoke("load_bot_token")` retrieves from keychain

## Security

### Sensitive Areas

- **Bot tokens:** Never log, only store in OS keychain, not on disk
- **Audio data:** All in-memory (no temp files), streamed to disk encoded
- **Settings:** Plain JSON in config dir — never embed secrets

### Tauri Security

- `security.csp: null` (set in `tauri.conf.json`) — allows inline scripts (necessary for React, safe with Tauri)
- IPC commands are auto-serialized as functions — use TypeScript typing to prevent injection
- System tray menu can trigger IPC commands (record/stop) — verify command exists before routing

## Common Patterns

### Adding a New Setting

1. **Backend:** Add field to `SettingsState` struct in [settings.rs](../../src-tauri/src/settings.rs)
2. **Command:** Add `get_*` and `set_*` commands in [commands.rs](../../src-tauri/src/commands.rs)
3. **Frontend hook:** Add to `useEffect` in SettingsPanel (fetch on mount), add handler in component
4. **UI:** Add row in `Section` using `SettingRow` component with label, icon, description
5. **Test:** Save setting, reload app, verify persisted

### Adding a New Format

1. **Rust:** Add variant to `AudioFormat` enum in [audio/encoder.rs](../../src-tauri/src/audio/mod.rs), implement encoder
2. **Frontend:** Add to `formats` array in [FormatSelector.tsx](../../src/components/FormatSelector.tsx)
3. **Backend:** Update `start_recording` in [commands.rs](../../src-tauri/src/commands.rs) to pass format to encoder
4. **Test:** Record 10s with new format, verify audio plays back correctly on all platforms

### Handling Platform Differences

- **Windows:** Audio capture via WASAPI per-process loopback in [src-tauri/src/audio/capture.rs](../../src-tauri/src/audio/capture.rs) (Windows 10 Build 20348+)
- **Linux:** PulseAudio / PipeWire monitor sources ([audio/capture.rs](../../src-tauri/src/audio/capture.rs))
- **macOS:** Requires external virtual device (BlackHole) — app just connects to it
- **Code structure:** Use `#[cfg(target_os = "...")]` blocks to separate platform code clearly

## Feature Gate: "Core to Recording?"

Before coding, ask:

1. ✅ **Core to recording?** Pause/resume, formats, per-speaker tracks — YES
2. ✅ **Lightweight?** Simple UI, doesn't add 100MB binary — YES
3. ✅ **Tested cross-platform?** Manual test on Windows + one other OS — YES

❌ **Out of scope:** Video recording, edit audio in-app, effects plugins — too large, not core mission

## Next Steps When Creating Features

1. Update ROADMAP.md with feature details + expected v{X.Y.Z}
2. Create a branch: `git checkout -b feat/my-feature`
3. Implement + test locally across platforms
4. **Run full lint & build locally:** `pnpm lint && cargo fmt --manifest-path src-tauri/Cargo.toml --all && cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings && cargo test --manifest-path src-tauri/Cargo.toml` — DO NOT push if these fail
5. Commit with conventional message: `feat: add feature name`
6. **Push + immediately check** [GitHub Actions](../../actions) tab to verify all CI workflows pass (lint, fmt, clippy, cargo test on 3 platforms). Do NOT consider work done until all green checks appear
7. Open PR with description of testing done
8. Update version in all 4 files + ROADMAP when merging to main
9. Create GitHub release when ready: `gh release create v{VERSION}`

## Debugging

- **Frontend:** Browser DevTools in Tauri dev mode (Ctrl+Shift+I)
- **Rust panics:** Appear in console during dev; add `RUST_BACKTRACE=1` for full trace
- **IPC calls:** Use `tauri.listen()` hooks to trace command flow
- **Audio issues:** Check platform-specific logs (WAV header, encoder state) + test with `ffplay` or Audacity
