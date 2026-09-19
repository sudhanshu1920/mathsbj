import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { setupPWA } from "./pwa";
import { initDesktopMode } from "./components/DesktopModeToggle";
import { initTheme } from "./lib/theme";
import { initPrecache } from "./lib/precache";
import { initDeviceProfile } from "./lib/device";

initDesktopMode();
initTheme();
initDeviceProfile();
createRoot(document.getElementById("root")!).render(<App />);

// Defer non-critical boot work until after first paint.
const idle = (cb: () => void) =>
  "requestIdleCallback" in window
    ? (window as any).requestIdleCallback(cb, { timeout: 2000 })
    : setTimeout(cb, 300);
idle(() => {
  void setupPWA();
  // Warm every lazy screen so offline launches are complete.
  idle(() => initPrecache());
});
