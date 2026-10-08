import { describe, expect, it } from 'vitest';
import { Atom, Box, Grid3X3, Percent, Radical, Sigma, Square, Superscript, Triangle } from 'lucide-react';
import { TOPIC_ICON_MAP } from '@/lib/topicIcons';

describe('topic icon semantics', () => {
  it('keeps every Learning topic centrally mapped with a matching label and icon', () => {
    const expected = {
      tables: { label: 'Tables', icon: Grid3X3 },
      squares: { label: 'Squares', icon: Square },
      'square-roots': { label: 'Square Roots', icon: Radical },
      cubes: { label: 'Cubes', icon: Box },
      'cube-roots': { label: 'Cube Roots', icon: Radical },
      powers: { label: 'Powers', icon: Superscript },
      percentage: { label: 'Percentage', icon: Percent },
      formulas: { label: 'Formulas', icon: Sigma },
      trig: { label: 'Trigonometry', icon: Triangle },
      'addition-subtraction-digits': { label: '+/-', symbol: '±' },
      'periodic-table': { label: 'Periodic Table', icon: Atom },
    } as const;

    for (const [topicId, expectedConfig] of Object.entries(expected)) {
      const config = TOPIC_ICON_MAP[topicId as keyof typeof TOPIC_ICON_MAP];
      expect(config).toBeDefined();
      expect(config.label).toBe(expectedConfig.label);

      if ('symbol' in expectedConfig) {
        expect(config.symbol).toBe(expectedConfig.symbol);
        expect(config.icon).toBeUndefined();
      } else {
        expect(config.icon).toBe(expectedConfig.icon);
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
