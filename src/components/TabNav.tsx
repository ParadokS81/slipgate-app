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
    <div class="sg-tabs" style={{ margin: "8px" }}>
      <For each={props.tabs}>
        {(tab) => (
          <button
            class={`sg-tab ${props.active === tab.id ? "active" : ""}`}
            onClick={() => props.onSelect(tab.id)}
          >
            {tab.label}
          </button>
        )}
      </For>
    </div>
  );
}
