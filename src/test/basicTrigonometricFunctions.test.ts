import { describe, expect, it } from 'vitest';
import { BASIC_TRIG_FUNCTIONS, BASIC_TRIG_EXAMPLE, RECIPROCAL_TRIG_FUNCTIONS, SOH_CAH_TOA } from '@/lib/basicTrigonometricFunctions';
import { FORMULA_SECTIONS } from '@/lib/formulaData';

describe('Basic Trigonometric Functions lesson', () => {
  it('is placed under Formula → Trigonometry with the exact title', () => {
    const section = FORMULA_SECTIONS.find((item) => item.id === 'trigonometry');
    expect(section).toBeDefined();
    expect(section?.title).toBe('Trigonometry');
    expect(section?.categories[0]).toMatchObject({
      id: 'trig-basic-functions',
      title: 'Basic Trigonometric Functions',
    });
  });

  it('contains the six correct right-triangle ratios', () => {
    expect(BASIC_TRIG_FUNCTIONS.map((item) => item.symbol)).toEqual([
      'sin θ', 'cos θ', 'tan θ', 'csc θ', 'sec θ', 'cot θ',
    ]);

    expect(BASIC_TRIG_FUNCTIONS.map((item) => item.latex)).toEqual([
      '\\sin\\theta = \\dfrac{\\text{Opposite}}{\\text{Hypotenuse}}',
      '\\cos\\theta = \\dfrac{\\text{Adjacent}}{\\text{Hypotenuse}}',
      '\\tan\\theta = \\dfrac{\\text{Opposite}}{\\text{Adjacent}}',
      '\\csc\\theta = \\dfrac{\\text{Hypotenuse}}{\\text{Opposite}}',
      '\\sec\\theta = \\dfrac{\\text{Hypotenuse}}{\\text{Adjacent}}',
      '\\cot\\theta = \\dfrac{\\text{Adjacent}}{\\text{Opposite}}',
    ]);
  });

  it('contains SOH, CAH and TOA plus reciprocal identities', () => {
    expect(SOH_CAH_TOA).toEqual([
      { key: 'SOH', function: 'sin' },
      { key: 'CAH', function: 'cos' },
      { key: 'TOA', function: 'tan' },
    ]);
    expect(RECIPROCAL_TRIG_FUNCTIONS.map((item) => item.latex)).toEqual([
      '\\csc\\theta = \\dfrac{1}{\\sin\\theta}',
      '\\sec\\theta = \\dfrac{1}{\\cos\\theta}',
      '\\cot\\theta = \\dfrac{1}{\\tan\\theta}',
    ]);
  });

  it('contains the requested 3-4-5 example', () => {
    expect(BASIC_TRIG_EXAMPLE.map((item) => item.latex)).toEqual([
      '\\sin\\theta = \\dfrac{3}{5}',
      '\\cos\\theta = \\dfrac{4}{5}',
      '\\tan\\theta = \\dfrac{3}{4}',
      '\\csc\\theta = \\dfrac{5}{3}',
      '\\sec\\theta = \\dfrac{5}{4}',
      '\\cot\\theta = \\dfrac{4}{3}',
    ]);
  });
});
