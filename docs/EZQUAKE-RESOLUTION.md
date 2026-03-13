# ezQuake Resolution Logic — Source Code Analysis

**Source:** `ezquake-source/src/vid_sdl2.c` from https://github.com/ezQuake/ezquake-source

## Resolution Determination Flowchart

```
vid_fullscreen?
├── YES (fullscreen)
│   ├── vid_usedesktopres 1? (DEFAULT — ~97% of players)
│   │   └── Resolution = SDL_GetDesktopDisplayMode() → desktop res & Hz
│   │       Window type: SDL_WINDOW_FULLSCREEN_DESKTOP (borderless)
│   │       vid_width/vid_height/vid_displayfrequency → AUTO-SET as outputs
│   │
│   └── vid_usedesktopres 0?
│       ├── vid_width > 0 AND vid_height > 0?
│       │   ├── Find matching SDL mode (res + Hz)
│       │   │   ├── Exact match → use it (exclusive fullscreen)
│       │   │   ├── Res match, Hz mismatch → use highest Hz for that res
│       │   │   └── No match → fallback to last_working or desktop res
│       │   └── Window type: SDL_WINDOW_FULLSCREEN (exclusive)
│       │
│       └── vid_width 0 OR vid_height 0?
│           └── Fallback: 1024x768, Hz = 0 (driver default)
│
└── NO (windowed)
    ├── vid_win_width > 0 AND vid_win_height > 0?
    │   └── Resolution = vid_win_width x vid_win_height (min 320x240)
    └── Either is 0?
        └── Fallback: 640x480
```

## Key Insight for Slipgate

**`vid_width` and `vid_height` always reflect the actual playing resolution in fullscreen mode.** When `vid_usedesktopres 1`, ezQuake auto-sets these cvars to the desktop resolution — they become read-only outputs, not inputs. So we can always read `vid_width`/`vid_height` from the config to know the fullscreen resolution.

However: these values are only written to the config when the user does `cfg_save` (or ezQuake auto-saves on exit). If the user has `cfg_save_unchanged 0` (the default), these auto-set values WILL be saved because ezQuake sets them explicitly.

## Three Resolution Layers

ezQuake has three independent resolution concepts:

1. **Display resolution** (`glConfig.vidWidth/Height`) — the actual window/screen size
   - Controlled by: vid_fullscreen + vid_usedesktopres + vid_width/height or vid_win_width/height

2. **Console/2D resolution** (`vid_conwidth/conheight`) — HUD, text, menus
   - If both 0: computed as `displayRes / vid_conscale` (default conscale = 2.0)
   - Can be set independently for crisp HUD at lower render res

3. **3D rendering resolution** (`vid_framebuffer` system)
   - If `vid_framebuffer 1` + `vid_framebuffer_scale` > 0: render at displayRes/scale
   - If `vid_framebuffer_width/height` set: use those exact values
   - Otherwise: same as display resolution

## Cvar Reference

| Cvar | Default | Purpose |
|------|---------|---------|
| `vid_fullscreen` | `1` | Fullscreen (1) or windowed (0) |
| `vid_usedesktopres` | `1` | Use desktop resolution in fullscreen |
| `vid_width` | `0` | Fullscreen width (auto-set when usedesktopres=1) |
| `vid_height` | `0` | Fullscreen height (auto-set when usedesktopres=1) |
| `vid_win_width` | `640` | Windowed mode width |
| `vid_win_height` | `480` | Windowed mode height |
| `vid_displayfrequency` | `0` | Refresh rate (auto-set in most cases) |
| `vid_conwidth` | `0` | Console/2D width (0 = auto from conscale) |
| `vid_conheight` | `0` | Console/2D height (0 = auto from conscale) |
| `vid_conscale` | `2.0` | Auto-scale divisor for console resolution |
| `vid_framebuffer` | `0` | Enable separate 3D render resolution |
| `vid_framebuffer_scale` | `0` | 3D render scale divisor |
| `vid_displaynumber` | `0` | Which monitor (fullscreen) |
| `vid_win_displaynumber` | `0` | Which monitor (windowed) |

## Detection Logic for Slipgate

```
IF vid_fullscreen != 0:
    IF vid_width > 0 AND vid_height > 0:
        playing_res = vid_width x vid_height  (works for both usedesktopres modes)
    ELSE:
        playing_res = desktop resolution (from system detection)
ELSE:
    IF vid_win_width > 0 AND vid_win_height > 0:
        playing_res = vid_win_width x vid_win_height
    ELSE:
        playing_res = 640x480 (default)
```

Note: `r_mode` does NOT exist in ezQuake. It's a Quake 3 / id Tech 3 cvar.

## The "Absent = Default" Pattern

ezQuake's `cfg_save_unchanged 0` (the **default**) means only non-default cvar values are written to `config.cfg`. This is the core challenge of config-based detection: **most players' configs are missing the very cvars we need**, because their settings match the defaults.

Our strategy: we maintain a table of known defaults in the Rust parser (`default_cvars()` in `ezquake.rs`). When a cvar is absent from the config file, we use the default value. Since we know the defaults, absence is not ambiguity — it's information.

### Decision table for resolution

| `vid_fullscreen` in cfg | `vid_usedesktopres` in cfg | `vid_width` in cfg | What player is using | What we show |
|---|---|---|---|---|
| absent (default `1`) | absent (default `1`) | absent (default `0`) | Desktop res, fullscreen | Desktop res from system scan |
| absent (default `1`) | `0` | present, > 0 | Custom fullscreen res | `vid_width x vid_height` |
| absent (default `1`) | `0` | absent (default `0`) | ezQuake fallback 1024x768 | Desktop res* |
| `0` | n/a | n/a | Windowed mode | `vid_win_width x vid_win_height` |

*Edge case: `vid_usedesktopres 0` + `vid_width 0` → ezQuake uses 1024x768, but we can't distinguish this from the common case where both are absent/default. This affects ~0% of players so we accept the inaccuracy.

### What we always know vs. what we deduce

- **Always known:** Desktop resolution (from Tauri's `currentMonitor()` API — independent of any game client)
- **Deduced from config:** Whether the player uses desktop res or a custom resolution
- **Runtime-only (invisible to us):** The `auto` value that ezQuake computes internally (e.g. `default 0, current 0, auto 2560`). This never appears in `config.cfg`.

### Applying this pattern to future clients

Other QW clients (fteqw, vkQuake, etc.) will have different config formats and default behaviors. The general approach remains the same:

1. Know the client's defaults for the cvars we care about
2. Parse the config, filling in defaults for absent values
3. Fall back to desktop resolution when the config doesn't specify one
4. Document client-specific quirks (like `cfg_save_unchanged`) in this doc

## Platform Behavior

The resolution logic is **platform-independent** (all SDL2). Platform-specific code only exists for:
- Linux/X11: gamma ramp workaround
- macOS: disables spaces-based fullscreen
- All: raw input handling differs
