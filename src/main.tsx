import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { setupPWA } from "./pwa";
import { initDesktopMode } from "./components/DesktopModeToggle";
import { initTheme } from "./lib/theme";
import { initDeviceProfile } from "./lib/device";

initDesktopMode();
initTheme();
initDeviceProfile();
createRoot(document.getElementById("root")!).render(<App />);

// Defer non-critical boot work until after first paint.
type IdleCapableWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
};

const idle = (cb: () => void) => {
  const idleWindow = window as IdleCapableWindow;
  return idleWindow.requestIdleCallback
    ? idleWindow.requestIdleCallback(cb, { timeout: 2000 })
    : window.setTimeout(cb, 300);
};
idle(() => {
  // Chunk warming happens once via the offline preparation pass (OfflinePrep).
  void setupPWA();
});
