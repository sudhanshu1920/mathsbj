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

export const getProgress = (): ProgressData => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { ...defaultProgress };
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
