const KEY = 'math-app-streak-v1';

export type DayStatus = 'completed' | 'freeze' | 'partial' | 'missed' | 'upcoming' | 'today';

export interface DayRecord {
  date: string; // YYYY-MM-DD
  seconds: number;
  completed: boolean;
  freeze?: boolean;
}

export interface StreakState {
  enabled: boolean;
  targetMinutes: number; // daily goal
  current: number; // current streak length
  best: number;
  freezeUsedMonth: string; // YYYY-MM
  freezesUsed: number;
  days: Record<string, DayRecord>;
  lastEvalDate: string; // YYYY-MM-DD
}

const MAX_FREEZE_PER_MONTH = 3;

// Hot-path cache: Practice time tracking calls getStreak once per second.
// Keep the normalized state in memory while still persisting every tick.
let cache: StreakState | null = null;

export const invalidateStreakCache = () => {
  cache = null;
};

const today = (): string => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const monthKey = (dateStr: string) => dateStr.slice(0, 7);

const addDays = (dateStr: string, n: number): string => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
};

const defaults = (): StreakState => ({
  enabled: true,
  targetMinutes: 5,
  current: 0,
  best: 0,
  freezeUsedMonth: monthKey(today()),
  freezesUsed: 0,
  days: {},
  lastEvalDate: today(),
});

const normalizeStreak = (value: unknown): StreakState => {
  const base = defaults();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return base;

  const raw = value as Record<string, unknown>;
  const target = Number(raw.targetMinutes);
  const current = Number(raw.current);
  const best = Number(raw.best);
  const freezesUsed = Number(raw.freezesUsed);
  const days: StreakState['days'] = {};

  if (raw.days && typeof raw.days === 'object' && !Array.isArray(raw.days)) {
    for (const [date, entry] of Object.entries(raw.days as Record<string, unknown>)) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
      const item = entry as Record<string, unknown>;
      const seconds = Number(item.seconds);
      days[date] = {
        date: typeof item.date === 'string' ? item.date : date,
        seconds: Number.isFinite(seconds) ? Math.max(0, seconds) : 0,
        completed: item.completed === true,
        ...(item.freeze === true ? { freeze: true } : {}),
      };
    }
  }

  return {
    enabled: true,
    targetMinutes: Number.isFinite(target) ? Math.max(1, target) : base.targetMinutes,
    current: Number.isFinite(current) ? Math.max(0, Math.floor(current)) : 0,
    best: Number.isFinite(best) ? Math.max(0, Math.floor(best), Number.isFinite(current) ? Math.max(0, Math.floor(current)) : 0) : 0,
    freezeUsedMonth: typeof raw.freezeUsedMonth === 'string' && /^\d{4}-\d{2}$/.test(raw.freezeUsedMonth)
      ? raw.freezeUsedMonth
      : base.freezeUsedMonth,
    freezesUsed: Number.isFinite(freezesUsed) ? Math.min(MAX_FREEZE_PER_MONTH, Math.max(0, Math.floor(freezesUsed))) : 0,
    days,
    lastEvalDate: typeof raw.lastEvalDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.lastEvalDate)
      ? raw.lastEvalDate
      : base.lastEvalDate,
  };
};

export const getStreak = (): StreakState => {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = normalizeStreak(raw ? JSON.parse(raw) : null);
  } catch {
    cache = defaults();
  }
  return cache;
};

const save = (s: StreakState, notify = true) => {
  cache = s;
  localStorage.setItem(KEY, JSON.stringify(s));
  // Persistence sync is independent from UI refresh. This keeps partial daily
  // progress cloud-synced without waking LearningPage every second.
  window.dispatchEvent(new CustomEvent('streak-persisted'));
  if (notify) window.dispatchEvent(new CustomEvent('streak-updated'));
};

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === KEY) invalidateStreakCache();
  });
}

/**
 * Roll forward through any missed days since lastEvalDate.
 * For each missed day apply a freeze (if available) else reset streak.
 */
const countMonthFreezes = (state: StreakState, month: string): number =>
  Object.values(state.days).filter((record) => monthKey(record.date) === month && record.freeze === true).length;

/**
 * Roll forward through any missed days since lastEvalDate.
 * Each missed day consumes one of that calendar month's available freezes before
 * resetting the streak. Historical month usage is reconstructed from recorded
 * freeze days so a delayed app launch cannot incorrectly reset a prior month.
 */
export const evaluateStreak = (state?: StreakState, evaluationDate = today()): StreakState => {
  const s = state ? { ...state, days: { ...state.days } } : getStreak();
  const t = evaluationDate;
  let dirty = false;
  const beforeCurrent = s.current;

  if (!s.enabled) {
    if (s.lastEvalDate !== t) {
      s.lastEvalDate = t;
      dirty = true;
    }
    if (dirty) save(s, false);
    return s;
  }

  const currentMonth = monthKey(t);
  const currentMonthFreezes = countMonthFreezes(s, currentMonth);

  // Keep the persisted counter aligned with the current calendar month.
  if (s.freezeUsedMonth !== currentMonth) {
    s.freezeUsedMonth = currentMonth;
    s.freezesUsed = currentMonthFreezes;
    dirty = true;
  } else if (s.freezesUsed < currentMonthFreezes) {
    s.freezesUsed = currentMonthFreezes;
    dirty = true;
  }

  // Walk from day after lastEvalDate up to (but not including) today.
  let cursor = addDays(s.lastEvalDate, 1);
  while (cursor < t) {
    const rec = s.days[cursor];
    if (!rec?.completed) {
      const cursorMonth = monthKey(cursor);
      const freezesUsed = cursorMonth === currentMonth
        ? s.freezesUsed
        : countMonthFreezes(s, cursorMonth);

      if (freezesUsed < MAX_FREEZE_PER_MONTH) {
        s.days[cursor] = {
          date: cursor,
          seconds: rec?.seconds || 0,
          completed: false,
          freeze: true,
        };
        if (cursorMonth === currentMonth) {
          s.freezesUsed = freezesUsed + 1;
        }
        dirty = true;
      } else {
        // Streak resets when that calendar month's freeze allowance is exhausted.
        s.current = 0;
        s.days[cursor] = {
          date: cursor,
          seconds: rec?.seconds || 0,
          completed: false,
        };
        dirty = true;
      }
    }
    cursor = addDays(cursor, 1);
  }

  if (s.lastEvalDate !== t) {
    s.lastEvalDate = t;
    dirty = true;
  }
  if (dirty) save(s, s.current !== beforeCurrent);
  return s;
};

export const setEnabled = (enabled: boolean): StreakState => {
  const s = getStreak();
  s.enabled = enabled;
  s.lastEvalDate = today();
  save(s);
  return s;
};

export const setTarget = (minutes: number): StreakState => {
  const s = getStreak();
  s.targetMinutes = Math.max(1, minutes);
  save(s);
  return s;
};

/**
 * Add seconds toward today's daily target. Marks day completed and
 * advances streak when target reached.
 */
export const addSeconds = (seconds: number): StreakState => {
  const s = evaluateStreak();
  if (!s.enabled || seconds <= 0) return s;

  const t = today();
  const rec: DayRecord = s.days[t] || { date: t, seconds: 0, completed: false };
  const wasCompleted = rec.completed;
  rec.seconds = (rec.seconds || 0) + seconds;

  const targetSec = s.targetMinutes * 60;
  if (!wasCompleted && rec.seconds >= targetSec) {
    rec.completed = true;
    // Was yesterday completed (or freeze)? then continue, else start at 1
    const y = addDays(t, -1);
    const yRec = s.days[y];
    const continued = !!(yRec && (yRec.completed || yRec.freeze));
    s.current = continued ? s.current + 1 : 1;
    if (s.current > s.best) s.best = s.current;
  }

  s.days[t] = rec;
  // The current streak UI only changes when a daily target is completed or the
  // streak resets. Avoid notifying every component on every second.
  const notify = !wasCompleted && rec.completed;
  save(s, notify);
  return s;
};

export const dayStatus = (state: StreakState, dateStr: string): DayStatus => {
  const t = today();
  if (dateStr > t) return 'upcoming';
  const rec = state.days[dateStr];
  if (dateStr === t) {
    if (rec?.completed) return 'completed';
    return 'today';
  }
  if (!rec) return 'missed';
  if (rec.completed) return 'completed';
  if (rec.freeze) return 'freeze';
  if (rec.seconds > 0) return 'partial';
  return 'missed';
};

export const todayStr = today;
export const getMaxFreezePerMonth = () => MAX_FREEZE_PER_MONTH;