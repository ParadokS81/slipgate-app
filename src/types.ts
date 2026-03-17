export interface AudioDevice {
  name: string;
  device_type: "input" | "output";
}

export interface HidDevice {
  name: string;
  device_type: "mouse" | "keyboard" | "other";
}

export interface AllSpecs {
  cpu: { model: string; cores: number; threads: number };
  gpu: {
    model: string;
    vram_mb: number | null;
    driver_version: string | null;
  } | null;
  ram: { total_gb: number; ddr_generation: string | null };
  os: { name: string; version: string; arch: string };
  display: { refresh_hz: number | null; monitor_name: string | null; manufacturer: string | null };
  audio_devices: AudioDevice[];
  hid_devices: HidDevice[];
}

export interface MonitorInfo {
  name: string | null;
  resolution: string;
  count: number;
}

// EloShapes data types (expanded schema)
export interface MouseEntry {
  handle: string;
  brand: string;
  model: string;
  weight: number | null;
  wireless: boolean | null;
  shape: string | null;          // "ergonomic" | "symmetrical"
  size: string | null;           // "small" | "medium" | "large"
  hand: string | null;           // "right" | "left" | "both"
  sensor: string | null;         // e.g. "PAW3395"
  max_dpi: number | null;
  polling_rate: number | null;
  length: number | null;         // mm
  width: number | null;          // mm
  height: number | null;         // mm
}

export interface MousepadSize {
  name: string;                  // "Small" | "Medium" | "Large" | "XL" | "XXL"
  dimensions: string | null;     // "490 × 420"
}

export interface MousepadEntry {
  handle: string;
  brand: string;
  model: string;
  speed: string | null;          // "control" | "balanced" | "speed"
  texture: string | null;        // "textured" | "smooth"
  firmness: string | null;       // "soft" | "mid" | "firm" | "hard"
  thickness: number | null;      // mm
  surface_material: string | null; // "fabric" | "glass" | "plastic" | "polyester"
  width: number | null;          // mm (single-size pads)
  length: number | null;         // mm
  edges: string | null;          // "stitched" | "raw"
  sizes: MousepadSize[] | null;  // available size variants
}

// User's gear selections (frontend state)
export interface GearProfile {
  mouse: { handle: string; brand: string; model: string } | null;
  mousepad: { handle: string; brand: string; model: string } | null;
  keyboardName: string | null;
  dpi: number | null;
  sensitivity: number | null;
}

// ezQuake integration types
export interface EzQuakeInstallation {
  exe_path: string;
  config_dir: string;
  config_files: string[];
  valid: boolean;
  version: string | null;  // "3.6.6.7947" from PE FileVersionRaw
}

/** A single styled character in a QW nickname (from Rust QW name expander) */
export interface QwStyledChar {
  ch: string;
  color: "w" | "b" | "g"; // white, brown, gold
}

export interface MovementKeys {
  forward: string;
  back: string;
  moveleft: string;
  moveright: string;
  jump: string;
}

export interface EzQuakeConfig {
  player_name: string;
  player_name_qw: QwStyledChar[];
  team: string;
  team_qw: QwStyledChar[];
  topcolor: number;
  bottomcolor: number;
  sensitivity: number;
  m_yaw: number;
  m_pitch: number;
  m_accel: number;
  fov: number;
  in_raw: boolean;
  vid_usedesktopres: boolean;
  vid_width: number;
  vid_height: number;
  vid_displayfrequency: number;
  cl_maxfps: number;
  movement: MovementKeys;
  raw_cvars: Record<string, string>;
}
