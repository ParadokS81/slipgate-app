import { Show, For } from "solid-js";
import type { AllSpecs, MonitorInfo } from "../types";

function formatRam(gb: number): string {
  return `${Math.round(gb)} GB`;
}

function formatOs(name: string, version: string): string {
  const ver = version.split("(")[0].trim();
  if (name === "Windows") return `Win ${ver}`;
  if (ver) return `${name} ${ver}`;
  return name;
}

interface ProfileTabProps {
  specs: AllSpecs | null;
  monitor: MonitorInfo | null;
  loading: boolean;
  onRefresh: () => void;
}

export default function ProfileTab(props: ProfileTabProps) {
  const mice = () => props.specs?.hid_devices.filter((d) => d.device_type === "mouse") ?? [];
  const keyboards = () => props.specs?.hid_devices.filter((d) => d.device_type === "keyboard") ?? [];
  const microphones = () => props.specs?.audio_devices.filter((d) => d.device_type === "input") ?? [];
  const hasPeripherals = () => mice().length > 0 || keyboards().length > 0 || microphones().length > 0;

  return (
    <div class="space-y-6">
      {/* System specs */}
      <section>
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-xs font-semibold uppercase tracking-wider opacity-40">System</h2>
          <button
            class="text-xs opacity-30 hover:opacity-60 transition-opacity"
            onClick={props.onRefresh}
          >
            Refresh
          </button>
        </div>
        <Show
          when={!props.loading}
          fallback={
            <div class="grid grid-cols-2 gap-2">
              <SpecCard label="CPU" value="Detecting..." dim />
              <SpecCard label="GPU" value="Detecting..." dim />
              <div class="bg-base-300 rounded-box p-3 flex">
                <div class="flex-1">
                  <div class="text-xs opacity-30 mb-1">RAM</div>
                  <div class="font-mono text-sm opacity-25">--</div>
                </div>
                <div class="flex-1">
                  <div class="text-xs opacity-30 mb-1">OS</div>
                  <div class="font-mono text-sm opacity-25">--</div>
                </div>
              </div>
              <SpecCard label="Display" value="Detecting..." dim />
            </div>
          }
        >
          <div class="grid grid-cols-2 gap-2">
            <SpecCard label="CPU" value={props.specs?.cpu.model} title={props.specs?.cpu.model} />
            <SpecCard
              label="GPU"
              value={props.specs?.gpu?.model ?? "Not detected"}
              title={props.specs?.gpu?.model}
            />
            <div class="bg-base-300 rounded-box p-3 flex">
              <div class="flex-1">
                <div class="text-xs opacity-30 mb-1">RAM</div>
                <div class="font-mono text-sm">
                  {props.specs ? formatRam(props.specs.ram.total_gb) : "--"}
                </div>
              </div>
              <div class="flex-1">
                <div class="text-xs opacity-30 mb-1">OS</div>
                <div class="font-mono text-sm truncate">
                  {props.specs ? formatOs(props.specs.os.name, props.specs.os.version) : "--"}
                </div>
              </div>
            </div>
            <div class="bg-base-300 rounded-box p-3">
              <div class="text-xs opacity-30 mb-1 truncate">
                {"Display"}
                {props.monitor && props.monitor.count > 1 ? ` 1/${props.monitor.count}` : ""}
                {props.specs?.display.monitor_name ? ` ${props.specs.display.monitor_name}` : ""}
              </div>
              <div class="font-mono text-sm truncate">
                {props.monitor?.resolution ?? "--"}
                {props.specs?.display.refresh_hz ? ` @ ${props.specs.display.refresh_hz}Hz` : ""}
              </div>
            </div>
          </div>
        </Show>
      </section>

      {/* Peripherals */}
      <Show when={hasPeripherals()}>
        <section>
          <h2 class="text-xs font-semibold uppercase tracking-wider opacity-40 mb-3">
            Peripherals
          </h2>
          <div class="space-y-1.5">
            <For each={mice()}>
              {(device) => <PeripheralRow label="Mouse" value={device.name} />}
            </For>
            <For each={keyboards()}>
              {(device) => <PeripheralRow label="Keyboard" value={device.name} />}
            </For>
            <For each={microphones()}>
              {(device) => <PeripheralRow label="Microphone" value={device.name} />}
            </For>
          </div>
        </section>
      </Show>

      {/* Sensitivity — placeholder for future */}
      <section>
        <h2 class="text-xs font-semibold uppercase tracking-wider opacity-40 mb-3">
          Sensitivity
        </h2>
        <div class="grid grid-cols-2 gap-2">
          <div class="bg-base-300 rounded-box p-3">
            <div class="text-xs opacity-30 mb-1">DPI</div>
            <div class="font-mono text-sm opacity-25">Not set</div>
          </div>
          <div class="bg-base-300 rounded-box p-3">
            <div class="text-xs opacity-30 mb-1">cm/360</div>
            <div class="font-mono text-sm opacity-25">Not set</div>
          </div>
        </div>
      </section>
    </div>
  );
}

function SpecCard(props: { label: string; value?: string; title?: string; dim?: boolean }) {
  return (
    <div class="bg-base-300 rounded-box p-3">
      <div class="text-xs opacity-30 mb-1">{props.label}</div>
      <div
        class={`font-mono text-sm truncate ${props.dim ? "opacity-25" : ""}`}
        title={props.title}
      >
        {props.value ?? "--"}
      </div>
    </div>
  );
}

function PeripheralRow(props: { label: string; value: string }) {
  return (
    <div class="flex justify-between items-center px-3 py-2 rounded-box bg-base-300 text-sm">
      <span class="text-xs opacity-40 shrink-0">{props.label}</span>
      <span class="font-mono text-xs truncate ml-4 opacity-60">{props.value}</span>
    </div>
  );
}
