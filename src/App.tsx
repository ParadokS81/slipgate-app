import { createSignal, onMount, Show, For } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { currentMonitor, availableMonitors } from "@tauri-apps/api/window";

interface SystemSpecs {
  cpu: { model: string; cores: number; threads: number };
  gpu: { model: string; vram_mb: number | null; driver_version: string | null } | null;
  ram: { total_gb: number };
  os: { name: string; version: string; arch: string };
  display: { refresh_hz: number | null; monitor_name: string | null };
}

interface MonitorInfo {
  name: string | null;
  resolution: string;
  count: number;
}

interface AudioDevice {
  name: string;
  device_type: "input" | "output";
}

interface HidDevice {
  name: string;
  device_type: "mouse" | "keyboard" | "other";
}

interface PeripheralSpecs {
  audio_devices: AudioDevice[];
  hid_devices: HidDevice[];
}

function App() {
  const [greetMsg, setGreetMsg] = createSignal("");
  const [name, setName] = createSignal("");
  const [specs, setSpecs] = createSignal<SystemSpecs | null>(null);
  const [monitor, setMonitor] = createSignal<MonitorInfo | null>(null);
  const [peripherals, setPeripherals] = createSignal<PeripheralSpecs | null>(null);
  const [loading, setLoading] = createSignal(true);

  async function greet() {
    setGreetMsg(await invoke("greet", { name: name() }));
  }

  async function loadSpecs() {
    setLoading(true);
    try {
      const [sysSpecs, monitors, primary, periph] = await Promise.all([
        invoke<SystemSpecs>("get_system_specs"),
        availableMonitors(),
        currentMonitor(),
        invoke<PeripheralSpecs>("get_peripheral_specs"),
      ]);
      setSpecs(sysSpecs);
      setPeripherals(periph);
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

  function formatRam(gb: number): string {
    return `${Math.round(gb)} GB`;
  }

  /** Format OS into a short string: "Win 11", "Ubuntu 22.04", "macOS 14" */
  function formatOs(name: string, version: string): string {
    const ver = version.split("(")[0].trim(); // strip "(26100)" build numbers
    if (name === "Windows") return `Win ${ver}`;
    // Linux: name is the distro (Ubuntu, Debian, Arch Linux, etc.)
    if (ver) return `${name} ${ver}`;
    return name;
  }

  return (
    <div class="flex flex-col h-full bg-base-200 text-base-content">
      {/* Header */}
      <header class="flex items-center justify-between px-4 py-3 bg-base-300 border-b border-base-content/5">
        <span class="text-lg font-bold">Slipgate</span>
        <span class="text-xs opacity-30 font-mono">v0.1.0</span>
      </header>

      {/* Main content */}
      <main class="flex-1 overflow-y-auto p-4 space-y-4">
        {/* User section placeholder */}
        <div class="flex items-center gap-3">
          <div class="avatar placeholder">
            <div class="bg-base-300 text-base-content/50 w-10 rounded-full">
              <span class="text-xs">QW</span>
            </div>
          </div>
          <div>
            <div class="font-medium">Not logged in</div>
            <div class="text-xs opacity-40">Connect with Discord</div>
          </div>
        </div>

        <div class="divider my-1 opacity-20" />

        {/* System specs */}
        <section>
          <div class="flex items-center justify-between mb-2">
            <h2 class="text-xs font-semibold uppercase tracking-wider opacity-40">System</h2>
            <button
              class="text-xs opacity-30 hover:opacity-60 transition-opacity"
              onClick={loadSpecs}
            >
              Refresh
            </button>
          </div>
          <Show when={!loading()} fallback={
            <div class="grid grid-cols-2 gap-2">
              <div class="bg-base-300 rounded-box p-3">
                <div class="text-xs opacity-30 mb-1">CPU</div>
                <div class="font-mono text-sm opacity-25">Detecting...</div>
              </div>
              <div class="bg-base-300 rounded-box p-3">
                <div class="text-xs opacity-30 mb-1">GPU</div>
                <div class="font-mono text-sm opacity-25">Detecting...</div>
              </div>
              <div class="bg-base-300 rounded-box p-3 flex">
                <div class="flex-1">
                  <div class="text-xs opacity-30 mb-1">RAM</div>
                  <div class="font-mono text-sm opacity-25">--</div>
                </div>
                <div class="flex-1">
                  <div class="text-xs opacity-30 mb-1">OS</div>
                  <div class="font-mono text-sm opacity-25">--</div>
                </div>
              </div>
              <div class="bg-base-300 rounded-box p-3">
                <div class="text-xs opacity-30 mb-1">Display</div>
                <div class="font-mono text-sm opacity-25">Detecting...</div>
              </div>
            </div>
          }>
            <div class="grid grid-cols-2 gap-2">
              <div class="bg-base-300 rounded-box p-3">
                <div class="text-xs opacity-30 mb-1">CPU</div>
                <div class="font-mono text-sm truncate" title={specs()?.cpu.model}>
                  {specs()?.cpu.model}
                </div>
              </div>
              <div class="bg-base-300 rounded-box p-3">
                <div class="text-xs opacity-30 mb-1">GPU</div>
                <div class="font-mono text-sm truncate" title={specs()?.gpu?.model}>
                  {specs()?.gpu?.model ?? "Not detected"}
                </div>
              </div>
              <div class="bg-base-300 rounded-box p-3 flex">
                <div class="flex-1">
                  <div class="text-xs opacity-30 mb-1">RAM</div>
                  <div class="font-mono text-sm">
                    {specs() ? formatRam(specs()!.ram.total_gb) : "--"}
                  </div>
                </div>
                <div class="flex-1">
                  <div class="text-xs opacity-30 mb-1">OS</div>
                  <div class="font-mono text-sm truncate">
                    {specs() ? formatOs(specs()!.os.name, specs()!.os.version) : "--"}
                  </div>
                </div>
              </div>
              <div class="bg-base-300 rounded-box p-3">
                <div class="text-xs opacity-30 mb-1 truncate">
                  {"Display"}
                  {monitor() && monitor()!.count > 1 ? ` 1/${monitor()!.count}` : ""}
                  {specs()?.display.monitor_name ? ` ${specs()!.display.monitor_name}` : ""}
                </div>
                <div class="font-mono text-sm truncate">
                  {monitor()?.resolution ?? "--"}
                  {specs()?.display.refresh_hz ? ` @ ${specs()!.display.refresh_hz}Hz` : ""}
                </div>
              </div>
            </div>
          </Show>
        </section>

        {/* Peripherals */}
        <Show when={peripherals()}>
          {(p) => {
            const mice = () => p().hid_devices.filter(d => d.device_type === "mouse");
            const keyboards = () => p().hid_devices.filter(d => d.device_type === "keyboard");
            const microphones = () => p().audio_devices.filter(d => d.device_type === "input");

            const hasAnything = () =>
              mice().length > 0 || keyboards().length > 0 || microphones().length > 0;

            return (
              <Show when={hasAnything()}>
                <div class="divider my-1 opacity-20" />
                <section>
                  <h2 class="text-xs font-semibold uppercase tracking-wider opacity-40 mb-2">Peripherals</h2>
                  <div class="px-3 py-2 rounded-box bg-base-300 text-xs opacity-50 space-y-1">
                    <For each={mice()}>
                      {(device) => (
                        <div class="flex justify-between">
                          <span>Mouse</span>
                          <span class="font-mono truncate ml-4">{device.name}</span>
                        </div>
                      )}
                    </For>
                    <For each={keyboards()}>
                      {(device) => (
                        <div class="flex justify-between">
                          <span>Keyboard</span>
                          <span class="font-mono truncate ml-4">{device.name}</span>
                        </div>
                      )}
                    </For>
                    <For each={microphones()}>
                      {(device) => (
                        <div class="flex justify-between">
                          <span>Microphone</span>
                          <span class="font-mono truncate ml-4">{device.name}</span>
                        </div>
                      )}
                    </For>
                  </div>
                </section>
              </Show>
            );
          }}
        </Show>

        <div class="divider my-1 opacity-20" />

        {/* Greet test — proves Rust IPC still works */}
        <section>
          <h2 class="text-xs font-semibold uppercase tracking-wider opacity-40 mb-2">IPC Test</h2>
          <form
            class="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              greet();
            }}
          >
            <input
              class="input input-bordered input-sm flex-1 bg-base-300 border-base-content/10"
              onChange={(e) => setName(e.currentTarget.value)}
              placeholder="Enter a name..."
            />
            <button class="btn btn-sm bg-base-300 border-base-content/10 hover:bg-base-content/10 text-base-content" type="submit">
              Greet
            </button>
          </form>
          {greetMsg() && (
            <div class="mt-2 px-3 py-2 rounded-box bg-base-300 text-sm opacity-70">
              {greetMsg()}
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer class="px-4 py-2 bg-base-300 border-t border-base-content/5 text-xs opacity-20 text-center">
        QuakeWorld Desktop Companion
      </footer>
    </div>
  );
}

export default App;
