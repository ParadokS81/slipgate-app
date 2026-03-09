# Slipgate App — Desktop Companion for QuakeWorld

**Status: Active development.** See `docs/ROADMAP.md` for what's built and what's next.

A cross-platform system tray application that bridges the QuakeWorld game client, the user's computer, and the Slipgate web hub. Built with Tauri v2 (Rust backend + SolidJS frontend).

## Ecosystem Context

This project is part of the QuakeWorld ecosystem. Unlike the other QW projects (which live in WSL), **this project runs on native Windows** because Tauri builds native desktop apps and needs the Windows toolchain for Windows binaries.

For full details on all sibling projects, shared infrastructure, integration points, and cross-project workflows, see the **orchestrator CLAUDE.md** in the WSL workspace.

Key sibling projects (all in WSL at `\\wsl.localhost\Ubuntu\home\paradoks\projects\quake\`):
- **`slipgate/`** — Slipgate web hub (SolidJS + Tailwind + DaisyUI). Shares design system with this app
- **`MatchScheduler/`** — Current match scheduling platform (Firebase). Auth, availability, match data
- **`quad/`** — Discord bot (TypeScript). Voice recording, standin flow, Mumble integration
- **`MatchScheduler/qw-stats/`** — Stats API (Express + PostgreSQL). Player rankings, H2H, match history
- **`qw-oracle/`** — Community knowledge base (SQLite). 2.66M messages from IRC + Discord

Shared infrastructure: Firebase project `matchscheduler-dev`, QW Hub API (Supabase), Mumble server on Xerial's box. See the orchestrator CLAUDE.md for connection details, credentials locations, and deploy workflows.

**Important:** There are NO build-time dependencies on sibling projects. All integration is via network (Firebase, HTTP APIs). The sibling references above are for documentation context only.

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
| **Package manager** | Bun | Same as Slipgate web. Fast installs, built-in test runner |
| **Build** | Vite | Comes with Tauri template, same as Slipgate web |
| **Linting** | Biome | Same as Slipgate web. Single tool replacing ESLint + Prettier |

## Development Environment

**This project is developed on native Windows, not WSL.**

Tauri builds native desktop apps using the OS's own webview. In WSL it would build Linux binaries; on Windows it builds Windows binaries. Since ~80% of QW players are on Windows, we develop natively on Windows to test what most users experience. Cross-platform builds (Linux, macOS) are handled by GitHub Actions.

Prerequisites (all Windows-native):
- **Rust** — via `rustup` (installs MSVC toolchain)
- **Bun** — JavaScript runtime and package manager
- **Microsoft C++ Build Tools** — "Desktop development with C++" workload
- **WebView2** — pre-installed on Windows 10/11

See `docs/DEVELOPMENT.md` for full setup instructions.

```bash
# Install dependencies
bun install

# Dev mode (opens Tauri window with hot reload)
bun run tauri dev

# Build for current platform
bun run tauri build

# Build for all platforms — GitHub Actions matrix build
# See .github/workflows/ (auto-builds on push to main)
```

## Design System

**Shares the Slipgate web design system.** Reference docs in WSL: `\\wsl.localhost\Ubuntu\home\paradoks\projects\quake\slipgate\DESIGN-SYSTEM.md` and `COLOR-PALETTE.md`.

Key rules:
- Use DaisyUI semantic classes for themed elements (`btn-primary`, `bg-base-200`, `badge-success`)
- Use OKLCH values via CSS custom properties — never hardcode hex/rgb
- Theme changes propagate automatically through the ramp system
- When infiniti's Harmonizer export is ready, both projects consume the same CSS variables
- Dark theme is the default (gamers expect it)

## Project Structure

```
slipgate-app/
├── CLAUDE.md              # This file — project context for Claude
├── docs/                  # Planning & reference
│   ├── ROADMAP.md         # Living roadmap: done / planned / ideas
│   ├── FEATURES.md        # Original feature ideas by tier
│   ├── PERIPHERAL-SELECTOR.md  # Research for EloShapes-backed selector
│   ├── SYSTEM-SPECS.md    # What specs to collect and how
│   ├── AUTH.md            # Discord OAuth in Tauri
│   ├── DESIGN.md          # Design approach and UI patterns
│   ├── DEVELOPMENT.md     # Environment setup and dev workflow
│   └── VISION.md          # What and why
├── src-tauri/             # Rust backend (Tauri commands)
│   ├── src/
│   │   ├── main.rs        # Entry point
│   │   ├── lib.rs         # Tauri app builder, command registration
│   │   └── commands/
│   │       ├── mod.rs
│   │       └── system.rs  # System specs + peripheral detection
│   ├── Cargo.toml
│   └── tauri.conf.json
├── src/                   # SolidJS frontend
│   ├── index.tsx          # SolidJS entry
│   ├── App.tsx            # Root component (tab router, spec loading)
│   ├── types.ts           # TypeScript types matching Rust structs
│   ├── app.css            # Tailwind + DaisyUI theme
│   └── components/
│       ├── TabNav.tsx      # Tab navigation bar
│       ├── ProfileTab.tsx  # System specs + peripherals display
│       ├── ScheduleTab.tsx # Placeholder
│       └── SettingsTab.tsx # Placeholder
├── package.json
└── vite.config.ts
```

## Cross-Platform Strategy

Tauri supports Windows, macOS, and Linux from a single codebase.

- **Local development:** Windows (native) — tests the primary platform
- **CI builds:** GitHub Actions builds all three platforms on every release
- **Distribution:** GitHub Releases with auto-updater (Tauri updater plugin)
- **User split:** ~80% Windows, ~15% Linux, ~5% macOS

Platform-specific code is minimal:
- **ezQuake paths**: `%APPDATA%\ezQuake\` (Windows), `~/.ezquake/` (Linux), `~/Library/Application Support/ezQuake/` (Mac)
- **GPU/peripherals**: WMI + SetupAPI (Windows), `/proc/` + `lspci` (Linux), `system_profiler` (Mac)
- **Process names**: `ezquake.exe` vs `ezquake-linux-x86_64` vs `ezQuake.app`

Everything else (tray icon, notifications, autostart, deep links, auto-updater) is handled by Tauri plugins cross-platform.

## Integration Points

All integration is network-based — no filesystem dependencies on sibling projects.

| Target | Mechanism | Data |
|--------|-----------|------|
| **MatchScheduler / Slipgate web** | Firebase Auth + Firestore | User profile, availability, match data |
| **QW Hub API** | HTTP (Supabase) | Live servers, match history |
| **QW Stats API** | HTTP | Player stats, rankings |
| **ezQuake** | Local filesystem + process detection | Configs, demos, running state |
| **Mumble** | `mumble://` protocol | Quick join team channel |

### Firebase Details

- **Project:** `matchscheduler-dev`
- **Discord Client ID:** `1465332663152808031` (same as MatchScheduler)
- **Auth Cloud Function:** `discordOAuthExchange` (existing, europe-west3)
- **Firestore collections used:** `users/{uid}` (profile + system specs), `availability/`, `matches/`

## Git Workflow

### Branch Strategy

- **`main`** — always builds, always runs. This is the stable branch.
- **`feat/<name>`** — feature branches for each piece of work (e.g. `feat/system-tray`, `feat/tailwind-daisyui`, `feat/system-specs`)
- Feature names map to FEATURES.md tiers where possible
- Branches are short-lived: build the feature, verify it works, merge to main

### Rules

1. **Never work directly on `main`** — always create a feature branch first
2. **Commit often** with clear messages using conventional format: `feat:`, `fix:`, `chore:`, `docs:`
3. **Each commit should build** — don't commit broken code
4. **Merge when the feature works** — tested visually via `bun run tauri dev`
5. **Delete branches after merge** — keep the branch list clean
6. **Tag releases** when a tier is complete (e.g. `v0.1.0` for Tier 1 MVP)

### Workflow

```
main ──────────────────●─────────────●──────── (always stable)
        \             /     \       /
         feat/tray ──●       feat/specs ──●
```

1. Start feature: `git checkout -b feat/<name>` from main
2. Work + commit on the feature branch
3. When done: merge to main (fast-forward or squash)
4. Tag if it's a milestone

### Custom Commands

- **`/feature <name>`** — Create a new feature branch and get started
- **`/checkpoint`** — Commit current progress with a clear message
- **`/ship`** — Merge current feature to main when it's ready

### When Claude Should Act on Git

- **Auto-checkpoint:** After completing a meaningful unit of work, Claude should proactively suggest or create a commit
- **Branch guard:** Before editing code, verify we're on a feature branch (not main)
- **Status updates:** When starting/finishing work, give a brief git status so the user knows what branch we're on and what's changed
- **Keep user informed:** Always mention branch name and what's being committed in plain language

## Conventions

- Rust code follows standard Rust conventions (rustfmt, clippy)
- Frontend code follows Slipgate web conventions
- Tauri commands use snake_case in Rust, camelCase in TypeScript
- All user-facing strings should be in English
- No hardcoded URLs — use config/environment for API endpoints
- Bun for all JS tooling (install, run, test)
