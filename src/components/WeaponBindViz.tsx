import { For, Show } from "solid-js";
import type { WeaponBind, MovementKeys } from "../types";
import MouseSvg from "./MouseSvg";
import type { MouseHighlights } from "./MouseSvg";

/* ─── Weapon color palette (OKLCH) ─────────────────────────────────────── */

export const WEAPON_COLORS: Record<string, string> = {
  rl:  "oklch(0.7 0.2 30)",     // red/orange
  lg:  "oklch(0.8 0.15 210)",   // cyan
  gl:  "oklch(0.7 0.15 140)",   // green
  sng: "oklch(0.7 0.15 300)",   // purple
  ng:  "oklch(0.6 0.1 300)",    // dim purple
  ssg: "oklch(0.7 0.15 80)",    // yellow
  sg:  "oklch(0.5 0.05 0)",     // gray
  axe: "oklch(0.6 0.1 50)",     // brown
};

const WEAPON_LABELS: Record<string, string> = {
  rl: "RL", lg: "LG", gl: "GL", sng: "SNG", ng: "NG",
  ssg: "SSG", sg: "SG", axe: "AXE",
};

// All 8 weapons in impulse order (1–8)
const ALL_WEAPONS = ["axe", "sg", "ssg", "ng", "sng", "gl", "rl", "lg"];

/* ─── Weapon bind grid (4x2 + mouse) ──────────────────────────────────── */

// Map key name to MouseHighlights key
function toMouseButton(key: string): keyof MouseHighlights | null {
  const map: Record<string, keyof MouseHighlights> = {
    Mouse1: "mouse1", Mouse2: "mouse2",
    Mouse3: "mwheel", Mouse4: "mouse4", Mouse5: "mouse5",
    MWheelUp: "mwheel", MWheelDown: "mwheel",
  };
  return map[key] ?? null;
}

interface WeaponBindVizProps {
  weaponBinds: WeaponBind[];
  movement?: MovementKeys;
  showMovement?: boolean;
  /** When true, show weapon sprite icons. When false, show large colored acronyms. */
  showIcons?: boolean;
  /** Extra mouse button highlights (e.g. from teamsay binds). Won't override weapon/movement. */
  extraMouseHighlights?: MouseHighlights;
}

export default function WeaponBindViz(props: WeaponBindVizProps) {
  // Index weapon binds by weapon name for quick lookup
  const bindsByWeapon = () => {
    const map = new Map<string, WeaponBind[]>();
    for (const wb of props.weaponBinds) {
      const existing = map.get(wb.weapon) ?? [];
      existing.push(wb);
      map.set(wb.weapon, existing);
    }
    return map;
  };

  // Build mouse button highlights from movement + weapon binds
  const mouseHighlights = (): MouseHighlights => {
    const hl: MouseHighlights = {};
    // Movement highlights (jump, move keys on mouse)
    if (props.showMovement !== false && props.movement) {
      const m = props.movement;
      const jumpBtn = toMouseButton(m.jump);
      if (jumpBtn) hl[jumpBtn] = "oklch(0.65 0.18 145)"; // green (jump)
      for (const key of [m.forward, m.back, m.moveleft, m.moveright]) {
        const btn = toMouseButton(key);
        if (btn) hl[btn] = "oklch(0.76 0.13 235)"; // blue (movement)
      }
    }
    // Weapon highlights (key itself or fire_key on mouse)
    for (const wb of props.weaponBinds) {
      const btn = toMouseButton(wb.key);
      if (btn) hl[btn] = WEAPON_COLORS[wb.weapon] ?? "oklch(0.5 0.05 0)";
      if (wb.fire_key) {
        const fireBtn = toMouseButton(wb.fire_key);
        if (fireBtn && !hl[fireBtn]) {
          hl[fireBtn] = "oklch(0.55 0.06 250)"; // neutral fire button
        }
      }
    }
    // Extra highlights (teamsay etc.) — don't override existing
    if (props.extraMouseHighlights) {
      for (const [key, color] of Object.entries(props.extraMouseHighlights)) {
        if (!hl[key as keyof MouseHighlights]) {
          hl[key as keyof MouseHighlights] = color;
        }
      }
    }
    return hl;
  };

  return (
    <div class="sg-weapon-grid-wrap">
      {/* Mouse on the left */}
      <div class="sg-weapon-grid-mouse">
        <MouseSvg highlights={mouseHighlights()} />
      </div>

      {/* 4x2 weapon grid */}
      <div class="sg-weapon-grid">
        <For each={ALL_WEAPONS}>
          {(weapon) => {
            const binds = () => bindsByWeapon().get(weapon);
            const bound = () => !!binds();
            const color = WEAPON_COLORS[weapon] ?? "oklch(0.5 0.05 0)";
            // Use first bind for display (most players have one per weapon)
            const primary = () => binds()?.[0];

            return (
              <div class="sg-weapon-cell" classList={{ "sg-weapon-cell-unbound": !bound() }}>
                {/* Headline: icon or large acronym (mutually exclusive) */}
                <Show when={props.showIcons !== false} fallback={
                  <span
                    class="sg-weapon-cell-name"
                    style={bound() ? `color: ${color}` : undefined}
                  >
                    {WEAPON_LABELS[weapon] ?? weapon.toUpperCase()}
                  </span>
                }>
                  <img
                    src={`/weapons/${weapon}.png`}
                    alt={weapon}
                    class="sg-weapon-cell-icon"
                  />
                </Show>
                {/* Bind info (only when bound) */}
                <Show when={primary()}>
                  {(wb) => {
                    const isManual = wb().method === "manual";
                    return (
                      <>
                        <span class="sg-weapon-cell-method" classList={{
                          "sg-weapon-bind-quickfire": !isManual,
                          "sg-weapon-bind-manual": isManual,
                        }}>
                          {wb().method}
                        </span>
                        <span class="sg-weapon-cell-bind">
                          <span class="sg-keycap">{wb().key}</span>
                          <Show when={isManual && wb().fire_key}>
                            <span class="sg-weapon-cell-arrow">&rarr;</span>
                            <span class="sg-keycap">{wb().fire_key}</span>
                          </Show>
                        </span>
                      </>
                    );
                  }}
                </Show>
              </div>
            );
          }}
        </For>
      </div>
    </div>
  );
}
