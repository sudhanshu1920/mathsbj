export const QUIZ_REPETITION_OPTIONS = [1, 2, 3, 5, 10] as const;

export const MAX_QUIZ_REPETITION = Math.max(...QUIZ_REPETITION_OPTIONS);

export function normalizeQuizRepetition(value: number | undefined): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(MAX_QUIZ_REPETITION, Math.max(1, Math.floor(value)));
}

/**
 * Expands the selected quiz items according to each item's repetition count.
 *
 * Sequential order keeps each item's repetitions together.
 * Random order shuffles the expanded pool so repeated items can appear
 * at different positions while preserving the exact repetition count.
 */
export function expandQuizQuestionPool<T>(
  questions: readonly T[],
  getRepetition: (question: T) => number | undefined,
  sequential: boolean,
): T[] {
  const expanded = questions.flatMap((question) => {
    const repetition = normalizeQuizRepetition(getRepetition(question));
    return Array.from({ length: repetition }, () => question);
  });

  if (sequential || !expanded.length) {
    return expanded;
  }

  const hasActualRepetition = questions.some(
    (question) => normalizeQuizRepetition(getRepetition(question)) > 1,
  );

  if (!hasActualRepetition) {
    // Repetition is effectively Off (1×), so preserve the existing
    // pre-shuffled order exactly.
    return expanded;
  }

  for (let i = expanded.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [expanded[i], expanded[j]] = [expanded[j], expanded[i]];
  }

  return expanded;
}
