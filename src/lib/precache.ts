// Warm all lazy chunks after first paint so the service worker / HTTP cache
// holds every screen before the user ever navigates to it.
// Non-blocking, and skipped when offline or on a data-saver / slow connection.

let warmed = false;

const shouldWarm = () => {
  if (warmed) return false;
  if (typeof navigator === "undefined") return false;
  if (navigator.onLine === false) return false;
  const conn = (navigator as any).connection;
  if (conn?.saveData) return false;
  if (typeof conn?.effectiveType === "string" && /2g/.test(conn.effectiveType)) return false;
  return true;
};

export function warmLazyChunks() {
  if (!shouldWarm()) return;
  warmed = true;

  const loaders: Array<() => Promise<unknown>> = [
    () => import("@/pages/PracticePage"),
    () => import("@/pages/ProgressPage"),
    () => import("@/components/FormulasLearning"),
    () => import("@/components/TrigonometryLearning"),
    () => import("@/components/PercentageLearning"),
    () => import("@/lib/motionFeatures"),
  ];

  // Sequential so we never compete with anything the user is actually doing.
  loaders.reduce<Promise<unknown>>(
    (chain, load) => chain.then(() => load().catch(() => {})),
    Promise.resolve(),
  );
}

/** Retry warming once the device comes back online. */
export function initPrecache() {
  warmLazyChunks();
  if (typeof window === "undefined") return;
  window.addEventListener("online", () => warmLazyChunks(), { once: false });
}
