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
  ram: { total_gb: number };
  os: { name: string; version: string; arch: string };
  display: { refresh_hz: number | null; monitor_name: string | null };
  audio_devices: AudioDevice[];
  hid_devices: HidDevice[];
}

export interface MonitorInfo {
  name: string | null;
  resolution: string;
  count: number;
}
