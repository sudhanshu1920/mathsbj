// Low-end device detection. Adds `low-power` to <html> so CSS can drop
// blur/glow/shadow cost, and lets JS skip heavy effects (particles).

let lowPower: boolean | null = null;

function detect(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return true;
    const nav = navigator as any;
    if (typeof nav.deviceMemory === "number" && nav.deviceMemory <= 3) return true;
    if (typeof nav.hardwareConcurrency === "number" && nav.hardwareConcurrency <= 4) return true;
    if (nav.connection?.saveData) return true;
  } catch {
    // ignore
  }
  return false;
}

export function isLowPower(): boolean {
  if (lowPower === null) lowPower = detect();
  return lowPower;
}

export function initDeviceProfile() {
  if (typeof document === "undefined") return;
  if (isLowPower()) document.documentElement.classList.add("low-power");
}
