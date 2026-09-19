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
    setActive(true);
    prepareOffline((p) => {
      if (alive) setPct(p);
    }).finally(() => {
      if (!alive) return;
      setTimeout(() => alive && setActive(false), 700);
    });
    return () => {
      alive = false;
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
