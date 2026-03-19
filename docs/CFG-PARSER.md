# ezQuake Config Parser

The Slipgate app parses ezQuake configuration files to auto-detect player settings, key bindings, and weapon systems. This document covers the parser architecture, supported categories, and known edge cases.

## Architecture

**Parser location**: `src-tauri/src/commands/ezquake.rs`

The parser works in stages:

1. **Lexing** — split config into lines, classify as cvar, bind, alias, exec, or skip
2. **Alias resolution** — build a map of alias name → command string
3. **Bind extraction** — build ordered list of (key, command) pairs
4. **Analysis** — derive higher-level data from raw binds/cvars (movement keys, weapon binds, etc.)

### Config loading

ezQuake configs often reference other files via `exec`:
```
cl_onload "exec configs/slackers_tp.cfg; exec configs/servers.cfg"
```

**TODO**: Follow `exec` references to load the complete alias/bind picture. Currently only the main config.cfg is parsed.

## Knowledge sources

| Source | What it tells us | When to use |
|--------|-----------------|-------------|
| [ezQuake docs](https://ezquake.com/docs/) | Official command/cvar descriptions | First reference for any command |
| [ezQuake source](https://github.com/QW-Group/ezquake-source) | Exact implementation behavior | When docs are ambiguous |
| Community configs | Real-world usage patterns | For edge cases and testing |
| User (ParadokS) | Intent, use cases, QW domain knowledge | For design decisions |

## Categories

### 1. Profile & Settings (implemented)

Auto-detected from cvars:

| Field | Cvar | Default | Notes |
|-------|------|---------|-------|
| Player name | `name` | "player" | Supports QW color codes ($x, ^x) |
| Team | `team` | "" | |
| Colors | `topcolor`, `bottomcolor` | 0, 0 | 0-13 palette |
| Sensitivity | `sensitivity` | 12.0 | |
| m_yaw | `m_yaw` | 0.022 | Horizontal mouse multiplier |
| m_pitch | `m_pitch` | 0.022 | Vertical mouse multiplier. Negative = inverted Y |
| m_accel | `m_accel` | 0.0 | Mouse acceleration. >0 = accel enabled |
| FOV | `default_fov` or `fov` | 90.0 | Prefer default_fov if set |
| Resolution | `vid_width`/`vid_height` or `vid_win_width`/`vid_win_height` | desktop | Depends on `vid_fullscreen` |
| Refresh rate | `vid_displayfrequency` | 0 | 0 = use desktop rate |

### 2. Movement Keys (implemented)

Extracted from binds:
- `+forward`, `+back`, `+moveleft`, `+moveright`, `+jump`
- Last bind wins (ezQuake processes top-to-bottom)

### 3. Weapon Binds (implemented, refining)

#### The two weapon mechanisms

| Mechanism | How it works | Detection |
|-----------|-------------|-----------|
| **Quickfire** | One key selects AND fires the weapon | Alias contains `impulse/weapon N` + `+attack` |
| **Manual** | One key selects, another key fires | Alias rebinds mouse1 or just selects weapon, no `+attack` |

#### ezQuake weapon commands

**`weapon N [N2 N3...]`** — Select weapon with priority fallback. Required for `cl_weaponpreselect` to work.
```
weapon 7 3 2    // Try RL, then SSG, then SG
```

**`impulse N`** — Immediately select weapon N. Old-school, no fallback, no preselect support.
```
impulse 7       // Select RL
```

**Impulse → weapon mapping:**
```
1=Axe  2=SG  3=SSG  4=NG  5=SNG  6=GL  7=RL  8=LG
```

#### Weapon-related cvars

| Cvar | Default | Effect on parser |
|------|---------|-----------------|
| `cl_weaponpreselect` | 0 | 1+ = weapon selection is virtual until fire. Doesn't change quickfire/manual classification. |
| `cl_weaponhide` | 0 | 1+ = auto-switch to SG/axe after firing. Affects which weapon is "held" but not bind classification. |
| `cl_weaponhide_axe` | 0 | Use axe instead of SG for hide. |
| `cl_weaponforgetorder` | 0 | 1 = weapon command picks best at time of command, not best-available tracking. |
| `w_switch` | 8 | Auto-switch threshold on weapon pickup. 2 = don't auto-switch to anything above SG. |
| `b_switch` | 8 | Auto-switch threshold on backpack pickup. |

These cvars affect gameplay behavior but **do not change the quickfire/manual classification**. They should be noted in the profile as context (e.g., "uses weaponpreselect" or "weaponhide active").

#### Detection algorithm

```
For each bind (key, command):
  1. Skip empty binds
  2. Resolve command through alias map (one level)
  3. If resolved command rebinds mouse1:
     a. Extract what mouse1 gets rebound to
     b. Resolve that alias
     c. If resolved alias has +attack → quickfire
     d. If no +attack → manual (select key, fire on mouse1)
  4. If resolved command has weapon/impulse number:
     a. Skip if 4+ numbers (pack-drop chain)
     b. Skip if default impulse on number key (legacy)
     c. If has +attack → quickfire
     d. If rebinds mouse1 → manual
     e. Otherwise → manual select (non-number keys only)
  5. Mouse1 itself: if it appears as the target of multiple rebinds,
     classify as "primary fire button", not a weapon bind
```

#### Known patterns

**Mouse1 rebind system** (ParadokS, Mazer):
Mouse1 is a universal fire button that gets rebound by other keys. Different keys switch what Mouse1 fires. The keys that trigger the rebind are the real weapon binds.

**Quickfire with rebind** (ParadokS's C/V):
`+boom = "weapon 2; +attack; bind mouse1 +boom"` — fires immediately (quickfire) AND rebinds mouse1 for continued firing. Classified as quickfire because the key initiates fire.

**at-system** (Mazer):
`at7 = "impulse 7; bind mouse1 +go7"` — selects weapon AND rebinds mouse1 to quickfire it. Classified as manual because the at-key itself doesn't fire.

**Pack-drop binds**:
`impulse 7 8 6 5 3 5 4` — long impulse chain to select best weapon for dropping. Not a combat bind. Filter by chain length ≥ 4.

**Legacy default binds**:
Number keys 1-8 with plain `impulse N` — often unchanged from defaults. Skip when custom weapon binds exist elsewhere in config.

### 4. Teambinds (planned)

Team communication binds use `if`/`then`/`else` conditional logic:
```
tempalias __kill_me "if ('$bestweapon' = '$tp_name_lg') then __kill_me_lg_check else ..."
```

These are easier to parse structurally (clear conditional trees) but harder to display meaningfully. Planning to visualize as decision trees.

### 5. Future categories

- **HUD layout** — extract hud_* cvars for HUD visualization
- **Visual settings** — r_drawflat, gl_picmip, particle settings
- **Network settings** — rate, cl_c2sdupe, cl_timeout

## Test configs

| Player | File | Characteristics |
|--------|------|----------------|
| ParadokS | `C:\Games\QuakeWorld\...\config.cfg` | Mouse1 rebind, quickfire GL/SSG/SG, weaponpreselect+weaponhide, slackers_tp.cfg reference |
| Mazer | `C:\Users\Administrator\Downloads\mazer.cfg` | Doom2-era layout, Mouse2=forward, at1-8 system, self-contained |
| BLooD_DoG | (shared in Discord) | Weapon binds in separate fire_ar.cfg, wreg system, Mouse3=forward |

## Edge cases and limitations

- **Multi-file configs**: exec references not yet followed
- **Conditional aliases**: `tempalias` with `if`/`then`/`else` not resolved (used for teamplay, not weapon binds)
- **Runtime state**: some binds change during gameplay (e.g., mouse1 rebinding). Parser sees config-save-time state.
- **Custom mods**: TF, CTF, and other mods may have different impulse mappings
- **wreg system**: high-ping weapon switching uses `wreg_` aliases — not yet parsed
