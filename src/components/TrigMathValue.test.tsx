import { describe, expect, it } from 'vitest';
import { trigValueToLatex } from '@/components/TrigMathValue';

describe('exact trigonometric value rendering', () => {
  it('uses real KaTeX fraction syntax with radicals in the correct numerator/denominator', () => {
    expect(trigValueToLatex('√3/2')).toBe('\\frac{\\sqrt{3}}{2}');
    expect(trigValueToLatex('1/√2')).toBe('\\frac{1}{\\sqrt{2}}');
    expect(trigValueToLatex('2/√3')).toBe('\\frac{2}{\\sqrt{3}}');
    expect(trigValueToLatex('-√3/2')).toBe('-\\frac{\\sqrt{3}}{2}');
    expect(trigValueToLatex('-1/√2')).toBe('-\\frac{1}{\\sqrt{2}}');
  });

  it('renders radians and standalone radicals as mathematics', () => {
    expect(trigValueToLatex('π/6')).toBe('\\frac{\\pi}{6}');
    expect(trigValueToLatex('11π/6')).toBe('\\frac{11\\pi}{6}');
    expect(trigValueToLatex('2π')).toBe('2\\pi');
    expect(trigValueToLatex('√3')).toBe('\\sqrt{3}');
    expect(trigValueToLatex('-√2')).toBe('-\\sqrt{2}');
  });
});
