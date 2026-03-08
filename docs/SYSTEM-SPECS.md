# System Specs — What to Collect and How

The primary MVP feature. Collect hardware and software info that's useful for a QuakeWorld player profile.

---

## What to Collect

### Hardware

| Spec | Useful for QW? | Rust approach | Notes |
|------|----------------|---------------|-------|
| **CPU model** | Yes — FPS depends heavily on single-thread performance | `sysinfo::System::cpus()` → brand string | e.g., "AMD Ryzen 7 5800X" |
| **CPU cores/threads** | Moderate | `sysinfo::System::cpus().len()` | Physical vs logical |
| **CPU clock speed** | Yes — higher = more FPS in QW | `sysinfo` frequency field | Base clock; boost is harder to detect reliably |
| **GPU model** | Yes — renderer choice, max FPS | Platform-specific (see below) | e.g., "NVIDIA RTX 4070" |
| **GPU VRAM** | Moderate | Platform-specific | Relevant for high-res textures |
| **GPU driver version** | Yes — driver bugs affect QW | Platform-specific | Helps troubleshooting |
| **RAM total** | Yes — minimum for QW is low but matters for multitasking | `sysinfo::System::total_memory()` | In GB |
| **RAM speed** | Moderate | Not in `sysinfo` — platform-specific or skip | DDR4-3200 vs DDR5-6000 |
| **Display resolution** | Yes — 1080p vs 1440p vs 4K affects FPS and visibility | Tauri window/monitor APIs or platform-specific | Primary monitor |
| **Display refresh rate** | Yes — 144Hz vs 240Hz is a common topic | Platform-specific | Important for competitive play |
| **Monitor count** | Low | Tauri monitor API | Nice to know |

### Software

| Spec | Useful for QW? | Approach | Notes |
|------|----------------|----------|-------|
| **OS name + version** | Yes — troubleshooting | `sysinfo::System::name()`, `os_version()` | "Windows 11 23H2", "Ubuntu 24.04", "macOS 15.2" |
| **OS architecture** | Moderate | `std::env::consts::ARCH` | x86_64 vs ARM |
| **ezQuake version** | Yes | Parse binary or config file | If ezQuake is detected |
| **ezQuake renderer** | Yes | Parse `config.cfg` for `vid_renderer` | OpenGL vs Vulkan |
| **ezQuake resolution** | Yes | Parse `config.cfg` for `vid_width`/`vid_height` | In-game resolution |
| **ezQuake FPS cap** | Yes | Parse `config.cfg` for `cl_maxfps` | Common: 1000, 500, 250 |
| **Network type** | Low | Hard to detect reliably | Wired vs WiFi, approximate speed |

### What NOT to Collect

- MAC addresses, IP addresses, or any network identifiers
- Exact disk contents or file listings
- Running process list (beyond ezQuake detection)
- Browser history, installed software list
- Anything that could be considered surveillance

**Privacy principle:** Only collect what a player would willingly type into a forum post about their setup. Nothing more.

---

## GPU Detection (Platform-Specific)

The `sysinfo` crate doesn't expose GPU info well. This is the main platform-specific code.

### Windows
```rust
// Option 1: WMI (Windows Management Instrumentation)
// Query Win32_VideoController for Name, AdapterRAM, DriverVersion
// Crate: `wmi` (pure Rust WMI client)

// Option 2: DirectX/DXGI
// Use `windows` crate to query DXGI adapters
// More reliable for multi-GPU systems

// Option 3: Command fallback
// wmic path win32_VideoController get Name,AdapterRAM,DriverVersion
```

### Linux
```rust
// Option 1: Parse /proc/driver/nvidia/gpus/*/information (NVIDIA)
// Option 2: Parse `lspci -v` output for VGA controller
// Option 3: DRM subsystem: /sys/class/drm/card*/device/
// Option 4: `vulkaninfo` if Vulkan is installed
// Crate: Consider `gpu-info` or similar if one matures
```

### macOS
```rust
// system_profiler SPDisplaysDataType -json
// Returns GPU model, VRAM, resolution, display info all in one
// Parse JSON output — clean and reliable
```

### Recommendation

Use the `wgpu` crate's adapter enumeration — it works cross-platform and returns GPU name and backend info. This is what game engines use. If more detail is needed (VRAM, driver version), fall back to platform-specific methods.

```rust
// wgpu approach (cross-platform)
let instance = wgpu::Instance::new(Default::default());
let adapter = instance.request_adapter(&Default::default()).await;
if let Some(adapter) = adapter {
    let info = adapter.get_info();
    // info.name = "NVIDIA GeForce RTX 4070"
    // info.vendor = vendor ID
    // info.backend = Vulkan/Metal/DX12
}
```

---

## Data Shape (What Gets Uploaded)

The specs object that gets stored on the user's profile:

```typescript
interface SystemSpecs {
  // Hardware
  cpu: {
    model: string;          // "AMD Ryzen 7 5800X 8-Core Processor"
    cores: number;          // 8
    threads: number;        // 16
    clockMhz: number;       // 3800
  };
  gpu: {
    model: string;          // "NVIDIA GeForce RTX 4070"
    vramMb: number | null;  // 12288
    driver: string | null;  // "551.23"
  };
  ram: {
    totalGb: number;        // 32
    speed: string | null;   // "DDR4-3200" — may not be detectable on all platforms
  };
  display: {
    resolution: string;     // "2560x1440"
    refreshHz: number;      // 165
    monitors: number;       // 2
  };
  os: {
    name: string;           // "Windows 11 Pro"
    version: string;        // "23H2"
    arch: string;           // "x86_64"
  };

  // QW-specific (if ezQuake detected)
  ezquake: {
    detected: boolean;
    version: string | null;
    renderer: string | null;  // "gl" | "vulkan"
    resolution: string | null; // "1920x1080" (in-game, may differ from display)
    maxFps: number | null;    // 1000
  } | null;

  // Metadata
  collectedAt: string;       // ISO 8601 timestamp
  appVersion: string;        // Slipgate App version that collected this
}
```

### Firestore Storage

```
users/{uid}/systemSpecs  (subcollection or field — TBD based on Slipgate web schema)
```

Or as a field on the user document:
```
users/{uid}.systemSpecs: SystemSpecs
```

The web profile page reads this and displays it. The desktop app writes it. Simple.

---

## User Experience

1. **First launch:** App collects specs automatically on first run. Shows them in a "Your System" panel
2. **Review:** User sees what was detected, can correct anything wrong (rare but possible with multi-GPU systems)
3. **Upload:** User clicks "Upload to Profile" — requires being logged in
4. **Updates:** App can re-scan periodically or on demand. If specs change (new GPU, more RAM), user is prompted to update their profile
5. **Privacy:** User always sees exactly what will be uploaded. Nothing is sent without explicit action

## Open Questions

- [ ] Should specs update automatically (with user opt-in) or always require manual "Upload" action?
- [ ] Do we need a "spec comparison" feature? (Compare your setup to another player's)
- [ ] Should the web profile show spec history? (Upgraded from GTX 1060 → RTX 4070)
- [ ] Where exactly in Firestore does this live? Field on user doc or separate collection?
