// Low-end device detection. Adds `low-power` to <html> so CSS can drop
// expensive effects on constrained devices. Motion preference is handled separately by CSS.

let lowPower: boolean | null = null;

function detect(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const nav = navigator as Navigator & {
      deviceMemory?: number;
      connection?: { saveData?: boolean };
    };
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
