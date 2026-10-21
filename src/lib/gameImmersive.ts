import { Capacitor, registerPlugin } from "@capacitor/core";

interface GameImmersivePlugin {
  enter(): Promise<void>;
  exit(): Promise<void>;
}

const GameImmersive = registerPlugin<GameImmersivePlugin>("GameImmersive");

export async function enterGameImmersiveMode(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await GameImmersive.enter();
  } catch {
    // Full-screen mode is an enhancement; gameplay remains usable if unsupported.
  }
}

export async function exitGameImmersiveMode(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      await GameImmersive.exit();
    } catch {
      // Continue restoring browser state even if the native bridge is unavailable.
    }
  }

  if (typeof document !== "undefined" && document.fullscreenElement && document.exitFullscreen) {
    try {
      await document.exitFullscreen();
    } catch {
      // The browser may already have exited full-screen through system navigation.
    }
  }
}

export function requestBrowserFullscreenFromGesture(): void {
  if (
    Capacitor.isNativePlatform() ||
    typeof document === "undefined" ||
    document.fullscreenElement ||
    typeof document.documentElement.requestFullscreen !== "function"
  ) return;

  try {
    const result = document.documentElement.requestFullscreen();
    void result?.catch(() => {
      // Browser settings, iOS support, or user preferences may reject this request.
    });
  } catch {
    // Full-screen is optional in browsers where it is not supported.
  }
}
