import { Show, For, createSignal, createEffect, onCleanup } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { ArrowLeft, HardDrive, Crosshair, Monitor, Rocket, Download } from "lucide-solid";
import type { EzQuakeInstallation, EzQuakeConfig, MonitorInfo, UpdateCheckResult, UpdateProgress, UpdateResult } from "../types";
import type { ProfileData } from "../store";
import { getPrimarySetup, updatePrimaryClient } from "../store";
import Changelog from "./Changelog";

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

  // Update state
  const [updateCheck, setUpdateCheck] = createSignal<UpdateCheckResult | null>(null);
  const [updateProgress, setUpdateProgress] = createSignal<UpdateProgress | null>(null);
  const [updateResult, setUpdateResult] = createSignal<UpdateResult | null>(null);
  const [isChecking, setIsChecking] = createSignal(false);
  const [isUpdating, setIsUpdating] = createSignal(false);
  const [updateChannel, setUpdateChannel] = createSignal<"stable" | "snapshot">("stable");

  // Listen for progress events from Rust backend
  let unlistenProgress: (() => void) | null = null;
  (async () => {
    unlistenProgress = await listen<UpdateProgress>("update-progress", (event) => {
      setUpdateProgress(event.payload);
    });
  })();
  onCleanup(() => unlistenProgress?.());

  // Restore saved path from profile store
  createEffect(() => {
    const prof = props.profile;
    if (!prof) return;
    const setup = getPrimarySetup(prof);
    const savedPath = setup.client.exe_path;
    if (setup.client.update_channel) {
      setUpdateChannel(setup.client.update_channel);
    }
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

  // ─── Update functions ──────────────────────────────────────────────────────

  async function checkForUpdate() {
    const path = exePath();
    if (!path) return;
    setIsChecking(true);
    setUpdateCheck(null);
    setUpdateResult(null);
    setError("");
    try {
      const result = await invoke<UpdateCheckResult>("check_for_update", {
        exePath: path,
        clientName: "ezQuake",
        channel: updateChannel(),
      });
      setUpdateCheck(result);
    } catch (e) {
      setError(String(e));
    } finally {
      setIsChecking(false);
    }
  }

  async function performUpdate() {
    const check = updateCheck();
    if (!check) return;

    // Check if running first
    try {
      const running = await invoke<boolean>("check_client_running", { exeName: null });
      if (running) {
        setError("ezQuake is currently running. Close it before updating.");
        return;
      }
    } catch { /* proceed if check fails */ }

    setIsUpdating(true);
    setUpdateProgress(null);
    setUpdateResult(null);
    setError("");
    try {
      const result = await invoke<UpdateResult>("download_and_install_update", {
        exePath: exePath(),
        clientName: "ezQuake",
        channel: updateChannel(),
        downloadUrl: check.download_url,
        checksumsUrl: check.checksums_url,
      });
      setUpdateResult(result);
      if (result.success) {
        // Re-validate to update stored version
        await validateAndLoad(exePath());
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleChannelChange(channel: "stable" | "snapshot") {
    setUpdateChannel(channel);
    setUpdateCheck(null);
    setUpdateResult(null);
    await updatePrimaryClient({ update_channel: channel });
  }

  /** Parse PE version "3.6.6.7947" into display parts */
  function parseVersion(pe: string | null | undefined) {
    if (!pe) return { semver: null, build: null };
    const parts = pe.split(".");
    return {
      semver: parts.slice(0, 3).join("."),
      build: parts[3] ?? null,
    };
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

        {/* Updates */}
        <Show when={installation()?.valid}>
          <div class="sg-card">
            <div class="sg-card-header">
              <Download size={16} />
              <span>Updates</span>
            </div>

            {/* Channel selector */}
            <div class="sg-row">
              <span class="sg-row-label">Channel</span>
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
                  value={updateChannel()}
                  onChange={(e) => handleChannelChange(e.currentTarget.value as "stable" | "snapshot")}
                >
                  <option value="stable" style={{ background: "#1a1a2e" }}>Stable</option>
                  <option value="snapshot" style={{ background: "#1a1a2e" }}>Snapshot</option>
                </select>
              </span>
            </div>

            {/* Current version */}
            <Row
              label="Current"
              value={(() => {
                const v = parseVersion(installation()?.version);
                if (!v.semver) return "Unknown";
                return v.build ? `${v.semver} (build ${v.build})` : v.semver;
              })()}
            />

            {/* Latest version + check button */}
            <div class="sg-row">
              <span class="sg-row-label">Latest</span>
              <span class="sg-row-value" style={{ display: "flex", "align-items": "center", gap: "8px" }}>
                <Show when={updateCheck()?.latest_version} fallback="—">
                  <span classList={{
                    "sg-text-success": !updateCheck()?.update_available,
                    "sg-text-warning": updateCheck()?.update_available,
                  }}>
                    {updateCheck()?.latest_version}
                  </span>
                  <Show when={!updateCheck()?.update_available}>
                    <span style={{ "font-size": "11px", opacity: 0.6 }}>Up to date</span>
                  </Show>
                </Show>
                <button
                  class="sg-launch-btn"
                  style={{ "margin-left": "auto", "font-size": "11px", padding: "2px 10px" }}
                  onClick={checkForUpdate}
                  disabled={isChecking() || isUpdating()}
                >
                  {isChecking() ? "Checking..." : "Check Now"}
                </button>
              </span>
            </div>

            {/* Changelog */}
            <Show when={updateCheck()?.update_available && updateCheck()!.release_notes.length > 0}>
              <Changelog notes={updateCheck()!.release_notes} snapshot={updateCheck()!.snapshot} />
            </Show>

            {/* Progress bar during update */}
            <Show when={isUpdating() && updateProgress()}>
              <div style={{ margin: "8px 72px" }}>
                <Show when={updateProgress()!.percent !== null}>
                  <div style={{
                    height: "4px",
                    "border-radius": "2px",
                    background: "var(--sg-stat-border)",
                    overflow: "hidden",
                    "margin-bottom": "4px",
                  }}>
                    <div style={{
                      height: "100%",
                      background: "oklch(var(--p))",
                      "border-radius": "2px",
                      transition: "width 0.3s ease",
                      width: `${updateProgress()!.percent}%`,
                    }} />
                  </div>
                </Show>
                <div style={{ "font-size": "11px", color: "var(--sg-section-label)" }}>
                  {updateProgress()!.message}
                </div>
              </div>
            </Show>

            {/* Update result */}
            <Show when={updateResult()}>
              <div style={{
                margin: "8px 72px",
                "font-size": "12px",
                color: updateResult()!.success ? "oklch(var(--su))" : "#f87171",
              }}>
                <Show when={updateResult()!.success}>
                  Updated to {updateResult()!.new_version}
                  <Show when={updateResult()!.backup_path}>
                    {" "}— previous saved as{" "}
                    <span style={{ opacity: 0.7 }}>
                      {updateResult()!.backup_path!.split(/[/\\]/).pop()}
                    </span>
                  </Show>
                </Show>
                <Show when={!updateResult()!.success}>
                  Update failed: {updateResult()!.error}
                </Show>
              </div>
            </Show>

            {/* Update button */}
            <Show when={updateCheck()?.update_available && !isUpdating() && !updateResult()?.success}>
              <div class="sg-row" style={{ "justify-content": "center" }}>
                <button
                  class="sg-launch-btn sg-launch-btn-primary"
                  onClick={performUpdate}
                >
                  Update to {updateCheck()!.latest_version}
                </button>
              </div>
            </Show>
          </div>
        </Show>

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
