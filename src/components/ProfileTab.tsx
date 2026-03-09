import { Show, For, createSignal, createMemo } from "solid-js";
import type { AllSpecs, MonitorInfo, GearProfile, MouseEntry, MousepadEntry } from "../types";
import { MouseSelector, MousepadSelector } from "./GearSelector";
import miceData from "../data/mice.json";
import mousepadsData from "../data/mousepads.json";

const mice = miceData as MouseEntry[];
const mousepads = mousepadsData as MousepadEntry[];

function formatRam(gb: number): string {
  return `${Math.round(gb)} GB`;
}

function formatOs(name: string, version: string): string {
  const ver = version.split("(")[0].trim();
  if (name === "Windows") return `Win ${ver}`;
  if (ver) return `${name} ${ver}`;
  return name;
}

interface ProfileTabProps {
  specs: AllSpecs | null;
  monitor: MonitorInfo | null;
  loading: boolean;
  onRefresh: () => void;
}

export default function ProfileTab(props: ProfileTabProps) {
  // Auto-detected peripherals
  const detectedMice = () => props.specs?.hid_devices.filter((d) => d.device_type === "mouse") ?? [];
  const detectedKeyboards = () => props.specs?.hid_devices.filter((d) => d.device_type === "keyboard") ?? [];
  const microphones = () => props.specs?.audio_devices.filter((d) => d.device_type === "input") ?? [];

  // User gear selections
  const [gear, setGear] = createSignal<GearProfile>({
    mouse: null,
    mousepad: null,
    keyboardName: null,
    dpi: null,
    sensitivity: null,
  });

  // Selector modal state
  const [showMouseSelector, setShowMouseSelector] = createSignal(false);
  const [showMousepadSelector, setShowMousepadSelector] = createSignal(false);

  // Keyboard editing
  const [editingKeyboard, setEditingKeyboard] = createSignal(false);
  const [keyboardInput, setKeyboardInput] = createSignal("");

  // DPI / sensitivity / m_yaw
  const [dpiInput, setDpiInput] = createSignal("");
  const [sensInput, setSensInput] = createSignal("");
  const [yawInput, setYawInput] = createSignal("0.022");

  // cm/360 = 914.4 / (DPI × sensitivity × m_yaw)
  // Accurate when using raw input (m_raw 1), which most competitive players do
  const cm360 = createMemo(() => {
    const dpi = gear().dpi;
    const sens = gear().sensitivity;
    const yaw = parseFloat(yawInput());
    if (dpi && sens && yaw && dpi > 0 && sens > 0 && yaw > 0) {
      return (914.4 / (dpi * sens * yaw)).toFixed(1);
    }
    return null;
  });

  // Pre-fill mouse selector with auto-detected brand
  const mouseInitialQuery = createMemo(() => {
    const detected = detectedMice()[0]?.name;
    if (!detected) return "";
    const lower = detected.toLowerCase();
    if (lower.includes("zowie")) return "ZOWIE";
    if (lower.includes("logitech")) return "Logitech";
    if (lower.includes("razer")) return "Razer";
    if (lower.includes("steelseries")) return "SteelSeries";
    if (lower.includes("pulsar")) return "Pulsar";
    if (lower.includes("endgame")) return "Endgame Gear";
    if (lower.includes("finalmouse")) return "Finalmouse";
    if (lower.includes("vaxee")) return "VAXEE";
    if (lower.includes("lamzu")) return "Lamzu";
    if (lower.includes("wlmouse")) return "WLMOUSE";
    return "";
  });

  function handleMouseSelect(m: MouseEntry) {
    setGear((g) => ({ ...g, mouse: { handle: m.handle, brand: m.brand, model: m.model } }));
    setShowMouseSelector(false);
  }

  function handleMousepadSelect(p: MousepadEntry) {
    setGear((g) => ({ ...g, mousepad: { handle: p.handle, brand: p.brand, model: p.model } }));
    setShowMousepadSelector(false);
  }

  function startEditKeyboard() {
    const current = gear().keyboardName || detectedKeyboards()[0]?.name || "";
    setKeyboardInput(current);
    setEditingKeyboard(true);
  }

  function saveKeyboard() {
    const val = keyboardInput().trim();
    setGear((g) => ({ ...g, keyboardName: val || null }));
    setEditingKeyboard(false);
  }

  function saveDpi() {
    const val = parseInt(dpiInput());
    setGear((g) => ({ ...g, dpi: val > 0 ? val : null }));
  }

  function saveSens() {
    const val = parseFloat(sensInput());
    setGear((g) => ({ ...g, sensitivity: val > 0 ? val : null }));
  }

  function saveYaw() {
    // Just trigger reactivity — yawInput is already used directly by cm360 memo
  }

  return (
    <div class="space-y-6">
      {/* System specs */}
      <section>
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-xs font-semibold uppercase tracking-wider opacity-40">System</h2>
          <button
            class="text-xs opacity-30 hover:opacity-60 transition-opacity"
            onClick={props.onRefresh}
          >
            Refresh
          </button>
        </div>
        <Show
          when={!props.loading}
          fallback={
            <div class="grid grid-cols-2 gap-2">
              <SpecCard label="CPU" value="Detecting..." dim />
              <SpecCard label="GPU" value="Detecting..." dim />
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
              <SpecCard label="Display" value="Detecting..." dim />
            </div>
          }
        >
          <div class="grid grid-cols-2 gap-2">
            <SpecCard label="CPU" value={props.specs?.cpu.model} title={props.specs?.cpu.model} />
            <SpecCard
              label="GPU"
              value={props.specs?.gpu?.model ?? "Not detected"}
              title={props.specs?.gpu?.model}
            />
            <div class="bg-base-300 rounded-box p-3 flex">
              <div class="flex-1">
                <div class="text-xs opacity-30 mb-1">RAM</div>
                <div class="font-mono text-sm">
                  {props.specs ? formatRam(props.specs.ram.total_gb) : "--"}
                </div>
              </div>
              <div class="flex-1">
                <div class="text-xs opacity-30 mb-1">OS</div>
                <div class="font-mono text-sm truncate">
                  {props.specs ? formatOs(props.specs.os.name, props.specs.os.version) : "--"}
                </div>
              </div>
            </div>
            <div class="bg-base-300 rounded-box p-3">
              <div class="text-xs opacity-30 mb-1 truncate">
                {"Display"}
                {props.monitor && props.monitor.count > 1 ? ` 1/${props.monitor.count}` : ""}
                {props.specs?.display.monitor_name ? ` ${props.specs.display.monitor_name}` : ""}
              </div>
              <div class="font-mono text-sm truncate">
                {props.monitor?.resolution ?? "--"}
                {props.specs?.display.refresh_hz ? ` @ ${props.specs.display.refresh_hz}Hz` : ""}
              </div>
            </div>
          </div>
        </Show>
      </section>

      {/* Peripherals */}
      <section>
        <h2 class="text-xs font-semibold uppercase tracking-wider opacity-40 mb-3">
          Peripherals
        </h2>
        <div class={`space-y-1.5 transition-opacity ${props.loading ? "opacity-30" : ""}`}>
          {/* Mouse */}
          <GearRow
            label="Mouse"
            value={
              gear().mouse
                ? `${gear().mouse!.brand} ${gear().mouse!.model}`
                : detectedMice()[0]?.name ?? null
            }
            placeholder="Select mouse"
            onClick={() => setShowMouseSelector(true)}
            hint={gear().mouse && detectedMice()[0] ? `detected: ${detectedMice()[0].name}` : undefined}
          />

          {/* Mousepad */}
          <GearRow
            label="Mousepad"
            value={gear().mousepad ? `${gear().mousepad!.brand} ${gear().mousepad!.model}` : null}
            placeholder="Select mousepad"
            onClick={() => setShowMousepadSelector(true)}
          />

          {/* Keyboard */}
          <Show
            when={!editingKeyboard()}
            fallback={
              <div class="flex items-center gap-2 px-3 py-1.5 rounded-box bg-base-300">
                <span class="text-xs opacity-40 shrink-0">Keyboard</span>
                <input
                  type="text"
                  class="input input-xs flex-1 bg-base-200 font-mono text-xs"
                  value={keyboardInput()}
                  onInput={(e) => setKeyboardInput(e.currentTarget.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") saveKeyboard(); if (e.key === "Escape") setEditingKeyboard(false); }}
                  onBlur={saveKeyboard}
                  ref={(el) => setTimeout(() => el.focus(), 0)}
                />
              </div>
            }
          >
            <Show when={gear().keyboardName || detectedKeyboards().length > 0}>
              <GearRow
                label="Keyboard"
                value={gear().keyboardName || detectedKeyboards()[0]?.name || null}
                placeholder="Set keyboard"
                onClick={startEditKeyboard}
              />
            </Show>
          </Show>

          {/* Microphone */}
          <For each={microphones()}>
            {(device) => (
              <div class="flex justify-between items-center px-3 py-2 rounded-box bg-base-300 text-sm">
                <span class="text-xs opacity-40 shrink-0">Microphone</span>
                <span class="font-mono text-xs truncate ml-4 opacity-60">{device.name}</span>
              </div>
            )}
          </For>
        </div>
      </section>

      {/* Sensitivity */}
      <section>
        <h2 class="text-xs font-semibold uppercase tracking-wider opacity-40 mb-3">
          Sensitivity
        </h2>
        <div class="grid grid-cols-2 gap-2">
          <div class="bg-base-300 rounded-box p-3">
            <div class="text-xs opacity-30 mb-1">DPI</div>
            <input
              type="number"
              class="input input-xs w-full bg-base-200 font-mono text-sm"
              placeholder="e.g. 800"
              value={dpiInput()}
              onInput={(e) => setDpiInput(e.currentTarget.value)}
              onBlur={saveDpi}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
            />
          </div>
          <div class="bg-base-300 rounded-box p-3">
            <div class="text-xs opacity-30 mb-1">Sensitivity</div>
            <input
              type="number"
              step="0.01"
              class="input input-xs w-full bg-base-200 font-mono text-sm"
              placeholder="e.g. 3.5"
              value={sensInput()}
              onInput={(e) => setSensInput(e.currentTarget.value)}
              onBlur={saveSens}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
            />
          </div>
          <div class="bg-base-300 rounded-box p-3">
            <div class="text-xs opacity-30 mb-1">m_yaw</div>
            <input
              type="number"
              step="0.001"
              class="input input-xs w-full bg-base-200 font-mono text-sm"
              placeholder="0.022"
              value={yawInput()}
              onInput={(e) => setYawInput(e.currentTarget.value)}
              onBlur={saveYaw}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
            />
          </div>
          <div class="bg-base-300 rounded-box p-3">
            <div class="text-xs opacity-30 mb-1">cm/360</div>
            <div class="font-mono text-sm mt-1">
              {cm360() !== null ? <span>{cm360()} cm</span> : <span class="opacity-25">--</span>}
            </div>
          </div>
        </div>
      </section>

      {/* Selector modals */}
      <Show when={showMouseSelector()}>
        <MouseSelector
          mice={mice}
          onSelect={handleMouseSelect}
          onClose={() => setShowMouseSelector(false)}
          initialQuery={mouseInitialQuery()}
        />
      </Show>
      <Show when={showMousepadSelector()}>
        <MousepadSelector
          mousepads={mousepads}
          onSelect={handleMousepadSelect}
          onClose={() => setShowMousepadSelector(false)}
        />
      </Show>
    </div>
  );
}

function SpecCard(props: { label: string; value?: string; title?: string; dim?: boolean }) {
  return (
    <div class="bg-base-300 rounded-box p-3">
      <div class="text-xs opacity-30 mb-1">{props.label}</div>
      <div
        class={`font-mono text-sm truncate ${props.dim ? "opacity-25" : ""}`}
        title={props.title}
      >
        {props.value ?? "--"}
      </div>
    </div>
  );
}

function GearRow(props: {
  label: string;
  value: string | null;
  placeholder: string;
  onClick: () => void;
  hint?: string;
}) {
  return (
    <button
      class="w-full flex justify-between items-center px-3 py-2 rounded-box bg-base-300 text-sm hover:bg-base-content/10 transition-colors cursor-pointer text-left group"
      onClick={props.onClick}
    >
      <div class="flex flex-col min-w-0">
        <div class="flex items-center gap-2">
          <span class="text-xs opacity-40 shrink-0">{props.label}</span>
          <Show when={props.hint}>
            <span class="text-[10px] opacity-20 truncate">{props.hint}</span>
          </Show>
        </div>
      </div>
      <div class="flex items-center gap-2 min-w-0">
        <span
          class={`font-mono text-xs truncate ${props.value ? "opacity-60" : "opacity-25"}`}
        >
          {props.value ?? props.placeholder}
        </span>
        <span class="text-xs opacity-20 group-hover:opacity-40 transition-opacity shrink-0">
          &#9662;
        </span>
      </div>
    </button>
  );
}
