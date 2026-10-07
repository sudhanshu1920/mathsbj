import { describe, expect, it } from 'vitest';
import { generateQuestions } from '@/pages/PracticePage';

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

// Production APK build requested by user after independent operand digit selection and logo fix.
// APK build rerun after self-contained app logo repair.
// [BUILD_APK] requested build 2026-10-07 after independent digit selection + logo fix.
