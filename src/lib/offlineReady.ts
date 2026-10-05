// One-time "prepare offline mode" pass: warms every lazy chunk and data module
// so later launches never touch the network. Progress is reported 0-100.

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

/** Load every chunk once, reporting progress. Resolves even if some fail. */
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

  // Give the service worker a moment to finish its own precache.
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
  onProgress?.(100);

  if (!failed) markOfflineReady();
  return !failed;
}
