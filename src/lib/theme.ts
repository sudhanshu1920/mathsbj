import { useSyncExternalStore } from 'react';

const KEY = 'math-app-theme-v1';

export type ThemeId = 'glass-matte' | 'golden-prime' | 'neon-core';

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
];

export const DEFAULT_THEME: ThemeId = 'glass-matte';

const listeners = new Set<() => void>();

const isThemeId = (value: string | null): value is ThemeId =>
  !!value && THEMES.some((theme) => theme.id === value);

const normalizeTheme = (value: string | null): ThemeId => {
  if (isThemeId(value)) return value;
  if (value === 'royal-obsidian' || value === 'emerald-elite' || value === 'crimson-velocity') return DEFAULT_THEME;
  return DEFAULT_THEME;
};

export const getTheme = (): ThemeId => {
  try {
    return normalizeTheme(localStorage.getItem(KEY));
  } catch {}
  return DEFAULT_THEME;
};

export const applyTheme = (id: ThemeId) => {
  const root = document.documentElement;
  Array.from(root.classList).forEach((className) => {
    if (className.startsWith('theme-')) root.classList.remove(className);
  });
  root.classList.add('dark');
  root.classList.remove('light');
  root.classList.add(`theme-${id}`);
  root.dataset.theme = id;
  root.style.colorScheme = 'dark';
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

export const initTheme = () => {
  const theme = getTheme();
  try { localStorage.setItem(KEY, theme); } catch {}
  applyTheme(theme);
};

export const subscribeTheme = (listener: () => void) => {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY) {
      applyTheme(getTheme());
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