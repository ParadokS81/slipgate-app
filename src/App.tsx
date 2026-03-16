import { createSignal, Match, onMount, Switch } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { currentMonitor, availableMonitors } from "@tauri-apps/api/window";
import type { AllSpecs, MonitorInfo, EzQuakeConfig } from "./types";
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

  async function loadSpecs() {
    setLoading(true);
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
    setLoading(false);
  }

  onMount(() => {
    loadSpecs();
  });

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
              />
            </Match>
            <Match when={activeTab() === "tools"}>
              <ToolsTab
                ezConfig={ezConfig()}
                monitor={monitor()}
                refreshHz={specs()?.display.refresh_hz ?? null}
              />
            </Match>
            <Match when={activeTab() === "clients"}>
              <ClientsTab onConfigLoaded={setEzConfig} monitor={monitor()} />
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
