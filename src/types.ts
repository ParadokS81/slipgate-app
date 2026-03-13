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

// EloShapes data types
export interface MouseEntry {
  handle: string;
  brand: string;
  model: string;
  weight: number | null;
  wireless: boolean | null;
}

export interface MousepadEntry {
  handle: string;
  brand: string;
  model: string;
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
}

export interface EzQuakeConfig {
  player_name: string;
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
  raw_cvars: Record<string, string>;
}
