const KEY = 'math-app-settings-v1';

export interface AppSettings {
  sound: boolean;
  vibration: boolean;
}

const defaults = (): AppSettings => ({ sound: true, vibration: true });

export const getSettings = (): AppSettings => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    return { ...defaults(), ...JSON.parse(raw) };
  } catch {
    return defaults();
  }
};

const save = (s: AppSettings) => {
  localStorage.setItem(KEY, JSON.stringify(s));
  window.dispatchEvent(new CustomEvent('settings-updated'));
};

export const setSound = (v: boolean) => {
  const s = getSettings(); s.sound = v; save(s); return s;
};
export const setVibration = (v: boolean) => {
  const s = getSettings(); s.vibration = v; save(s); return s;
};

// --- Active time tracking (idle-aware) ---
let lastInteraction = Date.now();
const IDLE_MS = 30_000;

export const markInteraction = () => { lastInteraction = Date.now(); };
export const isActive = (): boolean =>
  document.visibilityState === 'visible' && (Date.now() - lastInteraction) < IDLE_MS;

if (typeof window !== 'undefined') {
  ['pointerdown', 'keydown', 'touchstart', 'mousemove', 'wheel'].forEach((ev) =>
    window.addEventListener(ev, () => {
      markInteraction();
      document.documentElement.classList.remove('app-idle');
    }, { passive: true })
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
