export const MAX_REPETITION = 10;

export function sanitizeRepetition(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 1;
  return Math.min(MAX_REPETITION, Math.max(1, Math.floor(numeric)));
}

export interface RepetitionConfig {
  enabled: boolean;
  repetitionByTopic: Record<string, number>;
  sequential: boolean;
  count: number;
  infinite: boolean;
}

type TopicQuestion = {
  topicId?: string;
};

function shuffleInPlace<T>(items: T[]): void {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
}

/**
 * Selects the base question pool first, then applies each topic's repetition.
 * This keeps the existing Questions setting deterministic while ensuring
 * repetition is applied exactly once per generated question.
 */
export function buildQuestionPool<T extends TopicQuestion>(
  questions: T[],
  config: RepetitionConfig,
): T[] {
  const basePool = [...questions];

  if (!config.sequential) {
    shuffleInPlace(basePool);
  }

  const baseCount = Number.isFinite(config.count)
    ? Math.max(0, Math.floor(config.count))
    : 0;
  const selectedBase = config.infinite ? basePool : basePool.slice(0, baseCount);

  const expanded: T[] = [];
  for (const question of selectedBase) {
    const repetition = config.enabled
      ? sanitizeRepetition(config.repetitionByTopic[question.topicId ?? ''])
      : 1;

    for (let i = 0; i < repetition; i += 1) {
      expanded.push(question);
    }
  }

  if (!config.sequential) {
    shuffleInPlace(expanded);
  }

  return expanded;
}
