export type FontId = 'inter' | 'space-grotesk' | 'nunito' | 'rajdhani';

export interface FontOption {
  id: FontId;
  name: string;
  tagline: string;
  family: string;
}

export const FONT_OPTIONS: FontOption[] = [
  {
    id: 'inter',
    name: 'Inter',
    tagline: 'Clean & balanced',
    family: "'Inter', system-ui, sans-serif",
  },
  {
    id: 'space-grotesk',
    name: 'Space Grotesk',
    tagline: 'Modern & geometric',
    family: "'Space Grotesk', system-ui, sans-serif",
  },
  {
    id: 'nunito',
    name: 'Nunito',
    tagline: 'Soft & friendly',
    family: "'Nunito', system-ui, sans-serif",
  },
  {
    id: 'rajdhani',
    name: 'Rajdhani',
    tagline: 'Compact & sharp',
    family: "'Rajdhani', system-ui, sans-serif",
  },
];

export const DEFAULT_FONT: FontId = 'inter';

const isFontId = (value: string | null | undefined): value is FontId =>
  !!value && FONT_OPTIONS.some((font) => font.id === value);

export const normalizeFont = (value: string | null | undefined): FontId =>
  isFontId(value) ? value : DEFAULT_FONT;

export const getFontFamily = (id: FontId): string =>
  FONT_OPTIONS.find((font) => font.id === id)?.family ?? FONT_OPTIONS[0].family;

export const applyFont = (id: FontId) => {
  document.documentElement.dataset.font = id;
  document.documentElement.style.setProperty('--app-font', getFontFamily(id));
};
