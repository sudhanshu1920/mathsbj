import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./glass.css";
import { setupPWA } from "./pwa";
import { initDesktopMode } from "./components/DesktopModeToggle";
import { initTheme } from "./lib/theme";
import { initFont } from "./lib/settings";
import { initDeviceProfile } from "./lib/device";

initDesktopMode();
initTheme();
initFont();
initDeviceProfile();
createRoot(document.getElementById("root")!).render(<App />);

// Defer non-critical boot work until after first paint.
type IdleWindow = Window & {
  requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
};

const idle = (cb: () => void) => {
  const win = window as IdleWindow;
  return typeof win.requestIdleCallback === "function"
    ? win.requestIdleCallback(() => cb(), { timeout: 2000 })
    : window.setTimeout(cb, 300);
};
idle(() => {
  // Chunk warming happens once via the offline preparation pass (OfflinePrep).
  void setupPWA();
});
