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
  image: string | null;          // EloShapes PNG filename e.g. "zowie-ec2-wireless.png"
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

export interface WeaponBind {
  weapon: string;           // "rl", "lg", "gl", "sng", "ng", "ssg", "sg", "axe"
  key: string;              // display name of the key
  method: string;           // "quickfire" or "manual"
  fire_key: string | null;  // for manual: which key fires (usually "Mouse1")
}

export interface EzQuakeConfig {
  player_name: string;
  player_name_qw: QwStyledChar[];
  team: string;
  team_qw: QwStyledChar[];
  topcolor: number;
  bottomcolor: number;
  sensitivity: number;
  lg_sensitivity: number | null;  // different sensitivity for LG, if detected
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
  weapon_binds: WeaponBind[];
  raw_cvars: Record<string, string>;
}

// ─── Client updater types ───────────────────────────────────────────────────

export interface ReleaseNote {
  version: string;
  published_at: string;
  body: string;
}

export interface SnapshotInfo {
  available: boolean;
  filename: string;
  date: string;
  commit: string;
  download_url: string;
  checksum_url: string;
  newer_than_stable: boolean;
}

export interface UpdateCheckResult {
  update_available: boolean;
  current_version: string | null;
  current_build: string | null;
  latest_version: string;
  download_url: string;
  checksums_url: string | null;
  release_notes: ReleaseNote[];
  channel: string;
  snapshot: SnapshotInfo | null;
}

export interface UpdateProgress {
  stage: "downloading" | "verifying" | "backing_up" | "installing" | "done" | "error";
  percent: number | null;
  message: string;
}

export interface UpdateResult {
  success: boolean;
  new_version: string | null;
  backup_path: string | null;
  error: string | null;
}
