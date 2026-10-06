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

export const getStreak = (): StreakState => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    const merged = { ...defaults(), ...JSON.parse(raw) } as StreakState;
    // Daily target is mandatory always-on now
    merged.enabled = true;
    return merged;
  } catch {
    return defaults();
  }
};

const save = (s: StreakState) => {
  localStorage.setItem(KEY, JSON.stringify(s));
  window.dispatchEvent(new CustomEvent('streak-updated'));
};

/**
 * Roll forward through any missed days since lastEvalDate.
 * For each missed day apply a freeze (if available) else reset streak.
 */
export const evaluateStreak = (state?: StreakState): StreakState => {
  const s = state ? { ...state, days: { ...state.days } } : getStreak();
  if (!s.enabled) {
    s.lastEvalDate = today();
    save(s);
    return s;
  }

  const t = today();
  // Reset monthly freeze counter if month changed
  if (s.freezeUsedMonth !== monthKey(t)) {
    s.freezeUsedMonth = monthKey(t);
    s.freezesUsed = 0;
  }

  // Walk from day after lastEvalDate up to (but not including) today
  let cursor = addDays(s.lastEvalDate, 1);
  while (cursor < t) {
    const rec = s.days[cursor];
    const completed = rec?.completed;
    if (!completed) {
      // Need a freeze
      if (s.freezesUsed < MAX_FREEZE_PER_MONTH && monthKey(cursor) === s.freezeUsedMonth) {
        s.days[cursor] = { date: cursor, seconds: rec?.seconds || 0, completed: false, freeze: true };
        s.freezesUsed += 1;
      } else {
        // streak resets
        s.current = 0;
        s.days[cursor] = { date: cursor, seconds: rec?.seconds || 0, completed: false };
      }
    }
    cursor = addDays(cursor, 1);
  }
  s.lastEvalDate = t;
  save(s);
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
  save(s);
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