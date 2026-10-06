import {
  expandQuizQuestionPool,
  MAX_QUIZ_REPETITION,
  normalizeQuizRepetition,
} from './quizRepetition';

interface TestQuestion {
  topic: string;
  item: number;
  repetition?: number;
}

describe('quiz repetition', () => {
  it('normalizes invalid and extreme repetition values safely', () => {
    expect(normalizeQuizRepetition(undefined)).toBe(1);
    expect(normalizeQuizRepetition(Number.NaN)).toBe(1);
    expect(normalizeQuizRepetition(0)).toBe(1);
    expect(normalizeQuizRepetition(-5)).toBe(1);
    expect(normalizeQuizRepetition(2.9)).toBe(2);
    expect(normalizeQuizRepetition(999999)).toBe(MAX_QUIZ_REPETITION);
  });

  it('repeats each item consecutively in sequential order', () => {
    const source: TestQuestion[] = [
      { topic: 'Square', item: 1, repetition: 5 },
      { topic: 'Square', item: 2, repetition: 5 },
      { topic: 'Square', item: 3, repetition: 5 },
    ];

    const result = expandQuizQuestionPool(source, (question) => question.repetition, true);

    expect(result).toHaveLength(15);
    expect(result.map((question) => question.item)).toEqual([
      1, 1, 1, 1, 1,
      2, 2, 2, 2, 2,
      3, 3, 3, 3, 3,
    ]);
  });

  it('preserves the exact repetition count while randomizing the expanded pool', () => {
    const source: TestQuestion[] = Array.from({ length: 20 }, (_, index) => ({
      topic: 'Square',
      item: index + 1,
      repetition: 5,
    }));

    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const result = expandQuizQuestionPool(source, (question) => question.repetition, false);

    expect(result).toHaveLength(100);

    const counts = new Map<number, number>();
    for (const question of result) {
      counts.set(question.item, (counts.get(question.item) || 0) + 1);
    }

    expect(Array.from(counts.values())).toEqual(Array(20).fill(5));
    expect(result.slice(0, 10).map((question) => question.item)).not.toEqual([
      1, 1, 1, 1, 1, 2, 2, 2, 2, 2,
    ]);

    vi.restoreAllMocks();
  });

  it('keeps different repetition values isolated to each topic/range item', () => {
    const source: TestQuestion[] = [
      { topic: 'Square', item: 1, repetition: 5 },
      { topic: 'Cube', item: 1, repetition: 3 },
      { topic: 'Cube', item: 2, repetition: 3 },
    ];

    const result = expandQuizQuestionPool(source, (question) => question.repetition, true);

    expect(result).toHaveLength(11);
    expect(result.filter((question) => question.topic === 'Square')).toHaveLength(5);
    expect(result.filter((question) => question.topic === 'Cube' && question.item === 1)).toHaveLength(3);
    expect(result.filter((question) => question.topic === 'Cube' && question.item === 2)).toHaveLength(3);
  });

  it('does not multiply a pool again when the same source pool is used for retry', () => {
    const source: TestQuestion[] = [
      { topic: 'Square', item: 2, repetition: 5 },
      { topic: 'Square', item: 3, repetition: 5 },
    ];

    const firstRun = expandQuizQuestionPool(source, (question) => question.repetition, true);
    const retryRun = expandQuizQuestionPool(source, (question) => question.repetition, true);

    expect(firstRun).toHaveLength(10);
    expect(retryRun).toHaveLength(10);
    expect(firstRun.map((question) => question.item)).toEqual(retryRun.map((question) => question.item));
  });

  it('leaves repetition-off order untouched', () => {
    const source: TestQuestion[] = [
      { topic: 'Square', item: 3, repetition: 1 },
      { topic: 'Square', item: 1, repetition: 1 },
      { topic: 'Square', item: 2, repetition: 1 },
    ];

    const result = expandQuizQuestionPool(source, (question) => question.repetition, false);

    expect(result).toEqual(source);
  });
});
