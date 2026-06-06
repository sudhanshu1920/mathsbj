import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { setupPWA } from "./pwa";
import { initDesktopMode } from "./components/DesktopModeToggle";
import { initTheme } from "./lib/theme";

initDesktopMode();
initTheme();
createRoot(document.getElementById("root")!).render(<App />);

setupPWA();
