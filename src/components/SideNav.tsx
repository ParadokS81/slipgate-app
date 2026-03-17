import { For } from "solid-js";
import { Calendar, User, Wrench, Monitor, Settings } from "lucide-solid";
import type { JSX } from "solid-js";

interface NavItem {
  id: string;
  label: string;
  icon: (props: { size: number }) => JSX.Element;
}

const NAV_ITEMS: NavItem[] = [
  { id: "schedule", label: "Schedule", icon: Calendar },
  { id: "profile", label: "Profile", icon: User },
  { id: "tools", label: "Tools", icon: Wrench },
  { id: "clients", label: "Clients", icon: Monitor },
  { id: "settings", label: "Settings", icon: Settings },
];

interface SideNavProps {
  active: string;
  onSelect: (id: string) => void;
}

export default function SideNav(props: SideNavProps) {
  return (
    <nav class="sg-sidebar">
      <For each={NAV_ITEMS}>
        {(item) => (
          <button
            class={`sg-sidebar-item ${props.active === item.id ? "active" : ""}`}
            onClick={() => props.onSelect(item.id)}
          >
            <item.icon size={20} />
            <span>{item.label}</span>
          </button>
        )}
      </For>
    </nav>
  );
}
