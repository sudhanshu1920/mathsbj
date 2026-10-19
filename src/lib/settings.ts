import { applyFont, DEFAULT_FONT, normalizeFont, type FontId } from '@/lib/font';

export type HomeWidgetContent = 'appIdentity' | 'target' | 'progress' | 'remaining' | 'studyTime' | 'streak' | 'weekly' | 'updateStatus';
export type HomeWidgetStyle = 'glass' | 'compact' | 'minimal';
export type HomeWidgetTheme = 'app' | 'violet';
export type HomeWidgetComposition =
  | 'auto'
  | 'hero_wide'
  | 'compact_green'
  | 'square_math_bot'
  | 'medium_study'
  | 'square_cosmic'
  | 'extra_wide_weekly'
  | 'minimal_progress';

export const HOME_WIDGET_COMPOSITIONS: Array<{ id: HomeWidgetComposition; label: string }> = [
  { id: 'auto', label: 'Auto Responsive' },
  { id: 'hero_wide', label: 'Hero Wide · Sunset' },
  { id: 'compact_green', label: 'Compact Green' },
  { id: 'square_math_bot', label: 'Square Math Bot' },
  { id: 'medium_study', label: 'Medium Study' },
  { id: 'square_cosmic', label: 'Square Cosmic' },
  { id: 'extra_wide_weekly', label: 'Extra-Wide Weekly' },
  { id: 'minimal_progress', label: 'Minimal Progress' },
];

const HOME_WIDGET_CONTENT: HomeWidgetContent[] = ['appIdentity', 'target', 'progress', 'remaining', 'studyTime', 'streak', 'weekly', 'updateStatus'];
const normalizeWidgetContent = (value: unknown): HomeWidgetContent[] => {
  if (!Array.isArray(value)) return [...HOME_WIDGET_CONTENT];
  const valid = [...new Set(value.filter((item): item is HomeWidgetContent =>
    typeof item === 'string' && HOME_WIDGET_CONTENT.includes(item as HomeWidgetContent)))];
  return valid.length > 0 ? valid : [...HOME_WIDGET_CONTENT];
};

const KEY = 'math-app-settings-v1';
const HOME_WIDGET_CONTENT_SCHEMA_KEY = 'math-app-home-widget-content-schema-v2';

export interface AppSettings {
  sound: boolean;
  vibration: boolean;
  keyboardShortcuts: boolean;
  homeScreenWidgetsEnabled: boolean;
  homeWidgetContent: HomeWidgetContent[];
  homeWidgetStyle: HomeWidgetStyle;
  homeWidgetTheme: HomeWidgetTheme;
  homeWidgetComposition: HomeWidgetComposition;
  font: FontId;
}

const defaults = (): AppSettings => ({
  sound: true,
  vibration: true,
  keyboardShortcuts: true,
  // Keep existing pinned widgets enabled after upgrading from a version without this setting.
  homeScreenWidgetsEnabled: true,
  homeWidgetContent: [...HOME_WIDGET_CONTENT],
  homeWidgetStyle: 'glass',
  homeWidgetTheme: 'app',
  homeWidgetComposition: 'auto',
  font: DEFAULT_FONT,
});

// In-memory cache: getSettings() runs on every sound/haptic call, so parsing
// JSON from localStorage each time is wasteful.
let cache: AppSettings | null = null;

const normalizeBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

export const getSettings = (): AppSettings => {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    const value = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
    const base = defaults();
    const contentSchemaNeedsMigration = localStorage.getItem(HOME_WIDGET_CONTENT_SCHEMA_KEY) !== '2';
    let widgetContent = normalizeWidgetContent(value.homeWidgetContent);
    // The weekly field did not exist in prior builds. Add it once during upgrade,
    // while respecting explicit selections made after this schema version.
    if (contentSchemaNeedsMigration && Array.isArray(value.homeWidgetContent) && !widgetContent.includes('weekly')) {
      widgetContent = [...widgetContent, 'weekly'];
    }
    cache = {
      sound: normalizeBoolean(value.sound, base.sound),
      vibration: normalizeBoolean(value.vibration, base.vibration),
      keyboardShortcuts: normalizeBoolean(value.keyboardShortcuts, base.keyboardShortcuts),
      homeScreenWidgetsEnabled: normalizeBoolean(value.homeScreenWidgetsEnabled, base.homeScreenWidgetsEnabled),
      homeWidgetContent: widgetContent,
      homeWidgetStyle: value.homeWidgetStyle === 'compact' || value.homeWidgetStyle === 'minimal' ? value.homeWidgetStyle : base.homeWidgetStyle,
      homeWidgetTheme: value.homeWidgetTheme === 'violet' ? 'violet' : base.homeWidgetTheme,
      homeWidgetComposition: HOME_WIDGET_COMPOSITIONS.some((item) => item.id === value.homeWidgetComposition)
        ? value.homeWidgetComposition as HomeWidgetComposition : base.homeWidgetComposition,
      font: normalizeFont(typeof value.font === 'string' ? value.font : base.font),
    };
    if (contentSchemaNeedsMigration) {
      try {
        localStorage.setItem(KEY, JSON.stringify(cache));
        localStorage.setItem(HOME_WIDGET_CONTENT_SCHEMA_KEY, '2');
      } catch {
        // Keep the loaded settings in memory if persistent storage is temporarily unavailable.
        // A later successful launch can retry the one-time migration.
      }
    }
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
export const setKeyboardShortcuts = (v: boolean) => {
  const s = { ...getSettings(), keyboardShortcuts: v };
  save(s);
  return s;
};

export const setHomeScreenWidgetsEnabled = (enabled: boolean) => {
  const s = { ...getSettings(), homeScreenWidgetsEnabled: enabled };
  save(s);
  return s;
};

export const setHomeWidgetContent = (content: HomeWidgetContent[]) => {
  const normalized = normalizeWidgetContent(content);
  if (normalized.length === 0) return getSettings();
  const s = { ...getSettings(), homeWidgetContent: normalized };
  save(s);
  return s;
};

export const setHomeWidgetStyle = (style: HomeWidgetStyle) => {
  const s = { ...getSettings(), homeWidgetStyle: style };
  save(s);
  return s;
};

export const setHomeWidgetTheme = (theme: HomeWidgetTheme) => {
  const s = { ...getSettings(), homeWidgetTheme: theme };
  save(s);
  return s;
};

export const setHomeWidgetComposition = (composition: HomeWidgetComposition) => {
  const s = { ...getSettings(), homeWidgetComposition: composition };
  save(s);
  return s;
};

export const setFont = (font: FontId) => {
  const next = normalizeFont(font);
  const s = { ...getSettings(), font: next };
  save(s);
  applyFont(next);
  return s;
};

export const initFont = () => {
  applyFont(getSettings().font);
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
  try { localStorage.setItem(PRO_KEY, v ? '1' : '0'); } catch {
    // Storage can be unavailable in restricted browser contexts.
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('tables-pro-updated'));
  }
};

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === KEY) cache = null;
    if (event.key === PRO_KEY) proCache = null;
  });
}

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
