export interface QuizRetryQuestion {
  quizQuestionId?: string;
  quizIsRetry?: boolean;
}

/**
 * Give each primary-pool slot its own identity. A topic's configured 2x/3x
 * repetitions are distinct primary slots, while retries retain that slot ID.
 */
export function identifyQuizQuestions<T extends object>(
  questions: readonly T[],
  poolGeneration: number,
): Array<T & { quizQuestionId: string; quizIsRetry: false }> {
  const generation = Number.isFinite(poolGeneration)
    ? Math.max(0, Math.floor(poolGeneration))
    : 0;

  return questions.map((question, index) => ({
    ...question,
    quizQuestionId: `${generation}:${index}`,
    quizIsRetry: false as const,
  }));
}

/**
 * Append a wrong question to the tail so every primary question gets its turn
 * before retries. The queue may contain at most one pending retry per identity.
 */
export function enqueueQuestionRetry<T extends QuizRetryQuestion>(
  queue: readonly T[],
  currentIndex: number,
  question: T,
  completedQuestionIds: ReadonlySet<string>,
): T[] {
  const questionId = question.quizQuestionId;
  if (!questionId || completedQuestionIds.has(questionId)) return [...queue];

  const nextIndex = Number.isFinite(currentIndex) ? Math.floor(currentIndex) : -1;
  const alreadyPending = queue
    .slice(Math.max(-1, nextIndex) + 1)
    .some((candidate) => candidate.quizQuestionId === questionId);

  if (alreadyPending) return [...queue];
  return [...queue, { ...question, quizIsRetry: true } as T];
}

/**
 * Last-resort consistency guard: if a finite repetition session reaches the
 * tail with incomplete originals but no retry queued, append the missing items
 * rather than finishing early. Already completed or queued identities are kept
 * out of the retry queue.
 */
export function ensureOutstandingQuestionRetries<T extends QuizRetryQuestion>(
  queue: readonly T[],
  currentIndex: number,
  originalQuestions: readonly T[],
  completedQuestionIds: ReadonlySet<string>,
): T[] {
  const next = [...queue];
  const nextIndex = Number.isFinite(currentIndex) ? Math.floor(currentIndex) : -1;
  const pendingIds = new Set(
    next
      .slice(Math.max(-1, nextIndex) + 1)
      .map((question) => question.quizQuestionId)
      .filter((id): id is string => Boolean(id)),
  );

  for (const original of originalQuestions) {
    const questionId = original.quizQuestionId;
    if (!questionId || completedQuestionIds.has(questionId) || pendingIds.has(questionId)) continue;
    next.push({ ...original, quizIsRetry: true } as T);
    pendingIds.add(questionId);
  }

  return next;
}

/** Progress is based on unique originals correctly completed, never queue length. */
export function getQuizCompletionPercent(
  completedCount: number,
  originalQuestionCount: number,
): number {
  if (!Number.isFinite(originalQuestionCount) || originalQuestionCount <= 0) return 0;
  const completed = Number.isFinite(completedCount) ? Math.max(0, completedCount) : 0;
  return Math.min(100, Math.max(0, (completed / originalQuestionCount) * 100));
}

/** A finite repetition quiz must solve every original slot before it can finish. */
export function shouldFinishQuestionQueue(
  queueLength: number,
  currentIndex: number,
  repetitionEnabled: boolean,
  completedCount: number,
  originalQuestionCount: number,
): boolean {
  if (!Number.isFinite(queueLength) || !Number.isFinite(currentIndex)) return false;
  const atQueueEnd = Math.floor(currentIndex) + 1 >= Math.max(0, Math.floor(queueLength));
  if (!atQueueEnd) return false;
  return !repetitionEnabled || completedCount >= originalQuestionCount;
}
