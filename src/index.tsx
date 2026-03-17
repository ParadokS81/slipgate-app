/* @refresh reload */
import { render } from "solid-js/web";
import "./app.css";
import App from "./App";

render(() => <App />, document.getElementById("root") as HTMLElement);

// WebView2 can lose its rendering context after sleep/hibernation on Windows,
// showing a white screen. Detect this by tracking how long the page was hidden
// and reload when it comes back after an extended absence.
let lastActiveTime = Date.now();
setInterval(() => { lastActiveTime = Date.now(); }, 5000);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && Date.now() - lastActiveTime > 30_000) {
    window.location.reload();
  }
});
