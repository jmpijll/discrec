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

- **Keep it simple** — DiscRec is intentionally minimal. Features should serve the core goal: easy Discord audio recording.
- **Format before committing** — Run `cargo fmt` and `pnpm lint`.
- **One thing per PR** — Small, focused pull requests are easier to review.
- **Test on your platform** — We can't test every OS in CI perfectly, so manual verification matters.

## Commit style

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add audio level meter
fix: correct WAV header on short recordings
docs: update macOS setup instructions
```

## Reporting bugs

Use the [Bug Report](https://github.com/jmpijll/discrec/issues/new?template=bug_report.yml) template. Include your OS, DiscRec version, and steps to reproduce.

## Questions?

Open a [Discussion](https://github.com/jmpijll/discrec/discussions) — no question is too small.
