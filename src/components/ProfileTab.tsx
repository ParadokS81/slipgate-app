import { Show, createSignal, createMemo, createEffect } from "solid-js";
import { Cpu, Monitor, Keyboard, Crosshair, Gamepad2, Eye } from "lucide-solid";
import type { AllSpecs, MonitorInfo, GearProfile, MouseEntry, MousepadEntry, EzQuakeConfig } from "../types";
import type { ProfileData, SetupHardware } from "../store";
import { getPrimarySetup } from "../store";
import { MouseSelector, MousepadSelector } from "./GearSelector";
import WhoBanner from "./WhoBanner";
import KeyboardLayout from "./KeyboardLayout";
import MouseLayout from "./MouseLayout";
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

/** A single label → value row inside a card */
function Row(props: { label: string; value?: string | null; dim?: boolean; children?: any }) {
  return (
    <div class="sg-row">
      <span class="sg-row-label">{props.label}</span>
      <span class="sg-row-value" classList={{ "sg-dim": props.dim || (!props.value && !props.children) }}>
        {props.children ?? props.value ?? "--"}
      </span>
    </div>
  );
}

interface ProfileTabProps {
  specs: AllSpecs | null;
  monitor: MonitorInfo | null;
  loading: boolean;
  onRefresh: () => void;
  ezConfig?: EzQuakeConfig | null;
  profile?: ProfileData | null;
  onHardwareUpdate?: (data: Partial<SetupHardware>) => void;
}

export default function ProfileTab(props: ProfileTabProps) {
  // Auto-detected peripherals
  const detectedMice = () => props.specs?.hid_devices.filter((d) => d.device_type === "mouse") ?? [];
  const detectedKeyboards = () => props.specs?.hid_devices.filter((d) => d.device_type === "keyboard") ?? [];
  const audioInputs = () => props.specs?.audio_devices.filter((d) => d.device_type === "input") ?? [];
  const audioOutputs = () => props.specs?.audio_devices.filter((d) => d.device_type === "output") ?? [];

  // User gear selections
  const [gear, setGear] = createSignal<GearProfile>({
    mouse: null, mousepad: null, keyboardName: null, dpi: null, sensitivity: null,
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

  // Restore saved gear from profile store
  let profileLoaded = false;
  createEffect(() => {
    const prof = props.profile;
    if (!prof || profileLoaded) return;
    profileLoaded = true;

    const hw = getPrimarySetup(prof).hardware;
    if (hw.dpi) {
      setDpiInput(String(hw.dpi));
      setGear(g => ({ ...g, dpi: hw.dpi }));
    }
    if (hw.mouse_model) {
      setGear(g => ({ ...g, mouse: hw.mouse_model }));
    }
    if (hw.mousepad_model) {
      setGear(g => ({ ...g, mousepad: hw.mousepad_model }));
    }
    if (hw.keyboard_name) {
      setGear(g => ({ ...g, keyboardName: hw.keyboard_name }));
    }
  });

  // Auto-fill sensitivity from ezQuake config (config is source of truth for sens/m_yaw)
  createEffect(() => {
    const cfg = props.ezConfig;
    if (!cfg) return;
    setSensInput(String(cfg.sensitivity));
    if (cfg.m_yaw !== 0.022) setYawInput(String(cfg.m_yaw));
    setGear(g => ({ ...g, sensitivity: cfg.sensitivity }));
  });

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
    const brands: Record<string, string> = {
      zowie: "ZOWIE", logitech: "Logitech", razer: "Razer", steelseries: "SteelSeries",
      pulsar: "Pulsar", endgame: "Endgame Gear", finalmouse: "Finalmouse",
      vaxee: "VAXEE", lamzu: "Lamzu", wlmouse: "WLMOUSE",
    };
    for (const [key, val] of Object.entries(brands)) {
      if (lower.includes(key)) return val;
    }
    return "";
  });

  function handleMouseSelect(m: MouseEntry) {
    const selection = { handle: m.handle, brand: m.brand, model: m.model };
    setGear((g) => ({ ...g, mouse: selection }));
    setShowMouseSelector(false);
    props.onHardwareUpdate?.({ mouse_model: selection });
  }

  function handleMousepadSelect(p: MousepadEntry) {
    const selection = { handle: p.handle, brand: p.brand, model: p.model };
    setGear((g) => ({ ...g, mousepad: selection }));
    setShowMousepadSelector(false);
    props.onHardwareUpdate?.({ mousepad_model: selection });
  }

  function startEditKeyboard() {
    setKeyboardInput(gear().keyboardName || detectedKeyboards()[0]?.name || "");
    setEditingKeyboard(true);
  }

  function saveKeyboard() {
    const val = keyboardInput().trim() || null;
    setGear((g) => ({ ...g, keyboardName: val }));
    setEditingKeyboard(false);
    props.onHardwareUpdate?.({ keyboard_name: val });
  }

  function saveDpi() {
    const val = parseInt(dpiInput());
    const dpi = val > 0 ? val : null;
    setGear((g) => ({ ...g, dpi }));
    props.onHardwareUpdate?.({ dpi });
  }

  function saveSens() {
    const val = parseFloat(sensInput());
    setGear((g) => ({ ...g, sensitivity: val > 0 ? val : null }));
  }

  // Display formatting
  const monitorLabel = () => {
    const count = props.monitor?.count;
    return count && count > 1 ? `${count} Monitors` : "Monitor";
  };

  const displayModel = () => {
    const mfr = props.specs?.display.manufacturer;
    const name = props.specs?.display.monitor_name;
    const count = props.monitor?.count;
    let model = "";
    if (mfr && name) model = `${mfr} ${name}`;
    else if (name) model = name;
    else return null;
    if (count && count > 1) model += " (Primary)";
    return model;
  };

  const displayRes = () => {
    const res = props.monitor?.resolution ?? "--";
    const hz = props.specs?.display.refresh_hz;
    return hz ? `${res} @ ${hz}Hz` : res;
  };

  const mouseDisplayName = () =>
    gear().mouse ? `${gear().mouse!.brand} ${gear().mouse!.model}` : detectedMice()[0]?.name || null;

  const mousepadDisplayName = () =>
    gear().mousepad ? `${gear().mousepad!.brand} ${gear().mousepad!.model}` : null;

  const keyboardDisplayName = () =>
    gear().keyboardName || detectedKeyboards()[0]?.name || null;

  return (
    <div class="sg-profile-cards">
      {/* ================================================================
          WHO — Identity Banner (scoreboard style)
          ================================================================ */}
      <Show
        when={props.ezConfig}
        fallback={
          <div class="who-banner-placeholder">
            <div class="who-banner-placeholder-text">
              Load a client config in the Clients tab to see your QW identity
            </div>
          </div>
        }
      >
        <WhoBanner
          playerNameQw={props.ezConfig!.player_name_qw}
          teamQw={props.ezConfig!.team_qw}
          topcolor={props.ezConfig!.topcolor}
          bottomcolor={props.ezConfig!.bottomcolor}
        />
      </Show>

      {/* ================================================================
          HOW — Quake Setup (input → output)
          ================================================================ */}

      {/* Input: movement keys + sensitivity */}
      <div class="sg-card">
        <div class="sg-card-header">
          <Gamepad2 size={16} />
          <span>Input</span>
        </div>
        <Show when={props.ezConfig}>
          {(() => {
            const m = props.ezConfig!.movement;
            const isMouse = (k: string) => k.startsWith("Mouse") || k.startsWith("MWheel");

            // Keyboard-bound binds (for description under keyboard)
            const kbBinds: { arrow: string; key: string }[] = [];
            if (!isMouse(m.forward))   kbBinds.push({ arrow: "↑", key: m.forward });
            if (!isMouse(m.moveleft))  kbBinds.push({ arrow: "←", key: m.moveleft });
            if (!isMouse(m.back))      kbBinds.push({ arrow: "↓", key: m.back });
            if (!isMouse(m.moveright)) kbBinds.push({ arrow: "→", key: m.moveright });
            const kbJump = !isMouse(m.jump) ? m.jump : null;

            // Mouse-bound binds (for description under mouse)
            const msBinds: { arrow: string; key: string }[] = [];
            if (isMouse(m.forward))   msBinds.push({ arrow: "↑", key: m.forward });
            if (isMouse(m.moveleft))  msBinds.push({ arrow: "←", key: m.moveleft });
            if (isMouse(m.back))      msBinds.push({ arrow: "↓", key: m.back });
            if (isMouse(m.moveright)) msBinds.push({ arrow: "→", key: m.moveright });
            const msJump = isMouse(m.jump) ? m.jump : null;

            return (
              <div class="sg-input-viz">
                <div class="sg-input-viz-col sg-input-viz-kb">
                  <KeyboardLayout movement={m} />
                  <div class="sg-input-viz-desc">
                    {kbBinds.length > 0 && (
                      <span class="sg-bind-move">
                        {kbBinds.map(b => `${b.arrow}${b.key}`).join("  ")}
                      </span>
                    )}
                    {kbJump && <span class="sg-bind-jump">⤴ {kbJump}</span>}
                  </div>
                </div>
                <div class="sg-input-viz-col sg-input-viz-ms">
                  <MouseLayout movement={m} />
                  <div class="sg-input-viz-desc">
                    {msBinds.length > 0 && (
                      <span class="sg-bind-move">
                        {msBinds.map(b => `${b.arrow}${b.key}`).join("  ")}
                      </span>
                    )}
                    {msJump && <span class="sg-bind-jump">jump: {msJump}</span>}
                    <span class={cm360() ? "sg-bind-sens" : "sg-bind-sens sg-dim"}>
                      {cm360() ? `${cm360()} cm/360` : "Set DPI + sens"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}
        </Show>
      </div>

      {/* Output: display + FOV — single consolidated line */}
      <div class="sg-card">
        <div class="sg-card-header">
          <Eye size={16} />
          <span>Output</span>
        </div>
        <Show when={!props.loading} fallback={<Row label="Display" dim />}>
          <Row label="Display">
            {(() => {
              const cfg = props.ezConfig;
              const res = cfg && cfg.vid_width > 0
                ? `${cfg.vid_width}x${cfg.vid_height}`
                : props.monitor?.resolution ?? "--";
              const hz = props.specs?.display.refresh_hz;
              const fov = cfg?.fov;
              let line = res;
              if (hz) line += ` @ ${hz}Hz`;
              if (fov) line += ` @ ${fov.toFixed(1)} FOV`;
              return line;
            })()}
          </Row>
        </Show>

        {/* Screenshot placeholders */}
        <div class="sg-row">
          <span class="sg-row-label">Screenshots</span>
          <div class="who-screenshot-placeholders">
            <div class="who-screenshot-thumb" title="HUD layout" />
            <div class="who-screenshot-thumb" title="Textures" />
            <div class="who-screenshot-thumb" title="Weapon view" />
          </div>
        </div>
      </div>

      {/* ================================================================
          WHAT — System Specs / Battlestation
          ================================================================ */}

      {/* System */}
      <div class="sg-card">
        <div class="sg-card-header">
          <Cpu size={16} />
          <span>System</span>
        </div>
        <Show
          when={!props.loading}
          fallback={<div class="sg-row"><span class="sg-row-value sg-dim">Detecting hardware...</span></div>}
        >
          <Row label="CPU" value={props.specs?.cpu.model} />
          <Row label="GPU" value={props.specs?.gpu?.model ?? "Not detected"} />
          <Row label="RAM" value={props.specs ? formatRam(props.specs.ram.total_gb, props.specs.ram.ddr_generation) : null} />
          <Row label="OS" value={props.specs ? formatOs(props.specs.os.name, props.specs.os.version) : null} />
        </Show>
      </div>

      {/* Display hardware */}
      <div class="sg-card">
        <div class="sg-card-header">
          <Monitor size={16} />
          <span>Display</span>
        </div>
        <Show when={!props.loading} fallback={<Row label="Monitor" dim />}>
          <Row label={monitorLabel()} value={displayModel()} />
          <Row label="Resolution" value={displayRes()} />
        </Show>
      </div>

      {/* Mouse & Sensitivity */}
      <div class="sg-card">
        <div class="sg-card-header">
          <Crosshair size={16} />
          <span>Mouse & Sensitivity</span>
        </div>

        <div class="sg-row sg-row-clickable" onClick={() => setShowMouseSelector(true)}>
          <span class="sg-row-label">Mouse</span>
          <span class="sg-row-value" classList={{ "sg-dim": !mouseDisplayName() }}>
            {mouseDisplayName() || "Select mouse..."}
          </span>
        </div>

        <div class="sg-row sg-row-clickable" onClick={() => setShowMousepadSelector(true)}>
          <span class="sg-row-label">Mousepad</span>
          <span class="sg-row-value" classList={{ "sg-dim": !mousepadDisplayName() }}>
            {mousepadDisplayName() || "Select mousepad..."}
          </span>
        </div>

        <div class="sg-row">
          <span class="sg-row-label">DPI</span>
          <div class="sg-input-group">
            <input
              type="number"
              class="sg-row-input"
              placeholder="e.g. 800"
              value={dpiInput()}
              onInput={(e) => setDpiInput(e.currentTarget.value)}
              onBlur={saveDpi}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
            />
          </div>
        </div>

        <div class="sg-row">
          <span class="sg-row-label">Sensitivity</span>
          <div class="sg-input-group">
            <input
              type="number"
              class="sg-row-input"
              placeholder="e.g. 3.5"
              value={sensInput()}
              onInput={(e) => setSensInput(e.currentTarget.value)}
              onBlur={saveSens}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
            />
            <Show when={props.ezConfig}><span class="sg-from-cfg">cfg</span></Show>
          </div>
        </div>

        <div class="sg-row">
          <span class="sg-row-label">m_yaw</span>
          <div class="sg-input-group">
            <input
              type="number"
              class="sg-row-input"
              placeholder="0.022"
              value={yawInput()}
              onInput={(e) => setYawInput(e.currentTarget.value)}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
            />
            <Show when={props.ezConfig}><span class="sg-from-cfg">cfg</span></Show>
          </div>
        </div>

        <div class="sg-row">
          <span class="sg-row-label">cm/360</span>
          <span class="sg-row-value" classList={{ "sg-dim": !cm360() }}>
            {cm360() ? `${cm360()} cm` : "Set DPI + sens"}
          </span>
        </div>
      </div>

      {/* Other Peripherals */}
      <div class="sg-card">
        <div class="sg-card-header">
          <Keyboard size={16} />
          <span>Other Peripherals</span>
        </div>

        <Show
          when={!editingKeyboard()}
          fallback={
            <div class="sg-row">
              <span class="sg-row-label">Keyboard</span>
              <input
                type="text"
                class="sg-row-input"
                value={keyboardInput()}
                onInput={(e) => setKeyboardInput(e.currentTarget.value)}
                onKeyDown={(e) => { if (e.key === "Enter") saveKeyboard(); if (e.key === "Escape") setEditingKeyboard(false); }}
                onBlur={saveKeyboard}
                ref={(el) => setTimeout(() => el.focus(), 0)}
              />
            </div>
          }
        >
          <div class="sg-row sg-row-clickable" onClick={startEditKeyboard}>
            <span class="sg-row-label">Keyboard</span>
            <span class="sg-row-value" classList={{ "sg-dim": !keyboardDisplayName() }}>
              {keyboardDisplayName() || "Set keyboard..."}
            </span>
          </div>
        </Show>

        <div class="sg-row">
          <span class="sg-row-label">Audio Out</span>
          <span class="sg-row-value" classList={{ "sg-dim": !audioOutputs()[0] }}>
            {audioOutputs()[0]?.name ?? "--"}
          </span>
        </div>
        <div class="sg-row">
          <span class="sg-row-label">Audio In</span>
          <span class="sg-row-value" classList={{ "sg-dim": !audioInputs()[0] }}>
            {audioInputs()[0]?.name ?? "--"}
          </span>
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
