import { describe, expect, it } from 'vitest';
import { generateQuestions, isValidPracticeRange } from '@/pages/PracticePage';
import {
  PERCENTAGE_PRESETS,
  normalizePercentagePresetIds,
  resolvePercentagePresets,
  togglePercentagePresetIds,
  type PercentagePresetId,
} from '@/lib/percentagePresets';

const baseConfig = {
  count: 10,
  infinite: false,
  mode: 'input' as const,
  timerMode: 'off' as const,
  timerSeconds: 9999,
  sequential: true,
  repetitionEnabled: false,
  repetitionByTopic: {},
};

const selectedThree: PercentagePresetId[] = [
  PERCENTAGE_PRESETS[0].id,
  PERCENTAGE_PRESETS[2].id,
  PERCENTAGE_PRESETS[4].id,
];

function percentageConfig(
  ids: string[],
  overrides: Partial<typeof baseConfig> = {},
) {
  return {
    ...baseConfig,
    ...overrides,
    topics: [{
      id: 'percentage',
      label: 'Percentage',
      range: {
        from: 1,
        to: 50,
        pctRangeMode: 'preset' as const,
        pctPresetIds: ids as PercentagePresetId[],
      },
    }],
  };
}

describe('Percentage preset multi-selection', () => {
  it('toggles individual IDs without losing other selections or duplicates', () => {
    const first = PERCENTAGE_PRESETS[0].id;
    const second = PERCENTAGE_PRESETS[1].id;
    const third = PERCENTAGE_PRESETS[3].id;

    expect(togglePercentagePresetIds([], first)).toEqual([first]);
    expect(togglePercentagePresetIds([first], second)).toEqual([first, second]);
    expect(togglePercentagePresetIds([first, second], first)).toEqual([second]);
    expect(normalizePercentagePresetIds([second, first, second, 'stale-id'])).toEqual([first, second]);
    expect(togglePercentagePresetIds([first, second], 'stale-id')).toEqual([first, second]);
    expect(togglePercentagePresetIds([first, second], third)).toEqual([first, second, third]);
  });

  it('resolves legacy single-range configs but explicit empty selection stays empty', () => {
    expect(resolvePercentagePresets({ from: 11, to: 20, pctRangeMode: 'preset' }).map((p) => p.id))
      .toEqual([PERCENTAGE_PRESETS[1].id]);
    expect(resolvePercentagePresets({ from: 11, to: 20, pctRangeMode: 'preset', pctPresetIds: [] }))
      .toEqual([]);
  });

  it('rejects empty/stale preset selections and ignores stale IDs beside valid choices', () => {
    expect(isValidPracticeRange('percentage', {
      from: 1, to: 50, pctRangeMode: 'preset', pctPresetIds: [],
    })).toBe(false);
    expect(isValidPracticeRange('percentage', {
      from: 1, to: 50, pctRangeMode: 'preset', pctPresetIds: ['stale-id'],
    })).toBe(false);
    expect(isValidPracticeRange('percentage', {
      from: 1, to: 50, pctRangeMode: 'preset', pctPresetIds: [PERCENTAGE_PRESETS[1].id, 'stale-id'],
    })).toBe(true);
    expect(isValidPracticeRange('percentage', {
      from: 1, to: 50, pctRangeMode: 'custom',
      pctNumFrom: 1, pctDenFrom: 2, pctNumTo: 5, pctDenTo: 2, pctPresetIds: [],
    })).toBe(true);
  });

  it('generates only selected denominator ranges with no duplicates', () => {
    const questions = generateQuestions(percentageConfig(selectedThree, { infinite: true }));
    const decimalQuestions = questions.filter((question) => question.answerType === 'decimal-pct');
    const expectedDenominators = [
      ...Array.from({ length: 10 }, (_, index) => index + 1),
      ...Array.from({ length: 10 }, (_, index) => index + 21),
      ...Array.from({ length: 10 }, (_, index) => index + 41),
    ];

    expect(decimalQuestions.map((question) => question.questionFraction?.d)).toEqual(expectedDenominators);
    expect(new Set(decimalQuestions.map((question) => question.questionFraction?.d)).size).toBe(30);
    expect(new Set(questions.map((question) => question.percentagePresetId)).size).toBe(3);
    expect(questions.some((question) => question.questionFraction?.d === 15)).toBe(false);
    expect(questions.some((question) => question.questionFraction?.d === 35)).toBe(false);
  });

  it('includes every selected preset in finite sequential and random quizzes', () => {
    for (const sequential of [true, false]) {
      const questions = generateQuestions(percentageConfig(selectedThree, {
        count: 10,
        infinite: false,
        sequential,
      }));
      expect(questions).toHaveLength(10);
      expect(new Set(questions.map((question) => question.percentagePresetId)))
        .toEqual(new Set(selectedThree));
    }
  });

  it('preserves every selected range and exact multiplicity when repetition is enabled', () => {
    const questions = generateQuestions(percentageConfig(selectedThree, {
      count: 1,
      infinite: false,
      repetitionEnabled: true,
      repetitionByTopic: { percentage: 2 },
    }));
    const decimalQuestions = questions.filter((question) => question.answerType === 'decimal-pct');
    const counts = new Map<number | undefined, number>();
    for (const question of decimalQuestions) {
      const denominator = question.questionFraction?.d;
      counts.set(denominator, (counts.get(denominator) ?? 0) + 1);
    }

    expect(counts.size).toBe(30);
    expect([...counts.values()].every((count) => count === 2)).toBe(true);
    expect(new Set(questions.map((question) => question.percentagePresetId).filter(Boolean)).size).toBe(3);
  });


  it('keeps every selected preset represented when other topics are also selected', () => {
    const questions = generateQuestions({
      ...baseConfig,
      count: 10,
      sequential: true,
      topics: [
        { id: 'squares', label: 'Squares', range: { from: 3, to: 30 } },
        {
          id: 'percentage',
          label: 'Percentage',
          range: {
            from: 1,
            to: 50,
            pctRangeMode: 'preset',
            pctPresetIds: selectedThree,
          },
        },
      ],
    });

    expect(questions).toHaveLength(10);
    expect(new Set(questions.filter((question) => question.topicId === 'percentage')
      .map((question) => question.percentagePresetId))).toEqual(new Set(selectedThree));
    expect(questions.some((question) => question.topicId === 'squares')).toBe(true);
  });

  it('keeps Custom mode separate from preset selections', () => {
    const questions = generateQuestions({
      ...baseConfig,
      count: 50,
      topics: [{
        id: 'percentage',
        label: 'Percentage',
        range: {
          from: 1,
          to: 50,
          pctRangeMode: 'custom',
          pctNumFrom: 1,
          pctDenFrom: 2,
          pctNumTo: 3,
          pctDenTo: 2,
          pctPresetIds: selectedThree,
        },
      }],
    });
    expect(questions.filter((question) => question.answerType === 'decimal-pct')
      .map((question) => question.questionFraction?.n)).toEqual([1, 2, 3]);
    expect(questions.every((question) => question.percentagePresetId === undefined)).toBe(true);
  });

  it('validates custom Percentage bounds, empties, and ascending semantics', () => {
    const customRange = (overrides: Record<string, unknown> = {}) => ({
      from: 2,
      to: 10,
      pctRangeMode: 'custom' as const,
      pctNumFrom: 1,
      pctDenFrom: 2,
      pctNumTo: 5,
      pctDenTo: 2,
      ...overrides,
    });

    expect(isValidPracticeRange('percentage', customRange())).toBe(true);
    expect(isValidPracticeRange('percentage', customRange({
      pctNumFrom: 0, pctNumTo: 200, pctDenFrom: 200, pctDenTo: 200,
    }))).toBe(true);
    expect(isValidPracticeRange('percentage', customRange({ pctNumFrom: undefined }))).toBe(false);
    expect(isValidPracticeRange('percentage', customRange({ pctNumFrom: Number.NaN }))).toBe(false);
    expect(isValidPracticeRange('percentage', customRange({ pctNumFrom: Number.POSITIVE_INFINITY }))).toBe(false);
    expect(isValidPracticeRange('percentage', customRange({ pctNumFrom: 1.5 }))).toBe(false);
    expect(isValidPracticeRange('percentage', customRange({ pctNumFrom: -1 }))).toBe(false);
    expect(isValidPracticeRange('percentage', customRange({ pctNumTo: 201 }))).toBe(false);
    expect(isValidPracticeRange('percentage', customRange({ pctDenFrom: 0 }))).toBe(false);
    expect(isValidPracticeRange('percentage', customRange({ pctDenTo: 201 }))).toBe(false);
    expect(isValidPracticeRange('percentage', customRange({ pctNumFrom: 6, pctNumTo: 2 }))).toBe(false);
    expect(isValidPracticeRange('percentage', customRange({
      pctNumFrom: 1, pctNumTo: 1, pctDenFrom: 5, pctDenTo: 2,
    }))).toBe(false);
    expect(isValidPracticeRange('percentage', customRange({
      pctNumFrom: 1, pctNumTo: 5, pctDenFrom: 2, pctDenTo: 5,
    }))).toBe(false);
  });

  it('generates all fractions for the selected custom range and ignores stale preset IDs', () => {
    const customRange = {
      from: 1,
      to: 50,
      pctRangeMode: 'custom' as const,
      pctPresetIds: selectedThree,
      pctNumFrom: 0,
      pctDenFrom: 2,
      pctNumTo: 4,
      pctDenTo: 2,
    };

    for (const sequential of [true, false]) {
      const questions = generateQuestions({
        ...baseConfig,
        count: 50,
        sequential,
        topics: [{ id: 'percentage', label: 'Percentage', range: customRange }],
      });
      const decimalQuestions = questions.filter((question) => question.answerType === 'decimal-pct');
      expect(decimalQuestions.map((question) => question.questionFraction))
        .toEqual(Array.from({ length: 5 }, (_, n) => ({ n, d: 2 })));
      expect(questions.every((question) => question.percentagePresetId === undefined)).toBe(true);
      for (const question of questions) {
        const fraction = question.questionFraction;
        if (!fraction) continue;
        expect(fraction.d).toBe(2);
        expect(fraction.n).toBeGreaterThanOrEqual(0);
        expect(fraction.n).toBeLessThanOrEqual(4);
        if (question.answerType === 'decimal-pct') {
          const percentageAnswer = Number(question.answer);
          expect(percentageAnswer).toBeCloseTo((fraction.n / fraction.d) * 100, 8);
        }
      }
    }
  });

  it('supports the current custom unit-fraction denominator range and topic isolation', () => {
    const questions = generateQuestions({
      ...baseConfig,
      count: 50,
      topics: [
        { id: 'squares', label: 'Squares', range: { from: 4, to: 5 } },
        {
          id: 'percentage',
          label: 'Percentage',
          range: {
            from: 1,
            to: 50,
            pctRangeMode: 'custom',
            pctNumFrom: 1,
            pctDenFrom: 2,
            pctNumTo: 1,
            pctDenTo: 5,
            pctPresetIds: selectedThree,
          },
        },
      ],
    });

    const percentageQuestions = questions.filter((question) => question.topicId === 'percentage');
    expect(percentageQuestions.length).toBeGreaterThan(0);
    expect(new Set(percentageQuestions.map((question) => question.questionFraction?.d))).toEqual(new Set([2, 3, 4, 5]));
    expect(percentageQuestions.every((question) => question.questionFraction?.n === 1)).toBe(true);
    expect(percentageQuestions.every((question) => question.percentagePresetId === undefined)).toBe(true);
    expect(questions.some((question) => question.topicId === 'squares')).toBe(true);
  });

  it('does not change non-Percentage topic range generation', () => {
    const questions = generateQuestions({
      ...baseConfig,
      count: 10,
      topics: [{ id: 'squares', label: 'Squares', range: { from: 3, to: 5 } }],
    });
    expect(questions.map((question) => question.text)).toEqual(['3² = ?', '4² = ?', '5² = ?']);
  });
});
