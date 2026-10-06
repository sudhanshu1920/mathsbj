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
      count: 10,
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
    expect(cubeQuestions).toHaveLength(15);
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
