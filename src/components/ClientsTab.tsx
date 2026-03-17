import { Show, For, createSignal, createEffect } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { ArrowLeft, HardDrive, Crosshair, Monitor, Rocket } from "lucide-solid";
import type { EzQuakeInstallation, EzQuakeConfig, MonitorInfo } from "../types";
import type { ProfileData } from "../store";
import { getPrimarySetup } from "../store";

interface ClientsTabProps {
  onConfigLoaded?: (config: EzQuakeConfig, exePath: string, configName: string, version: string | null) => void;
  monitor?: MonitorInfo | null;
  profile?: ProfileData | null;
}

/** A single label -> value row inside a card */
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

export default function ClientsTab(props: ClientsTabProps) {
  const [view, setView] = createSignal<"list" | "detail">("list");
  const [exePath, setExePath] = createSignal("");
  const [installation, setInstallation] = createSignal<EzQuakeInstallation | null>(null);
  const [config, setConfig] = createSignal<EzQuakeConfig | null>(null);
  const [selectedConfig, setSelectedConfig] = createSignal("config.cfg");
  const [error, setError] = createSignal("");
  const [connectAddress, setConnectAddress] = createSignal("");

  // Restore saved path from profile store
  createEffect(() => {
    const prof = props.profile;
    if (!prof) return;
    const setup = getPrimarySetup(prof);
    const savedPath = setup.client.exe_path;
    if (savedPath && !exePath()) {
      setExePath(savedPath);
      if (setup.client.config_name) {
        setSelectedConfig(setup.client.config_name);
      }
      validateAndLoad(savedPath);
    }
  });

  async function validateAndLoad(path: string) {
    setError("");
    try {
      const info = await invoke<EzQuakeInstallation>("validate_ezquake_path", { exePath: path });
      setInstallation(info);
      if (info.valid) {
        setExePath(path);
        const cfgName = info.config_files.includes("config.cfg") ? "config.cfg" : info.config_files[0];
        if (cfgName) {
          setSelectedConfig(cfgName);
          await loadConfig(path, cfgName, info.version);
        }
      } else {
        setError("Not a valid ezQuake executable");
      }
    } catch (e) {
      setError(String(e));
    }
  }

  async function loadConfig(path: string, cfgName: string, version?: string | null) {
    try {
      const cfg = await invoke<EzQuakeConfig>("read_ezquake_config", {
        exePath: path,
        configName: cfgName,
      });
      setConfig(cfg);
      setError("");
      // Notify App.tsx — saves path + config name + version to store
      props.onConfigLoaded?.(cfg, path, cfgName, version ?? null);
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
      await loadConfig(path, cfgName, installation()?.version);
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

  // Effective sensitivity multiplier
  const effectiveSens = () => {
    const cfg = config();
    if (!cfg) return null;
    return cfg.sensitivity * cfg.m_yaw;
  };

  // Effective resolution
  const effectiveRes = () => {
    const cfg = config();
    if (cfg && cfg.vid_width > 0 && cfg.vid_height > 0) {
      return { w: cfg.vid_width, h: cfg.vid_height };
    }
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

  async function handleClientClick() {
    if (installation()?.valid) {
      setView("detail");
    } else {
      await browseForExe();
      if (installation()?.valid) {
        setView("detail");
      }
    }
  }

  return (
    <div class="sg-profile-cards">
      {/* ============================================================
          List View
          ============================================================ */}
      <Show when={view() === "list"}>
        <div class="sg-card sg-row-clickable" onClick={handleClientClick}>
          <div class="sg-card-header">
            <HardDrive size={16} />
            <span>ezQuake</span>
          </div>
          <div class="sg-row">
            <span class="sg-row-value" classList={{ "sg-dim": !installation()?.valid }}>
              {installation()?.valid ? exePath() : "Click to set up..."}
            </span>
          </div>
        </div>
      </Show>

      {/* ============================================================
          Detail View
          ============================================================ */}
      <Show when={view() === "detail"}>
        {/* Back navigation */}
        <div
          class="sg-row-clickable"
          style={{
            color: "var(--sg-section-label)",
            "font-size": "12px",
            display: "flex",
            "align-items": "center",
            gap: "4px",
            padding: "0 0 4px",
          }}
          onClick={() => setView("list")}
        >
          <ArrowLeft size={14} />
          Clients
        </div>

        {/* Installation */}
        <div class="sg-card">
          <div class="sg-card-header">
            <HardDrive size={16} />
            <span>Installation</span>
          </div>
          <div class="sg-row sg-row-clickable" onClick={browseForExe}>
            <span class="sg-row-label">Path</span>
            <span
              class="sg-row-value"
              style={{ overflow: "hidden", "text-overflow": "ellipsis" }}
              title={exePath()}
            >
              {exePath()}
            </span>
          </div>
          <div class="sg-row">
            <span class="sg-row-label">Config</span>
            <span class="sg-row-value">
              <select
                style={{
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  cursor: "pointer",
                  color: "inherit",
                  "font-size": "inherit",
                  "font-weight": "inherit",
                  "font-family": "inherit",
                }}
                value={selectedConfig()}
                onChange={(e) => handleConfigChange(e.currentTarget.value)}
              >
                <For each={installation()?.config_files ?? []}>
                  {(file) => <option value={file} style={{ background: "#1a1a2e" }}>{file}</option>}
                </For>
              </select>
            </span>
          </div>
          <Row label="Player Name" value={config()?.player_name} />
        </div>

        {/* Input Settings */}
        <div class="sg-card">
          <div class="sg-card-header">
            <Crosshair size={16} />
            <span>Input</span>
          </div>
          <Row label="Sensitivity" value={config()?.sensitivity?.toString()} />
          <Row label="m_yaw" value={config()?.m_yaw?.toString()} />
          <Row label="m_pitch" value={config()?.m_pitch?.toString()} />
          <Row label="Effective" value={effectiveSens() !== null ? effectiveSens()!.toFixed(4) : null} />
          <Row label="Raw Input" value={config()?.in_raw ? "Yes" : "No"} />
          <Row label="Mouse Accel" value={config()?.m_accel ? String(config()!.m_accel) : "Off"} />
        </div>

        {/* Video Settings */}
        <div class="sg-card">
          <div class="sg-card-header">
            <Monitor size={16} />
            <span>Video</span>
          </div>
          <Row label="FOV" value={config()?.fov?.toFixed(1)} />
          <Row label="Resolution" value={effectiveResLabel()} />
          <Row label="Max FPS" value={config()?.cl_maxfps ? String(config()!.cl_maxfps) : "Unlocked"} />
        </div>

        {/* Launch */}
        <div class="sg-card">
          <div class="sg-card-header">
            <Rocket size={16} />
            <span>Launch</span>
          </div>
          <div class="sg-row">
            <span class="sg-row-label">Server</span>
            <div class="sg-input-group">
              <input
                type="text"
                class="sg-row-input"
                style={{ width: "200px" }}
                placeholder="ip:port (optional)"
                value={connectAddress()}
                onInput={(e) => setConnectAddress(e.currentTarget.value)}
              />
            </div>
          </div>
          <div class="sg-row" style={{ gap: "8px" }}>
            <span class="sg-row-label" />
            <button class="sg-launch-btn sg-launch-btn-primary" onClick={() => launchGame("connect")}>
              Join
            </button>
            <button class="sg-launch-btn" onClick={() => launchGame("observe")}>
              Spec
            </button>
            <button class="sg-launch-btn" onClick={() => launchGame()}>
              Launch
            </button>
          </div>
        </div>

        {/* Error */}
        <Show when={error()}>
          <div style={{ color: "#f87171", "font-size": "12px" }}>
            {error()}
          </div>
        </Show>
      </Show>
    </div>
  );
}
