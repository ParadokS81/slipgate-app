import { Show, createSignal } from "solid-js";
import type { MovementKeys } from "../types";

const ELOSHAPES_CDN = "https://qyjffrmfirkwcwempawu.supabase.co/storage/v1/object/public/images/products/";

// Map our key names to mouse button IDs
function getMouseButtonId(key: string): string | null {
  const map: Record<string, string> = {
    Mouse1: "mouse1",
    Mouse2: "mouse2",
    Mouse3: "mouse3",
    Mouse4: "mouse4",
    Mouse5: "mouse5",
    MWheelUp: "mwheel",
    MWheelDown: "mwheel",
  };
  return map[key] ?? null;
}

interface MouseCardProps {
  movement: MovementKeys;
  mouseImage?: string | null;
  mouseName?: string | null;
}

/** Generic mouse SVG fallback */
function MouseSvgFallback(props: { btnClass: (id: string) => string }) {
  return (
    <svg viewBox="0 0 100 160" class="sg-mouse-svg-fallback" xmlns="http://www.w3.org/2000/svg">
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

/** Mouse photo card — shows product photo with SVG fallback */
export default function MouseLayout(props: MouseCardProps) {
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

  const showPhoto = () => imageUrl() && imageLoaded() && !imageError();

  return (
    <div class="sg-gear-card">
      <div class="sg-gear-card-img">
        <Show when={imageUrl()}>
          <img
            src={imageUrl()!}
            alt={props.mouseName ?? "Mouse"}
            class="sg-gear-card-photo"
            classList={{ "sg-gear-card-photo-loaded": imageLoaded() }}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
          />
        </Show>
        <Show when={!showPhoto()}>
          <MouseSvgFallback btnClass={btnClass} />
        </Show>
      </div>
    </div>
  );
}
