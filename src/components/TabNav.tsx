import { For } from "solid-js";

export interface Tab {
  id: string;
  label: string;
}

interface TabNavProps {
  tabs: Tab[];
  active: string;
  onSelect: (id: string) => void;
}

export default function TabNav(props: TabNavProps) {
  return (
    <nav class="flex border-b border-base-content/5 bg-base-300 px-2">
      <For each={props.tabs}>
        {(tab) => (
          <button
            class={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
              props.active === tab.id
                ? "text-primary"
                : "text-base-content/40 hover:text-base-content/70"
            }`}
            onClick={() => props.onSelect(tab.id)}
          >
            {tab.label}
            {props.active === tab.id && (
              <div class="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full" />
            )}
          </button>
        )}
      </For>
    </nav>
  );
}
