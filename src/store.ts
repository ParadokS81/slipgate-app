import { load, type Store } from "@tauri-apps/plugin-store";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ClientInfo {
  name: string;              // "ezQuake"
  exe_path: string | null;
  config_name: string | null;
  version: string | null;    // "3.6.6.7947" from PE FileVersionRaw
}

export interface GearSelection {
  handle: string;
  brand: string;
  model: string;
}

export interface SetupHardware {
  dpi: number | null;
  mouse_model: GearSelection | null;
  mousepad_model: GearSelection | null;
  keyboard_name: string | null;
  display_res_override: string | null;   // null = use auto-detected
  display_hz_override: number | null;    // null = use auto-detected
  audio_out_override: string | null;     // null = use auto-detected
  audio_in_override: string | null;      // null = use auto-detected
}

export interface Setup {
  name: string;
  primary: boolean;
  client: ClientInfo;
  hardware: SetupHardware;
}

export interface EquipmentEntry {
  type: "mouse" | "mousepad" | "keyboard" | "monitor" | "headset";
  name: string;
  from: string | null;   // "2024-03" or null if unknown
  to: string | null;     // null = currently using
}

export interface ProfileIdentity {
  discord_id: string | null;
  discord_username: string | null;
  discord_avatar: string | null;
  qw_name: string | null;
  team: string | null;
  nationality: string | null;
  residence: string | null;
  topcolor: number;
  bottomcolor: number;
}

export interface ProfilePrefs {
  map_backdrop: string;
}

export interface ProfileData {
  identity: ProfileIdentity;
  setups: Setup[];
  equipment_history: EquipmentEntry[];
  prefs: ProfilePrefs;
}

// ─── Defaults ───────────────────────────────────────────────────────────────

const DEFAULT_CLIENT: ClientInfo = {
  name: "ezQuake",
  exe_path: null,
  config_name: null,
  version: null,
};

const DEFAULT_HARDWARE: SetupHardware = {
  dpi: null,
  mouse_model: null,
  mousepad_model: null,
  keyboard_name: null,
  display_res_override: null,
  display_hz_override: null,
  audio_out_override: null,
  audio_in_override: null,
};

function createDefaultSetup(): Setup {
  return {
    name: "Desktop",
    primary: true,
    client: { ...DEFAULT_CLIENT },
    hardware: { ...DEFAULT_HARDWARE },
  };
}

const DEFAULT_IDENTITY: ProfileIdentity = {
  discord_id: null,
  discord_username: null,
  discord_avatar: null,
  qw_name: null,
  team: null,
  nationality: null,
  residence: null,
  topcolor: 0,
  bottomcolor: 0,
};

const DEFAULT_PREFS: ProfilePrefs = {
  map_backdrop: "dm3",
};

function createDefaultProfile(): ProfileData {
  return {
    identity: { ...DEFAULT_IDENTITY },
    setups: [createDefaultSetup()],
    equipment_history: [],
    prefs: { ...DEFAULT_PREFS },
  };
}

// ─── Store singleton ────────────────────────────────────────────────────────

let store: Store | null = null;

async function getStore(): Promise<Store> {
  if (!store) {
    store = await load("profile.json", { autoSave: true });
  }
  return store;
}

// ─── Migration from v1 schema ───────────────────────────────────────────────

/** Detect old schema (had top-level `hardware`/`setup` keys) and migrate */
function migrateProfile(data: any): ProfileData {
  // New format — has setups array
  if (data.setups && Array.isArray(data.setups)) {
    return {
      identity: { ...DEFAULT_IDENTITY, ...data.identity },
      setups: data.setups.map((s: any) => ({
        name: s.name ?? "Desktop",
        primary: s.primary ?? true,
        client: { ...DEFAULT_CLIENT, ...s.client },
        hardware: { ...DEFAULT_HARDWARE, ...s.hardware },
      })),
      equipment_history: data.equipment_history ?? [],
      prefs: { ...DEFAULT_PREFS, ...data.prefs },
    };
  }

  // Old format — migrate identity + prefs, create default setup
  const profile = createDefaultProfile();
  if (data.identity) {
    profile.identity = { ...DEFAULT_IDENTITY, ...data.identity };
  }
  if (data.prefs) {
    profile.prefs = { ...DEFAULT_PREFS, ...data.prefs };
  }

  // Migrate old hardware fields if they had values
  if (data.hardware) {
    const hw = data.hardware;
    if (hw.dpi) profile.setups[0].hardware.dpi = hw.dpi;
    if (hw.keyboard) profile.setups[0].hardware.keyboard_name = hw.keyboard;
  }

  // Migrate ezQuake path from localStorage (ClientsTab used to save there)
  try {
    const savedPath = localStorage.getItem("ezquake_exe_path");
    if (savedPath) {
      profile.setups[0].client.exe_path = savedPath;
      localStorage.removeItem("ezquake_exe_path");
    }
  } catch {
    // Not in browser context, skip
  }

  return profile;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/** Load the full profile, migrating from old schema if needed */
export async function loadProfile(): Promise<ProfileData> {
  const s = await getStore();
  const data = await s.get<any>("profile");
  if (!data) {
    // First launch — check localStorage for any ezQuake path to migrate
    const profile = createDefaultProfile();
    try {
      const savedPath = localStorage.getItem("ezquake_exe_path");
      if (savedPath) {
        profile.setups[0].client.exe_path = savedPath;
        localStorage.removeItem("ezquake_exe_path");
        await saveProfile(profile);
      }
    } catch { /* ignore */ }
    return profile;
  }
  return migrateProfile(data);
}

/** Save the full profile */
export async function saveProfile(profile: ProfileData): Promise<void> {
  const s = await getStore();
  await s.set("profile", profile);
}

/** Get the primary setup from a profile */
export function getPrimarySetup(profile: ProfileData): Setup {
  return profile.setups.find(s => s.primary) ?? profile.setups[0] ?? createDefaultSetup();
}

/** Update identity fields */
export async function updateIdentity(data: Partial<ProfileIdentity>): Promise<ProfileData> {
  const profile = await loadProfile();
  profile.identity = { ...profile.identity, ...data };
  await saveProfile(profile);
  return profile;
}

/** Update the primary setup's client info */
export async function updatePrimaryClient(data: Partial<ClientInfo>): Promise<ProfileData> {
  const profile = await loadProfile();
  const setup = profile.setups.find(s => s.primary) ?? profile.setups[0];
  if (setup) {
    setup.client = { ...setup.client, ...data };
  }
  await saveProfile(profile);
  return profile;
}

/** Update the primary setup's hardware */
export async function updatePrimaryHardware(data: Partial<SetupHardware>): Promise<ProfileData> {
  const profile = await loadProfile();
  const setup = profile.setups.find(s => s.primary) ?? profile.setups[0];
  if (setup) {
    setup.hardware = { ...setup.hardware, ...data };
  }
  await saveProfile(profile);
  return profile;
}

/** Update prefs */
export async function updatePrefs(data: Partial<ProfilePrefs>): Promise<ProfileData> {
  const profile = await loadProfile();
  profile.prefs = { ...profile.prefs, ...data };
  await saveProfile(profile);
  return profile;
}

/** Add an equipment history entry (e.g. when user swaps mouse) */
export async function addEquipmentHistory(entry: EquipmentEntry): Promise<ProfileData> {
  const profile = await loadProfile();
  profile.equipment_history.push(entry);
  await saveProfile(profile);
  return profile;
}

/** Clear all stored data (logout / reset) */
export async function clearStore(): Promise<void> {
  const s = await getStore();
  await s.clear();
}
