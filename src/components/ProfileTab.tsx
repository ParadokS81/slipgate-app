import { Show, For, createSignal, createMemo } from "solid-js";
import type { AllSpecs, MonitorInfo, GearProfile, MouseEntry, MousepadEntry } from "../types";
import { MouseSelector, MousepadSelector } from "./GearSelector";
import miceData from "../data/mice.json";
import mousepadsData from "../data/mousepads.json";

const mice = miceData as MouseEntry[];
const mousepads = mousepadsData as MousepadEntry[];

function formatRam(gb: number, ddr: string | null): string {
  const rounded = Math.round(gb);
  return ddr ? `${rounded}GB ${ddr}` : `${rounded} GB`;
}

function formatOs(name: string, version: string): string {
  const ver = version.split("(")[0].trim();
  if (name === "Windows") return `Windows ${ver}`;
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
  const audioInputs = () => props.specs?.audio_devices.filter((d) => d.device_type === "input") ?? [];
  const audioOutputs = () => props.specs?.audio_devices.filter((d) => d.device_type === "output") ?? [];

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

  // cm/360 = 914.4 / (DPI * sensitivity * m_yaw)
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

  // Display formatting
  const displayLabel = () => {
    const parts = ["Display"];
    if (props.monitor && props.monitor.count > 1) parts[0] = `Display 1/${props.monitor.count}`;
    const mfr = props.specs?.display.manufacturer;
    const name = props.specs?.display.monitor_name;
    if (mfr && name) parts.push(`${mfr} ${name}`);
    else if (name) parts.push(name);
    return parts.join(" ");
  };

  const displayValue = () => {
    const res = props.monitor?.resolution ?? "--";
    const hz = props.specs?.display.refresh_hz;
    return hz ? `${res} @ ${hz}Hz` : res;
  };

  return (
    <div class="grid gap-3" style={{ "grid-template-columns": "repeat(12, 1fr)" }}>
      {/* === BATTLESTATION === */}
      <h3 class="sg-section-title" style={{ "grid-column": "span 12" }}>Battlestation</h3>

      <Show
        when={!props.loading}
        fallback={
          <>
            <div class="sg-stat" style={{ "grid-column": "span 6" }}>
              <div class="sg-stat-label">CPU</div>
              <div class="sg-stat-value" style={{ opacity: 0.25 }}>Detecting...</div>
            </div>
            <div class="sg-stat" style={{ "grid-column": "span 6" }}>
              <div class="sg-stat-label">GPU</div>
              <div class="sg-stat-value" style={{ opacity: 0.25 }}>Detecting...</div>
            </div>
            <div class="sg-stat" style={{ "grid-column": "span 3" }}>
              <div class="sg-stat-label">RAM</div>
              <div class="sg-stat-value" style={{ opacity: 0.25 }}>--</div>
            </div>
            <div class="sg-stat" style={{ "grid-column": "span 3" }}>
              <div class="sg-stat-label">OS</div>
              <div class="sg-stat-value" style={{ opacity: 0.25 }}>--</div>
            </div>
            <div class="sg-stat" style={{ "grid-column": "span 6" }}>
              <div class="sg-stat-label">Display</div>
              <div class="sg-stat-value" style={{ opacity: 0.25 }}>Detecting...</div>
            </div>
          </>
        }
      >
        {/* CPU + GPU — 2 columns */}
        <div class="sg-stat" style={{ "grid-column": "span 6" }} title={props.specs?.cpu.model}>
          <div class="sg-stat-label">CPU</div>
          <div class="sg-stat-value" style={{ overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>
            {props.specs?.cpu.model ?? "--"}
          </div>
        </div>
        <div class="sg-stat" style={{ "grid-column": "span 6" }} title={props.specs?.gpu?.model}>
          <div class="sg-stat-label">GPU</div>
          <div class="sg-stat-value" style={{ overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>
            {props.specs?.gpu?.model ?? "Not detected"}
          </div>
        </div>

        {/* RAM + OS — half-width each */}
        <div class="sg-stat" style={{ "grid-column": "span 3" }}>
          <div class="sg-stat-label">RAM</div>
          <div class="sg-stat-value">
            {props.specs ? formatRam(props.specs.ram.total_gb, props.specs.ram.ddr_generation) : "--"}
          </div>
        </div>
        <div class="sg-stat" style={{ "grid-column": "span 3" }}>
          <div class="sg-stat-label">OS</div>
          <div class="sg-stat-value" style={{ overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>
            {props.specs ? formatOs(props.specs.os.name, props.specs.os.version) : "--"}
          </div>
        </div>

        {/* Display — remaining 6 cols */}
        <div class="sg-stat" style={{ "grid-column": "span 6" }}>
          <div class="sg-stat-label" style={{ overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>
            {displayLabel()}
          </div>
          <div class="sg-stat-value" style={{ overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>
            {displayValue()}
          </div>
        </div>
      </Show>

      {/* === PERIPHERALS — pyramid: 2 → 3 → 4 === */}
      <h3 class="sg-section-title" style={{ "grid-column": "span 12" }}>Peripherals</h3>

      {/* Row 1: Audio Out + Audio In (2 boxes) */}
      <div class="sg-stat" style={{ "grid-column": "span 6" }}>
        <div class="sg-stat-label">Audio Out</div>
        <div class="sg-stat-value" style={{ overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>
          <Show
            when={audioOutputs()[0]}
            fallback={<span style={{ opacity: 0.3 }}>--</span>}
          >
            {audioOutputs()[0]?.name}
          </Show>
        </div>
      </div>
      <div class="sg-stat" style={{ "grid-column": "span 6" }}>
        <div class="sg-stat-label">Audio In</div>
        <div class="sg-stat-value" style={{ overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>
          <Show
            when={audioInputs()[0]}
            fallback={<span style={{ opacity: 0.3 }}>--</span>}
          >
            {audioInputs()[0]?.name}
          </Show>
        </div>
      </div>

      {/* Row 2: Mouse + Mousepad + Keyboard (3 boxes) */}
      <button
        class="sg-stat" style={{ "grid-column": "span 4", cursor: "pointer" }}
        onClick={() => setShowMouseSelector(true)}
      >
        <div class="sg-stat-label">Mouse</div>
        <div class="sg-stat-value" style={{ overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>
          <Show
            when={gear().mouse || detectedMice()[0]}
            fallback={<span style={{ opacity: 0.3 }}>Select mouse</span>}
          >
            {gear().mouse
              ? `${gear().mouse!.brand} ${gear().mouse!.model}`
              : detectedMice()[0]?.name}
          </Show>
        </div>
      </button>
      <button
        class="sg-stat" style={{ "grid-column": "span 4", cursor: "pointer" }}
        onClick={() => setShowMousepadSelector(true)}
      >
        <div class="sg-stat-label">Mousepad</div>
        <div class="sg-stat-value" style={{ overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>
          <Show
            when={gear().mousepad}
            fallback={<span style={{ opacity: 0.3 }}>Select mousepad</span>}
          >
            {`${gear().mousepad!.brand} ${gear().mousepad!.model}`}
          </Show>
        </div>
      </button>
      <Show
        when={!editingKeyboard()}
        fallback={
          <div class="sg-stat" style={{ "grid-column": "span 4" }}>
            <div class="sg-stat-label">Keyboard</div>
            <input
              type="text"
              class="w-full bg-transparent border-none outline-none sg-stat-value"
              style={{ padding: 0, color: "white" }}
              value={keyboardInput()}
              onInput={(e) => setKeyboardInput(e.currentTarget.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveKeyboard(); if (e.key === "Escape") setEditingKeyboard(false); }}
              onBlur={saveKeyboard}
              ref={(el) => setTimeout(() => el.focus(), 0)}
            />
          </div>
        }
      >
        <button
          class="sg-stat" style={{ "grid-column": "span 4", cursor: "pointer", "text-align": "left" }}
          onClick={startEditKeyboard}
        >
          <div class="sg-stat-label">Keyboard</div>
          <div class="sg-stat-value" style={{ overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>
            <Show
              when={gear().keyboardName || detectedKeyboards()[0]}
              fallback={<span style={{ opacity: 0.3 }}>Set keyboard</span>}
            >
              {gear().keyboardName || detectedKeyboards()[0]?.name}
            </Show>
          </div>
        </button>
      </Show>

      {/* Row 3: DPI + Sensitivity + m_yaw + cm/360 (4 boxes) */}
      <div class="sg-stat" style={{ "grid-column": "span 3" }}>
        <div class="sg-stat-label">DPI</div>
        <input
          type="number"
          class="w-full bg-transparent border-none outline-none sg-stat-value"
          style={{ padding: 0 }}
          placeholder="e.g. 800"
          value={dpiInput()}
          onInput={(e) => setDpiInput(e.currentTarget.value)}
          onBlur={saveDpi}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        />
      </div>
      <div class="sg-stat" style={{ "grid-column": "span 3" }}>
        <div class="sg-stat-label">Sensitivity</div>
        <input
          type="number"
          step="0.01"
          class="w-full bg-transparent border-none outline-none sg-stat-value"
          style={{ padding: 0 }}
          placeholder="e.g. 3.5"
          value={sensInput()}
          onInput={(e) => setSensInput(e.currentTarget.value)}
          onBlur={saveSens}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        />
      </div>
      <div class="sg-stat" style={{ "grid-column": "span 3" }}>
        <div class="sg-stat-label">m_yaw</div>
        <input
          type="number"
          step="0.001"
          class="w-full bg-transparent border-none outline-none sg-stat-value"
          style={{ padding: 0 }}
          placeholder="0.022"
          value={yawInput()}
          onInput={(e) => setYawInput(e.currentTarget.value)}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        />
      </div>
      <div class="sg-stat" style={{ "grid-column": "span 3" }}>
        <div class="sg-stat-label">cm/360</div>
        <div class="sg-stat-value">
          {cm360() !== null ? `${cm360()} cm` : <span style={{ opacity: 0.25 }}>--</span>}
        </div>
      </div>

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
