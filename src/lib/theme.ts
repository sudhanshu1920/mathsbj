import { useSyncExternalStore } from 'react';

const KEY = 'math-app-theme-v1';
const MODE_KEY = 'math-app-mode-v1';

export type ThemeId =
  | 'glass-matte'
  | 'golden-prime'
  | 'neon-core'
  | 'royal-obsidian'
  | 'emerald-elite'
  | 'crimson-velocity';

export type ModeId = 'dark' | 'light';

export interface ThemeMeta {
  id: ThemeId;
  name: string;
  tagline: string;
  swatch: [string, string, string]; // bg, primary, accent (CSS color strings)
}

export const THEMES: ThemeMeta[] = [
  { id: 'glass-matte',  name: 'Glass Matte',  tagline: 'Premium blurred glass UI', swatch: ['hsl(226 49% 8%)', 'hsl(213 94% 68%)', 'hsl(188 84% 62%)'] },
  { id: 'golden-prime', name: 'Golden Prime', tagline: 'Ultra luxury gold dashboard', swatch: ['hsl(0 0% 4%)', 'hsl(46 65% 52%)', 'hsl(51 100% 50%)'] },
  { id: 'neon-core',    name: 'Neon Core',    tagline: 'Futuristic cyan gaming UI', swatch: ['hsl(229 63% 5%)', 'hsl(186 100% 50%)', 'hsl(188 100% 42%)'] },
  { id: 'royal-obsidian',   name: 'Royal Obsidian',   tagline: 'Deep violet luxury suite',  swatch: ['hsl(260 40% 6%)', 'hsl(270 90% 70%)', 'hsl(290 90% 65%)'] },
  { id: 'emerald-elite',    name: 'Emerald Elite',    tagline: 'Fresh emerald premium UI',   swatch: ['hsl(160 40% 6%)', 'hsl(152 80% 50%)', 'hsl(170 85% 55%)'] },
  { id: 'crimson-velocity', name: 'Crimson Velocity', tagline: 'Racing red high-energy UI',  swatch: ['hsl(0 30% 6%)',   'hsl(0 90% 60%)',   'hsl(20 95% 58%)'] },
];

export const DEFAULT_THEME: ThemeId = 'glass-matte';
export const DEFAULT_MODE: ModeId = 'dark';

const listeners = new Set<() => void>();

const isThemeId = (value: string | null): value is ThemeId =>
  !!value && THEMES.some((theme) => theme.id === value);

const normalizeTheme = (value: string | null): ThemeId => {
  if (isThemeId(value)) return value;
  return DEFAULT_THEME;
};

const normalizeMode = (value: string | null): ModeId =>
  value === 'light' || value === 'dark' ? value : DEFAULT_MODE;

export const getTheme = (): ThemeId => {
  try {
    return normalizeTheme(localStorage.getItem(KEY));
  } catch {}
  return DEFAULT_THEME;
};

export const getMode = (): ModeId => {
  try {
    return normalizeMode(localStorage.getItem(MODE_KEY));
  } catch {}
  return DEFAULT_MODE;
};

export const applyTheme = (id: ThemeId) => {
  const root = document.documentElement;
  Array.from(root.classList).forEach((className) => {
    if (className.startsWith('theme-')) root.classList.remove(className);
  });
  root.classList.add(`theme-${id}`);
  root.dataset.theme = id;
};

export const applyMode = (mode: ModeId) => {
  const root = document.documentElement;
  if (mode === 'light') {
    root.classList.add('light');
    root.classList.remove('dark');
    root.style.colorScheme = 'light';
  } else {
    root.classList.add('dark');
    root.classList.remove('light');
    root.style.colorScheme = 'dark';
  }
  root.dataset.mode = mode;
};

const notifyListeners = () => {
  listeners.forEach((listener) => listener());
  window.dispatchEvent(new CustomEvent('theme-updated', { detail: getTheme() }));
};

export const setTheme = (id: ThemeId) => {
  try { localStorage.setItem(KEY, id); } catch {}
  applyTheme(id);
  notifyListeners();
};

export const setMode = (mode: ModeId) => {
  try { localStorage.setItem(MODE_KEY, mode); } catch {}
  applyMode(mode);
  notifyListeners();
};

export const toggleMode = () => setMode(getMode() === 'dark' ? 'light' : 'dark');

export const initTheme = () => {
  const theme = getTheme();
  const mode = getMode();
  try { localStorage.setItem(KEY, theme); } catch {}
  try { localStorage.setItem(MODE_KEY, mode); } catch {}
  applyTheme(theme);
  applyMode(mode);
};

export const subscribeTheme = (listener: () => void) => {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY || event.key === MODE_KEY) {
      applyTheme(getTheme());
      applyMode(getMode());
      listener();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
};

export const useTheme = () => useSyncExternalStore(subscribeTheme, getTheme, () => DEFAULT_THEME);
export const useMode = () => useSyncExternalStore(subscribeTheme, getMode, () => DEFAULT_MODE);