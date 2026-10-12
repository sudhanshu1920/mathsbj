import { useSyncExternalStore } from 'react';

const KEY = 'math-app-theme-v5';
const MODE_KEY = 'math-app-mode-v1';

export type ThemeId =
  | 'arctic-blue'
  | 'deep-space'
  | 'titanium-silver'
  | 'midnight-violet'
  | 'sapphire'
  | 'ocean-cyan'
  | 'emerald-glass'
  | 'aurora'
  | 'soft-rose'
  | 'sunset-gold'
  | 'graphite'
  | 'pearl-white'
  | 'indigo'
  | 'forest'
  | 'mint';

export type ModeId = 'dark' | 'light';

export interface ThemeMeta {
  id: ThemeId;
  name: string;
  tagline: string;
  swatch: [string, string, string]; // bg, primary, accent (CSS color strings)
  premium?: boolean;
}

export const THEMES: ThemeMeta[] = [
  { id: 'arctic-blue',     name: 'Arctic Blue',     tagline: 'Crisp blue + cyan',      swatch: ['#07111f', '#3b82f6', '#22d3ee'] },
  { id: 'deep-space',      name: 'Deep Space',      tagline: 'Indigo + midnight',       swatch: ['#070b16', '#6366f1', '#38bdf8'] },
  { id: 'titanium-silver', name: 'Titanium Silver', tagline: 'Silver + cool gray',      swatch: ['#11151b', '#cbd5e1', '#94a3b8'] },
  { id: 'midnight-violet', name: 'Midnight Violet', tagline: 'Violet + indigo',          swatch: ['#120d1f', '#8b5cf6', '#6366f1'] },
  { id: 'sapphire',        name: 'Sapphire',        tagline: 'Royal blue + azure',      swatch: ['#071426', '#2563eb', '#0ea5e9'] },
  { id: 'ocean-cyan',      name: 'Ocean Cyan',      tagline: 'Blue + sea glass',        swatch: ['#06151a', '#0891b2', '#14b8a6'] },
  { id: 'emerald-glass',   name: 'Emerald Glass',   tagline: 'Emerald + teal',          swatch: ['#071611', '#10b981', '#14b8a6'] },
  { id: 'aurora',          name: 'Aurora',          tagline: 'Cyan + violet',            swatch: ['#0a101c', '#22d3ee', '#8b5cf6'] },
  { id: 'soft-rose',      name: 'Soft Rose',      tagline: 'Rose + blush',              swatch: ['#1b1016', '#f472b6', '#fb7185'] },
  { id: 'sunset-gold',    name: 'Sunset Gold',    tagline: 'Gold + warm coral',         swatch: ['#1b1208', '#f59e0b', '#fb7185'] },
  { id: 'graphite',       name: 'Graphite',       tagline: 'Charcoal + steel',           swatch: ['#0e1115', '#a1a1aa', '#64748b'] },
  { id: 'pearl-white',    name: 'Pearl White',    tagline: 'Pearl + ocean blue',         swatch: ['#f6f8fb', '#2563eb', '#0f766e'] },
  { id: 'indigo',         name: 'Indigo',         tagline: 'Indigo + periwinkle',         swatch: ['#111329', '#4f46e5', '#818cf8'] },
  { id: 'forest',         name: 'Forest',         tagline: 'Pine + moss',                swatch: ['#0b1510', '#15803d', '#84cc16'] },
  { id: 'mint',           name: 'Mint',           tagline: 'Mint + eucalyptus',           swatch: ['#071713', '#0d9488', '#34d399'] },
];

export const DEFAULT_THEME: ThemeId = 'arctic-blue';
export const DEFAULT_MODE: ModeId = 'dark';

const isThemeId = (value: string | null): value is ThemeId =>
  !!value && THEMES.some((theme) => theme.id === value);

const LEGACY_THEME_MAP: Record<string, ThemeId> = {
  'professional-slate': 'arctic-blue',
  'dark-gaming': 'deep-space',
  'light-minimal': 'pearl-white',
  'midnight-blue': 'sapphire',
  'golden-premium': 'sunset-gold',
  'cyber-purple': 'midnight-violet',
  'blood-fire': 'sunset-gold',
  'matrix-green': 'forest',
  'rose-sakura': 'soft-rose',
  'arctic-ice': 'arctic-blue',
  'void-black': 'graphite',
};

const normalizeTheme = (value: string | null): ThemeId => {
  if (isThemeId(value)) return value;
  if (value && LEGACY_THEME_MAP[value]) return LEGACY_THEME_MAP[value];
  return DEFAULT_THEME;
};

const normalizeMode = (value: string | null): ModeId =>
  value === 'light' || value === 'dark' ? value : DEFAULT_MODE;

const readStoredTheme = (): ThemeId => {
  try {
    return normalizeTheme(localStorage.getItem(KEY));
  } catch {
    return DEFAULT_THEME;
  }
};

const readStoredMode = (): ModeId => {
  try {
    return normalizeMode(localStorage.getItem(MODE_KEY));
  } catch {
    return DEFAULT_MODE;
  }
};

// React snapshots are memory-backed. Reading localStorage in every
// useSyncExternalStore snapshot can block repeated renders on slower WebViews.
let currentTheme: ThemeId = readStoredTheme();
let currentMode: ModeId = readStoredMode();

const themeListeners = new Set<() => void>();
const modeListeners = new Set<() => void>();
let themeWriteRevision = 0;
let modeWriteRevision = 0;
let persistedThemeRevision = 0;
let persistedModeRevision = 0;
let transitionResetTimer: ReturnType<typeof setTimeout> | null = null;

const writeStoredPreference = (key: string, value: string): boolean => {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    // Appearance must remain usable for this session when storage is unavailable.
    return false;
  }
};

const flushPendingPreferenceWrites = () => {
  if (persistedThemeRevision !== themeWriteRevision &&
      writeStoredPreference(KEY, currentTheme)) {
    persistedThemeRevision = themeWriteRevision;
  }
  if (persistedModeRevision !== modeWriteRevision &&
      writeStoredPreference(MODE_KEY, currentMode)) {
    persistedModeRevision = modeWriteRevision;
  }
};

// Defer synchronous Web Storage writes until after the tap handler has returned.
// Revisions discard stale writes when the user changes appearance rapidly.
const persistThemeSoon = () => {
  const revision = ++themeWriteRevision;
  window.setTimeout(() => {
    if (revision !== themeWriteRevision) return;
    if (writeStoredPreference(KEY, currentTheme)) persistedThemeRevision = revision;
  }, 0);
};

const persistModeSoon = () => {
  const revision = ++modeWriteRevision;
  window.setTimeout(() => {
    if (revision !== modeWriteRevision) return;
    if (writeStoredPreference(MODE_KEY, currentMode)) persistedModeRevision = revision;
  }, 0);
};

const applyAppearanceSnapshot = (
  theme: ThemeId,
  mode: ModeId,
  suppressColorTransitions = false,
) => {
  const root = document.documentElement;
  const classes = Array.from(root.classList).filter((className) =>
    !className.startsWith('theme-') &&
    className !== 'dark' &&
    className !== 'light' &&
    className !== 'theme-appearance-updating'
  );

  // A single class-attribute update applies the theme tokens and appearance
  // together, avoiding an intermediate DOM state with both .dark and .light.
  classes.push(`theme-${theme}`, mode);
  if (suppressColorTransitions) classes.push('theme-appearance-updating');
  root.className = classes.join(' ');
  root.dataset.theme = theme;
  root.dataset.mode = mode;
  root.style.colorScheme = mode;

  if (transitionResetTimer !== null) {
    clearTimeout(transitionResetTimer);
    transitionResetTimer = null;
  }
  if (suppressColorTransitions) {
    // Skip only CSS property transitions for the switch itself. Framer Motion,
    // keyframe animations, and later hover/press transitions remain untouched.
    transitionResetTimer = window.setTimeout(() => {
      document.documentElement.classList.remove('theme-appearance-updating');
      transitionResetTimer = null;
    }, 100);
  }
};

export const getTheme = (): ThemeId => currentTheme;
export const getMode = (): ModeId => currentMode;

export const applyTheme = (id: ThemeId) => {
  applyAppearanceSnapshot(normalizeTheme(String(id)), currentMode, true);
};

export const applyMode = (mode: ModeId) => {
  applyAppearanceSnapshot(currentTheme, normalizeMode(mode), true);
};

const publishThemeUpdate = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('theme-updated', { detail: currentTheme }));
  }
};

const notify = (listeners: Set<() => void>) => {
  listeners.forEach((listener) => listener());
};

export const setTheme = (id: ThemeId) => {
  const nextTheme = normalizeTheme(String(id));
  if (nextTheme === currentTheme) return;

  currentTheme = nextTheme;
  applyAppearanceSnapshot(currentTheme, currentMode, true);
  notify(themeListeners);
  publishThemeUpdate();
  persistThemeSoon();
};

export const setMode = (mode: ModeId) => {
  const nextMode = normalizeMode(mode);
  if (nextMode === currentMode) return;

  currentMode = nextMode;
  applyAppearanceSnapshot(currentTheme, currentMode, true);
  notify(modeListeners);
  publishThemeUpdate();
  persistModeSoon();
};

export const toggleMode = () => setMode(getMode() === 'dark' ? 'light' : 'dark');

export const initTheme = () => {
  // The head bootstrap applies this same saved state before CSS can paint.
  // Keep the in-app initialization idempotent and free of startup storage writes.
  applyAppearanceSnapshot(currentTheme, currentMode);
};

export const subscribeTheme = (listener: () => void) => {
  themeListeners.add(listener);
  return () => themeListeners.delete(listener);
};

const subscribeMode = (listener: () => void) => {
  modeListeners.add(listener);
  return () => modeListeners.delete(listener);
};

const onStorage = (event: StorageEvent) => {
  if (event.key !== null && event.key !== KEY && event.key !== MODE_KEY) return;

  const previousTheme = currentTheme;
  const previousMode = currentMode;
  if (event.key === null || event.key === KEY) currentTheme = readStoredTheme();
  if (event.key === null || event.key === MODE_KEY) currentMode = readStoredMode();

  const themeChanged = previousTheme !== currentTheme;
  const modeChanged = previousMode !== currentMode;
  if (!themeChanged && !modeChanged) return;

  applyAppearanceSnapshot(currentTheme, currentMode, true);
  if (themeChanged) notify(themeListeners);
  if (modeChanged) notify(modeListeners);
  publishThemeUpdate();
};

if (typeof window !== 'undefined') {
  // One cross-tab listener is shared by all React theme/mode consumers.
  window.addEventListener('storage', onStorage);
  window.addEventListener('pagehide', flushPendingPreferenceWrites);
}

export const useTheme = () => useSyncExternalStore(subscribeTheme, getTheme, () => DEFAULT_THEME);
export const useMode = () => useSyncExternalStore(subscribeMode, getMode, () => DEFAULT_MODE);
