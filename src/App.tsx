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
  { id: "profile", label: "Profile" },
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
    <div class="flex flex-col h-full">
      {/* Header + Tabs — gradient box like gnoffa's design */}
      <div class="sg-box flex flex-wrap items-center" style={{ "border-radius": "6px 6px 0 0" }}>
        {/* Title row */}
        <div class="flex items-center w-full" style={{ height: "40px" }}>
          <div
            class="flex items-center flex-1 px-2.5 font-semibold"
            style={{ color: "var(--sg-text-bright)", "text-shadow": "0 2px 0 var(--sg-header-shadow)" }}
          >
            <img src="/img/666.png" alt="" class="w-6 h-6 mr-1.5" />
            Slipgate
          </div>
        </div>

        {/* Separator */}
        <div class="sg-hsep" />

        {/* Tabs */}
        <TabNav
          tabs={[...TABS]}
          active={activeTab()}
          onSelect={setActiveTab}
        />
      </div>

      {/* Tab content */}
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
            />
          </Match>
          <Match when={activeTab() === "settings"}>
            <SettingsTab />
          </Match>
        </Switch>
      </main>

      {/* Footer */}
      <div class="sg-footer">
        QuakeWorld Desktop Companion
      </div>
    </div>
  );
}

export default App;
