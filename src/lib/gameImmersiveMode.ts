import { Capacitor, registerPlugin } from "@capacitor/core";

interface NativeImmersiveModePlugin {
  enter(): Promise<void>;
  exit(): Promise<void>;
}

const NativeImmersiveMode = registerPlugin<NativeImmersiveModePlugin>("ImmersiveMode");


/** Hide Android system bars only for the game; web preview and desktop remain unchanged. */
export async function setGameImmersiveMode(enabled: boolean): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    if (enabled) {
      await NativeImmersiveMode.enter();
    } else {
      await NativeImmersiveMode.exit();
    }
  } catch {
    // Web/older native builds remain playable if the optional immersive bridge is absent.
  }
}
