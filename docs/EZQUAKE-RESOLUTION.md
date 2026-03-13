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

## Platform Behavior

The resolution logic is **platform-independent** (all SDL2). Platform-specific code only exists for:
- Linux/X11: gamma ramp workaround
- macOS: disables spaces-based fullscreen
- All: raw input handling differs
