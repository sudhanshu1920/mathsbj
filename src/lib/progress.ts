const STORAGE_KEY = 'math-app-progress';

export interface ProgressData {
  totalAttempts: number;
  correct: number;
  wrong: number;
  streak: number;
  bestStreak: number;
  byTopic: Record<string, { attempts: number; correct: number }>;
}

export interface SaveResultOptions {
  /** Suppress the refresh event when a caller batches another related update. */
  notify?: boolean;
}

const defaultProgress: ProgressData = {
  totalAttempts: 0,
  correct: 0,
  wrong: 0,
  streak: 0,
  bestStreak: 0,
  byTopic: {},
};

const asNonNegativeInt = (value: unknown, fallback = 0): number => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : fallback;
};

const normalizeProgress = (value: unknown): ProgressData => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...defaultProgress, byTopic: {} };

  const raw = value as Record<string, unknown>;
  const correct = asNonNegativeInt(raw.correct);
  const wrong = asNonNegativeInt(raw.wrong);
  const totalAttempts = Math.max(asNonNegativeInt(raw.totalAttempts), correct + wrong);
  const streak = asNonNegativeInt(raw.streak);
  const bestStreak = Math.max(asNonNegativeInt(raw.bestStreak), streak);
  const byTopic: ProgressData['byTopic'] = {};

  if (raw.byTopic && typeof raw.byTopic === 'object' && !Array.isArray(raw.byTopic)) {
    for (const [topic, entry] of Object.entries(raw.byTopic as Record<string, unknown>)) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
      const item = entry as Record<string, unknown>;
      const itemCorrect = asNonNegativeInt(item.correct);
      const itemAttempts = Math.max(asNonNegativeInt(item.attempts), itemCorrect);
      byTopic[topic] = { attempts: itemAttempts, correct: itemCorrect };
    }
  }

  return { totalAttempts, correct, wrong, streak, bestStreak, byTopic };
};

// Cache the normalized snapshot, but validate it against the persisted raw value
// on every read. This also observes writes from sync, restore and other modules.
let cachedRaw: string | null | undefined;
let cachedProgress: ProgressData | null = null;

const readProgress = (): ProgressData => {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return { ...defaultProgress, byTopic: {} };
  }

  if (cachedProgress && cachedRaw === raw) return cachedProgress;

  try {
    cachedProgress = normalizeProgress(raw ? JSON.parse(raw) : null);
  } catch {
    cachedProgress = { ...defaultProgress, byTopic: {} };
  }
  cachedRaw = raw;
  return cachedProgress;
};

const cloneProgress = (progress: ProgressData): ProgressData => ({
  ...progress,
  byTopic: Object.fromEntries(
    Object.entries(progress.byTopic).map(([topic, value]) => [topic, { ...value }]),
  ),
});

const persistProgress = (progress: ProgressData) => {
  const raw = JSON.stringify(progress);
  localStorage.setItem(STORAGE_KEY, raw);
  cachedRaw = raw;
  cachedProgress = progress;
};

export const getProgress = (): ProgressData => cloneProgress(readProgress());

export const saveResult = (
  topic: string,
  isCorrect: boolean,
  options: SaveResultOptions = {},
) => {
  const current = readProgress();
  const p = cloneProgress(current);
  p.totalAttempts++;
  if (isCorrect) {
    p.correct++;
    p.streak++;
    if (p.streak > p.bestStreak) p.bestStreak = p.streak;
  } else {
    p.wrong++;
    p.streak = 0;
  }

  const previousTopic = p.byTopic[topic] || { attempts: 0, correct: 0 };
  p.byTopic[topic] = { ...previousTopic, attempts: previousTopic.attempts + 1 };
  if (isCorrect) p.byTopic[topic].correct++;

  persistProgress(p);
  if (options.notify !== false) {
    window.dispatchEvent(new CustomEvent('analytics-updated'));
  }
  return cloneProgress(p);
};

export const resetProgress = () => {
  const reset = { ...defaultProgress, byTopic: {} };
  persistProgress(reset);
  window.dispatchEvent(new CustomEvent('analytics-updated'));
};
