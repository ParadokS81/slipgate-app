import { createSignal, Match, onMount, Switch } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { currentMonitor, availableMonitors } from "@tauri-apps/api/window";
import type { AllSpecs, MonitorInfo, EzQuakeConfig, EzQuakeInstallation } from "./types";
import type { ProfileData, SetupHardware, ClientInfo } from "./store";
import { loadProfile, updatePrimaryClient, updatePrimaryHardware, getPrimarySetup } from "./store";
import SideNav from "./components/SideNav";
import ProfileTab from "./components/ProfileTab";
import ToolsTab from "./components/ToolsTab";
import ClientsTab from "./components/ClientsTab";
import ScheduleTab from "./components/ScheduleTab";
import SettingsTab from "./components/SettingsTab";

function App() {
  const [activeTab, setActiveTab] = createSignal("profile");
  const [specs, setSpecs] = createSignal<AllSpecs | null>(null);
  const [monitor, setMonitor] = createSignal<MonitorInfo | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [ezConfig, setEzConfig] = createSignal<EzQuakeConfig | null>(null);
  const [profile, setProfile] = createSignal<ProfileData | null>(null);

  async function loadSpecs() {
    try {
      const [allSpecs, monitors, primary] = await Promise.all([
        invoke<AllSpecs>("get_all_specs"),
        availableMonitors(),
        currentMonitor(),
      ]);
      setSpecs(allSpecs);
      if (primary) {
        setMonitor({
          name: primary.name,
          resolution: `${primary.size.width}x${primary.size.height}`,
          count: monitors.length,
        });
      }
    } catch (e) {
      console.error("Failed to load specs:", e);
    }
  }

  /** Try to auto-load ezQuake config from saved client path */
  async function autoLoadConfig(prof: ProfileData) {
    const setup = getPrimarySetup(prof);
    const exePath = setup.client.exe_path;
    if (!exePath) return;

    try {
      // Validate the path still exists and get version
      const info = await invoke<EzQuakeInstallation>("validate_ezquake_path", { exePath });
      if (!info.valid) return;

      // Update stored version if it changed
      if (info.version !== setup.client.version) {
        const updated = await updatePrimaryClient({ version: info.version });
        setProfile(updated);
      }

      // Load the config
      const cfgName = setup.client.config_name
        ?? (info.config_files.includes("config.cfg") ? "config.cfg" : info.config_files[0]);
      if (cfgName) {
        const cfg = await invoke<EzQuakeConfig>("read_ezquake_config", {
          exePath,
          configName: cfgName,
        });
        setEzConfig(cfg);
        if (cfg.weapon_binds?.length) {
          console.log("=== WEAPON BINDS ===");
          for (const wb of cfg.weapon_binds) {
            const method = wb.method === "quickfire" ? "⚡ quickfire" : `🎯 manual → ${wb.fire_key}`;
            console.log(`  ${wb.weapon.toUpperCase().padEnd(4)} ${wb.key.padEnd(10)} ${method}`);
          }
        }
      }
    } catch (e) {
      console.error("Failed to auto-load config:", e);
    }
  }

  onMount(async () => {
    setLoading(true);

    // Load profile and specs in parallel
    const [_, prof] = await Promise.all([
      loadSpecs(),
      loadProfile(),
    ]);
    setProfile(prof);

    // Auto-load ezQuake config if we have a saved path
    await autoLoadConfig(prof);

    setLoading(false);
  });

  /** Called by ClientsTab when a config is loaded (updates both signal and store) */
  async function handleConfigLoaded(cfg: EzQuakeConfig, exePath: string, configName: string, version: string | null) {
    setEzConfig(cfg);
    const updated = await updatePrimaryClient({
      exe_path: exePath,
      config_name: configName,
      version,
    });
    setProfile(updated);
  }

  /** Called by ProfileTab/ClientsTab to update hardware in the store */
  async function handleHardwareUpdate(data: Partial<SetupHardware>) {
    const updated = await updatePrimaryHardware(data);
    setProfile(updated);
  }

  return (
    <div class="flex flex-col h-full">
      {/* Main layout: sidebar + content */}
      <div class="flex flex-1 overflow-hidden">
        {/* Sidebar navigation */}
        <SideNav active={activeTab()} onSelect={setActiveTab} />

        {/* Content area */}
        <main class="flex-1 overflow-y-auto sg-profile-content">
          <Switch>
            <Match when={activeTab() === "schedule"}>
              <ScheduleTab />
            </Match>
            <Match when={activeTab() === "profile"}>
              <ProfileTab
                specs={specs()}
                monitor={monitor()}
                loading={loading()}
                onRefresh={loadSpecs}
                ezConfig={ezConfig()}
                profile={profile()}
                onHardwareUpdate={handleHardwareUpdate}
              />
            </Match>
            <Match when={activeTab() === "tools"}>
              <ToolsTab
                ezConfig={ezConfig()}
                monitor={monitor()}
                refreshHz={specs()?.display.refresh_hz ?? null}
                savedDpi={profile() ? getPrimarySetup(profile()!).hardware.dpi : null}
              />
            </Match>
            <Match when={activeTab() === "clients"}>
              <ClientsTab
                onConfigLoaded={handleConfigLoaded}
                monitor={monitor()}
                profile={profile()}
              />
            </Match>
            <Match when={activeTab() === "settings"}>
              <SettingsTab />
            </Match>
          </Switch>
        </main>
      </div>

      {/* Footer */}
      <div class="sg-footer">
        QuakeWorld Desktop Companion
      </div>
    </div>
  );
}

export default App;
