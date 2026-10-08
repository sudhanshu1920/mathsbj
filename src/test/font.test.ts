import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FONT,
  FONT_OPTIONS,
  getFontFamily,
  normalizeFont,
  type FontId,
} from '@/lib/font';

describe('font preferences', () => {
  it('exposes four bundled premium font choices', () => {
    expect(FONT_OPTIONS.map((font) => font.id)).toEqual([
      'inter',
      'space-grotesk',
      'nunito',
      'rajdhani',
    ]);
  });

  it('normalizes invalid or missing values to the default font', () => {
    expect(normalizeFont(null)).toBe(DEFAULT_FONT);
    expect(normalizeFont('')).toBe(DEFAULT_FONT);
    expect(normalizeFont('unknown')).toBe(DEFAULT_FONT);
  });

  it('keeps every declared font mapped to a safe bundled family', () => {
    for (const font of FONT_OPTIONS) {
      expect(getFontFamily(font.id as FontId)).toContain(font.name);
      expect(getFontFamily(font.id as FontId)).not.toContain('url(');
      expect(getFontFamily(font.id as FontId)).not.toContain(';');
    }
  });
});
