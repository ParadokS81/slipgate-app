import { Show, For, createSignal, createEffect } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { EzQuakeInstallation, EzQuakeConfig, MonitorInfo } from "../types";

interface ClientsTabProps {
  onConfigLoaded?: (config: EzQuakeConfig) => void;
  monitor?: MonitorInfo | null;
}

export default function ClientsTab(props: ClientsTabProps) {
  const [exePath, setExePath] = createSignal(localStorage.getItem("ezquake_exe_path") || "");
  const [installation, setInstallation] = createSignal<EzQuakeInstallation | null>(null);
  const [config, setConfig] = createSignal<EzQuakeConfig | null>(null);
  const [selectedConfig, setSelectedConfig] = createSignal("config.cfg");
  const [error, setError] = createSignal("");
  const [connectAddress, setConnectAddress] = createSignal("");

  // Validate path and load config on mount if we have a saved path
  createEffect(() => {
    const saved = exePath();
    if (saved) {
      validateAndLoad(saved);
    }
  });

  async function validateAndLoad(path: string) {
    setError("");
    try {
      const info = await invoke<EzQuakeInstallation>("validate_ezquake_path", { exePath: path });
      setInstallation(info);
      if (info.valid) {
        localStorage.setItem("ezquake_exe_path", path);
        setExePath(path);
        // Auto-load config.cfg if available
        const cfgName = info.config_files.includes("config.cfg") ? "config.cfg" : info.config_files[0];
        if (cfgName) {
          setSelectedConfig(cfgName);
          await loadConfig(path, cfgName);
        }
      } else {
        setError("Not a valid ezQuake executable");
      }
    } catch (e) {
      setError(String(e));
    }
  }

  async function loadConfig(path: string, cfgName: string) {
    try {
      const cfg = await invoke<EzQuakeConfig>("read_ezquake_config", {
        exePath: path,
        configName: cfgName,
      });
      setConfig(cfg);
      setError("");
      props.onConfigLoaded?.(cfg);
    } catch (e) {
      console.error("Failed to load config:", e);
      setError(`Config parse failed: ${e}`);
    }
  }

  async function browseForExe() {
    try {
      const selected = await open({
        title: "Locate ezQuake executable",
        filters: [{ name: "ezQuake", extensions: ["exe"] }],
        multiple: false,
        directory: false,
      });
      if (selected) {
        await validateAndLoad(selected as string);
      }
    } catch (e) {
      console.error("File dialog error:", e);
    }
  }

  async function handleConfigChange(cfgName: string) {
    setSelectedConfig(cfgName);
    const path = exePath();
    if (path) {
      await loadConfig(path, cfgName);
    }
  }

  async function launchGame(action?: string) {
    try {
      const server = connectAddress().trim() || undefined;
      await invoke("launch_ezquake", {
        options: {
          exe_path: exePath(),
          action: action && server ? action : null,
          server: server || null,
          extra_args: null,
        },
      });
    } catch (e) {
      setError(String(e));
    }
  }

  // cm/360 = 914.4 / (DPI * sens * yaw)
  // We don't know DPI here, but we show sens * yaw (the "effective" multiplier)
  const effectiveSens = () => {
    const cfg = config();
    if (!cfg) return null;
    return cfg.sensitivity * cfg.m_yaw;
  };

  // Effective playing resolution: use config values if set, otherwise fall back
  // to desktop resolution. Most players (fullscreen + vid_usedesktopres 1 +
  // cfg_save_unchanged 0) will have vid_width=0 in their config because ezQuake
  // only sets it at runtime and the default 0 isn't saved.
  const effectiveRes = () => {
    const cfg = config();
    if (cfg && cfg.vid_width > 0 && cfg.vid_height > 0) {
      return { w: cfg.vid_width, h: cfg.vid_height };
    }
    // Fall back to desktop resolution from monitor detection
    const res = props.monitor?.resolution;
    if (res) {
      const [w, h] = res.split("x").map(Number);
      if (w > 0 && h > 0) return { w, h };
    }
    return null;
  };

  const effectiveResLabel = () => {
    const r = effectiveRes();
    if (!r) return "Desktop";
    const cfg = config();
    const isFromConfig = cfg && cfg.vid_width > 0;
    return isFromConfig ? `${r.w}x${r.h}` : `${r.w}x${r.h} (Desktop)`;
  };

  // FOV recalculator
  const [fovNewWidth, setFovNewWidth] = createSignal("");
  const [fovNewHeight, setFovNewHeight] = createSignal("");

  const recalcFov = () => {
    const cfg = config();
    const res = effectiveRes();
    if (!cfg || !res) return null;
    const newW = parseInt(fovNewWidth());
    const newH = parseInt(fovNewHeight());
    if (!newW || !newH || newW <= 0 || newH <= 0) return null;

    const oldAspect = res.w / res.h;
    const newAspect = newW / newH;
    const oldFovRad = (cfg.fov * Math.PI) / 180;
    const newFovRad = 2 * Math.atan(Math.tan(oldFovRad / 2) * (newAspect / oldAspect));
    return ((newFovRad * 180) / Math.PI).toFixed(1);
  };

  return (
    <div class="grid gap-3" style={{ "grid-template-columns": "repeat(12, 1fr)" }}>
      {/* === EZQUAKE SETUP === */}
      <h3 class="sg-section-title" style={{ "grid-column": "span 12" }}>ezQuake</h3>

      {/* Path selector */}
      <div class="sg-stat" style={{ "grid-column": "span 12" }}>
        <div class="sg-stat-label">Installation</div>
        <Show
          when={installation()?.valid}
          fallback={
            <div class="flex items-center gap-2">
              <button
                class="sg-stat-value"
                style={{ cursor: "pointer", opacity: 0.4 }}
                onClick={browseForExe}
              >
                Click to locate ezquake.exe...
              </button>
            </div>
          }
        >
          <div class="flex items-center gap-2">
            <span
              class="sg-stat-value"
              style={{ overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap", flex: 1, cursor: "pointer" }}
              onClick={browseForExe}
              title={exePath()}
            >
              {exePath()}
            </span>
          </div>
        </Show>
      </div>

      <Show when={error()}>
        <div style={{ "grid-column": "span 12", color: "#f87171", "font-size": "0.75rem", padding: "0 4px" }}>
          {error()}
        </div>
      </Show>

      <Show when={installation()?.valid}>
        {/* Config selector */}
        <div class="sg-stat" style={{ "grid-column": "span 4" }}>
          <div class="sg-stat-label">Config</div>
          <select
            class="w-full bg-transparent border-none outline-none sg-stat-value"
            style={{ padding: 0, cursor: "pointer" }}
            value={selectedConfig()}
            onChange={(e) => handleConfigChange(e.currentTarget.value)}
          >
            <For each={installation()?.config_files ?? []}>
              {(file) => <option value={file} style={{ background: "#1a1a2e" }}>{file}</option>}
            </For>
          </select>
        </div>

        {/* Player name */}
        <div class="sg-stat" style={{ "grid-column": "span 4" }}>
          <div class="sg-stat-label">Player Name</div>
          <div class="sg-stat-value">
            {config()?.player_name ?? "--"}
          </div>
        </div>

        {/* FOV */}
        <div class="sg-stat" style={{ "grid-column": "span 4" }}>
          <div class="sg-stat-label">FOV</div>
          <div class="sg-stat-value">
            {config()?.fov ? config()!.fov.toFixed(1) : "--"}
          </div>
        </div>

        {/* Sensitivity row */}
        <div class="sg-stat" style={{ "grid-column": "span 3" }}>
          <div class="sg-stat-label">Sensitivity</div>
          <div class="sg-stat-value">{config()?.sensitivity ?? "--"}</div>
        </div>
        <div class="sg-stat" style={{ "grid-column": "span 3" }}>
          <div class="sg-stat-label">m_yaw</div>
          <div class="sg-stat-value">{config()?.m_yaw ?? "--"}</div>
        </div>
        <div class="sg-stat" style={{ "grid-column": "span 3" }}>
          <div class="sg-stat-label">m_pitch</div>
          <div class="sg-stat-value">{config()?.m_pitch ?? "--"}</div>
        </div>
        <div class="sg-stat" style={{ "grid-column": "span 3" }}>
          <div class="sg-stat-label">Effective</div>
          <div class="sg-stat-value">
            {effectiveSens() !== null ? effectiveSens()!.toFixed(4) : "--"}
          </div>
        </div>

        {/* Video settings */}
        <div class="sg-stat" style={{ "grid-column": "span 3" }}>
          <div class="sg-stat-label">In-Game Res</div>
          <div class="sg-stat-value">{effectiveResLabel()}</div>
        </div>
        <div class="sg-stat" style={{ "grid-column": "span 3" }}>
          <div class="sg-stat-label">Max FPS</div>
          <div class="sg-stat-value">
            {config()?.cl_maxfps ? config()!.cl_maxfps : "Unlocked"}
          </div>
        </div>
        <div class="sg-stat" style={{ "grid-column": "span 3" }}>
          <div class="sg-stat-label">Raw Input</div>
          <div class="sg-stat-value">{config()?.in_raw ? "Yes" : "No"}</div>
        </div>
        <div class="sg-stat" style={{ "grid-column": "span 3" }}>
          <div class="sg-stat-label">Mouse Accel</div>
          <div class="sg-stat-value">
            {config()?.m_accel ? config()!.m_accel : "Off"}
          </div>
        </div>

        {/* === FOV RECALCULATOR === */}
        <h3 class="sg-section-title" style={{ "grid-column": "span 12" }}>FOV Recalculator</h3>

        <div class="sg-stat" style={{ "grid-column": "span 3" }}>
          <div class="sg-stat-label">Current FOV</div>
          <div class="sg-stat-value">{config()?.fov?.toFixed(1) ?? "--"}</div>
        </div>
        <div class="sg-stat" style={{ "grid-column": "span 3" }}>
          <div class="sg-stat-label">Current Res</div>
          <div class="sg-stat-value">{effectiveResLabel()}</div>
        </div>
        <div class="sg-stat" style={{ "grid-column": "span 3" }}>
          <div class="sg-stat-label">New Res Width</div>
          <input
            type="number"
            class="w-full bg-transparent border-none outline-none sg-stat-value"
            style={{ padding: 0 }}
            placeholder="e.g. 1920"
            value={fovNewWidth()}
            onInput={(e) => setFovNewWidth(e.currentTarget.value)}
          />
        </div>
        <div class="sg-stat" style={{ "grid-column": "span 3" }}>
          <div class="sg-stat-label">New Res Height</div>
          <input
            type="number"
            class="w-full bg-transparent border-none outline-none sg-stat-value"
            style={{ padding: 0 }}
            placeholder="e.g. 1080"
            value={fovNewHeight()}
            onInput={(e) => setFovNewHeight(e.currentTarget.value)}
          />
        </div>
        <div class="sg-stat" style={{ "grid-column": "span 12" }}>
          <div class="sg-stat-label">Equivalent FOV at New Resolution</div>
          <div class="sg-stat-value" style={{ "font-size": "1.2rem" }}>
            <Show when={recalcFov()} fallback={<span style={{ opacity: 0.25 }}>Enter new resolution above</span>}>
              {recalcFov()}
            </Show>
          </div>
        </div>

        {/* === LAUNCH === */}
        <h3 class="sg-section-title" style={{ "grid-column": "span 12" }}>Launch</h3>

        <div class="sg-stat" style={{ "grid-column": "span 8" }}>
          <div class="sg-stat-label">Server Address</div>
          <input
            type="text"
            class="w-full bg-transparent border-none outline-none sg-stat-value"
            style={{ padding: 0 }}
            placeholder="ip:port (optional)"
            value={connectAddress()}
            onInput={(e) => setConnectAddress(e.currentTarget.value)}
          />
        </div>
        <button
          class="sg-stat"
          style={{ "grid-column": "span 2", cursor: "pointer", "text-align": "center" }}
          onClick={() => launchGame("connect")}
        >
          <div class="sg-stat-label">Play</div>
          <div class="sg-stat-value" style={{ color: "var(--sg-accent)" }}>Join</div>
        </button>
        <button
          class="sg-stat"
          style={{ "grid-column": "span 2", cursor: "pointer", "text-align": "center" }}
          onClick={() => launchGame("observe")}
        >
          <div class="sg-stat-label">Watch</div>
          <div class="sg-stat-value" style={{ color: "var(--sg-text-dim)" }}>Spec</div>
        </button>

        {/* Plain launch (no server) */}
        <button
          class="sg-stat"
          style={{ "grid-column": "span 12", cursor: "pointer", "text-align": "center" }}
          onClick={() => launchGame()}
        >
          <div class="sg-stat-value">Launch ezQuake</div>
        </button>
      </Show>

      {/* Empty state when no ezQuake found */}
      <Show when={!installation()?.valid && !exePath()}>
        <div style={{ "grid-column": "span 12", "text-align": "center", padding: "2rem 0", opacity: 0.4 }}>
          <div style={{ "font-size": "0.85rem" }}>
            Set up your ezQuake installation to unlock config parsing, sensitivity import, and quick-launch.
          </div>
        </div>
      </Show>
    </div>
  );
}
