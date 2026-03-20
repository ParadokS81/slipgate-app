import { Show, createMemo } from "solid-js";
import type { MovementKeys } from "../types";

/* ─── US QWERTY TKL layout data ─────────────────────────────────────── */

interface KeyDef {
  id: string;    // matches ezQuake key name
  label: string; // display label on keycap
  x: number;     // x position in keyboard units (1u = standard key width)
  w: number;     // width in keyboard units
  row: number;   // row index (0 = F-row … 5 = space bar row)
}

// Main block ends at x=15 (backspace 13+2), nav cluster starts at 15.5
const NAV_X = 15.5;
// Arrow cluster: centered under nav, left arrow at NAV_X
const ARR_X = NAV_X;

// Vertical gaps (in row-height fractions)
const FROW_GAP = 0.4;   // gap between F-row and number row

const LAYOUT: KeyDef[] = [
  // Row 0 — Function row
  { id: "Escape", label: "Esc", x: 0, w: 1, row: 0 },
  { id: "F1", label: "F1", x: 1.25, w: 1, row: 0 },
  { id: "F2", label: "F2", x: 2.25, w: 1, row: 0 },
  { id: "F3", label: "F3", x: 3.25, w: 1, row: 0 },
  { id: "F4", label: "F4", x: 4.25, w: 1, row: 0 },
  { id: "F5", label: "F5", x: 5.5, w: 1, row: 0 },
  { id: "F6", label: "F6", x: 6.5, w: 1, row: 0 },
  { id: "F7", label: "F7", x: 7.5, w: 1, row: 0 },
  { id: "F8", label: "F8", x: 8.5, w: 1, row: 0 },
  { id: "F9", label: "F9", x: 9.75, w: 1, row: 0 },
  { id: "F10", label: "F10", x: 10.75, w: 1, row: 0 },
  { id: "F11", label: "F11", x: 11.75, w: 1, row: 0 },
  { id: "F12", label: "F12", x: 12.75, w: 1, row: 0 },

  // Row 1 — Number row + nav cluster top
  { id: "`", label: "`", x: 0, w: 1, row: 1 },
  { id: "1", label: "1", x: 1, w: 1, row: 1 },
  { id: "2", label: "2", x: 2, w: 1, row: 1 },
  { id: "3", label: "3", x: 3, w: 1, row: 1 },
  { id: "4", label: "4", x: 4, w: 1, row: 1 },
  { id: "5", label: "5", x: 5, w: 1, row: 1 },
  { id: "6", label: "6", x: 6, w: 1, row: 1 },
  { id: "7", label: "7", x: 7, w: 1, row: 1 },
  { id: "8", label: "8", x: 8, w: 1, row: 1 },
  { id: "9", label: "9", x: 9, w: 1, row: 1 },
  { id: "0", label: "0", x: 10, w: 1, row: 1 },
  { id: "-", label: "-", x: 11, w: 1, row: 1 },
  { id: "=", label: "=", x: 12, w: 1, row: 1 },
  { id: "Backspace", label: "⌫", x: 13, w: 2, row: 1 },
  { id: "Insert", label: "Ins", x: NAV_X, w: 1, row: 1 },
  { id: "Home", label: "Hm", x: NAV_X + 1, w: 1, row: 1 },
  { id: "PageUp", label: "PU", x: NAV_X + 2, w: 1, row: 1 },

  // Row 2 — Top alpha + nav cluster middle
  { id: "Tab", label: "Tab", x: 0, w: 1.5, row: 2 },
  { id: "Q", label: "Q", x: 1.5, w: 1, row: 2 },
  { id: "W", label: "W", x: 2.5, w: 1, row: 2 },
  { id: "E", label: "E", x: 3.5, w: 1, row: 2 },
  { id: "R", label: "R", x: 4.5, w: 1, row: 2 },
  { id: "T", label: "T", x: 5.5, w: 1, row: 2 },
  { id: "Y", label: "Y", x: 6.5, w: 1, row: 2 },
  { id: "U", label: "U", x: 7.5, w: 1, row: 2 },
  { id: "I", label: "I", x: 8.5, w: 1, row: 2 },
  { id: "O", label: "O", x: 9.5, w: 1, row: 2 },
  { id: "P", label: "P", x: 10.5, w: 1, row: 2 },
  { id: "[", label: "[", x: 11.5, w: 1, row: 2 },
  { id: "]", label: "]", x: 12.5, w: 1, row: 2 },
  { id: "\\", label: "\\", x: 13.5, w: 1.5, row: 2 },
  { id: "Delete", label: "Del", x: NAV_X, w: 1, row: 2 },
  { id: "End", label: "End", x: NAV_X + 1, w: 1, row: 2 },
  { id: "PageDown", label: "PD", x: NAV_X + 2, w: 1, row: 2 },

  // Row 3 — Home row
  { id: "CapsLock", label: "Caps", x: 0, w: 1.75, row: 3 },
  { id: "A", label: "A", x: 1.75, w: 1, row: 3 },
  { id: "S", label: "S", x: 2.75, w: 1, row: 3 },
  { id: "D", label: "D", x: 3.75, w: 1, row: 3 },
  { id: "F", label: "F", x: 4.75, w: 1, row: 3 },
  { id: "G", label: "G", x: 5.75, w: 1, row: 3 },
  { id: "H", label: "H", x: 6.75, w: 1, row: 3 },
  { id: "J", label: "J", x: 7.75, w: 1, row: 3 },
  { id: "K", label: "K", x: 8.75, w: 1, row: 3 },
  { id: "L", label: "L", x: 9.75, w: 1, row: 3 },
  { id: ";", label: ";", x: 10.75, w: 1, row: 3 },
  { id: "'", label: "'", x: 11.75, w: 1, row: 3 },
  { id: "Enter", label: "↵", x: 12.75, w: 2.25, row: 3 },

  // Row 4 — Bottom alpha + Up arrow
  { id: "Shift", label: "Shift", x: 0, w: 2.25, row: 4 },
  { id: "Z", label: "Z", x: 2.25, w: 1, row: 4 },
  { id: "X", label: "X", x: 3.25, w: 1, row: 4 },
  { id: "C", label: "C", x: 4.25, w: 1, row: 4 },
  { id: "V", label: "V", x: 5.25, w: 1, row: 4 },
  { id: "B", label: "B", x: 6.25, w: 1, row: 4 },
  { id: "N", label: "N", x: 7.25, w: 1, row: 4 },
  { id: "M", label: "M", x: 8.25, w: 1, row: 4 },
  { id: ",", label: ",", x: 9.25, w: 1, row: 4 },
  { id: ".", label: ".", x: 10.25, w: 1, row: 4 },
  { id: "/", label: "/", x: 11.25, w: 1, row: 4 },
  { id: "RShift", label: "Shift", x: 12.25, w: 2.75, row: 4 },
  { id: "UpArrow", label: "↑", x: ARR_X + 1, w: 1, row: 4 },

  // Row 5 — Modifiers + Space + Arrow keys
  { id: "Ctrl", label: "Ctrl", x: 0, w: 1.25, row: 5 },
  { id: "Win", label: "Win", x: 1.25, w: 1.25, row: 5 },
  { id: "Alt", label: "Alt", x: 2.5, w: 1.25, row: 5 },
  { id: "Space", label: "", x: 3.75, w: 6.25, row: 5 },
  { id: "RAlt", label: "Alt", x: 10, w: 1.25, row: 5 },
  { id: "RWin", label: "Win", x: 11.25, w: 1.25, row: 5 },
  { id: "RCtrl", label: "Ctrl", x: 12.5, w: 1.25, row: 5 },
  { id: "Fn", label: "Fn", x: 13.75, w: 1.25, row: 5 },
  { id: "LeftArrow", label: "←", x: ARR_X, w: 1, row: 5 },
  { id: "DownArrow", label: "↓", x: ARR_X + 1, w: 1, row: 5 },
  { id: "RightArrow", label: "→", x: ARR_X + 2, w: 1, row: 5 },
];

// Fast lookup by ID (used by consumers)
export const KEY_BY_ID = new Map(LAYOUT.map(k => [k.id, k]));

/* ─── Key name mapping ──────────────────────────────────────────────────── */

/** Map ezQuake config key names → layout IDs.  Returns null for mouse buttons. */
export function toLayoutId(key: string): string | null {
  if (key.startsWith("Mouse") || key.startsWith("MWheel")) return null;

  const map: Record<string, string> = {
    Space: "Space", Tab: "Tab", CapsLock: "CapsLock",
    Shift: "Shift", Ctrl: "Ctrl", Alt: "Alt",
    Enter: "Enter", Backspace: "Backspace",
    Escape: "Escape", Esc: "Escape",
    // Arrow keys
    UpArrow: "UpArrow", DownArrow: "DownArrow",
    LeftArrow: "LeftArrow", RightArrow: "RightArrow",
    // Right-side modifiers
    RShift: "RShift", RCtrl: "RCtrl", RAlt: "RAlt", RWin: "RWin",
    // F-keys
    F1: "F1", F2: "F2", F3: "F3", F4: "F4",
    F5: "F5", F6: "F6", F7: "F7", F8: "F8",
    F9: "F9", F10: "F10", F11: "F11", F12: "F12",
    // Nav cluster
    Delete: "Delete", Del: "Delete",
    Insert: "Insert", Ins: "Insert",
    Home: "Home", End: "End",
    PageUp: "PageUp", PgUp: "PageUp",
    PageDown: "PageDown", PgDn: "PageDown",
    Fn: "Fn",
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
const NUM_ROWS = 6;
const GAP_PX = FROW_GAP * ROW_H;  // F-row gap in pixels
const TOTAL_H = NUM_ROWS * ROW_H + GAP_PX;
const TOTAL_W_U = NAV_X + 3; // TKL width: main block + nav cluster

/** Convert row index to Y pixel position, accounting for F-row gap */
function rowY(row: number): number {
  return row * ROW_H + (row >= 1 ? GAP_PX : 0);
}

/* ─── Component ─────────────────────────────────────────────────────────── */

export interface KeyHighlight {
  color: string;   // OKLCH color string
}

interface KeyboardLayoutProps {
  movement: MovementKeys;
  keyboardName?: string | null;
  /** Per-key highlights (key layout ID → color). Overrides movement highlights when present. */
  highlights?: Map<string, KeyHighlight>;
  /** When true, movement keys are dimmed instead of highlighted (bind viz mode). */
  showMovement?: boolean;
  /** Per-key label overrides (key layout ID → display label). Shows bound function instead of physical key. */
  keyLabels?: Map<string, string>;
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

  // Always show the keyboard when we have data
  const viewBox = `0 0 ${TOTAL_W_U * KU} ${TOTAL_H}`;

  const showMovement = () => props.showMovement !== false; // default true

  const keyClass = (id: string) => {
    // Custom highlights take precedence
    if (props.highlights?.has(id)) return "sg-kb-key sg-kb-highlight";
    // Movement highlights only when showMovement is on
    if (showMovement()) {
      const { moveIds, jumpId } = resolved();
      if (id === jumpId) return "sg-kb-key sg-kb-jump";
      if (moveIds.has(id)) return "sg-kb-key sg-kb-move";
    }
    return "sg-kb-key";
  };

  const keyStyle = (id: string): string | undefined => {
    const hl = props.highlights?.get(id);
    if (!hl) return undefined;
    return `fill: color-mix(in oklch, ${hl.color} 35%, var(--sg-grad-dark)); stroke: color-mix(in oklch, ${hl.color} 50%, var(--sg-stat-border));`;
  };

  const labelClass = (id: string) => {
    if (props.highlights?.has(id)) return "sg-kb-label sg-kb-label-highlight";
    if (showMovement()) {
      if (resolved().moveIds.has(id)) return "sg-kb-label sg-kb-label-move";
      if (id === resolved().jumpId) return "sg-kb-label sg-kb-label-jump";
    }
    return "sg-kb-label";
  };

  const labelStyle = (id: string): string | undefined => {
    const hl = props.highlights?.get(id);
    if (!hl) return undefined;
    return `fill: ${hl.color}; font-weight: 700;`;
  };

  return (
    <div class="sg-keyboard-container">
      <svg viewBox={viewBox} xmlns="http://www.w3.org/2000/svg">
        {/* Keyboard name — same 0.25u gap as between F-key groups */}
        <Show when={props.keyboardName}>
          <rect
            x={14 * KU + PAD}
            y={PAD}
            width={(TOTAL_W_U - 14) * KU - PAD * 2}
            height={ROW_H - PAD * 2}
            rx={4}
            class="sg-kb-key sg-kb-name-bg"
          />
          <text
            x={(14 + (TOTAL_W_U - 14) / 2) * KU}
            y={ROW_H / 2 + 3}
            class="sg-kb-name-label"
          >
            {props.keyboardName}
          </text>
        </Show>
        {LAYOUT.map(k => (
          <g>
            <rect
              x={k.x * KU + PAD}
              y={rowY(k.row) + PAD}
              width={k.w * KU - PAD * 2}
              height={ROW_H - PAD * 2}
              rx={4}
              class={keyClass(k.id)}
              style={keyStyle(k.id)}
            />
            <text
              x={k.x * KU + (k.w * KU) / 2}
              y={rowY(k.row) + ROW_H / 2 + 4}
              class={labelClass(k.id)}
              style={labelStyle(k.id)}
              font-size={props.keyLabels?.has(k.id) && (props.keyLabels.get(k.id)!.length > 3) ? "7" : undefined}
            >
              {props.keyLabels?.get(k.id) ?? k.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
