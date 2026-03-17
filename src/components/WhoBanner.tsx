import { Show, For } from "solid-js";
import type { QwStyledChar } from "../types";

// QuakeWorld 14-color palette for jersey top/bottom colors (indices 0-13)
// Derived from Quake palette rows — middle tones
const QW_COLORS: Record<number, string> = {
  0: "#b8b078",  // cream/tan
  1: "#a08450",  // brown
  2: "#6858a8",  // purple-blue
  3: "#587040",  // olive green
  4: "#a03030",  // red
  5: "#785848",  // dark tan
  6: "#a06838",  // orange/gold
  7: "#a09850",  // yellow-tan
  8: "#682878",  // purple
  9: "#583068",  // dark purple
  10: "#506898", // steel blue
  11: "#4878a0", // blue/teal
  12: "#c8b048", // yellow
  13: "#305888", // navy blue
};

function getQwColor(index: number): string {
  return QW_COLORS[index % 14] ?? QW_COLORS[0];
}

/** Render a QW-styled name as colored spans */
function QwName(props: { chars: QwStyledChar[]; class?: string }) {
  return (
    <span class={`qw-name ${props.class ?? ""}`}>
      <For each={props.chars}>
        {(ch) => <span class={`qw-${ch.color}`}>{ch.ch}</span>}
      </For>
    </span>
  );
}

/** Jersey color swatch — top/bottom split */
function JerseySwatch(props: { topcolor: number; bottomcolor: number }) {
  return (
    <div class="qw-jersey">
      <div class="qw-jersey-top" style={{ background: getQwColor(props.topcolor) }} />
      <div class="qw-jersey-bottom" style={{ background: getQwColor(props.bottomcolor) }} />
    </div>
  );
}

interface WhoBannerProps {
  playerNameQw: QwStyledChar[];
  teamQw: QwStyledChar[];
  topcolor: number;
  bottomcolor: number;
  map?: string; // mapshot name, defaults to "dm3"
}

export default function WhoBanner(props: WhoBannerProps) {
  const mapName = () => props.map ?? "dm3";
  const mapUrl = () => `https://a.quake.world/mapshots/webp/lg/${mapName()}.webp`;
  const hasTeam = () => props.teamQw.length > 0;

  return (
    <div class="who-banner">
      {/* Mapshot background */}
      <div
        class="who-banner-bg"
        style={{ "background-image": `url(${mapUrl()})` }}
      />
      <div class="who-banner-overlay" />

      {/* Content — single row: [jersey] [team] [name] */}
      <div class="who-banner-content">
        <div class="who-banner-row">
          <JerseySwatch topcolor={props.topcolor} bottomcolor={props.bottomcolor} />
          <Show when={hasTeam()}>
            <div class="who-banner-team">
              <QwName chars={props.teamQw} />
            </div>
          </Show>
          <div class="who-banner-name">
            <QwName chars={props.playerNameQw} />
          </div>
        </div>
      </div>
    </div>
  );
}
