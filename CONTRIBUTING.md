# Contributing to DiscRec

Thanks for your interest! Here's how to get started.

## Setup

```bash
git clone https://github.com/jmpijll/discrec.git
cd discrec
pnpm install
pnpm tauri:dev
```

Make sure you have Rust (stable), Node.js (LTS), and pnpm installed. See [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for platform-specific dependencies.

## Guidelines

- **Keep it simple** — DiscRec is intentionally minimal. Features should serve the core goal: easy Discord audio recording. Ask "does this make recording simpler or audio quality better?" before adding.
- **Format before committing** — Run `cargo fmt` and `pnpm lint` (ESLint + Prettier).
- **One thing per PR** — Small, focused pull requests are easier to review.
- **Test on your platform** — We can't test every OS in CI perfectly, so manual verification matters.
- **Visual regression** — If you change components, test both dark and light themes.

## Code style

- **React components:** Functional, hooks-based. Extract reusable pieces into `components/` (avoid one-file components).
- **Rust:** Follow clippy lint rules. Use `parking_lot::Mutex` instead of `std::sync::Mutex` (faster, no poisoning).
- **CSS:** Tailwind-first. Avoid custom CSS unless absolutely necessary — use `@apply` or custom theme variables.
- **Naming:** Be explicit (e.g., `silenceTrimThreshold` not `threshold`). Component folders use PascalCase, utilities use camelCase.

## Architecture

### Frontend (React + Tauri)

- **`src/App.tsx`** — Main UI, state orchestration
- **`src/components/`** — UI components (AudioMeter, RecordButton, SettingsPanel, etc.)
- **`src/hooks/`** — Custom hooks (useRecorder, useDiscord, useUpdater, useKeyboardShortcuts)
- **`src/lib/utils.ts`** — Shared utilities (cn, formatDuration)
- **`src/index.css`** — Global theme + Tailwind

### Backend (Rust + Tauri)

- **`src-tauri/src/main.rs`** — Tauri entry, system tray setup
- **`src-tauri/src/lib.rs`** — Plugin initialization, event handlers
- **`src-tauri/src/commands.rs`** — Exposed Tauri commands (IPC to frontend)
- **`src-tauri/src/audio/`** — Audio capture (platform-specific: Windows WASAPI, Linux PulseAudio, macOS BlackHole)
- **`src-tauri/src/discord/`** — Discord bot integration (Serenity + Songbird)
- **`src-tauri/src/settings.rs`** — Persistent settings (JSON file in config dir)

### Key flows

1. **Recording start** → `commands.rs` → `audio::capture::AudioCapture` → encoder (`WAV`/`FLAC`/`MP3`)
2. **Discord mode** → `commands.rs` → `discord::bot` → `songbird` voice receiver → per-speaker tracks
3. **Settings save** → `commands.rs` → `settings.rs` → `~/.config/DiscRec/settings.json`
4. **Auto-update** → `useUpdater` hook → Tauri updater plugin → GitHub releases

## Commit style

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add audio level meter
fix: correct WAV header on short recordings
docs: update macOS setup instructions
refactor: extract audio capture into module
```

## When to add a feature

Before proposing a new feature, ask:

1. **Core to recording?** Does it directly improve Discord audio recording quality or ease of use?
2. **Lightweight?** Does it add significant complexity or bundle size?
3. **Tested on all platforms?** Can you verify it works on Windows, macOS, and Linux?

Examples:
- ✅ **Good:** Pause/resume (captures uninterrupted audio during long meetings)
- ✅ **Good:** Per-speaker tracks (Discord bot enables advanced use case)
- ❌ **Out of scope:** Video recording (dilutes focus, adds significant complexity)
- ❌ **Out of scope:** Audio editing in-app (use Audacity; we record, don't edit)

## Testing

- **Manual testing:** Record 10+ seconds with each format (WAV/FLAC/MP3). Verify audio plays correctly.
- **Discord mode:** Connect a bot, join a channel, verify per-speaker tracks are separate.
- **Settings:** Save a setting, restart the app, verify it persists.
- **Platform parity:** Test on at least Windows and one other OS (macOS or Linux).

## Reporting bugs

Use the [Bug Report](https://github.com/jmpijll/discrec/issues/new?template=bug_report.yml) template. Include your OS, DiscRec version, and steps to reproduce.

## Questions?

Open a [Discussion](https://github.com/jmpijll/discrec/discussions) — no question is too small.
