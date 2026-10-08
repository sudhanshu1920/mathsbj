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

const listeners = new Set<() => void>();

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
    
