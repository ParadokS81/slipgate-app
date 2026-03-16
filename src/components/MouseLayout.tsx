import type { MovementKeys } from "../types";

// Map our key names to mouse button IDs
function getMouseButtonId(key: string): string | null {
  const map: Record<string, string> = {
    "Mouse1": "mouse1",
    "Mouse2": "mouse2",
    "Mouse3": "mouse3",    // middle/scroll click
    "Mouse4": "mouse4",    // thumb back
    "Mouse5": "mouse5",    // thumb forward
    "MWheelUp": "mwheel",
    "MWheelDown": "mwheel",
  };
  return map[key] ?? null;
}

interface MouseLayoutProps {
  movement: MovementKeys;
}

export default function MouseLayout(props: MouseLayoutProps) {
  const jumpButton = () => getMouseButtonId(props.movement.jump);

  const buttonClass = (id: string) => {
    if (jumpButton() === id) return "sg-mouse-btn sg-mouse-jump";
    return "sg-mouse-btn";
  };

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

  return (
    <div class="sg-mouse-container">
      <svg viewBox="0 0 80 130" width="60" xmlns="http://www.w3.org/2000/svg">
        {/* Mouse body */}
        <rect x="5" y="20" width="70" height="100" rx="30" ry="20"
          class="sg-mouse-body" />

        {/* Left button (Mouse1) */}
        <path d="M5 50 L5 40 Q5 20 25 20 L38 20 L38 55 L5 55 Z"
          class={btnClass("mouse1")} />

        {/* Right button (Mouse2) */}
        <path d="M42 20 L55 20 Q75 20 75 40 L75 55 L42 55 L42 20 Z"
          class={btnClass("mouse2")} />

        {/* Scroll wheel */}
        <rect x="34" y="30" width="12" height="20" rx="6"
          class={btnClass("mwheel")} />

        {/* Side buttons (thumb) */}
        <rect x="0" y="62" width="8" height="14" rx="3"
          class={btnClass("mouse5")} />
        <rect x="0" y="80" width="8" height="14" rx="3"
          class={btnClass("mouse4")} />

        {/* Labels for highlighted buttons */}
        {jumpButton() === "mouse1" && <text x="22" y="44" class="sg-mouse-label">jump</text>}
        {jumpButton() === "mouse2" && <text x="58" y="44" class="sg-mouse-label">jump</text>}
        {jumpButton() === "mwheel" && <text x="40" y="64" class="sg-mouse-label">jump</text>}
        {jumpButton() === "mouse4" && <text x="4" y="78" class="sg-mouse-label-side">j</text>}
        {jumpButton() === "mouse5" && <text x="4" y="60" class="sg-mouse-label-side">j</text>}
      </svg>
    </div>
  );
}
