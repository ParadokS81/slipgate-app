# Slipgate App — Desktop Companion for QuakeWorld

**Status: Planning phase. No code exists yet.**

A cross-platform system tray application that bridges the QuakeWorld game client, the user's computer, and the Slipgate web hub. Built with Tauri v2 (Rust backend + SolidJS frontend).

## Ecosystem Context

This project is part of the QuakeWorld ecosystem. For full details on all sibling projects, shared infrastructure, integration points, and cross-project workflows, see the **orchestrator CLAUDE.md**: `../CLAUDE.md`

Key sibling projects you'll encounter:
- **`../slipgate/`** — Slipgate web hub (SolidJS + Tailwind + DaisyUI). Shares design system with this app
- **`../MatchScheduler/`** — Current match scheduling platform (Firebase). Auth, availability, match data
- **`../quad/`** — Discord bot (TypeScript). Voice recording, standin flow, Mumble integration
- **`../MatchScheduler/qw-stats/`** — Stats API (Express + PostgreSQL). Player rankings, H2H, match history
- **`../qw-oracle/`** — Community knowledge base (SQLite). 2.66M messages from IRC + Discord

Shared infrastructure: Firebase project `matchscheduler-dev`, QW Hub API (Supabase), Mumble server on Xerial's box. See `../CLAUDE.md` for connection details, credentials locations, and deploy workflows.

## What This App Does

Slipgate App runs quietly in the system tray, providing features that are impossible or impractical from a web browser:
- Collect system specs (GPU, CPU, RAM, display) for community profiles
- Detect and interact with ezQuake (configs, demos, process detection)
- Desktop notifications for matches, standin requests, tournament events
- Quick actions without opening a browser (availability toggle, server connect)
- Deep linking via `qw://` protocol handler

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| **Desktop framework** | Tauri v2 | Rust backend, OS webview frontend. ~5-10 MB binary, low memory, cross-platform |
| **Frontend** | SolidJS + TypeScript | Same as Slipgate web — shared design language |
| **Styling** | Tailwind CSS 4 + DaisyUI 5 | Same as Slipgate web — shared OKLCH theme system |
| **Backend** | Rust | System-level operations: sysinfo, file watching, process detection, protocol handlers |
| **Auth** | Discord OAuth (via Firebase) | Same identity as Slipgate web — localhost redirect flow |

## Design System

**Shares the Slipgate web design system.** See `../slipgate/DESIGN-SYSTEM.md` and `../slipgate/COLOR-PALETTE.md`.

Key rules:
- Use DaisyUI semantic classes for themed elements (`btn-primary`, `bg-base-200`, `badge-success`)
- Use OKLCH values via CSS custom properties — never hardcode hex/rgb
- Theme changes propagate automatically through the ramp system
- When infiniti's Harmonizer export is ready, both projects consume the same CSS variables

## Project Structure (Planned)

```
slipgate-app/
├── CLAUDE.md              # This file
├── docs/                  # Planning documents
│   ├── VISION.md          # What and why
│   ├── FEATURES.md        # Feature ideas by priority
│   ├── SYSTEM-SPECS.md    # What specs to collect and how
│   ├── AUTH.md            # Discord OAuth in Tauri
│   └── DESIGN.md          # Design approach and UI patterns
├── src-tauri/             # Rust backend (Tauri commands)
│   ├── src/
│   │   ├── main.rs
│   │   ├── commands/      # Tauri command handlers
│   │   │   ├── system.rs  # System specs collection
│   │   │   ├── ezquake.rs # ezQuake detection and config reading
│   │   │   └── auth.rs    # OAuth flow management
│   │   └── lib.rs
│   ├── Cargo.toml
│   └── tauri.conf.json
├── src/                   # SolidJS frontend
│   ├── App.tsx
│   ├── components/
│   ├── pages/
│   └── styles/
├── package.json
└── vite.config.ts
```

## Cross-Platform Notes

Tauri supports Windows, macOS, and Linux from a single codebase.

Platform-specific code is minimal:
- **ezQuake paths**: `~/.ezquake/` (Linux), `~/Library/Application Support/ezQuake/` (Mac), `%APPDATA%\ezQuake\` (Windows)
- **GPU detection**: `wmic` (Windows), `lspci` (Linux), `system_profiler` (Mac) — the `sysinfo` crate handles most of this
- **Process names**: `ezquake.exe` vs `ezquake-linux-x86_64` vs `ezQuake.app`

Everything else (tray icon, notifications, autostart, deep links, auto-updater) is handled by Tauri plugins cross-platform.

## Integration Points

| Target | Mechanism | Data |
|--------|-----------|------|
| **Slipgate web / MatchScheduler** | Firebase Auth + Firestore | User profile, availability, match data |
| **QW Hub API** | HTTP (Supabase) | Live servers, match history |
| **QW Stats API** | HTTP | Player stats, rankings |
| **ezQuake** | Local filesystem + process detection | Configs, demos, running state |
| **Mumble** | `mumble://` protocol | Quick join team channel |

## Development Commands (Future)

```bash
# Install dependencies
bun install

# Dev mode (opens Tauri window with hot reload)
bun run tauri dev

# Build for current platform
bun run tauri build

# Build for all platforms (CI)
# Uses GitHub Actions matrix build
```

## Conventions

- Rust code follows standard Rust conventions (rustfmt, clippy)
- Frontend code follows Slipgate web conventions (see `../slipgate/CLAUDE.md`)
- Tauri commands use snake_case in Rust, camelCase in TypeScript
- All user-facing strings should be in English
- No hardcoded URLs — use config/environment for API endpoints
