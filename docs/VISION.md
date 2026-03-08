# Vision — Slipgate App

## The Problem

QuakeWorld players maintain a mental map between three disconnected worlds:
1. **The game** — ezQuake client, servers, demos, configs
2. **Their computer** — system specs, display settings, peripherals
3. **The web** — community hub, match scheduling, stats, voice recordings

There's no bridge between them. Want to share your system specs on your profile? Manually type them. Want to jump into a server from the website? Copy-paste the IP. Want to know when your match starts? Keep checking the site. The browser can't reach into your system, and the game client doesn't know about the community platform.

## The Solution

**Slipgate App** is a lightweight desktop companion that sits in the system tray and connects these three worlds. It's the piece that makes the QuakeWorld ecosystem feel integrated rather than fragmented.

It runs quietly in the background, doing things a browser never could:
- Reading your hardware specs and uploading them to your profile
- Detecting when ezQuake is running and what server you're on
- Sending desktop notifications for matches and standin requests
- Letting you click a link on the hub to instantly connect to a server
- Managing your ezQuake configs across machines

## Design Philosophy

- **Invisible until needed** — system tray, not a full window app. Opens mini panels for quick actions
- **Zero mandatory configuration** — useful out of the box, power features unlock progressively
- **Shared identity** — same Discord login as the website, one community identity everywhere
- **Lightweight** — Tauri keeps it at ~5-10 MB installed, minimal RAM usage. Gamers care about resources
- **Cross-platform** — Windows, macOS, Linux. The QW community is on all three

## What This Is NOT

- Not a game launcher (ezQuake handles that)
- Not a replacement for the website (Slipgate web is the full experience)
- Not a voice chat client (Mumble/Discord handle that)
- Not a server browser (the hub handles that, though we can trigger quick-connect from it)

It's the **glue** — small, focused, connecting things that are currently disconnected.

## Relationship to Other Projects

| Project | Slipgate App's role |
|---------|---------------------|
| **Slipgate web** | Desktop extension of the web hub. Same auth, same data, different capabilities |
| **MatchScheduler** | Receives notifications, provides quick availability toggle |
| **quad** | Indirectly — standin request notifications originate from quad's DM flow |
| **ezQuake** | Reads configs, detects process, provides quick-connect and demo management |
| **Mumble** | Quick-join team channel via `mumble://` deep link |
