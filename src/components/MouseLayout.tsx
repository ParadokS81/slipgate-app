import { Show } from "solid-js";
import type { MovementKeys, MousepadEntry } from "../types";

// Map our key names to mouse button IDs
function getMouseButtonId(key: string): string | null {
  const map: Record<string, string> = {
    Mouse1: "mouse1",
    Mouse2: "mouse2",
    Mouse3: "mouse3",    // middle/scroll click
    Mouse4: "mouse4",    // thumb back
    Mouse5: "mouse5",    // thumb forward
    MWheelUp: "mwheel",
    MWheelDown: "mwheel",
  };
  return map[key] ?? null;
}

interface MouseLayoutProps {
  movement: MovementKeys;
  mouseName?: string | null;
  mouseWeight?: number | null;
  mouseWireless?: boolean | null;
  mousepadName?: string | null;
  mousepadSpeed?: string | null;
  mousepadMaterial?: string | null;
  mousepadFirmness?: string | null;
}

export default function MouseLayout(props: MouseLayoutProps) {
  const jumpButton = () => getMouseButtonId(props.movement.jump);

  // Check if any movement key is a mouse button
  const moveButtons = () => {
    const m = props.movement;
    const btns = new Set<string>();
    for (const key of [m.forward, m.back, m.moveleft, m.moveright]) {
      const id = getMouseButtonId(key);
      if (id) btns.add(id);
    }
    return btns;
  };

  const btnClass = (id: string) => {
    if (jumpButton() === id) return "sg-mouse-btn sg-mouse-jump";
    if (moveButtons().has(id)) return "sg-mouse-btn sg-mouse-move";
    return "sg-mouse-btn";
  };

  // Mousepad tag line: "control · fabric · soft"
  const padTags = () => {
    const parts: string[] = [];
    if (props.mousepadSpeed) parts.push(props.mousepadSpeed);
    if (props.mousepadMaterial) parts.push(props.mousepadMaterial);
    if (props.mousepadFirmness) parts.push(props.mousepadFirmness);
    return parts.join(" · ");
  };

  // Mouse tag line: "63g · wireless"
  const mouseTags = () => {
    const parts: string[] = [];
    if (props.mouseWeight) parts.push(`${props.mouseWeight}g`);
    if (props.mouseWireless === true) parts.push("wireless");
    else if (props.mouseWireless === false) parts.push("wired");
    return parts.join(" · ");
  };

  return (
    <div class="sg-mouse-on-pad">
      {/* Mousepad surface rectangle */}
      <div class="sg-mousepad-surface">
        {/* Mouse SVG sitting on the pad */}
        <svg viewBox="0 0 100 160" class="sg-mouse-svg" xmlns="http://www.w3.org/2000/svg">
          {/* Mouse body — ergonomic shape (GPX-inspired) */}
          <path
            d="M50 8 C35 8 22 18 18 40 C14 62 13 95 16 120 C19 140 32 152 50 155 C68 152 81 140 84 120 C87 95 86 62 82 40 C78 18 65 8 50 8 Z"
            class="sg-mouse-body"
          />

          {/* Left button (Mouse1) */}
          <path
            d="M48 10 C36 10 24 18 20 38 L20 62 L48 62 Z"
            class={btnClass("mouse1")}
          />

          {/* Right button (Mouse2) */}
          <path
            d="M52 10 C64 10 76 18 80 38 L80 62 L52 62 Z"
            class={btnClass("mouse2")}
          />

          {/* Scroll wheel */}
          <rect x="43" y="28" width="14" height="24" rx="7"
            class={btnClass("mwheel")}
          />

          {/* Side buttons (thumb) */}
          <rect x="7" y="76" width="10" height="15" rx="4"
            class={btnClass("mouse5")}
          />
          <rect x="8" y="95" width="10" height="15" rx="4"
            class={btnClass("mouse4")}
          />
        </svg>

        {/* Mouse name overlay inside the pad, below the mouse */}
        <Show when={props.mouseName}>
          <div class="sg-pad-mouse-label">
            <span class="sg-pad-mouse-name">{props.mouseName}</span>
            <Show when={mouseTags()}>
              <span class="sg-pad-mouse-tags">{mouseTags()}</span>
            </Show>
          </div>
        </Show>
      </div>

      {/* Mousepad name + specs below the surface */}
      <Show when={props.mousepadName}>
        <div class="sg-pad-label">
          <span class="sg-pad-name">{props.mousepadName}</span>
          <Show when={padTags()}>
            <span class="sg-pad-tags">{padTags()}</span>
          </Show>
        </div>
      </Show>
    </div>
  );
}
