# Peripheral Selector — Research & Plan

## Overview

The Slipgate companion app auto-detects some peripherals (mouse brand, keyboard, microphone) via USB bus descriptors. But USB only gives us brand-level info (e.g. "BenQ ZOWIE Gaming Mouse" — no model number). Users need a way to select their exact mouse model, mousepad, and other gear.

## Data Source: EloShapes

**EloShapes** (eloshapes.com) is the best available source for gaming peripheral data.

### What's available

| Category | Count | Data quality |
|----------|-------|-------------|
| Mice | ~1,430 | Excellent — 50+ fields per mouse (shape, weight, dimensions, sensor, DPI, polling rate, wireless, images, SVG outlines, switches) |
| Mousepads | ~617 | Good — speed rating, texture, material, dimensions, thickness |
| Keyboards | None | Not covered by EloShapes |

### How to access

EloShapes uses **Supabase** (PostgreSQL + PostgREST) with a publicly accessible anonymous API key embedded in their frontend JavaScript.

**Base URL:** `https://qyjffrmfirkwcwempawu.supabase.co/rest/v1/`

**Main view:** `products_available_v8`

**Required headers:**
```
apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF5amZmcm1maXJrd2N3ZW1wYXd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjY3NzAyNzgsImV4cCI6MjA0MjM0NjI3OH0.clLm3KrW9nuWtWRgL4VXz2dH0zohot2Q3XqQ1lSRelI
Authorization: Bearer <same key>
```

**Example queries (PostgREST syntax):**
```
# All mice
?general__category=eq.mouse&select=general__brand_name,general__model,mouse__weight,mouse__wireless

# Search by brand
?general__category=eq.mouse&general__brand_name=ilike.*zowie*

# All mousepads
?general__category=eq.mousepad&select=general__brand_name,general__model
```

**Key fields for mice:**
- `general__brand_name`, `general__model`, `general__handle` (slug/ID)
- `mouse__weight`, `mouse__length`, `mouse__width`, `mouse__height`
- `mouse__wireless`, `mouse__polling_rate`
- `mouse__shape` (symmetrical / ergonomic)
- `mouse__sensor__model`, `mouse__sensor__dpi`
- `general__images` (PNG filenames for product photos)

**Key fields for mousepads:**
- `general__brand_name`, `general__model`
- `mousepad__speed_rating`, `mousepad__texture`
- `mousepad__surface_material`, `mousepad__base_material`
- `mousepad__width`, `mousepad__length`, `mousepad__thickness`

### Caveats

- **Unofficial API** — not documented or guaranteed stable. View names have versioned (v3→v8). The anon key expires 2034.
- **No keyboards** — need another source (keeb-finder.com, or just free-text)
- **Cloudflare protection** — don't hammer it. Our use case (weekly sync) is fine.

## Alternative / Fallback: QW Community Data

The QuakeWorld community maintains a hardware repo:
`https://github.com/quakeworld/quake.world-data/tree/main/hardware`

| File | Content |
|------|---------|
| `mice.json` | ~1,157 mice (name, wireless, dpi, polling_rate) |
| `mousepads.json` | Mousepad names |
| `keyboard_switches.json` | Switch types |

This is simpler but community-owned and stable. Good fallback if EloShapes API changes.

## Architecture Decision: Bundle + Refresh

### Chosen approach

**Bundle a snapshot with the app installer, refresh on demand.**

Rationale:
- Users rarely change mice. The selector needs to work instantly on first use.
- New mice don't come out daily — data staleness is not a real issue.
- ~200KB JSON is negligible in a 5-10MB installer.
- When the user actively opens the selector to pick a new mouse, we can offer a "refresh database" option that fetches the latest from EloShapes.

### Data flow

```
Build time:
  → Fetch mice + mousepads from EloShapes
  → Save as JSON in app resources (bundled with installer)

First app launch:
  → Copy bundled JSON to app data directory
  → Selector loads from local file — instant

User opens selector:
  → Load from local cache
  → Show searchable/filterable list
  → "Update database" button available (fetches latest from EloShapes)
  → User picks model → saved to local profile

Profile sync (later):
  → Selected peripherals sync to Firebase/Supabase with system specs
  → Website can display rich peripheral cards using the EloShapes handle
```

### What we store per selection

```json
{
  "mouse": {
    "source": "eloshapes",
    "handle": "zowie-ec2-cw",
    "brand": "ZOWIE",
    "model": "EC2-CW",
    "auto_detected": "BenQ ZOWIE Gaming Mouse"
  },
  "mousepad": {
    "source": "eloshapes",
    "handle": "artisan-hien-xl",
    "brand": "Artisan",
    "model": "Hien XL"
  },
  "keyboard": {
    "source": "manual",
    "name": "NuPhy Field75 HE",
    "auto_detected": "NuPhy Field75 HE"
  }
}
```

## Selector UX (App)

The selector should be compact and fast since the app window is small (~400px wide).

### Mouse selector flow

1. User clicks the mouse name in the peripherals section
2. Modal/dropdown opens with a search input
3. Type-ahead filtering: "zowie" → shows all ZOWIE mice
4. Results show: brand, model, wireless icon, weight
5. Click to select → closes, updates the display
6. Small "refresh" icon to update the database

### Pre-filtering with auto-detection

When we auto-detect "BenQ ZOWIE Gaming Mouse", we can:
- Pre-filter the selector to show ZOWIE mice first
- Or pre-fill the search with "ZOWIE"
- Makes it 2 clicks instead of typing

### Keyboard handling

EloShapes doesn't have keyboards. Options:
- Auto-detected name from USB is usually good (e.g. "NuPhy Field75 HE")
- Allow manual text override if the user wants to correct it
- No database selector needed for now

## Implementation Plan

### Phase 1: Data pipeline
- [ ] Script to fetch EloShapes mice + mousepads and save as bundled JSON
- [ ] Define the slim schema we need (don't store all 50+ fields)
- [ ] Add to build pipeline so it's refreshed on each app release

### Phase 2: Selector component
- [ ] Searchable dropdown component (SolidJS)
- [ ] Mouse selector: brand filter + text search
- [ ] Mousepad selector: brand filter + text search
- [ ] Keyboard: text input with auto-detected default

### Phase 3: Local profile storage
- [ ] Save selections to Tauri app data directory
- [ ] Load on app startup, display in peripherals section
- [ ] "Update database" button that re-fetches from EloShapes

### Phase 4: Sync (depends on auth)
- [ ] Provider pattern: `syncProfile()` abstraction
- [ ] Firebase provider (current MatchScheduler)
- [ ] Supabase provider (future Slipgate web)
- [ ] Sync auto-detected specs + user selections

## Fields We Collect (Summary)

| Field | Source | Method |
|-------|--------|--------|
| CPU | Auto | sysinfo crate |
| GPU | Auto | WMI/PowerShell |
| RAM | Auto | sysinfo crate |
| OS | Auto | sysinfo crate |
| Display resolution | Auto | Tauri window API |
| Display refresh rate | Auto | WMI |
| Monitor model | Auto | WMI (WmiMonitorID) |
| Monitor count | Auto | Tauri window API |
| Mouse brand | Auto | USB bus descriptor |
| Mouse model | User select | EloShapes database |
| Keyboard | Auto + manual | USB bus descriptor, text override |
| Mousepad | User select | EloShapes database |
| Microphone | Auto | USB bus descriptor / audio endpoints |
| Headphones | Manual | Free text (can't auto-detect) |
| DPI | Manual | Not exposed by OS |
| Polling rate | Manual | Not reliably exposed |
| cm/360 | Manual | Calculated or user input |
| Connection type | Manual | Fiber/Cable/DSL dropdown |
