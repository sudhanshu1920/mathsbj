const KEY = 'math-app-analytics-v1';

export interface DayAnalytics {
  date: string; // YYYY-MM-DD
  hours: number[]; // 24 buckets, points per hour
  points: number;
  questions: number;
  correct: number;
}

export interface AnalyticsState {
  days: Record<string, DayAnalytics>;
}

// Unified points: +1 per correct answer, small streak bonus
const POINTS_CORRECT = 1;
const POINTS_WRONG = 0;

const pad = (n: number) => String(n).padStart(2, '0');
export const todayStr = (d = new Date()) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const empty = (): AnalyticsState => ({ days: {} });
const emptyDay = (date: string): DayAnalytics => ({
  date,
  hours: Array(24).fill(0),
  points: 0,
  questions: 0,
  correct: 0,
});

const normalizeAnalytics = (value: unknown): AnalyticsState => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return empty();

  const raw = value as Record<string, unknown>;
  const days: AnalyticsState['days'] = {};
  if (!raw.days || typeof raw.days !== 'object' || Array.isArray(raw.days)) return { days };

  for (const [date, entry] of Object.entries(raw.days as Record<string, unknown>)) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const item = entry as Record<string, unknown>;
    const hours = Array.isArray(item.hours)
      ? Array.from({ length: 24 }, (_, index) => {
          const value = Number(item.hours[index]);
          return Number.isFinite(value) && value >= 0 ? value : 0;
        })
      : Array(24).fill(0);
    const questionsValue = Number(item.questions);
    const correctValue = Number(item.correct);
    const pointsValue = Number(item.points);
    const questions = Number.isFinite(questionsValue) ? Math.max(0, Math.floor(questionsValue)) : 0;
    const correct = Number.isFinite(correctValue) ? Math.min(questions, Math.max(0, Math.floor(correctValue))) : 0;
    const points = Number.isFinite(pointsValue) ? Math.max(0, pointsValue) : 0;
    days[date] = {
      date: typeof item.date === 'string' ? item.date : date,
      hours,
      points,
      questions,
      correct,
    };
  }

  return { days };
};

export const getAnalytics = (): AnalyticsState => {
  try {
    const raw = localStorage.getItem(KEY);
    return normalizeAnalytics(raw ? JSON.parse(raw) : null);
  } catch {
    return empty();
  }
};

const save = (s: AnalyticsState) => {
  localStorage.setItem(KEY, JSON.stringify(s));
  window.dispatchEvent(new CustomEvent('analytics-updated'));
};

export const recordAnswer = (isCorrect: boolean, streakBonus = 0) => {
  const s = getAnalytics();
  const now = new Date();
  const ds = todayStr(now);
  const day = s.days[ds] || emptyDay(ds);
  if (day.hours.length !== 24) day.hours = Array(24).fill(0);
  const pts = isCorrect ? POINTS_CORRECT + streakBonus : POINTS_WRONG;
  day.hours[now.getHours()] += pts;
  day.points += pts;
  day.questions += 1;
  if (isCorrect) day.correct += 1;
  s.days[ds] = day;
  save(s);
};

export const getDay = (s: AnalyticsState, date: string): DayAnalytics =>
  s.days[date] || emptyDay(date);

export const POINTS = { correct: POINTS_CORRECT, wrong: POINTS_WRONG };