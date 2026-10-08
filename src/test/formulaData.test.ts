import { describe, expect, it } from 'vitest';
import { FORMULA_SECTIONS } from '@/lib/formulaData';

const flattenLatex = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.flatMap((item) => flattenLatex(item));
  if (!value || typeof value !== 'object') return [];
  const record = value as Record<string, unknown>;
  return typeof record.latex === 'string' ? [record.latex] : [];
};

describe('Formula data integrity', () => {
  it('defines every triangular-prism variable referenced by its surface-area formulas', () => {
    const all = flattenLatex(FORMULA_SECTIONS);
    expect(all).toContain('c_1 = \\text{Triangle side 1}');
    expect(all).toContain('c_2 = \\text{Triangle side 2}');
    expect(all).toContain('LSA = (a + c_1 + c_2) \\times h');
  });
});
