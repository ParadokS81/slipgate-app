import { createSignal, createMemo, For, Show, onMount } from "solid-js";
import type { MouseEntry, MousepadEntry } from "../types";

interface GearSelectorProps<T> {
  title: string;
  items: T[];
  onSelect: (item: T) => void;
  onClose: () => void;
  renderItem: (item: T) => { primary: string; secondary?: string };
  filterFn: (item: T, query: string) => boolean;
  initialQuery?: string;
}

export default function GearSelector<T>(props: GearSelectorProps<T>) {
  const [query, setQuery] = createSignal(props.initialQuery ?? "");
  let inputRef: HTMLInputElement | undefined;

  onMount(() => inputRef?.focus());

  const filtered = createMemo(() => {
    const q = query().toLowerCase().trim();
    if (!q) return props.items.slice(0, 50);
    return props.items.filter((item) => props.filterFn(item, q)).slice(0, 50);
  });

  const total = createMemo(() => {
    const q = query().toLowerCase().trim();
    if (!q) return props.items.length;
    return props.items.filter((item) => props.filterFn(item, q)).length;
  });

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") props.onClose();
  }

  return (
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
      onKeyDown={handleKeyDown}
    >
      <div class="bg-base-200 rounded-box w-[480px] max-h-[420px] flex flex-col shadow-2xl border border-base-content/10">
        {/* Header */}
        <div class="px-4 pt-4 pb-2">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-semibold">{props.title}</h3>
            <button
              class="text-xs opacity-30 hover:opacity-60 transition-opacity"
              onClick={props.onClose}
            >
              ESC
            </button>
          </div>
          <input
            ref={inputRef}
            type="text"
            class="input input-sm w-full bg-base-300 text-sm"
            placeholder="Search..."
            value={query()}
            onInput={(e) => setQuery(e.currentTarget.value)}
          />
          <div class="text-[10px] opacity-30 mt-1.5">
            {total() === props.items.length
              ? `${props.items.length} items`
              : `${total()} of ${props.items.length}`}
            {total() > 50 ? " (showing first 50)" : ""}
          </div>
        </div>

        {/* Results */}
        <div class="flex-1 overflow-y-auto px-2 pb-2">
          <Show
            when={filtered().length > 0}
            fallback={
              <div class="text-center text-xs opacity-30 py-8">
                No matches found
              </div>
            }
          >
            <For each={filtered()}>
              {(item) => {
                const display = props.renderItem(item);
                return (
                  <button
                    class="w-full text-left px-3 py-2 rounded-box hover:bg-base-300 transition-colors flex items-center justify-between gap-2 group"
                    onClick={() => props.onSelect(item)}
                  >
                    <span class="text-sm truncate">{display.primary}</span>
                    <Show when={display.secondary}>
                      <span class="text-[11px] opacity-40 shrink-0">
                        {display.secondary}
                      </span>
                    </Show>
                  </button>
                );
              }}
            </For>
          </Show>
        </div>
      </div>
    </div>
  );
}

// Pre-configured selectors

export function MouseSelector(props: {
  mice: MouseEntry[];
  onSelect: (mouse: MouseEntry) => void;
  onClose: () => void;
  initialQuery?: string;
}) {
  return (
    <GearSelector
      title="Select Mouse"
      items={props.mice}
      onSelect={props.onSelect}
      onClose={props.onClose}
      initialQuery={props.initialQuery}
      filterFn={(m, q) => {
        const searchStr = `${m.brand} ${m.model}`.toLowerCase();
        return q.split(/\s+/).every((word) => searchStr.includes(word));
      }}
      renderItem={(m) => ({
        primary: `${m.brand} ${m.model}`,
        secondary: [
          m.weight ? `${m.weight}g` : null,
          m.wireless ? "wireless" : m.wireless === false ? "wired" : null,
        ]
          .filter(Boolean)
          .join(" / "),
      })}
    />
  );
}

export function MousepadSelector(props: {
  mousepads: MousepadEntry[];
  onSelect: (pad: MousepadEntry) => void;
  onClose: () => void;
}) {
  return (
    <GearSelector
      title="Select Mousepad"
      items={props.mousepads}
      onSelect={props.onSelect}
      onClose={props.onClose}
      filterFn={(p, q) => {
        const searchStr = `${p.brand} ${p.model}`.toLowerCase();
        return q.split(/\s+/).every((word) => searchStr.includes(word));
      }}
      renderItem={(p) => ({
        primary: `${p.brand} ${p.model}`,
      })}
    />
  );
}
