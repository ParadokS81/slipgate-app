# Design Approach — Slipgate App UI

## Core Principle: Share the Slipgate Web Design System

The desktop app's frontend IS web tech (rendered in Tauri's OS webview). This means we use the exact same design stack as Slipgate web:

- **Tailwind CSS 4** — utility-first styling
- **DaisyUI 5** — semantic component classes with OKLCH theming
- **OKLCH color ramp** — from infiniti's Harmonizer export (when ready)
- **CSS custom properties** — for all themed values

When infiniti finalizes the Harmonizer ramp and primary/secondary hues, both projects consume the same exported CSS variables. Change the theme once, it updates everywhere.

---

## Desktop App UI Patterns

A system tray app is NOT a full web app. The UI is different:

### Window Types

| Type | Size | When |
|------|------|------|
| **Tray menu** | Native OS menu | Right-click tray icon. Quick actions: availability toggle, settings, quit |
| **Mini panel** | ~400x500px floating window | Click tray icon. Shows dashboard: specs summary, status, quick actions |
| **Settings window** | ~600x700px | Opened from menu. Full settings: auth, ezQuake path, notifications, autostart |
| **Notification** | Native OS toast | Match reminders, standin requests |

### Mini Panel Layout

The primary UI surface. Should feel like a compact dashboard, not a website:

```
┌─────────────────────────────┐
│  Slipgate          [─] [×] │  ← Small title bar
├─────────────────────────────┤
│  👤 ParadokS (SR)          │  ← Logged in user + team
│  ● Online                   │
├─────────────────────────────┤
│  System        ↻ Refresh    │
│  ┌────────┐ ┌────────┐     │
│  │ R7 5800│ │RTX 4070│     │  ← Hardware cards
│  │ 8C/16T │ │ 12 GB  │     │
│  └────────┘ └────────┘     │
│  32 GB DDR4 · 2560x1440    │
│  [Upload to Profile]       │
├─────────────────────────────┤
│  Tonight                    │
│  ○ Available  ● Not  ○ ?   │  ← Quick availability
├─────────────────────────────┤
│  Upcoming                   │
│  SR vs Av3k  20:00 CET     │  ← Next match
│  [Connect] [Details →]     │
└─────────────────────────────┘
```

### Design Rules for Desktop App

1. **Dense layout** — less whitespace than web. Every pixel matters in a small panel
2. **System-native feel** — respect OS conventions (close button behavior, tray interaction patterns)
3. **Dark theme primary** — gamers expect dark UI. Support light mode but dark is default
4. **Monospace for specs** — CPU model, GPU name, resolution, FPS values in monospace font
5. **Minimal navigation** — no complex routing. Tabs or sections in a single panel, not pages
6. **Fast open/close** — panel should appear/disappear instantly. No loading spinners for cached data

---

## Theme Configuration

### DaisyUI Theme Setup

```css
/* Use DaisyUI's OKLCH theming */
[data-theme="slipgate-dark"] {
  --p: oklch(65% 0.15 265);    /* primary — indigo (TBD from Harmonizer) */
  --s: oklch(65% 0.15 180);    /* secondary — teal (TBD) */
  --b1: oklch(20% 0.02 265);   /* base-100 background */
  --b2: oklch(16% 0.02 265);   /* base-200 */
  --b3: oklch(12% 0.02 265);   /* base-300 */
  --bc: oklch(90% 0.02 265);   /* base-content (text) */
  /* ... full ramp from Harmonizer export */
}
```

### What Changes When the Ramp Arrives

When infiniti exports the Harmonizer ramp:
1. Replace the placeholder OKLCH values above with the real ramp
2. Both Slipgate web and Slipgate App get the same CSS file/variables
3. Components don't change — they already use `btn-primary`, `bg-base-200`, etc.

This is exactly why the ramp system is powerful: zero component changes when the theme updates.

---

## Open Questions

- [ ] Should the mini panel be a native window or a frameless Tauri window with custom title bar?
- [ ] Tray icon: static Slipgate logo or dynamic (color change when in-game, notification badge)?
- [ ] Do we need a full settings window or can everything fit in the mini panel with a settings section?
- [ ] Animation/transitions: keep minimal for performance, or add subtle polish?
