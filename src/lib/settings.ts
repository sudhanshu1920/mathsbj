const KEY = 'math-app-settings-v1';

export interface AppSettings {
  sound: boolean;
  vibration: boolean;
}

const defaults = (): AppSettings => ({ sound: true, vibration: true });

// In-memory cache: getSettings() runs on every sound/haptic call, so parsing
// JSON from localStorage each time is wasteful.
let cache: AppSettings | null = null;

export const getSettings = (): AppSettings => {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? { ...defaults(), ...JSON.parse(raw) } : defaults();
  } catch {
    cache = defaults();
  }
  return cache;
};

const save = (s: AppSettings) => {
  cache = s;
  localStorage.setItem(KEY, JSON.stringify(s));
  window.dispatchEvent(new CustomEvent('settings-updated'));
};

export const setSound = (v: boolean) => {
  const s = getSettings(); s.sound = v; save(s); return s;
};
export const setVibration = (v: boolean) => {
  const s = getSettings(); s.vibration = v; save(s); return s;
};

// --- Tables Pro Mode (×1..×20 instead of ×1..×10) ---
const PRO_KEY = 'tables-pro-mode';
let proCache: boolean | null = null;
export const getTablesProMode = (): boolean => {
  if (proCache !== null) return proCache;
  try { proCache = localStorage.getItem(PRO_KEY) === '1'; } catch { proCache = false; }
  return proCache;
};
export const setTablesProMode = (v: boolean) => {
  proCache = v;
  try { localStorage.setItem(PRO_KEY, v ? '1' : '0'); } catch {}
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('tables-pro-updated'));
  }
};

// --- Active time tracking (idle-aware) ---
let lastInteraction = Date.now();
const IDLE_MS = 30_000;

export const markInteraction = () => { lastInteraction = Date.now(); };
export const isActive = (): boolean =>
  document.visibilityState === 'visible' && (Date.now() - lastInteraction) < IDLE_MS;

if (typeof window !== 'undefined') {
  // Throttled: mousemove/wheel can fire hundreds of times per second.
  let lastTick = 0;
  const onActivity = () => {
    const now = Date.now();
    markInteraction();
    if (now - lastTick < 250) return;
    lastTick = now;
    document.documentElement.classList.remove('app-idle');
  };
  ['pointerdown', 'keydown', 'touchstart', 'mousemove', 'wheel'].forEach((ev) =>
    window.addEventListener(ev, onActivity, { passive: true })
  );
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') markInteraction();
  });
  // Idle dim: add class after IDLE_MS of inactivity
  setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    const idle = (Date.now() - lastInteraction) >= IDLE_MS;
    document.documentElement.classList.toggle('app-idle', idle);
  }, 5000);
}
