import { describe, expect, it } from 'vitest';
import { Atom, Box, CalendarCheck, Grid3x3, Percent, Radical, Sigma, Square, Superscript, Triangle } from 'lucide-react';
import { TOPIC_ICON_MAP } from '@/lib/topicIcons';

describe('topic icon semantics', () => {
  it('keeps every Learning topic centrally mapped with a matching label and icon', () => {
    const expected = {
      tables: { label: 'Tables', icon: Grid3x3 },
      squares: { label: 'Squares', icon: Square },
      'square-roots': { label: 'Square Roots', icon: Radical },
      cubes: { label: 'Cubes', icon: Box },
      'cube-roots': { label: 'Cube Roots', symbol: '∛' },
      powers: { label: 'Powers', icon: Superscript },
      percentage: { label: 'Percentage', icon: Percent },
      formulas: { label: 'Formulas', icon: Sigma },
      trig: { label: 'Trigonometry', icon: Triangle },
      'addition-subtraction-digits': { label: '+/-', symbol: '±' },
      'periodic-table': { label: 'Periodic Table', icon: Atom },
      'study-tracker': { label: 'Study Tracker', icon: CalendarCheck },
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

  it('uses the exact cube-root symbol for cube roots without changing topic ids', () => {
    expect(TOPIC_ICON_MAP['cube-roots'].symbol).toBe('∛');
    expect(TOPIC_ICON_MAP['cube-roots'].icon).toBeUndefined();
    expect(TOPIC_ICON_MAP['square-roots'].icon).toBe(Radical);
    expect(TOPIC_ICON_MAP['square-roots'].symbol).toBeUndefined();
  });
});
