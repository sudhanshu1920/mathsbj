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
 * Build the quiz pool with one clear ownership rule:
 * - Repetition OFF: the existing Questions / Infinite behavior is preserved.
 * - Repetition ON: Questions is ignored completely. Every generated base
 *   question is repeated exactly by its topic's configured finite count.
 *
 * Selection happens before repetition so a repetition run can never be
 * truncated by the legacy question-count setting.
 */
export function buildQuestionPool<T extends TopicQuestion>(
  questions: T[],
  config: RepetitionConfig,
): T[] {
  const basePool = [...questions];

  if (!config.enabled) {
    if (!config.sequential) {
      shuffleInPlace(basePool);
    }

    const baseCount = Number.isFinite(config.count)
      ? Math.max(0, Math.floor(config.count))
      : 0;
    return config.infinite ? basePool : basePool.slice(0, baseCount);
  }

  // Repetition mode owns the total. The legacy Questions setting, including
  // the ∞ option, has no authority here.
  const expanded: T[] = [];
  for (const question of basePool) {
    const repetition = sanitizeRepetition(config.repetitionByTopic[question.topicId ?? '']);

    for (let i = 0; i < repetition; i += 1) {
      // Clone each generated instance so every slot is an independent
      // question instance even when the source question repeats.
      expanded.push({ ...question });
    }
  }

  // Sequential mode keeps each item's repetitions contiguous. Random mode
  // shuffles the fully expanded pool while preserving exact multiplicities.
  if (!config.sequential) {
    shuffleInPlace(expanded);
  }

  return expanded;
}
