import { Show, For, createSignal, createMemo } from "solid-js";
import { Gauge, RefreshCw, Ruler } from "lucide-solid";
import type { EzQuakeConfig, MonitorInfo } from "../types";

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

interface ToolsTabProps {
  ezConfig?: EzQuakeConfig | null;
  monitor?: MonitorInfo | null;
  refreshHz?: number | null;
}

export default function ToolsTab(props: ToolsTabProps) {
  // ============================================================
  // Shared helpers
  // ============================================================
  const effectiveRes = () => {
    const cfg = props.ezConfig;
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
    const cfg = props.ezConfig;
    const isFromConfig = cfg && cfg.vid_width > 0;
    return isFromConfig ? `${r.w}x${r.h}` : `${r.w}x${r.h} (Desktop)`;
  };

  const effectiveHz = createMemo(() => {
    const cfgHz = props.ezConfig?.vid_displayfrequency;
    if (cfgHz && cfgHz > 0) return { hz: cfgHz, source: "cfg" as const };
    if (props.refreshHz && props.refreshHz > 0) return { hz: props.refreshHz, source: "system" as const };
    return null;
  });

  // ============================================================
  // FPS Optimizer
  // ============================================================
  const QW_TICK = 77;
  const [stableFpsInput, setStableFpsInput] = createSignal("");

  interface FpsCandidate {
    fps: number;
    refreshMultiple: number;
    nearest77: number;
    deviation: number;
    deviationPct: number;
  }

  const fpsRecommendations = createMemo((): FpsCandidate[] => {
    const hzInfo = effectiveHz();
    const ceiling = parseInt(stableFpsInput());
    if (!hzInfo || !ceiling || ceiling <= 0) return [];
    const hz = hzInfo.hz;
    const candidates: FpsCandidate[] = [];
    for (let mult = 1; mult * hz <= ceiling; mult++) {
      const fps = mult * hz;
      const nearest77mult = Math.round(fps / QW_TICK);
      const nearest77 = nearest77mult * QW_TICK;
      const deviation = Math.abs(fps - nearest77);
      const deviationPct = (deviation / fps) * 100;
      candidates.push({ fps, refreshMultiple: mult, nearest77, deviation, deviationPct });
    }
    candidates.sort((a, b) => a.deviationPct - b.deviationPct || b.fps - a.fps);
    return candidates;
  });

  const currentFpsAnalysis = createMemo(() => {
    const cfg = props.ezConfig;
    const hzInfo = effectiveHz();
    if (!cfg?.cl_maxfps || !hzInfo) return null;
    const fps = cfg.cl_maxfps;
    const hz = hzInfo.hz;
    const isRefreshAligned = fps % hz === 0;
    const nearest77mult = Math.round(fps / QW_TICK);
    const nearest77 = nearest77mult * QW_TICK;
    const deviation = Math.abs(fps - nearest77);
    const deviationPct = (deviation / fps) * 100;
    return { fps, isRefreshAligned, refreshMultiple: isRefreshAligned ? fps / hz : null, deviationPct };
  });

  // ============================================================
  // Sensitivity DPI Recalculator
  // ============================================================
  const [newDpiInput, setNewDpiInput] = createSignal("");
  const [currentDpiInput, setCurrentDpiInput] = createSignal("");

  const currentSens = () => props.ezConfig?.sensitivity ?? null;
  const currentYaw = () => props.ezConfig?.m_yaw ?? 0.022;

  // cm/360 from current settings
  const currentCm360 = createMemo(() => {
    const dpi = parseInt(currentDpiInput());
    const sens = currentSens();
    const yaw = currentYaw();
    if (dpi && dpi > 0 && sens && sens > 0 && yaw > 0) {
      return 914.4 / (dpi * sens * yaw);
    }
    return null;
  });

  // New sensitivity to maintain same cm/360 at new DPI
  const newSensitivity = createMemo(() => {
    const cm = currentCm360();
    const newDpi = parseInt(newDpiInput());
    const yaw = currentYaw();
    if (!cm || !newDpi || newDpi <= 0 || !yaw || yaw <= 0) return null;
    // cm/360 = 914.4 / (dpi * sens * yaw) => sens = 914.4 / (dpi * cm * yaw)
    return 914.4 / (newDpi * cm * yaw);
  });

  // ============================================================
  // FOV Recalculator
  // ============================================================
  const [fovNewWidth, setFovNewWidth] = createSignal("");
  const [fovNewHeight, setFovNewHeight] = createSignal("");

  const recalcFov = () => {
    const cfg = props.ezConfig;
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
    <div class="sg-profile-cards">
      {/* ============================================================
          FPS Optimizer
          ============================================================ */}
      <div class="sg-card">
        <div class="sg-card-header">
          <Gauge size={16} />
          <span>FPS Optimizer</span>
        </div>
        <div class="sg-row">
          <span class="sg-row-label">Monitor Hz</span>
          <span class="sg-row-value" classList={{ "sg-dim": !effectiveHz() }}>
            {effectiveHz()
              ? `${effectiveHz()!.hz} Hz${effectiveHz()!.source === "cfg" ? " (cfg)" : ""}`
              : "Not detected"}
          </span>
        </div>
        <div class="sg-row">
          <span class="sg-row-label">cl_maxfps</span>
          <span class="sg-row-value">
            <Show when={currentFpsAnalysis()} fallback={props.ezConfig?.cl_maxfps ? String(props.ezConfig!.cl_maxfps) : "Unlocked"}>
              {(() => {
                const a = currentFpsAnalysis()!;
                const color = a.isRefreshAligned
                  ? a.deviationPct < 1 ? "#4ade80" : a.deviationPct < 2 ? "#a3e635" : "var(--sg-text-dim)"
                  : "#f87171";
                return (
                  <span>
                    {a.fps}
                    <span style={{ color, "font-size": "11px", "margin-left": "6px" }}>
                      {a.isRefreshAligned ? `${a.deviationPct.toFixed(2)}% off 77` : "not aligned to Hz"}
                    </span>
                  </span>
                );
              })()}
            </Show>
          </span>
        </div>
        <div class="sg-row">
          <span class="sg-row-label">FPS Ceiling</span>
          <div class="sg-input-group">
            <input
              type="number"
              class="sg-row-input"
              placeholder="e.g. 1500"
              value={stableFpsInput()}
              onInput={(e) => setStableFpsInput(e.currentTarget.value)}
            />
          </div>
        </div>
        <Show when={fpsRecommendations().length > 0}>
          <div class="sg-row" style={{ "min-height": "20px" }}>
            <span class="sg-row-value" style={{ "font-size": "11px", color: "var(--sg-section-label)" }}>
              Multiples of {effectiveHz()?.hz} Hz, ranked by 77 Hz alignment
            </span>
          </div>
          <For each={fpsRecommendations().slice(0, 5)}>
            {(c, i) => {
              const isBest = () => i() === 0;
              const color = () =>
                c.deviationPct < 0.5 ? "#4ade80"
                : c.deviationPct < 1.5 ? "#a3e635"
                : c.deviationPct < 3 ? "var(--sg-text-dim)"
                : "#f87171";
              return (
                <div class="sg-row" style={{ "min-height": "24px", "padding-top": "2px", "padding-bottom": "2px" }}>
                  <span style={{ width: "18px", "text-align": "right", "font-size": "11px", color: "var(--sg-section-label)", "flex-shrink": "0" }}>
                    {isBest() ? "\u2605" : ""}
                  </span>
                  <span class="sg-row-value" style={{ width: "60px", "flex-shrink": "0", "margin-left": "8px" }}>{c.fps}</span>
                  <span style={{ "font-size": "11px", color: "var(--sg-section-label)", width: "70px", "flex-shrink": "0" }}>
                    {effectiveHz()?.hz}{"\u00d7"}{c.refreshMultiple}
                  </span>
                  <span style={{ "font-size": "12px", color: color(), "min-width": "80px" }}>
                    {c.deviationPct.toFixed(2)}% off 77
                  </span>
                  <span style={{ "font-size": "11px", color: "var(--sg-section-label)" }}>
                    (nearest: {c.nearest77})
                  </span>
                </div>
              );
            }}
          </For>
        </Show>
      </div>

      {/* ============================================================
          Sensitivity DPI Recalculator
          ============================================================ */}
      <div class="sg-card">
        <div class="sg-card-header">
          <RefreshCw size={16} />
          <span>Sensitivity Recalculator</span>
        </div>
        <Row label="Sensitivity" value={currentSens()?.toString()}>
          <Show when={currentSens()} fallback={<span class="sg-dim">Load config in Clients tab</span>}>
            {currentSens()}
            <span class="sg-from-cfg" style={{ "margin-left": "8px" }}>cfg</span>
          </Show>
        </Row>
        <Row label="m_yaw" value={currentYaw()?.toString()}>
          {currentYaw()}
          <Show when={props.ezConfig}>
            <span class="sg-from-cfg" style={{ "margin-left": "8px" }}>cfg</span>
          </Show>
        </Row>
        <div class="sg-row">
          <span class="sg-row-label">Current DPI</span>
          <div class="sg-input-group">
            <input
              type="number"
              class="sg-row-input"
              placeholder="e.g. 800"
              value={currentDpiInput()}
              onInput={(e) => setCurrentDpiInput(e.currentTarget.value)}
            />
          </div>
        </div>
        <Row label="cm/360" dim={!currentCm360()}>
          {currentCm360() ? `${currentCm360()!.toFixed(1)} cm` : "Set DPI above"}
        </Row>
        <div class="sg-hsep" />
        <div class="sg-row">
          <span class="sg-row-label">New DPI</span>
          <div class="sg-input-group">
            <input
              type="number"
              class="sg-row-input"
              placeholder="e.g. 1600"
              value={newDpiInput()}
              onInput={(e) => setNewDpiInput(e.currentTarget.value)}
            />
          </div>
        </div>
        <div class="sg-row">
          <span class="sg-row-label">New Sensitivity</span>
          <span class="sg-row-value" classList={{ "sg-dim": !newSensitivity() }}>
            <Show when={newSensitivity()} fallback="Set both DPI values">
              <span style={{ color: "var(--color-primary)", "font-weight": "600" }}>
                {newSensitivity()!.toFixed(4)}
              </span>
              <span style={{ "font-size": "11px", color: "var(--sg-section-label)", "margin-left": "8px" }}>
                (same {currentCm360()!.toFixed(1)} cm/360)
              </span>
            </Show>
          </span>
        </div>
      </div>

      {/* ============================================================
          FOV Recalculator
          ============================================================ */}
      <div class="sg-card">
        <div class="sg-card-header">
          <Ruler size={16} />
          <span>FOV Recalculator</span>
        </div>
        <Row label="Current FOV" dim={!props.ezConfig?.fov}>
          <Show when={props.ezConfig?.fov} fallback="Load config in Clients tab">
            {props.ezConfig!.fov.toFixed(1)}
          </Show>
        </Row>
        <Row label="Current Res" value={effectiveResLabel()} />
        <div class="sg-row">
          <span class="sg-row-label">New Width</span>
          <div class="sg-input-group">
            <input
              type="number"
              class="sg-row-input"
              placeholder="e.g. 1920"
              value={fovNewWidth()}
              onInput={(e) => setFovNewWidth(e.currentTarget.value)}
            />
          </div>
        </div>
        <div class="sg-row">
          <span class="sg-row-label">New Height</span>
          <div class="sg-input-group">
            <input
              type="number"
              class="sg-row-input"
              placeholder="e.g. 1080"
              value={fovNewHeight()}
              onInput={(e) => setFovNewHeight(e.currentTarget.value)}
            />
          </div>
        </div>
        <div class="sg-row">
          <span class="sg-row-label">Equivalent FOV</span>
          <span class="sg-row-value" classList={{ "sg-dim": !recalcFov() }}>
            {recalcFov() ?? "Enter new resolution above"}
          </span>
        </div>
      </div>
    </div>
  );
}
