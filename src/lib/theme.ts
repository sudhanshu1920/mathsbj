export type ThemeId = 'neon' | 'golden' | 'purple' | 'emerald' | 'crimson';

export interface ThemeDef {
  id: ThemeId;
  name: string;
  emoji: string;
  swatch: [string, string]; // hex preview gradient
  vars: Record<string, string>;
}

// All color values are HSL components ("H S% L%") to plug into hsl(var(--x))
export const THEMES: ThemeDef[] = [
  {
    id: 'neon',
    name: 'Neon Blue',
    emoji: '⚡',
    swatch: ['#06b6d4', '#3b82f6'],
    vars: {
      '--background': '230 25% 7%',
      '--foreground': '220 20% 95%',
      '--card': '230 20% 12%',
      '--card-foreground': '220 20% 95%',
      '--popover': '230 20% 12%',
      '--popover-foreground': '220 20% 95%',
      '--primary': '188 100% 55%',
      '--primary-foreground': '0 0% 100%',
      '--secondary': '230 20% 18%',
      '--secondary-foreground': '220 20% 90%',
      '--muted': '230 15% 15%',
      '--muted-foreground': '220 10% 55%',
      '--accent': '320 100% 60%',
      '--accent-foreground': '0 0% 100%',
      '--border': '230 15% 20%',
      '--input': '230 15% 20%',
      '--ring': '188 100% 55%',
      '--success': '145 90% 50%',
      '--gradient-primary': 'linear-gradient(135deg, hsl(188 100% 55%), hsl(320 100% 60%))',
      '--gradient-card': 'linear-gradient(145deg, hsl(230 22% 14%), hsl(230 25% 9%))',
      '--glow-primary': '0 0 24px hsl(188 100% 55% / 0.45)',
      '--glow-accent': '0 0 24px hsl(320 100% 60% / 0.45)',
    },
  },
  {
    id: 'golden',
    name: 'Golden Prime',
    emoji: '👑',
    swatch: ['#f5c542', '#b8860b'],
    vars: {
      '--background': '40 15% 6%',
      '--foreground': '45 40% 95%',
      '--card': '40 15% 11%',
      '--card-foreground': '45 40% 95%',
      '--popover': '40 15% 11%',
      '--popover-foreground': '45 40% 95%',
      '--primary': '45 95% 58%',
      '--primary-foreground': '40 30% 8%',
      '--secondary': '40 12% 17%',
      '--secondary-foreground': '45 30% 88%',
      '--muted': '40 10% 14%',
      '--muted-foreground': '45 15% 60%',
      '--accent': '35 90% 55%',
      '--accent-foreground': '40 30% 8%',
      '--border': '40 12% 20%',
      '--input': '40 12% 20%',
      '--ring': '45 95% 58%',
      '--success': '150 70% 45%',
      '--gradient-primary': 'linear-gradient(135deg, hsl(45 95% 58%), hsl(35 90% 50%))',
      '--gradient-card': 'linear-gradient(145deg, hsl(40 15% 13%), hsl(40 18% 7%))',
      '--glow-primary': '0 0 24px hsl(45 95% 58% / 0.45)',
      '--glow-accent': '0 0 24px hsl(35 90% 55% / 0.45)',
    },
  },
  {
    id: 'purple',
    name: 'Royal Purple',
    emoji: '💜',
    swatch: ['#a855f7', '#6d28d9'],
    vars: {
      '--background': '270 30% 8%',
      '--foreground': '270 25% 96%',
      '--card': '270 25% 13%',
      '--card-foreground': '270 25% 96%',
      '--popover': '270 25% 13%',
      '--popover-foreground': '270 25% 96%',
      '--primary': '275 90% 65%',
      '--primary-foreground': '0 0% 100%',
      '--secondary': '270 22% 19%',
      '--secondary-foreground': '270 25% 90%',
      '--muted': '270 18% 16%',
      '--muted-foreground': '270 15% 60%',
      '--accent': '300 90% 65%',
      '--accent-foreground': '0 0% 100%',
      '--border': '270 20% 22%',
      '--input': '270 20% 22%',
      '--ring': '275 90% 65%',
      '--success': '155 80% 50%',
      '--gradient-primary': 'linear-gradient(135deg, hsl(275 90% 65%), hsl(300 90% 65%))',
      '--gradient-card': 'linear-gradient(145deg, hsl(270 25% 15%), hsl(270 30% 10%))',
      '--glow-primary': '0 0 24px hsl(275 90% 65% / 0.45)',
      '--glow-accent': '0 0 24px hsl(300 90% 65% / 0.45)',
    },
  },
  {
    id: 'emerald',
    name: 'Emerald Green',
    emoji: '💚',
    swatch: ['#10b981', '#047857'],
    vars: {
      '--background': '160 30% 6%',
      '--foreground': '150 25% 95%',
      '--card': '160 25% 11%',
      '--card-foreground': '150 25% 95%',
      '--popover': '160 25% 11%',
      '--popover-foreground': '150 25% 95%',
      '--primary': '158 85% 50%',
      '--primary-foreground': '160 40% 8%',
      '--secondary': '160 20% 17%',
      '--secondary-foreground': '150 25% 90%',
      '--muted': '160 18% 14%',
      '--muted-foreground': '150 12% 60%',
      '--accent': '180 80% 50%',
      '--accent-foreground': '160 40% 8%',
      '--border': '160 18% 20%',
      '--input': '160 18% 20%',
      '--ring': '158 85% 50%',
      '--success': '145 90% 50%',
      '--gradient-primary': 'linear-gradient(135deg, hsl(158 85% 50%), hsl(180 80% 50%))',
      '--gradient-card': 'linear-gradient(145deg, hsl(160 25% 13%), hsl(160 30% 7%))',
      '--glow-primary': '0 0 24px hsl(158 85% 50% / 0.45)',
      '--glow-accent': '0 0 24px hsl(180 80% 50% / 0.45)',
    },
  },
  {
    id: 'crimson',
    name: 'Crimson Red',
    emoji: '🔥',
    swatch: ['#ef4444', '#7f1d1d'],
    vars: {
      '--background': '0 30% 6%',
      '--foreground': '0 15% 95%',
      '--card': '0 25% 11%',
      '--card-foreground': '0 15% 95%',
      '--popover': '0 25% 11%',
      '--popover-foreground': '0 15% 95%',
      '--primary': '0 85% 58%',
      '--primary-foreground': '0 0% 100%',
      '--secondary': '0 20% 17%',
      '--secondary-foreground': '0 15% 90%',
      '--muted': '0 18% 14%',
      '--muted-foreground': '0 8% 60%',
      '--accent': '20 90% 55%',
      '--accent-foreground': '0 0% 100%',
      '--border': '0 18% 20%',
      '--input': '0 18% 20%',
      '--ring': '0 85% 58%',
      '--success': '145 80% 45%',
      '--gradient-primary': 'linear-gradient(135deg, hsl(0 85% 58%), hsl(20 90% 55%))',
      '--gradient-card': 'linear-gradient(145deg, hsl(0 25% 13%), hsl(0 30% 7%))',
      '--glow-primary': '0 0 24px hsl(0 85% 58% / 0.45)',
      '--glow-accent': '0 0 24px hsl(20 90% 55% / 0.45)',
    },
  },
];

const KEY = 'math-app-theme-v1';

export const getThemeId = (): ThemeId => {
  try {
    const v = localStorage.getItem(KEY) as ThemeId | null;
    if (v && THEMES.some((t) => t.id === v)) return v;
  } catch {}
  return 'neon';
};

export const applyTheme = (id: ThemeId) => {
  const theme = THEMES.find((t) => t.id === id) ?? THEMES[0];
  const root = document.documentElement;
  Object.entries(theme.vars).forEach(([k, v]) => root.style.setProperty(k, v));
  root.setAttribute('data-theme', theme.id);
};

export const setThemeId = (id: ThemeId) => {
  try { localStorage.setItem(KEY, id); } catch {}
  applyTheme(id);
  window.dispatchEvent(new CustomEvent('theme-updated', { detail: id }));
};

export const initTheme = () => applyTheme(getThemeId());