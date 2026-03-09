import { createSignal } from "solid-js";
import { invoke } from "@tauri-apps/api/core";

function App() {
  const [greetMsg, setGreetMsg] = createSignal("");
  const [name, setName] = createSignal("");

  async function greet() {
    setGreetMsg(await invoke("greet", { name: name() }));
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

        {/* System specs placeholder */}
        <section>
          <div class="flex items-center justify-between mb-2">
            <h2 class="text-xs font-semibold uppercase tracking-wider opacity-40">System</h2>
            <button class="text-xs opacity-30 hover:opacity-60 transition-opacity">Refresh</button>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div class="bg-base-300 rounded-box p-3">
              <div class="text-xs opacity-30 mb-1">CPU</div>
              <div class="font-mono text-sm">Detecting...</div>
            </div>
            <div class="bg-base-300 rounded-box p-3">
              <div class="text-xs opacity-30 mb-1">GPU</div>
              <div class="font-mono text-sm">Detecting...</div>
            </div>
            <div class="bg-base-300 rounded-box p-3">
              <div class="text-xs opacity-30 mb-1">RAM</div>
              <div class="font-mono text-sm opacity-25">--</div>
            </div>
            <div class="bg-base-300 rounded-box p-3">
              <div class="text-xs opacity-30 mb-1">Display</div>
              <div class="font-mono text-sm opacity-25">--</div>
            </div>
          </div>
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
