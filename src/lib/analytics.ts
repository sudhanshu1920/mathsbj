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

// Parsed analytics can grow with study history. Keep one normalized copy in
// memory and invalidate it whenever the underlying localStorage value changes.
let cachedRaw: string | null | undefined;
let cachedAnalytics: AnalyticsState | null = null;

const readAnalytics = (): AnalyticsState => {
  let raw: string | null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return empty();
  }

  if (cachedAnalytics && cachedRaw === raw) return cachedAnalytics;

  try {
    cachedAnalytics = normalizeAnalytics(raw ? JSON.parse(raw) : null);
  } catch {
    cachedAnalytics = empty();
  }
  cachedRaw = raw;
  return cachedAnalytics;
};

const cloneAnalytics = (state: AnalyticsState): AnalyticsState => ({
  days: Object.fromEntries(
    Object.entries(state.days).map(([date, day]) => [date, { ...day, hours: [...day.hours] }]),
  ),
});

export const getAnalytics = (): AnalyticsState => cloneAnalytics(readAnalytics());

const save = (state: AnalyticsState) => {
  const raw = JSON.stringify(state);
  localStorage.setItem(KEY, raw);
  cachedRaw = raw;
  cachedAnalytics = state;
  window.dispatchEvent(new CustomEvent('analytics-updated'));
};

export const recordAnswer = (isCorrect: boolean, streakBonus = 0) => {
  const state = readAnalytics();
  const now = new Date();
  const date = todayStr(now);
  const day = state.days[date] || (state.days[date] = emptyDay(date));
  if (day.hours.length !== 24) day.hours = Array(24).fill(0);
  const points = isCorrect ? POINTS_CORRECT + streakBonus : POINTS_WRONG;
  day.hours[now.getHours()] += points;
  day.points += points;
  day.questions += 1;
  if (isCorrect) day.correct += 1;
  save(state);
};

export const getDay = (state: AnalyticsState, date: string): DayAnalytics =>
  state.days[date] || emptyDay(date);

export const POINTS = { correct: POINTS_CORRECT, wrong: POINTS_WRONG };
