import { onMount, onCleanup, createEffect } from "solid-js";
import Keyboard from "simple-keyboard";
import "simple-keyboard/build/css/index.css";
import type { MovementKeys } from "../types";

// Map our key names back to simple-keyboard button names
function toKeyboardButton(key: string): string {
  const map: Record<string, string> = {
    // Letters are lowercase in simple-keyboard
    "Space": "{space}",
    "Tab": "{tab}",
    "CapsLock": "{lock}",
    "Shift": "{shiftleft}",
    "Ctrl": "{controlleft}",
    "Alt": "{altleft}",
    "Enter": "{enter}",
    "Backspace": "{backspace}",
    "Esc": "{escape}",
    // Arrow keys
    "↑": "{arrowup}",
    "↓": "{arrowdown}",
    "←": "{arrowleft}",
    "→": "{arrowright}",
    // Numpad
    "KP_INS": "{numpadzero}",
    "KP_END": "{numpadone}",
    "KP_DOWNARROW": "{numpadtwo}",
    "KP_PGDN": "{numpadthree}",
    "KP_LEFTARROW": "{numpadfour}",
    "KP_5": "{numpadfive}",
    "KP_RIGHTARROW": "{numpadsix}",
    "KP_HOME": "{numpadseven}",
    "KP_UPARROW": "{numpadeight}",
    "KP_PGUP": "{numpadnine}",
    // Navigation cluster
    "INS": "{insert}",
    "DEL": "{delete}",
    "HOME": "{home}",
    "END": "{end}",
    "PGUP": "{pageup}",
    "PGDN": "{pagedown}",
    // Mouse buttons — not on keyboard, skip
    "Mouse1": "", "Mouse2": "", "Mouse3": "", "Mouse4": "", "Mouse5": "",
    "MWheelUp": "", "MWheelDown": "",
  };

  // Check direct mapping first
  if (key in map) return map[key];

  // Single letter → lowercase
  if (key.length === 1 && key.match(/[a-zA-Z]/)) return key.toLowerCase();

  // Single character (punctuation)
  if (key.length === 1) return key;

  // Function keys
  if (key.match(/^F\d+$/i)) return `{f${key.slice(1)}}`;

  return key.toLowerCase();
}

interface KeyboardLayoutProps {
  movement: MovementKeys;
  layout?: string; // "us" | "swedish" | "german" etc., default "us"
}

export default function KeyboardLayout(props: KeyboardLayoutProps) {
  let containerRef: HTMLDivElement | undefined;
  let keyboard: any;

  onMount(() => {
    if (!containerRef) return;

    keyboard = new Keyboard(containerRef, {
      layout: {
        default: [
          "{escape} {f1} {f2} {f3} {f4} {f5} {f6} {f7} {f8} {f9} {f10} {f11} {f12}",
          "` 1 2 3 4 5 6 7 8 9 0 - = {backspace}",
          "{tab} q w e r t y u i o p [ ] \\",
          "{lock} a s d f g h j k l ; ' {enter}",
          "{shiftleft} z x c v b n m , . / {shiftright}",
          "{controlleft} {altleft} {space} {altright} {controlright}",
        ],
      },
      display: {
        "{escape}": "Esc",
        "{tab}": "Tab",
        "{lock}": "Caps",
        "{shiftleft}": "Shift",
        "{shiftright}": "Shift",
        "{controlleft}": "Ctrl",
        "{controlright}": "Ctrl",
        "{altleft}": "Alt",
        "{altright}": "Alt",
        "{backspace}": "←",
        "{enter}": "Enter",
        "{space}": " ",
        "{f1}": "F1", "{f2}": "F2", "{f3}": "F3", "{f4}": "F4",
        "{f5}": "F5", "{f6}": "F6", "{f7}": "F7", "{f8}": "F8",
        "{f9}": "F9", "{f10}": "F10", "{f11}": "F11", "{f12}": "F12",
      },
      theme: "hg-theme-default sg-keyboard-dark",
      physicalKeyboardHighlight: false,
      preventMouseDownDefault: true,
      disableButtonHold: true,
    });

    highlightKeys();
  });

  function highlightKeys() {
    if (!keyboard) return;

    // Clear previous highlights
    keyboard.removeButtonTheme(
      "{space} {tab} {lock} {shiftleft} {controlleft} {altleft} {enter} {backspace} " +
      "q w e r t y u i o p a s d f g h j k l z x c v b n m " +
      "1 2 3 4 5 6 7 8 9 0 , . / ; ' [ ] \\ ` - =",
      "sg-key-move sg-key-jump"
    );

    const m = props.movement;
    const moveKeys = [m.forward, m.back, m.moveleft, m.moveright]
      .map(toKeyboardButton)
      .filter(k => k !== "");
    const jumpKey = toKeyboardButton(m.jump);

    if (moveKeys.length > 0) {
      keyboard.addButtonTheme(moveKeys.join(" "), "sg-key-move");
    }
    if (jumpKey) {
      keyboard.addButtonTheme(jumpKey, "sg-key-jump");
    }
  }

  createEffect(() => {
    // Re-highlight when movement keys change
    const _m = props.movement;
    highlightKeys();
  });

  onCleanup(() => {
    if (keyboard) keyboard.destroy();
  });

  return <div ref={containerRef} class="sg-keyboard-container" />;
}
