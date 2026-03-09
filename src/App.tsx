import { createSignal, Match, onMount, Switch } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { currentMonitor, availableMonitors } from "@tauri-apps/api/window";
import type { AllSpecs, MonitorInfo } from "./types";
import TabNav from "./components/TabNav";
import ProfileTab from "./components/ProfileTab";
import ScheduleTab from "./components/ScheduleTab";
import SettingsTab from "./components/SettingsTab";

const TABS = [
  { id: "schedule", label: "Schedule" },
  { id: "profile", label: "Profile & Gear" },
  { id: "settings", label: "Settings" },
] as const;

function App() {
  const [activeTab, setActiveTab] = createSignal("profile");
  const [specs, setSpecs] = createSignal<AllSpecs | null>(null);
  const [monitor, setMonitor] = createSignal<MonitorInfo | null>(null);
  const [loading, setLoading] = createSignal(true);

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
    <div class="flex flex-col h-full bg-base-200 text-base-content">
      {/* Header */}
      <header class="flex items-center justify-between px-4 py-3 bg-base-300">
        <div class="flex items-center gap-3">
          <span class="text-lg font-bold">Slipgate</span>
        </div>
        {/* User info — placeholder until auth */}
        <div class="flex items-center gap-2">
          <div class="avatar placeholder">
            <div class="bg-base-content/10 text-base-content/40 w-7 rounded-full">
              <span class="text-[10px]">QW</span>
            </div>
          </div>
          <span class="text-xs opacity-30">Not logged in</span>
        </div>
      </header>

      {/* Tab navigation */}
      <TabNav
        tabs={[...TABS]}
        active={activeTab()}
        onSelect={setActiveTab}
      />

      {/* Tab content */}
      <main class="flex-1 overflow-y-auto p-4">
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
            />
          </Match>
          <Match when={activeTab() === "settings"}>
            <SettingsTab />
          </Match>
        </Switch>
      </main>

      {/* Footer */}
      <footer class="px-4 py-1.5 bg-base-300 border-t border-base-content/5 text-[10px] opacity-20 text-center">
        QuakeWorld Desktop Companion
      </footer>
    </div>
  );
}

export default App;
