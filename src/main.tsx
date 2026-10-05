import { createRoot } from "react-dom/client";
import "./index.css";
import { setupPWA } from "./pwa";
import { initDesktopMode } from "./components/DesktopModeToggle";
import { initTheme } from "./lib/theme";
import { initDeviceProfile } from "./lib/device";

type BootError = Error & { cause?: unknown };

function formatBootError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack || error.message || "Unknown startup error";
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function showBootFailure(root: HTMLElement, error: unknown) {
  root.innerHTML = "";
  const panel = document.createElement("div");
  panel.style.cssText =
    "min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box;background:#0d1117;color:#f8fafc;font-family:system-ui,-apple-system,sans-serif;";
  const card = document.createElement("div");
  card.style.cssText =
    "width:min(100%,560px);padding:24px;border:1px solid #334155;border-radius:18px;background:#111827;box-shadow:0 12px 40px rgba(0,0,0,.35);";
  const title = document.createElement("h1");
  title.textContent = "Math SBJ could not start";
  title.style.cssText = "margin:0 0 10px;font-size:22px;";
  const message = document.createElement("p");
  message.textContent = "A startup error occurred. Please restart the app after installing the latest build.";
  message.style.cssText = "margin:0 0 14px;line-height:1.5;color:#cbd5e1;";
  const details = document.createElement("pre");
  details.textContent = formatBootError(error);
  details.style.cssText =
    "margin:0;max-height:320px;overflow:auto;white-space:pre-wrap;word-break:break-word;padding:12px;border-radius:12px;background:#020617;color:#fca5a5;font-size:12px;line-height:1.45;";
  card.append(title, message, details);
  panel.appendChild(card);
  root.appendChild(panel);
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Math SBJ root element was not found");
}

const root = createRoot(rootElement);

window.addEventListener("error", (event) => {
  const target = document.getElementById("root");
  if (!target || target.childElementCount === 0) {
    showBootFailure(target || document.body, event.error || event.message);
  }
});

window.addEventListener("unhandledrejection", (event) => {
  const target = document.getElementById("root");
  if (!target || target.childElementCount === 0) {
    showBootFailure(target || document.body, event.reason);
  }
});

try {
  initDesktopMode();
  initTheme();
  initDeviceProfile();
} catch (error) {
  showBootFailure(rootElement, error);
  throw error;
}

import("./App.tsx")
  .then(({ default: App }) => {
    root.render(<App />);
  })
  .catch((error: BootError) => {
    showBootFailure(rootElement, error);
  });

// Defer non-critical boot work until after first paint.
const idle = (cb: () => void) =>
  "requestIdleCallback" in window
    ? (window as any).requestIdleCallback(cb, { timeout: 2000 })
    : setTimeout(cb, 300);

idle(() => {
  void setupPWA();
});
