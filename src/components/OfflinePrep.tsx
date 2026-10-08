import { useEffect, useState } from "react";
import { isOfflineReady, prepareOffline } from "@/lib/offlineReady";

/**
 * Minimal, non-blocking one-time indicator shown on the first online launch
 * while the app caches everything it needs for offline use.
 */
const OfflinePrep = () => {
  const [pct, setPct] = useState(0);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (isOfflineReady()) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;
    let alive = true;
    let cancelIdle: (() => void) | undefined;

    const startPreparation = () => {
      if (!alive) return;
      setActive(true);
      void prepareOffline((p) => {
      if (alive) setPct(p);
      }).finally(() => {
        if (!alive) return;
        setTimeout(() => alive && setActive(false), 700);
      });
    };

    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(startPreparation, { timeout: 2500 });
      cancelIdle = () => window.cancelIdleCallback(id);
    } else {
      const id = globalThis.setTimeout(startPreparation, 1200);
      cancelIdle = () => globalThis.clearTimeout(id);
    }

    return () => {
      alive = false;
      cancelIdle?.();
    };
  }, []);

  if (!active) return null;

  return (
    <div className="pointer-events-none fixed bottom-24 left-1/2 z-[60] w-[240px] -translate-x-1/2 rounded-xl border border-border bg-card/95 px-3 py-2 shadow-lg">
      <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
        <span>Preparing offline mode</span>
        <span className="tabular-nums text-foreground">{pct}%</span>
      </div>
      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

export default OfflinePrep;
