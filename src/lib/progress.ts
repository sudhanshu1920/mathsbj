const STORAGE_KEY = 'math-app-progress';

export interface ProgressData {
  totalAttempts: number;
  correct: number;
  wrong: number;
  streak: number;
  bestStreak: number;
  byTopic: Record<string, { attempts: number; correct: number }>;
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
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...defaultProgress };

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

export const getProgress = (): ProgressData => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return normalizeProgress(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...defaultProgress };
  }
};

export const saveResult = (topic: string, isCorrect: boolean) => {
  const p = getProgress();
  p.totalAttempts++;
  if (isCorrect) {
    p.correct++;
    p.streak++;
    if (p.streak > p.bestStreak) p.bestStreak = p.streak;
  } else {
    p.wrong++;
    p.streak = 0;
  }

  if (!p.byTopic[topic]) p.byTopic[topic] = { attempts: 0, correct: 0 };
  p.byTopic[topic].attempts++;
  if (isCorrect) p.byTopic[topic].correct++;

  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  window.dispatchEvent(new CustomEvent('analytics-updated'));
  return p;
};

export const resetProgress = () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultProgress));
  window.dispatchEvent(new CustomEvent('analytics-updated'));
};
