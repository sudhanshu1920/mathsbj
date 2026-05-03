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

const POINTS_CORRECT = 10;
const POINTS_WRONG = 2;

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

export const getAnalytics = (): AnalyticsState => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const s = JSON.parse(raw) as AnalyticsState;
    return { days: s.days || {} };
  } catch {
    return empty();
  }
};

const save = (s: AnalyticsState) => {
  localStorage.setItem(KEY, JSON.stringify(s));
  window.dispatchEvent(new CustomEvent('analytics-updated'));
};

export const recordAnswer = (isCorrect: boolean) => {
  const s = getAnalytics();
  const now = new Date();
  const ds = todayStr(now);
  const day = s.days[ds] || emptyDay(ds);
  if (day.hours.length !== 24) day.hours = Array(24).fill(0);
  const pts = isCorrect ? POINTS_CORRECT : POINTS_WRONG;
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