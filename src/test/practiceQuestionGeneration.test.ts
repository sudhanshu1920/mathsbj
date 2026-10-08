import { describe, expect, it } from 'vitest';
import { generateQuestions, isValidPracticeRange } from '@/pages/PracticePage';
import { getSquareRoots, getCubeRoots } from '@/lib/mathData';
import { isRootAnswerCorrect } from '@/lib/rootMath';

const baseConfig = {
  count: 10,
  infinite: false,
  mode: 'mcq' as const,
  timerEnabled: false,
  timerSeconds: 9999,
  sequential: true,
};

describe('PracticePage question generation', () => {
  it('keeps every selected item when repetition expands the pool', () => {
    const questions = generateQuestions({
      ...baseConfig,
      topics: [{ id: 'squares', label: 'Squares', range: { from: 1, to: 10 } }],
      repetitionEnabled: true,
      repetitionByTopic: { squares: 5 },
    });

    expect(questions).toHaveLength(50);

    const counts = new Map<string, number>();
    for (const question of questions) {
      counts.set(question.text, (counts.get(question.text) ?? 0) + 1);
    }

    expect(counts.size).toBe(10);
    expect([...counts.values()].every((count) => count === 5)).toBe(true);
  });

  it('keeps repetition isolated per topic', () => {
    const questions = generateQuestions({
      ...baseConfig,
      count: 5,
      topics: [
        { id: 'squares', label: 'Squares', range: { from: 1, to: 3 } },
        { id: 'cubes', label: 'Cubes', range: { from: 1, to: 2 } },
      ],
      repetitionEnabled: true,
      repetitionByTopic: { squares: 5, cubes: 3 },
    });

    const squareQuestions = questions.filter((question) => question.topicId === 'squares');
    const cubeQuestions = questions.filter((question) => question.topicId === 'cubes');

    expect(squareQuestions).toHaveLength(15);
    expect(cubeQuestions).toHaveLength(6);
  });

  it('supports independent digit counts for both operands, including 1–10 digits', () => {
    const combinations = [
      [1, 1], [2, 2], [2, 3], [3, 2], [4, 6], [5, 3], [10, 8],
    ] as const;

    for (const [digits1, digits2] of combinations) {
      const questions = generateQuestions({
        ...baseConfig,
        count: 50,
        topics: [{
          id: 'addition-subtraction-digits',
          label: 'Addition / Subtraction – Digit Numbers',
          range: {
            from: digits1,
            to: digits2,
            operand1DigitCount: digits1,
            operand2DigitCount: digits2,
          },
        }],
        repetitionEnabled: false,
        repetitionByTopic: {},
      });

      expect(questions).toHaveLength(50);
      expect(questions.some((question) => question.operation === '+')).toBe(true);
      expect(questions.some((question) => question.operation === '−')).toBe(true);

      for (const question of questions) {
        expect(question.operand1DigitCount).toBe(digits1);
        expect(question.operand2DigitCount).toBe(digits2);

        expect(String(question.operand1)).toHaveLength(digits1);
        expect(String(question.operand2)).toHaveLength(digits2);

        const match = question.text.match(/^(\d+) ([+−]) (\d+) = \?$/);
        expect(match).not.toBeNull();

        const left = Number(match?.[1]);
        const right = Number(match?.[3]);

        expect(typeof question.answer).toBe('number');

        if (typeof question.answer !== 'number') continue;

        if (question.operation === '+') {
          expect(left).toBe(question.operand1);
          expect(right).toBe(question.operand2);
          expect(question.answer).toBe(left + right);
        } else {
          expect(left).toBeGreaterThanOrEqual(right);
          expect(question.answer).toBe(left - right);
        }

        expect(String(question.operand1)).not.toMatch(/^0/);
        expect(String(question.operand2)).not.toMatch(/^0/);
      }
    }
  });

  it('supports selecting addition only, subtraction only, or both operations', () => {
    const makeConfig = (operations: ('addition' | 'subtraction')[]) => ({
      ...baseConfig,
      count: 40,
      topics: [{
        id: 'addition-subtraction-digits',
        label: 'Addition / Subtraction – Digit Numbers',
        range: {
          from: 2,
          to: 3,
          operand1DigitCount: 2,
          operand2DigitCount: 3,
          arithmeticOperations: operations,
        },
      }],
      repetitionEnabled: false,
      repetitionByTopic: {},
    });

    const additions = generateQuestions(makeConfig(['addition']));
    expect(additions).toHaveLength(40);
    expect(additions.every((question) => question.operation === '+')).toBe(true);

    const subtractions = generateQuestions(makeConfig(['subtraction']));
    expect(subtractions).toHaveLength(40);
    expect(subtractions.every((question) => question.operation === '−')).toBe(true);
    expect(subtractions.every((question) => typeof question.answer === 'number' && question.answer >= 0)).toBe(true);

    const both = generateQuestions(makeConfig(['addition', 'subtraction']));
    expect(both).toHaveLength(40);
    expect(both.filter((question) => question.operation === '+')).toHaveLength(20);
    expect(both.filter((question) => question.operation === '−')).toHaveLength(20);
  });



  it('rejects malformed numeric ranges before quiz start', () => {
    expect(isValidPracticeRange('squares', { from: 0, to: 10 })).toBe(false);
    expect(isValidPracticeRange('squares', { from: 1, to: Number.NaN })).toBe(false);
    expect(isValidPracticeRange('powers', { from: 1, to: 10, exponentFrom: 0, exponentTo: 5 })).toBe(false);
    expect(isValidPracticeRange('periodic-table', {
      from: 1,
      to: 118,
      periodicQuestionTypes: ['mass'],
      periodicMassMode: undefined,
    })).toBe(false);
  });

  it('accepts descending ranges because the generator intentionally supports them', () => {
    expect(isValidPracticeRange('squares', { from: 10, to: 1 })).toBe(true);
    expect(isValidPracticeRange('periodic-table', {
      from: 118,
      to: 100,
      periodicQuestionTypes: ['atomic-number'],
    })).toBe(true);
  });

  it('preserves zero as a valid custom percentage numerator', () => {
    expect(isValidPracticeRange('percentage', {
      from: 2,
      to: 10,
      pctRangeMode: 'custom',
      pctNumFrom: 0,
      pctDenFrom: 2,
      pctNumTo: 0,
      pctDenTo: 2,
    })).toBe(true);
  });

  it('bounds malformed quiz ranges instead of allocating unbounded arrays', () => {
    const questions = generateQuestions({
      ...baseConfig,
      infinite: false,
      count: 10,
      topics: [{ id: 'squares', label: 'Squares', range: { from: 1, to: Number.MAX_SAFE_INTEGER } }],
      repetitionEnabled: false,
      repetitionByTopic: {},
    });

    expect(questions).toHaveLength(10);
    expect(questions.every((question) => question.text.endsWith('² = ?'))).toBe(true);
  });
});

  it('generates square-root questions from every integer in the selected range', () => {
    const questions = generateQuestions({
      ...baseConfig,
      count: 20,
      topics: [{ id: 'roots', label: 'Square Roots', range: { from: 1, to: 20 } }],
      repetitionEnabled: false,
      repetitionByTopic: {},
    });

    expect(questions).toHaveLength(20);
    expect(questions.map((question) => question.text)).toEqual(
      Array.from({ length: 20 }, (_, index) => `√${index + 1} = ?`),
    );

    const sqrt2 = questions.find((question) => question.text === '√2 = ?');
    const sqrt4 = questions.find((question) => question.text === '√4 = ?');
    const sqrt10 = questions.find((question) => question.text === '√10 = ?');

    expect(sqrt2?.answer).toBe(1.41);
    expect(sqrt2?.validationAnswer).toBe(Math.sqrt(2));
    expect(sqrt2?.answerPrecision).toBe(2);
    expect(sqrt4?.answer).toBe(2);
    expect(sqrt4?.answerPrecision).toBe(0);
    expect(sqrt10?.answer).toBe(3.16);
  });

  it('generates cube-root questions from every integer in the selected range', () => {
    const questions = generateQuestions({
      ...baseConfig,
      count: 30,
      topics: [{ id: 'cube-roots', label: 'Cube Roots', range: { from: 1, to: 30 } }],
      repetitionEnabled: false,
      repetitionByTopic: {},
    });

    expect(questions).toHaveLength(30);
    expect(questions[0]?.text).toBe('∛1 = ?');
    expect(questions[1]?.text).toBe('∛2 = ?');
    expect(questions[7]?.text).toBe('∛8 = ?');
    expect(questions[9]?.text).toBe('∛10 = ?');
    expect(questions.find((question) => question.text === '∛2 = ?')?.answer).toBe(1.26);
    expect(questions.find((question) => question.text === '∛10 = ?')?.answer).toBe(2.15);
    expect(questions.find((question) => question.text === '∛27 = ?')?.answer).toBe(3);
  });

  it('rounds root answers to at most two decimals while keeping perfect roots as integers', () => {
    const squareRoots = getSquareRoots(1, 20);
    const cubeRoots = getCubeRoots(1, 30);

    expect(squareRoots.find((item) => item.expression === '√2')?.answer).toBe(1.41);
    expect(squareRoots.find((item) => item.expression === '√7')?.answer).toBe(2.65);
    expect(squareRoots.find((item) => item.expression === '√10')?.answer).toBe(3.16);
    expect(squareRoots.find((item) => item.expression === '√4')?.answer).toBe(2);

    expect(cubeRoots.find((item) => item.expression === '∛2')?.answer).toBe(1.26);
    expect(cubeRoots.find((item) => item.expression === '∛6')?.answer).toBe(1.82);
    expect(cubeRoots.find((item) => item.expression === '∛10')?.answer).toBe(2.15);
    expect(cubeRoots.find((item) => item.expression === '∛8')?.answer).toBe(2);
  });

  it('validates decimal root answers using the same two-decimal display precision', () => {
    expect(isRootAnswerCorrect(1.41, Math.sqrt(2), 2)).toBe(true);
    expect(isRootAnswerCorrect(1.409, Math.sqrt(2), 2)).toBe(true);
    expect(isRootAnswerCorrect(1.42, Math.sqrt(2), 2)).toBe(false);
    expect(isRootAnswerCorrect(1.30, Math.sqrt(2), 2)).toBe(false);
    expect(isRootAnswerCorrect(2, Math.sqrt(4), 0)).toBe(true);
    expect(isRootAnswerCorrect(2.004, Math.sqrt(4), 0)).toBe(false);
  });
});

// Production APK build requested by user after independent operand digit selection and logo fix.
// APK build rerun after self-contained app logo repair.
// [BUILD_APK] requested build after quiz popup fix, operation selection, and independent digit controls.
