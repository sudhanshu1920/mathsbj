import { describe, expect, it } from 'vitest';
import { TOPIC_ICON_MAP } from '@/lib/topicIcons';

describe('topic icon semantics', () => {
  it('keeps every Learning topic centrally mapped with a matching label', () => {
    const expected = {
      tables: ['Tables', 'Grid3x3'],
      squares: ['Squares', 'Square'],
      'square-roots': ['Square Roots', 'Radical'],
      cubes: ['Cubes', 'Box'],
      'cube-roots': ['Cube Roots', 'Radical'],
      powers: ['Powers', 'Superscript'],
      percentage: ['Percentage', 'Percent'],
      formulas: ['Formulas', 'Sigma'],
      trig: ['Trigonometry', 'Triangle'],
      'addition-subtraction-digits': ['+/-', '±'],
      'periodic-table': ['Periodic Table', 'Atom'],
    } as const;

    for (const [topicId, [label, iconName]] of Object.entries(expected)) {
      const config = TOPIC_ICON_MAP[topicId as keyof typeof TOPIC_ICON_MAP];
      expect(config).toBeDefined();
      expect(config.label).toBe(label);

      if (iconName === '±') {
        expect(config.symbol).toBe('±');
        expect(config.icon).toBeUndefined();
      } else {
        expect(config.icon).toBeDefined();
        const renderedName = config.icon?.displayName || config.icon?.name || config.icon?.toString();
        expect(renderedName).toContain(iconName);
      }
    }
  });

  it('reuses one semantic definition for the legacy roots quiz key', () => {
    expect(TOPIC_ICON_MAP.roots).toBe(TOPIC_ICON_MAP['square-roots']);
    expect(TOPIC_ICON_MAP.roots.label).toBe('Square Roots');
  });

  it('distinguishes cube roots from square roots without changing topic ids', () => {
    expect(TOPIC_ICON_MAP['cube-roots'].icon).toBe(TOPIC_ICON_MAP['square-roots'].icon);
    expect(TOPIC_ICON_MAP['cube-roots'].badge).toBe('3');
    expect(TOPIC_ICON_MAP['square-roots'].badge).toBeUndefined();
  });
});
