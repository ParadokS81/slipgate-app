import { Show, createSignal } from "solid-js";
import type { MovementKeys } from "../types";

const ELOSHAPES_CDN = "https://qyjffrmfirkwcwempawu.supabase.co/storage/v1/object/public/images/products/";

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
  mouseImage?: string | null;       // EloShapes PNG filename
  mousepadName?: string | null;
  mousepadSpeed?: string | null;
  mousepadMaterial?: string | null;
  mousepadFirmness?: string | null;
}

/** Generic mouse SVG fallback — shown when no product photo available */
function MouseSvgFallback(props: { btnClass: (id: string) => string }) {
  return (
    <svg viewBox="0 0 100 160" class="sg-mouse-svg" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M50 8 C35 8 22 18 18 40 C14 62 13 95 16 120 C19 140 32 152 50 155 C68 152 81 140 84 120 C87 95 86 62 82 40 C78 18 65 8 50 8 Z"
        class="sg-mouse-body"
      />
      <path d="M48 10 C36 10 24 18 20 38 L20 62 L48 62 Z" class={props.btnClass("mouse1")} />
      <path d="M52 10 C64 10 76 18 80 38 L80 62 L52 62 Z" class={props.btnClass("mouse2")} />
      <rect x="43" y="28" width="14" height="24" rx="7" class={props.btnClass("mwheel")} />
      <rect x="7" y="76" width="10" height="15" rx="4" class={props.btnClass("mouse5")} />
      <rect x="8" y="95" width="10" height="15" rx="4" class={props.btnClass("mouse4")} />
    </svg>
  );
}

export default function MouseLayout(props: MouseLayoutProps) {
  const [imageLoaded, setImageLoaded] = createSignal(false);
  const [imageError, setImageError] = createSignal(false);

  const jumpButton = () => getMouseButtonId(props.movement.jump);

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

  const imageUrl = () => {
    const file = props.mouseImage;
    if (!file) return null;
    return ELOSHAPES_CDN + file;
  };

  // Show product photo if available and loaded, otherwise SVG fallback
  const showPhoto = () => imageUrl() && imageLoaded() && !imageError();

  const padTags = () => {
    const parts: string[] = [];
    if (props.mousepadSpeed) parts.push(props.mousepadSpeed);
    if (props.mousepadMaterial) parts.push(props.mousepadMaterial);
    if (props.mousepadFirmness) parts.push(props.mousepadFirmness);
    return parts.join(" · ");
  };

  const mouseTags = () => {
    const parts: string[] = [];
    if (props.mouseWeight) parts.push(`${props.mouseWeight}g`);
    if (props.mouseWireless === true) parts.push("wireless");
    else if (props.mouseWireless === false) parts.push("wired");
    return parts.join(" · ");
  };

  return (
    <div class="sg-mouse-on-pad">
      <div class="sg-mousepad-surface">
        {/* Product photo — hidden until loaded */}
        <Show when={imageUrl()}>
          <img
            src={imageUrl()!}
            alt={props.mouseName ?? "Mouse"}
            class="sg-mouse-photo"
            classList={{ "sg-mouse-photo-loaded": imageLoaded() }}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
          />
        </Show>

        {/* SVG fallback — shown when no photo or photo failed */}
        <Show when={!showPhoto()}>
          <MouseSvgFallback btnClass={btnClass} />
        </Show>

        {/* Mouse name + tags inside the pad */}
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
