import { Capacitor } from "@capacitor/core";

// One-time preparation pass. In native builds, assets are already bundled by
// Capacitor, so only the lazy chunks/data are warmed; there is no SW wait.

const FLAG = "offline-ready-v1";

export function isOfflineReady(): boolean {
  try {
    return localStorage.getItem(FLAG) === "1";
  } catch {
    return false;
  }
}

export function markOfflineReady() {
  try {
    localStorage.setItem(FLAG, "1");
  } catch {
    // ignore
  }
}

const loaders: Array<() => Promise<unknown>> = [
  () => import("@/lib/motionFeatures"),
  () => import("@/pages/PracticePage"),
  () => import("@/pages/ProgressPage"),
  () => import("@/components/FormulasLearning"),
  () => import("@/components/TrigonometryLearning"),
  () => import("@/components/PercentageLearning"),
  () => import("@/components/PeriodicTableLearning"),
  () => import("@/lib/formulaData"),
  () => import("@/lib/trigData"),
  () => import("@/lib/mathData"),
  () => import("@/lib/periodicTable"),
];

export async function prepareOffline(onProgress?: (pct: number) => void): Promise<boolean> {
  let done = 0;
  let failed = false;

  for (const load of loaders) {
    try {
      await load();
    } catch {
      failed = true;
    }
    done += 1;
    onProgress?.(Math.round((done / (loaders.length + 1)) * 100));
  }

  if (!Capacitor.isNativePlatform()) {
    try {
      if ("serviceWorker" in navigator) {
        await Promise.race([
          navigator.serviceWorker.ready,
          new Promise((r) => setTimeout(r, 4000)),
        ]);
      }
    } catch {
      // ignore
    }
  }

  onProgress?.(100);

  if (!failed) markOfflineReady();
  return !failed;
}
