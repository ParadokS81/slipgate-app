import { createSignal, onMount, Show } from "solid-js";
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

function App() {
  const [greetMsg, setGreetMsg] = createSignal("");
  const [name, setName] = createSignal("");
  const [specs, setSpecs] = createSignal<SystemSpecs | null>(null);
  const [monitor, setMonitor] = createSignal<MonitorInfo | null>(null);
  const [loading, setLoading] = createSignal(true);

  async function greet() {
    setGreetMsg(await invoke("greet", { name: name() }));
  }

  async function loadSpecs() {
    setLoading(true);
    try {
      const [sysSpecs, monitors, primary] = await Promise.all([
        invoke<SystemSpecs>("get_system_specs"),
        availableMonitors(),
        currentMonitor(),
      ]);
      setSpecs(sysSpecs);
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

  function formatVram(mb: number): string {
    if (mb >= 1024) return `${(mb / 1024).toFixed(0)} GB`;
    return `${mb} MB`;
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
              <div class="bg-base-300 rounded-box p-3">
                <div class="text-xs opacity-30 mb-1">RAM</div>
                <div class="font-mono text-sm opacity-25">Detecting...</div>
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
              <div class="bg-base-300 rounded-box p-3">
                <div class="text-xs opacity-30 mb-1">RAM</div>
                <div class="font-mono text-sm">
                  {specs() ? formatRam(specs()!.ram.total_gb) : "--"}
                </div>
              </div>
              <div class="bg-base-300 rounded-box p-3">
                <div class="text-xs opacity-30 mb-1">Display</div>
                <div class="font-mono text-sm truncate">
                  {monitor()?.resolution ?? "--"}
                  {specs()?.display.refresh_hz ? ` @ ${specs()!.display.refresh_hz}Hz` : ""}
                </div>
              </div>
            </div>

            {/* Expanded details */}
            <Show when={specs()}>
              <div class="mt-2 px-3 py-2 rounded-box bg-base-300 text-xs opacity-50 space-y-1">
                <div class="flex justify-between">
                  <span>OS</span>
                  <span class="font-mono">{specs()!.os.name} {specs()!.os.version}</span>
                </div>
                <div class="flex justify-between">
                  <span>CPU Cores</span>
                  <span class="font-mono">{specs()!.cpu.cores}C / {specs()!.cpu.threads}T</span>
                </div>
                <Show when={specs()!.gpu?.vram_mb}>
                  <div class="flex justify-between">
                    <span>VRAM</span>
                    <span class="font-mono">{formatVram(specs()!.gpu!.vram_mb!)}</span>
                  </div>
                </Show>
                <Show when={specs()!.gpu?.driver_version}>
                  <div class="flex justify-between">
                    <span>Driver</span>
                    <span class="font-mono">{specs()!.gpu!.driver_version}</span>
                  </div>
                </Show>
                <Show when={monitor()}>
                  <Show when={specs()!.display.monitor_name}>
                    <div class="flex justify-between">
                      <span>Monitor</span>
                      <span class="font-mono truncate ml-4">{specs()!.display.monitor_name}</span>
                    </div>
                  </Show>
                  <div class="flex justify-between">
                    <span>Monitors</span>
                    <span class="font-mono">{monitor()!.count}</span>
                  </div>
                </Show>
              </div>
            </Show>
          </Show>
        </section>

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
