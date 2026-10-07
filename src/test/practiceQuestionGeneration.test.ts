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

  it('generates the Addition / Subtraction – Digit Numbers topic with exact operand digit counts', () => {
    for (const digits of [2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      const questions = generateQuestions({
        ...baseConfig,
        count: 50,
        topics: [{
          id: 'addition-subtraction-digits',
          label: 'Addition / Subtraction – Digit Numbers',
          range: { from: digits, to: digits, digitCount: digits },
        }],
        repetitionEnabled: false,
        repetitionByTopic: {},
      });

      expect(questions).toHaveLength(50);
      expect(questions.some((question) => question.text.includes(' + '))).toBe(true);
      expect(questions.some((question) => question.text.includes(' − '))).toBe(true);

      for (const question of questions) {
        const match = question.text.match(/^(\d+) ([+−]) (\d+) = \?$/);
        expect(match).not.toBeNull();
        expect(match?.[1]).toHaveLength(digits);
        expect(match?.[3]).toHaveLength(digits);
        expect(question.answer).toEqual(
          match?.[2] === '+'
            ? Number(match?.[1]) + Number(match?.[3])
            : Number(match?.[1]) - Number(match?.[3]),
        );

        if (match?.[2] === '−') {
          expect(Number(match[1])).toBeGreaterThanOrEqual(Number(match[3]));
          expect(question.answer).toBeGreaterThanOrEqual(0);
        }
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

// Production APK build requested by user after adding the digit-number arithmetic quiz topic.
