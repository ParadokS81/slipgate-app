import { load, type Store } from "@tauri-apps/plugin-store";

// Profile data shape — backend-agnostic, ready for Firestore or Supabase
export interface ProfileData {
  identity: {
    discord_id: string | null;
    discord_username: string | null;
    discord_avatar: string | null;
    qw_name: string | null;
    team: string | null;
    nationality: string | null;      // ISO 3166-1 alpha-2 (e.g. "se")
    residence: string | null;        // ISO 3166-1 alpha-2 (different if living abroad)
    topcolor: number;
    bottomcolor: number;
  };
  setup: {
    cm360: number | null;
    display_res: string | null;      // "2560x1440"
    display_hz: number | null;
    fov: number | null;
    movement_keys: string | null;    // "WASD" or custom
  };
  hardware: {
    cpu: string | null;
    gpu: string | null;
    ram: string | null;
    os: string | null;
    monitor_model: string | null;
    monitor_count: number | null;
    mouse: string | null;            // "ZOWIE EC2-C"
    mousepad: string | null;
    keyboard: string | null;
    audio_out: string | null;
    audio_in: string | null;
    dpi: number | null;
    sensitivity: number | null;
    m_yaw: number | null;
  };
  prefs: {
    map_backdrop: string;            // default "dm3"
  };
}

const DEFAULT_PROFILE: ProfileData = {
  identity: {
    discord_id: null, discord_username: null, discord_avatar: null,
    qw_name: null, team: null,
    nationality: null, residence: null,
    topcolor: 0, bottomcolor: 0,
  },
  setup: {
    cm360: null, display_res: null, display_hz: null, fov: null, movement_keys: null,
  },
  hardware: {
    cpu: null, gpu: null, ram: null, os: null,
    monitor_model: null, monitor_count: null,
    mouse: null, mousepad: null, keyboard: null,
    audio_out: null, audio_in: null,
    dpi: null, sensitivity: null, m_yaw: null,
  },
  prefs: {
    map_backdrop: "dm3",
  },
};

let store: Store | null = null;

/** Get or create the store instance */
async function getStore(): Promise<Store> {
  if (!store) {
    store = await load("profile.json", { autoSave: true });
  }
  return store;
}

/** Load the full profile from local storage */
export async function loadProfile(): Promise<ProfileData> {
  const s = await getStore();
  const data = await s.get<ProfileData>("profile");
  if (!data) return { ...DEFAULT_PROFILE };
  // Merge with defaults to handle missing fields from older versions
  return {
    identity: { ...DEFAULT_PROFILE.identity, ...data.identity },
    setup: { ...DEFAULT_PROFILE.setup, ...data.setup },
    hardware: { ...DEFAULT_PROFILE.hardware, ...data.hardware },
    prefs: { ...DEFAULT_PROFILE.prefs, ...data.prefs },
  };
}

/** Save the full profile to local storage */
export async function saveProfile(profile: ProfileData): Promise<void> {
  const s = await getStore();
  await s.set("profile", profile);
}

/** Update a single section of the profile */
export async function updateProfileSection<K extends keyof ProfileData>(
  section: K,
  data: Partial<ProfileData[K]>,
): Promise<ProfileData> {
  const profile = await loadProfile();
  (profile[section] as any) = { ...profile[section], ...data };
  await saveProfile(profile);
  return profile;
}

/** Clear all stored data (logout) */
export async function clearStore(): Promise<void> {
  const s = await getStore();
  await s.clear();
}
