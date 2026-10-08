import { useSyncExternalStore } from 'react';

const KEY = 'math-app-theme-v5';
const MODE_KEY = 'math-app-mode-v1';

export type ThemeId =
  | 'professional-slate'
  | 'dark-gaming'
  | 'light-minimal'
  | 'midnight-blue'
  | 'golden-premium'
  | 'cyber-purple'
  | 'blood-fire'
  | 'matrix-green'
  | 'rose-sakura'
  | 'arctic-ice'
  | 'void-black';

export type ModeId = 'dark' | 'light';

export interface ThemeMeta {
  id: ThemeId;
  name: string;
  tagline: string;
  swatch: [string, string, string]; // bg, primary, accent (CSS color strings)
  premium?: boolean;
}

export const THEMES: ThemeMeta[] = [
  { id: 'professional-slate', name: 'Professional Slate', tagline: 'Calm blue + teal', swatch: ['#0f172a', '#2563eb', '#0f766e'] },
  { id: 'dark-gaming',    name: 'Dark Gaming',    tagline: 'Neon cyan + magenta', swatch: ['#0a0a0f', '#00d4ff', '#ff006e'] },
  { id: 'light-minimal',  name: 'Light Minimal',  tagline: 'Soft & clean',        swatch: ['#f5f5f5', '#2563eb', '#7c3aed'] },
  { id: 'midnight-blue',  name: 'Midnight Blue',  tagline: 'Indigo + cyan',       swatch: ['#0f172a', '#6366f1', '#06b6d4'] },
  { id: 'golden-premium', name: 'Golden Premium', tagline: 'Luxury gold',         swatch: ['#0d0a00', '#f5c518', '#ff9500'], premium: true },
  { id: 'cyber-purple',   name: 'Cyber Purple',   tagline: 'Neon violet + pink',  swatch: ['#0d0014', '#bf00ff', '#ff00aa'], premium: true },
  { id: 'blood-fire',     name: 'Blood Fire',     tagline: 'Crimson + inferno',   swatch: ['#0f0000', '#ff1a1a', '#ff6600'], premium: true },
  { id: 'matrix-green',   name: 'Matrix Green',   tagline: 'Hacker neon green',   swatch: ['#000a00', '#00ff41', '#00cc33'], premium: true },
  { id: 'rose-sakura',    name: 'Rose Sakura',    tagline: 'Soft pink + blush',   swatch: ['#1a0010', '#ff4fa1', '#ff9ecb'] },
  { id: 'arctic-ice',     name: 'Arctic Ice',     tagline: 'Glacier + frost',     swatch: ['#020e1a', '#00cfff', '#80ffee'] },
  { id: 'void-black',     name: 'Void Black',     tagline: 'Pure dark + white',   swatch: ['#000000', '#ffffff', '#888888'], premium: true },
];

export const DEFAULT_THEME: ThemeId = 'professional-slate';
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
  } catch {
    // Local storage may be unavailable.
  }
  return DEFAULT_THEME;
};

export const getMode = (): ModeId => {
  try {
    return normalizeMode(localStorage.getItem(MODE_KEY));
  } catch {
    // Local storage may be unavailable.
  }
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
  try { localStorage.setItem(KEY, id); } catch {
    // Storage may be unavailable; theme still applies for this session.
  }
  applyTheme(id);
  notifyListeners();
};

export const setMode = (mode: ModeId) => {
  try { localStorage.setItem(MODE_KEY, mode); } catch {
    // Storage may be unavailable; mode still applies for this session.
  }
  applyMode(mode);
  notifyListeners();
};

export const toggleMode = () => setMode(getMode() === 'dark' ? 'light' : 'dark');

export const initTheme = () => {
  const theme = getTheme();
  const mode = getMode();
  try { localStorage.setItem(KEY, theme); } catch {
    // Ignore storage failures during initialization.
  }
  try { localStorage.setItem(MODE_KEY, mode); } catch {
    // Ignore storage failures during initialization.
  }
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
    
