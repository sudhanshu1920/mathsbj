const KEY = 'math-app-theme-v1';

export type ThemeId = 'neon-core' | 'golden-prime' | 'royal-obsidian' | 'emerald-elite' | 'crimson-velocity';

export interface ThemeMeta {
  id: ThemeId;
  name: string;
  tagline: string;
  swatch: [string, string, string]; // bg, primary, accent (CSS color strings)
}

export const THEMES: ThemeMeta[] = [
  { id: 'neon-core',        name: 'Neon Core',        tagline: 'Electric cyber dashboard', swatch: ['hsl(230 25% 7%)',  'hsl(188 100% 55%)', 'hsl(320 100% 60%)'] },
  { id: 'golden-prime',     name: 'Golden Prime',     tagline: 'Matte black & gold',       swatch: ['hsl(40 8% 6%)',    'hsl(43 90% 58%)',   'hsl(35 80% 50%)']   },
  { id: 'royal-obsidian',   name: 'Royal Obsidian',   tagline: 'Graphite & royal violet',  swatch: ['hsl(260 10% 8%)',  'hsl(270 90% 65%)',  'hsl(290 85% 60%)']  },
  { id: 'emerald-elite',    name: 'Emerald Elite',    tagline: 'Charcoal & emerald',       swatch: ['hsl(170 12% 7%)',  'hsl(155 85% 50%)',  'hsl(175 75% 50%)']  },
  { id: 'crimson-velocity', name: 'Crimson Velocity', tagline: 'Black & crimson power',    swatch: ['hsl(0 15% 6%)',    'hsl(0 90% 58%)',    'hsl(15 90% 55%)']   },
];

export const DEFAULT_THEME: ThemeId = 'neon-core';

export const getTheme = (): ThemeId => {
  try {
    const v = localStorage.getItem(KEY) as ThemeId | null;
    if (v && THEMES.find((t) => t.id === v)) return v;
  } catch {}
  return DEFAULT_THEME;
};

export const applyTheme = (id: ThemeId) => {
  const root = document.documentElement;
  THEMES.forEach((t) => root.classList.remove(`theme-${t.id}`));
  root.classList.add(`theme-${id}`);
};

export const setTheme = (id: ThemeId) => {
  try { localStorage.setItem(KEY, id); } catch {}
  applyTheme(id);
  window.dispatchEvent(new CustomEvent('theme-updated', { detail: id }));
};

export const initTheme = () => {
  applyTheme(getTheme());
};