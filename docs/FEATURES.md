# Feature Ideas — Slipgate App

Organized by priority. Tier 1 is the MVP, built first.

---

## Tier 1 — MVP (System Specs + Auth)

The minimum viable product: prove the Tauri stack works, solve the original problem (system specs), and establish the auth flow.

### 1.1 System Specs Collection
**The original motivation for this app.** Browsers can't access hardware info reliably.

Collect and display:
- CPU: model, cores, threads, base/boost clock
- GPU: model, VRAM, driver version
- RAM: total, speed, type (DDR4/DDR5)
- Display: resolution, refresh rate, monitors connected
- OS: name, version, architecture
- Storage: disk type (SSD/NVMe/HDD), free space
- Network: connection type, approximate bandwidth

**Implementation:** Rust `sysinfo` crate for most. GPU needs platform-specific calls. See `SYSTEM-SPECS.md` for details.

**User flow:**
1. User opens Slipgate App (or it's already running in tray)
2. "System Specs" panel shows detected hardware
3. User clicks "Upload to Profile" → specs saved to their community profile
4. Profile page on Slipgate web shows their specs

**Why it matters for QW:** Players constantly ask each other "what GPU do you use?", "what FPS do you get?", "what resolution?". Having this on profiles saves everyone time and helps with troubleshooting. Tournament organizers can verify hardware for fairness discussions.

### 1.2 Discord OAuth Login
**Same identity across web and desktop.**

- Opens browser window to Discord OAuth flow (same client ID as Slipgate web)
- Receives callback on localhost (Tauri catches the redirect)
- Exchanges code for Firebase Auth token
- User is now authenticated — same UID as their web account
- Token stored securely in OS keychain (Tauri's `store` plugin)

### 1.3 System Tray Basics
- App starts minimized to tray
- Tray icon with right-click menu (basic options: Show, Settings, Quit)
- Optional: auto-start on login
- Minimal window for settings and spec viewer

---

## Tier 2 — ezQuake Integration

Once the MVP is solid, start reading from the game client.

### 2.1 ezQuake Detection
- Find ezQuake installation directory (check common paths + let user configure)
- Read `config.cfg` and `autoexec.cfg` — extract key settings:
  - Resolution, renderer (OpenGL/Vulkan), FPS cap
  - Sensitivity, FOV, crosshair
  - Network rate settings
  - Player name, team, skin
- Display parsed config in a "QW Setup" panel

### 2.2 Process Detection
- Detect when ezQuake is running (`sysinfo` crate process list)
- Optional: parse command line to detect which server the player connected to
- Update tray icon or status when in-game

### 2.3 Demo File Watcher
- Watch ezQuake demo folder for new `.mvd` files
- List recent demos with metadata (date, size)
- Future: match demos to QW Hub matches (like quad does for voice recordings)

---

## Tier 3 — Community Integration

Connect the app to the broader community platform.

### 3.1 Match Notifications
- Listen to Firestore for upcoming matches (user's team schedule)
- Desktop notification 30/15/5 minutes before match
- Standin request notifications (when someone requests a standin for your skill bracket)
- Click notification → opens match page in browser OR quick-connect to server

### 3.2 Quick Availability Toggle
- Tray menu: "Available tonight" / "Not available" / "Maybe"
- Syncs directly to MatchScheduler/Slipgate availability grid
- No need to open browser for the most common daily action

### 3.3 Server Quick-Connect
- Register `qw://` protocol handler
- Web links like `qw://connect/123.45.67.89:28501` launch ezQuake with that server
- Tray menu shows "favorite servers" with one-click connect
- Could show current players on your favorite servers

### 3.4 Mumble Quick-Join
- Show who's in your team's Mumble channel (read from Mumble server)
- One-click join via `mumble://` deep link
- Tray tooltip: "3 teammates in Mumble"

---

## Tier 4 — Power Features (Future)

Ideas that could be cool but aren't priorities.

### 4.1 Config Sync
- Backup ezQuake configs to cloud (Firebase Storage)
- Restore on another machine — same settings everywhere
- Version history — revert config changes

### 4.2 Tournament Mode
- Tournament organizer pushes "tournament active" flag
- App enters tournament mode: suppresses non-essential notifications
- Auto-captures match result screenshots
- Submits results directly to tournament bracket

### 4.3 Performance Overlay
- Tauri v2 supports transparent/overlay windows
- Mini widget showing: FPS graph (from ezQuake console log parsing?), team voice status, match timer
- This is ambitious and may not be practical

### 4.4 Community Feed
- Show recent community activity in a small panel
- New forum posts, match results, demo highlights
- Powered by qw-oracle or community API

### 4.5 Auto-Update ezQuake
- Detect current ezQuake version
- Check for updates from nQuake/ezQuake releases
- Download and install updates with user confirmation

---

## Feature Dependencies

```
1.3 Tray Basics ─────────────────────────────────┐
1.2 Discord Auth ──┬── 3.1 Match Notifications    │
                   ├── 3.2 Quick Availability      │
1.1 System Specs ──┤                               ├── All features need tray
                   └── Upload to Profile           │
                                                   │
2.1 ezQuake Detection ──┬── 2.2 Process Detection │
                        ├── 2.3 Demo Watcher       │
                        ├── 3.3 Quick-Connect      │
                        └── 4.1 Config Sync        │
                                                   │
3.4 Mumble Quick-Join ────────────────────────────┘
```
