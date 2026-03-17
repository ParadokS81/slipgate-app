import { Show, createMemo } from "solid-js";
import type { MovementKeys } from "../types";

/* ─── US QWERTY layout data ─────────────────────────────────────────────── */

interface KeyDef {
  id: string;    // matches ezQuake key name (uppercase letters, "Space", "Ctrl", etc.)
  label: string; // display label on keycap
  x: number;     // x position in keyboard units (1u = standard key width)
  w: number;     // width in keyboard units
  row: number;   // row index (0 = number row … 4 = space bar row)
}

const LAYOUT: KeyDef[] = [
  // Row 0 — Number row
  { id: "`", label: "`", x: 0, w: 1, row: 0 },
  { id: "1", label: "1", x: 1, w: 1, row: 0 },
  { id: "2", label: "2", x: 2, w: 1, row: 0 },
  { id: "3", label: "3", x: 3, w: 1, row: 0 },
  { id: "4", label: "4", x: 4, w: 1, row: 0 },
  { id: "5", label: "5", x: 5, w: 1, row: 0 },
  { id: "6", label: "6", x: 6, w: 1, row: 0 },
  { id: "7", label: "7", x: 7, w: 1, row: 0 },
  { id: "8", label: "8", x: 8, w: 1, row: 0 },
  { id: "9", label: "9", x: 9, w: 1, row: 0 },
  { id: "0", label: "0", x: 10, w: 1, row: 0 },
  { id: "-", label: "-", x: 11, w: 1, row: 0 },
  { id: "=", label: "=", x: 12, w: 1, row: 0 },
  { id: "Backspace", label: "⌫", x: 13, w: 2, row: 0 },

  // Row 1 — Top alpha
  { id: "Tab", label: "Tab", x: 0, w: 1.5, row: 1 },
  { id: "Q", label: "Q", x: 1.5, w: 1, row: 1 },
  { id: "W", label: "W", x: 2.5, w: 1, row: 1 },
  { id: "E", label: "E", x: 3.5, w: 1, row: 1 },
  { id: "R", label: "R", x: 4.5, w: 1, row: 1 },
  { id: "T", label: "T", x: 5.5, w: 1, row: 1 },
  { id: "Y", label: "Y", x: 6.5, w: 1, row: 1 },
  { id: "U", label: "U", x: 7.5, w: 1, row: 1 },
  { id: "I", label: "I", x: 8.5, w: 1, row: 1 },
  { id: "O", label: "O", x: 9.5, w: 1, row: 1 },
  { id: "P", label: "P", x: 10.5, w: 1, row: 1 },
  { id: "[", label: "[", x: 11.5, w: 1, row: 1 },
  { id: "]", label: "]", x: 12.5, w: 1, row: 1 },
  { id: "\\", label: "\\", x: 13.5, w: 1.5, row: 1 },

  // Row 2 — Home row
  { id: "CapsLock", label: "Caps", x: 0, w: 1.75, row: 2 },
  { id: "A", label: "A", x: 1.75, w: 1, row: 2 },
  { id: "S", label: "S", x: 2.75, w: 1, row: 2 },
  { id: "D", label: "D", x: 3.75, w: 1, row: 2 },
  { id: "F", label: "F", x: 4.75, w: 1, row: 2 },
  { id: "G", label: "G", x: 5.75, w: 1, row: 2 },
  { id: "H", label: "H", x: 6.75, w: 1, row: 2 },
  { id: "J", label: "J", x: 7.75, w: 1, row: 2 },
  { id: "K", label: "K", x: 8.75, w: 1, row: 2 },
  { id: "L", label: "L", x: 9.75, w: 1, row: 2 },
  { id: ";", label: ";", x: 10.75, w: 1, row: 2 },
  { id: "'", label: "'", x: 11.75, w: 1, row: 2 },
  { id: "Enter", label: "↵", x: 12.75, w: 2.25, row: 2 },

  // Row 3 — Bottom alpha
  { id: "Shift", label: "Shift", x: 0, w: 2.25, row: 3 },
  { id: "Z", label: "Z", x: 2.25, w: 1, row: 3 },
  { id: "X", label: "X", x: 3.25, w: 1, row: 3 },
  { id: "C", label: "C", x: 4.25, w: 1, row: 3 },
  { id: "V", label: "V", x: 5.25, w: 1, row: 3 },
  { id: "B", label: "B", x: 6.25, w: 1, row: 3 },
  { id: "N", label: "N", x: 7.25, w: 1, row: 3 },
  { id: "M", label: "M", x: 8.25, w: 1, row: 3 },
  { id: ",", label: ",", x: 9.25, w: 1, row: 3 },
  { id: ".", label: ".", x: 10.25, w: 1, row: 3 },
  { id: "/", label: "/", x: 11.25, w: 1, row: 3 },
  { id: "RShift", label: "Shift", x: 12.25, w: 2.75, row: 3 },

  // Row 4 — Modifiers + Space
  { id: "Ctrl", label: "Ctrl", x: 0, w: 1.25, row: 4 },
  { id: "Win", label: "Win", x: 1.25, w: 1.25, row: 4 },
  { id: "Alt", label: "Alt", x: 2.5, w: 1.25, row: 4 },
  { id: "Space", label: "", x: 3.75, w: 6.25, row: 4 },
  { id: "RAlt", label: "Alt", x: 10, w: 1.25, row: 4 },
  { id: "RWin", label: "Win", x: 11.25, w: 1.25, row: 4 },
  { id: "Menu", label: "Fn", x: 12.5, w: 1.25, row: 4 },
  { id: "RCtrl", label: "Ctrl", x: 13.75, w: 1.25, row: 4 },
];

// Fast lookup by ID
const KEY_BY_ID = new Map(LAYOUT.map(k => [k.id, k]));

/* ─── Key name mapping ──────────────────────────────────────────────────── */

// Map ezQuake config key names → layout IDs.  Returns null for mouse buttons.
function toLayoutId(key: string): string | null {
  if (key.startsWith("Mouse") || key.startsWith("MWheel")) return null;

  const map: Record<string, string> = {
    Space: "Space", Tab: "Tab", CapsLock: "CapsLock",
    Shift: "Shift", Ctrl: "Ctrl", Alt: "Alt",
    Enter: "Enter", Backspace: "Backspace",
  };
  if (key in map) return map[key];

  // Single letter → uppercase to match layout ID
  if (key.length === 1 && /[a-z]/i.test(key)) return key.toUpperCase();

  // Single character (number, punctuation)
  if (key.length === 1) return key;

  return null;
}

/* ─── SVG constants ─────────────────────────────────────────────────────── */

const KU = 40;          // 1 keyboard unit in SVG coordinates
const PAD = 2;          // padding inside each key cell
const ROW_H = 40;       // row height in SVG coordinates
const NUM_ROWS = 5;
const TOTAL_H = NUM_ROWS * ROW_H;
const VIEW_W_U = 8;     // viewport width in keyboard units
const TOTAL_W_U = 15;   // full keyboard width in keyboard units

/* ─── Component ─────────────────────────────────────────────────────────── */

interface KeyboardLayoutProps {
  movement: MovementKeys;
}

export default function KeyboardLayout(props: KeyboardLayoutProps) {
  // Resolve which layout keys are movement / jump
  const resolved = createMemo(() => {
    const m = props.movement;
    const moveIds = new Set<string>();
    for (const key of [m.forward, m.back, m.moveleft, m.moveright]) {
      const id = toLayoutId(key);
      if (id) moveIds.add(id);
    }
    const jumpId = toLayoutId(m.jump);
    return { moveIds, jumpId };
  });

  // Compute SVG viewBox — zoomed into the cluster around movement keys
  const viewBox = createMemo(() => {
    const { moveIds, jumpId } = resolved();

    // Centroid source: prefer movement keys, fall back to jump only
    const centroidIds = moveIds.size > 0
      ? moveIds
      : jumpId ? new Set([jumpId]) : new Set<string>();

    if (centroidIds.size === 0) return null; // nothing on keyboard

    // Average x-center of the relevant keys
    let sumX = 0, count = 0;
    for (const id of centroidIds) {
      const k = KEY_BY_ID.get(id);
      if (k) { sumX += k.x + k.w / 2; count++; }
    }
    if (count === 0) return null;

    const centroidX = sumX / count;

    // Center the viewport on the cluster, clamp to layout bounds
    let xMin = centroidX - VIEW_W_U / 2;
    xMin = Math.max(0, Math.min(xMin, TOTAL_W_U - VIEW_W_U));

    return `${xMin * KU} 0 ${VIEW_W_U * KU} ${TOTAL_H}`;
  });

  const keyClass = (id: string) => {
    const { moveIds, jumpId } = resolved();
    if (id === jumpId) return "sg-kb-key sg-kb-jump";
    if (moveIds.has(id)) return "sg-kb-key sg-kb-move";
    return "sg-kb-key";
  };

  return (
    <Show when={viewBox()}>
      <div class="sg-keyboard-container">
        <svg viewBox={viewBox()!} xmlns="http://www.w3.org/2000/svg">
          {LAYOUT.map(k => (
            <g>
              <rect
                x={k.x * KU + PAD}
                y={k.row * ROW_H + PAD}
                width={k.w * KU - PAD * 2}
                height={ROW_H - PAD * 2}
                rx={4}
                class={keyClass(k.id)}
              />
              <text
                x={k.x * KU + (k.w * KU) / 2}
                y={k.row * ROW_H + ROW_H / 2 + 4}
                class={`sg-kb-label${resolved().moveIds.has(k.id) ? " sg-kb-label-move" : k.id === resolved().jumpId ? " sg-kb-label-jump" : ""}`}
              >
                {k.label}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </Show>
  );
}
