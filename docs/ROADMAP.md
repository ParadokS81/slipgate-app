# Slipgate App — Roadmap

Living document. Updated after each `/ship`. See `FEATURES.md` for original feature ideas and context.

---

## Done

- **Tauri v2 scaffold** — SolidJS + TypeScript + Tailwind CSS 4 + DaisyUI 5 with slipgate-dark theme
- **System tray** — app lives in tray with basic menu
- **System specs detection** — CPU, GPU, RAM, OS, display (native WMI, sub-100ms)
- **Monitor info** — name, resolution, refresh rate (WmiMonitorID + Tauri window API)
- **Peripheral detection** — mouse, keyboard (native SetupAPI, ~10ms), microphone (native WMI)
- **Tab navigation** — Schedule (placeholder), Profile & Gear (working), Settings (placeholder)
- **Window layout** — 820x560 resizable app with header, tabs, content, footer
- **Performance** — all specs detection sub-500ms, no PowerShell dependency

## In Progress

(nothing — ready for next feature)

## Planned

- **Peripheral selector** — searchable mouse/mousepad/keyboard picker backed by EloShapes database. See `docs/PERIPHERAL-SELECTOR.md` for research
- **DPI / sensitivity input** — manual entry for DPI and in-game sens, auto-calculate cm/360
- **Discord OAuth login** — same identity as Slipgate web, Firebase Auth, token in OS keychain
- **Upload specs to profile** — sync detected specs + selected gear to Firestore user profile

## Ideas

Captured here so they don't get lost. No commitment, no order.

- ezQuake config detection (find install, parse config.cfg, extract sens/fov/resolution)
- ezQuake process detection (is player in-game? which server?)
- Weekly schedule grid (replicate MatchScheduler availability UI in the app)
- Match notifications (desktop alerts 30/15/5 min before match)
- Quick availability toggle from tray menu
- `qw://` protocol handler for server quick-connect
- Mumble quick-join (show who's in channel, one-click join)
- Demo file watcher (list recent .mvd files)
- Config cloud backup/restore
- Player H2H comparison widget (pull from qw-stats API)
- Mouse wireframe visualization (like EloShapes shape comparison)
- Community feed (recent forum posts, match results)
- Auto-update ezQuake
- Bluetooth/PS/2 peripheral detection (currently USB-only)

---

*To add a new idea: just say "add X to the roadmap" in any session.*
